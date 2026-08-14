import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const repositoryRoot = process.cwd();
const manifestPath = path.join(
  repositoryRoot,
  "test/fixtures/contracts/v0.1/manifest.json",
);

interface Fixture {
  readonly id: string;
  readonly path: string;
  readonly expectation: "valid" | "invalid";
  readonly expected_diagnostics: readonly string[];
  readonly covers_grammar: readonly string[];
}

interface Manifest {
  readonly schema: string;
  readonly semantic_version: string;
  readonly grammar: string;
  readonly fixtures: readonly Fixture[];
  readonly boundary_cases: Readonly<Record<string, string>>;
  readonly expected_results: readonly string[];
  readonly expected_asts: readonly {
    readonly input: string;
    readonly path: string;
  }[];
  readonly diagnostic_expectations: string;
  readonly expected_text_results: readonly string[];
}

interface RegistryEntry {
  readonly code: string;
  readonly name: string;
}

interface Registry {
  readonly schema: string;
  readonly semantic_version: string;
  readonly diagnostics: readonly RegistryEntry[];
  readonly reasons: readonly RegistryEntry[];
}

interface ExpectedDiagnostic {
  readonly code: string;
  readonly entity_id: string | null;
  readonly span: {
    readonly start: {
      readonly line: number;
      readonly column: number;
      readonly offset: number;
    };
    readonly end: {
      readonly line: number;
      readonly column: number;
      readonly offset: number;
    };
  } | null;
  readonly reason_data: Readonly<Record<string, unknown>>;
}

interface DiagnosticFixture {
  readonly id: string;
  readonly path: string;
  readonly digest: string;
  readonly diagnostics: readonly ExpectedDiagnostic[];
}

interface DiagnosticFixtureSet {
  readonly schema: string;
  readonly semantic_version: string;
  readonly fixtures: readonly DiagnosticFixture[];
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8"),
  ) as T;
}

function sha256(relativePath: string): string {
  return `sha256:${crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(repositoryRoot, relativePath)))
    .digest("hex")}`;
}

function assertSyntaxSpansMatchInput(value: unknown, inputPath: string): void {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }
    if (current === null || typeof current !== "object") continue;
    const record = current as Readonly<Record<string, unknown>>;
    const span = record["span"] as
      | {
          readonly start: { readonly offset: number };
          readonly end: { readonly offset: number };
        }
      | undefined;
    if (span !== undefined) {
      assert.deepEqual(
        span.start,
        positionAtByteOffset(inputPath, span.start.offset),
      );
      assert.deepEqual(
        span.end,
        positionAtByteOffset(inputPath, span.end.offset),
      );
    }
    pending.push(...Object.values(record));
  }
}

const manifest = readJson<Manifest>(
  path.relative(repositoryRoot, manifestPath),
);
const registry = readJson<Registry>("contracts/diagnostics-v1.json");

test("the fixture manifest covers every EBNF production exactly by name", () => {
  const grammar = fs.readFileSync(
    path.join(repositoryRoot, manifest.grammar),
    "utf8",
  );
  const productionNames = [...grammar.matchAll(/^([a-z][a-z0-9_]*)\s*=/gm)].map(
    (match) => match[1]!,
  );
  const productions = new Set(productionNames);
  const covered = new Set(
    manifest.fixtures.flatMap((fixture) => fixture.covers_grammar),
  );

  assert(productions.size > 0);
  assert.equal(productions.size, productionNames.length);
  assert.deepEqual(
    [...covered].sort(),
    [...productions].sort(),
    "fixture coverage must match the normative EBNF production set",
  );

  const grammarWithoutCommentsOrTerminals = grammar
    .replace(/\(\*[\s\S]*?\*\)/gu, "")
    .replace(/\?[\s\S]*?\?/gu, "")
    .replace(/"(?:\\.|[^"\\])*"/gu, "")
    .replace(/'(?:\\.|[^'\\])*'/gu, "");
  const referencedNames = new Set(
    [
      ...grammarWithoutCommentsOrTerminals.matchAll(/\b([a-z][a-z0-9_]*)\b/gu),
    ].map((match) => match[1]!),
  );
  for (const referencedName of referencedNames) {
    assert(
      productions.has(referencedName),
      `undefined EBNF production ${referencedName}`,
    );
  }
});

