import fs from "node:fs";

import {
  ExplainInputError,
  auditBootstrapDocument,
  explainBootstrapRecognition,
  showBootstrapDocument,
  showBootstrapRecognition,
  validateBootstrapInput,
  type BootstrapReadInput,
  type BootstrapReadResult,
} from "../application/bootstrap-read-path.js";
import { renderBootstrapText } from "../presentation/bootstrap-text.js";

type OutputFormat = "text" | "json";
type AuditFailOn = "warning" | "error";

interface CommonOptions {
  readonly format: OutputFormat;
  readonly maximumDiagnostics: number;
}

interface ParsedOptions extends CommonOptions {
  readonly requestedVariableIds: readonly string[] | undefined;
  readonly limit: number;
  readonly profile: "base";
  readonly failOn: AuditFailOn;
}

interface OptionPolicy {
  readonly verification: boolean;
  readonly maximumDiagnostics: boolean;
  readonly scope: boolean;
  readonly limit: boolean;
  readonly profile: boolean;
  readonly failOn: boolean;
}

type ParsedCommand =
  | (CommonOptions & {
      readonly resource: "document";
      readonly action: "validate" | "show";
      readonly path: string;
    })
  | (CommonOptions & {
      readonly resource: "document";
      readonly action: "audit";
      readonly path: string;
      readonly failOn: AuditFailOn;
    })
  | (CommonOptions & {
      readonly resource: "recognition";
      readonly action: "show";
      readonly id: string;
      readonly path: string;
    })
  | (ParsedOptions & {
      readonly resource: "recognition";
      readonly action: "explain";
      readonly id: string;
      readonly path: string;
    });

class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

interface OptionState {
  format: OutputFormat;
  maximumDiagnostics: number;
  requestedVariableIds: readonly string[] | undefined;
  limit: number;
  profile: "base";
  failOn: AuditFailOn;
}

function positiveInteger(value: string, option: string): number {
  const parsed = Number(value);
  if (!/^[1-9]\d*$/u.test(value) || !Number.isSafeInteger(parsed)) {
    throw new UsageError(`${option} must be a positive integer.`);
  }
  return parsed;
}

function scopeIds(value: string): readonly string[] {
  const ids = value.split(",");
  if (
    ids.length === 0 ||
    ids.some((id) => !/^[A-Za-z][A-Za-z0-9_.-]*$/u.test(id)) ||
    new Set(ids).size !== ids.length
  ) {
    throw new UsageError(
      "--scope must be a duplicate-free comma-separated variable ID list.",
    );
  }
  return ids;
}

function outputFormat(value: string): OutputFormat {
  if (value !== "text" && value !== "json") {
    throw new UsageError("--format must be text or json.");
  }
  return value;
}

function requireAccepted(accepted: boolean, option: string): void {
  if (!accepted) throw new UsageError(`${option} is not accepted here.`);
}

function auditFailOn(value: string): AuditFailOn {
  if (value !== "warning" && value !== "error") {
    throw new UsageError("--fail-on must be warning or error.");
  }
  return value;
}

function verifySourceOption(policy: OptionPolicy, value: string): void {
  if (!policy.verification || value !== "none") {
    throw new UsageError(
      "The Phase 2 read path accepts only --verify-sources none on validate.",
    );
  }
}

function applyOption(
  state: OptionState,
  policy: OptionPolicy,
  option: string | undefined,
  value: string,
): void {
  switch (option) {
    case "--format":
      state.format = outputFormat(value);
      return;
    case "--max-diagnostics":
      requireAccepted(policy.maximumDiagnostics, "--max-diagnostics");
      state.maximumDiagnostics = positiveInteger(value, "--max-diagnostics");
      return;
    case "--verify-sources":
      verifySourceOption(policy, value);
      return;
    case "--scope":
      requireAccepted(policy.scope, "--scope");
      state.requestedVariableIds = scopeIds(value);
      return;
    case "--limit":
      requireAccepted(policy.limit, "--limit");
      state.limit = positiveInteger(value, "--limit");
      return;
    case "--profile":
      requireAccepted(policy.profile, "--profile");
      if (value !== "base")
        throw new UsageError("--profile must be base in Phase 3.");
      state.profile = value;
      return;
    case "--fail-on":
      requireAccepted(policy.failOn, "--fail-on");
      state.failOn = auditFailOn(value);
      return;
    default:
      throw new UsageError(`Unknown option ${String(option)}.`);
  }
}

function parseOptions(
  args: readonly string[],
  policy: OptionPolicy,
): ParsedOptions {
  const state: OptionState = {
    format: "text",
    maximumDiagnostics: 100,
    requestedVariableIds: undefined,
    limit: 100,
    profile: "base",
    failOn: "error",
  };
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (value === undefined)
      throw new UsageError(`Missing value for ${option}.`);
    applyOption(state, policy, option, value);
  }
  return state;
}

