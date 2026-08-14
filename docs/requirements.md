# llmrecog requirements

- Status: Private Phase 4 relational and bounded-query slices implemented; materialization not implemented
- Date: 2026-08-14
- Provisional document extension: `.recog`
- Product role: Recognition

The words **Must**, **Should**, and **Could** express required, recommended,
and deferred behavior for the first public semantic contract.

## 1. Purpose

`llmrecog` Must turn unstructured or insufficiently structured input into a
source-grounded, structured semantic state. That state Must answer both:

- what meaning the input positively supports; and
- what remains ambiguous, excluded, or unknown under constraints that are
  themselves grounded in that input.

The system Must not derive a new proposition merely because it logically,
causally, statistically, or pragmatically follows from recognized content.
Such work belongs to `llmthink`.

## 2. Recognition boundary

### 2.1 Included semantic operations

The model Must be able to represent:

- entities and aliases;
- relations and properties;
- intent or linguistic modality explicitly conveyed by the input;
- coreference candidates;
- date, unit, and notation normalization;
- ambiguity and multiple plausible readings;
- semantic variables and finite candidate values;
- source-grounded constraints over those candidates;
- unknown and open domains;
- source spans, support records, producer metadata, and provenance;
- deterministic derivations produced by applying declared constraints.

Normalization Must preserve meaning rather than add a forecast, judgment, or
world claim. Every normalization Must cite its own grounded input and named
deterministic rule. Context-dependent normalization Must additionally cite each
source-provided anchor used. Runtime time, locale, or external knowledge Must
not be used silently.

### 2.2 Excluded semantic operations

The core Must not own:

- hypothesis generation;
- abductive, causal, deliberative, or probabilistic inference;
- ranking or choosing the best interpretation as a conclusion;
- comparison of alternatives for decision-making;
- conclusions, decisions, recommendations, or project plans;
- task, dependency, resource, estimate, acceptance, or execution state;
- truth verification against external reality.

The complete exclusions are in [non-goals.md](non-goals.md).

### 2.3 Content versus truth

A source can support the recognition that it states `X` even when `X` is
false, stale, fictional, quoted, denied by another source, or not independently
verified. `llmrecog` Must preserve relevant modality, polarity, speaker, and
context when omitting them would falsely convert reported content into a world
fact.

## 3. Source-boundedness

- Every semantic declaration Must have at least one provenance path to a
  source span or an explicitly identified structural source location.
- Every constraint that can exclude a candidate Must have its own grounding;
  grounding only its operands is insufficient.
- A deterministic normalization Must record the rule identifier and its input
  span or prior grounded record.
- A propagated exclusion Must not become a new source recognition. It is a
  derived solver result with a reason chain.
- A record whose source support cannot be shown Must be rejected or reported
  by audit as unsupported; confidence alone is never grounding.
- External knowledge May be used only after it is made an explicit additional
  source and a new recognition run is requested.

## 4. Ambiguity and open-world semantics

- The system Must preserve multiple plausible readings when the input does not
  select among them.
- The source document Must represent possibility spaces primarily as
  variables, candidates, and constraints, not as a Cartesian product of
  complete worlds.
- Variables Must be open by default. A closed/exhaustive domain Must be
  justified by a grounded `one_of` constraint or another future, explicitly
  versioned closure rule.
- Missing data Must not imply negative support, impossibility, or an
  `unspecified` candidate.
- `unknown` Must be a normal result, not a validation defect.
- Source support and CSP viability Must be evaluated independently as defined
  in [semantic-model.md](semantic-model.md).

## 5. Constraint semantics

The initial constraint vocabulary Must be limited to:

- `one_of`;
- `requires`;
- `excludes`;
- `same_as`;
- `distinct_from`.

The engine Must use these constraints only to describe and reduce a bounded
meaning space. It Must not expose a general rule language, arbitrary
predicates, negation-as-failure, theorem proving, optimization objective, or
learned inference inside the core.

Constraint propagation Must be deterministic for the same validated document,
scope, limits, and core semantic version. An empty domain, incompatible
grounded records, or a source-supported candidate eliminated by constraints
Must be reported as a conflict rather than silently repaired.

Constraint evaluation over a represented assignment Must distinguish
`satisfied`, `violated`, and `indeterminate`. An open/unbound operand Must not
be treated as evidence of equality or inequality. Only assignments that
satisfy every relevant constraint May be returned as witnesses or materialized
worlds; indeterminate assignments Must preserve typed unknown reasons.

