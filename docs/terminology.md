# Terminology

These definitions are normative for semantic contract 0.1.

## Source and grounding

**Source**
: An input artifact as presented to recognition: a document, conversation,
  source file, log, tool result, or other bounded artifact. A locator identifies
  where it came from; an optional digest identifies exact bytes.

**Source span**
: A typed selector into a source, plus an optional exact quote. The initial
  slice supports text positions and quotes. JSON pointers, symbols, byte
  ranges, and media regions are future selector profiles.

**Observation**
: An optional, minimally interpreted capture of a relevant surface occurrence.
  It can group one or more spans and preserve text or structural values before
  semantic interpretation. A direct span reference may be used when a separate
  observation would add no value.

**Grounding**
: A trace from a semantic record to source spans, possibly through an
  observation or a semantics-preserving normalization. Grounding says the
  source supports the recognition; it does not say the recognized content is
  true in the world.

**Provenance**
: The complete trace of source identity, span, support kind, normalization,
  producer, and deterministic derivation steps.

## Semantic records

**Recognition**
: The umbrella category for every source-grounded semantic declaration.
  `entity`, `relation`, `property`, semantic `record`, `variable`, `candidate`,
  and `constraint` declarations are recognition records; the initial DSL does
  not add a redundant `recognition` wrapper around each one.

**Entity**
: A source-presented participant, object, event, concept, or mention with a
  stable local identity. Identity is scoped to the recognition document unless
  explicitly linked by a grounded alias relation.

**Semantic record**
: A typed relation, property, intent, modality, polarity, alias, or normalized
  value that does not require its own specialized declaration form. Its kind
  names what the input meaning is, not what conclusion follows from it.

**Variable**
: A semantic slot whose value is not uniquely fixed by the source. A variable
  has declared candidate values and is open unless a grounded closure
  constraint makes the considered domain exhaustive.

**Candidate**
: One identified value assignment for a variable. Candidate inclusion is not
  candidate selection. A candidate can have positive source support or can be
  present only to describe a bounded domain.

**Constraint**
: A source-grounded restriction on candidate combinations. A constraint is not
  a free rule invented by the solver. The initial kinds are `one_of`,
  `requires`, `excludes`, `same_as`, and `distinct_from`.

**Normalization**
: A traceable, semantics-preserving mapping from a surface form to a canonical
  representation. It must identify its rule. It does not estimate, predict, or
  choose a preferred meaning.

**Possibility space**
: The factorized set described by variables, candidate domains, and
  constraints. It is the primary ambiguity representation.

**Materialized interpretation**
: One deterministic, query-scoped satisfying assignment emitted from the
  possibility space. It is derived output, not a new recognition or decision.

**Represented assignment**
: One deterministic tuple containing a declared candidate or the internal
  open/unbound branch for each effective-scope variable. It is an evaluation
  input, not automatically a satisfying world or source recognition.

**Indeterminate constraint evaluation**
: A result in which an open/unbound value prevents proving either satisfaction
  or violation. It cannot serve as an allowed witness or an exclusion reason.

## Support and state

**Support kind**
: Why a semantic record is grounded. The initial closed vocabulary is:

- `explicit`: directly present as text or source structure;
- `linguistic`: supported by grammar, coreference, or linguistic convention;
- `normalized`: a semantics-preserving canonicalization under a named rule;
- `ambiguous`: one plausible reading among multiple source-supported readings.

Support kinds do not form a numeric strength ordering.

**Producer confidence**
: Optional metadata about a producer's assessment, represented from 0 through
  1. It is not a probability, truth value, constraint weight, ranking input, or
  substitute for provenance. The deterministic core ignores it when deciding
  viability.

**Support state**
: Whether positive source backing exists for a candidate or record:

- `supported`: at least one valid grounding provides positive support;
- `unsupported`: a declared record has no valid positive grounding;
- `conflicted`: positive grounded records disagree in a way the core can
  mechanically identify.

`unsupported` is normally an audit finding, not permission to delete the
record.

**Viability**
: A solver result for a candidate in an explicit query scope:

- `allowed`: the bounded solver found at least one satisfying assignment that
  contains the candidate;
- `excluded`: the bounded solver proved that no satisfying assignment in scope
  contains the candidate and retained a reason chain;
- `unknown`: the solver cannot establish either result because the domain is
  open, an operand/reference is unresolved, a semantic feature is unsupported,
  or a declared limit prevents completion.

Support and viability are orthogonal. In particular:

- `supported + allowed` means the source supports the reading and a witness
  exists;
- `supported + excluded` is a conflict that must be shown, not hidden;
- `unsupported + allowed` means a witness exists but the source does not
  positively support that candidate;
- `unknown` is not shorthand for allowed and is never converted to false.

**Closed domain**
: A variable domain proven exhaustive for the requested scope by a grounded
  closure constraint. Merely listing candidates does not close a domain.

**Open domain**
: A domain in which unlisted values may exist. This is the default.

## Boundary terms

**Inference**
: A new proposition derived from recognized content. It belongs to
  `llmthink`, even when the derivation seems obvious.

**Constraint propagation**
: Mechanical removal or viability classification of assignments under
  already-declared, source-grounded constraints. It explains the represented
  possibility space but does not assert a new world proposition.

**Decision**
: A selection or commitment among alternatives. It belongs to `llmthink`;
  realization of an accepted decision belongs to `perttool`.

**Unknown**
: A first-class lack of bounded determination. It is neither a defect nor a
  claim that a value is possible.
