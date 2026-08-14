# Dogfooding workflow

Status: active Phase 5 process; each implementation slice remains plan-gated

This workflow makes llmrecog consume evidence about its own specifications as
soon as a real read path exists. Dogfooding is an input to design and planning;
it is not independent proof that an interpretation is correct.

## Two distinct dogfood modes

### Authoring and consumption dogfood

An operator or coding agent reads a bounded source document, records only
source-supported meanings in a `.recog` document, and uses llmrecog to validate
and inspect that document. This mode tests whether the DSL, diagnostics, typed
results, and read-only projections help a real reader preserve provenance and
ambiguity.

It begins during Phase 2, immediately after the first private bootstrap read
path. It does not require a provider, solver, filesystem locator verification,
or public CLI.

### Producer dogfood

A separately gated producer reads raw source text and proposes a draft
`.recog` document. The draft must pass through the same deterministic parser,
validator, audit, explain, and source-verification paths as a manually authored
document before a reviewer may accept it.

This mode begins only after the deterministic semantic core and fail-closed
local source verification are accepted, followed by a producer-contract ADR,
schemas, explicit fixtures, and one separately authorized adapter. An LLM
response is never a golden oracle.

## Canonical corpus order

1. `docs/grammar.md` and `contracts/llmrecog-0.1.ebnf` exercise the language's
   ability to describe its own syntax and error boundaries.
2. `docs/requirements.md` and `docs/terminology.md` exercise explicit claims,
   open meanings, and the distinction between `supported`, `allowed`,
   `excluded`, and `unknown`.
3. `docs/architecture.md` and `docs/implementation-phases.md` exercise product
   responsibility boundaries and cross-document references.
4. The same versioned corpus is reused for explain, query/materialization,
   provenance, producer, and handoff rounds so that changes can be compared
   against prior receipts.

The corpus is identified by repository-relative path and digest. A corpus
change starts a new comparison baseline; it must not silently invalidate an
older receipt.

## Versioned active protocol

The exact Phase 2 corpus digests, question IDs, command cases, declaration
coverage, round gates, and acceptance flags are frozen in
[`dogfood/protocol-v1/protocol.json`](../../dogfood/protocol-v1/protocol.json).
The completed Phase 3 ambiguity and exclusion/conflict runs remain bound to
immutable protocols v2 and v3. Protocol v4 retains the exact pre-implementation
Phase 4 contract baseline. Protocol v5 remains bound to the blocked first
relational run that exposed missing known-mismatch command evidence. Protocol
v6 completed that round with repeated known-mismatch and
compound-constraint explain cases. Protocol v7 retains the pre-query
bounded-space baseline, and protocol v8 retains the pre-materialization
baseline. Protocol v9 remains bound to the blocked first bounded-space run,
which showed that its command set could not compare the same low-limit result
with and without `--require-complete`. Protocol v10 remains bound to the
completed replay. Active protocol v11 freezes the pre-implementation local
path-and-digest round in
[`dogfood/protocol-v11/protocol.json`](../../dogfood/protocol-v11/protocol.json).
The process-only receipt and feedback schemas are under
[`dogfood/schemas/`](../../dogfood/schemas/), and the evidence layout and
immutability rules are in [`dogfood/README.md`](../../dogfood/README.md).

Changing a corpus document, question, command case, evidence shape, or storage
rule creates a new protocol version. An older receipt continues to identify its
original protocol by exact digest.

## Frozen questions

Each round selects a bounded subset of these questions before execution:

- Which propositions are explicitly supported, and by which spans?
- Which alternatives remain open or ambiguous?
- Which constraints are explicitly grounded by the source?
- Which candidate states are only syntactically valid, and which later become
  allowed, excluded, conflicting, or unknown?
- Can each validation or classification result be explained from source,
  normalization, constraint, and unknown reasons?
- Does a desired operation derive or choose a conclusion and therefore belong
  to llmthink?
