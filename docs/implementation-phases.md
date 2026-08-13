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

## Phase 2: parse and validate vertical slice

Implement:

- `.recog` parser for document, source, span, entity, record, variable,
  candidate, and constraint blocks;
- typed model and reference resolution;
- semantic validator for the five constraint shapes;
- `document validate`, `document show`, and `recognition show` in text/JSON;
- no locator I/O by default and no writes.

Acceptance:

- minimal fixture parses and round-trips through the AST representation;
- all phase-1 invalid fixtures fail with stable spans/codes;
- output is deterministic across repeated runs;
- the dependency graph contains no provider or related-project runtime.

## Phase 3: one explainable CSP slice

Implement:

- finite `one_of` and `excludes` semantics first;
- candidate support-state projection;
- viability with witness, exclusion chain, and unknown reasons;
- `recognition explain` for candidates and constraints;
- `document audit` rules needed by this slice.

Use the minimal example as the end-to-end acceptance: weak commitment remains
allowed with Sato, the Tanaka/weak world is excluded, and both results have
deterministic explanations.

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

## Phase 5: local source verification

Add the separately bounded `--verify-sources local` path:

- relative locator resolution from the `.recog` document;
- digest, text range, and quote verification;
- fail-closed mismatch behavior;
- no network or automatic span repair.

This phase is separated because it introduces filesystem I/O and source race
questions absent from the pure core.

## Phase 6: typed llmthink reference prototype

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

- provider-neutral producer API and one LLM adapter;
- explicit recognition generation command and safe output contract;
- structured-source selectors such as JSON Pointer or symbol ranges;
- sidecar or bundle formats if real artifacts demonstrate a readability need;
- formatter command, LSP, VSIX, MCP, or read-only embedding/search adapters;
- versioned provenance and coverage audits across the full
  recog -> think -> perttool chain.

## Recommended first implementation slice

After a separate Phase 2 authorization, implement Phase 2 only. It creates the
smallest useful foundation and lets the semantic model fail early under real
parse/reference seams. Do not start with LLM extraction, a general CSP backend,
or cross-repository integration.
