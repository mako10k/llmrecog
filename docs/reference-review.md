# Related-project review

The following local checkouts were inspected on 2026-08-13. The review uses
their checked-in normative documents and examples, not only remembered project
descriptions.

| Project | Inspected revision | Relevant authority |
| --- | --- | --- |
| `mako10k/llmthink` | `c199cecf6f0d4c8a7049c92680c0033b894fe6c3` (`1.1.1`) | `docs/specs/requirements.md`, `docs/specs/dsl-grammar.md`, README and examples |
| `mako10k/perttool` | `ddb12dc97e8be34965654c84f01bc330a4a2e5cf` (`0.9.1` working tree base) | `docs/requirements.md`, grammar and minimal example |
| `mako10k/semdl` | `4d9288ee25d530b756b8eeec44f2360e9c90a304` | requirements, `.ssd` EBNF, examples, architecture ADRs |
| `mako10k/stdl` | `0e69648fb14e2055f3c5c392f9bad554133c939d` | STDL specification, README-as-STDL, and examples |

`perttool` had unrelated uncommitted work; none of it was modified. Its
inspected requirements and grammar files were not among the dirty paths.

## llmthink

Useful concepts:

- explicit roles for premise, evidence, inference, decision, and pending;
- stable identifier references;
- source spans on parser nodes;
- audit results that distinguish source data from filtered presentation;
- resource-first CLI organization and provider-neutral shared core.

Boundary conclusion:

- `llmthink` explicitly owns thought structure and inference. Therefore
  `llmrecog` must not add premise, hypothesis, inference, comparison,
  conclusion, decision, or framework enforcement as recognition roles.
- Current `llmthink` evidence resources can locate a file, URL, or blob but do
  not provide a typed `recog` target reference. Typed integration is therefore
  a proposed additive contract, not a claim about the current implementation.
- Plain `llmthink` premise/evidence must remain valid when no recognition
  artifact exists.

## perttool

Useful concepts:

- a text document as local source of truth;
- deterministic shared-core analysis;
- stable JSON contracts and typed reason codes;
- thin CLI/adapters;
- explicit separation of feasible, selected, and recommended state;
- derived explanations that do not replace source facts.

Boundary conclusion:

- `perttool` owns realization and project control. `llmrecog` must not create
  tasks from intents or treat a deadline mention as an accepted schedule.
- The distinction between source facts and deterministic derived explanation
  is reusable for CSP propagation, while recommendation and authority models
  are not.

## SEMDL

Useful concepts:

- source resources and selectors rather than URL-only provenance;
- source-visible semantic assertions;
- human-readable, machine-verifiable text;
- separation of a core library, CLI adapter, and external golden runner;
- explicit read/write paths and deterministic normalization.

Concepts deliberately not inherited:

- SEMDL hypotheses, alternative hypotheses, inference provenance, embeddings,
  similarity search, mutation commands, and sidecar profile are wider than the
  first `llmrecog` boundary.
- SEMDL confidence-chain evaluation risks mixing producer assessment with
  semantic viability; `llmrecog` keeps confidence non-normative.
- The `.ssd` generic field grammar is useful prior art but does not define the
  stricter variable/candidate/constraint semantics needed here.

## STDL

Useful concepts:

- controlled, line-oriented blocks with stable IDs;
- explicit entities, typed relations, sources, context, and evidence;
- deterministic parsing, formatting, querying, and audit;
- natural-language text as explanation rather than the machine structure.

Concepts deliberately not inherited:

- ontology definition, external vocabulary mapping, `reason`, hypothesis
  claims, confidence categories, and contextual semantic-relation reasoning
  would make `llmrecog` a broader knowledge/reasoning language.
- STDL `fact` and `hypothesis` claim kinds do not express the required
  distinction between “the source says X” and “X is true.”
- `same_as` is retained only as a grounded ambiguity/coreference constraint,
  not as a general ontology identity assertion.

## Resulting design rule

Borrow source selectors and controlled structure from SEMDL/STDL, deterministic
core and explanation contracts from perttool, and reference discipline from
llmthink. Keep every feature only if it answers “what meaning does this input
support?” without answering “what follows?” or “what should be done?”
