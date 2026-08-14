# CLI contract

ADR 0007 accepts the Phase 2 `document validate`, `document show`, and
`recognition show` routes and their linked machine shapes. ADR 0008 accepts the
Phase 3 `recognition explain` and focused `document audit` contracts. ADR 0010
accepts all five contract-0.1 constraint meanings and the Phase 4 bounded
`space query` and `space materialize` routes. The private runtime now
evaluates all five constraint kinds and implements `space query`;
`space materialize` is not implemented. Accepted routes remain limited to an
unreleased private dogfood adapter. Source verification and all producer
routes remain provisional and separately gated.

## 1. Design rules

The CLI follows the resource-first style used by related tools. Its first
surface is read-only.

```text
llmrecog document validate|show|audit ...
llmrecog recognition show|explain ...
llmrecog space query|materialize ...
llmrecog help ...
llmrecog guide ...
```

- Text is the default human output.
- `--format json` emits the stable machine projection.
- stdout carries typed result data, including document diagnostics; stderr
  carries CLI usage and input/output failures.
- Core semantics are shared with future adapters.
- Unknown options, actions, and required operands are errors.
- No command in the initial contract writes a source or `.recog` file.

The short conceptual command `llmrecog explain R12` is intentionally not an
additional alias in v0.1. One canonical route avoids divergent help and
argument order: `llmrecog recognition explain R12 file.recog`.

## 2. Commands

### 2.1 Validate

```text
llmrecog document validate <file.recog> [--format text|json]
  [--max-diagnostics <positive-integer>] [--verify-sources none]
```

Validates syntax, types, IDs, references, record shapes, candidate membership,
constraint operands, and normalization requirements.

`--verify-sources none` is the Phase 2 default and performs no locator I/O.
`local` remains reserved for Phase 5 and is not accepted or silently ignored
by the Phase 2 command. Structural validity and source verification status
remain separate result fields.

The default diagnostic limit is 100. Reaching the limit returns the
deterministic diagnostic prefix, `complete: false`, and `truncated: true`; it
never changes an invalid result to valid.

JSON schema:
[`Llmrecog.ValidationResult.v1`](../schemas/Llmrecog.ValidationResult.v1.schema.json).

### 2.2 Show

```text
llmrecog document show <file.recog> [--format text|json]
  [--max-diagnostics <positive-integer>]
llmrecog recognition show <id> <file.recog> [--format text|json]
  [--max-diagnostics <positive-integer>]
```

`document show` gives a compact inventory and source/ambiguity summary.
`recognition show` returns the declared record without solving its possibility
space.

`document show` reports declaration counts and ordered source, recognition,
variable, candidate, and constraint IDs. A variable domain is `closed` only
when a validated grounded `one_of` applies; this is not a value selection or a
viability result. `recognition show` returns the declared semantic record. A
missing ID returns `found: false`, a null declaration kind and recognition,
and `RCG-REF-002`.

If either show route receives an invalid document, it returns
`Llmrecog.ValidationResult.v1` rather than a partial show projection.

JSON schemas:

- [`Llmrecog.DocumentResult.v1`](../schemas/Llmrecog.DocumentResult.v1.schema.json);
- [`Llmrecog.RecognitionResult.v1`](../schemas/Llmrecog.RecognitionResult.v1.schema.json).

### 2.3 Explain

```text
llmrecog recognition explain <id> <file.recog>
  [--scope <variable-id>[,<variable-id>...]]
  [--limit <positive-integer>]
  [--format text|json]
```

For a semantic record, explain follows grounding and normalization. For a
variable, candidate, or constraint, it additionally performs bounded analysis
as accepted by ADR 0008. The default scope is the smallest transitive
constraint closure containing the target. The default limit is 100 complete
represented assignments inspected; JSON always reports the effective limit.
The private runtime evaluates `one_of`, `excludes`, `requires`, `same_as`, and
`distinct_from`. The last three use the accepted three-valued open-operand
behavior and are no longer reported as skipped.

Required result facts:

- target declaration;
- support state and support records;
- viability or variable resolution state when applicable;
- source spans and source verification status;
- normalization trace;
- relevant constraints;
- witness or exclusion reason chain;
- unknown reasons;
- semantic version, scope, limit, completion, and truncation.

JSON schema:
[`Llmrecog.ExplainResult.v2`](../schemas/Llmrecog.ExplainResult.v2.schema.json).
The required `recognition` field carries the exact validated authored
declaration selected by the compact `target` identity. Derived support,
viability, resolution, scope, and reason projections remain separate fields.

### 2.4 Query

```text
llmrecog space query <file.recog>
  [--kind entity|record|variable|candidate|constraint]
  [--variable <id>]
  [--support supported|unsupported|conflicted]
  [--viability allowed|excluded|unknown]
  [--grounded-in <span-id>]
  [--limit <positive-integer>]
  [--format text|json]
```

