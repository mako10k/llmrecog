# Semantic model and ambiguity semantics

## 1. Model overview

A recognition document contains three related graphs:

1. **Grounding graph:** sources and spans to semantic records.
2. **Possibility graph:** variables, candidates, and constraints.
3. **Derivation graph:** deterministic solver reasons produced for a requested
   scope.

Only the first two are source-of-truth declarations. The derivation graph is a
reproducible projection and is not persisted in the document by default.

## 2. Common record contract

Every source-of-truth declaration has:

- a document-unique stable ID;
- a kind from a versioned registry;
- declaration provenance;
- a source span in the `.recog` document for diagnostics.

Every semantic declaration additionally has:

- one or more `grounded_in` references, directly or through an observation;
- an optional positive `support` kind when its semantic value is positively
  supported;
- optional producer confidence and producer metadata, which are ignored by
  the solver.

Grounding and positive support are related but not identical. For example, a
candidate can be introduced because a source enumerates a type's domain while
the source does not support that candidate as the value in the current case.
Its declaration is grounded, but it has no positive support record.

## 3. Source layer

### 3.1 Document

The recognition document declares its ID and semantic version. IDs are local
to this document. A future namespace mechanism may add global identity without
changing local references.

### 3.2 Source

Initial fields:

- `kind`: initially `text`, with future structured/media profiles;
- `locator`: an opaque locator interpreted only by an explicit resolver;
- optional `media_type`;
- optional `digest` using `sha256`;
- optional `observed_at` when the source itself provides or the ingestion
  process explicitly records a temporal anchor.

`observed_at` is provenance, not permission to substitute the current clock.

### 3.3 Span

Initial text spans use a start-inclusive, end-exclusive, 1-based
`line:column` range and an optional exact quote. The quote provides durable
review context; the range provides navigation. If a digest is present, it
binds the selector to exact source bytes.

### 3.4 Observation

An observation may preserve a surface occurrence and group multiple spans.
It is optional. It must not add semantic fields such as intent or actor; those
belong to semantic records.

## 4. Semantic layer

### 4.1 Entity

An entity identifies a mentioned participant, object, event, concept, or
mention. The initial model does not require an ontology. `type` is a local,
producer-declared label and cannot silently import external class semantics.

Aliases and coreference are represented by grounded semantic records or the
restricted `same_as` constraint. A matching label alone never merges IDs.

### 4.2 Semantic record

The general `record` form represents:

- `relation`;
- `property`;
- `intent`;
- `modality`;
- `polarity`;
- `alias`;
- `normalized_value`.

A record uses typed `subject`, `predicate`, `object`, or `value` fields as
appropriate. The registry validates field combinations. It does not include
`hypothesis`, `inference`, `conclusion`, or `decision`.

Reported, quoted, fictional, or negated content must retain the record needed
to avoid asserting it as an unqualified world fact. For example, a document's
claim can be represented as a `relation` whose subject is the source or
speaker and whose object is the stated proposition.

### 4.3 Normalization

Normalization is represented as provenance on a semantic record:

- surface input;
- canonical output;
- named deterministic rule;
- one or more grounded inputs owned by the normalization trace;
- required source/context anchors.

`next_week` is a valid symbolic normalization of “来週”. Resolving it to an
exact calendar interval is valid only if a source-grounded reference date,
calendar convention, and time zone are available. Calculating completion
probability from it is never normalization.

## 5. Possibility layer

### 5.1 Variable

A variable names one semantic slot, a value type, and declared candidates.
Variables are open by default. Candidate enumeration alone does not claim that
the list is exhaustive.

A variable projection has one of these resolution states:

- `resolved`: every complete represented world selects the same known value
  and the relevant domain is closed;
- `ambiguous`: more than one known value remains in complete represented
  worlds;
- `unknown`: the domain is open, no bounded value is represented, a required
  operand is unresolved, or limits prevent a complete determination;
- `inconsistent`: no satisfying represented world exists.

### 5.2 Candidate

