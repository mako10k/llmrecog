# ADR 0010: Phase 4 complete deterministic semantic-core contract

- Status: Accepted
- Date: 2026-08-14

## Context

ADR 0008 accepted bounded scope construction, represented assignment order,
joint witnesses, public exclusion reasons, and the separation of source
support from CSP viability for private `one_of` and `excludes` explanation.
ADR 0009 completed the typed target projection. Phase 3 dogfood accepted that
slice and deferred one compound allowed-plus-forbidden navigation question to
the Phase 4 bounded-query design.

Semantic contract 0.1 already declares `requires`, `same_as`, and
`distinct_from`, but the private runtime deliberately treats them as skipped.
The provisional `space query` and `space materialize` text also leaves result
shape, filter applicability, the exact meaning of each limit, open-value
constraint evaluation, and incomplete-result behavior insufficiently fixed.
Allowing implementation to decide those points would risk treating an open
value as equal or unequal, presenting an indeterminate assignment as a
witness, or turning a materialized view into selected source content.

## Decision

Complete only the deterministic semantic core under semantic contract 0.1.
The Phase 4 private read path evaluates all five initial constraint kinds and
adds bounded `space query` and `space materialize` routes. This ADR accepts
the contract but does not claim implementation. The complete schema, fixture,
and dogfood protocol package is accepted with this decision before runtime
work begins.

### Shared scope and assignment model

Phase 4 retains the Phase 3 requested-scope and transitive effective-scope
algorithm. A constraint joins the effective closure when any operand variable
is already present. Effective variables, constraints, and known candidates
retain validated declaration order, with ID only as a final tie-breaker.

Each represented variable branch is either one declared candidate or, for an
open variable, one internal `unbound/open` branch. That branch is a projection
of possible unlisted values; it is never assigned a candidate ID, source
support, canonical value, or invented source declaration.

Constraint evaluation over one complete represented branch tuple is
three-valued:

- `satisfied`: the tuple proves that the constraint holds;
- `violated`: the tuple proves that the constraint does not hold and yields a
  grounded public reason;
- `indeterminate`: an open value prevents either proof.

Only a tuple for which every relevant constraint is `satisfied` is a
satisfying witness. An indeterminate tuple is not a witness and is not an
exclusion proof. A candidate is `excluded` only when every represented tuple
containing it is proved violated. If no witness exists but any applicable
tuple is indeterminate or the declared bound stops evaluation, viability is
`unknown` with typed reasons.

### `requires`

`requires(A, B)` evaluates candidate literals by exact candidate ID:

| Antecedent `A` | Consequent `B` | Result |
| --- | --- | --- |
| not selected | either | satisfied |
| selected | selected | satisfied |
| selected | not selected, including an open branch | violated |

It never positively selects either operand and never implies the reverse
direction. `requires(A, A)` is a grounded tautology. A violation emits
`RCG-RSN-203` with the antecedent and consequent candidate IDs and may
contribute to a target exclusion ending in `RCG-RSN-206`.

### `same_as` and `distinct_from`

Validation continues to require identical variable `value_type` values.
Canonical value equality means exact equality of the typed semantic value:

- `entity_ref` compares the referenced entity ID;
- `symbol` compares the exact identifier value;
- `string` compares the exact Unicode scalar sequence with no normalization.

Candidate IDs do not determine equality; distinct candidates can carry equal
canonical values. No alias, ontology, locale, case-folding, Unicode
normalization, or external knowledge is applied.

For two different variables with known selections, `same_as` is satisfied
when the values are equal and otherwise violated with `RCG-RSN-204`.
`distinct_from` is satisfied when they differ and otherwise violated with
`RCG-RSN-205`. If either different-variable operand is `unbound/open`, the
result is indeterminate with `RCG-RSN-001`; the engine neither invents a value
nor assumes equality or inequality. `same_as(V, V)` is always satisfied and
`distinct_from(V, V)` is always violated, including the open branch, because
both operands denote the same variable selection.

