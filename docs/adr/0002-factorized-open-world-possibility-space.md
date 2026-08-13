# ADR 0002: Factorized open-world possibility space

- Status: Accepted
- Date: 2026-08-13

## Context

Forcing one interpretation destroys legitimate ambiguity. Persisting every
complete interpretation causes Cartesian growth. A single true/false state
also conflates source support, constraint viability, and missing information.

## Decision

The source document stores ambiguity as variables, candidates, and a closed
initial constraint vocabulary: `one_of`, `requires`, `excludes`, `same_as`,
and `distinct_from`.

Variables are open by default. A grounded `one_of` is the initial way to close
a variable domain. Missing values do not imply negation or an `unspecified`
candidate.

Candidate source support and CSP viability are independent:

- support: `supported`, `unsupported`, `conflicted`;
- viability: `allowed`, `excluded`, `unknown`.

`allowed` requires a represented satisfying witness. `excluded` requires a
reason chain proving no represented witness. `unknown` records why neither was
established.

Complete interpretations are emitted only by lazy, query-scoped, limited
materialization and are not source authority.

## Consequences

- Multiple readings remain visible without permanent world enumeration.
- A source-supported candidate can be reported as constraint-excluded without
  being silently erased.
- A solver-allowed candidate is not mislabeled as source-supported.
- The initial solver remains a finite meaning-space evaluator, not a general
  reasoner or optimizer.

## Rejected alternatives

### Persist every interpretation world

Rejected because independent ambiguities multiply and diffs become unstable.

### Three-state candidate field only

Rejected because it cannot distinguish positive source support from a
satisfying constraint witness.

### Weighted/probabilistic candidates

Rejected from the core because producer confidence lacks a common probability
semantics and would encourage interpretation ranking.
