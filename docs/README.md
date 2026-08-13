# Design index

This directory is the design authority for the pre-implementation phase.

| Document | Authority |
| --- | --- |
| [requirements.md](requirements.md) | Product and semantic requirements |
| [terminology.md](terminology.md) | Normative vocabulary |
| [architecture.md](architecture.md) | Component and product responsibility boundaries |
| [non-goals.md](non-goals.md) | Explicitly excluded responsibilities |
| [semantic-model.md](semantic-model.md) | Records, state axes, constraints, and materialization semantics |
| [provenance-and-explainability.md](provenance-and-explainability.md) | Grounding, derivations, and `explain` contract |
| [dsl.md](dsl.md) | Frozen `.recog` text contract 0.1 |
| [grammar.md](grammar.md) | Normative scanner, EBNF, semantic-shape, and recovery contract |
| [canonical-formatting.md](canonical-formatting.md) | Deterministic semantic rendering contract |
| [diagnostics.md](diagnostics.md) | Stable diagnostic and derivation reason-code contract |
| [cli-contract.md](cli-contract.md) | Provisional command and result contracts |
| [integration-llmthink.md](integration-llmthink.md) | Optional one-way reasoning integration |
| [llmthink-grounding-audit.md](llmthink-grounding-audit.md) | Optional recognition-aware premise/evidence audit |
| [examples/boundary-cases.md](examples/boundary-cases.md) | Required boundary examples |
| [implementation-phases.md](implementation-phases.md) | Small implementation phases after design acceptance |
| [../plans/initial-roadmap.pert](../plans/initial-roadmap.pert) | Coarse perttool roadmap and current execution frontier |
| [design-review.md](design-review.md) | Contradiction, overlap, and overdesign review |
| [reference-review.md](reference-review.md) | Concepts evaluated from related projects |
| [development.md](development.md) | Maintainer setup and executable checks |
| [process/development-method.md](process/development-method.md) | Specification-first, fixture-first change workflow |
| [adr/](adr/) | Accepted design decisions |
| [../contracts/](../contracts/) | Versioned EBNF and diagnostic/reason registry |
| [../schemas/](../schemas/) | Versioned AST, semantic, validation, and explain JSON Schemas |

Normative priority, if two documents disagree:

1. Accepted ADRs for the decision they cover.
2. `requirements.md` and `terminology.md`.
3. Focused semantic, provenance, DSL, CLI, and integration documents.
4. Examples and implementation phases.

The text DSL, schemas, diagnostics, and Phase 1 fixtures are frozen by ADR
0006. CLI routes beyond the linked ValidationResult and ExplainResult schemas
remain provisional. Examples clarify intent but do not silently extend the
grammar.
