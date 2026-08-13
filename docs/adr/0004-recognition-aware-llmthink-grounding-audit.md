# ADR 0004: Recognition-aware llmthink grounding audit

- Status: Accepted
- Date: 2026-08-13

## Context

A typed llmrecog reference can improve llmthink provenance, but reference
existence alone does not prove that the recognition supports the downstream
premise. Open variables, unsupported but solver-allowed candidates, excluded
bindings, and cross-variable combinations need different treatment.

A boolean “has evidence” flag would lose these distinctions. Reading arbitrary
premise prose with an LLM during audit would also make the audit
nondeterministic and circular.

## Decision

A future optional llmthink audit evaluates a machine-readable grounding claim
pattern against a frozen recognition projection.

It reports separate dimensions for:

- reference integrity;
- source-support coverage;
- constraint compatibility, including one joint witness for multi-variable
  bindings;
- domain/closure coverage;
- projection completeness.

Open state is claim-relative. It can ground uncertainty-state and qualified
supported-candidate claims, but cannot ground resolved-value or exhaustive-
domain claims without the necessary closure. Solver-allowed but unsupported
candidates are constraint-compatible, not direct source evidence.

The audit remains optional. Plain llmthink documents are valid, and the
deterministic path does not infer claim patterns from prose.

## Consequences

- A premise cannot combine individually allowed candidates when their joint
  binding is impossible.
- Premature narrowing, false closure, excluded bindings, unsupported evidence,
  and incomplete projections receive distinct diagnostics.
- Open/unknown recognition remains useful evidence when the premise preserves
  that qualification.
- Metrics can distinguish direct grounding, qualified grounding, and derived
  constraint compatibility without producing a truth score.
- Exact llmthink syntax and implementation remain separately owned future
  work.

## Rejected alternatives

### Treat every open variable as non-evidence

Rejected because open state directly supports claims about uncertainty and may
contain positively supported readings.

### Treat every allowed candidate as evidence

Rejected because CSP viability is not positive source support and individual
viability does not prove joint compatibility.

### Infer the claim pattern from premise prose during audit

Rejected because it would make a deterministic audit depend on another
semantic interpretation step and provider behavior.
