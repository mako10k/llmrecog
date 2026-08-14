# Architecture Decision Records

ADRs record decisions that change core semantics, public format/CLI contracts,
responsibility boundaries, or integration direction.

Status values are `Proposed`, `Accepted`, `Superseded`, and `Rejected`.
Changing an accepted decision requires a new ADR that names the superseded
record; accepted ADR history is not rewritten.

Current decisions:

- [0001: Source-bounded recognition](0001-source-bounded-recognition.md)
- [0002: Factorized open-world possibility space](0002-factorized-open-world-possibility-space.md)
- [0003: One-way optional llmthink integration](0003-one-way-optional-llmthink-integration.md)
- [0004: Recognition-aware llmthink grounding audit](0004-recognition-aware-llmthink-grounding-audit.md)
- [0005: Node.js 22, TypeScript, and ESM development baseline](0005-node-22-typescript-esm-development-baseline.md)
- [0006: Executable text and result contract v0.1](0006-executable-contract-v0-1.md)
- [0007: Phase 2 read-only parse, validate, and show contract](0007-phase-2-read-only-command-contract.md)

Future ADRs are required for changes to:

- support or viability meanings;
- constraint vocabulary or truth tables;
- source/reference identity;
- document or CLI compatibility versions;
- materialization completeness semantics;
- reverse-flow policy or related-project responsibility boundaries.
