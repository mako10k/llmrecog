import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const repositoryRoot = process.cwd();
const protocolPath = "dogfood/protocol-v1/protocol.json";
const runExamplePath = "dogfood/protocol-v1/examples/run-receipt.example.json";
const feedbackExamplePath =
  "dogfood/protocol-v1/examples/feedback.example.json";

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
}

interface FeedbackEntry {
  readonly observation_id: string;
}

interface FeedbackExample {
  readonly feedback_id: string;
  readonly receipt: { readonly path: string; readonly digest: string };
  readonly entries: readonly FeedbackEntry[];
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

test("the dogfood protocol freezes corpus, questions, commands, and gates", () => {
  assert.equal(protocol.schema, "Llmrecog.Internal.DogfoodProtocol.v1");
  assert.equal(protocol.protocol_version, 1);
  assert.equal(protocol.semantic_version, "0.1");
  assert.equal(protocol.status, "active");
  assert.equal(protocol.run_path_pattern, "dogfood/runs/<run-id>");

  assert.deepEqual(
    protocol.rounds.map((round) => round.sequence),
    [1, 2],
  );
  assert.equal(
    new Set(protocol.rounds.map((round) => round.id)).size,
    protocol.rounds.length,
  );

  const documentIds = protocol.rounds.flatMap((round) =>
    round.documents.map((document) => document.id),
  );
  assert.equal(new Set(documentIds).size, documentIds.length);
  for (const round of protocol.rounds) {
    assert(round.earliest_gate.length > 0);
    assert(round.next_gate.length > 0);
    assert(round.required_declarations.length > 0);
    for (const document of round.documents) {
      assert(document.authority.length > 0);
      assert(fs.existsSync(path.join(repositoryRoot, document.path)));
      assert.equal(document.digest, sha256(document.path));
    }
  }

  const questionIds = protocol.questions.map((question) => question.id);
  assert.equal(new Set(questionIds).size, questionIds.length);
  for (const question of protocol.questions) {
    assert(question.prompt.length > 0);
    assert(question.required_evidence.length > 0);
    assert(question.non_goal.length > 0);
  }
  for (const round of protocol.rounds) {
    assert.deepEqual(
      [...round.question_ids].sort(),
      protocol.questions
        .filter((question) => question.round_id === round.id)
        .map((question) => question.id)
        .sort(),
    );
  }

  const commandCaseIds = protocol.command_cases.map((command) => command.id);
  assert.equal(new Set(commandCaseIds).size, commandCaseIds.length);
  for (const command of protocol.command_cases) {
    assert(command.route.length === 2);
    assert.equal(command.repeat_count, 2);
  }
  for (const round of protocol.rounds) {
    assert.deepEqual([...round.command_case_ids].sort(), commandCaseIds.sort());
  }

  assert.deepEqual(protocol.observation_categories, [
    "contract_semantic",
    "implementation",
    "diagnostics_presentation",
    "documentation",
    "product_boundary",
  ]);
  assert.deepEqual(protocol.feedback_dispositions, [
    "accepted",
    "rejected",
    "deferred",
  ]);
  assert(Object.values(protocol.acceptance).every(Boolean));
});

test("dogfood receipt and feedback examples satisfy their process schemas", () => {
  const runSchema = readJson<Record<string, unknown>>(protocol.receipt_schema);
  const feedbackSchema = readJson<Record<string, unknown>>(
    protocol.feedback_schema,
  );
  const runExample = readJson<RunExample>(runExamplePath);
  const feedbackExample = readJson<FeedbackExample>(feedbackExamplePath);
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
    validateFeedback(feedbackExample),
    true,
    JSON.stringify(validateFeedback.errors, null, 2),
  );

  assert(runExample.run_id.startsWith("EXAMPLE_"));
  assert.equal(runExample.tool.repository_revision, "0".repeat(40));
  assert.equal(runExample.protocol.path, protocolPath);
  assert.equal(runExample.protocol.digest, sha256(protocolPath));
  assert.equal(runExample.artifact.digest, sha256(runExample.artifact.path));

  const round = protocol.rounds.find(
    (candidate) => candidate.id === runExample.round_id,
  );
  assert(round);
  assert.deepEqual(
    runExample.question_results.map((result) => result.question_id).sort(),
    [...round.question_ids].sort(),
  );
  assert(
    runExample.question_results.every(
      (result) =>
        ["answered", "blocked"].includes(result.status) &&
        result.summary.length > 0 &&
        result.evidence.length > 0,
    ),
  );
  for (const commandCase of protocol.command_cases) {
    const executions = runExample.executions
      .filter((execution) => execution.case_id === commandCase.id)
      .sort((left, right) => left.repeat_index - right.repeat_index);
    assert.deepEqual(
      executions.map((execution) => execution.repeat_index),
      [1, 2],
    );
    assert.deepEqual(executions[0]?.argv, executions[1]?.argv);
    assert.equal(executions[0]?.exit_status, executions[1]?.exit_status);
    assert.equal(executions[0]?.stdout_digest, executions[1]?.stdout_digest);
    assert.equal(executions[0]?.stderr_digest, executions[1]?.stderr_digest);
  }

  assert(feedbackExample.feedback_id.startsWith("EXAMPLE_"));
  assert.equal(feedbackExample.receipt.path, runExamplePath);
  assert.equal(feedbackExample.receipt.digest, sha256(runExamplePath));
  assert.deepEqual(
    feedbackExample.entries.map((entry) => entry.observation_id).sort(),
    runExample.observations.map((observation) => observation.id).sort(),
  );
  assert.equal(feedbackExample.round_complete, true);
  assert.deepEqual(feedbackExample.unresolved_observation_ids, []);
});
