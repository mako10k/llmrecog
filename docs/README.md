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
| [cli-contract.md](cli-contract.md) | Accepted Phase 2 routes and provisional later command contracts |
| [integration-llmthink.md](integration-llmthink.md) | Optional one-way reasoning integration |
| [llmthink-grounding-audit.md](llmthink-grounding-audit.md) | Optional recognition-aware premise/evidence audit |
| [examples/boundary-cases.md](examples/boundary-cases.md) | Required boundary examples |
| [implementation-phases.md](implementation-phases.md) | Small implementation phases after design acceptance |
| [../plans/initial-roadmap.pert](../plans/initial-roadmap.pert) | Original coarse roadmap and Phase 0/1 history |
| [../plans/phase-2-parse-validate-show.pert](../plans/phase-2-parse-validate-show.pert) | Detailed perttool plan for the separately gated Phase 2 vertical slice |
| [../plans/dogfooding-roadmap.pert](../plans/dogfooding-roadmap.pert) | Current point-based phase-selection roadmap with dogfood/replan gates |
| [design-review.md](design-review.md) | Contradiction, overlap, and overdesign review |
| [reference-review.md](reference-review.md) | Concepts evaluated from related projects |
| [development.md](development.md) | Maintainer setup and executable checks |
| [process/development-method.md](process/development-method.md) | Specification-first, fixture-first change workflow |
| [process/dogfooding.md](process/dogfooding.md) | Dogfood modes, corpus order, feedback receipts, and replan gates |
| [../dogfood/README.md](../dogfood/README.md) | Internal versioned dogfood protocol and evidence layout |
| [adr/](adr/) | Accepted design decisions |
| [../contracts/](../contracts/) | Versioned EBNF and diagnostic/reason registry |
| [../schemas/](../schemas/) | Versioned AST, semantic, validation, and explain JSON Schemas |

Normative priority, if two documents disagree:

1. Accepted ADRs for the decision they cover.
2. `requirements.md` and `terminology.md`.
3. Focused semantic, provenance, DSL, CLI, and integration documents.
4. Examples and implementation phases.

The text DSL, Phase 1 schemas, diagnostics, and fixtures are frozen by ADR
0006. ADR 0007 additionally freezes the Phase 2 validate/show routes,
DocumentResult and RecognitionResult schemas, and exact Phase 2 fixture
expectations. Later CLI routes remain provisional. Examples clarify intent but
do not silently extend the grammar.
