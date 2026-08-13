# Development method

- Status: Active 0.1
- Date: 2026-08-13

## 1. Objective

Develop llmrecog through explicit semantic contracts and small executable
slices while preventing recognition logic from drifting into llmthink
reasoning or perttool realization.

## 2. Standard change flow

### 2.1 Intake

1. Inspect the current branch, status, and relevant source-of-truth documents.
2. State the concrete objective and files/contracts likely to change.
3. Separate requested scope from tempting adjacent work.
4. Define success, failure, unknown, and Non-goal cases.

### 2.2 Design and contract

For semantic or public behavior:

1. Apply the source-bounded responsibility test.
2. Add or update an ADR when meanings, compatibility, layer ownership, or a
   public result changes.
3. Update requirements and terminology.
4. Freeze grammar/schema/diagnostic changes before implementation.
5. Add representative examples and machine-verifiable fixtures.

A Markdown plan or example is design evidence, not runtime acceptance.

### 2.3 Test-first executable slice

1. Add one success case and its closest failure/unknown cases.
2. Exercise the real input -> parser/model -> validation/application -> result
   seam; avoid static tests that merely restate prose.
3. Implement only enough behavior to satisfy the accepted cases.
4. Keep deterministic core behavior independent of providers and hosts.
5. Add text/JSON parity tests when presentation exists.

For constraints, add truth-table cases, open-domain cases, conflicts, and
reason chains. For multiple variables, include a case where candidates are
individually allowed but jointly impossible.

### 2.4 Validation

During iteration, run the narrowest relevant command. Before completion run:

```sh
npm run check
git diff --check
```

Then review the diff against:

- source-boundedness;
- support/viability separation;
- open/unknown preservation;
- relationship-level grounding for constraints;
- deterministic ordering and limit reporting;
- Core/host/adapter dependency direction;
- documentation, examples, schema, and diagnostics consistency.

### 2.5 Closeout

Report:

- concrete artifacts changed;
- checks run and their results;
- remaining unknowns or deferred scope;
- the next safe frontier.

Commit, push, release, publication, related-repository changes, and plan-state
mutation are separate actions and require their own authorization.

## 3. Compatibility discipline

- The `.recog` semantic version, CLI contract, and each JSON Schema identity
  are separate versioned boundaries.
- A source grammar change does not silently change solver or audit meanings.
- Additive fields need defined absence/default behavior.
- Breaking changes require an ADR, migration path, and old/new fixtures.
- A package version never substitutes for machine-readable semantic/result
  versions.

## 4. Diagnostic discipline

Diagnostics must include:

- stable code;
- severity;
- source span when available;
- typed affected IDs;
- reason/cause data;
- related help topic once help exists.

Derived diagnostics are suppressed when an earlier syntax/reference failure
makes them unreliable. Human wording may improve without changing the stable
code and typed facts.

## 5. LLM/provider discipline

- LLMs may later produce draft recognitions through explicit adapters.
- The same parser, validator, and audit apply to generated and hand-authored
  artifacts.
- Model output is never a golden oracle or deterministic core result.
- Provider identity and confidence are metadata, not semantic weights.
- Core tests require no network, credentials, live model, or wall clock.

## 6. Definition of done

A change is done only when:

- accepted requirements and Non-goals are satisfied;
- relevant positive, negative, unknown, and conflict tests pass;
- public types and schemas are synchronized when applicable;
- examples accurately demonstrate the implemented contract;
- `npm run check` and `git diff --check` pass;
- no unrelated diff or unreported generated artifact remains;
- unresolved matters are explicit rather than silently defaulted.
