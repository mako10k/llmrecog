# Recognition-aware llmthink grounding audit

## 1. Purpose

When a llmthink premise or evidence record carries a typed llmrecog reference,
llmthink should be able to audit whether the referenced recognition can ground
the **specific claim pattern** used by that reasoning record.

This is not a truth audit and not an attempt to infer the meaning of arbitrary
premise prose. It checks a declared relationship:

```text
grounding capability =
  compatibility(recognition projection, declared claim pattern, frozen scope)
```

Grounding capability is relational, not an intrinsic true/false property of a
recognition. An open variable can ground “the value is unresolved” or “A is a
source-supported candidate,” while failing to ground “the value is A” or
“only A or B is possible.”

## 2. Activation boundary

The additional audit runs only when all of the following are present:

- a typed `Llmrecog.RecognitionReference.v1`;
- a configured read-only resolver;
- a machine-readable grounding claim pattern;
- a compatible llmrecog semantic version.

Plain llmthink premise/evidence remains valid. Without a typed reference,
llmthink may report ordinary provenance-policy findings but must not pretend to
have performed recognition compatibility checks.

If a typed reference exists without a claim pattern, the audit may validate
reference identity, target kind, and provenance depth only. It reports
`claim_pattern_missing` when a policy requires semantic compatibility audit;
it must not derive a pattern from natural-language text using an LLM inside the
deterministic audit path.

## 3. Grounding claim patterns

The proposed minimal patterns are:

| Pattern | Downstream meaning | Recognition condition |
| --- | --- | --- |
| `direct_record` | The premise preserves one recognized record | Target is supported and the typed value/modality projection matches |
| `supported_candidate` | Candidate C is a source-supported reading | C has positive support; viability is reported separately, and exclusion becomes a conflict |
| `allowed_binding` | Joint binding is consistent with represented constraints | One complete witness contains every declared binding |
| `resolved_value` | Variable V has value C | V is closed and resolved to C; C has the required source support |
| `exhaustive_domain` | Listed candidates are the complete domain | V is closed by grounded closure and the listed set is exact |
| `uncertainty_state` | V is open, ambiguous, unknown, or inconsistent | Requested state equals the frozen variable projection |
| `excluded_binding` | Binding cannot occur under represented constraints | No witness exists and a complete exclusion chain is available |

The claim pattern is not an inference rule. It declares what semantic strength
the llmthink record expects from its reference so compatibility can be checked
without interpreting prose.

A transport-neutral conceptual shape is:

```json
{
  "schema": "Llmthink.RecognitionGroundingClaim.v1",
  "reference": {
    "uri": "recog:./meeting.recog#V_ACTOR",
    "document_digest": "sha256:..."
  },
  "pattern": "allowed_binding",
  "bindings": [
    { "variable": "V_ACTOR", "candidate": "C_ACTOR_TANAKA" },
    { "variable": "V_COMMITMENT", "candidate": "C_WEAK_COMMITMENT" }
  ],
  "scope": ["V_ACTOR", "V_COMMITMENT"],
  "require_complete": true
}
```

The exact source syntax belongs to llmthink and requires its own contract.

## 4. Factored audit dimensions

The audit must preserve facts rather than collapse them immediately into one
score.

### 4.1 Reference integrity

- `resolved`: target and frozen digest match;
- `stale`: locator resolves but digest differs;
- `unavailable`: document or resolver is unavailable;
- `incompatible`: semantic version or target kind is unsupported.

### 4.2 Source-support coverage

- `full`: every source-support requirement of the pattern is satisfied;
- `partial`: only part of a multi-record/binding pattern has positive support;
- `none`: no required positive support exists;
- `conflicted`: required support is internally conflicted;
- `not_applicable`: the pattern asks only about derived constraint state.

### 4.3 Constraint compatibility

- `witnessed`: a complete joint witness satisfies the pattern;
- `excluded`: no joint witness exists and a complete reason chain is present;
- `unknown`: open/unresolved operands or limits prevent determination;
- `not_applicable`: the pattern does not assert candidate viability.

### 4.4 Domain/closure coverage

- `sufficient`: closure strength is sufficient for the pattern;
- `open`: the referenced domain is explicitly open;
- `overclaimed`: the pattern asserts exhaustiveness/resolution not supported by
  the domain;
- `unknown`: closure cannot be resolved.

### 4.5 Projection completeness

- `complete`;
- `truncated`;
- `scope_incomplete`;
- `unresolved`.

An optional summary status may be derived for presentation:

- `grounded`;
- `grounded_with_qualification`;
- `insufficient`;
- `contradicted`;
- `unresolved`.

The factored dimensions remain the machine authority. The summary is not a
truth score or confidence value.

## 5. Open-state rules

Open state is not automatically “not evidence.” Its capability depends on the
claim.