A candidate denotes `variable = value`. Its declared order is semantic only
for stable presentation, never a preference order.

Candidate reporting has two independent axes:

| Axis | Values | Question answered |
| --- | --- | --- |
| support | `supported`, `unsupported`, `conflicted` | Does the source positively support this value assignment? |
| viability | `allowed`, `excluded`, `unknown` | What does the bounded constraint system establish for this assignment? |

An `allowed` result requires an explicit satisfying witness in the requested
represented scope. It does not mean likely, preferred, true, or positively
supported. An `excluded` result requires an unsatisfiability reason chain for
the candidate. `unknown` is used when neither result can be established.

### 5.3 Domain openness

For an open variable, materialization preserves an `unbound/open` projection
to represent possible unlisted values. It does not invent an `unspecified`
candidate in the source document.

A domain becomes closed only through a grounded closure constraint. In the
initial version this is a `one_of` constraint over all candidates of one
variable.

## 6. Initial constraints

Constraints are declarative, source-grounded, and unweighted. Candidate
references below denote boolean assignment literals.

### 6.1 `one_of`

```text
one_of(V, [C1, ..., Cn])
```

- All candidates belong to `V`.
- Exactly one listed candidate is selected in each represented world.
- The constraint closes `V` for that scope.
- An empty member list is invalid.
- Exhaustiveness must be grounded; the solver cannot infer it from a list.

### 6.2 `requires`

```text
requires(A, B) == A -> B
```

If a world selects `A`, it must select `B`. This does not positively select
either candidate. The reverse implication is not assumed.

### 6.3 `excludes`

```text
excludes(A, B) == not (A and B)
```

The relation is symmetric. It does not assert that one of the two candidates
must be selected.

### 6.4 `same_as`

```text
same_as(V1, V2)
```

The variables must take canonically equal, type-compatible values in each
represented world. Initial use is limited to source-grounded alias or
coreference identity. It is not a general ontology identity rule.

### 6.5 `distinct_from`

```text
distinct_from(V1, V2)
```

The variables must take different, type-compatible values. Absence of
`same_as` does not imply `distinct_from`.

## 7. Propagation and conflicts

The engine may use any implementation strategy that preserves the versioned
semantics and deterministic results. Explanations must use public reason codes,
not backend-specific solver traces.

Permitted derived results include:

- a candidate has a satisfying witness;
- a candidate cannot occur in any satisfying assignment;
- a variable is resolved, ambiguous, unknown, or inconsistent;
- a named constraint participated in the result;
- the result is incomplete because a scope or limit was reached.

Forbidden derived source records include:

- “therefore the project is safe”;
- “therefore this actor is preferable”;
- an unstated causal relation;
- a selected candidate written back as an explicit recognition.

If a source-supported candidate is excluded, the engine reports
`supported_but_excluded`. If all candidates of a closed variable are excluded,
it reports `empty_closed_domain`. It never weakens or deletes a constraint to
make the document satisfiable.

## 8. Materialization

Materialization enumerates satisfying assignments only for explicitly selected
variables and their required constraint closure.

It must be:

- lazy;
- deterministic in candidate declaration order, with ID tie-breaking;
- bounded by a required positive `limit`;
- explicit about `truncated`, `complete`, and unresolved open variables;
- free of ranking, confidence sorting, or preferred-world selection.

A materialized interpretation is a view. It cannot be cited as direct source
support. A downstream reasoner may cite both the source variable and the
materialization query, but any choice among worlds remains reasoning.

## 9. Unknown cases

The engine returns `unknown` with at least one stable reason:

- `open_domain`;
- `no_declared_candidate`;
- `unresolved_reference`;
- `unresolved_constraint_operand`;
- `unsupported_constraint_version`;
- `scope_incomplete`;
- `limit_reached`;
- `source_not_verified` when live source verification was required by the
  query policy.

Unknown reasons are additive. Presentation must not replace them with “false,”
“possible,” or a fabricated fallback value.
