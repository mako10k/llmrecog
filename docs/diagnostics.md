# Diagnostic and reason-code contract v1

The machine authority is
[`contracts/diagnostics-v1.json`](../contracts/diagnostics-v1.json). Codes are
stable within semantic contract 0.1; English messages are presentation and may
be clarified without changing meaning.

## Diagnostic classes

| Prefix | Responsibility |
| --- | --- |
| `RCG-SYNTAX` | UTF-8, lexical, indentation, grammar, and recovery failures |
| `RCG-REF` | document-wide identity and reference resolution |
| `RCG-RECORD`, `RCG-VALUE`, `RCG-CANDIDATE` | semantic record and candidate shapes |
| `RCG-CONSTRAINT` | closed constraint vocabulary and operand shapes |
| `RCG-SOURCE`, `RCG-GROUND`, `RCG-SUPPORT` | source identity, provenance, and positive support |
| `RCG-BOUNDARY` | recognition/reasoning/realization responsibility violations |
| `RCG-OPEN`, `RCG-CSP` | open-world and possibility-space conflicts |
| `RCG-NORM`, `RCG-CONF` | normalization and producer-confidence misuse |

Diagnostics contain a stable code, severity, non-authoritative message,
optional entity ID, optional source span, typed reason data, and related
locations. Source order, code, and entity ID determine deterministic ordering.

For `.recog` syntax positions, `offset` is a zero-based UTF-8 byte offset into
the exact input bytes. Lines and columns are one-based; columns count Unicode
scalar values. A field diagnostic spans from the first non-indentation scalar
through the physical line ending. A declaration-wide missing-field diagnostic
anchors the declaration header. Missing or malformed version input that
prevents declaration parsing has no diagnostic span.

## Explanation reasons

`RCG-RSN-001` through `RCG-RSN-008` explain why viability is `unknown`.
`RCG-RSN-101` identifies a represented satisfying witness. Codes beginning at
`RCG-RSN-201` identify public, backend-independent constraint derivations.

An `allowed` result must contain a witness and `RCG-RSN-101`. An `excluded`
result must contain at least one grounded constraint derivation ending in
`RCG-RSN-206`. An `unknown` result must contain at least one of the unknown
reason codes. These reason records explain declared constraint application;
they are not llmthink inference or hidden model rationale.

## Focused boundary failures

- A forbidden `hypothesis`, `inference`, `conclusion`, `decision`, premise, or
  task role emits `RCG-BOUNDARY-001` even when it could also be described as an
  unknown declaration or record kind.
- A constraint without relationship-level grounding emits
  `RCG-GROUND-002`; operand grounding does not satisfy it.
- A normalization without its own grounded input or rule emits
  `RCG-NORM-001`.
- Authored viability, selection, probability, or weight fields emit the
  applicable syntax diagnostic and retain `RCG-CONF-001` or
  `RCG-BOUNDARY-001` as an audit finding when semantic intent is recoverable.