| llmrecog projection | llmthink claim pattern | Audit result |
| --- | --- | --- |
| V is open | `uncertainty_state(open)` | grounded |
| V is open; C has positive support | `supported_candidate(C)` | grounded, preserving open qualification |
| V is open; C has a witness | `allowed_binding(V=C)` | grounded as constraint compatibility only, not source selection |
| V is open | `resolved_value(V=C)` | insufficient / premature narrowing |
| V is open with known A and B | `exhaustive_domain([A,B])` | insufficient / false closure |
| V is unknown due to limit | any complete-value claim | unresolved, never contradicted |

Thus “not known to be impossible,” “source-supported as a reading,” and
“resolved as the value” remain distinct evidence strengths.

## 6. Variable-pattern contradictions

### 6.1 Premature narrowing

A premise claims `V=A`, but the referenced variable is ambiguous, open, or
unknown. Unless the llmthink record explicitly owns the narrowing as a later
reasoning step, the recognition reference is insufficient to ground that
claim.

### 6.2 False exhaustiveness

A premise says “only A or B,” but the variable has no grounded closure or the
referenced projection is incomplete. This is an overclaim, not evidence that
unlisted values are false.

### 6.3 Excluded candidate

A premise presents candidate A as possible or selected, but A has viability
`excluded`. The audit returns `contradicted` and includes the llmrecog reason
chain.

### 6.4 Allowed but unsupported candidate

A has a CSP witness but no positive source support. It can ground “A is
consistent with the represented constraints,” but not “the source supports A.”

### 6.5 Joint-binding contradiction

Each candidate can be individually `allowed`, while their combination has no
joint witness. The audit must evaluate the complete binding pattern in one CSP
scope rather than checking candidates independently.

For the minimal example:

```text
C_ACTOR_TANAKA           individually allowed
C_WEAK_COMMITMENT        individually allowed (with actor=Sato)
Tanaka + weak_commitment jointly excluded
```

A premise that combines both is contradicted even though two naive per-target
checks would pass.

### 6.6 Support/constraint conflict

A candidate is positively source-supported but constraint-excluded. The audit
must preserve both facts and return `contradicted` or
`grounded_with_conflict` according to the requested pattern. It must not choose
which source or constraint is correct.

### 6.7 Ambiguity loss across multiple references

Two premise fields may cite different materialized worlds as though they were
one coherent world. The audit must bind all recognition-derived fields owned by
the same claim pattern and require a joint witness.

## 7. Initial diagnostics

Proposed llmthink-side diagnostic categories:

| Code | Default severity | Meaning |
| --- | --- | --- |
| `THREC-101` | error | Typed recognition reference is stale or incompatible |
| `THREC-102` | warning | Policy requires a claim pattern but none is declared |
| `THREC-103` | error | Referenced candidate or binding is constraint-excluded |
| `THREC-104` | error | Multi-variable claim has no joint witness |
| `THREC-105` | warning | Claim narrows an ambiguous/open/unknown variable without owning the narrowing |
| `THREC-106` | warning | Claim asserts exhaustive candidates over an open/incomplete domain |
| `THREC-107` | warning | Allowed candidate is used as source-supported evidence without positive support |
| `THREC-108` | warning | Recognition projection is truncated or scope-incomplete |
| `THREC-109` | warning | Premise drops required modality, polarity, or ambiguity qualification |
| `THREC-110` | info | Open/unknown recognition correctly grounds an uncertainty-state claim |

Severity is policy-configurable at presentation time, but the underlying
factored result must not be discarded or rewritten.

## 8. Result contract

The proposed result record is `Llmthink.RecognitionGroundingAudit.v1` and
contains at least:

- llmthink owner record ID;
- frozen recognition reference and target IDs;
- declared claim pattern and joint bindings;
- reference-integrity status;
- source-support coverage;
- constraint compatibility;
- domain/closure coverage;
- projection completeness;
- joint witness or exclusion/unknown reason chain;
- summary status and diagnostics;
- llmrecog semantic version and solver scope/limit.

The audit report must distinguish direct-source grounding from derived
constraint compatibility. A grounded `allowed_binding` is not counted as a
source-supported premise unless the metric explicitly defines that broader
denominator.

## 9. Metrics

Recognition-aware metrics may include:

- direct grounded premise ratio;
- qualified/open grounding ratio;
- unsupported premise count;
- premature narrowing count;
- false-closure count;
- joint-binding contradiction count;
- ambiguity-preservation ratio;
- unresolved/stale reference count;
- source coverage and provenance depth.

Every metric must publish its denominator and policy. These metrics audit
provenance discipline; they do not measure truth or reasoning quality by
themselves.

## 10. Non-goals

This audit does not:

- require llmrecog for ordinary llmthink documents;
- infer a grounding pattern from arbitrary prose in the deterministic path;
- decide which interpretation should be selected;
- treat open/unknown as false;
- turn CSP viability into source support;
- repair a premise or mutate either artifact;
- write llmthink conclusions back into llmrecog.
