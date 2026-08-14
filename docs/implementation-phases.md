# Phased implementation proposal

Implementation begins only after the semantic design and first grammar/JSON
contracts are explicitly accepted. Each phase is a vertical or contract slice,
not authorization for later phases.

## Phase 0: design baseline — completed 2026-08-13

Deliverables:

- vision, requirements, terminology, boundary and Non-goals;
- semantic, provenance, DSL, CLI, and integration drafts;
- minimal and boundary examples;
- ADRs and self-review.

Exit condition:

- no unresolved contradiction in source-boundedness, support/viability,
  unknown, constraint, explain, or integration boundaries;
- explicit approval to freeze the first executable contract.

This phase originally did not select an implementation language. Repository
initialization subsequently selected Node.js 22+, npm, strict TypeScript, and
ESM in ADR 0005 without mutating related repositories or implementing a
parser.

## Phase 1: executable contract fixtures — completed 2026-08-13

Freeze only the first text profile:

- complete EBNF and lexical/error-recovery rules;
- AST and semantic record schemas;
- JSON Schemas for ValidationResult and ExplainResult;
- success/failure fixtures for minimal input and required boundary cases;
- stable diagnostic/reason-code registry;
- canonical formatting expectations, without implementing a formatter command.

Acceptance:

- every grammar rule has at least one fixture;
- forbidden reasoning keywords and ungrounded constraints fail predictably;
- support and viability remain separate in JSON.

Delivered authority:

- [`contracts/llmrecog-0.1.ebnf`](../contracts/llmrecog-0.1.ebnf) and
  [grammar.md](grammar.md);
- AST, semantic document, ValidationResult, and ExplainResult schemas under
  [`schemas/`](../schemas/);
- [`contracts/diagnostics-v1.json`](../contracts/diagnostics-v1.json);
- the versioned fixture
  [manifest](../test/fixtures/contracts/v0.1/manifest.json) and schema-validated
  JSON goldens;
- [canonical-formatting.md](canonical-formatting.md) and ADR 0006.

The contract test proves all 67 EBNF productions and all 13 documented
boundary cases are represented. It does not implement or claim a parser,
semantic validator, solver, formatter, or CLI.

## Phase 2: parse and validate vertical slice — completed 2026-08-14

Implement and dogfood in this order:

1. Freeze the dogfood corpus, understanding questions, receipt fields, and
   feedback disposition rules.
2. Implement the smallest real bytes-to-AST-to-model-to-validation path for
   document, source, span, entity, and record declarations, with private
   read-only validate/show projections.
3. Dogfood `docs/grammar.md` and the normative EBNF, then disposition the
   findings and re-estimate the unfinished work.
4. Complete variables, candidates, constraints, reference resolution,
   semantic validation, and all accepted text/JSON projections.
5. Dogfood requirements, terminology, architecture, and implementation phases,
   then disposition the findings before Phase 2 acceptance.

The intermediate command route is an internal dogfood instrument, not a public
CLI or compatibility promise. There is no locator I/O and no writes.

Acceptance:

- minimal fixture parses and round-trips through the AST representation;
- all phase-1 invalid fixtures fail with stable spans/codes;
- output is deterministic across repeated runs;
- the dependency graph contains no provider or related-project runtime.
- both Phase 2 dogfood rounds have reproducible receipts and all observations
  are accepted, rejected, or deferred;
- accepted contract/semantic feedback was applied through an ADR before code,
  and the remaining roadmap was re-estimated in points.

## Phase 3: one explainable CSP slice

ADR 0008 accepts this phase's explain and focused-audit contract. The private
runtime now implements finite `one_of`, finite `excludes`, typed explanation,
and the focused base audit through the real parser and semantic model. Phase 3
itself remains open until the versioned exclusion/conflict dogfood findings are
reviewed and the final acceptance gate passes.

Implement:

- finite `one_of` and `excludes` semantics first;
- candidate support-state projection;
- viability with witness, exclusion chain, and unknown reasons;
- `recognition explain` for candidates and constraints;
- `document audit` rules needed by this slice.

Use the minimal example as the end-to-end acceptance: weak commitment remains
allowed with Sato, the Tanaka/weak world is excluded, and both results have
deterministic explanations.