### Public reason composition and explain

Successful candidate explanation remains
`Llmrecog.ExplainResult.v2`. Once Phase 4 is implemented, none of the five
contract-0.1 constraint kinds is reported as unsupported or skipped.

A proved violation uses the existing backend-independent reasons:

- `RCG-RSN-201` for a grounded single remaining `one_of` member;
- `RCG-RSN-202` for a forbidden `excludes` pair;
- `RCG-RSN-203` for an unmet `requires` consequent;
- `RCG-RSN-204` for a `same_as` value mismatch;
- `RCG-RSN-205` for a `distinct_from` value collision;
- `RCG-RSN-206` as the final no-satisfying-witness result.

For an excluded target, the reason chain contains the distinct directly
violated derivations needed by the deterministic represented search, ordered
by dependency and then constraint declaration order. The final
`RCG-RSN-206.inputs` lists the contributing grounded constraint IDs in that
same stable order. A relevant constraint that is unnecessary to the proof is
not added merely to make the explanation longer. Indeterminate open branches
produce unknown reasons rather than a fabricated violation chain.

Constraint-target explanation returns its normalized operands and only
derivations observed in the bounded evaluation; it does not assert that a
relationship fired without an inspected tuple. Support, viability, variable
resolution, and derivation projections remain independent.

### Bounded query route

The accepted private route is:

```text
llmrecog space query <file.recog>
  [--kind entity|record|variable|candidate|constraint]
  [--variable <variable-id>]
  [--support supported|unsupported|conflicted]
  [--viability allowed|excluded|unknown]
  [--grounded-in <span-id>]
  [--limit <positive-integer>]
  [--format text|json]
```

The default format is text and the default limit is 100. Supplied filters are
conjoined; each option occurs at most once. The route filters semantic
recognitions only and is not a general predicate, graph, join, or query
language.

`--kind` matches the exact declaration kind. `--variable` selects only
candidates declared under the named variable and establishes that variable
as the requested solver seed. `--viability` requires `--variable`; combining
`--variable` with a non-candidate `--kind` is a usage error. `--support`
applies only to kinds with a support projection. `--grounded-in` matches a
validated provenance path from the declaration or its support record through
an observation to the exact span ID, without opening the source locator.

Results follow declaration order and contain the exact typed recognition,
the applicable support projection, optional candidate viability, effective
solver scope, and matching span IDs. Query uses the one CLI limit as both:

- the maximum number of matched items returned; and
- the maximum complete represented assignments inspected independently for
  each requested candidate viability projection.

`Llmrecog.QueryResult.v1` reports the effective item and assignment limits,
matched count, returned items, completion, truncation, diagnostics, and source
verification state. Reaching either bound before the deterministic scan or a
needed viability proof completes sets `complete: false` and
`truncated: true`; a limit-blocked viability remains `unknown` with
`RCG-RSN-007`. Query truncation exits with status 1 because the route has no
pagination or `require-complete` opt-out.

The deferred Phase 3 compound question is dogfood input, not a pre-approved
new result. Phase 4 may accept a composed query result or typed navigation
links only after the first relational-constraint dogfood round demonstrates
that target-specific explain plus bounded query is insufficient.

### Bounded materialization route

The accepted private route is:

```text
llmrecog space materialize <file.recog>
  --scope <variable-id>[,<variable-id>...]
  --limit <positive-integer>
  [--require-complete]
  [--format text|json]
```

Scope is an ordered, duplicate-free list of existing variable IDs. Both scope
and limit are mandatory. Effective scope expands through the same transitive
constraint closure as explain. A missing or non-variable scope ID, duplicate,
zero/negative limit, or repeated option is a usage error.

The materialization limit is the maximum number of complete represented
branch tuples inspected, whether satisfying, violated, or indeterminate. The
generator uses effective variable order and candidate declaration order, with
the open branch last. A one-step exhaustion check distinguishes exactly-limit
complete enumeration from a truncated result.