## 6. Provenance and explainability

The model Must retain:

- stable IDs for sources, spans, semantic records, candidates, constraints,
  and derivation steps;
- human-inspectable source locators and selectors;
- an exact quote where practical;
- an optional content digest for immutable source identity;
- support kind;
- optional producer and generation metadata;
- optional producer confidence, explicitly non-semantic;
- the ordered reason chain for every propagated exclusion.

For any record or candidate, the CLI Must be able to explain:

- where it came from;
- whether it has positive source support;
- whether it is allowed, excluded, or unknown in the requested CSP scope;
- which constraints were relevant;
- why a constraint applied;
- why the result is unknown;
- whether materialization or explanation was truncated.

## 7. Deterministic core and LLM boundary

The core Must provide provider-independent parsing, validation, reference
resolution, bounded propagation, query, materialization, and explanation.

An LLM May propose a `.recog` artifact through a producer adapter. The LLM
output Must pass the same parser, validator, and audit path as hand-authored
input. Model identity, prompt identity, sampling settings, and execution time
May be recorded as producer metadata but Must not change core semantics.

The initial implementation Must not require an LLM, network, database, or
background service.

## 8. Storage and usability

- `.recog` Must be UTF-8 text, human-readable, machine-verifiable,
  source-controlled, and diff-friendly.
- IDs and ordering Must be stable under formatting.
- Derived materializations and solver caches Must not be mixed into the
  source-of-truth document by default.
- Relative source and reference paths Must resolve relative to the `.recog`
  document, not the process working directory.
- Human-readable and JSON results Must carry equivalent semantic information.
- Machine-readable contracts Must use stable schema names and typed reason
  codes rather than natural-language messages as authority.

## 9. CLI requirements

The provisional CLI Must support the following capabilities:

- document validation;
- document and record inspection;
- recognition and candidate explanation;
- read-only query;
- semantic safety audit;
- query-scoped, bounded materialization.

The initial CLI Must have no mutating command. Provider-backed recognition
generation, format conversion, and llmthink import/export are later phases.
The detailed surface is in [cli-contract.md](cli-contract.md).

## 10. llmthink integration

- `llmthink` Must remain usable without `llmrecog`.
- `llmrecog` Must not depend on the `llmthink` parser, store, or runtime.
- A typed recognition reference Must identify the `.recog` document, target
  record, and immutable digest when available.
- Referring to a variable Must preserve its candidates, closure, viability,
  and unknown state; integration Must not silently flatten it to one value.
- Selecting or narrowing candidates for reasoning Must be represented as a
  `llmthink` operation, not as a changed recognition.
- When a typed reference supplies a machine-readable claim pattern, a future
  llmthink audit Should evaluate reference integrity, source-support coverage,
  joint constraint compatibility, domain closure, and projection completeness
  as separate facts.
- The audit Must evaluate multi-variable bindings jointly. Independently
  allowed candidates Must not be accepted when no single satisfying witness
  contains their combination.
- An open variable Must not be rejected as evidence categorically. It May
  ground an uncertainty or supported-candidate claim, but Must not ground a
  resolved-value or exhaustive-domain claim without the required closure.
- Allowed-but-unsupported candidates Must not be counted as direct source
  evidence.
- `llmthink` conclusions Must never be automatically promoted to source
  recognitions.

The proposed additive interface and current compatibility limitation are in
[integration-llmthink.md](integration-llmthink.md). The optional audit contract
is in [llmthink-grounding-audit.md](llmthink-grounding-audit.md).

## 11. Quality and acceptance

Before the first public semantic contract is accepted, the project Must have:

- parser and validator success/failure fixtures based on the minimal example;
- fixtures for all boundary cases listed in
  [examples/boundary-cases.md](examples/boundary-cases.md);
- deterministic JSON goldens for validation and explanation;
- propagation tests with positive and negative reason chains;
- tests proving missing information remains unknown;
- tests proving `materialize --limit` is stable and reports truncation;
- tests proving no core operation calls a provider or writes a source file;
- an audit showing that no `hypothesis`, `inference`, `conclusion`, `decision`,
  task, or execution concept became a first-class recognition record.

## 12. Future compatibility rules

A change to source-boundedness, support/viability meanings, open-domain
behavior, a constraint truth table, reference identity, materialization
semantics, or JSON result shape requires a versioned semantic contract and an
ADR. Adding a provider adapter or presentation layer does not authorize a core
semantic change.
