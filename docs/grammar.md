# Text grammar contract 0.1

## Authority

The normative production grammar is
[`contracts/llmrecog-0.1.ebnf`](../contracts/llmrecog-0.1.ebnf). This document
defines scanner tokens, semantic shape checks, and recovery behavior that EBNF
alone cannot express. Both are frozen by ADR 0006.

## Input and scanner

- Input is UTF-8. Invalid byte sequences are errors. A UTF-8 byte-order mark is
  not accepted.
- LF and CRLF are accepted as one `NL` token. A bare CR is invalid. Raw bytes
  are retained for input identity; parsing does not normalize them.
- A physical final newline is required by canonical form but its absence is a
  recoverable syntax diagnostic.
- Exactly two ASCII spaces create each indentation level. Tabs outside JSON
  strings and indentation changes that are not multiples of two are invalid.
- The scanner emits `INDENT` and `DEDENT`. Blank lines and whole-line comments
  do not affect the indentation stack and are discarded before parsing.
- `#` begins a comment only when it is the first non-space character on a
  physical line. Trailing comments are invalid in 0.1.
- `SP` is exactly one ASCII space where shown by the grammar. Trailing spaces
  outside strings are invalid.
- Identifiers match `[A-Za-z][A-Za-z0-9_.-]*`. Declaration IDs share one
  document-wide namespace. Keywords are contextual and are not separate
  identifier values inside scalar fields.
- Strings use JSON escaping. Unescaped control characters and physical
  newlines are invalid. Decoding does not apply Unicode normalization.
- A text position is 1-based. Columns count Unicode scalar values. A range is
  start-inclusive/end-exclusive and must move forward lexicographically.

## Semantic registries and shapes

The EBNF recognizes controlled field sequences. Semantic validation further
applies these closed registries:

- source kind: `text`;
- support kind: `explicit`, `linguistic`, `normalized`, `ambiguous`;
- value type: `entity_ref`, `symbol`, `string`;
- record kind and shape:
  - `relation`: `subject`, `predicate`, `object`;
  - `property`: `subject`, `predicate`, `value`;
  - `intent`, `modality`, `polarity`: `subject`, `value`;
  - `alias`: `subject`, `object`;
  - `normalized_value`: `value` and `normalization`;
- constraint kind and shape:
  - `one_of`: `variable`, `members`;
  - `requires`: `antecedent`, `consequent`;
  - `excludes`, `same_as`, `distinct_from`: `left`, `right`.

`one_of.members` must be nonempty even though the recovered syntax node can
retain an empty list for a focused diagnostic. Every listed member must be a
candidate of the referenced variable. `same_as` and `distinct_from` operands
are variables; `requires` and `excludes` operands are candidates.

Every entity, record, variable, candidate, and constraint requires a nonempty
grounding path. Constraints additionally require positive support for the
relationship. Normalization requires its own `surface`, versioned `rule`, and
nonempty grounded input list; `anchors` records any additional context.

The record kinds `hypothesis`, `inference`, `conclusion`, and `decision`, and
top-level roles such as `premise` and `task`, receive the boundary diagnostic
`RCG-BOUNDARY-001`, not an extension fallback. Authored fields named
`allowed`, `excluded`, `unknown`, `selected`, `preferred`, `probability`, or
`weight` are invalid because they would persist derived or ranked state.

## Reference and source identity

- References are document-local IDs and are resolved only after syntax
  recovery completes.
- Relative source locators are data during Phase 1 and Phase 2. Validation
  performs no locator I/O by default.
- A digest is `sha256:` followed by 64 lowercase hexadecimal digits and is
  computed over exact bytes. Newline and Unicode normalization are forbidden
  before hashing.
- `observed_at` is an RFC 3339 timestamp supplied as source provenance. It is
  never replaced with command execution time.

## Recovery contract

Recovery is deterministic and bounded:

1. An unreadable UTF-8 stream or invalid/missing version header prevents
   declaration parsing.
2. A malformed top-level header skips to the next unindented recognized
   declaration keyword or EOF.
3. A malformed field skips to the next field at the same indentation or the
   block's `DEDENT`.
4. An unexpected deeper indentation skips that indentation subtree as one
   recovery unit.
5. An unterminated string skips only the physical line; strings never recover
   across lines.
6. Duplicate and missing fields remain represented on recovered syntax nodes
   so focused diagnostics can identify the declaration.
7. At most one primary syntax diagnostic is emitted for the same byte offset;
   related diagnostics may point to earlier declarations or fields.

A recovered AST sets `recovered: true`. Any syntax error prevents creation of
a valid `Llmrecog.SemanticDocument.v1`, but later independent declarations are
still checked when their structure is available. Diagnostic order is source
span, then code, then entity ID. A configured diagnostic limit sets
`complete: false` and `truncated: true`; it never changes `valid` to true.
