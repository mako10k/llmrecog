# ADR 0003: One-way optional llmthink integration

- Status: Accepted
- Date: 2026-08-13

## Context

Reasoning benefits from original-source provenance, but a mandatory dependency
would break llmthink's standalone use. A bidirectional synchronization path
could also relabel inference as recognition.

## Decision

Integration is optional and reference-based.

- llmrecog core does not depend on llmthink.
- llmthink remains valid with plain premise/evidence records.
- A future typed `RecognitionReference.v1` identifies a `.recog` target and
  frozen document digest.
- Variable references preserve ambiguity, openness, constraints, and unknown.
- Reasoning-time narrowing is recorded in llmthink.
- No conclusion or decision is automatically written into `.recog`.
- An explicit re-recognition request may create a new version from identified
  sources while preserving the downstream artifact's provenance role.

## Consequences

- The end-to-end provenance chain can be strengthened incrementally.
- Current llmthink file resources remain only a compatibility-level document
  link until typed target syntax is separately accepted there.
- Grounded-premise metrics can be added as optional audits without making
  llmrecog mandatory.
- Reverse-flow automation is forbidden by design.

## Rejected alternatives

### Make llmthink parse `.recog` as a mandatory premise format

Rejected because it couples release and runtime boundaries and removes plain
premise compatibility.

### Copy llmthink conclusions back as recognized facts

Rejected because it destroys the Recognition -> Reasoning provenance boundary.
