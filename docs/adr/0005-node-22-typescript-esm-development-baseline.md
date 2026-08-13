# ADR 0005: Node.js 22, TypeScript, and ESM development baseline

- Status: Accepted
- Date: 2026-08-13

## Context

The design baseline intentionally deferred the implementation language and
runtime. Repository initialization now needs one reproducible toolchain for a
shared deterministic core, CLI later, JSON Schema-aligned types, and possible
future Node-based adapters.

The inspected llmthink and perttool repositories both use npm, TypeScript,
ESM, a shared library core, and Node-hosted interfaces. perttool supports
Node.js 22 and 24 in CI; llmthink uses the Node test runner through `tsx` and
adds ESLint and Prettier quality gates.

## Decision

- Support Node.js `>=22`.
- Run CI on Node.js 22 and 24.
- Use npm and commit `package-lock.json`.
- Use strict TypeScript with ESM and NodeNext module resolution.
- Use the Node.js built-in test runner with `tsx` for TypeScript tests.
- Use ESLint, complexity limits, and Prettier for code/config surfaces.
- Aggregate the complete repository gate under `npm run check`.
- Begin with zero production dependencies.
- Keep the package at private version `0.0.0` with no `bin` or publication
  settings until those contracts are separately accepted.
- Expose only a minimal library entrypoint during initialization; do not create
  parser, solver, or adapter stubs.

## Alternatives considered

### Adopt the locally installed Node.js 25 as the minimum

Rejected because a developer machine's current runtime is not a support policy
and both related projects provide a maintained lower baseline.

### Copy llmthink or perttool package/adapters wholesale

Rejected because their MCP/LSP/VSIX, release, license, and product dependencies
are not llmrecog initialization requirements.

### Delay all executable tooling until the parser contract

Rejected because docs checks, CI, strict types, and the test harness can be
verified now without implementing product semantics.

## Consequences

- Developers need Node.js 22 or later and npm.
- CI catches accidental Node.js 24-only behavior while 22 is supported.
- TypeScript types and future JSON Schemas can evolve together.
- The initialized repository has development dependencies but no runtime
  dependency or network requirement for normal checks after `npm ci`.
- Publication remains impossible through ordinary npm commands while
  `private: true` is present.
- License and release-channel decisions remain unresolved and separately
  gated.

## Auditability notes

Reconsider this decision if a required runtime API, maintained Node release
policy, cross-runtime library requirement, or measured tooling limitation
changes. Raising the minimum, adding production dependencies, adding `bin`, or
removing `private` requires a later ADR and package acceptance evidence.
