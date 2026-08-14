# Developing llmrecog

This document is the maintainer setup guide. Repository-wide rules are in
[AGENTS.md](../AGENTS.md); the detailed change method is in
[process/development-method.md](process/development-method.md).

## Prerequisites

- Node.js 22 or 24
- npm
- Git

Node.js 22 is the minimum supported runtime. CI runs the same repository gate
on Node.js 22 and 24. A newer local Node.js version is useful development
evidence but does not replace either supported CI target.

## Setup and verification

```sh
npm ci
npm run check
git diff --check
```

Focused checks:

```sh
npm run typecheck
npm run lint
npm run check:duplication
npm run format:check
npm test
npm run check:docs
npm run build
```

During Phase 2, the complete but unreleased read path is invoked through the
private dogfood adapter:

```sh
npm run dogfood:cli -- document validate <file.recog> --format json
npm run dogfood:cli -- document show <file.recog> --format text
npm run dogfood:cli -- recognition show <id> <file.recog> --format json
```

This script is a dogfood instrument. It is not a package `bin`, public CLI, or
compatibility promise, and it performs no source-locator I/O or writes.

`npm run check:duplication` runs pinned jscpd 5.0.15 over authored TypeScript
and JavaScript under `src/`, `test/`, and `scripts/`, plus the ESLint config.
The checked baseline uses mild mode, a minimum clone size of 5 lines and 50
tokens, and a maximum duplicated-line percentage of 0.62. Generated output,
coverage, dependencies, and normative fixture data are excluded. The initial
2026-08-14 measurement found 2 existing clone pairs and 22 duplicated lines
out of 3,579 (0.61%); this is a baseline ceiling, not an instruction to
refactor semantic boundaries merely to reduce a metric.

`npm run check` is the single local and CI repository gate. It type-checks,
lints, checks duplication, verifies formatting, runs tests, validates
documentation structure, and builds declarations/source maps.

## Initialized repository shape

```text
llmrecog/
  .codex/                 conservative project-local defaults
  .github/workflows/      read-only CI
  contracts/              normative EBNF and code registries
  docs/                   requirements, specifications, ADRs, and process
  plans/                  perttool-managed coarse roadmap
  schemas/                versioned JSON machine contracts
  scripts/                repository checks, not product semantics
  src/core/               parser, typed model, and semantic validation
  src/application/        shared validate/show result construction
  src/presentation/       deterministic text projection
  src/adapters/           private dogfood command adapter
  src/index.ts            intentionally minimal public library entrypoint
  test/                   Node test-runner TypeScript tests
  AGENTS.md               canonical repository guidance
  package.json            private 0.0.0 development package
  tsconfig.json           strict NodeNext TypeScript contract
```

Schema and contract-fixture directories are Phase 1 artifacts; the current
core/application/presentation/private-adapter modules are the test-backed Phase
2 read path. Neither authorizes a solver, formatter, public CLI, or later
adapter before its corresponding accepted phase and first test-backed behavior.

## Runtime and package boundary

- Runtime: Node.js `>=22`
- Package manager: npm with committed `package-lock.json`
- Language/module: strict TypeScript, ESM, NodeNext resolution
- Tests: Node.js built-in test runner with `tsx` for TypeScript sources
- Production dependencies: none
- Schema-test dependencies: Ajv 8 and ajv-formats, development-only
- Publication: disabled by `private: true`
- CLI binary: intentionally absent until a public package/CLI acceptance

npm 11 records one exact install-script approval for `esbuild@0.28.2`, the
transitive binary helper used by `tsx`. When the lockfile changes, run
`npm install-scripts ls` under npm 11 and review each new script individually;
do not use blanket approval. Dependency review also includes `npm audit`.

The runtime decision is recorded in
[ADR 0005](adr/0005-node-22-typescript-esm-development-baseline.md). The text,
schema, and fixture baseline is recorded in
[ADR 0006](adr/0006-executable-contract-v0-1.md).

## Reference alignment

The baseline adopts practices common to the inspected related repositories:

- llmthink: TypeScript/ESM, shared library entrypoint, `tsx` tests,
  ESLint/Prettier, ADR and example-driven work;
- perttool: Node.js 22 minimum with 22/24 CI, strict compiler flags, one
  `npm run check` gate, `.editorconfig`, shared Core/thin adapter boundary, and
  specification-first changes.

It deliberately does not copy their current product code, adapters, release
settings, licenses, package publication settings, or project-specific
semantics.

## Generated files

`dist/`, `coverage/`, `node_modules/`, `.llmrecog/`, reports, and temporary
files are ignored. Normal development must not edit or review `dist/` as source
authority. Use `npm run build` to regenerate it locally.

## Release boundary

There is no release procedure yet. Do not remove `private: true`, add
`publishConfig`, choose a license, add a `bin`, tag, publish, or push a release
without a separately accepted release/package contract.
