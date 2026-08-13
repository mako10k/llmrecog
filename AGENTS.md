# Repository Guidelines

## Scope and communication

These instructions apply to the whole repository.

English is the canonical language for tracked repository artifacts, including
requirements, specifications, ADRs, process documents, source comments,
diagnostics, and machine-readable fields. Preserve intentional Unicode source
fixtures such as the Japanese examples under `docs/examples/`; do not
translate user-authored source data. User communication may remain Japanese.

State verified facts, inferences, and unresolved matters separately. Do not
claim a command, schema, public API, package, or compatibility contract exists
until it exists in the current checkout and has been verified.

## Current phase and scope lock

`llmrecog` has a design baseline and a frozen executable contract 0.1, but no
parser, constraint solver, public CLI, or released package. The next separately
gated phase is Phase 2 in `docs/implementation-phases.md`: implement only the
parse/validate/show vertical slice against the accepted contract fixtures.

Completion of Phase 1 does not authorize:

- parser, solver, materializer, or provider implementation;
- changes in `llmthink`, `perttool`, SEMDL, or STDL;
- publication, release, tagging, remote pushes, or registry writes;
- adding MCP, LSP, VSIX, databases, embeddings, or network dependencies.

## Sources of truth

Read these in order when meanings conflict:

1. Accepted ADRs for the decision they cover.
2. `docs/requirements.md` and `docs/terminology.md`.
3. Focused architecture, semantic, provenance, DSL, CLI, and integration
   documents.
4. Normative examples and accepted machine-readable schemas/fixtures once
   present.
5. Development process documents and implementation plans.
6. Source code and generated artifacts.

The authority index is `docs/README.md`. Examples clarify an accepted contract
but do not silently extend grammar or semantics.

## Product responsibility boundary

Apply these tests before accepting a semantic feature:

1. Does cited input support the meaning? If no new proposition is being
   derived, the work may belong to llmrecog.
2. Does the operation describe a meaning space, or choose what follows? Choice,
   hypothesis, inference, conclusion, and decision belong to llmthink.
3. Does it turn an accepted decision into milestones, tasks, dependencies,
   resources, or execution state? That belongs to perttool.
4. Can deterministic `explain` identify source, normalization, constraint, and
   unknown reasons?

Never collapse source support into CSP viability. `supported`, `allowed`,
`excluded`, and `unknown` retain the meanings in `docs/terminology.md`.
Variables remain open unless grounded closure is declared. Constraint
propagation may classify assignments; it may not create a source recognition.

## Architecture and dependency rules

The implementation baseline is Node.js 22 or later, npm, TypeScript, and ESM.
The package remains private and has no CLI binary until a public CLI slice is
accepted.

Core semantic modules must not depend on:

- filesystem, network, process environment, terminal, wall clock, or locale;
- LLM/provider SDKs;
- llmthink, perttool, MCP, LSP, or editor APIs;
- CLI argument or presentation types.

Pass source text, reference time, locale/calendar policy, paths, limits, and
resolvers through explicit inputs or inward-owned ports. CLI and future
adapters must call shared application/core services and must not reimplement
parser, validation, constraint, or explain semantics.

Do not create directories for unimplemented layers in advance. Add a module
only with its accepted contract and first test-backed behavior.

## Development method

Use specification-first, fixture-first, vertical-slice development:

1. Inspect `git status --short --branch` and the relevant authorities.
2. Freeze the objective, acceptance criteria, non-goals, and affected contract
   versions.
3. For a semantic or public-contract change, update/add the ADR first.
4. Update requirements, terminology, examples, schemas, and diagnostics
   together where affected.
5. Add success and failure fixtures before or with implementation.
6. Implement the smallest end-to-end slice through the real parser/model/core
   seam.
7. Run focused checks, then `npm run check` and `git diff --check`.
8. Review the final diff for responsibility overlap, unknown collapse,
   accidental closure, ungrounded constraints, and provider leakage.

Do not weaken a parent requirement to make a local test pass. Do not use an
LLM result as a golden oracle; expected results must be explicit versioned
artifacts.

## Contract and test rules

- Public result types use stable names such as `Llmrecog.<Result>.vN` and have
  matching JSON Schemas before release.
- Text and JSON are projections of the same typed result; prose is not the only
  machine contract.
- Diagnostics have stable codes, severity, source span, and typed reason data.
- Deterministic ordering and explicit completeness/truncation are required.
- Tests cover success, failure, unknown, open-domain, conflict, and limit
  behavior. Multi-variable claims require joint-witness cases.
- Use the Node.js built-in test runner through the existing npm scripts.
- No test may require network access or a live LLM for the deterministic core.
- Dependency changes require lockfile review, `npm audit`, and review of npm 11
  install-script approvals. Never approve all install scripts by default.
- Generated `dist/`, coverage, caches, and runtime state are not committed
  unless a later distribution contract explicitly requires an allowlisted
  artifact.

## Repository commands

Initial setup and complete validation:

```sh
npm ci
npm run check
git diff --check
```

Focused checks:

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run check:docs
npm run build
```

Do not invent missing scripts in status reports. Add a script only when it
performs a real, documented check.

## Change and Git discipline

- Preserve user changes and keep unrelated work out of the current change.
- One change should contain one coherent capability or contract decision.
- Never use destructive Git commands to discard work.
- Local validation or a commit does not authorize a remote push, release,
  package publication, dist-tag change, or related-repository mutation.
- Publication and release need a separate accepted procedure, immutable
  candidate, and explicit authorization. The initialized package is private to
  prevent accidental publication.
- Report checks actually run and any checks not run.