test("all fixture paths, expectations, diagnostics, and boundary cases are registered", () => {
  const fixtureIds = manifest.fixtures.map((fixture) => fixture.id);
  assert.equal(new Set(fixtureIds).size, fixtureIds.length);

  const diagnosticCodes = new Set(
    registry.diagnostics.map((entry) => entry.code),
  );
  for (const fixture of manifest.fixtures) {
    const absolutePath = path.join(repositoryRoot, fixture.path);
    assert(fs.existsSync(absolutePath), `missing fixture ${fixture.path}`);
    assert(
      fs.readFileSync(absolutePath, "utf8").endsWith("\n"),
      `${fixture.path} must have a final newline`,
    );
    if (fixture.expectation === "valid") {
      assert.deepEqual(fixture.expected_diagnostics, []);
    } else {
      assert(fixture.expected_diagnostics.length > 0);
    }
    for (const code of fixture.expected_diagnostics) {
      assert(diagnosticCodes.has(code), `${fixture.id} uses unknown ${code}`);
    }
  }

  const requiredBoundaryCases = [
    "explicit_fact",
    "normalized_meaning",
    "multiple_interpretations",
    "unknown",
    "explicit_exclusion",
    "propagated_exclusion",
    "supported_excluded_conflict",
    "allowed_not_supported",
    "external_knowledge_required",
    "inference_for_llmthink",
    "decision_realization_boundary",
    "prohibited_backflow",
    "materialization_without_decision",
  ];
  assert.deepEqual(
    Object.keys(manifest.boundary_cases).sort(),
    requiredBoundaryCases.sort(),
  );
  for (const fixtureId of Object.values(manifest.boundary_cases)) {
    assert(
      fixtureIds.includes(fixtureId),
      `unknown boundary fixture ${fixtureId}`,
    );
  }
});

test("diagnostic and reason registries have unique stable codes and names", () => {
  assert.equal(registry.schema, "Llmrecog.DiagnosticRegistry.v1");
  assert.equal(registry.semantic_version, "0.1");
  const entries = [...registry.diagnostics, ...registry.reasons];
  assert.equal(
    new Set(entries.map((entry) => entry.code)).size,
    entries.length,
  );
  assert.equal(
    new Set(entries.map((entry) => entry.name)).size,
    entries.length,
  );
  for (const entry of registry.diagnostics) {
    assert.match(entry.code, /^RCG-[A-Z]+-\d{3}$/u);
  }
  for (const entry of registry.reasons) {
    assert.match(entry.code, /^RCG-RSN-\d{3}$/u);
  }
});

test("all result goldens validate against the frozen JSON Schemas", () => {
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
  ];
  const schemas = schemaPaths.map((schemaPath) =>
    readJson<Record<string, unknown>>(schemaPath),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const schema of schemas) ajv.addSchema(schema);

  const schemaByResult = new Map([
    [
      "Llmrecog.ValidationResult.v1",
      "https://mako10k.github.io/llmrecog/schemas/Llmrecog.ValidationResult.v1.schema.json",
    ],
    [
      "Llmrecog.ExplainResult.v1",
      "https://mako10k.github.io/llmrecog/schemas/Llmrecog.ExplainResult.v1.schema.json",
    ],
    [
      "Llmrecog.ExplainResult.v2",
      "https://mako10k.github.io/llmrecog/schemas/Llmrecog.ExplainResult.v2.schema.json",
    ],
    [
      "Llmrecog.DocumentResult.v1",
      "https://mako10k.github.io/llmrecog/schemas/Llmrecog.DocumentResult.v1.schema.json",
    ],
    [
      "Llmrecog.RecognitionResult.v1",
      "https://mako10k.github.io/llmrecog/schemas/Llmrecog.RecognitionResult.v1.schema.json",
    ],
    [
      "Llmrecog.AuditResult.v1",
      "https://mako10k.github.io/llmrecog/schemas/Llmrecog.AuditResult.v1.schema.json",
    ],
  ]);

  for (const resultPath of manifest.expected_results) {
    const result = readJson<Record<string, unknown>>(resultPath);
    const schemaName = result["schema"];
    assert.equal(typeof schemaName, "string");
    const schemaId = schemaByResult.get(schemaName as string);
    assert(schemaId, `no schema registered for ${String(schemaName)}`);
    const validate = ajv.getSchema(schemaId);
    assert(validate, `schema did not compile: ${schemaId}`);
    assert.equal(
      validate(result),
      true,
      `${resultPath}: ${JSON.stringify(validate.errors, null, 2)}`,
    );

    const input = result["input"] as
      { readonly path?: unknown; readonly digest?: unknown } | undefined;
    assert(input && typeof input.path === "string");
    assert.equal(input.digest, sha256(input.path));
  }

  const validateAst = ajv.getSchema(
    "https://mako10k.github.io/llmrecog/schemas/Llmrecog.Ast.v1.schema.json",
  );
  assert(validateAst);
  for (const expectedAst of manifest.expected_asts) {
    const ast = readJson<Record<string, unknown>>(expectedAst.path);
    assert.equal(
      validateAst(ast),
      true,
      `${expectedAst.path}: ${JSON.stringify(validateAst.errors, null, 2)}`,
    );
    assertSyntaxSpansMatchInput(ast, expectedAst.input);
  }
});

