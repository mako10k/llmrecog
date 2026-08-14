# Phase 2 acceptance

- Decision: accepted locally
- Accepted at: 2026-08-14T12:16:32+09:00
- Candidate revision: `60eeee99ebfc54c41da543794e51df109be48e60`
- Contract: semantic and syntax version 0.1; ADR 0007 read-only routes

## Accepted scope

The private, unreleased Phase 2 read path is accepted for:

- deterministic UTF-8 bytes-to-AST parsing with bounded recovery;
- semantic construction and validation for all nine contract 0.1 declaration
  kinds;
- document validation, document show, and recognition show as JSON and text
  projections of the same typed results;
- private authoring dogfood with no source-locator verification or writes.

This acceptance does not create a package CLI binary or accept a solver,
materializer, source-verification adapter, provider, release, or publication.

## Verification evidence

The exact candidate content passed clean-install checks on both CI matrix
runtimes:

| Runtime | Install and check | Result |
| --- | --- | --- |
| Node.js 22.22.3, npm 10.9.8 | `npm ci`, `npm run check`, `git diff --check` | passed; 0 audit vulnerabilities |
| Node.js 24.19.0, npm 11.17.0 | `npm ci`, `npm run check`, `git diff --check` | passed; 0 audit vulnerabilities |

Each complete check included typecheck, ESLint, jscpd, Prettier, 23 Node test
cases, documentation checks, and build. jscpd reported two existing clones,
22 duplicated lines, and 0.44 percent duplicated lines, below the frozen gate.

The contract tests prove:

- all 67 EBNF productions and all 13 boundary cases remain registered;
- every frozen valid fixture reaches a schema-valid semantic model;
- every frozen invalid fixture retains its exact diagnostic code, typed reason
  data, and source span;
- repeated private CLI runs are byte-deterministic;
- both dogfood receipts and feedback artifacts bind their exact protocol,
  artifact, receipt, question, command, and observation identities.

Dogfood evidence identities are:

| Evidence | SHA-256 |
| --- | --- |
| Grammar receipt | `b15a090cc6004a3e3fb1af2982cca1fdaa4396f0fbcdcbab31549c1890b5e444` |
| Grammar feedback | `c03dd8e90f6ab5ad2e960a36eaf18db34adfdbf466398ff99ff58d67ffb5f522` |
| Specification receipt | `50fe66d795450f4b2171a78b592021fcc205599c758722d2c99ed8d9103a61c2` |
| Specification feedback | `bcdee3354e0d190af93b4e7c5fb071cdd4ad1901f8c87ff1c513edb78f6b897f` |

## Responsibility and dependency audit

- `npm ls --omit=dev --all` reports no production dependency.
- The public package entrypoint exports only `semanticVersion`; `package.json`
  is private and has no `bin` field.
- Core modules import only inward-owned parser and type modules. Filesystem and
  process access exist only in the private command adapter; deterministic input
  digest construction remains in the application layer.
- A file-operation trace of specification dogfood validation opened the input
  `.recog` once and opened none of its four source locators.
- No source write API, network API, provider SDK, `llmthink`, or `perttool`
  runtime dependency is present.
- Validation checks declarative constraint shape, membership, compatibility,
  grounding, and closure. It does not propagate constraints, produce a witness,
  or classify a candidate as allowed, excluded, selected, preferred, or solver
  unknown.
- Document show labels a domain closed only when a validated grounded `one_of`
  is present. Candidate inclusion remains separate from support and viability.

## Reviewed findings and remaining frontier

All grammar and specification dogfood observations have an accepted, rejected,
or deferred disposition, with no unresolved observation ID. The grounded-summary
or filtering proposal was rejected for Phase 2 because dogfood-question grouping
is not a stable public semantic result and graph expansion belongs with the
future explain contract.

One documentation finding remains deliberately deferred: the status line in
`requirements.md` predates the private read path. That file is part of the
immutable protocol-v1 corpus, so its status and digest will be updated only in
a protocol-v2 baseline for the next CSP dogfood round. The explain/CSP and
dogfood estimate reserves 28p, including 2p for that rebaseline.

Remote CI was not triggered because this work was neither pushed nor published;
the two configured runtime targets were instead executed locally from clean
dependency installs. Phase 3 remains separately gated and is not authorized by
this acceptance.
