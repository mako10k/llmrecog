# ADR 0012: Phase 5 fail-closed local source verification

- Status: Accepted
- Date: 2026-08-14

## Context

Semantic contract 0.1 records source locators, exact-byte digests, Unicode-
scalar text ranges, and optional quotes. The accepted runtime deliberately
treats locators as data. Its result schemas expose only reserved
`none/not_requested` source-verification projections, so they cannot report
which local bytes, spans, or quotes were checked.

Phase 5 introduces the first locator I/O boundary. Allowing implementation to
choose its base directory, containment policy, symlink behavior, byte limit,
text decoding, mismatch order, or result shape would make a security and
provenance contract accidental. Reusing `ValidationResult.v1` with additional
fields would also mutate an accepted machine shape.

## Decision

Accept a private, read-only `--verify-sources local` validation mode under
semantic contract 0.1. This decision freezes the contract and fixtures before
runtime implementation; it does not claim that local verification is already
implemented.

### Command and compatibility boundary

The accepted route becomes:

```text
llmrecog document validate <file.recog> [--format text|json]
  [--max-diagnostics <positive-integer>]
  [--verify-sources none]

llmrecog document validate <file.recog> [--format text|json]
  [--max-diagnostics <positive-integer>]
  --verify-sources local
  --verification-root <directory>
  [--max-source-bytes <positive-integer>]
```

`none` remains the default and returns byte-identical
`Llmrecog.ValidationResult.v1` output. `--verification-root` and
`--max-source-bytes` are accepted only with `local`; `local` requires the
root. Every option occurs at most once. The default per-source limit is
1,048,576 bytes.

Local mode returns `Llmrecog.ValidationResult.v2`. It retains the v1 AST,
semantic document, validity, completeness, truncation, input identity, and
diagnostic fields, but replaces the reserved aggregate with the detailed
`Llmrecog.SourceVerification.v1` projection. No other command gains locator
I/O in Phase 5. Show, explain, audit, query, and materialize retain their
existing schemas and `none/not_requested` projections.

### Explicit root and local locator profile

The caller-supplied verification root is the filesystem authority boundary,
not the process working directory. The adapter resolves that explicit root
once to an existing directory. In local mode the explicitly supplied
`.recog` path must resolve to a regular, non-symlink file inside that root;
failure to establish this input boundary is an input/output failure with exit
status 3 and no typed validation result.

A local source locator must be a nonempty relative path using `/` separators.
Absolute paths, URI schemes, NUL, backslash, and empty path segments are not
in the local profile and yield `RCG-VERIFY-001`. `.` and `..` segments are
normalized without percent or URL decoding. Resolution starts at the
directory containing the resolved `.recog` document. A normalized path that
would leave the explicit root yields `RCG-VERIFY-002`.

Every existing component below the resolved root, including the final source,
must be observed as non-symlink. A symlink yields `RCG-VERIFY-003` even when it
would resolve back inside the root. The final object must be a regular file;
directories, devices, FIFOs, sockets, and other non-regular objects yield
`RCG-VERIFY-005`. A missing, unreadable, or otherwise unopenable source yields
`RCG-VERIFY-004`.

The adapter opens only for reading, rejects a final symlink at open time when
the platform supports that operation, compares the opened-file identity with
the path after reading, and rejects a changed identity as unavailable. If the
platform cannot establish the accepted no-symlink policy, local verification
fails closed rather than weakening it.

This is a bounded point-in-time observation, not a filesystem transaction.
An ancestor can change after the final check. A matching declared digest binds
the result to the bytes actually read, while the result and later dogfood
receipt identify the observation. Phase 5 does not claim permanent path
freshness or race-free filesystem snapshots.

### Exact bytes and bounded reads

The verifier checks the opened regular file size before reading and reads at
most the effective per-source limit. Exceeding the limit yields
`RCG-VERIFY-006`; partial bytes are not hashed or selector-checked.

SHA-256 is computed over the exact bytes read with no newline or Unicode
normalization. A missing declared digest yields `RCG-VERIFY-007` and the
source remains `unverified`, although its selectors may still be checked. A
declared mismatch yields `RCG-VERIFY-008`, marks the source `mismatch`, and
stops range and quote checks for that source. Expected and actual digests are
retained in the typed projection and diagnostic reason data.

### Text ranges and quotes

After a matching digest, or after recording a missing digest, a `text` source
is decoded as strict UTF-8. A UTF-8 BOM is content and is not stripped. Invalid
UTF-8 yields `RCG-VERIFY-009`. LF and CRLF are accepted line endings; a bare CR
yields `RCG-VERIFY-010`.

Positions remain one-based, start-inclusive/end-exclusive, and columns count
Unicode scalar values. Line terminators are not addressable columns. A range
that crosses lines selects the exact decoded intervening line terminators, so
a CRLF source requires `\r\n` in an exact cross-line quote. A missing line or
column yields `RCG-VERIFY-011` and prevents that span's quote check.

When a range is valid, its optional quote is compared to the exact selected
scalar sequence without normalization, case folding, trimming, or repair. A
mismatch yields `RCG-VERIFY-012`. The machine projection reports SHA-256 of
the expected and selected UTF-8 quote bytes instead of repeating source text
in diagnostics. No mismatch changes a locator, digest, range, quote, source,
or `.recog` file.

Sources are processed in validated source declaration order and their spans
in validated span declaration order. Path policy is checked before opening,
then regular-file and size policy, digest, UTF-8/line endings, each range, and
each quote. A failed prerequisite leaves later checks explicitly
`not_checked`.

### Result and outcome semantics

`Llmrecog.SourceVerification.v1` reports:

