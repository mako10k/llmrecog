import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  showBootstrapDocument,
  showBootstrapRecognition,
  validateBootstrapInput,
  type BootstrapReadInput,
  type BootstrapReadResult,
} from "../src/application/bootstrap-read-path.js";
import { BootstrapScopeError } from "../src/core/bootstrap-parser.js";
import type { Diagnostic } from "../src/core/types.js";
import { renderBootstrapText } from "../src/presentation/bootstrap-text.js";

const repositoryRoot = process.cwd();
const fixtureRoot = "test/fixtures/contracts/v0.1";
const explicitFactPath = `${fixtureRoot}/valid/explicit-fact.recog`;

const schemaPaths = [
  "schemas/Llmrecog.Common.v1.schema.json",
  "schemas/Llmrecog.Ast.v1.schema.json",
  "schemas/Llmrecog.SemanticDocument.v1.schema.json",
  "schemas/Llmrecog.ValidationResult.v1.schema.json",
  "schemas/Llmrecog.DocumentResult.v1.schema.json",
  "schemas/Llmrecog.RecognitionResult.v1.schema.json",
];

const resultSchemaIds: Readonly<Record<BootstrapReadResult["schema"], string>> =
  {
    "Llmrecog.ValidationResult.v1":
      "https://mako10k.github.io/llmrecog/schemas/Llmrecog.ValidationResult.v1.schema.json",
    "Llmrecog.DocumentResult.v1":
      "https://mako10k.github.io/llmrecog/schemas/Llmrecog.DocumentResult.v1.schema.json",
    "Llmrecog.RecognitionResult.v1":
      "https://mako10k.github.io/llmrecog/schemas/Llmrecog.RecognitionResult.v1.schema.json",
  };

interface ExpectedDiagnostic {
  readonly code: string;
  readonly entity_id: string | null;
  readonly span: Diagnostic["span"];
  readonly reason_data: Readonly<Record<string, unknown>>;
}

interface DiagnosticFixtureSet {
  readonly fixtures: readonly {
    readonly id: string;
    readonly path: string;
    readonly diagnostics: readonly ExpectedDiagnostic[];
  }[];
}

interface CommandResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function absolutePath(relativePath: string): string {
  return path.join(repositoryRoot, relativePath);
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(absolutePath(relativePath), "utf8")) as T;
}

function readInput(relativePath: string): BootstrapReadInput {
  return {
    bytes: fs.readFileSync(absolutePath(relativePath)),
    path: relativePath,
  };
}

function digest(relativePath: string): string {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(absolutePath(relativePath)))
    .digest("hex");
}

function buildSchemaValidator(): Ajv2020 {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const schemaPath of schemaPaths) {
    ajv.addSchema(readJson<Record<string, unknown>>(schemaPath));
  }
  return ajv;
}

const schemaValidator = buildSchemaValidator();

function assertResultSchema(result: BootstrapReadResult): void {
  const schemaId = resultSchemaIds[result.schema];
  const validate = schemaValidator.getSchema(schemaId);
  assert(validate, `missing compiled schema ${schemaId}`);
  assert.equal(
    validate(result),
    true,
    JSON.stringify(validate.errors, null, 2),
  );
}

function diagnosticContract(diagnostic: Diagnostic): ExpectedDiagnostic {
  return {
    code: diagnostic.code,
    entity_id: diagnostic.entity_id,
    span: diagnostic.span,
    reason_data: diagnostic.reason_data,
  };
}

function runPrivateCli(args: readonly string[]): CommandResult {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "src/adapters/internal-cli.ts", ...args],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
  if (result.error !== undefined) throw result.error;
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