After the implementation acceptance checks, rerun the versioned dogfood corpus
with ambiguity, exclusion, conflict, and unknown questions. Disposition those
findings before Phase 4 design or implementation resumes.

Acceptance:

- no candidate is excluded without a grounded constraint chain;
- open-domain and unsupported cases are not reported as false;
- `supported + excluded` is reported as conflict;
- no materialized result is persisted.

## Phase 4: complete initial constraint set and bounded views

Add:

- `requires`, `same_as`, and `distinct_from`;
- transitive reason composition under public reason codes;
- read-only filtered `space query`;
- lazy, scope-and-limit-required `space materialize`;
- completeness/truncation behavior and limit tests.

Acceptance:

- all five constraint truth tables and propagation cases are fixture-backed;
- ordering is deterministic;
- `--require-complete` has the specified failure boundary;
- no optimization, ranking, arbitrary predicates, or negation-as-failure enters
  the solver.

Then dogfood cross-document queries, joint witnesses, bounds, and
materialization against the same corpus. Its reviewed feedback is an input to
the Phase 5 source-verification design.

## Phase 5: local source verification

Add the separately bounded `--verify-sources local` path:

- relative locator resolution from the `.recog` document;
- digest, text range, and quote verification;
- fail-closed mismatch behavior;
- no network or automatic span repair.

This phase is separated because it introduces filesystem I/O and source race
questions absent from the pure core.

Dogfood this path by verifying the repository corpus and deliberately changed
copies. Digest, range, and quote mismatches must fail closed. Disposition the
evidence before designing a provider-backed producer.

## Phase 6: provider-neutral producer and one adapter

Only after the deterministic core and local source verification have passed
their dogfood gates:

- freeze a provider-neutral draft producer contract in an ADR, schemas, and
  explicit fixtures;
- implement the provider-neutral application boundary;
- separately authorize and implement one bounded provider adapter;
- generate draft recognitions from the versioned repository corpus;
- pass every draft through parse, validate, audit, explain, and source
  verification before review;
- compare producer evidence with explicit expectations and the earlier manual
  dogfood receipts, never with an LLM response as a golden oracle;
- disposition feedback before freezing a cross-product handoff.

Provider selection, credentials, network access, cost limits, and live calls
remain separately gated from this planning document.

## Phase 7: typed llmthink reference prototype

Only after a separate llmthink design review:

- freeze `RecognitionReference.v1`;
- freeze a minimal machine-readable grounding claim pattern;
- add read-only reference resolution and stale-digest diagnostics;
- preserve variable ambiguity and source spans;
- add factored llmthink audit for source support, joint CSP compatibility,
  closure, and projection completeness;
- prove that individually allowed but jointly impossible bindings fail audit;
- add optional llmthink audit metrics without requiring llmrecog for plain
  documents;
- prove that narrowing is recorded in llmthink and never written back.

This phase may require coordinated changes in two repositories. It is not
authorized by accepting llmrecog core implementation.

## Later, separately gated work

- explicit recognition generation command and safe output contract;
- structured-source selectors such as JSON Pointer or symbol ranges;
- sidecar or bundle formats if real artifacts demonstrate a readability need;
- formatter command, LSP, VSIX, MCP, or read-only embedding/search adapters;
- versioned provenance and coverage audits across the full
  recog -> think -> perttool chain.

## Current implementation frontier

Complete the versioned Phase 3 exclusion/conflict dogfood and disposition its
findings before the final Phase 3 acceptance audit. Do not begin Phase 4 or
producer dogfood from implementation success alone. Producer dogfood remains
gated on accepted explainability, the complete initial constraint semantics,
fail-closed local source verification, a producer-contract ADR, and a
separately approved adapter.

The current detailed execution order, relative effort, acceptance frontier,
and explicit Non-goals are tracked in
[`plans/phase-3-explainable-csp.pert`](../plans/phase-3-explainable-csp.pert).
The completed Phase 2 plan is retained in
[`plans/phase-2-parse-validate-show.pert`](../plans/phase-2-parse-validate-show.pert).
The point-based cross-phase order and repeated feedback gates are tracked in
[`plans/dogfooding-roadmap.pert`](../plans/dogfooding-roadmap.pert), while the
original [`plans/initial-roadmap.pert`](../plans/initial-roadmap.pert) remains
coarse Phase 0/1 history.
