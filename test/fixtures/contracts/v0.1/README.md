# Contract 0.1 fixtures

[`manifest.json`](manifest.json) is the machine index for the Phase 1
executable contract.

- `valid/` contains source documents that the future parser and semantic
  validator must accept.
- `invalid/` contains focused failures and the stable diagnostics that must be
  present. Additional recovery diagnostics are permitted only when they do not
  replace the listed focused code.
- `expected/` contains deterministic AST, diagnostic, ValidationResult,
  DocumentResult, RecognitionResult, ExplainResult, AuditResult, QueryResult,
  MaterializationResult, and text projections. JSON results and ASTs validate
  against the schemas in `schemas/`; the diagnostic fixture set freezes exact
  codes, typed reason data, and byte/line/column spans for every invalid Phase
  1 input.

The `all_declarations` fixture maps every normative EBNF production to at least
one source occurrence. The boundary-case map covers every case in
`docs/examples/boundary-cases.md`, including open unknown, unsupported but
allowed candidates, propagated exclusion, reasoning handoff, and prohibited
backflow.

These fixtures are contract authority, not evidence that a parser, solver, or
space route exists. Implemented Phase 2 and Phase 3 outputs match their
artifacts through real seams; Phase 4 runtime remains separately gated.
Accepted text goldens use UTF-8, LF, and one final newline and are projections
of their adjacent JSON result goldens.
