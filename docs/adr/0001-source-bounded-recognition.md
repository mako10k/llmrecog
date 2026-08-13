# ADR 0001: Source-bounded recognition

- Status: Accepted
- Date: 2026-08-13

## Context

Semantic extraction can easily drift from interpreting input into producing
new hypotheses, conclusions, or world facts. That would duplicate llmthink and
make provenance unreliable.

## Decision

`llmrecog` represents only meaning supported by identified input spans.
Semantics-preserving linguistic interpretation and normalization are allowed
when their rules and anchors are recorded. New propositions, decisions, and
realization structures are outside the product.

Grounding means “the source supports this content-as-presented,” not “this
content is objectively true.” Reported content, modality, polarity, and source
context must be retained when necessary to preserve that distinction.

Constraint propagation may derive assignment viability from already grounded
constraints, but the derived result is not promoted to a source recognition.

## Consequences

- Every semantic record and constraint needs provenance.
- External knowledge must become an explicit source before recognition can use
  it.
- Hypothesis, inference, conclusion, decision, task, and execution blocks are
  absent from the DSL.
- False or fictional source statements can be recognized without truth
  certification.
- llmthink remains the owner of what follows from recognized content.

## Rejected alternatives

### Allow “reasonable” model completion without explicit provenance

Rejected because model priors and source meaning would become
indistinguishable.

### Treat every explicit source assertion as a world fact

Rejected because quotation, negation, fiction, error, and stale information
would lose their modality.
