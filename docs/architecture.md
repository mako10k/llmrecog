# Architecture and responsibility boundary

## 1. System role

`llmrecog` is the recognition layer in a three-layer family.

| Concern | llmrecog: Recognize | llmthink: Think / Infer | perttool: Realize / Execute |
| --- | --- | --- | --- |
| Governing question | What meaning does the input support? | What follows from what is known? | How is an accepted decision realized? |
| Authoritative input | Bounded source artifacts | Premises, evidence, recognitions, reasoning records | Accepted goals, decisions, and project facts |
| Primary output | Structured semantic state and possibility space | Inferences, comparisons, conclusions, decisions, pending items | Milestones, tasks, dependencies, schedules, acceptance and work state |
| Ambiguity | Preserves and factorizes it | May reason across or narrow it explicitly | Requires planning inputs explicit enough to execute |
| Unknown | First-class recognition result | A premise gap or pending question | A planning gap or blocked condition when relevant |
| Mechanical derivation | Constraint viability only | Thought/audit structure and explicit inference | PERT/CPM, resource and control-plane analysis |
| Forbidden promotion | Inference as source fact | Decision as original recognition | Execution state as source meaning |

## 2. Boundary test

Every proposed feature or record is evaluated in this order:

1. Is the meaning positively supported by cited input?
2. Does it describe the source-supported meaning space, or select a conclusion
   from that space?
3. Can `explain` identify a source span, normalization, or grounded constraint
   for the result?
4. Does it preserve the difference among support, viability, and unknown?
5. Does it avoid unnecessary world enumeration?

If step 1 is no and a new proposition is being produced, the feature belongs
to `llmthink`. If it turns an accepted result into work structure or execution
state, it belongs to `perttool`.

## 3. Data authorities

```text
source artifact(s)                 external authority for presented content
       |
       v
.recog document                    authority for recorded recognition state
       |
       +--> validation/audit       derived, reproducible report
       +--> viability/reasons      derived, scope-bound solver projection
       +--> materialization        derived, bounded interpretation projection
       |
       v
typed reference in llmthink        reasoning provenance, not recognition copy
       |
       v
decision referenced by perttool    realization input, not source recognition
```

Derived reports and materialized worlds are not written into `.recog` by
default. A cache may be added later, but it can never become semantic
authority.

## 4. Component model

```text
                      optional future producer adapters
                    +-------------------------------+
source bytes ------> | LLM / parser / import producer | -- draft .recog
                    +-------------------------------+
                                      |
                                      v
 .recog text --> parser --> semantic model --> validator
                                      |              |
                                      v              v
                            constraint engine      audit rules
                                      |              |
                                      +------v-------+
                                             |
                                      explanation graph
                                      /       |       \
                                  query    materialize  show
                                      \       |       /
                                           CLI
                                             |
                               JSON / text / future adapters
```

### 4.1 Parser and semantic model

Owns syntax, stable IDs, source spans in the `.recog` document, normalized AST,
and typed records. It performs no source interpretation and no provider calls.

### 4.2 Validator

Owns grammar, field, type, identifier, reference, constraint-shape, and local
semantic invariants. It does not decide whether a producer's interpretation is
good; audit reports grounding risks separately.

### 4.3 Constraint engine

Owns only the five initial constraint meanings and bounded candidate viability.
It consumes validated records and emits derived assignments, exclusions,
unknowns, and reason edges. It cannot create entities, candidates,
recognitions, premises, or conclusions.

### 4.4 Explanation graph

Combines immutable source-grounding edges with deterministic normalization and
constraint-derivation edges. It is structured data first; human prose is a
projection. It does not expose model chain-of-thought.

### 4.5 Query and materialization

Read-only projections over the semantic model and solver results. Query does
not mutate, enrich, rank, or call an LLM. Materialization requires explicit
scope and limit.

### 4.6 CLI

A thin adapter for file resolution, arguments, output, exit status, and
optional local source verification. It does not reimplement core semantics.

### 4.7 Producer adapters

Future, non-core components may use an LLM, deterministic extractor, or import
format to create a draft `.recog` document. The artifact becomes usable only
after normal validation and audit. A producer adapter cannot bypass provenance
requirements or redefine core support/constraint semantics.

### 4.8 llmthink bridge

A future optional adapter can resolve a typed recognition reference and
provide a lossless projection to `llmthink`. It depends on the llmrecog core;
the core does not depend on the llmthink parser or store.

## 5. Dependency rules

- Parser and model depend on no CLI, provider, solver backend, or related
  project.
- Validator depends on the model and closed semantic registries.
- Constraint engine depends on validated model types only.
- Explanation depends on model provenance plus solver reason records.
- CLI depends on core services and presentation registries.
- Producer and integration adapters depend inward on public core contracts.
- No dependency points from the core to an LLM SDK, `llmthink`, `perttool`,
  MCP, LSP, or VSIX.

## 6. Recognition producer boundary

Recognition generation and recognition semantics are distinct:

- A producer may be nondeterministic and may attach producer confidence.
- The committed `.recog` bytes are the recognition input to the deterministic
  core.
- Validation decides structural validity.
- Audit decides whether required grounding and safety invariants are present.
- Neither step declares the source content objectively true.

Changing a model or prompt can change a draft artifact, but cannot change what
`one_of`, `unknown`, or `excluded` means.

## 7. Source verification boundary

The `.recog` artifact carries locators, spans, quotes, and optional digests.
Core semantics can be inspected offline from those records. Reading a locator
to verify current bytes is a separate, read-only operation because sources may
be unavailable, remote, sensitive, or mutable.

The initial CLI distinguishes:

- structural validity of the `.recog` document;
- internal provenance completeness;
- optional verification that a local source and its selector still match.

Failure to perform live verification is reported as unverified, never
rewritten as disproven.

## 8. No reverse authority

No automatic edge exists from `llmthink` or `perttool` back into `.recog`.
An explicit re-recognition request may submit additional artifacts as sources,
but it creates a new recognition version and preserves the downstream
artifact's role. Recognizing that “thought T concluded X” is not the same as
recognizing X in the original source.