const readOptions: OptionPolicy = {
  verification: false,
  maximumDiagnostics: true,
  scope: false,
  limit: false,
  profile: false,
  failOn: false,
};

function recognitionOperands(
  args: readonly string[],
  action: "show" | "explain",
): { readonly id: string; readonly path: string } {
  const id = args[2];
  const path = args[3];
  if (id === undefined || path === undefined) {
    throw new UsageError(
      `recognition ${action} requires an ID and .recog file path.`,
    );
  }
  if (!/^[A-Za-z][A-Za-z0-9_.-]*$/u.test(id)) {
    throw new UsageError(
      "The recognition ID is not a contract 0.1 identifier.",
    );
  }
  return { id, path };
}

function parseDocumentCommand(
  args: readonly string[],
  action: string | undefined,
): ParsedCommand {
  if (action !== "validate" && action !== "show" && action !== "audit") {
    throw new UsageError("Expected document validate|show|audit.");
  }
  const path = args[2];
  if (path === undefined)
    throw new UsageError("A .recog file path is required.");
  const options = parseOptions(args.slice(3), {
    ...readOptions,
    verification: action === "validate",
    profile: action === "audit",
    failOn: action === "audit",
  });
  if (action === "audit") {
    return {
      resource: "document",
      action,
      path,
      ...options,
    };
  }
  return {
    resource: "document",
    action,
    path,
    ...options,
  };
}

function parseRecognitionCommand(
  args: readonly string[],
  action: string | undefined,
): ParsedCommand {
  if (action === "show") {
    const { id, path } = recognitionOperands(args, action);
    return {
      resource: "recognition",
      action,
      id,
      path,
      ...parseOptions(args.slice(4), readOptions),
    };
  }
  if (action === "explain") {
    const { id, path } = recognitionOperands(args, action);
    return {
      resource: "recognition",
      action,
      id,
      path,
      ...parseOptions(args.slice(4), {
        verification: false,
        maximumDiagnostics: false,
        scope: true,
        limit: true,
        profile: false,
        failOn: false,
      }),
    };
  }
  throw new UsageError("Expected recognition show|explain.");
}

function parseCommand(args: readonly string[]): ParsedCommand {
  if (args[0] === "document") return parseDocumentCommand(args, args[1]);
  if (args[0] === "recognition") {
    return parseRecognitionCommand(args, args[1]);
  }
  throw new UsageError(
    "Expected document validate|show|audit or recognition show|explain.",
  );
}

function execute(command: ParsedCommand): BootstrapReadResult {
  const bytes = fs.readFileSync(command.path);
  const input: BootstrapReadInput = {
    bytes,
    path: command.path,
    maximumDiagnostics: command.maximumDiagnostics,
  };
  if (command.resource === "document") {
    if (command.action === "validate") return validateBootstrapInput(input);
    if (command.action === "show") return showBootstrapDocument(input);
    if (command.action === "audit") {
      return auditBootstrapDocument(input, { failOn: command.failOn });
    }
    throw new Error("unreachable document action");
  }
  if (command.action === "explain") {
    return explainBootstrapRecognition(input, command.id, {
      ...(command.requestedVariableIds === undefined
        ? {}
        : { requestedVariableIds: command.requestedVariableIds }),
      limit: command.limit,
    });
  }
  return showBootstrapRecognition(input, command.id);
}

function exitStatus(result: BootstrapReadResult): number {
  if (result.schema === "Llmrecog.ValidationResult.v1") {
    return result.valid && result.complete ? 0 : 1;
  }
  if (result.schema === "Llmrecog.RecognitionResult.v1" && !result.found)
    return 1;
  if (result.schema === "Llmrecog.AuditResult.v1") {
    return result.passed && result.complete ? 0 : 1;
  }
  return result.complete ? 0 : 1;
}

function writeResult(result: BootstrapReadResult, format: OutputFormat): void {
  process.stdout.write(
    format === "json"
      ? `${JSON.stringify(result, null, 2)}\n`
      : renderBootstrapText(result),
  );
}

function isEncodingFailure(result: BootstrapReadResult): boolean {
  return result.diagnostics.some(
    (diagnostic) => diagnostic.code === "RCG-SYNTAX-001",
  );
}

function main(args: readonly string[]): number {
  try {
    const command = parseCommand(args);
    const result = execute(command);
    if (isEncodingFailure(result)) {
      process.stderr.write("llmrecog input error: RCG-SYNTAX-001\n");
      return 3;
    }
    writeResult(result, command.format);
    return exitStatus(result);
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`llmrecog usage error: ${error.message}\n`);
      return 2;
    }
    if (error instanceof ExplainInputError) {
      process.stderr.write(`llmrecog usage error: ${error.message}\n`);
      return 2;
    }
    const code =
      error !== null && typeof error === "object" && "code" in error
        ? String(error.code)
        : "UNKNOWN";
    process.stderr.write(`llmrecog input error: ${code}\n`);
    return 3;
  }
}

process.exitCode = main(process.argv.slice(2));
