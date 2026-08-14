# Design index

This directory is the design and implementation-contract authority.

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
| [cli-contract.md](cli-contract.md) | Accepted Phase 2/3 routes and Phase 4 private command contracts |
| [integration-llmthink.md](integration-llmthink.md) | Optional one-way reasoning integration |
| [llmthink-grounding-audit.md](llmthink-grounding-audit.md) | Optional recognition-aware premise/evidence audit |
| [examples/boundary-cases.md](examples/boundary-cases.md) | Required boundary examples |
| [implementation-phases.md](implementation-phases.md) | Small implementation phases after design acceptance |
| [phase-2-acceptance.md](phase-2-acceptance.md) | Exact candidate evidence and Phase 2 acceptance boundary |
| [phase-3-acceptance.md](phase-3-acceptance.md) | Exact candidate evidence and Phase 3 acceptance boundary |
| [../plans/initial-roadmap.pert](../plans/initial-roadmap.pert) | Original coarse roadmap and Phase 0/1 history |
| [../plans/phase-2-parse-validate-show.pert](../plans/phase-2-parse-validate-show.pert) | Detailed perttool plan for the separately gated Phase 2 vertical slice |
| [../plans/phase-3-explainable-csp.pert](../plans/phase-3-explainable-csp.pert) | Detailed dogfood-first plan for the separately gated Phase 3 explainable CSP slice |
| [../plans/phase-4-complete-core.pert](../plans/phase-4-complete-core.pert) | Detailed dogfood-first plan for the separately gated Phase 4 complete semantic core |
| [../plans/dogfooding-roadmap.pert](../plans/dogfooding-roadmap.pert) | Current point-based phase-selection roadmap with dogfood/replan gates |
| [design-review.md](design-review.md) | Contradiction, overlap, and overdesign review |
| [reference-review.md](reference-review.md) | Concepts evaluated from related projects |
| [development.md](development.md) | Maintainer setup and executable checks |
| [process/development-method.md](process/development-method.md) | Specification-first, fixture-first change workflow |
| [process/dogfooding.md](process/dogfooding.md) | Dogfood modes, corpus order, feedback receipts, and replan gates |
| [../dogfood/README.md](../dogfood/README.md) | Internal versioned dogfood protocol and evidence layout |
| [adr/](adr/) | Accepted design decisions |
| [../contracts/](../contracts/) | Versioned EBNF and diagnostic/reason registry |
| [../schemas/](../schemas/) | Versioned AST, semantic, validation, show, explain, audit, query, and materialization JSON Schemas |

Normative priority, if two documents disagree:

1. Accepted ADRs for the decision they cover.
2. `requirements.md` and `terminology.md`.
3. Focused semantic, provenance, DSL, CLI, and integration documents.
4. Examples and implementation phases.

The text DSL, Phase 1 schemas, diagnostics, and fixtures are frozen by ADR
0006. ADR 0007 additionally freezes the Phase 2 validate/show routes,
DocumentResult and RecognitionResult schemas, and exact Phase 2 fixture
expectations. ADR 0008 freezes the private Phase 3 explain and focused base
audit routes. Later CLI routes remain provisional. Examples clarify intent but
do not silently extend the grammar.
ADR 0009 supersedes only the successful explain result version and typed
target-content shape, requiring `Llmrecog.ExplainResult.v2` before the
remaining Phase 3 implementation.
ADR 0010 accepts all five contract-0.1 constraint semantics plus the private
bounded query and materialization contracts. The relational explain/audit
slice implements the five constraint meanings; the accepted `space` schemas
and fixtures do not claim that either route exists.
ADR 0011 corrects the relational ExplainResult v2 text golden to the existing
complete deterministic projection without changing its JSON or semantic
contract.
