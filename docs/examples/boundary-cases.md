# Boundary cases

Each case applies the same test: recognize only the meaning supported by the
cited input; move any new proposition to `llmthink`.

## 1. Explicitly stated content

Input:

```text
deployment status=failed
```

Valid recognition:

```text
entity: deployment occurrence
property: status = failed
support: explicit
```

Not valid in llmrecog:

```text
service_is_unavailable = true
root_cause = bad_configuration
```

The log states a status. Availability and cause require additional source
content or reasoning.

## 2. Linguistically normalizable meaning

Input:

```text
来週までには対応したい
```

Valid recognition:

```text
intent = desire
deadline_symbol = next_week
support = linguistic / normalized
```

Still unknown:

```text
exact_deadline_interval
commitment_strength, unless represented as multiple candidates
completion_probability
```

The current clock must not be used silently. An exact date interval requires a
source-grounded reference date, calendar rule, and time zone. “Want to” does
not automatically become a promise or an accepted schedule.

## 3. Multiple plausible interpretations

Input:

```text
田中は佐藤に、彼が来週までには対応したいと伝えた。
```

Valid factorized recognition:

```text
V_ACTOR = { E_TANAKA, E_SATO }
C_ACTOR_TANAKA support ambiguous
C_ACTOR_SATO   support ambiguous
one_of(V_ACTOR, [C_ACTOR_TANAKA, C_ACTOR_SATO])
```

Invalid simplification:

```text
actor = E_TANAKA  # chosen only because it appears first
```

No complete interpretation worlds need to be persisted merely to preserve
this ambiguity.

## 4. Unknown

Input:

```text
対応する予定です。
```

Valid recognition:

```text
intent/modality = planned
actor = unknown
deadline = unknown
```

There is no `actor = false`, no `deadline = none`, and no automatically added
`unspecified` candidate. The variable may be open with
`no_declared_candidate`; `explain` reports why it is unknown.

## 5. Explicitly prohibited combination

Input:

```text
担当は田中か佐藤のどちらか一人。田中が担当する場合、弱い約束ではない。
```

Valid constraints:

```text
one_of(V_ACTOR, [C_TANAKA, C_SATO])
one_of(V_COMMITMENT, [C_DESIRE, C_WEAK])
excludes(C_TANAKA, C_WEAK)
```

The `excludes` relation has its own grounding in the second sentence. Merely
mentioning Tanaka and weak commitment elsewhere would not justify it.

## 6. Candidate excluded by propagation

Additional input:

```text
この件の担当は田中である。
```

Add the grounded closure:

```text
one_of(V_ACTOR, [C_TANAKA])
```

Then `C_WEAK` is excluded in the relevant scope:

```text
C_TANAKA selected in every represented world
  -> excludes(C_TANAKA, C_WEAK) applies
  -> no satisfying witness contains C_WEAK
```

`explain C_WEAK` must cite both grounded constraints and this mechanical
chain. The result is a viability exclusion, not a new recognition that “the
speaker made a strong commitment.” That positive proposition would require
source support or llmthink reasoning.

## 7. Supported but excluded conflict

Suppose another source span explicitly says:

```text
これは弱い約束である。
```

`C_WEAK` now has positive explicit support but remains excluded by the earlier
constraint set. The correct result is:

```text
support = supported
viability = excluded
audit = RCG-CSP-002 supported_but_excluded
```

The tool must not lower confidence, delete a constraint, or choose which
source is right.

## 8. Merely allowed is not source-supported

Suppose a grounded schema source enumerates `Tanaka`, `Sato`, and `Suzuki` as
eligible assignees, but the current statement mentions only Tanaka and Sato.
`C_SUZUKI` may be grounded as a domain member without positive support as the
current actor. If the bounded constraints have a satisfying witness containing
it:

```text
support = unsupported
viability = allowed
```

This means the represented constraints permit it. It does not mean the input
supports Suzuki as a plausible reading. This case is why support and viability
must remain separate.

## 9. External knowledge is required

Input:

```text
Falconを使う。
```

Without more source context, `Falcon` may denote several products, projects,
or unrelated entities. The model may record a surface entity and an open
identity variable, but it must not use model memory or the web to select one.

Permitted next actions are outside the recognition core:

- add an explicit glossary or repository manifest as another source and run a
  new recognition; or
- send the unresolved identity as a pending question to `llmthink` or a human.

## 10. Inference belongs to llmthink

Recognized inputs:

```text
R1: desired deadline = next_week
R2: required reviewer is unavailable until the following week
```

Candidate llmthink inference:

```text
The desired schedule may be at risk.
```

Even if the inference is reasonable, neither source directly states schedule
risk. `llmrecog` passes R1, R2, their modality, and provenance to `llmthink`;
it does not create `project_schedule_is_unsafe`.

## 11. Decision and realization boundaries

Recognized input:

```text
The requester prefers PostgreSQL.
```

Valid recognition:

```text
intent/preference: requester prefers PostgreSQL
```

Possible downstream actions:

- `llmthink` compares constraints and decides whether to select PostgreSQL.
- `perttool` represents approved implementation and migration tasks.

The preference is not itself a decision, and a decision is not itself a task.

## 12. Prohibited think-to-recog backflow

Suppose `llmthink` concludes:

```text
C1: Select PostgreSQL.
```

Forbidden:

```text
write R_DB = PostgreSQL into the old recognition as explicit source fact
```

Permitted explicit review:

- re-read the original requirements and add a newly found source-grounded
  preference or constraint;
- treat the llmthink artifact as a new downstream source and recognize only
  that “artifact T records conclusion C1,” preserving its inference origin;
- create a new recognition version with lineage, without overwriting the old
  provenance.

## 13. Materialization without decision

For the minimal example, bounded materialization may produce:

```text
world 1: actor=Tanaka, commitment=desire
world 2: actor=Sato,   commitment=desire
world 3: actor=Sato,   commitment=weak_commitment
```

It must not produce the excluded Tanaka/weak combination. It also must not call
world 1 preferred or persist any world as the recognized truth. If the source
domain is open, output additionally marks the unresolved open remainder rather
than pretending the list is exhaustive.