`Llmrecog.MaterializationResult.v1` reports requested and effective scope,
the effective limit, inspected tuple count, emitted satisfying worlds,
indeterminate tuple count, open variable IDs, accumulated unknown reasons,
relevant constraint IDs, completion, truncation, diagnostics, and source
verification state. Each emitted world contains only known candidate
assignments plus its open variable IDs. It has no support, confidence,
selection, preference, or source-fact status.

`complete` means that the finite represented generator was exhausted; it does
not claim that an open domain is exhaustive. Fully inspected indeterminate
branches can therefore coexist with `complete: true`, while
`unknown_reasons` and `open_variable_ids` preserve the semantic uncertainty.
Only the declared inspection bound sets `truncated: true`.

Ordinary truncated materialization returns status 0 with
`complete: false`, `truncated: true`. With `--require-complete`, the identical
typed result is emitted and the process exits with status 5. Invalid documents
return `Llmrecog.ValidationResult.v1` with status 1; usage and input/output
failures retain statuses 2 and 3.

### Read-only and responsibility boundaries

All new behavior calls the shared deterministic core through application
services. It may read only the explicitly supplied `.recog` path. It must not:

- read a declared source locator or perform local/remote source verification;
- persist worlds, derivations, indexes, cursors, caches, or query state;
- rank, optimize, recommend, select, or write back one interpretation;
- add arbitrary predicates, negation-as-failure, a general rule language, or
  a theorem prover;
- call a provider, use ambient clock/locale/environment, or depend on
  `llmthink`, `perttool`, MCP, LSP, or editor APIs;
- combine multiple documents into one namespace or mutate another repository;
- expose a public package CLI, publish, release, tag, or push.

Text and JSON are equivalent deterministic projections. Repeated execution
over identical input bytes and arguments is byte-identical. No result is
persisted after the command exits.

## Dogfood and acceptance sequence

With this decision accepted together with schemas, exact fixtures, and
immutable protocol v4, Phase 4 proceeds in two feedback-separated slices:

1. implement all three remaining relational constraints and immediately
   dogfood implication chains, equality, inequality, open operands, joint
   witnesses, and the deferred compound-navigation question;
2. disposition that evidence before implementing query or materialization;
3. implement the accepted bounded query and materialization contracts;
4. dogfood filtering, ordering, low bounds, truncation, open projections, and
   `--require-complete`, then disposition all findings before acceptance.

The contract package must include success, failure, open-domain, conflict,
joint-witness, equal-value/different-ID, inequality-collision, transitive
reason, limit, exact-limit, truncation, and require-complete fixtures. Static
checks include jscpd through `npm run check` at each implementation gate.

## Consequences

- The first Phase 4 dogfood begins after 15 of 35 planned points instead of
  waiting for both space routes.
- Open values remain first-class uncertainty and never become equality or
  inequality evidence.
- Query can compose target discovery without widening every explanation, but
  the deferred navigation result remains evidence-gated.
- Materialization exposes bounded derived views without converting them into
  source support or downstream decisions.
- Earlier ExplainResult, protocol, receipt, and feedback artifacts remain
  immutable.

## Rejected alternatives

### Treat two open values as equal or distinct

Rejected because the internal open branch has no canonical value and cannot
support either relationship.

### Allow an indeterminate tuple to serve as an allowed witness

Rejected because `allowed` requires an explicit joint assignment satisfying
every relevant grounded constraint.

### Add all blocked alternatives to one target explanation

Rejected as the default because relevance to a different target has not been
established. The first Phase 4 dogfood round tests whether bounded query or a
separate navigation projection is actually needed.

### Materialize all variables by default

Rejected because accidental global expansion hides scope and resource cost.

### Persist worlds or add pagination state

Rejected because Phase 4 is a deterministic read-only view. Persistence,
cursors, and resumable query identity require a separate authority and
lifecycle contract.
