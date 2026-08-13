# Canonical formatting contract 0.1

This contract defines deterministic semantic rendering. It does not introduce
a formatter command or authorize in-place writes.

## Bytes and whitespace

- UTF-8 without a byte-order mark;
- LF line endings;
- exactly one final newline;
- two spaces per indentation level and no tabs;
- no trailing whitespace;
- one blank line after the version header and between declarations;
- no blank lines inside a declaration or normalization block.

Strings use JSON double-quote escaping. Quotation marks, reverse solidus, and
control characters are escaped; other Unicode scalar values are emitted
without ASCII-only escaping. No Unicode normalization is applied. Confidence
uses `0`, `1`, or the shortest non-exponent decimal between them. Lists use
`, ` and retain semantic order.

## Declaration order

The canonical tier order is:

1. document;
2. sources;
3. spans;
4. observations;
5. entities and records;
6. variables, each followed by its candidates in the variable's declared
   candidate order;
7. constraints.

Within a tier, original declaration order is preserved, with ID as the stable
tie-breaker only for projections assembled from unordered machine input.
Declaration IDs and reference IDs are never rewritten.

## Field order

| Declaration | Canonical fields |
| --- | --- |
| document | `title` |
| source | `kind`, `locator`, `media_type`, `digest`, `observed_at` |
| span | `source`, `range`, `quote` |
| observation | `surface`, `grounded_in` |
| entity | `type`, `label`, `grounded_in`, `support`, `confidence` |
| record | `kind`, kind-specific value fields, `grounded_in`, `support`, `confidence`, `normalization` |
| variable | `value_type`, `candidates`, `grounded_in` |
| candidate | `value`, `grounded_in`, `support`, `confidence` |
| constraint | `kind`, kind-specific operands, `grounded_in`, `support`, `confidence` |
| normalization | `surface`, `rule`, `grounded_in`, `anchors` |

Absent optional fields are omitted. Grounding, candidate, member, and anchor
lists preserve declared order and remove no duplicates; duplicate entries are
a semantic diagnostic rather than a formatting repair.

## Comments and identity

Comments carry no semantics and are absent from the canonical semantic
projection. Contract 0.1 does not accept an in-place formatter, so it makes no
promise to discard or reposition comments in a user's source file. A future
write-capable formatter must separately freeze comment preservation and safe
preview behavior.

Digests always identify pre-render or post-render exact bytes as applicable.
Canonical rendering is not performed before digest verification, so rendering
can legitimately change a document digest.
