# llmthink integration policy

## 1. Goal

The integration should make a reasoning premise traceable through a
recognition record to original source spans:

```text
source -> llmrecog record -> llmthink premise/evidence
       -> inference -> decision -> perttool work
```

The integration is optional. `llmthink` remains fully valid with plain
premises and evidence.

## 2. Current compatibility boundary

The inspected `llmthink` 1.1.1 grammar supports premise/evidence text and
anonymous evidence resources with file, URL, or blob locators. It does not
currently define a typed field that resolves a target inside a `.recog`
document.

Therefore:

- no current llmthink capability is assumed or modified by this design;
- a file resource can provide a compatibility-level document link, but it
  cannot provide full target-level semantic verification;
- typed recognition linkage requires a separately reviewed additive change in
  the llmthink repository.

Current compatibility-level evidence can look like:

```llmthink
evidence EV3:
  "The llmrecog artifact preserves the actor ambiguity."
  resource:
    file "recognition/meeting.recog"
    digest "sha256:..."
    label "llmrecog document; target V_ACTOR"
```

The label is human-readable only. It must not be counted as a verified typed
reference by future grounding audits.

## 3. Proposed typed reference

The initial local reference form is:

```text
recog:./relative/path.recog#RECORD_ID
```

It resolves relative to the containing llmthink document. A resolved reference
is represented independently of llmthink syntax as:

```json
{
  "schema": "Llmrecog.RecognitionReference.v1",
  "uri": "recog:./relative/path.recog#V_ACTOR",
  "document_id": "MEETING_RECOG",
  "document_digest": "sha256:...",
  "target_id": "V_ACTOR",
  "semantic_version": "0.1",
  "projection": "possibility_space"
}
```

`document_digest` is required for a frozen reasoning record and optional for a
live draft. A digest mismatch makes the reference stale; the resolver must not
silently retarget by ID.

## 4. Proposed additive llmthink surface

The exact syntax belongs to llmthink. A conceptual additive form is:

```llmthink
premise P3:
  "The response actor is Tanaka or Sato; the source does not select one."
  recognized_from:
    uri "recog:./recognition/meeting.recog#V_ACTOR"
    digest "sha256:..."
    projection possibility_space
```

Required semantics for any eventual syntax:

- plain premise/evidence remains valid;
- the reference is resolved by an optional adapter, not by llmrecog core
  importing llmthink;
- target kind and projection compatibility are checked;
- the llmthink text may summarize but cannot silently contradict the resolved
  recognition projection;
- resolution status and stale/unavailable state are auditable;
- source spans remain available through the recognition reference.

## 5. Ambiguity propagation

Referring to a variable with projection `possibility_space` carries:

- declared candidates and their positive support;
- domain openness/closure;
- current viability in the frozen scope;
- relevant constraints and unknown reasons;
- completion/truncation status.

It must not carry only the first materialized world or highest producer
confidence.

If reasoning chooses `C_ACTOR_TANAKA`, that narrowing is a llmthink reasoning
record based on the variable/candidate reference. It does not change
`V_ACTOR`, and future grounded-premise metrics must distinguish direct
projection from reasoning-time selection.

## 6. Recognition-aware grounding audit

Once typed references exist, llmthink can optionally audit whether a referenced
recognition can ground the exact claim pattern declared by a premise or
evidence record.

The audit must not treat open state as automatically unusable evidence. It
checks the relationship between recognition and claim strength:

- an open variable can ground an `uncertainty_state` claim;
- a supported candidate in an open variable can ground “C is a supported
  reading,” while not grounding “V is resolved to C”;
- `allowed` without positive support can ground constraint compatibility, but
  not a claim that the source supports the value;
- individually allowed candidates can still form a jointly impossible binding;
- an exhaustive claim over an open domain is insufficiently grounded.

Deterministic semantic audit requires a machine-readable claim pattern. It
must not ask an LLM to infer the intended binding from premise prose inside the
audit path.

The full factored contract, variable-pattern checks, diagnostics, and metrics
are defined in
[Recognition-aware llmthink grounding audit](llmthink-grounding-audit.md).

## 7. Prohibited backflow

The following is forbidden:

```text
llmthink conclusion C1 -> automatic llmrecog fact R1
```

An explicit re-recognition flow is permitted:

1. A user or tool creates a review request that references the llmthink
   artifact and identifies which original/new sources may be examined.
2. A new recognition run reads those sources under normal authorization.
3. New or revised recognition records cite their actual source spans.
4. The new `.recog` version retains lineage to the prior recognition.
5. If the llmthink artifact itself is a source, a record may say “artifact T
   contains conclusion C,” while preserving its downstream/inference origin.
   It may not relabel C as content of the earlier original source.

No automatic write, promotion, or provenance-role erasure is allowed.

## 8. perttool handoff

`llmrecog` does not reference perttool tasks directly in the initial design.
A perttool plan may cite a llmthink decision or external decision record under
perttool's own contract. Skipping the reasoning/acceptance boundary and turning
a recognized desire or deadline into a task is prohibited.
