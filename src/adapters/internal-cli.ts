import fs from "node:fs";

import {
  showBootstrapDocument,
  showBootstrapRecognition,
  validateBootstrapInput,
  type BootstrapReadInput,
  type BootstrapReadResult,
} from "../application/bootstrap-read-path.js";
import { renderBootstrapText } from "../presentation/bootstrap-text.js";

type OutputFormat = "text" | "json";

interface CommonOptions {
  readonly format: OutputFormat;
  readonly maximumDiagnostics: number;
}

type ParsedCommand =
  | (CommonOptions & {
      readonly resource: "document";
      readonly action: "validate" | "show";
      readonly path: string;
    })
  | (CommonOptions & {
      readonly resource: "recognition";
      readonly action: "show";
      readonly id: string;
      readonly path: string;
    });

class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

function parseOptions(
  args: readonly string[],
  allowVerification: boolean,
): CommonOptions {
  let format: OutputFormat = "text";
  let maximumDiagnostics = 100;
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (value === undefined)
      throw new UsageError(`Missing value for ${option}.`);
    if (option === "--format") {
      if (value !== "text" && value !== "json") {
        throw new UsageError("--format must be text or json.");
      }
      format = value;
    } else if (option === "--max-diagnostics") {
      const parsedLimit = Number(value);
      if (!/^[1-9]\d*$/u.test(value) || !Number.isSafeInteger(parsedLimit)) {
        throw new UsageError("--max-diagnostics must be a positive integer.");
      }
      maximumDiagnostics = parsedLimit;
    } else if (option === "--verify-sources") {
      if (!allowVerification || value !== "none") {
        throw new UsageError(
          "The Phase 2 read path accepts only --verify-sources none on validate.",
        );
      }
    } else {
      throw new UsageError(`Unknown option ${String(option)}.`);
    }
  }
  return { format, maximumDiagnostics };
}

function parseCommand(args: readonly string[]): ParsedCommand {
  const resource = args[0];
  const action = args[1];
  if (resource === "document" && (action === "validate" || action === "show")) {
    const path = args[2];
    if (path === undefined)
      throw new UsageError("A .recog file path is required.");
    return {
      resource,
      action,
      path,
      ...parseOptions(args.slice(3), action === "validate"),
    };
  }
  if (resource === "recognition" && action === "show") {
    const id = args[2];
    const path = args[3];
    if (id === undefined || path === undefined) {
      throw new UsageError(
        "recognition show requires an ID and .recog file path.",
      );
    }
    if (!/^[A-Za-z][A-Za-z0-9_.-]*$/u.test(id)) {
      throw new UsageError(
        "The recognition ID is not a contract 0.1 identifier.",
      );
    }
    return {
      resource,
      action,
      id,
      path,
      ...parseOptions(args.slice(4), false),
    };
  }
  throw new UsageError("Expected document validate|show or recognition show.");
}

function execute(command: ParsedCommand): BootstrapReadResult {
  const bytes = fs.readFileSync(command.path);
  const input: BootstrapReadInput = {
    bytes,
    path: command.path,
    maximumDiagnostics: command.maximumDiagnostics,
  };
  if (command.resource === "document") {
    return command.action === "validate"
      ? validateBootstrapInput(input)
      : showBootstrapDocument(input);
  }
  return showBootstrapRecognition(input, command.id);
}

function exitStatus(result: BootstrapReadResult): number {
  if (result.schema === "Llmrecog.ValidationResult.v1") {
    return result.valid && result.complete ? 0 : 1;
  }
  if (result.schema === "Llmrecog.RecognitionResult.v1" && !result.found)
    return 1;
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
    const code =
      error !== null && typeof error === "object" && "code" in error
        ? String(error.code)
        : "UNKNOWN";
    process.stderr.write(`llmrecog input error: ${code}\n`);
    return 3;
  }
}

process.exitCode = main(process.argv.slice(2));