function positionAtByteOffset(relativePath: string, offset: number) {
  const bytes = fs.readFileSync(path.join(repositoryRoot, relativePath));
  assert(offset >= 0 && offset <= bytes.length);
  const prefix = bytes.subarray(0, offset).toString("utf8");
  const lines = prefix.split("\n");
  return {
    line: lines.length,
    column: [...(lines.at(-1) ?? "")].length + 1,
    offset,
  };
}

test("invalid fixture diagnostics freeze exact codes, typed data, and byte spans", () => {
  const expected = readJson<DiagnosticFixtureSet>(
    manifest.diagnostic_expectations,
  );
  assert.equal(expected.schema, "Llmrecog.DiagnosticFixtureSet.v1");
  assert.equal(expected.semantic_version, "0.1");

  const invalidFixtures = manifest.fixtures.filter(
    (fixture) => fixture.expectation === "invalid",
  );
  assert.deepEqual(
    expected.fixtures.map((fixture) => fixture.id).sort(),
    invalidFixtures.map((fixture) => fixture.id).sort(),
  );

  for (const fixture of expected.fixtures) {
    const manifestFixture = invalidFixtures.find(
      (candidate) => candidate.id === fixture.id,
    );
    assert(manifestFixture);
    assert.equal(fixture.path, manifestFixture.path);
    assert.equal(fixture.digest, sha256(fixture.path));
    assert.deepEqual(
      fixture.diagnostics.map((diagnostic) => diagnostic.code),
      manifestFixture.expected_diagnostics,
    );
    for (const diagnostic of fixture.diagnostics) {
      assert(Object.keys(diagnostic.reason_data).length > 0);
      if (diagnostic.span !== null) {
        assert.deepEqual(
          diagnostic.span.start,
          positionAtByteOffset(fixture.path, diagnostic.span.start.offset),
        );
        assert.deepEqual(
          diagnostic.span.end,
          positionAtByteOffset(fixture.path, diagnostic.span.end.offset),
        );
      }
    }
  }
});

test("accepted text result goldens use deterministic bytes", () => {
  assert.equal(manifest.expected_text_results.length, 12);
  for (const resultPath of manifest.expected_text_results) {
    const bytes = fs.readFileSync(path.join(repositoryRoot, resultPath));
    const text = bytes.toString("utf8");
    assert(text.startsWith("Llmrecog."));
    assert(text.endsWith("\n"));
    assert(!text.includes("\r"));
    assert(!text.includes("\t"));
  }
});

test("explain goldens keep support and viability orthogonal", () => {
  const results = manifest.expected_results
    .filter((resultPath) => resultPath.endsWith(".explain.json"))
    .map((resultPath) => readJson<Record<string, unknown>>(resultPath));
  const states = new Set<string>();

  for (const result of results) {
    const support = result["support"] as { readonly state: string };
    assert(["supported", "unsupported", "conflicted"].includes(support.state));
    const viability = result["viability"] as { readonly state: string } | null;
    const variableResolution = result["variable_resolution"] as {
      readonly state: string;
      readonly unknown_reasons: readonly string[];
    } | null;
    if (viability !== null) states.add(viability.state);
    if (variableResolution?.state === "unknown") {
      states.add("unknown");
      assert(variableResolution.unknown_reasons.length > 0);
    }
  }

  assert.deepEqual([...states].sort(), ["allowed", "excluded", "unknown"]);
});

