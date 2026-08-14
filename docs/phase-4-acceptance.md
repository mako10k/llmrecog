# Phase 4 acceptance

- Decision: accepted locally
- Accepted at: 2026-08-14T18:32:04+09:00
- Candidate revision: `6dcedbad31aa6a993208251c35b6ab7e80d477cd`
- Contract: semantic and syntax version 0.1; ADR 0010 and ADR 0011
  private complete-core routes

## Accepted scope

The private, unreleased Phase 4 slice is accepted for:

- finite grounded `one_of`, `requires`, `excludes`, `same_as`, and
  `distinct_from` semantics over explicit scope closure;
- deterministic candidate and constraint explanations with joint witnesses,
  grounded reason chains, conflicts, and open-domain unknowns;
- bounded read-only conjunction query with declaration ordering, effective
  solver scope, positive limits, and typed completeness and truncation;
- bounded non-persisted materialization with explicit scope, inspected-
  assignment limits, deterministic world ordering, indeterminate open
  branches, and the `--require-complete` status-5 boundary;
- two completed Phase 4 dogfood rounds through the real parser, semantic core,
  application, presentation, and private command-adapter seam.

This acceptance does not add local source verification, a provider, an
`llmthink` or `perttool` integration, a public package CLI binary, persistence,
release, publication, tagging, or push.

## Verification evidence

The exact candidate passed the complete check on both configured CI matrix
runtimes:

| Runtime | Check | Result |
| --- | --- | --- |
| Node.js 22.23.2, npm 11.19.0 | `npm run check` | passed |
| Node.js 24.19.0, npm 11.19.0 | `npm run check` | passed |

Each complete check included typecheck, ESLint, jscpd, Prettier, 34 Node test
cases, 38 documentation checks, and build. jscpd reported the two existing
clones, 22 duplicated lines, and 0.24 percent duplicated TypeScript lines,
below the frozen gate. `npm audit --audit-level=high` reported zero
vulnerabilities across all severities, `npm ls --omit=dev --all` reported no
production dependency, and `git diff --check` passed.

Eight repeated private command cases were byte-identical for `requires`, a
known `same_as` mismatch, `distinct_from`, bounded query, exact materialization,
ordinary low-limit materialization, required-complete low-limit
materialization, and open-domain materialization. Successful cases returned
status 0 on both repetitions. The required-complete truncated case retained
the ordinary typed world prefix and returned status 5 on both repetitions.

Dogfood evidence identities are:

| Evidence | SHA-256 |
| --- | --- |
| Relational protocol v5 | `29c91b743677a0c14ad65e41a40a27ec942063d12d1c31987e5b9cc8971613b9` |
| Relational blocked receipt | `d4f7fab51dcde7d504364b76081faf60a6f2c6d48a4c1b7103d98be346c44d26` |
| Relational blocked-run feedback | `47434d16f27509917f5f4c1b3dc080e8077fccacf1aa814382d2b8aec2ea258a` |
| Relational protocol v6 | `c61ff3ea091d9d22b7064523eaf26146123e65e2b470a9b0046b04374fce458d` |
| Relational replay receipt | `084d1e830d9dcf0fb09ec7535c4b7d70cf4f06089a6c104e90cab013af53c757` |
| Relational replay feedback | `3fdeffbb1e464bc8d12c2b11a07749d4f41ed182ad2bb3e727d36ee530a2b3fc` |
| Bounded-space protocol v9 | `8ce28da57255e62dce10a0daf1bb599650c3b0388bf2fbdc3176a5e29b36522f` |
| Bounded-space blocked receipt | `240c5eb71d30f3f9f5590d28fcc6cea7a3c6ce57c810a7fe33d631af24997c5f` |
| Bounded-space blocked-run feedback | `6fe111172db35c9c92b0a306d2a3ba5741fb34f5bb9e1774e79aabeb2b0d3825` |
| Bounded-space protocol v10 | `1e83c13dbb7d3e04e29d378ac6480a0cba417fae2c5238d99893c8df88c7b058` |
| Bounded-space replay receipt | `de3714b7103b581add999b34f84a48cd959aaccd93f62c929b27ab615face730` |
| Bounded-space replay feedback | `cc3d5c8adbe934ae6bdc7b34781b45fcf013f20c6778809e4ad2b573b7794d8c` |

## Semantic and responsibility audit

- Exact contract tests cover all five constraint kinds through the shared
  finite relational evaluator. `requires` remains directional, `same_as` and
  `distinct_from` compare exact compatible typed values rather than candidate
  IDs, and `excludes` remains symmetric.
- Source support and CSP viability remain orthogonal. An allowed result has a
  complete joint witness; an excluded result has a grounded reason chain; an
  unsupported or open operand remains unknown rather than becoming false.
- Query is conjunctive and read-only. It adds no arbitrary predicates, joins,
  preference, ranking, choice, or conclusion.
- Materialization counts inspected assignments rather than emitted worlds,
  reports exact exhaustion, never invents an open candidate, and persists no
  world, cache, derivation, or solver state.
- Core modules import only inward-owned code. Deterministic digest construction
  remains in the application layer; filesystem access remains in the private
  command adapter.
- A file-open trace of bounded materialization opened the input `.recog` once
  and opened none of its three declared source locators. `--verify-sources
  local` remains unimplemented and fail-fast reserved for Phase 5.
- The package is private, has no `bin` field, exposes only the initialized
  package entrypoint, and has no production, network/provider, editor,
  database, `llmthink`, or `perttool` runtime dependency.

## Reviewed findings and remaining frontier

The first relational run and first bounded-space run remain immutable blocked
evidence. Protocol v6 supplied the missing known-mismatch and compound-
constraint cases, while protocol v10 supplied the missing ordinary low-limit
materialization case. Both replays answered every frozen question. Every Phase
4 observation has an accepted disposition, and both completed replay feedback
artifacts have no unresolved observation ID.

The separately gated local source-verification slice remains estimated at 16p:
4p contract and protocol, 5p implementation, 3p dogfood, 2p feedback, and 2p
acceptance. This acceptance does not start or authorize that work.

Remote CI was not triggered because this work was neither pushed nor
published; the two configured runtime targets were executed locally. Phase 5
remains a separate design and implementation gate.
