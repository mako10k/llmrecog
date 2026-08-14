# ADR 0007: Phase 2 read-only parse, validate, and show contract

- Status: Accepted
- Date: 2026-08-14

## Context

ADR 0006 froze the text, AST, semantic-document, validation, and explanation
contracts without authorizing a parser or CLI. Phase 2 now needs an executable
vertical-slice target, but the provisional CLI document did not yet define
machine results for `document show` or `recognition show`, exact diagnostic
anchors for every invalid fixture, or the behavior of failed show requests.

Leaving those choices to implementation would make parser recovery,
diagnostic spans, result ordering, and text/JSON parity accidental public
behavior. It would also blur the Phase 2 boundary by allowing show commands to
compute candidate viability or read source locators.

## Decision

The accepted Phase 2 implementation scope is limited to the private package's
deterministic, read-only parse/validate/show vertical slice against semantic
contract `0.1`. This ADR freezes its contract; starting implementation remains
a separate plan transition. The accepted command routes are:

```text
llmrecog document validate <file.recog> [--format text|json]
  [--max-diagnostics <positive-integer>] [--verify-sources none]
llmrecog document show <file.recog> [--format text|json]
  [--max-diagnostics <positive-integer>]
llmrecog recognition show <id> <file.recog> [--format text|json]
  [--max-diagnostics <positive-integer>]
```

The default format is text and the default diagnostic limit is 100. Phase 2
accepts only source-verification mode `none`; `local` remains reserved for
Phase 5 and is not silently ignored.

The machine results are:

- `document validate`: `Llmrecog.ValidationResult.v1`;
- successful `document show`: `Llmrecog.DocumentResult.v1`;
- `recognition show` after successful document validation:
  `Llmrecog.RecognitionResult.v1`, including a typed not-found result;
- either show command on a structurally or semantically invalid document:
  `Llmrecog.ValidationResult.v1`.

`DocumentResult.v1` is a compact inventory. It reports declaration counts,
source IDs, recognition IDs, variable candidate IDs, declarative open/closed
domain state, and constraint IDs. `closed` means that a validated grounded
`one_of` applies to the variable; it is not a resolved value or a CSP
viability result. `RecognitionResult.v1` returns exactly one declared semantic
record or a typed `RCG-REF-002` not-found diagnostic. Neither result contains
`allowed`, `excluded`, witnesses, reason chains, or any other Phase 3 solver
projection.

Arrays retain validated declaration order. Diagnostics are ordered by source
span, then code, then entity ID. Repeated runs over identical bytes with the
same arguments emit byte-identical JSON and text. JSON uses UTF-8, LF, two-
space indentation, and one final newline. Text is a projection of the same
typed result and has versioned goldens.

If a diagnostic limit is reached, only the deterministic prefix is returned,
`complete` is false, and `truncated` is true. Truncation never makes an invalid
document valid. Otherwise `complete` is true and `truncated` is false.

The `offset` member of a syntax position is a zero-based UTF-8 byte offset
into the exact `.recog` input. Lines and columns remain one-based, and columns
count Unicode scalar values. A field diagnostic starts at the first
non-indentation scalar of the field and ends at the next physical line start.
A declaration-wide missing-field diagnostic anchors the declaration header.
The version-header absence diagnostic has no span because declaration parsing
does not begin.

Normal result data, including document diagnostics, is written to stdout.
Usage and input/output failures are written to stderr. Exit status is 0 for a
complete valid result, 1 for document invalidity, a missing recognition target,
or diagnostic truncation, 2 for CLI usage failure, and 3 for input/output or
encoding failure.

The command adapter may resolve and read the explicitly supplied `.recog`
path. It may not read declared source locators, the process environment,
network, wall clock, locale, provider SDKs, llmthink, or perttool. It performs
no writes. Parsing, validation, lookup, and result construction are shared
application/core behavior rather than reimplemented by the CLI.

## Consequences

- Phase 2 implementation can be tested through exact AST, diagnostic, JSON,
  and text fixtures before adding product code.
- The package may add a private CLI entrypoint for these three routes while
  remaining `private: true`; this ADR does not create a release or package
  compatibility claim.
- A missing target is different from an invalid document and remains a typed
  recognition-show result.
- Source verification, constraint solving, explanation, audit, query,
  materialization, formatting, and mutation remain separately gated.
- Changing either show schema, diagnostic coordinate meaning, or command
  outcome mapping requires a later ADR and versioned fixtures.

## Rejected alternatives

### Return the entire semantic document from `document show`

Rejected because show is a compact inventory contract. The full typed
semantic document already exists inside `ValidationResult.v1` and can be used
by library consumers without creating a second whole-document projection.

### Treat a missing recognition ID as CLI usage failure

Rejected because the ID has valid syntax and the failure depends on the
validated document's contents. It is a typed lookup result, not an argument
grammar failure.

### Add viability to Phase 2 show output

Rejected because viability requires the separately gated Phase 3 constraint
slice. Phase 2 may report only declared candidates and grounded closure.

### Require or invent source verification

Rejected because declared locators are data in Phase 2. Reading them would
introduce the filesystem and source-race boundary reserved for Phase 5.
