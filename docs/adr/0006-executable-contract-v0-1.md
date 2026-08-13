# ADR 0006: Executable text and result contract v0.1

- Status: Accepted
- Date: 2026-08-13

## Context

The design baseline names a `.recog` syntax, semantic records, diagnostics,
and JSON results, but it does not yet provide an executable parser target.
Implementation would otherwise have to invent field ordering, Unicode
coordinates, recovery behavior, normalization inputs, or result-state shapes.
Those choices affect source identity and the support/viability boundary.

## Decision

Freeze contract version `0.1` before implementing a parser:

- `contracts/llmrecog-0.1.ebnf` is the normative text grammar.
- The scanner accepts UTF-8 without a byte-order mark, LF or CRLF line endings,
  two-space indentation, JSON strings, ASCII identifiers, and whole-line
  comments. Raw tabs outside strings and trailing comments are invalid.
- Text range columns count Unicode scalar values, not UTF-16 code units,
  grapheme clusters, or encoded bytes. Ranges are 1-based,
  start-inclusive/end-exclusive.
- Digests are lowercase SHA-256 over exact source bytes. No newline or Unicode
  normalization occurs before hashing.
- Normalization records identify their own grounded inputs. Additional context
  anchors are explicit; the runtime clock and ambient locale are never hidden
  inputs.
- Syntax recovery synchronizes at line, indentation-block, and top-level
  declaration boundaries. A recovered AST is diagnostic evidence, not a valid
  semantic document.
- `Llmrecog.Ast.v1`, `Llmrecog.SemanticDocument.v1`,
  `Llmrecog.ValidationResult.v1`, and `Llmrecog.ExplainResult.v1` are the first
  machine contracts.
- Explain results always represent source support separately from CSP
  viability. `allowed` requires a witness, `excluded` requires a reason chain,
  and `unknown` requires one or more typed reasons.
- Diagnostic and derivation reason codes come from the versioned registry in
  `contracts/diagnostics-v1.json`; messages are non-normative presentation.
- Canonical semantic rendering uses LF, one final newline, two-space
  indentation, kind-specific field order, JSON string escaping, and stable
  declaration tiers. No formatter command is accepted by this ADR.

## Consequences

- Phase 2 can implement parser and validation behavior against reviewed
  fixtures instead of choosing public semantics in code.
- A digest changes when exact bytes change, including newline encoding or
  Unicode normalization form.
- Human-visible columns remain stable across Node.js and editor APIs that use
  different internal string indexing only when implementations count Unicode
  scalar values explicitly.
- Comments have no semantic meaning. The v0.1 semantic canonical projection
  omits them; a future in-place formatter needs a separate comment-preservation
  decision before it can write documents.
- JSON Schemas and fixtures are contracts, but this phase does not expose a
  runtime parser, validator, solver, CLI, or formatter.

## Rejected alternatives

### Let the first parser define edge cases

Rejected because implementation accidents would become compatibility rules.

### Count UTF-16 code units

Rejected because source coordinates would inherit a JavaScript-specific
representation and disagree for non-BMP source text.

### Normalize source text before hashing

Rejected because different input bytes would receive the same identity unless
the normalization profile itself became part of the digest contract.

### Merge support and viability into one status

Rejected because `supported + excluded`, `unsupported + allowed`, and open
unknown states are materially different audit facts.
