import fs from "node:fs";
import path from "node:path";

import type {
  LocalSourceReadFailureCode,
  LocalSourceReadResult,
  LocalSourceResolver,
} from "../application/bootstrap-read-path.js";

export class LocalVerificationContextError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "LocalVerificationContextError";
    this.code = code;
  }
}

interface LocalFilesystemContext {
  readonly documentPath: string;
  readonly resolver: LocalSourceResolver;
}

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative.length === 0 ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  );
}

function relativeComponents(
  root: string,
  candidate: string,
): readonly string[] {
  const relative = path.relative(root, candidate);
  if (!isContained(root, candidate) || relative.length === 0) return [];
  return relative.split(path.sep);
}

function regularFileKind(stats: fs.Stats | fs.BigIntStats): string {
  if (stats.isDirectory()) return "directory";
  if (stats.isFIFO()) return "fifo";
  if (stats.isSocket()) return "socket";
  if (stats.isCharacterDevice() || stats.isBlockDevice()) return "device";
  return "other";
}

function errorCode(error: unknown): string {
  return error !== null && typeof error === "object" && "code" in error
    ? String(error.code)
    : "UNKNOWN";
}

function availabilityCause(error: unknown): string {
  switch (errorCode(error)) {
    case "ENOENT":
    case "ENOTDIR":
      return "not_found";
    case "EACCES":
    case "EPERM":
      return "permission_denied";
    default:
      return "io_error";
  }
}

function assertDocumentPath(
  documentPath: string,
  rootInputPath: string,
  canonicalRoot: string,
): string {
  const absoluteDocument = path.resolve(documentPath);
  let walkRoot: string | null = null;
  if (isContained(rootInputPath, absoluteDocument)) {
    walkRoot = rootInputPath;
  } else if (isContained(canonicalRoot, absoluteDocument)) {
    walkRoot = canonicalRoot;
  }
  if (walkRoot === null) {
    throw new LocalVerificationContextError(
      "EVERIFY_DOCUMENT_OUTSIDE_ROOT",
      "The .recog document is outside the verification root.",
    );
  }
  let current = walkRoot;
  for (const component of relativeComponents(walkRoot, absoluteDocument)) {
    current = path.join(current, component);
    const stats = fs.lstatSync(current);
    if (stats.isSymbolicLink()) {
      throw new LocalVerificationContextError(
        "EVERIFY_DOCUMENT_SYMLINK",
        "The .recog document path contains a symbolic link.",
      );
    }
  }
  const canonicalDocument = fs.realpathSync(absoluteDocument);
  if (!isContained(canonicalRoot, canonicalDocument)) {
    throw new LocalVerificationContextError(
      "EVERIFY_DOCUMENT_OUTSIDE_ROOT",
      "The resolved .recog document is outside the verification root.",
    );
  }
  const documentStats = fs.lstatSync(canonicalDocument);
  if (!documentStats.isFile()) {
    throw new LocalVerificationContextError(
      "EVERIFY_DOCUMENT_NOT_REGULAR",
      "The .recog document is not a regular file.",
    );
  }
  return canonicalDocument;
}

function locatorProfileReason(locator: string): string | null {
  if (locator.includes("\0")) return "nul";
  if (locator.includes("\\")) return "backslash";
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(locator)) return "uri_scheme";
  if (path.posix.isAbsolute(locator)) return "absolute";
  if (locator.split("/").some((segment) => segment.length === 0)) {
    return "empty_segment";
  }
  return null;
}

function failure(
  code: LocalSourceReadFailureCode,
  resolvedPath: string | null,
  reasonData: Readonly<Record<string, unknown>>,
): LocalSourceReadResult {
  return { ok: false, code, resolvedPath, reasonData };
}

function sameOpenedFile(left: fs.BigIntStats, right: fs.BigIntStats): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function readRemainedStable(
  before: fs.BigIntStats,
  after: fs.BigIntStats,
  pathAfter: fs.BigIntStats,
): boolean {
  return (
    sameOpenedFile(before, after) &&
    after.dev === pathAfter.dev &&
    after.ino === pathAfter.ino &&
    !pathAfter.isSymbolicLink()
  );
}

function closeFileDescriptor(fileDescriptor: number | null): void {
  if (fileDescriptor !== null) fs.closeSync(fileDescriptor);
}

function boundedRead(
  fileDescriptor: number,
  maximumBytes: number,
): { readonly bytes: Uint8Array; readonly observedBytes: number } | null {
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const buffer = Buffer.allocUnsafe(
      Math.min(65_536, maximumBytes - total + 1),
    );
    const bytesRead = fs.readSync(
      fileDescriptor,
      buffer,
      0,
      buffer.length,
      null,
    );
    if (bytesRead === 0) break;
    total += bytesRead;
    if (total > maximumBytes) return null;
    chunks.push(buffer.subarray(0, bytesRead));
  }
  return { bytes: Buffer.concat(chunks, total), observedBytes: total };
}

class NodeLocalSourceResolver implements LocalSourceResolver {
  readonly #canonicalRoot: string;
  readonly #documentDirectory: string;
  readonly #maximumBytes: number;

  constructor(
    canonicalRoot: string,
    canonicalDocument: string,
    maximumBytes: number,
  ) {
    this.#canonicalRoot = canonicalRoot;
    this.#documentDirectory = path.dirname(canonicalDocument);
    this.#maximumBytes = maximumBytes;
  }

