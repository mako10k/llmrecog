# Provenance and explainability

## 1. Goal

For every semantic output, a user must be able to ask:

- Which source content supported this?
- Which interpretation or normalization step was applied?
- Why is this candidate still viable?
- Why was it excluded?
- Why is the result unknown?
- Did the tool stop because of scope or resource limits?

The answer is a deterministic data projection. It is not an LLM-generated
rationale or hidden chain-of-thought.

## 2. Provenance edge types

The initial explanation graph uses a small closed vocabulary.

| Edge | From -> to | Meaning |
| --- | --- | --- |
| `selected_by` | span -> source | The selector identifies source content |
| `observed_in` | observation -> span | Surface occurrence was captured there |
| `grounded_in` | semantic record -> span/observation | The declaration is traceable to input |
| `normalized_by` | record -> normalization rule | Canonical value preserves cited meaning |
| `supports` | support record -> semantic record/candidate/constraint | Positive source support of the declared role |
| `applies` | derivation -> constraint | Named constraint was evaluated |
| `depends_on` | derivation -> derivation/candidate state | Result used an earlier mechanical result |
| `yields` | derivation -> viability/result | Mechanical outcome of propagation |

No edge type means `proves_true_in_world`.

## 3. Source identity

A source record should carry both:

- a locator for humans and resolvers; and
- a `sha256` digest when exact reproducibility matters.

Without a digest, a span can still be useful, but audit reports it as
`unsealed_source`. Explicit local verification keeps such a source
`unverified` even if current selectors match. A quote mismatch or digest
mismatch is an error and never triggers automatic span repair.

Relative locators resolve against the `.recog` file and, for the Phase 5 local
profile, must remain within the caller-supplied verification root. The profile
rejects symlinks, non-regular files, over-limit bytes, invalid UTF-8, bare CR,
out-of-range selectors, and exact quote mismatches. Remote locators remain
data; normal validation, explanation, and every non-validation route perform
no locator I/O.

Local verification is a bounded point-in-time observation. A matching digest
identifies bytes actually read; it does not certify the source's truth or
promise that the path remains unchanged after the check.

## 4. Support

Every positive support record states:

- target ID;
- support kind: `explicit`, `linguistic`, `normalized`, or `ambiguous`;
- one or more grounding references;
- optional producer confidence;
- optional producer identity.

The support kind is descriptive, not ordinal. `explicit` is not automatically
more correct than `normalized`; `ambiguous` is not automatically rejected.

Producer confidence is displayed but not propagated. A future confidence
policy must be a separate consumer-side policy and cannot change the core
meaning of source support or viability.

## 5. Normalization trace

A normalized record must show:

- the exact surface form or prior grounded record;
- canonical output;
- stable rule ID and rule version;
- every context anchor used;
- any unresolved context that prevents stronger normalization.

Example:

```text
surface: "来週"
canonical: next_week
rule: temporal.relative-week.symbolic.v1
exact_interval: unknown
reason: missing_source_date, missing_timezone
```

The core must not use the command execution date to fill the missing anchors.

## 6. Derivation records

Constraint propagation emits public derivation records independent of solver
implementation. Each record contains:

- stable result-local derivation ID;
- semantic version;
- requested scope;
- applied constraint ID and kind;
- input literal states or prior derivation IDs;
- output candidate/result state;
- public reason code;
- completion and truncation status.

Example reason chain:

```text
D1 selected C_ACTOR_TANAKA
  because K_ACTOR_ONE_OF contains only that viable candidate
D2 excluded C_COMMITMENT_WEAK
  because K_TANAKA_NOT_WEAK excludes
          C_ACTOR_TANAKA + C_COMMITMENT_WEAK
  depends_on D1
```

This chain explains constraint application. It does not claim why a human
speaker chose the wording or expose an LLM's private reasoning.

The complete contract-0.1 constraint reason vocabulary is:

- `RCG-RSN-201`: one grounded `one_of` member remains;
- `RCG-RSN-202`: an `excludes` pair is selected together;
- `RCG-RSN-203`: a selected antecedent lacks its required consequent;
- `RCG-RSN-204`: known `same_as` values mismatch;
- `RCG-RSN-205`: known `distinct_from` values collide;
- `RCG-RSN-206`: no satisfying target-bearing witness remains.

Open/unbound relational operands produce typed unknown reasons and no
fabricated constraint derivation.

## 7. Explain projections

### 7.1 Semantic record

`recognition explain <id>` returns:

- typed semantic value;
- source and spans;
- support kind and support state;
- normalization trace if any;
- producer metadata if any;
- alternatives/variable membership if any;
- audit findings that directly affect the record.

### 7.2 Candidate

Candidate explanation additionally returns:

- parent variable and domain closure;
- positive source support separately from viability;
- one satisfying witness for `allowed`, when bounded and available;
- minimal public reason chain for `excluded`;
- all applicable unknown reasons for `unknown`;
- relevant constraints considered and constraints skipped as out of scope;
- query scope, limit, semantic version, and truncation.

### 7.3 Constraint

Constraint explanation returns:

- normalized operands;
- source grounding for the relationship itself;
- support kind;
- validation status;
- affected candidates in the requested scope;
- derivations that used it.

## 8. Explain guarantees

- No exclusion is reported without at least one named grounded constraint.
- No `allowed` result is reported without a represented satisfying witness.
- No `unknown` result is presented without one or more reason codes.
- Explanation order is deterministic.
- Human and JSON output convey the same facts.
- A limit or missing source is visible; partial evidence is never presented as
  complete.
- Explain does not mutate the document, source, cache authority, or downstream
  project.

## 9. Audit rules

The versioned machine authority for diagnostics and public derivation reasons
is [`contracts/diagnostics-v1.json`](../contracts/diagnostics-v1.json). The
following table is a focused audit summary.

Initial audit categories include:

| Code | Default severity | Meaning |
| --- | --- | --- |
| `RCG-GROUND-001` | error | Semantic declaration has no provenance path |
| `RCG-GROUND-002` | error | Excluding constraint lacks relationship grounding |
| `RCG-GROUND-003` | warning | Source is locatable but not digest-sealed |
| `RCG-SUPPORT-001` | warning | Candidate/record lacks positive support |
| `RCG-BOUNDARY-001` | error | Forbidden reasoning or decision role is declared |
| `RCG-BOUNDARY-002` | error | A downstream inference artifact is promoted as original-source fact |
| `RCG-OPEN-001` | warning | Exhaustiveness is assumed without grounded closure |
| `RCG-CSP-001` | error | Closed domain has no satisfying assignment |
| `RCG-CSP-002` | warning | Source-supported candidate is constraint-excluded |
| `RCG-NORM-001` | error | Normalization lacks a rule or required grounded anchor |
| `RCG-CONF-001` | error | Producer confidence is used as a semantic weight or exclusion rule |

Audit findings report risks in the recognition artifact. They do not invent a
corrected interpretation.
