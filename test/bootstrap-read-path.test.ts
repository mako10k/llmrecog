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
  ExplainInputError,
  MaterializationInputError,
  QueryInputError,
  auditBootstrapDocument,
  explainBootstrapRecognition,
  materializeBootstrapSpace,
  queryBootstrapRecognitions,
  showBootstrapDocument,
  showBootstrapRecognition,
  validateBootstrapInput,
  type BootstrapReadInput,
  type BootstrapReadResult,
  type ExplainOptions,
  type MaterializationOptions,
  type QueryOptions,
} from "../src/application/bootstrap-read-path.js";
import type { Diagnostic } from "../src/core/types.js";
import { renderBootstrapText } from "../src/presentation/bootstrap-text.js";

const repositoryRoot = process.cwd();
const fixtureRoot = "test/fixtures/contracts/v0.1";
const explicitFactPath = `${fixtureRoot}/valid/explicit-fact.recog`;
const minimalPath = "docs/examples/minimal.recog";
const openUnknownPath = `${fixtureRoot}/valid/open-unknown.recog`;
const unsupportedAllowedPath = `${fixtureRoot}/valid/unsupported-allowed.recog`;
const oneOfJointPath = `${fixtureRoot}/valid/one-of-joint.recog`;
const oneOfConflictPath = `${fixtureRoot}/valid/one-of-conflict.recog`;
const propagatedExclusionPath = `${fixtureRoot}/valid/propagated-exclusion.recog`;
const closedConflictPath = `${fixtureRoot}/valid/closed-conflict.recog`;
const limitUnknownPath = `${fixtureRoot}/valid/limit-unknown.recog`;
const allDeclarationsPath = `${fixtureRoot}/valid/all-declarations.recog`;
const relationalConflictPath = `${fixtureRoot}/valid/relational-conflict.recog`;
const relationalCorePath = `${fixtureRoot}/valid/relational-core.recog`;
const relationalOpenPath = `${fixtureRoot}/valid/relational-open.recog`;
const relationalIdentitiesPath = `${fixtureRoot}/valid/relational-identities.recog`;

const schemaPaths = [
  "schemas/Llmrecog.Common.v1.schema.json",
  "schemas/Llmrecog.Ast.v1.schema.json",
  "schemas/Llmrecog.SemanticDocument.v1.schema.json",
  "schemas/Llmrecog.ValidationResult.v1.schema.json",
  "schemas/Llmrecog.DocumentResult.v1.schema.json",
  "schemas/Llmrecog.RecognitionResult.v1.schema.json",
  "schemas/Llmrecog.ExplainResult.v1.schema.json",
  "schemas/Llmrecog.ExplainResult.v2.schema.json",
  "schemas/Llmrecog.AuditResult.v1.schema.json",
  "schemas/Llmrecog.QueryResult.v1.schema.json",
  "schemas/Llmrecog.MaterializationResult.v1.schema.json",
];

