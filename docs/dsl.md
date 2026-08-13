# `.recog` DSL contract 0.1

## 1. Status and goals

ADR 0006 freezes the first executable text contract before parser
implementation. The normative grammar and scanner/recovery rules are:

- [`contracts/llmrecog-0.1.ebnf`](../contracts/llmrecog-0.1.ebnf);
- [grammar.md](grammar.md).

The syntax is designed to be:

- line-oriented and indentation-based;
- explicit about record roles;
- stable under formatting and source control;
- easy for people and LLM producers to emit;
- strict enough that the parser never has to infer a block's role.

The source extension is `.recog` and the first header is `llmrecog 0.1`.

## 2. Lexical profile

- UTF-8 text.
- Two spaces per indentation level; tabs are invalid.
- IDs begin with an ASCII letter and contain ASCII letters, digits, `_`, `-`,
  or `.`.
- Strings use JSON-compatible double-quoted escaping.
- `#` starts a whole-line comment after indentation. Trailing comments are not
  part of the initial grammar.
- Lists use `[item, item]` and preserve declaration order.
- Source text stays in quoted fields; DSL keywords and enum values are ASCII.

Text source ranges are 1-based and start-inclusive/end-exclusive:
`start-line:start-column..end-line:end-column`.

## 3. Top-level declarations

```ebnf
document     := version-header document-decl declaration*
declaration := source | span | observation | entity | record
             | variable | candidate | constraint
```

Every declaration has one stable ID. IDs share one document-wide namespace so
that `explain R12` is unambiguous.

## 4. Declaration shapes

### 4.1 Document

```recog
llmrecog 0.1

document MEETING_RECOG:
  title "Meeting recognition"
```

`document` is required and occurs once. Version compatibility is controlled by
the header, not inferred from fields.

### 4.2 Source and span

```recog
source SRC1:
  kind text
  locator "meeting.txt"
  media_type "text/plain"
  digest "sha256:..."

span S1:
  source SRC1
  range 1:1..1:26
  quote "田中は佐藤に、彼が来週までには対応したいと伝えた。"
```

Initial source kind is `text`. `media_type`, `digest`, and `quote` are optional
syntax but audit can require them under a stricter profile. A range belongs to
exactly one source.

### 4.3 Observation

```recog
observation O1:
  surface "彼"
  grounded_in [S1]
```

Observation is optional. It preserves a source occurrence without asserting
what it refers to.

### 4.4 Entity

```recog
entity E_TANAKA:
  type person
  label "田中"
  grounded_in [S1]
  support explicit
```

`type` is a local label, not an imported ontology. `support` is required for an
entity that claims a positive source mention. Optional `confidence` may follow
`support`, but the deterministic core ignores it.

### 4.5 General semantic record

```recog
record R_DEADLINE:
  kind property
  subject E_RESPONSE
  predicate deadline
  value next_week
  grounded_in [S1]
  support normalized
  normalization:
    surface "来週まで"
    rule temporal.relative-week.symbolic.v1
    grounded_in [S1]
```

Initial record kinds are:

- `relation`: `subject`, `predicate`, and `object`;
- `property`: `subject`, `predicate`, and `value`;
- `intent`: `subject` and `value`;
- `modality`: `subject` and `value`;
- `polarity`: `subject` and `value`;
- `alias`: `subject` and `object`;
- `normalized_value`: `value` plus `normalization`.

Values may be strings, identifiers, entity references, or variable
references according to the kind registry. `hypothesis`, `inference`,
`conclusion`, and `decision` are invalid kinds.

### 4.6 Variable and candidate

```recog
variable V_ACTOR:
  value_type entity_ref
  candidates [C_ACTOR_TANAKA, C_ACTOR_SATO]
  grounded_in [S1, S2]

candidate C_ACTOR_TANAKA in V_ACTOR:
  value E_TANAKA
  grounded_in [S1]
  support ambiguous

candidate C_ACTOR_SATO in V_ACTOR:
  value E_SATO
  grounded_in [S1]
  support ambiguous
```

The variable itself requires `grounded_in` provenance and is open unless a
grounded closure constraint says otherwise. Candidate order is stable
presentation order, not preference. A candidate may
omit `support` when the source grounds only its membership in a described
domain and does not positively support it as the current value; it still
requires declaration provenance through `grounded_in`.

Authored `allowed`, `excluded`, `selected`, `preferred`, and solver `unknown`
fields are invalid. They are derived by a scope-bound query.

### 4.7 Constraints

```recog
constraint K_ACTOR_ONE_OF:
  kind one_of
  variable V_ACTOR
  members [C_ACTOR_TANAKA, C_ACTOR_SATO]
  grounded_in [S1]
  support linguistic

constraint K_TANAKA_NOT_WEAK:
  kind excludes
  left C_ACTOR_TANAKA
  right C_COMMITMENT_WEAK
  grounded_in [S2]
  support explicit
```

Shape by kind:

| Kind | Required fields |
| --- | --- |
| `one_of` | `variable`, nonempty `members` from that variable |
| `requires` | candidate `antecedent`, candidate `consequent` |
| `excludes` | candidate `left`, candidate `right` |
| `same_as` | compatible variable `left`, variable `right` |
| `distinct_from` | compatible variable `left`, variable `right` |

Every constraint requires `grounded_in` and `support`. The cited source must
support the relationship itself, not merely mention the operands.

## 5. Support and confidence syntax

The short form:

```recog
support linguistic
confidence 0.72
```

means that the declaration has a positive support record of that kind and
optional producer confidence. Confidence must be between 0 and 1. It is
metadata, not a CSP weight.

A future extended support block may add producer and prompt identities. That
extension must preserve the short form's semantics.

## 6. Minimal complete example

The reviewable example and its exact source are:

- [examples/minimal.recog](examples/minimal.recog)
- [examples/meeting.txt](examples/meeting.txt)

It demonstrates:

- explicit entities and an action;
- an ambiguous actor;
- an ambiguous commitment strength;
- symbolic date normalization;
- two explicitly grounded `one_of` closures;
- one explicit cross-variable exclusion.

It intentionally does not state a selected actor, exact calendar deadline,
completion probability, recommendation, decision, or task.

## 7. Canonical formatting

The future formatter must preserve declaration meaning and IDs. Canonical
order is:

1. version and document;
2. sources;
3. spans;
4. observations;
5. entities and records;
6. variables and their candidates;
7. constraints.

Within a semantic dependency tier, original declaration order is preserved.
Fields have a kind-specific canonical order. Comments cannot carry semantic
meaning. The semantic canonical projection omits them; an in-place formatter
and its comment-preservation policy remain deferred. Exact rendering rules are
in [canonical-formatting.md](canonical-formatting.md).

## 8. Deliberately absent syntax

The initial grammar has no:

- hypothesis, inference, conclusion, decision, premise, or task block;
- arbitrary expressions or user-defined constraint functions;
- probability or candidate weight;
- imports, ontology terms, embeddings, or vector references;
- query blocks or mutation syntax;
- sidecar profile;
- persisted derivation or materialized interpretation block.

These omissions keep the language source-bounded and the first parser surface
small.