Supplied filters are conjunctions and each option occurs at most once. Query
filters semantic recognitions only; it is a deterministic read-only filter,
not a predicate, graph, join, or query language. `--variable` selects only
candidates of that variable and establishes its requested solver seed.
Viability filters require `--variable`; a non-candidate kind with `--variable`
is a usage error. `--grounded-in` matches a validated provenance path to the
exact span without locator I/O. Results are ordered by declaration order then
ID.

The default limit is 100. The effective value independently caps returned
matches and complete represented assignments inspected for each requested
candidate viability. Reaching either cap before deterministic completion sets
`complete: false`, `truncated: true`; a limit-blocked viability remains
`unknown` with `RCG-RSN-007`. Query truncation exits with status 1.

JSON schema:
[`Llmrecog.QueryResult.v1`](../schemas/Llmrecog.QueryResult.v1.schema.json).

### 2.5 Audit

```text
llmrecog document audit <file.recog>
  [--profile base]
  [--fail-on warning|error]
  [--max-diagnostics <positive-integer>]
  [--format text|json]
```

The Phase 3 base profile applies the focused unsealed-source, unsupported
candidate/record, empty-closed-domain, and supported-but-excluded rules after
validation. It never calls an LLM or proposes a corrected interpretation. The
defaults are `base`, `fail-on error`, and 100 diagnostics. The broader audit
catalog and `strict-grounding` remain provisional.

JSON schema:
[`Llmrecog.AuditResult.v1`](../schemas/Llmrecog.AuditResult.v1.schema.json).

### 2.6 Materialize

```text
llmrecog space materialize <file.recog>
  --scope <variable-id>[,<variable-id>...]
  --limit <positive-integer>
  [--require-complete]
  [--format text|json]
```

Both scope and limit are mandatory to prevent accidental global expansion.
Scope is an ordered, duplicate-free existing-variable list and expands through
transitive constraint closure. The result lazily inspects complete represented
assignments in effective variable and candidate declaration order, with each
open branch last. The limit counts inspected assignments whether satisfying,
violated, or indeterminate. A one-step exhaustion check distinguishes an
exactly-limit complete result from truncation.

Only proved satisfying worlds are emitted. Open variables remain explicit and
no source candidate is invented. Indeterminate assignments, open variables,
and unknown reasons are counted separately. `complete` means the represented
generator was exhausted, not that an open domain is exhaustive. Without
`--require-complete`, reaching the limit is a successful truncated result.
With it, the same typed incomplete result exits with status 5.

JSON schema:
[`Llmrecog.MaterializationResult.v1`](../schemas/Llmrecog.MaterializationResult.v1.schema.json).

## 3. JSON result envelope

Every machine result contains at least:

```json
{
  "schema": "Llmrecog.ExplainResult.v2",
  "semantic_version": "0.1",
  "tool_version": "...",
  "input": {
    "path": "...",
    "document_id": "...",
    "digest": "sha256:..."
  },
  "complete": true,
  "truncated": false,
  "diagnostics": []
}
```

Record-specific payloads follow the frozen schemas. Support is always a
separate projection from candidate viability or variable resolution. Numeric
IDs or localized prose are never the only representation of a reason; stable
codes and entity references are required. Arrays preserve validated
declaration order.

JSON output uses UTF-8, LF, two-space indentation, and exactly one final
newline. With identical input bytes and arguments, both JSON and text output
must be byte-identical across repeated runs. A syntax position `offset` is a
zero-based UTF-8 byte offset into the exact `.recog` input; line and column are
one-based and columns count Unicode scalar values.

## 4. Exit statuses

| Code | Meaning |
| --- | --- |
| `0` | Complete valid result; non-failing warnings may still be present |
| `1` | Document invalidity, missing recognition target, explain/query/diagnostic truncation, or configured audit threshold failure |
| `2` | CLI usage error |
| `3` | Input/output failure |
| `4` | Required source/reference verification unavailable or mismatched |
| `5` | Complete result required but a declared scope/resource limit prevented it |

An ordinary truncated materialization without `--require-complete` returns 0
and sets `complete: false`, `truncated: true`.

## 5. Explain text example

```text
Candidate C_WEAK_COMMITMENT in V_COMMITMENT
  support: supported (ambiguous)
  viability: allowed
  source: meeting.txt 1:1..1:26 (not digest-sealed)
  witness:
    V_ACTOR = E_SATO
    V_COMMITMENT = weak_commitment
  constraints:
    K_COMMITMENT_ONE_OF satisfied
    K_TANAKA_NOT_WEAK not triggered for this witness
  scope: V_ACTOR, V_COMMITMENT
  complete: true
```

The output does not call the candidate probable or preferred.

## 6. Deferred commands

The initial contract does not include `extract`, `generate`, `edit`, `set`,
`remove`, `format`, `import`, `export`, or provider configuration. Each would
add a write, producer, or compatibility boundary and requires its own design
and acceptance examples.

Phase 4 accepts the `space` contracts, but neither route is implemented.
`--verify-sources local`, the
`strict-grounding` audit profile, producer routes, and every write remain
deferred.