const resultSchemaIds: Readonly<Record<BootstrapReadResult["schema"], string>> =
  {
    "Llmrecog.ValidationResult.v1":
      "https://mako10k.github.io/llmrecog/schemas/Llmrecog.ValidationResult.v1.schema.json",
    "Llmrecog.DocumentResult.v1":
      "https://mako10k.github.io/llmrecog/schemas/Llmrecog.DocumentResult.v1.schema.json",
    "Llmrecog.RecognitionResult.v1":
      "https://mako10k.github.io/llmrecog/schemas/Llmrecog.RecognitionResult.v1.schema.json",
    "Llmrecog.ExplainResult.v2":
      "https://mako10k.github.io/llmrecog/schemas/Llmrecog.ExplainResult.v2.schema.json",
    "Llmrecog.QueryResult.v1":
      "https://mako10k.github.io/llmrecog/schemas/Llmrecog.QueryResult.v1.schema.json",
    "Llmrecog.MaterializationResult.v1":
      "https://mako10k.github.io/llmrecog/schemas/Llmrecog.MaterializationResult.v1.schema.json",
    "Llmrecog.AuditResult.v1":
      "https://mako10k.github.io/llmrecog/schemas/Llmrecog.AuditResult.v1.schema.json",
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

interface ContractFixtureManifest {
  readonly fixtures: readonly {
    readonly id: string;
    readonly path: string;
    readonly expectation: "valid" | "invalid";
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

function contractInput(relativePath: string): BootstrapReadInput {
  return { ...readInput(relativePath), toolVersion: "contract-fixture" };
}

interface ExplainGoldenCase {
  readonly input: string;
  readonly id: string;
  readonly expected: string;
  readonly text?: string;
  readonly options?: ExplainOptions;
}

interface QueryGoldenCase {
  readonly input: string;
  readonly expected: string;
  readonly text?: string;
  readonly options?: QueryOptions;
}

interface MaterializationGoldenCase {
  readonly input: string;
  readonly expected: string;
  readonly text?: string;
  readonly options: MaterializationOptions;
}

function assertResultGolden(
  result: BootstrapReadResult,
  expectedSchema: BootstrapReadResult["schema"],
  fixture: Pick<ExplainGoldenCase, "expected" | "text">,
): void {
  assert.equal(result.schema, expectedSchema);
  assertResultSchema(result);
  assert.deepEqual(result, readJson(fixture.expected));
  if (fixture.text !== undefined) {
    assert.equal(
      renderBootstrapText(result),
      fs.readFileSync(absolutePath(fixture.text), "utf8"),
    );
  }
}

function assertExplainGolden(fixture: ExplainGoldenCase): void {
  const result = explainBootstrapRecognition(
    contractInput(fixture.input),
    fixture.id,
    fixture.options,
  );
  assertResultGolden(result, "Llmrecog.ExplainResult.v2", fixture);
}

function assertQueryGolden(fixture: QueryGoldenCase): void {
  const result = queryBootstrapRecognitions(
    contractInput(fixture.input),
    fixture.options,
  );
  assertResultGolden(result, "Llmrecog.QueryResult.v1", fixture);
}

function assertMaterializationGolden(fixture: MaterializationGoldenCase): void {
  const result = materializeBootstrapSpace(
    contractInput(fixture.input),
    fixture.options,
  );
  assertResultGolden(result, "Llmrecog.MaterializationResult.v1", fixture);
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

test("the Phase 2 read path matches the frozen AST and result schemas", () => {
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

test("validation reproduces the accepted validation goldens", () => {
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

test("validation matches every frozen invalid diagnostic contract", () => {
  const expected = readJson<DiagnosticFixtureSet>(
    `${fixtureRoot}/expected/invalid-diagnostics.json`,
  );
  for (const fixture of expected.fixtures) {
    const result = validateBootstrapInput(readInput(fixture.path));
    assert.equal(result.valid, false, fixture.id);
    assertResultSchema(result);
    assert.deepEqual(
      result.diagnostics.map(diagnosticContract),
      fixture.diagnostics,
      fixture.id,
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

test("syntax recovery skips malformed indentation and its subtree", () => {
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

test("the complete Phase 2 model accepts every frozen valid fixture", () => {
  const manifest = readJson<ContractFixtureManifest>(
    `${fixtureRoot}/manifest.json`,
  );
  for (const fixture of manifest.fixtures.filter(
    (candidate) => candidate.expectation === "valid",
  )) {
    const result = validateBootstrapInput(readInput(fixture.path));
    assert.equal(result.valid, true, fixture.id);
    assert.equal(result.structural_valid, true, fixture.id);
    assert.equal(result.semantic_valid, true, fixture.id);
    assertResultSchema(result);
  }
});

test("all declaration families cross the real AST and semantic seam", () => {
  const result = validateBootstrapInput(
    readInput(`${fixtureRoot}/valid/all-declarations.recog`),
  );
  assert.equal(result.valid, true);
  assertResultSchema(result);
  const normalization = result.ast?.declarations
    .find((declaration) => declaration.id === "R_PROPERTY")
    ?.fields.find((field) => field.name === "normalization");
  assert.equal(normalization?.value.kind, "block");
  if (normalization?.value.kind === "block") {
    assert.deepEqual(
      normalization.value.fields.map((field) => field.name),
      ["surface", "rule", "grounded_in", "anchors"],
    );
  }
  assert.deepEqual(
    result.document?.observations.map((observation) => observation.id),
    ["O_ALPHA"],
  );
  assert.deepEqual(
    result.document?.recognitions
      .filter((recognition) => recognition.declaration_kind === "constraint")
      .map((constraint) => constraint.constraint_kind),
    ["one_of", "requires", "excludes", "same_as", "distinct_from"],
  );
  const normalized = result.document?.recognitions.find(
    (recognition) => recognition.id === "R_NORMALIZED",
  );
  assert(
    normalized?.declaration_kind === "record" &&
      normalized.record_kind === "normalized_value",
  );
  assert.equal(normalized.normalization.rule, "symbol.lower-snake.v1");
});

test("candidate and constraint validation remains declarative", () => {
  const source = fs.readFileSync(
    absolutePath(`${fixtureRoot}/valid/all-declarations.recog`),
    "utf8",
  );
  const cases = [
    {
      id: "candidate_value_type",
      text: source.replace(
        "candidate C_MODE_DESIRE in V_MODE:\n  value desire",
        "candidate C_MODE_DESIRE in V_MODE:\n  value E_ALPHA",
      ),
      expectedCode: "RCG-VALUE-002",
    },
    {
      id: "candidate_parent",
      text: source.replace(
        "candidate C_MODE_DESIRE in V_MODE:",
        "candidate C_MODE_DESIRE in V_ACTOR:",
      ),
      expectedCode: "RCG-CANDIDATE-001",
    },
    {
      id: "one_of_membership",
      text: source.replace(
        "members [C_ACTOR_ALPHA, C_ACTOR_BETA]",
        "members [C_ACTOR_ALPHA, C_MODE_DESIRE]",
      ),
      expectedCode: "RCG-CONSTRAINT-004",
    },
    {
      id: "constraint_operand_kind",
      text: source.replace(
        "left C_ACTOR_BETA\n  right C_MODE_WEAK",
        "left V_ACTOR\n  right C_MODE_WEAK",
      ),
      expectedCode: "RCG-CONSTRAINT-005",
    },
  ];
  for (const candidate of cases) {
    const result = validateBootstrapInput({
      bytes: Buffer.from(candidate.text, "utf8"),
      path: `memory:${candidate.id}.recog`,
    });
    assert.equal(result.valid, false, candidate.id);
    assert(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === candidate.expectedCode,
      ),
      candidate.id,
    );
  }
});

test("complete document and recognition projections match frozen goldens", () => {
  const input = { ...readInput(minimalPath), toolVersion: "contract-fixture" };
  const document = showBootstrapDocument(input);
  const deadline = showBootstrapRecognition(input, "R_DEADLINE");
  const missing = showBootstrapRecognition(input, "R_MISSING");
  assert.deepEqual(
    document,
    readJson(`${fixtureRoot}/expected/minimal.document-show.json`),
  );
  assert.deepEqual(
    deadline,
    readJson(`${fixtureRoot}/expected/minimal-deadline.recognition-show.json`),
  );
  assert.deepEqual(
    missing,
    readJson(`${fixtureRoot}/expected/minimal-missing.recognition-show.json`),
  );
  assert.equal(
    renderBootstrapText(document),
    fs.readFileSync(
      absolutePath(`${fixtureRoot}/expected/minimal.document-show.txt`),
      "utf8",
    ),
  );
  assert.equal(
    renderBootstrapText(deadline),
    fs.readFileSync(
      absolutePath(
        `${fixtureRoot}/expected/minimal-deadline.recognition-show.txt`,
      ),
      "utf8",
    ),
  );
  assert.equal(
    renderBootstrapText(missing),
    fs.readFileSync(
      absolutePath(
        `${fixtureRoot}/expected/minimal-missing.recognition-show.txt`,
      ),
      "utf8",
    ),
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

test("finite one_of explanation matches support, witness, and unknown contracts", () => {
  const unsupported = explainBootstrapRecognition(
    contractInput(unsupportedAllowedPath),
    "C_SECONDARY",
  );
  const unknown = explainBootstrapRecognition(
    contractInput(openUnknownPath),
    "V_ACTOR",
  );
  const joint = explainBootstrapRecognition(
    contractInput(oneOfJointPath),
    "C_WEAK",
    { requestedVariableIds: ["V_MODE", "V_ACTOR"] },
  );
  const conflict = explainBootstrapRecognition(
    contractInput(oneOfConflictPath),
    "C_A",
  );
  assert.equal(unsupported.schema, "Llmrecog.ExplainResult.v2");
  assert.equal(unknown.schema, "Llmrecog.ExplainResult.v2");
  assert.equal(joint.schema, "Llmrecog.ExplainResult.v2");
  assert.equal(conflict.schema, "Llmrecog.ExplainResult.v2");
  assertResultSchema(unsupported);
  assertResultSchema(unknown);
  assertResultSchema(joint);
  assertResultSchema(conflict);
  assert.deepEqual(
    unsupported,
    readJson(`${fixtureRoot}/expected/unsupported-allowed.explain.json`),
  );
  assert.deepEqual(
    unknown,
    readJson(`${fixtureRoot}/expected/candidate-unknown.explain.json`),
  );
  assert.deepEqual(
    joint,
    readJson(`${fixtureRoot}/expected/one-of-joint.explain.json`),
  );
  assert.deepEqual(
    conflict,
    readJson(`${fixtureRoot}/expected/one-of-conflict.explain.json`),
  );
  assert.equal(
    renderBootstrapText(unsupported),
    fs.readFileSync(
      absolutePath(`${fixtureRoot}/expected/unsupported-allowed.explain.txt`),
      "utf8",
    ),
  );
});

test("ExplainResult v2 projects typed authored targets without relying on witnesses", () => {
  const cases = [
    {
      input: explicitFactPath,
      id: "E_DEPLOYMENT",
      expected: `${fixtureRoot}/expected/explicit-entity.explain.json`,
      text: `${fixtureRoot}/expected/explicit-entity.explain.txt`,
    },
    {
      input: explicitFactPath,
      id: "R_STATUS",
      expected: `${fixtureRoot}/expected/explicit-record.explain.json`,
      text: `${fixtureRoot}/expected/explicit-record.explain.txt`,
    },
    {
      input: openUnknownPath,
      id: "V_ACTOR",
      expected: `${fixtureRoot}/expected/candidate-unknown.explain.json`,
      text: `${fixtureRoot}/expected/candidate-unknown.explain.txt`,
    },
  ];
  for (const fixture of cases) assertExplainGolden(fixture);

  const finite = explainBootstrapRecognition(
    contractInput(minimalPath),
    "C_WEAK_COMMITMENT",
  );
  assert.equal(finite.schema, "Llmrecog.ExplainResult.v2");
  if (finite.schema !== "Llmrecog.ExplainResult.v2") return;
  assert.notEqual(finite.viability?.witness, null);
  assert.equal(finite.recognition.declaration_kind, "candidate");
  if (finite.recognition.declaration_kind !== "candidate") return;
  assert.equal(finite.recognition.variable_id, "V_COMMITMENT");
  assert.deepEqual(finite.recognition.value, {
    kind: "symbol",
    value: "weak_commitment",
  });
  assert(
    renderBootstrapText(finite).includes(
      "  variable: V_COMMITMENT\n  value: symbol weak_commitment\n",
    ),
  );

  const constraint = explainBootstrapRecognition(
    contractInput(unsupportedAllowedPath),
    "K_MODE",
  );
  assert.equal(constraint.schema, "Llmrecog.ExplainResult.v2");
  if (constraint.schema !== "Llmrecog.ExplainResult.v2") return;
  assert.equal(constraint.recognition.declaration_kind, "constraint");
  if (constraint.recognition.declaration_kind !== "constraint") return;
  assert.equal(constraint.recognition.constraint_kind, "one_of");
  assert.deepEqual(constraint.recognition.member_ids, [
    "C_PRIMARY",
    "C_SECONDARY",
  ]);
});

test("all five constraint kinds share finite relational evaluation", () => {
  const result = explainBootstrapRecognition(
    readInput(allDeclarationsPath),
    "C_MODE_DESIRE",
  );
  assert.equal(result.schema, "Llmrecog.ExplainResult.v2");
  if (result.schema !== "Llmrecog.ExplainResult.v2") return;
  assert.equal(result.complete, true);
  assert.equal(result.truncated, false);
  assert.equal(result.viability?.state, "allowed");
  assert.deepEqual(
    result.viability?.witness?.assignments.map(
      (assignment) => assignment.candidate_id,
    ),
    ["C_ACTOR_ALPHA", "C_ALIAS_ALPHA", "C_DISTINCT_BETA", "C_MODE_DESIRE"],
  );
  assert.deepEqual(result.skipped_constraints, []);

  assert.throws(
    () =>
      explainBootstrapRecognition(readInput(minimalPath), "C_DESIRE", {
        requestedVariableIds: ["V_ACTOR"],
      }),
    ExplainInputError,
  );
});

test("finite excludes explanation matches allowed, excluded, conflict, and limit contracts", () => {
  const cases = [
    {
      input: propagatedExclusionPath,
      id: "C_DESIRE",
      expected: `${fixtureRoot}/expected/candidate-allowed.explain.json`,
    },
    {
      input: propagatedExclusionPath,
      id: "C_WEAK",
      expected: `${fixtureRoot}/expected/candidate-excluded.explain.json`,
    },
    {
      input: minimalPath,
      id: "C_WEAK_COMMITMENT",
      expected: `${fixtureRoot}/expected/minimal-weak.explain.json`,
      text: `${fixtureRoot}/expected/minimal-weak.explain.txt`,
    },
    {
      input: minimalPath,
      id: "K_TANAKA_NOT_WEAK",
      expected: `${fixtureRoot}/expected/minimal-excludes.constraint-explain.json`,
      text: `${fixtureRoot}/expected/minimal-excludes.constraint-explain.txt`,
    },
    {
      input: limitUnknownPath,
      id: "C_B1",
      options: { limit: 1 },
      expected: `${fixtureRoot}/expected/limit-unknown.explain.json`,
      text: `${fixtureRoot}/expected/limit-unknown.explain.txt`,
    },
  ] as const;

  for (const fixture of cases) assertExplainGolden(fixture);
});

test("relational explanation matches requires, equality, inequality, and open contracts", () => {
  const cases = [
    {
      input: relationalConflictPath,
      id: "C_REQ_ON",
      expected: `${fixtureRoot}/expected/requires-excluded.explain.json`,
      text: `${fixtureRoot}/expected/requires-excluded.explain.txt`,
    },
    {
      input: relationalConflictPath,
      id: "C_SAME_LEFT_RED",
      expected: `${fixtureRoot}/expected/same-as-excluded.explain.json`,
    },
    {
      input: relationalConflictPath,
      id: "C_DISTINCT_LEFT_RED",
      expected: `${fixtureRoot}/expected/distinct-from-excluded.explain.json`,
    },
    {
      input: relationalOpenPath,
      id: "C_OPEN_LEFT_RED",
      expected: `${fixtureRoot}/expected/same-as-open.explain.json`,
    },
  ] as const;

  for (const fixture of cases) assertExplainGolden(fixture);
});

test("bounded query matches filters, ordering, grounding, and limit contracts", () => {
  assertQueryGolden({
    input: relationalOpenPath,
    expected: `${fixtureRoot}/expected/relational-open.query.json`,
    text: `${fixtureRoot}/expected/relational-open.query.txt`,
    options: {
      kind: "candidate",
      variableId: "V_OPEN_LEFT",
      viability: "unknown",
    },
  });
  assertQueryGolden({
    input: relationalOpenPath,
    expected: `${fixtureRoot}/expected/relational-open-truncated.query.json`,
    options: { limit: 1 },
  });

  const grounded = queryBootstrapRecognitions(readInput(relationalOpenPath), {
    kind: "candidate",
    support: "supported",
    groundedInSpanId: "S1",
  });
  assert.equal(grounded.schema, "Llmrecog.QueryResult.v1");
  if (grounded.schema !== "Llmrecog.QueryResult.v1") return;
  assert(grounded.items.length > 0);
  assert(
    grounded.items.every(
      (item) =>
        item.recognition.declaration_kind === "candidate" &&
        item.support?.state === "supported" &&
        item.viability === null &&
        item.scope === null &&
        item.matching_span_ids.includes("S1"),
    ),
  );

  const transitivelyGrounded = queryBootstrapRecognitions(
    readInput(allDeclarationsPath),
    { kind: "entity", groundedInSpanId: "S1" },
  );
  assert.equal(transitivelyGrounded.schema, "Llmrecog.QueryResult.v1");
  if (transitivelyGrounded.schema !== "Llmrecog.QueryResult.v1") return;
  assert(
    transitivelyGrounded.items.some(
      (item) =>
        item.recognition.id === "E_ALPHA" &&
        item.matching_span_ids.includes("S1"),
    ),
  );

  assert.throws(
    () =>
      queryBootstrapRecognitions(readInput(relationalOpenPath), {
        viability: "unknown",
      }),
    QueryInputError,
  );
  assert.throws(
    () =>
      queryBootstrapRecognitions(readInput(relationalOpenPath), {
        variableId: "V_MISSING",
      }),
    QueryInputError,
  );
  assert.throws(
    () =>
      queryBootstrapRecognitions(readInput(relationalOpenPath), {
        kind: "variable",
        variableId: "V_OPEN_LEFT",
      }),
    QueryInputError,
  );
  assert.throws(
    () =>
      queryBootstrapRecognitions(readInput(relationalOpenPath), {
        kind: "variable",
        support: "supported",
      }),
    QueryInputError,
  );
});

test("bounded materialization matches worlds, open branches, and exact limits", () => {
  assertMaterializationGolden({
    input: `${fixtureRoot}/valid/relational-core.recog`,
    expected: `${fixtureRoot}/expected/relational-core.materialization.json`,
    text: `${fixtureRoot}/expected/relational-core.materialization.txt`,
    options: { requestedVariableIds: ["V_TRIGGER"], limit: 4 },
  });
  assertMaterializationGolden({
    input: `${fixtureRoot}/valid/relational-core.recog`,
    expected: `${fixtureRoot}/expected/relational-core-require-complete.materialization.json`,
    text: `${fixtureRoot}/expected/relational-core-require-complete.materialization.txt`,
    options: {
      requestedVariableIds: ["V_TRIGGER"],
      limit: 2,
      requireComplete: true,
    },
  });
  assertMaterializationGolden({
    input: relationalOpenPath,
    expected: `${fixtureRoot}/expected/relational-open.materialization.json`,
    text: `${fixtureRoot}/expected/relational-open.materialization.txt`,
    options: { requestedVariableIds: ["V_OPEN_LEFT"], limit: 2 },
  });

  const exactOpenLimit = materializeBootstrapSpace(readInput(openUnknownPath), {
    requestedVariableIds: ["V_ACTOR"],
    limit: 1,
  });
  assert.equal(exactOpenLimit.schema, "Llmrecog.MaterializationResult.v1");
  if (exactOpenLimit.schema !== "Llmrecog.MaterializationResult.v1") return;
  assert.equal(exactOpenLimit.complete, true);
  assert.equal(exactOpenLimit.truncated, false);
  assert.equal(exactOpenLimit.inspected_assignment_count, 1);
  assert.deepEqual(exactOpenLimit.worlds, [
    {
      index: 1,
      assignments: [],
      open_variable_ids: ["V_ACTOR"],
    },
  ]);

  assert.throws(
    () =>
      materializeBootstrapSpace(readInput(relationalOpenPath), { limit: 1 }),
    MaterializationInputError,
  );
  assert.throws(
    () =>
      materializeBootstrapSpace(readInput(relationalOpenPath), {
        requestedVariableIds: ["V_OPEN_LEFT"],
      }),
    MaterializationInputError,
  );
  assert.throws(
    () =>
      materializeBootstrapSpace(readInput(relationalOpenPath), {
        requestedVariableIds: ["V_OPEN_LEFT", "V_OPEN_LEFT"],
        limit: 2,
      }),
    MaterializationInputError,
  );
  assert.throws(
    () =>
      materializeBootstrapSpace(readInput(relationalOpenPath), {
        requestedVariableIds: ["V_MISSING"],
        limit: 2,
      }),
    MaterializationInputError,
  );
});

test("relational identity edge cases use exact typed values and self semantics", () => {
  const input = readInput(relationalIdentitiesPath);
  const explain = (id: string) => {
    const result = explainBootstrapRecognition(input, id);
    assert.equal(result.schema, "Llmrecog.ExplainResult.v2");
    if (result.schema !== "Llmrecog.ExplainResult.v2") {
      throw new Error(`unexpected result for ${id}`);
    }
    assertResultSchema(result);
    return result;
  };

  assert.equal(explain("C_REQ_SELF_ON").viability?.state, "allowed");
  assert.equal(explain("C_SAME_SELF_RED").viability?.state, "allowed");

  const equalValues = explain("C_EQUAL_LEFT_RED");
  assert.equal(equalValues.viability?.state, "allowed");
  assert.deepEqual(
    equalValues.viability?.witness?.assignments.map(
      (assignment) => assignment.candidate_id,
    ),
    ["C_EQUAL_LEFT_RED", "C_EQUAL_RIGHT_RED"],
  );

  const distinctSelf = explain("C_DISTINCT_SELF_RED");
  assert.equal(distinctSelf.viability?.state, "excluded");
  assert.deepEqual(
    distinctSelf.viability?.reason_chain.map((reason) => reason.code),
    ["RCG-RSN-205", "RCG-RSN-206"],
  );
  assert.equal(distinctSelf.variable_resolution?.state, "inconsistent");

  const constraint = explain("K_DISTINCT_SELF");
  assert.deepEqual(
    constraint.derivations.map((reason) => reason.code),
    ["RCG-RSN-205"],
  );

  const exactString = explain("C_STRING_COMPOSED");
  assert.equal(exactString.viability?.state, "excluded");
  assert(
    exactString.viability?.reason_chain.some(
      (reason) => reason.code === "RCG-RSN-204",
    ),
  );
});

test("focused audit matches frozen diagnostics, thresholds, and truncation", () => {
  const propagated = auditBootstrapDocument(
    contractInput(propagatedExclusionPath),
  );
  const conflict = auditBootstrapDocument(contractInput(closedConflictPath));
  assert.equal(propagated.schema, "Llmrecog.AuditResult.v1");
  assert.equal(conflict.schema, "Llmrecog.AuditResult.v1");
  assertResultSchema(propagated);
  assertResultSchema(conflict);
  assert.deepEqual(
    propagated,
    readJson(`${fixtureRoot}/expected/propagated-exclusion.audit.json`),
  );
  assert.deepEqual(
    conflict,
    readJson(`${fixtureRoot}/expected/closed-conflict.audit.json`),
  );
  assert.equal(
    renderBootstrapText(propagated),
    fs.readFileSync(
      absolutePath(`${fixtureRoot}/expected/propagated-exclusion.audit.txt`),
      "utf8",
    ),
  );
  assert.equal(
    renderBootstrapText(conflict),
    fs.readFileSync(
      absolutePath(`${fixtureRoot}/expected/closed-conflict.audit.txt`),
      "utf8",
    ),
  );

  const warningsFail = auditBootstrapDocument(
    contractInput(propagatedExclusionPath),
    { failOn: "warning" },
  );
  assert.equal(warningsFail.schema, "Llmrecog.AuditResult.v1");
  if (warningsFail.schema === "Llmrecog.AuditResult.v1") {
    assert.equal(warningsFail.passed, false);
  }

  const truncated = auditBootstrapDocument({
    ...contractInput(propagatedExclusionPath),
    maximumDiagnostics: 1,
  });
  assert.equal(truncated.schema, "Llmrecog.AuditResult.v1");
  if (truncated.schema === "Llmrecog.AuditResult.v1") {
    assert.equal(truncated.complete, false);
    assert.equal(truncated.truncated, true);
    assert.equal(truncated.passed, false);
    assert.equal(truncated.diagnostics.length, 1);
  }

  const unsupported = auditBootstrapDocument(
    contractInput(unsupportedAllowedPath),
  );
  assert(
    unsupported.diagnostics.some(
      (diagnostic) => diagnostic.code === "RCG-SUPPORT-001",
    ),
  );

  const relational = auditBootstrapDocument(
    contractInput(relationalConflictPath),
  );
  assert.equal(relational.schema, "Llmrecog.AuditResult.v1");
  if (relational.schema === "Llmrecog.AuditResult.v1") {
    assert.equal(relational.passed, false);
    assert(
      relational.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "RCG-CSP-001" &&
          Array.isArray(diagnostic.reason_data["constraint_ids"]) &&
          diagnostic.reason_data["constraint_ids"].includes(
            "K_REQ_ON_REQUIRES_FAST",
          ),
      ),
    );
    assert(
      relational.diagnostics.some(
        (diagnostic) => diagnostic.code === "RCG-CSP-002",
      ),
    );
  }
});

test("the private CLI is read-only and byte-deterministic for dogfood routes", () => {
  const beforeDigest = digest(minimalPath);
  const beforeAuditDigest = digest(propagatedExclusionPath);
  const beforeRelationalDigest = digest(relationalConflictPath);
  const beforeQueryDigest = digest(relationalOpenPath);
  const beforeMaterializationDigest = digest(relationalCorePath);
  const cases = [
    ["document", "validate", minimalPath, "--format", "json"],
    ["document", "show", minimalPath, "--format", "json"],
    ["document", "show", minimalPath, "--format", "text"],
    ["document", "audit", propagatedExclusionPath, "--format", "json"],
    ["document", "audit", propagatedExclusionPath, "--format", "text"],
    ["recognition", "show", "R_DEADLINE", minimalPath, "--format", "json"],
    ["recognition", "show", "R_DEADLINE", minimalPath, "--format", "text"],
    [
      "recognition",
      "explain",
      "C_SECONDARY",
      unsupportedAllowedPath,
      "--format",
      "json",
    ],
    [
      "recognition",
      "explain",
      "C_SECONDARY",
      unsupportedAllowedPath,
      "--limit",
      "1",
      "--format",
      "json",
    ],
    [
      "recognition",
      "explain",
      "C_SECONDARY",
      unsupportedAllowedPath,
      "--format",
      "text",
    ],
    [
      "recognition",
      "explain",
      "C_REQ_ON",
      relationalConflictPath,
      "--scope",
      "V_REQ_TRIGGER",
      "--format",
      "json",
    ],
    [
      "recognition",
      "explain",
      "C_REQ_ON",
      relationalConflictPath,
      "--scope",
      "V_REQ_TRIGGER",
      "--format",
      "text",
    ],
    [
      "space",
      "query",
      relationalOpenPath,
      "--kind",
      "candidate",
      "--variable",
      "V_OPEN_LEFT",
      "--viability",
      "unknown",
      "--format",
      "json",
    ],
    [
      "space",
      "query",
      relationalOpenPath,
      "--kind",
      "candidate",
      "--variable",
      "V_OPEN_LEFT",
      "--viability",
      "unknown",
      "--format",
      "text",
    ],
    ["space", "query", relationalOpenPath, "--limit", "1", "--format", "json"],
    [
      "space",
      "materialize",
      relationalCorePath,
      "--scope",
      "V_TRIGGER",
      "--limit",
      "4",
      "--format",
      "json",
    ],
    [
      "space",
      "materialize",
      relationalCorePath,
      "--scope",
      "V_TRIGGER",
      "--limit",
      "4",
      "--format",
      "text",
    ],
    [
      "space",
      "materialize",
      relationalCorePath,
      "--scope",
      "V_TRIGGER",
      "--limit",
      "2",
      "--format",
      "json",
    ],
    [
      "space",
      "materialize",
      relationalCorePath,
      "--scope",
      "V_TRIGGER",
      "--limit",
      "2",
      "--require-complete",
      "--format",
      "json",
    ],
    [
      "space",
      "materialize",
      relationalOpenPath,
      "--scope",
      "V_OPEN_LEFT",
      "--limit",
      "2",
      "--format",
      "json",
    ],
  ] as const;

  for (const args of cases) {
    const first = runPrivateCli(args);
    const second = runPrivateCli(args);
    const requireComplete = args.some(
      (argument) => argument === "--require-complete",
    );
    const boundedNonMaterialization =
      args.some((argument) => argument === "--limit") &&
      !(args[0] === "space" && args[1] === "materialize");
    let expectedStatus = 0;
    if (requireComplete) expectedStatus = 5;
    else if (boundedNonMaterialization) expectedStatus = 1;
    assert.equal(first.status, expectedStatus, first.stderr);
    assert.deepEqual(first, second);
    assert.equal(first.stderr, "");
    if (args.at(-1) === "json") {
      assertResultSchema(JSON.parse(first.stdout) as BootstrapReadResult);
    } else {
      assert(first.stdout.endsWith("\n"));
      assert(first.stdout.includes("Llmrecog."));
    }
    if (args.includes("C_REQ_ON")) {
      assert(first.stdout.includes("RCG-RSN-203"));
      assert(first.stdout.includes("K_REQ_ON_REQUIRES_FAST"));
    }
    if (
      args[1] === "materialize" &&
      args.includes(relationalCorePath) &&
      args.includes("2")
    ) {
      const materialized = JSON.parse(first.stdout) as BootstrapReadResult;
      assert.equal(materialized.complete, false);
      assert.equal(materialized.truncated, true);
    }
  }
  assert.equal(digest(minimalPath), beforeDigest);
  assert.equal(digest(propagatedExclusionPath), beforeAuditDigest);
  assert.equal(digest(relationalConflictPath), beforeRelationalDigest);
  assert.equal(digest(relationalOpenPath), beforeQueryDigest);
  assert.equal(digest(relationalCorePath), beforeMaterializationDigest);

  const missing = runPrivateCli([
    "recognition",
    "show",
    "R_MISSING",
    minimalPath,
    "--format",
    "json",
  ]);
  assert.equal(missing.status, 1);
  assertResultSchema(JSON.parse(missing.stdout) as BootstrapReadResult);

  const missingExplain = runPrivateCli([
    "recognition",
    "explain",
    "R_MISSING",
    minimalPath,
    "--format",
    "json",
  ]);
  assert.equal(missingExplain.status, 1);
  assertResultSchema(JSON.parse(missingExplain.stdout) as BootstrapReadResult);

  const invalidScope = runPrivateCli([
    "recognition",
    "explain",
    "C_SECONDARY",
    unsupportedAllowedPath,
    "--scope",
    "V_MISSING",
  ]);
  assert.equal(invalidScope.status, 2);
  assert.equal(invalidScope.stdout, "");
  assert.match(invalidScope.stderr, /scope/u);

  const viabilityWithoutVariable = runPrivateCli([
    "space",
    "query",
    relationalOpenPath,
    "--viability",
    "unknown",
  ]);
  assert.equal(viabilityWithoutVariable.status, 2);
  assert.equal(viabilityWithoutVariable.stdout, "");
  assert.match(viabilityWithoutVariable.stderr, /requires --variable/u);

  const invalidQueryKind = runPrivateCli([
    "space",
    "query",
    relationalOpenPath,
    "--kind",
    "variable",
    "--variable",
    "V_OPEN_LEFT",
  ]);
  assert.equal(invalidQueryKind.status, 2);
  assert.equal(invalidQueryKind.stdout, "");
  assert.match(invalidQueryKind.stderr, /kind candidate/u);

  const repeatedQueryOption = runPrivateCli([
    "space",
    "query",
    relationalOpenPath,
    "--kind",
    "candidate",
    "--kind",
    "candidate",
  ]);
  assert.equal(repeatedQueryOption.status, 2);
  assert.equal(repeatedQueryOption.stdout, "");
  assert.match(repeatedQueryOption.stderr, /at most once/u);

  const missingMaterializationScope = runPrivateCli([
    "space",
    "materialize",
    relationalCorePath,
    "--limit",
    "4",
  ]);
  assert.equal(missingMaterializationScope.status, 2);
  assert.equal(missingMaterializationScope.stdout, "");
  assert.match(missingMaterializationScope.stderr, /requires --scope/u);

  const missingMaterializationLimit = runPrivateCli([
    "space",
    "materialize",
    relationalCorePath,
    "--scope",
    "V_TRIGGER",
  ]);
  assert.equal(missingMaterializationLimit.status, 2);
  assert.equal(missingMaterializationLimit.stdout, "");
  assert.match(missingMaterializationLimit.stderr, /requires --limit/u);

  const invalidMaterializationScope = runPrivateCli([
    "space",
    "materialize",
    relationalCorePath,
    "--scope",
    "V_MISSING",
    "--limit",
    "4",
  ]);
  assert.equal(invalidMaterializationScope.status, 2);
  assert.equal(invalidMaterializationScope.stdout, "");
  assert.match(invalidMaterializationScope.stderr, /existing variable/u);

  const repeatedRequireComplete = runPrivateCli([
    "space",
    "materialize",
    relationalCorePath,
    "--scope",
    "V_TRIGGER",
    "--limit",
    "2",
    "--require-complete",
    "--require-complete",
  ]);
  assert.equal(repeatedRequireComplete.status, 2);
  assert.equal(repeatedRequireComplete.stdout, "");
  assert.match(repeatedRequireComplete.stderr, /at most once/u);

  const warningThreshold = runPrivateCli([
    "document",
    "audit",
    propagatedExclusionPath,
    "--fail-on",
    "warning",
    "--format",
    "json",
  ]);
  assert.equal(warningThreshold.status, 1);
  const warningResult = JSON.parse(
    warningThreshold.stdout,
  ) as BootstrapReadResult;
  assertResultSchema(warningResult);
  assert.equal(
    warningResult.schema === "Llmrecog.AuditResult.v1" && warningResult.passed,
    false,
  );

  const truncatedAudit = runPrivateCli([
    "document",
    "audit",
    propagatedExclusionPath,
    "--max-diagnostics",
    "1",
    "--format",
    "json",
  ]);
  assert.equal(truncatedAudit.status, 1);
  const truncatedResult = JSON.parse(
    truncatedAudit.stdout,
  ) as BootstrapReadResult;
  assertResultSchema(truncatedResult);
  assert.equal(truncatedResult.complete, false);
  assert.equal(truncatedResult.truncated, true);

  const unavailableProfile = runPrivateCli([
    "document",
    "audit",
    propagatedExclusionPath,
    "--profile",
    "strict-grounding",
  ]);
  assert.equal(unavailableProfile.status, 2);
  assert.equal(unavailableProfile.stdout, "");
  assert.match(unavailableProfile.stderr, /profile/u);
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
    assert.equal(result.stderr, "llmrecog input error: RCG-SYNTAX-001\n");
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