test("the bootstrap read path matches the frozen AST and result schemas", () => {
  const input = readInput(explicitFactPath);
  const validation = validateBootstrapInput(input);
  assert.equal(validation.valid, true);
  assert.equal(validation.complete, true);
  assert.deepEqual(
    validation.ast,
    readJson(`${fixtureRoot}/expected/explicit-fact.ast.json`),
  );
  assertResultSchema(validation);

  const document = showBootstrapDocument(input);
  assert.equal(document.schema, "Llmrecog.DocumentResult.v1");
  assertResultSchema(document);
  if (document.schema !== "Llmrecog.DocumentResult.v1") return;
  assert.deepEqual(document.summary.counts, {
    sources: 1,
    spans: 1,
    observations: 0,
    entities: 1,
    records: 1,
    variables: 0,
    candidates: 0,
    constraints: 0,
  });
  assert.deepEqual(document.summary.recognition_ids, [
    "E_DEPLOYMENT",
    "R_STATUS",
  ]);

  const recognition = showBootstrapRecognition(input, "R_STATUS");
  assert.equal(recognition.schema, "Llmrecog.RecognitionResult.v1");
  assertResultSchema(recognition);
  if (recognition.schema !== "Llmrecog.RecognitionResult.v1") return;
  assert.equal(recognition.found, true);
  assert.deepEqual(recognition.recognition, {
    declaration_kind: "record",
    id: "R_STATUS",
    subject_id: "E_DEPLOYMENT",
    grounded_in: [{ id: "S1", kind: "span" }],
    support: {
      kind: "explicit",
      grounded_in: [{ id: "S1", kind: "span" }],
    },
    record_kind: "property",
    predicate: "status",
    value: { kind: "symbol", value: "failed" },
  });

  const missing = showBootstrapRecognition(input, "R_MISSING");
  assert.equal(missing.schema, "Llmrecog.RecognitionResult.v1");
  assertResultSchema(missing);
  assert.equal(
    missing.schema === "Llmrecog.RecognitionResult.v1" && missing.found,
    false,
  );
});

test("bootstrap validation reproduces the accepted subset goldens", () => {
  const cases = [
    {
      input: `${fixtureRoot}/valid/empty-document.recog`,
      expected: `${fixtureRoot}/expected/empty-document.validation.json`,
    },
    {
      input: `${fixtureRoot}/invalid/missing-header.recog`,
      expected: `${fixtureRoot}/expected/missing-header.validation.json`,
    },
  ];
  for (const fixture of cases) {
    const result = validateBootstrapInput({
      ...readInput(fixture.input),
      toolVersion: "contract-fixture",
    });
    assert.deepEqual(result, readJson(fixture.expected), fixture.input);
  }
});

test("bootstrap diagnostics match the frozen invalid fixture contracts", () => {
  const expected = readJson<DiagnosticFixtureSet>(
    `${fixtureRoot}/expected/invalid-diagnostics.json`,
  );
  const fixtureIds = [
    "missing_header",
    "unresolved_reference",
    "forbidden_conclusion",
    "prohibited_backflow",
  ];

  for (const fixtureId of fixtureIds) {
    const fixture = expected.fixtures.find(
      (candidate) => candidate.id === fixtureId,
    );
    assert(fixture, `missing diagnostic fixture ${fixtureId}`);
    const result = validateBootstrapInput(readInput(fixture.path));
    assert.equal(result.valid, false, fixtureId);
    assertResultSchema(result);
    assert.deepEqual(
      result.diagnostics.map(diagnosticContract),
      fixture.diagnostics,
      fixtureId,
    );
  }
});

test("byte decoding, CRLF, final newline, and diagnostic limits are explicit", () => {
  const source = fs.readFileSync(absolutePath(explicitFactPath), "utf8");
  const crlf = Buffer.from(source.replaceAll("\n", "\r\n"), "utf8");
  const crlfResult = validateBootstrapInput({
    bytes: crlf,
    path: "memory:explicit-fact-crlf.recog",
  });
  assert.equal(crlfResult.valid, true);
  assert.equal(
    crlfResult.ast?.declarations.at(-1)?.span.end.offset,
    crlf.length,
  );

  const unicodeSource = source.replace("Explicit status", "caf\u00e9 status");
  const unicodeBytes = Buffer.from(unicodeSource, "utf8");
  const unicodeResult = validateBootstrapInput({
    bytes: unicodeBytes,
    path: "memory:explicit-fact-unicode.recog",
  });
  assert.equal(unicodeResult.valid, true);
  assert.equal(
    unicodeResult.ast?.declarations.at(-1)?.span.end.offset,
    unicodeBytes.length,
  );

  const noFinalNewline = Buffer.from(source.slice(0, -1), "utf8");
  const newlineResult = validateBootstrapInput({
    bytes: noFinalNewline,
    path: "memory:no-final-newline.recog",
  });
  assert.equal(newlineResult.valid, true);
  assert.deepEqual(
    newlineResult.diagnostics.map((entry) => [entry.code, entry.severity]),
    [["RCG-SYNTAX-014", "warning"]],
  );

  const invalidUtf8 = validateBootstrapInput({
    bytes: Uint8Array.from([0xff]),
    path: "memory:invalid-utf8.recog",
  });
  assert.equal(invalidUtf8.valid, false);
  assert.equal(invalidUtf8.ast, null);
  assert.deepEqual(
    invalidUtf8.diagnostics.map((entry) => entry.code),
    ["RCG-SYNTAX-001"],
  );

  const limitedInput = {
    ...readInput(`${fixtureRoot}/invalid/prohibited-backflow.recog`),
    maximumDiagnostics: 1,
  };
  const first = validateBootstrapInput(limitedInput);
  const second = validateBootstrapInput(limitedInput);
  assert.deepEqual(first, second);
  assert.equal(first.complete, false);
  assert.equal(first.truncated, true);
  assert.equal(first.diagnostics.length, 1);
});

