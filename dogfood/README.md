# Internal dogfood evidence

This directory contains the versioned, process-only dogfood protocol and later
run evidence. It is not part of the public llmrecog semantic or CLI contract.

The active Phase 3 protocol is
[`protocol-v3/protocol.json`](protocol-v3/protocol.json). It freezes the
post-implementation corpus, exclusion/conflict questions, explain/audit command
cases, artifact locations, and Round 3b review boundary. Immutable
[`protocol-v2/protocol.json`](protocol-v2/protocol.json) remains bound by the
completed Round 3a evidence, and
[`protocol-v1/protocol.json`](protocol-v1/protocol.json) remains bound by the
completed Phase 2 Round 1 and Round 2 evidence.

## Evidence layout

Each actual run uses this repository-relative layout:

```text
dogfood/runs/<run-id>/
  input.recog
  receipt.json
  feedback.json
```

`input.recog` is the manually authored recognition under test.
`receipt.json` is immutable execution and observation evidence conforming to
`Llmrecog.Internal.DogfoodRunReceipt.v1`. `feedback.json` is the later review
decision conforming to `Llmrecog.Internal.DogfoodFeedback.v1` and binds to the
exact receipt digest.

Captured stdout and stderr are identified by digest in the receipt. They are
committed only if a reviewed finding needs their exact bytes; otherwise the
receipt retains the command, status, digest, and concise observation needed to
reproduce them.

## Mutation rules

- Never edit a completed receipt. Reproduction creates a new run ID.
- Never replace a feedback file in place. A changed decision uses a new
  feedback ID and records the superseded feedback digest.
- A changed corpus document, question, schema, command case, or storage rule
  requires a new protocol version. Old evidence retains its original protocol
  digest.
- Example files under `protocol-v1/examples/` demonstrate the shared receipt
  and feedback shapes only and are never execution or acceptance evidence.
- Dogfood evidence becomes a normative product fixture only through a separate
  semantic/contract review.