- mode, caller-supplied root, effective per-source byte limit, completion, and
  aggregate state;
- one ordered source entry with locator, root-relative resolved path when
  established, `verified|unverified|mismatch|unavailable` state, expected and
  actual digest state, and ordered span entries;
- each span's overall state, typed requested range and range state, and quote
  state plus expected/actual quote digests.

Aggregate `verified` means every declared source is digest-sealed and every
declared selector matches. Any other attempted source outcome produces
aggregate `failed`; per-source and per-span entries retain the distinct facts.
`blocked` means the `.recog` document was structurally or semantically invalid,
so no locator I/O occurred. `not_requested` is used only by mode `none`.

Structural and semantic validity remain properties of the recognition
artifact. A source-verification failure does not set `valid`,
`structural_valid`, or `semantic_valid` to false. On an invalid local-mode
document, validation returns v2 with `blocked`, an empty source list, and no
source locator reads.

The diagnostic limit controls the deterministic emitted diagnostic prefix;
it does not change which explicitly requested sources are verified after a
valid document is available. Result diagnostic order is existing validation
order followed by source declaration order, span declaration order, and code.
Verification diagnostic reason data is typed by this ADR and never includes
source or quote contents.

| Code | Exact `reason_data` fields |
| --- | --- |
| `RCG-VERIFY-001` | `source_id`, `locator`, `reason` (`absolute`, `uri_scheme`, `nul`, `backslash`, or `empty_segment`) |
| `RCG-VERIFY-002` | `source_id`, `locator` |
| `RCG-VERIFY-003` | `source_id`, `locator`, `component_index` |
| `RCG-VERIFY-004` | `source_id`, `locator`, `cause` (`not_found`, `permission_denied`, `changed_during_read`, `policy_unavailable`, or `io_error`) |
| `RCG-VERIFY-005` | `source_id`, `locator`, `kind` (`directory`, `fifo`, `socket`, `device`, or `other`) |
| `RCG-VERIFY-006` | `source_id`, `locator`, `limit_bytes`, `observed_bytes` |
| `RCG-VERIFY-007` | `source_id` |
| `RCG-VERIFY-008` | `source_id`, `expected_digest`, `actual_digest` |
| `RCG-VERIFY-009` | `source_id` |
| `RCG-VERIFY-010` | `source_id` |
| `RCG-VERIFY-011` | `source_id`, `span_id`, `reason` (`start_out_of_bounds` or `end_out_of_bounds`) |
| `RCG-VERIFY-012` | `source_id`, `span_id`, `expected_digest`, `actual_digest` |

Path, availability, type, and size diagnostics use the source ID and anchor
the locator field in the `.recog` input. A missing digest anchors the source
header; a digest mismatch anchors the digest field. Encoding and line-ending
diagnostics use the source ID and locator field. Range and quote diagnostics
use the span ID and anchor the respective range or quote field. These are
`.recog` syntax spans, never positions inside the opened source.

Exit status is selected after argument and input-file handling:

- 1 for structural/semantic invalidity or diagnostic truncation;
- otherwise 4 when aggregate local verification is `failed`;
- otherwise 0.

Usage failures remain 2 and `.recog`/root input-output failures remain 3.

Text and JSON are projections of the same v2 result. The text projection lists
the aggregate verification facts, then sources and spans in the same order,
including states, paths, ranges, and expected/actual digests. Repeated runs
with identical files and arguments are byte-identical.

### Fixtures and dogfood sequence

`test/fixtures/contracts/v0.1/source-verification/cases.json` freezes verified,
stale-digest, missing, root-escape, unsealed, range-mismatch, and quote-mismatch
outcomes. It includes a non-BMP scalar and a cross-line selector. Runtime tests
use its linked exact text projection for the verified case and add bounded
temporary cases for symlink components, non-regular files, invalid
UTF-8, bare CR, size limits, path races that can be reproduced safely, and
mixed-source ordering.

Protocol v11 begins dogfood immediately after only relative path, containment,
regular-file, bounded read, and digest checks are implemented. Its copied
fixtures exercise unchanged bytes, stale digests, missing files, root escape,
symlinks, non-regular files, and deterministic replay before range and quote
implementation. A successor protocol is required after that evidence is
dispositioned and before complete selector dogfood.

Static checks include jscpd through `npm run check` at each implementation
gate.

## Consequences

- Existing mode-none validation and every non-validation route remain
  compatible with their accepted v1 schemas and goldens.
- Local verification is explicit, contained, bounded, read-only, and
  fail-closed without becoming semantic validity or truth certification.
- Missing digests remain visibly unverified even if a current quote happens to
  match.
- Digest mismatch prevents stale selectors from being presented as checked.
- The core continues to depend on no filesystem API; Phase 5 uses an
  inward-owned application resolver port and a private filesystem adapter.
- Verified bytes can become stale immediately after observation; consumers
  must retain the result or receipt identity rather than treating verification
  as a permanent source fact.

## Rejected alternatives

### Resolve relative locators from the process working directory

Rejected because the same artifact would identify different sources under an
ambient launch detail.

### Allow symlinks that resolve inside the root

Rejected for the first local profile because path replacement and containment
review become substantially harder. A more permissive resolver requires a new
profile and ADR.

### Treat a matching quote as exact source identity

Rejected because the same quote can occur in different or changed files. A
missing digest remains `unverified`.

### Repair a stale range by searching for the quote

Rejected because it would silently change authored provenance and could bind a
different occurrence.

### Extend `ValidationResult.v1` in place

Rejected because accepted consumers rely on its exact additional-properties-
false shape. Local mode uses a versioned successor while none remains
byte-identical.
