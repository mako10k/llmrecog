# Phase 3 acceptance

- Decision: accepted locally
- Accepted at: 2026-08-14T15:36:24+09:00
- Candidate revision: `dfca52f5d5a1f4bd5324db7831591d2a329e35f8`
- Contract: semantic and syntax version 0.1; ADR 0008 and ADR 0009 private
  explain and focused-audit routes

## Accepted scope

The private, unreleased Phase 3 slice is accepted for:

- finite grounded `one_of` and symmetric `excludes` constraint semantics;
- independent source-support and CSP-viability projections;
- deterministic joint witnesses, minimal exclusion chains, and bounded
  `unknown` reasons;
- candidate and constraint explanation as JSON and text projections of the
  same typed result;
- the four focused CSP audit rules required by this slice, including authored
  declaration spans for empty-domain and supported-plus-excluded diagnostics;
- private dogfood through the real parser, semantic model, application, and
  command-adapter seam without locator I/O or persisted solver state.

This acceptance does not add `requires`, `same_as`, `distinct_from`, query,
materialization, source verification, a package CLI binary, a provider,
release, or publication.

## Verification evidence

The exact candidate passed the complete check on both configured CI matrix
runtimes:

| Runtime | Check | Result |
| --- | --- | --- |
| Node.js 22.22.3, npm 10.9.8 | `npm run check` | passed |
| Node.js 24.19.0, npm 11.17.0 | `npm run check` | passed |

Each complete check included typecheck, ESLint, jscpd, Prettier, 29 Node test
cases, 34 documentation checks, and build. jscpd reported two existing clones,
22 duplicated lines, and 0.30 percent duplicated lines, below the frozen gate.
`npm audit --audit-level=high` reported zero vulnerabilities across all
severities, and `git diff --check` passed.

Repeated private command runs were byte-identical for an allowed candidate, a
constraint explanation, an excluded candidate, a bounded-unknown candidate,
and both JSON and text audit output. The bounded-unknown and failed-audit cases
returned status 1 on both repetitions as required; the successful cases
returned status 0.

Dogfood evidence identities are:

| Evidence | SHA-256 |
| --- | --- |
| Ambiguity protocol v2 | `f86c886a9bb5b5ac801cd15bd1a94edac26b5afc7546d762d70a3bb1ffafc0b7` |
| Ambiguity receipt | `9a3c1835d903ee4b5b689ee1c4f30ab8edb4b1e8e3f73d6b51fa97aa34987e0f` |
| Ambiguity feedback | `bcadaa64061c13d88efbf65fb1ccddf2b97f07816ae411e58fbac51f8afe1ad3` |
| Exclusion protocol v3 | `868c33d5157f5d83355347247000bad4ec15901776bc22b4bcb6b10d356f6320` |
| Exclusion receipt | `571446d2c76ad52bd9e1efe521ea59dcfa256c651a8616fe081179a1a0739aff` |
| Exclusion feedback | `66189552bef809d8207e3cb227caeb246a6f35bcd53f356fcd32c51e57ef9f86` |

## Responsibility and dependency audit

- `npm ls --omit=dev --all` reports no production dependency.
- The public package entrypoint exports only `semanticVersion`; `package.json`
  is private and has no `bin` field.
- Core modules import only inward-owned modules. Filesystem and process access
  remain in the private command adapter, while input digest construction
  remains in the application layer.
- No source write API, network API, provider SDK, MCP, LSP, `llmthink`, or
  `perttool` runtime dependency is present.
- Source support is never inferred from CSP viability. Joint witnesses prove
  allowed assignments; grounded exclusion chains prove excluded assignments;
  incomplete bounds and open or unsupported scopes remain explicit unknowns.
- Focused audit findings preserve stable ordering and rule codes. The
  application boundary maps validated semantic declaration IDs to parser spans
  without adding filesystem or presentation dependencies to the core.
- No materialized assignment space or derivation state is persisted, and no
  source locator is opened by explain or audit.

## Reviewed findings and remaining frontier

All five Phase 3 dogfood observations have an accepted or deferred
disposition, both feedback rounds are complete, and neither round has an
unresolved observation ID. Typed explain targets and audit declaration spans
were accepted and implemented. Multi-target authoring navigation was deferred
to the complete-constraint Phase 4 slice because it requires a broader result
contract rather than a Phase 3 semantic correction.

The Phase 3 status text in `requirements.md`, the frontier in
`implementation-phases.md`, and the active-process label in
`process/dogfooding.md` remain deliberately unchanged. Those exact documents
are members of immutable dogfood protocol v3, so changing them would invalidate
the accepted exclusion-run evidence. Their status and digests must be
rebaselined together in a new protocol before Phase 4 dogfood begins.

Remote CI was not triggered because this work was neither pushed nor published;
the two configured runtime targets were executed locally. Phase 4 remains
separately gated and is not authorized by this acceptance.
