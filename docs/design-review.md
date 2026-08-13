# Design self-review

- Review date: 2026-08-13
- Scope: design artifacts only
- Result: no blocking responsibility contradiction found; several boundaries
  were tightened before implementation.

## 1. Review against the six governing questions

### Is every llmrecog result supported by input?

Yes for source-of-truth semantic declarations. Every record and constraint has
a provenance path. Solver viability is explicitly derived and cannot be cited
as direct source support. Producer confidence is not grounding.

### Does the model describe a meaning space rather than choose a conclusion?

Yes. Variables/candidates/constraints describe the space; materialization is a
bounded view. No preference, score, ranking, or selected-world persistence
exists. Choice and inference remain in llmthink.

### Can `explain` answer why?

Yes at the contract level. Positive recognitions show source/support;
normalizations show rules and anchors; allowed candidates show witnesses;
excluded candidates show grounded constraint chains; unknown results show
typed reasons and limits.

### Is unknown kept distinct from false or possible?

Yes. The design has independent support and viability axes. `unknown` is used
for unbounded determination and carries reason codes. It is neither a negative
fact nor a satisfying witness.

### Are complete worlds avoided by default?

Yes. The source document stores the factorized possibility graph.
Materialization is read-only, lazy, query-scoped, and requires a limit.

### Has CSP processing become general reasoning?

No. The vocabulary is closed to five unweighted forms; there are no arbitrary
expressions, negation-as-failure, objectives, or generated propositions.
Propagation emits viability and reason data only.

## 2. Findings and corrections

### Finding A: “supported,” “allowed,” and “unknown” could collapse

Risk:

- A candidate not ruled out might be mislabeled as source-supported.
- An open or incomplete result might be mislabeled possible.

Correction:

- Separate source `support` from solver `viability`.
- Define `allowed` as having a represented satisfying witness.
- Define `unknown` by explicit incompleteness reasons.
- Preserve combinations such as `supported + excluded` and
  `unsupported + allowed`.

### Finding B: a generic recognition wrapper would duplicate typed records

Risk:

- `recognition -> entity -> candidate` wrappers would add IDs and references
  without semantic value.

Correction:

- Keep Recognition as the umbrella type; `entity`, `record`, `variable`,
  `candidate`, and `constraint` are directly referenceable recognition
  records.

### Finding C: observation could duplicate source span

Risk:

- Requiring an observation between every span and semantic record would make
  simple artifacts noisy.

Correction:

- Make observation optional and useful only when preserving/grouping a
  surface occurrence. Direct grounding in a span remains valid.

### Finding D: normalization could smuggle external context

Risk:

- “next week” could silently use execution time or locale.

Correction:

- Require a named deterministic rule and all anchors.
- Allow symbolic `next_week` without pretending an exact interval is known.
- Report missing date/time-zone anchors as unknown.

### Finding E: confidence could become probability or solver weight

Risk:

- Model confidence might decide a candidate or propagate as pseudo-probability.

Correction:

- Make confidence optional producer metadata only.
- Add an audit error when it is used as a constraint weight or exclusion rule.
- Materialization never sorts by confidence.

### Finding F: constraints could become llmthink inference rules

Risk:

- `requires` and identity constraints could grow into a general theorem
  language.

Correction:

- Close the v0.1 vocabulary to five forms and typed operands.
- Require relationship-level source grounding.
- Restrict output to assignment viability and explanation.

### Finding G: “fact” could be confused with world truth

Risk:

- Explicitly stated but false or quoted source content might be exported as an
  objective fact.

Correction:

- Avoid a first-class `fact` declaration kind.
- Preserve source/speaker, modality, polarity, and reported-content context.
- Define grounding as support from a source, not truth certification.

### Finding H: llmthink integration could be specified as if already present

Risk:

- Current llmthink has file resources but no typed `.recog#ID` resolver.

Correction:

- Document current file-level compatibility separately.
- Make `RecognitionReference.v1` and proposed syntax future additive work in
  the llmthink repository.
- Keep plain premises/evidence valid.

### Finding I: reverse recognition could erase inference provenance

Risk:

- Re-reading a llmthink conclusion as source could make it appear in the
  original input.

Correction:

- Prohibit automatic writes and promotion.
- Permit only an explicit re-recognition run with new version lineage.
- When the downstream artifact is itself a source, recognize “artifact says
  C” and retain its downstream role.

### Finding J: open variables could be classified as evidence or non-evidence too coarsely

Risk:

- Treating every open variable as unusable would discard valid evidence of
  uncertainty and supported candidates.
- Treating every individually allowed candidate as evidence would accept
  unsupported or jointly impossible premise bindings.

Correction:

- Define grounding capability as a relation among a recognition projection, a
  machine-readable llmthink claim pattern, and a frozen solver scope.
- Audit source support, joint CSP compatibility, closure, and completeness on
  separate axes.
- Require a joint witness for multi-variable bindings.
- Let open state ground uncertainty-qualified claims while rejecting premature
  narrowing and false exhaustiveness.
- Do not infer claim patterns from natural-language premise text inside the
  deterministic audit path.

## 3. Responsibility overlap review

| Candidate feature | Decision | Reason |
| --- | --- | --- |
| entity/relation/property extraction | Keep in llmrecog | Source meaning |
| ambiguity variables and grounded filtering | Keep in llmrecog | Compact meaning-space description |
| hypothesis generation | Keep out; llmthink | New proposition |
| interpretation ranking or selection | Keep out; llmthink | Conclusion/choice |
| conclusion-to-task conversion | Keep out; llmthink + perttool boundary | Decision and realization |
| embeddings and semantic search | Defer | Not required for recognition semantics |
| ontology/import language | Defer | STDL-like scope expansion without first-slice need |
| sidecar format | Defer | SEMDL-like complexity without demonstrated need |
| typed llmthink reference | Future optional integration | Valuable provenance, but cross-repository contract |

No first-class `hypothesis`, `inference`, `conclusion`, `decision`, task, or
execution declaration remains in the DSL.

## 4. Overdesign review

The design intentionally avoids:

- a general CSP/query language;
- world persistence;
- source mutation commands;
- provider APIs in the first slice;
- sidecars, embeddings, ontologies, and remote resolution;
- cross-repository implementation before the core contract is proven.

The source model still includes observation, normalization, and producer
metadata, but each is optional. They do not enlarge the first executable
vertical slice beyond text spans and a named normalization field.

## 5. Contract decisions resolved after the design review

ADR 0006 and the Phase 1 contract artifacts resolve the complete EBNF, parser
recovery, JSON result shapes, raw-byte digest identity, Unicode coordinates,
and canonical semantic rendering. They deliberately do not introduce a
formatter command.

The default solver/explain limit, the concrete local-source adapter boundary,
and exact llmthink syntax remain separately owned later decisions. None changes
the selected responsibility boundary.

The implementation language/runtime question was resolved after this review by
[ADR 0005](adr/0005-node-22-typescript-esm-development-baseline.md): Node.js
22+, npm, strict TypeScript, and ESM. That initialization decision does not
accept a parser, solver, CLI, or provider implementation.

## 6. Final design judgment

The proposed model is internally consistent if implementation preserves three
locks:

1. source support and CSP viability remain separate;
2. only source-grounded constraints can reduce the possibility space;
3. derived narrowing never becomes source recognition or automatic downstream
   execution.

The smallest safe next step is contract fixtures and complete grammar/schema
work, followed by parse/validate only. A solver, LLM producer, or llmthink
bridge should not be the first implementation task.
