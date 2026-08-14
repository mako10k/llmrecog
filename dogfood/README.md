# Internal dogfood evidence

This directory contains the versioned, process-only dogfood protocol and later
run evidence. It is not part of the public llmrecog semantic or CLI contract.

The active Phase 5 protocol is
[`protocol-v14/protocol.json`](protocol-v14/protocol.json). It freezes complete
UTF-8, range, quote, size, ordering, and mixed-source dogfood after
[`protocol-v13/protocol.json`](protocol-v13/protocol.json) enabled a
schema-valid receipt following immutable
[`protocol-v12/protocol.json`](protocol-v12/protocol.json) omitted its own
round and path values from the process receipt schema. Protocol v12 replaced
the selector-bearing success case in immutable
[`protocol-v11/protocol.json`](protocol-v11/protocol.json) with a digest-only
fixture so the minimal verifier can dogfood path and digest behavior without
claiming that unimplemented range and quote checks ran. Both protocols precede
runtime dogfood evidence and have no bound run. Protocol v13 is bound to
completed path-and-digest evidence in
[`runs/LOCAL_PATH_DIGEST_20260814_01/receipt.json`](runs/LOCAL_PATH_DIGEST_20260814_01/receipt.json);
its observation is dispositioned by the bound `feedback.json`. Immutable
[`protocol-v10/protocol.json`](protocol-v10/protocol.json) remains bound to the
completed bounded-space replay, while
[`protocol-v9/protocol.json`](protocol-v9/protocol.json) remains bound to its
blocked first run,
[`protocol-v8/protocol.json`](protocol-v8/protocol.json) retains the exact
pre-materialization bounded-space baseline, and
[`protocol-v7/protocol.json`](protocol-v7/protocol.json) retains the exact
pre-query bounded-space baseline,
[`protocol-v6/protocol.json`](protocol-v6/protocol.json) remains bound by the
completed relational replay with the added known-mismatch and
compound-constraint explain cases,
[`protocol-v5/protocol.json`](protocol-v5/protocol.json) remains bound by the
blocked first relational receipt, and
[`protocol-v4/protocol.json`](protocol-v4/protocol.json) retains the exact
pre-implementation contract baseline and has no bound run receipt.
[`protocol-v3/protocol.json`](protocol-v3/protocol.json) remains bound by the
completed Phase 3 Round 3b evidence,
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