test("Phase 3 goldens freeze joint witnesses, bounds, and focused audit", () => {
  const weak = readJson<Record<string, unknown>>(
    "test/fixtures/contracts/v0.1/expected/minimal-weak.explain.json",
  );
  const weakViability = weak["viability"] as {
    readonly state: string;
    readonly witness: {
      readonly assignments: readonly {
        readonly variable_id: string;
        readonly candidate_id: string;
      }[];
    };
  };
  assert.equal(weakViability.state, "allowed");
  assert.deepEqual(
    weakViability.witness.assignments.map((assignment) => ({
      variable_id: assignment.variable_id,
      candidate_id: assignment.candidate_id,
    })),
    [
      { variable_id: "V_ACTOR", candidate_id: "C_ACTOR_SATO" },
      {
        variable_id: "V_COMMITMENT",
        candidate_id: "C_WEAK_COMMITMENT",
      },
    ],
  );

  const constraint = readJson<Record<string, unknown>>(
    "test/fixtures/contracts/v0.1/expected/minimal-excludes.constraint-explain.json",
  );
  const derivations = constraint["derivations"] as readonly {
    readonly code: string;
    readonly constraint_id: string | null;
    readonly inputs: readonly string[];
  }[];
  assert.deepEqual(derivations, [
    {
      code: "RCG-RSN-202",
      name: "excludes_pair_forbidden",
      subject_id: "C_WEAK_COMMITMENT",
      constraint_id: "K_TANAKA_NOT_WEAK",
      inputs: ["C_ACTOR_TANAKA", "C_WEAK_COMMITMENT"],
    },
  ]);

  const unsupported = readJson<Record<string, unknown>>(
    "test/fixtures/contracts/v0.1/expected/unsupported-allowed.explain.json",
  );
  assert.equal(
    (unsupported["support"] as { readonly state: string }).state,
    "unsupported",
  );
  assert.equal(
    (unsupported["viability"] as { readonly state: string }).state,
    "allowed",
  );

  const limited = readJson<Record<string, unknown>>(
    "test/fixtures/contracts/v0.1/expected/limit-unknown.explain.json",
  );
  assert.equal(limited["complete"], false);
  assert.equal(limited["truncated"], true);
  assert.deepEqual(
    (limited["viability"] as { readonly unknown_reasons: readonly string[] })
      .unknown_reasons,
    ["RCG-RSN-007"],
  );
  const limitedRecognition = limited["recognition"] as {
    readonly declaration_kind: string;
    readonly variable_id: string;
    readonly value: Readonly<Record<string, string>>;
  };
  assert.deepEqual(limitedRecognition, {
    declaration_kind: "candidate",
    id: "C_B1",
    variable_id: "V_B",
    value: { kind: "symbol", value: "b1" },
    grounded_in: [{ id: "S1", kind: "span" }],
    support: {
      kind: "ambiguous",
      grounded_in: [{ id: "S1", kind: "span" }],
    },
  });

  const excluded = readJson<Record<string, unknown>>(
    "test/fixtures/contracts/v0.1/expected/candidate-excluded.explain.json",
  );
  assert.equal(
    (excluded["viability"] as { readonly witness: unknown }).witness,
    null,
  );
  assert.deepEqual(excluded["recognition"], {
    declaration_kind: "candidate",
    id: "C_WEAK",
    variable_id: "V_COMMITMENT",
    value: { kind: "symbol", value: "weak_commitment" },
    grounded_in: [{ id: "S1", kind: "span" }],
    support: {
      kind: "ambiguous",
      grounded_in: [{ id: "S1", kind: "span" }],
    },
  });

  const audit = readJson<Record<string, unknown>>(
    "test/fixtures/contracts/v0.1/expected/closed-conflict.audit.json",
  );
  assert.equal(audit["passed"], false);
  assert.deepEqual(audit["evaluated_rule_codes"], [
    "RCG-GROUND-003",
    "RCG-SUPPORT-001",
    "RCG-CSP-001",
    "RCG-CSP-002",
  ]);
  assert.deepEqual(audit["summary"], {
    errors: 2,
    warnings: 3,
    info: 0,
  });
});

test("machine semantic registries do not admit reasoning or realization roles", () => {
  const semanticSchema = fs.readFileSync(
    path.join(
      repositoryRoot,
      "schemas/Llmrecog.SemanticDocument.v1.schema.json",
    ),
    "utf8",
  );
  for (const forbidden of [
    "hypothesis",
    "inference",
    "conclusion",
    "decision",
    "premise",
    "task",
  ]) {
    assert(
      !semanticSchema.includes(`"${forbidden}"`),
      `${forbidden} must not be a semantic registry value`,
    );
  }
});
