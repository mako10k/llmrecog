import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const repositoryRoot = process.cwd();
const protocolPath = "dogfood/protocol-v1/protocol.json";
const phase3ProtocolV2Path = "dogfood/protocol-v2/protocol.json";
const phase3ProtocolV3Path = "dogfood/protocol-v3/protocol.json";
const phase4ProtocolV4Path = "dogfood/protocol-v4/protocol.json";
const activeProtocolPath = "dogfood/protocol-v5/protocol.json";
const runExamplePath = "dogfood/protocol-v1/examples/run-receipt.example.json";
const grammarRunReceiptPath =
  "dogfood/runs/GRAMMAR_AUTHORING_20260814_01/receipt.json";
const specificationRunReceiptPath =
  "dogfood/runs/SPECIFICATION_AUTHORING_20260814_01/receipt.json";
const ambiguityRunReceiptPath =
  "dogfood/runs/AMBIGUITY_EXPLAIN_20260814_01/receipt.json";
const exclusionRunReceiptPath =
  "dogfood/runs/EXCLUSION_CONFLICT_20260814_01/receipt.json";
const relationalRunReceiptPath =
  "dogfood/runs/RELATIONAL_CONSTRAINTS_20260814_01/receipt.json";
const feedbackExamplePath =
  "dogfood/protocol-v1/examples/feedback.example.json";
const grammarFeedbackPath =
  "dogfood/runs/GRAMMAR_AUTHORING_20260814_01/feedback.json";
const specificationFeedbackPath =
  "dogfood/runs/SPECIFICATION_AUTHORING_20260814_01/feedback.json";
const ambiguityFeedbackPath =
  "dogfood/runs/AMBIGUITY_EXPLAIN_20260814_01/feedback.json";
const exclusionFeedbackPath =
  "dogfood/runs/EXCLUSION_CONFLICT_20260814_01/feedback.json";

interface ProtocolDocument {
  readonly id: string;
  readonly path: string;
  readonly digest: string;
  readonly authority: string;
}

interface ProtocolRound {
  readonly id: string;
  readonly sequence: number;
  readonly earliest_gate: string;
  readonly documents: readonly ProtocolDocument[];
  readonly question_ids: readonly string[];
  readonly required_declarations: readonly string[];
  readonly command_case_ids: readonly string[];
  readonly next_gate: string;
}

interface ProtocolQuestion {
  readonly id: string;
  readonly round_id: string;
  readonly prompt: string;
  readonly required_evidence: string;
  readonly non_goal: string;
}

interface CommandCase {
  readonly id: string;
  readonly route: readonly string[];
  readonly format: "json" | "text";
  readonly repeat_count: number;
  readonly required_options?: readonly string[];
  readonly required_flags?: readonly string[];
}

interface DogfoodProtocol {
  readonly schema: string;
  readonly protocol_version: number;
  readonly semantic_version: string;
  readonly status: string;
  readonly receipt_schema: string;
  readonly feedback_schema: string;
  readonly run_path_pattern: string;
  readonly rounds: readonly ProtocolRound[];
  readonly questions: readonly ProtocolQuestion[];
  readonly command_cases: readonly CommandCase[];
  readonly observation_categories: readonly string[];
  readonly feedback_dispositions: readonly string[];
  readonly acceptance: Readonly<Record<string, boolean>>;
}

interface RunExecution {
  readonly case_id: string;
  readonly repeat_index: number;
  readonly argv: readonly string[];
  readonly exit_status: number;
  readonly stdout_digest: string;
  readonly stderr_digest: string;
}

interface RunObservation {
  readonly id: string;
}

interface QuestionResult {
  readonly question_id: string;
  readonly status: "answered" | "blocked";
  readonly summary: string;
  readonly evidence: readonly string[];
}

interface RunExample {
  readonly run_id: string;
  readonly round_id: string;
  readonly tool: { readonly repository_revision: string };
  readonly protocol: { readonly path: string; readonly digest: string };
  readonly question_results: readonly QuestionResult[];
  readonly artifact: { readonly path: string; readonly digest: string };
  readonly executions: readonly RunExecution[];
  readonly observations: readonly RunObservation[];
  readonly outcome: "completed" | "blocked";
  readonly complete: boolean;
  readonly truncated: boolean;
}

