# llmrecog

`llmrecog` is a source-bounded semantic recognition DSL and local-first tool.
It records what an input supports without turning that recognition into a new
hypothesis, conclusion, decision, or execution plan.

```text
unstructured or weakly structured input
                  |
                  v
        source-grounded recognition
                  |
                  v
       structured semantic state
```

The project has a design baseline and a frozen executable contract for text
profile `0.1`. No parser, solver, formatter, or CLI is implemented yet. The
source extension is `.recog`; no public package or compatibility release has
been made.

## Product boundary

The three related projects have intentionally different responsibilities.

| Layer | Primary question | Owns | Does not own |
| --- | --- | --- | --- |
| `llmrecog` | What does the input support as meaning? | entities, relations, properties, intent, normalization, ambiguity, provenance, source-bounded constraints | hypotheses, deliberative inference, conclusions, decisions |
| `llmthink` | What follows from what we know? | premises, evidence, alternatives, inference, comparison, conclusions, decisions, pending questions | claiming that an inferred result was present in the original input |
| `perttool` | How is an accepted decision realized? | milestones, tasks, dependencies, resources, estimates, acceptance, execution state | recognizing source meaning or deciding what follows from it |

The intended flow is:

```text
original source
  -> llmrecog recognition
  -> llmthink premise/evidence
  -> llmthink inference/decision
  -> perttool milestone/task/execution state
```

The arrows carry provenance. They do not grant permission to write results
back into an earlier layer.

## Core principles

- **Source bounded:** a semantic record must stay within what its cited input
  supports. A false statement can be recognized as a statement made by the
  source; it is not thereby certified as a world fact.
- **Ambiguity preserving:** do not pick one reading merely to simplify output.
- **Factorized possibility space:** represent ambiguity as variables,
  candidates, and constraints rather than eagerly enumerating interpretation
  worlds.
- **Open world:** absence is neither negation nor support. Unknown is a valid
  result.
- **Two-axis candidate state:** source support and constraint viability are
  separate. A candidate can be source-supported yet inconsistent, or solver-
  viable without positive source support.
- **Explainable propagation:** every exclusion must have a source-grounded
  constraint and a deterministic reason chain.
- **Provider-neutral core:** LLMs may produce draft recognitions, but parsing,
  validation, bounded constraint propagation, query, materialization, and
  explanation are deterministic core operations.
- **Local-first and diff-friendly:** text artifacts are the source-controlled
  authority; no server, model provider, or database is required to inspect or
  validate them.

## Design documents

- [Requirements](docs/requirements.md)
- [Terminology](docs/terminology.md)
- [Architecture and responsibility boundary](docs/architecture.md)
- [Non-goals](docs/non-goals.md)
- [Semantic model and ambiguity semantics](docs/semantic-model.md)
- [Provenance and explainability](docs/provenance-and-explainability.md)
- [DSL contract 0.1](docs/dsl.md)
- [Normative EBNF and recovery contract](docs/grammar.md)
- [Canonical formatting](docs/canonical-formatting.md)
- [Diagnostics and reason codes](docs/diagnostics.md)
- [JSON Schemas](schemas/)
- [Contract fixture manifest](test/fixtures/contracts/v0.1/manifest.json)
- [CLI contract](docs/cli-contract.md)
- [llmthink integration](docs/integration-llmthink.md)
- [Recognition-aware llmthink grounding audit](docs/llmthink-grounding-audit.md)
- [Boundary cases](docs/examples/boundary-cases.md)
- [Phased implementation proposal](docs/implementation-phases.md)
- [Design self-review](docs/design-review.md)
- [Prior-art review](docs/reference-review.md)
- [Development setup](docs/development.md)
- [Development method](docs/process/development-method.md)
- [Architecture decisions](docs/adr/README.md)

## Initial scope lock

The next implementation, once separately accepted, is limited to a text-only
parse/validate/show vertical slice for one `.recog` document. The first CSP
slice follows separately with `one_of`, `excludes`, and one candidate
explanation; the remaining three constraint kinds follow only after that
behavior is accepted. LLM extraction, llmthink changes, sidecars, embeddings,
ontologies, editor integrations, and writes to external systems remain outside
the first slice.

## Development

The initialized repository uses Node.js 22 or later, npm, strict TypeScript,
ESM, the Node.js test runner, ESLint, and Prettier. The package is private
`0.0.0`, has no CLI binary, and has no production dependencies.

```sh
npm ci
npm run check
git diff --check
```

See [Developing llmrecog](docs/development.md) and the repository-wide
[guidelines](AGENTS.md). The executable contract tests validate schemas,
goldens, diagnostics, EBNF coverage, and boundary fixtures; they do not
implement parser or solver behavior.
