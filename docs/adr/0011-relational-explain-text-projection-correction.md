# ADR 0011: Correct the relational explain text projection

- Status: Accepted
- Date: 2026-08-14

## Context

ADR 0010 requires text and JSON to be equivalent deterministic projections of
the same typed result. The initially accepted
`requires-excluded.explain.txt` artifact used a new abbreviated layout that
omitted input identity, the complete recognition projection, provenance,
source-verification state, relevant constraints, derivations, and diagnostics
that are present in its adjacent `Llmrecog.ExplainResult.v2` JSON golden.

The Phase 3 ExplainResult v2 text renderer already projects those fields in a
stable order. Keeping a one-off abbreviated Phase 4 layout would make the text
contract depend on the constraint kind and would hide evidence needed during
dogfood.

## Decision

Correct only the relational text golden to use the existing complete
ExplainResult v2 text projection over the exact accepted JSON result. Future
relational explain text goldens use that same renderer and field order.

This correction does not change:

- any JSON Schema, semantic version, result field, reason code, or constraint
  truth table;
- any parser, model, scope, assignment, provenance, or diagnostic meaning;
- any protocol-v4 corpus document, question, command case, gate, or evidence
  identity;
- any public CLI, package, release, or publication status.

## Consequences

- Text retains every material ExplainResult v2 field needed to compare it with
  the machine result.
- Existing Phase 3 text goldens and renderer behavior remain unchanged.
- The corrected artifact is fixture evidence for the relational implementation
  and later dogfood, not evidence that a space route exists.

## Rejected alternatives

### Add a constraint-kind-specific abbreviated renderer

Rejected because the same result type would then have two incompatible text
shapes and the abbreviated shape would discard provenance and diagnostics.

### Remove the relational text golden

Rejected because the accepted Phase 4 contract requires deterministic text
and JSON coverage for the private explain route.
