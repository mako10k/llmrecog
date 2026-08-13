# Repository Instructions

`AGENTS.md` is the canonical repository guidance shared by coding agents.
Keep this entrypoint aligned when durable workflow rules change.

Mandatory summary:

- Tracked project artifacts use English; preserve intentional Unicode source
  fixtures. User communication may be Japanese.
- The repository has design documents and a development scaffold, but no
  parser, solver, CLI, or released package.
- Follow ADR -> requirements/terminology -> focused specification -> examples
  and schemas -> implementation.
- Keep source support separate from constraint viability and preserve open and
  unknown states.
- Core semantics have no filesystem, network, wall-clock, provider, llmthink,
  perttool, or UI dependencies.
- Add behavior fixture-first in the smallest vertical slice. Run
  `npm run check` and `git diff --check` before completion.
- Remote writes, publication, release, and changes to related repositories are
  separately authorized work.