test("bootstrap syntax recovery skips malformed indentation and its subtree", () => {
  const malformed = Buffer.from(
    [
      "llmrecog 0.1",
      "",
      "document RECOVERY:",
      '  title "Recovery"',
      "",
      "source BAD:",
      "    kind text",
      '      locator "ignored.txt"',
      '  locator "recovered.txt"',
      "",
    ].join("\n"),
    "utf8",
  );
  const result = validateBootstrapInput({
    bytes: malformed,
    path: "memory:indentation-recovery.recog",
  });
  assert.equal(result.valid, false);
  assert.equal(result.ast?.recovered, true);
  assert.deepEqual(
    result.diagnostics.map((entry) => entry.code),
    ["RCG-SYNTAX-012", "RCG-SYNTAX-005"],
  );
});

test("later declarations fail as an explicit private bootstrap scope boundary", () => {
  assert.throws(
    () => validateBootstrapInput(readInput("docs/examples/minimal.recog")),
    BootstrapScopeError,
  );
});

test("text is a deterministic projection of the same typed results", () => {
  const input = readInput(explicitFactPath);
  const document = showBootstrapDocument(input);
  const recognition = showBootstrapRecognition(input, "R_STATUS");
  const documentText = renderBootstrapText(document);
  const recognitionText = renderBootstrapText(recognition);
  assert(documentText.endsWith("\n"));
  assert(documentText.includes(document.input.digest));
  assert(documentText.includes("recognitions: E_DEPLOYMENT, R_STATUS"));
  assert(recognitionText.includes(recognition.input.digest));
  assert(recognitionText.includes("target: R_STATUS"));
  assert(recognitionText.includes("value: symbol failed"));
});

test("the private CLI is read-only and byte-deterministic for dogfood routes", () => {
  const beforeDigest = digest(explicitFactPath);
  const cases = [
    ["document", "validate", explicitFactPath, "--format", "json"],
    ["document", "show", explicitFactPath, "--format", "json"],
    ["document", "show", explicitFactPath, "--format", "text"],
    ["recognition", "show", "R_STATUS", explicitFactPath, "--format", "json"],
    ["recognition", "show", "R_STATUS", explicitFactPath, "--format", "text"],
  ] as const;

  for (const args of cases) {
    const first = runPrivateCli(args);
    const second = runPrivateCli(args);
    assert.equal(first.status, 0, first.stderr);
    assert.deepEqual(first, second);
    assert.equal(first.stderr, "");
    if (args.at(-1) === "json") {
      assertResultSchema(JSON.parse(first.stdout) as BootstrapReadResult);
    } else {
      assert(first.stdout.endsWith("\n"));
      assert(first.stdout.includes("Llmrecog."));
    }
  }
  assert.equal(digest(explicitFactPath), beforeDigest);

  const missing = runPrivateCli([
    "recognition",
    "show",
    "R_MISSING",
    explicitFactPath,
    "--format",
    "json",
  ]);
  assert.equal(missing.status, 1);
  assertResultSchema(JSON.parse(missing.stdout) as BootstrapReadResult);

  const laterScope = runPrivateCli([
    "document",
    "validate",
    "docs/examples/minimal.recog",
    "--format",
    "json",
  ]);
  assert.equal(laterScope.status, 3);
  assert.equal(laterScope.stdout, "");
  assert.match(laterScope.stderr, /bootstrap scope error/u);
});

test("the private CLI reports encoding failures on stderr with status 3", () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "llmrecog-bootstrap-test-"),
  );
  const inputPath = path.join(temporaryDirectory, "invalid-utf8.recog");
  try {
    fs.writeFileSync(inputPath, Uint8Array.from([0xff]));
    const result = runPrivateCli([
      "document",
      "validate",
      inputPath,
      "--format",
      "json",
    ]);
    assert.equal(result.status, 3);
    assert.equal(result.stdout, "");
    assert.equal(
      result.stderr,
      "llmrecog bootstrap input error: RCG-SYNTAX-001\n",
    );
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