interface FeedbackEntry {
  readonly observation_id: string;
}

interface FeedbackExample {
  readonly feedback_id: string;
  readonly receipt: { readonly path: string; readonly digest: string };
  readonly entries: readonly FeedbackEntry[];
  readonly point_adjustments: readonly {
    readonly task_id: string;
    readonly previous_points: number;
    readonly revised_points: number;
  }[];
  readonly round_complete: boolean;
  readonly unresolved_observation_ids: readonly string[];
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

const protocol = readJson<DogfoodProtocol>(protocolPath);
const activeProtocol = readJson<DogfoodProtocol>(activeProtocolPath);

function requiredCommandCase(
  protocolDocument: DogfoodProtocol,
  commandCaseId: string,
): CommandCase {
  const commandCase = protocolDocument.command_cases.find(
    (candidate) => candidate.id === commandCaseId,
  );
  assert(commandCase);
  return commandCase;
}

function assertRequiredOptions(
  argv: readonly string[],
  requiredOptions: readonly string[],
): void {
  for (let index = 0; index < requiredOptions.length; index += 2) {
    const option = requiredOptions[index]!;
    const value = requiredOptions[index + 1]!;
    const optionIndex = argv.indexOf(option);
    assert.notEqual(optionIndex, -1);
    assert.equal(argv[optionIndex + 1], value);
  }
}

function assertCommandExecutionBindings(
  run: RunExample,
  commandCase: CommandCase,
): void {
  const executions = run.executions
    .filter((execution) => execution.case_id === commandCase.id)
    .sort((left, right) => left.repeat_index - right.repeat_index);
  assert.deepEqual(
    executions.map((execution) => execution.repeat_index),
    Array.from({ length: commandCase.repeat_count }, (_, index) => index + 1),
  );
  assert.deepEqual(executions[0]?.argv, executions[1]?.argv);
  assert.equal(executions[0]?.exit_status, executions[1]?.exit_status);
  assert.equal(executions[0]?.stdout_digest, executions[1]?.stdout_digest);
  assert.equal(executions[0]?.stderr_digest, executions[1]?.stderr_digest);
  const argv = executions[0]!.argv;
  const routeIndex = argv.findIndex(
    (argument, index) =>
      argument === commandCase.route[0] &&
      argv[index + 1] === commandCase.route[1],
  );
  assert.notEqual(routeIndex, -1);
  const formatIndex = argv.indexOf("--format");
  assert.notEqual(formatIndex, -1);
  assert.equal(argv[formatIndex + 1], commandCase.format);
  assertRequiredOptions(argv, commandCase.required_options ?? []);
  for (const flag of commandCase.required_flags ?? []) {
    assert(argv.includes(flag));
  }
}

function assertExecutionBindings(
  run: RunExample,
  round: ProtocolRound,
  protocolDocument: DogfoodProtocol,
): void {
  const commandCases = round.command_case_ids.map((commandCaseId) =>
    requiredCommandCase(protocolDocument, commandCaseId),
  );
  assert.equal(
    run.executions.length,
    commandCases.reduce(
      (total, commandCase) => total + commandCase.repeat_count,
      0,
    ),
  );
  assert(
    run.executions.every((execution) =>
      round.command_case_ids.includes(execution.case_id),
    ),
  );
  for (const commandCase of commandCases) {
    assertCommandExecutionBindings(run, commandCase);
  }
}

function assertRunBindings(
  run: RunExample,
  boundProtocol: DogfoodProtocol = protocol,
  boundProtocolPath: string = protocolPath,
): void {
  assert.equal(run.protocol.path, boundProtocolPath);
  assert.equal(run.protocol.digest, sha256(boundProtocolPath));
  assert.equal(run.artifact.digest, sha256(run.artifact.path));

  const round = boundProtocol.rounds.find(
    (candidate) => candidate.id === run.round_id,
  );
  assert(round);
  const artifactText = fs.readFileSync(
    path.join(repositoryRoot, run.artifact.path),
    "utf8",
  );
  const declaredKinds = new Set(
    artifactText.split("\n").flatMap((line) => {
      if (line.startsWith(" ") || !line.endsWith(":")) return [];
      const separator = line.indexOf(" ");
      return separator === -1 ? [] : [line.slice(0, separator)];
    }),
  );
  assert.deepEqual(
    round.required_declarations.filter((kind) => !declaredKinds.has(kind)),
    [],
  );
  assert.deepEqual(
    run.question_results.map((result) => result.question_id).sort(),
    [...round.question_ids].sort(),
  );
  assert(
    run.question_results.every(
      (result) =>
        ["answered", "blocked"].includes(result.status) &&
        result.summary.length > 0 &&
        result.evidence.length > 0,
    ),
  );
  assertExecutionBindings(run, round, boundProtocol);
}

function assertFeedbackBindings(
  feedback: FeedbackExample,
  receiptPath: string,
  run: RunExample,
): void {
  assert.equal(feedback.receipt.path, receiptPath);
  assert.equal(feedback.receipt.digest, sha256(receiptPath));
  assert.deepEqual(
    feedback.entries.map((entry) => entry.observation_id).sort(),
    run.observations.map((observation) => observation.id).sort(),
  );
  assert.equal(feedback.round_complete, true);
  assert.deepEqual(feedback.unresolved_observation_ids, []);
}

test("the active dogfood protocol freezes corpus, questions, commands, and gates", () => {
  assert.equal(
    sha256(protocolPath),
    "sha256:d9cd79dfb7a614bf42c2966ee27535e99dbf9c9d2e5259b05317a306104f201f",
  );
  assert.equal(
    sha256(phase3ProtocolV2Path),
    "sha256:f86c886a9bb5b5ac801cd15bd1a94edac26b5afc7546d762d70a3bb1ffafc0b7",
  );
  assert.equal(
    sha256(phase3ProtocolV3Path),
    "sha256:868c33d5157f5d83355347247000bad4ec15901776bc22b4bcb6b10d356f6320",
  );
  assert.equal(
    sha256(phase4ProtocolV4Path),
    "sha256:e9161272674284cd3f3a551f1de59938cfbdcbc88107836c23ac77b98bc7730b",
  );
  assert.equal(
    sha256(activeProtocolPath),
    "sha256:29c91b743677a0c14ad65e41a40a27ec942063d12d1c31987e5b9cc8971613b9",
  );
  assert.equal(activeProtocol.schema, "Llmrecog.Internal.DogfoodProtocol.v1");
  assert.equal(activeProtocol.protocol_version, 5);
  assert.equal(activeProtocol.semantic_version, "0.1");
  assert.equal(activeProtocol.status, "active");
  assert.equal(activeProtocol.run_path_pattern, "dogfood/runs/<run-id>");

  assert.deepEqual(
    activeProtocol.rounds.map((round) => round.sequence),
    [5, 6],
  );
  assert.equal(
    new Set(activeProtocol.rounds.map((round) => round.id)).size,
    activeProtocol.rounds.length,
  );

  const documentIds = activeProtocol.rounds.flatMap((round) =>
    round.documents.map((document) => document.id),
  );
  assert.equal(new Set(documentIds).size, documentIds.length);
  for (const round of activeProtocol.rounds) {
    assert(round.earliest_gate.length > 0);
    assert(round.next_gate.length > 0);
    assert(round.required_declarations.length > 0);
    for (const document of round.documents) {
      assert(document.authority.length > 0);
      assert(fs.existsSync(path.join(repositoryRoot, document.path)));
      assert.equal(document.digest, sha256(document.path));
    }
  }

  const questionIds = activeProtocol.questions.map((question) => question.id);
  assert.equal(new Set(questionIds).size, questionIds.length);
  for (const question of activeProtocol.questions) {
    assert(question.prompt.length > 0);
    assert(question.required_evidence.length > 0);
    assert(question.non_goal.length > 0);
  }
  for (const round of activeProtocol.rounds) {
    assert.deepEqual(
      [...round.question_ids].sort(),
      activeProtocol.questions
        .filter((question) => question.round_id === round.id)
        .map((question) => question.id)
        .sort(),
    );
  }

  const commandCaseIds = activeProtocol.command_cases.map(
    (command) => command.id,
  );
  assert.equal(new Set(commandCaseIds).size, commandCaseIds.length);
  for (const command of activeProtocol.command_cases) {
    assert(command.route.length === 2);
    assert.equal(command.repeat_count, 2);
    assert(Array.isArray(command.required_options));
    if (command.required_flags !== undefined) {
      assert(Array.isArray(command.required_flags));
    }
  }
  for (const round of activeProtocol.rounds) {
    assert(round.command_case_ids.length > 0);
    assert(
      round.command_case_ids.every((commandCaseId) =>
        commandCaseIds.includes(commandCaseId),
      ),
    );
  }
  assert(
    activeProtocol.rounds[0]?.command_case_ids.includes(
      "REQUIRES_EXPLAIN_JSON",
    ),
  );
  assert.deepEqual(
    requiredCommandCase(
      activeProtocol,
      "SPACE_MATERIALIZE_REQUIRE_COMPLETE_JSON",
    ).required_flags,
    ["--require-complete"],
  );
  assert(
    activeProtocol.rounds[1]?.command_case_ids.includes(
      "SPACE_MATERIALIZE_REQUIRE_COMPLETE_JSON",
    ),
  );

  assert.deepEqual(activeProtocol.observation_categories, [
    "contract_semantic",
    "implementation",
    "diagnostics_presentation",
    "documentation",
    "product_boundary",
  ]);
  assert.deepEqual(activeProtocol.feedback_dispositions, [
    "accepted",
    "rejected",
    "deferred",
  ]);
  assert(Object.values(activeProtocol.acceptance).every(Boolean));
});

test("dogfood receipts and feedback satisfy their process schemas", () => {
  const runSchema = readJson<Record<string, unknown>>(protocol.receipt_schema);
  const feedbackSchema = readJson<Record<string, unknown>>(
    protocol.feedback_schema,
  );
  const runExample = readJson<RunExample>(runExamplePath);
  const grammarRun = readJson<RunExample>(grammarRunReceiptPath);
  const specificationRun = readJson<RunExample>(specificationRunReceiptPath);
  const ambiguityRun = readJson<RunExample>(ambiguityRunReceiptPath);
  const exclusionRun = readJson<RunExample>(exclusionRunReceiptPath);
  const relationalRun = readJson<RunExample>(relationalRunReceiptPath);
  const feedbackExample = readJson<FeedbackExample>(feedbackExamplePath);
  const grammarFeedback = readJson<FeedbackExample>(grammarFeedbackPath);
  const specificationFeedback = readJson<FeedbackExample>(
    specificationFeedbackPath,
  );
  const ambiguityFeedback = readJson<FeedbackExample>(ambiguityFeedbackPath);
  const exclusionFeedback = readJson<FeedbackExample>(exclusionFeedbackPath);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);

  const validateRun = ajv.compile(runSchema);
  const validateFeedback = ajv.compile(feedbackSchema);
  assert.equal(
    validateRun(runExample),
    true,
    JSON.stringify(validateRun.errors, null, 2),
  );
  assert.equal(
    validateRun(grammarRun),
    true,
    JSON.stringify(validateRun.errors, null, 2),
  );
  assert.equal(
    validateRun(specificationRun),
    true,
    JSON.stringify(validateRun.errors, null, 2),
  );
  assert.equal(
    validateRun(ambiguityRun),
    true,
    JSON.stringify(validateRun.errors, null, 2),
  );
  assert.equal(
    validateRun(exclusionRun),
    true,
    JSON.stringify(validateRun.errors, null, 2),
  );
  assert.equal(
    validateRun(relationalRun),
    true,
    JSON.stringify(validateRun.errors, null, 2),
  );
  assert.equal(
    validateFeedback(feedbackExample),
    true,
    JSON.stringify(validateFeedback.errors, null, 2),
  );
  assert.equal(
    validateFeedback(grammarFeedback),
    true,
    JSON.stringify(validateFeedback.errors, null, 2),
  );
  assert.equal(
    validateFeedback(specificationFeedback),
    true,
    JSON.stringify(validateFeedback.errors, null, 2),
  );
  assert.equal(
    validateFeedback(ambiguityFeedback),
    true,
    JSON.stringify(validateFeedback.errors, null, 2),
  );
  assert.equal(
    validateFeedback(exclusionFeedback),
    true,
    JSON.stringify(validateFeedback.errors, null, 2),
  );

  assert(runExample.run_id.startsWith("EXAMPLE_"));
  assert.equal(runExample.tool.repository_revision, "0".repeat(40));
  assertRunBindings(runExample);
  assert.equal(grammarRun.run_id, "GRAMMAR_AUTHORING_20260814_01");
  assert(
    grammarRun.question_results.every((result) => result.status === "answered"),
  );
  assert.notEqual(grammarRun.tool.repository_revision, "0".repeat(40));
  assert.equal(grammarRun.outcome, "completed");
  assert.equal(grammarRun.complete, true);
  assert.equal(grammarRun.truncated, false);
  assertRunBindings(grammarRun);
  assert.equal(specificationRun.run_id, "SPECIFICATION_AUTHORING_20260814_01");
  assert(
    specificationRun.question_results.every(
      (result) => result.status === "answered",
    ),
  );
  assert.notEqual(specificationRun.tool.repository_revision, "0".repeat(40));
  assert.equal(specificationRun.outcome, "completed");
  assert.equal(specificationRun.complete, true);
  assert.equal(specificationRun.truncated, false);
  assertRunBindings(specificationRun);
  assert.equal(ambiguityRun.run_id, "AMBIGUITY_EXPLAIN_20260814_01");
  assert(
    ambiguityRun.question_results.every(
      (result) => result.status === "answered",
    ),
  );
  assert.notEqual(ambiguityRun.tool.repository_revision, "0".repeat(40));
  assert.equal(ambiguityRun.outcome, "completed");
  assert.equal(ambiguityRun.complete, true);
  assert.equal(ambiguityRun.truncated, false);
  const phase3ProtocolV2 = readJson<DogfoodProtocol>(phase3ProtocolV2Path);
  assertRunBindings(ambiguityRun, phase3ProtocolV2, phase3ProtocolV2Path);
  assert.equal(exclusionRun.run_id, "EXCLUSION_CONFLICT_20260814_01");
  assert(
    exclusionRun.question_results.every(
      (result) => result.status === "answered",
    ),
  );
  assert.notEqual(exclusionRun.tool.repository_revision, "0".repeat(40));
  assert.equal(exclusionRun.outcome, "completed");
  assert.equal(exclusionRun.complete, true);
  assert.equal(exclusionRun.truncated, false);
  const phase3ProtocolV3 = readJson<DogfoodProtocol>(phase3ProtocolV3Path);
  assertRunBindings(exclusionRun, phase3ProtocolV3, phase3ProtocolV3Path);
  assert.equal(relationalRun.run_id, "RELATIONAL_CONSTRAINTS_20260814_01");
  assert(
    relationalRun.question_results.some(
      (result) => result.status === "blocked",
    ),
  );
  assert.notEqual(relationalRun.tool.repository_revision, "0".repeat(40));
  assert.equal(relationalRun.outcome, "blocked");
  assert.equal(relationalRun.complete, false);
  assert.equal(relationalRun.truncated, false);
  assertRunBindings(relationalRun, activeProtocol, activeProtocolPath);

  assert(feedbackExample.feedback_id.startsWith("EXAMPLE_"));
  assertFeedbackBindings(feedbackExample, runExamplePath, runExample);
  assert.equal(
    grammarFeedback.feedback_id,
    "GRAMMAR_AUTHORING_20260814_01_FEEDBACK_01",
  );
  assert.deepEqual(grammarFeedback.point_adjustments, [
    {
      plan_path: "plans/phase-2-parse-validate-show.pert",
      task_id: "APPLY_SPECIFICATION_DOGFOOD_FEEDBACK",
      previous_points: 5,
      revised_points: 7,
      rationale:
        "Reserve 2p to reassess grounded-summary or filtering navigation using the complete declaration set before deciding whether an ADR and public contract change are justified.",
    },
  ]);
  assertFeedbackBindings(grammarFeedback, grammarRunReceiptPath, grammarRun);
  assert.equal(
    specificationFeedback.feedback_id,
    "SPECIFICATION_AUTHORING_20260814_01_FEEDBACK_01",
  );
  assert.deepEqual(specificationFeedback.point_adjustments, [
    {
      plan_path: "plans/dogfooding-roadmap.pert",
      task_id: "DELIVER_PHASE_2_DOGFOOD_SLICE",
      previous_points: 63,
      revised_points: 75,
      rationale:
        "Synchronize the coarse Phase 2 slice with the current detailed plan total, including the accepted jscpd gate and both dogfood feedback reviews, without converting points into elapsed time.",
    },
    {
      plan_path: "plans/dogfooding-roadmap.pert",
      task_id: "IMPLEMENT_AND_DOGFOOD_EXPLAIN",
      previous_points: 26,
      revised_points: 28,
      rationale:
        "Reserve 2p to create the next versioned corpus baseline, update the stale requirements status, and preserve protocol-v1 receipt identity before the CSP dogfood rerun.",
    },
  ]);
  assertFeedbackBindings(
    specificationFeedback,
    specificationRunReceiptPath,
    specificationRun,
  );
  assert.equal(
    ambiguityFeedback.feedback_id,
    "AMBIGUITY_EXPLAIN_20260814_01_FEEDBACK_01",
  );
  assert.deepEqual(ambiguityFeedback.point_adjustments, [
    {
      plan_path: "plans/phase-3-explainable-csp.pert",
      task_id: "IMPLEMENT_TYPED_EXPLAIN_TARGET",
      previous_points: 0,
      revised_points: 3,
      rationale:
        "Add the ADR 0009 schema, typed projection, JSON/text golden, and no-witness fixture gate discovered by actual Round 3a use.",
    },
    {
      plan_path: "plans/phase-3-explainable-csp.pert",
      task_id: "RUN_EXCLUSION_CONFLICT_DOGFOOD",
      previous_points: 3,
      revised_points: 4,
      rationale:
        "Reserve 1p to correct the two stale status documents and create a new immutable corpus protocol before Round 3b without changing the completed Round 3a identity.",
    },
    {
      plan_path: "plans/dogfooding-roadmap.pert",
      task_id: "IMPLEMENT_AND_DOGFOOD_EXPLAIN",
      previous_points: 28,
      revised_points: 32,
      rationale:
        "Synchronize the coarse Phase 3 slice with the detailed plan after adding the 3p typed-result gate and 1p Round 3b corpus rebaseline.",
    },
  ]);
  assertFeedbackBindings(
    ambiguityFeedback,
    ambiguityRunReceiptPath,
    ambiguityRun,
  );
  assert.equal(
    exclusionFeedback.feedback_id,
    "EXCLUSION_CONFLICT_20260814_01_FEEDBACK_01",
  );
  assert.deepEqual(exclusionFeedback.point_adjustments, [
    {
      plan_path: "plans/phase-3-explainable-csp.pert",
      task_id: "IMPLEMENT_AUDIT_DECLARATION_SPANS",
      previous_points: 0,
      revised_points: 3,
      rationale:
        "Add exact CSP001 and CSP002 span fixtures, the AST-to-semantic declaration mapping, equivalent JSON and text projections, and ordering regression coverage before Phase 3 acceptance.",
    },
    {
      plan_path: "plans/dogfooding-roadmap.pert",
      task_id: "IMPLEMENT_AND_DOGFOOD_EXPLAIN",
      previous_points: 32,
      revised_points: 35,
      rationale:
        "Synchronize the coarse Phase 3 slice with the detailed plan after inserting the 3p audit declaration-span correction discovered by Round 3b.",
    },
    {
      plan_path: "plans/dogfooding-roadmap.pert",
      task_id: "COMPLETE_AND_DOGFOOD_CORE",
      previous_points: 34,
      revised_points: 35,
      rationale:
        "Reserve 1p in Phase 4 to evaluate composed query or navigation behavior for a compound allowed-plus-forbidden question before changing the explain contract.",
    },
  ]);
  assertFeedbackBindings(
    exclusionFeedback,
    exclusionRunReceiptPath,
    exclusionRun,
  );
});
