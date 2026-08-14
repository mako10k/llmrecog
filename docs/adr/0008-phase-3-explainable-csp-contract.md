# ADR 0008: Phase 3 explainable CSP and focused audit contract

- Status: Accepted
- Date: 2026-08-14

## Context

ADR 0006 froze `Llmrecog.ExplainResult.v1`, public reason codes, and the
separation between source support and CSP viability. ADR 0007 accepted the
private Phase 2 read path but explicitly deferred constraint evaluation,
`recognition explain`, and `document audit`.

Phase 3 needs one executable semantic slice that can answer the repository's
own ambiguity questions before the remaining constraint vocabulary is built.
The provisional CLI text does not yet fix the effective scope algorithm, the
meaning of its limit, unsupported Phase 4 constraint behavior, audit result
shape, or missing-target result. Leaving those choices to implementation would
make witness identity, exclusions, unknowns, and conflict reporting accidental
behavior.

## Decision

Accept only the unreleased private Phase 3 `one_of` and `excludes` vertical
slice under semantic contract `0.1`. This ADR freezes the contract; it does not
itself claim that the implementation exists.

### Explain route and result selection

The accepted route is:

```text
llmrecog recognition explain <id> <file.recog>
  [--scope <variable-id>[,<variable-id>...]]
  [--limit <positive-integer>]
  [--format text|json]
```

The default format is text and the default limit is 100. A successful lookup
returns `Llmrecog.ExplainResult.v1`. An invalid document returns
`Llmrecog.ValidationResult.v1`. A syntactically valid ID missing from a valid
document returns the existing `Llmrecog.RecognitionResult.v1` not-found shape.

Every 0.1 recognition kind is explainable. Entity and record targets receive
the provenance, support, normalization, audit, and source-verification
projection with null CSP fields. A variable receives resolution but no
candidate viability. A candidate receives both independent support and
viability projections. A constraint receives its grounding, support, affected
candidate derivations, and scope with null viability and variable resolution.
This does not turn a derivation into a source recognition.

The support projection is `supported` when the target has a positive support
record and `unsupported` when it does not. Phase 3 has no negative support
declaration and therefore does not produce `conflicted`; a supported candidate
that constraints exclude remains `support: supported`, `viability: excluded`,
with `RCG-CSP-002`.

### Scope, bounds, and ordering

For a variable, the default requested scope begins with that variable. For a
candidate, it begins with the parent variable. For a constraint, it begins
with every operand variable in document declaration order. Entity and record
targets have null scope unless their declared value directly references a
variable, in which case that variable is the default seed.

An explicit scope is an ordered, duplicate-free seed list and must contain the
target's default seeds. The effective scope is the deterministic transitive
closure of those seeds through every constraint operand, ordered by variable
declaration order. A missing or non-variable scope ID is a usage error; a
scope that omits a target seed is also a usage error. Scope expansion is never
silently disabled.

The limit is the maximum number of complete represented assignments inspected
for one explain request. Assignment enumeration uses effective variable order,
then each variable's declared candidate order, with ID as the final tie-break.
Open variables additionally have an internal unbound branch; it is reported
only through `open_variable_ids` and never becomes an invented source
candidate. A witness fixes the target candidate when applicable and lists only
known selected candidates.

A found witness establishes `allowed`. Exhausting all target-bearing
assignments establishes `excluded` and requires a grounded public reason chain
ending in `RCG-RSN-206`. Reaching the limit before either proof produces
`unknown` with `RCG-RSN-007`, `complete: false`, and `truncated: true`.
Variable resolution requires the complete represented scope: one selected
candidate across all satisfying worlds is `resolved`, multiple are
`ambiguous`, no satisfying represented world is `inconsistent`, and an open,
skipped, or limit-incomplete result is `unknown` with typed reasons.

The Phase 3 engine evaluates only grounded `one_of` and `excludes`
constraints. A `requires`, `same_as`, or `distinct_from` declaration in the
effective closure is retained in `skipped_constraints` with `RCG-RSN-006`.
It prevents an `allowed`, `resolved`, or `ambiguous` claim because an omitted
constraint could invalidate a witness. It cannot invalidate an exclusion or
inconsistency already proved using a subset of constraints, because adding
constraints cannot restore a removed assignment.

Arrays follow validated declaration order unless the public reason chain
requires dependency order. Minimal exclusion chains are selected
lexicographically by constraint declaration order, then candidate declaration
order and reason code. Repeated execution over identical bytes and arguments
must emit byte-identical JSON and text.

### Focused audit route

The accepted route is:

```text
llmrecog document audit <file.recog>
  [--profile base]
  [--fail-on warning|error]
  [--max-diagnostics <positive-integer>]
  [--format text|json]
```

Defaults are `profile: base`, `fail_on: error`, and 100 diagnostics. Successful
document validation returns `Llmrecog.AuditResult.v1`; an invalid document
returns `Llmrecog.ValidationResult.v1`. `strict-grounding` remains deferred.

The Phase 3 base profile evaluates exactly these focused rules:

- `RCG-GROUND-003` for a locatable source without a digest;
- `RCG-SUPPORT-001` for a candidate or semantic record without positive
  support;
- `RCG-CSP-001` for each closed variable with no satisfying represented world;
- `RCG-CSP-002` for each positively supported candidate excluded by grounded
  Phase 3 constraints.

An open variable is not itself a defect, and candidate enumeration alone is
not evidence that a document assumed exhaustiveness, so Phase 3 does not emit
`RCG-OPEN-001` merely for an open domain. Validation continues to own
`RCG-GROUND-002` and other structural or semantic errors.

`passed` is false when a complete finding at or above the configured threshold
exists or when diagnostics are truncated. Findings are ordered by source span,
then code, then entity ID. The machine result reports the evaluated rule codes,
severity counts, completeness, truncation, and source verification mode
`none/not_requested`. Audit does not read a declared source locator.

### Outcome and process boundaries

Normal results go to stdout. Usage and input/output failures go to stderr.
Exit status is 0 for a complete explain result or a passing audit, 1 for an
invalid document, missing target, truncated explain/audit, or failed audit
threshold, 2 for usage failure, and 3 for input/output or encoding failure.

The accepted implementation remains private and read-only. It may read only
the explicitly supplied `.recog` path. It may not persist derivations,
materializations, or caches; read source locators; call a provider; use ambient
clock, locale, or environment; mutate another repository; or expose a public
CLI binary.

## Consequences

- The first usable `one_of` candidate explanation can be dogfooded before
  `excludes` and audit implementation, while retaining the same result
  contract.
- The minimal meeting example must show weak commitment allowed with a Sato
  joint witness and the Tanaka/weak assignment forbidden by the named
  `excludes` constraint.
- Existing ExplainResult v1 goldens remain authoritative; Phase 3 adds exact
  route and audit fixtures without rewriting semantic version 0.1.
- `requires`, `same_as`, `distinct_from`, query, materialization, local source
  verification, provider production, and public distribution remain separate
  gates.

## Rejected alternatives

### Report a candidate as allowed without a joint witness

Rejected because per-variable viability can hide an impossible combination
across grounded constraints.

### Treat a supported and excluded candidate as conflicted support

Rejected because it collapses source support into CSP viability. The two axes
and the audit finding remain independently inspectable.

### Ignore deferred constraint kinds in Phase 3

Rejected because a witness that does not satisfy every relevant constraint is
not evidence of `allowed` under semantic contract 0.1.

### Treat open domains as audit failures

Rejected because openness is the default semantic state, not missing data to
repair or implicit falsity.