  read(sourceId: string, locator: string): LocalSourceReadResult {
    const profileReason = locatorProfileReason(locator);
    if (profileReason !== null) {
      return failure("RCG-VERIFY-001", null, {
        source_id: sourceId,
        locator,
        reason: profileReason,
      });
    }
    const candidate = path.resolve(
      this.#documentDirectory,
      ...path.posix.normalize(locator).split("/"),
    );
    if (!isContained(this.#canonicalRoot, candidate)) {
      return failure("RCG-VERIFY-002", null, {
        source_id: sourceId,
        locator,
      });
    }
    const resolvedPath = path
      .relative(this.#canonicalRoot, candidate)
      .split(path.sep)
      .join("/");
    const components = relativeComponents(this.#canonicalRoot, candidate);
    let current = this.#canonicalRoot;
    let finalStats: fs.Stats;
    try {
      for (const [index, component] of components.entries()) {
        current = path.join(current, component);
        const stats = fs.lstatSync(current);
        if (stats.isSymbolicLink()) {
          return failure("RCG-VERIFY-003", resolvedPath, {
            source_id: sourceId,
            locator,
            component_index: index,
          });
        }
        if (index < components.length - 1 && !stats.isDirectory()) {
          return failure("RCG-VERIFY-004", resolvedPath, {
            source_id: sourceId,
            locator,
            cause: "not_found",
          });
        }
      }
      finalStats = fs.lstatSync(candidate);
    } catch (error) {
      return failure("RCG-VERIFY-004", resolvedPath, {
        source_id: sourceId,
        locator,
        cause: availabilityCause(error),
      });
    }
    if (!finalStats.isFile()) {
      return failure("RCG-VERIFY-005", resolvedPath, {
        source_id: sourceId,
        locator,
        kind: regularFileKind(finalStats),
      });
    }
    if (finalStats.size > this.#maximumBytes) {
      return failure("RCG-VERIFY-006", resolvedPath, {
        source_id: sourceId,
        locator,
        limit_bytes: this.#maximumBytes,
        observed_bytes: finalStats.size,
      });
    }
    return this.#readRegularFile(sourceId, locator, candidate, resolvedPath);
  }

  #readRegularFile(
    sourceId: string,
    locator: string,
    candidate: string,
    resolvedPath: string,
  ): LocalSourceReadResult {
    const noFollow = fs.constants.O_NOFOLLOW;
    if (typeof noFollow !== "number" || noFollow === 0) {
      return failure("RCG-VERIFY-004", resolvedPath, {
        source_id: sourceId,
        locator,
        cause: "policy_unavailable",
      });
    }
    let fileDescriptor: number | null = null;
    try {
      fileDescriptor = fs.openSync(candidate, fs.constants.O_RDONLY | noFollow);
      const before = fs.fstatSync(fileDescriptor, { bigint: true });
      if (!before.isFile()) {
        return failure("RCG-VERIFY-005", resolvedPath, {
          source_id: sourceId,
          locator,
          kind: regularFileKind(before),
        });
      }
      if (before.size > BigInt(this.#maximumBytes)) {
        return failure("RCG-VERIFY-006", resolvedPath, {
          source_id: sourceId,
          locator,
          limit_bytes: this.#maximumBytes,
          observed_bytes: Number(before.size),
        });
      }
      const read = boundedRead(fileDescriptor, this.#maximumBytes);
      if (read === null) {
        return failure("RCG-VERIFY-006", resolvedPath, {
          source_id: sourceId,
          locator,
          limit_bytes: this.#maximumBytes,
          observed_bytes: this.#maximumBytes + 1,
        });
      }
      const after = fs.fstatSync(fileDescriptor, { bigint: true });
      const pathAfter = fs.lstatSync(candidate, { bigint: true });
      if (!readRemainedStable(before, after, pathAfter)) {
        return failure("RCG-VERIFY-004", resolvedPath, {
          source_id: sourceId,
          locator,
          cause: "changed_during_read",
        });
      }
      return { ok: true, resolvedPath, bytes: read.bytes };
    } catch (error) {
      if (errorCode(error) === "ELOOP") {
        return failure("RCG-VERIFY-003", resolvedPath, {
          source_id: sourceId,
          locator,
          component_index:
            relativeComponents(this.#canonicalRoot, candidate).length - 1,
        });
      }
      return failure("RCG-VERIFY-004", resolvedPath, {
        source_id: sourceId,
        locator,
        cause: availabilityCause(error),
      });
    } finally {
      closeFileDescriptor(fileDescriptor);
    }
  }
}

export function createLocalFilesystemContext(
  documentPath: string,
  verificationRoot: string,
  maximumBytes: number,
): LocalFilesystemContext {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new LocalVerificationContextError(
      "EVERIFY_LIMIT",
      "The source byte limit is invalid.",
    );
  }
  const rootInputPath = path.resolve(verificationRoot);
  const canonicalRoot = fs.realpathSync(rootInputPath);
  if (!fs.statSync(canonicalRoot).isDirectory()) {
    throw new LocalVerificationContextError(
      "EVERIFY_ROOT_NOT_DIRECTORY",
      "The verification root is not a directory.",
    );
  }
  const canonicalDocument = assertDocumentPath(
    documentPath,
    rootInputPath,
    canonicalRoot,
  );
  return {
    documentPath: canonicalDocument,
    resolver: new NodeLocalSourceResolver(
      canonicalRoot,
      canonicalDocument,
      maximumBytes,
    ),
  };
}
