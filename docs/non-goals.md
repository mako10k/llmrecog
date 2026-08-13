# Non-goals

The initial project explicitly does not aim to provide the following.

## Reasoning and truth

- A hypothesis, abduction, causal inference, theorem prover, or general rule
  engine.
- A conclusion, recommendation, ranking, optimization, or decision engine.
- Verification that source content is objectively true.
- Automatic enrichment from unstated common sense, web knowledge, model
  memory, or current runtime context.
- A probabilistic graphical model or numerical confidence propagation system.
- Selecting the most likely interpretation merely because a model assigns it
  the highest confidence.

## Planning and execution

- Tasks, milestones, dependencies, resources, estimates, acceptance gates, or
  execution state.
- Project control, work authorization, external-system mutation, or release
  automation.
- Automatic conversion of a recognized intent into a task or commitment.

## Knowledge representation and search

- A complete ontology language, RDF/OWL replacement, universal knowledge
  graph, or cross-domain identity authority.
- General graph query, vector database, embedding generation, or semantic
  search in the first version.
- Importing all SEMDL or STDL syntax and semantics.
- Persisting every possible interpretation world.

## Input production and interfaces

- A built-in provider-specific LLM extraction engine in the deterministic
  core.
- A mandatory dependency on `llmthink`, `perttool`, an MCP server, an editor,
  a database, or a network service.
- Automatic mutation of `llmthink` or `perttool` artifacts.
- Automatic promotion of `llmthink` inference or decision output into a
  recognition fact.
- Sidecar metadata, binary/media selectors, LSP, VSIX, MCP, and remote source
  resolution in the first vertical slice.

## Constraint engine

- Arbitrary user-defined predicates or executable expressions.
- Negation as failure or a closed-world default.
- Optimization over candidate assignments.
- Silent conflict repair, candidate invention, or domain closure.
- Unbounded global materialization.

These exclusions are responsibility locks, not statements that the use cases
are unimportant. A later extension must still preserve the Recognition ->
Reasoning -> Realization boundary.
