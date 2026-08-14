# Phase 5 acceptance

- Decision: accepted locally
- Accepted at: 2026-08-14T20:06:15+09:00
- Candidate revision: `84104b587b2985accd58775e315d698a27e7bf86`
- Contract: semantic and syntax version 0.1; ADR 0012 private local
  source-verification validation mode

## Accepted scope

The private, unreleased Phase 5 slice is accepted for explicit local source
verification on `document validate`:

- caller-supplied verification root and document-relative local locators;
- contained, no-symlink, regular-file-only, bounded, read-only source access;
- exact source-byte SHA-256 comparison without normalization;
- strict UTF-8 text, retained BOM content, exact LF and CRLF boundaries, and
  one-based half-open Unicode-scalar line and column ranges;
- exact selected-text and authored-quote comparison with typed digest, range,
  quote, source, completeness, truncation, and diagnostic projections;
- deterministic JSON and text results through the shared parser, semantic
  model, application service, presentation, and private adapter seam;
- feedback-separated path/digest and complete-selector dogfood rounds.

This acceptance does not add a source producer, provider, credentials, network
access, automatic repair, `llmthink` or `perttool` runtime integration, a public
package CLI binary, persistence, release, publication, tagging, or push.

## Verification evidence

The exact candidate passed the complete check on both configured CI matrix
runtimes using the cached local Node executables and no package download:

| Runtime | Check | Result |
| --- | --- | --- |
| Node.js 22.23.2, npm 11.19.0 | `npm run check` | passed |
| Node.js 24.19.0, npm 11.19.0 | `npm run check` | passed |

Each complete check included typecheck, ESLint, jscpd, Prettier, 44 Node test
cases, 39 documentation checks, and build. jscpd reported the two existing
clones and 22 duplicated lines: 0.20 percent of TypeScript lines and 0.19
percent of all analyzed lines, below the configured gate. `npm audit
--audit-level=high` reported zero vulnerabilities across all severities,
`npm ls --omit=dev --all` reported no production dependency, and `git diff
--check` passed.

The accepted boundary tests include root escape, symbolic-link and non-regular
sources, an outside or symbolic-link `.recog` document, a bounded-size failure,
and a deterministic source replacement during reading. The replacement case
returns `RCG-VERIFY-004` with `changed_during_read`, no actual digest, and no
selector claim.

A syscall trace of the built private command opened the input document with
`O_RDONLY` and the declared source with `O_RDONLY|O_NOFOLLOW`. It recorded zero
network syscalls and zero write-capable file opens. The traced command returned
the verified local result with status 0.

Dogfood evidence identities are:

| Evidence | SHA-256 |
| --- | --- |
| Minimal path/digest protocol v13 | `dbfb20b9eeaa060d0e2cc202d3b9e58a150b304cc498c090cd6d86c9b2dfcfb4` |
| Minimal path/digest receipt | `ec4c97e7a7d0b096ecd8f838dcc2befd60c0a05c3f72e13340b93ca186c0cebe` |
| Minimal path/digest feedback | `ec3a90eaab31f3945678b7d3a3bfb52e9dced0777edf5b7ae8da36b0a9215cc0` |
| Complete source-verification protocol v14 | `5ca75eaa30a0a9be71f4e9fa9f297a97e2ed65125a32a95b4c17003601099ad3` |
| Complete source-verification receipt | `066b0f9d67b3ae59d365249170f768e2f41c47fad4718b16f3b6d3efefb012d6` |
| Complete source-verification feedback | `1cac5cdbc00a7dbaad6b69cf96892e8465319a1779e906cbc3f4902db436c3ec` |
| SourceVerification v1 schema | `ad7fb3db10cf5789bf12612a0877b13f9f5b09d28d6116a71c21e75d0d1419a8` |
| ValidationResult v2 schema | `563cd290c730a1c8f2d772c3f22a68ec7c0efe3bda201c1306a8a20069d24b61` |
| Frozen source-verification cases | `af403589d12e0dc2af1190185f2c5fe811a451261a55fa0868b37f8a3f0fc8af` |

Protocol v13 ran seven command cases twice. Protocol v14 ran eleven command
cases twice, including equivalent JSON and text success, range and quote
mismatches, an unsealed source, invalid UTF-8, bare carriage return, BOM and
CRLF success, size failure, and mixed-source diagnostic truncation. Every pair
had identical status, stdout digest, and empty stderr digest; no projection
contained source content.

## Semantic, provenance, and responsibility audit

- Structural and semantic validation runs before source resolution. Invalid
  documents report local verification as blocked and perform no resolver read.
- Source identity remains separate from selector evidence. An unsealed source
  can have verified ranges and quotes but remains unverified and returns
  `RCG-VERIFY-007`.
- A stale source digest stops selector claims for that source. A verified
  digest does not hide an independently stale range or quote.
- Every declared source is evaluated in declaration order before the emitted
  diagnostic prefix is limited. Result-level completeness and truncation do
  not erase the complete source-verification projection.
- UTF-8 decoding is fatal. BOM is content, bare carriage return is rejected,
  CRLF selection is exact, and columns count Unicode scalars rather than UTF-16
  code units.
- The filesystem adapter opens sources only for reading, requires
  `O_NOFOLLOW`, compares file identity and metadata before and after reading,
  and compares the opened inode with the final path inode.
- Core modules import no filesystem, network, process-environment, terminal,
  clock, locale, provider, `llmthink`, or `perttool` API. Filesystem and path
  access remain in the private adapter; SHA-256 result construction remains in
  the application layer.
- The package remains private, has no `bin` field, and has no production,
  network/provider, editor, database, or related-project runtime dependency.

## Reviewed findings and remaining frontier

The minimal round found that the shared process receipt schema omitted the new
round and protocol values. Protocol v13 corrected that pre-run process boundary
without changing the public semantic contract. Complete-verifier use found one
incorrect expected quote digest in a frozen fixture; independent exact-byte
hashing corrected it before protocol v14 execution. Both observations are
accepted, both feedback artifacts are bound to exact receipts, and no
observation remains unresolved.

Actual use did not justify a point change for the separately gated producer
frontier. Freezing a provider-neutral producer contract remains 8p, and one
separately authorized adapter remains 21p. Those estimates are planning
evidence, not authorization to design or implement Phase 6 in this acceptance.

Remote CI was not triggered for this local candidate, and no new push,
publication, release, or tag was performed. Phase 6 remains a separate gate.