- Does a desired operation create milestones, tasks, dependencies, resources,
  or execution state and therefore belong to perttool?

The questions prevent an attractive output from replacing a testable
understanding objective.

## Round sequence

| Round | Earliest gate | Actual self-use | Feedback applied before |
| --- | --- | --- | --- |
| 0 | Phase 2 contract accepted | Freeze corpus, questions, receipt format, and review categories | Bootstrap implementation |
| 1 | Minimal private read path accepted | Manually encode and validate the grammar/EBNF understanding | Remaining Phase 2 grammar and validation |
| 2 | Complete Phase 2 read path accepted | Manually encode requirements, terminology, architecture, and phase boundaries | Phase 2 acceptance and Phase 3 estimate |
| 3a | Finite `one_of` explain slice accepted | Ask ambiguity, closure, unsupported, unknown, and joint-witness questions of the same corpus | `excludes` and focused audit implementation |
| 3b | Finite `excludes` and focused audit accepted | Ask exclusion-chain, supported-plus-excluded conflict, empty-domain, and limit questions | Phase 3 acceptance and remaining constraint semantics |
| 4a | `requires`, `same_as`, and `distinct_from` slice accepted | Exercise implication, equality, inequality, open operands, joint witnesses, and the deferred compound-navigation question | Query and materialization implementation |
| 4b | Bounded query and materialization accepted | Exercise filters, ordering, limits, open projections, truncation, and require-complete | Phase 4 acceptance and source-verification design |
| 5a | Minimal rooted path and digest verifier accepted | Detect unchanged bytes, stale digests, missing files, root escape, symlinks, and non-regular files | Range and quote implementation |
| 5b | Complete local source verification accepted | Detect stale ranges, quotes, encoding, size, ordering, mixed outcomes, and changed sources | Producer-contract design |
| 6 | One producer adapter separately accepted | Generate raw-document drafts, then validate, audit, explain, verify, and review them | llmthink handoff design |
| 7 | Typed llmthink handoff prototype accepted | Pass accepted recognition references into a read-only reasoning audit | Any broader integration plan |

No implementation slice after a dogfood round starts until that round's
findings have been dispositioned and the remaining PERT estimates have been
reviewed.

## Receipt and feedback contract

Each immutable run receipt records:

- run identifier, exact tool revision, semantic version, and command inputs;
- corpus paths and digests, frozen question IDs, and authored artifact digest;
- deterministic result and diagnostic digests plus completeness/truncation;
- observed friction with a reproducible example;
- category: contract/semantic, implementation, diagnostics/presentation,
  documentation, or product-boundary pressure;
- proposed action, affected contract version, and point-estimate impact.

A separate feedback artifact binds to the receipt digest and records accepted,
rejected, or deferred disposition, reviewer, rationale, follow-up task IDs, and
point changes. This separation lets the dogfood round capture observations
before its following review/replan task decides what to do with them.

Receipts and feedback record evidence and decisions, not private
chain-of-thought. An authored or generated dogfood artifact becomes a normative
fixture only after its expected meaning is explicitly reviewed and versioned.

## Feedback gates

At each gate:

1. Reproduce the observation against the exact revision and corpus digests.
2. Separate incorrect behavior from missing later-phase behavior and authoring
   inconvenience.
3. Apply the product responsibility tests before expanding semantics.
4. For a semantic or public-contract change, accept an ADR and update
   requirements, terminology, schemas, fixtures, and diagnostics together.
5. Add or correct explicit success and failure fixtures before implementation.
6. Re-estimate unfinished work in points; keep elapsed-time forecasts absent
   until enough comparable completed work provides stable velocity evidence.
7. Preserve rejected and deferred findings so a later round cannot silently
   reopen them.

Dogfood success means that the frozen questions produced reproducible evidence
and all findings were dispositioned. It does not mean the tool agreed with the
operator, generated polished prose, or inferred a decision not supported by
the source.
