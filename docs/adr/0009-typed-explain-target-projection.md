# ADR 0009: Typed recognition projection in ExplainResult v2

- Status: Accepted
- Date: 2026-08-14
- Supersedes: ADR 0008 only for the successful explain result version and
  target-content shape

## Context

ADR 0008 accepted `Llmrecog.ExplainResult.v1` for the unreleased private
Phase 3 route. Round 3a dogfood then explained an unsupported but allowed
candidate through the actual `one_of` implementation. The result identified
the target only by ID and declaration kind. Its candidate value and parent
variable happened to appear inside an allowed witness, but that recovery is
not available for an excluded or unknown candidate without a witness.

This conflicts with the accepted explainability requirement that an
explanation return the target's typed semantic value and, for a candidate, its
parent variable and domain membership. Looking up the same ID separately with
`recognition show` would make one explain result incomplete and would allow
the authored target identity to drift between commands.

## Decision

Before finite `excludes` implementation begins, change successful private
`recognition explain` results to `Llmrecog.ExplainResult.v2`. Semantic contract
`0.1`, the command route, invalid-document result, missing-target result,
support and viability meanings, scope, ordering, completeness, and exit
behavior remain unchanged.

ExplainResult v2 adds one required top-level `recognition` field. It is the
exact validated authored recognition selected by `target.id` and conforms to
the existing discriminated recognition union in
`Llmrecog.SemanticDocument.v1`. The existing `target` object remains the
compact lookup identity with `id` and `declaration_kind`.

The two projections have distinct roles:

- `recognition` carries authored type-specific content, including a
  candidate's `variable_id` and typed `value`, a variable's candidate IDs, a
  constraint's normalized operands, and an entity or record's typed fields;
- `support`, `viability`, `variable_resolution`, `scope`, `derivations`, and
  diagnostics remain derived query projections and are not copied into the
  authored recognition;
- an authored support record inside `recognition` does not replace the
  independently derived `support.state` projection.

Text output must render the same type-specific recognition facts as JSON.
Candidate fixtures with `excluded` and `unknown` viability and no witness must
prove that `variable_id` and typed `value` remain directly available. Every
recognition kind must still validate through the same real parser, semantic
model, application, and private adapter seam.

`Llmrecog.ExplainResult.v1` remains immutable historical contract evidence. It
is not widened in place. Because no public CLI or package has been released,
the private route may move to v2 without a compatibility adapter.

## Consequences

- The Round 3a presentation finding is resolved before its absence can spread
  into exclusion-chain and audit goldens.
- ExplainResult v2 duplicates some authored grounding and support-record data
  already summarized by derived projections, but the duplication is explicit,
  typed, and identity-bound within one result.
- All successful explain JSON and text goldens move to v2 together; invalid and
  missing-target goldens do not change.
- The new schema and no-witness fixtures are implemented as a separate 3-point
  gate before `excludes`; this ADR does not itself claim implementation.
- ADR 0008 remains authoritative for every Phase 3 explain and audit decision
  not explicitly superseded here.

## Rejected alternatives

### Add fields directly to the v1 target object

Rejected because it would silently widen a frozen result schema and require a
new kind-specific target union under an identity object.

### Require a separate recognition show request

Rejected because explain would not be a complete deterministic projection and
the two reads could bind different artifact bytes.

### Recover candidate identity from the witness

Rejected because excluded and unknown candidates have no witness, and a
witness is a derived assignment rather than the authored target declaration.
