# Contract 0.1 fixtures

[`manifest.json`](manifest.json) is the machine index for the Phase 1
executable contract.

- `valid/` contains source documents that the future parser and semantic
  validator must accept.
- `invalid/` contains focused failures and the stable diagnostics that must be
  present. Additional recovery diagnostics are permitted only when they do not
  replace the listed focused code.
- `expected/` contains deterministic ValidationResult and ExplainResult JSON
  projections validated against the schemas in `schemas/`.

The `all_declarations` fixture maps every normative EBNF production to at least
one source occurrence. The boundary-case map covers every case in
`docs/examples/boundary-cases.md`, including open unknown, unsupported but
allowed candidates, propagated exclusion, reasoning handoff, and prohibited
backflow.

These fixtures are contract authority, not evidence that a parser or solver
exists. Phase 2 and Phase 3 must make their outputs match these artifacts
through real implementation seams.
