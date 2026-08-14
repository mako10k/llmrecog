import type {
  BinaryConstraintRecognition,
  CandidateRecognition,
  ConstraintRecognition,
  Recognition,
  SemanticDocument,
  SemanticValue,
  SupportRecord,
  VariableRecognition,
} from "./types.js";

export interface PublicReason {
  readonly code: string;
  readonly name: string;
  readonly subject_id: string;
  readonly constraint_id: string | null;
  readonly inputs: readonly string[];
}

export interface WitnessAssignment {
  readonly variable_id: string;
  readonly candidate_id: string;
  readonly value: SemanticValue;
}

export interface Witness {
  readonly assignments: readonly WitnessAssignment[];
  readonly open_variable_ids: readonly string[];
}

export type CandidateViability =
  | {
      readonly state: "allowed";
      readonly witness: Witness;
      readonly reason_chain: readonly PublicReason[];
      readonly unknown_reasons: readonly [];
    }
  | {
      readonly state: "excluded";
      readonly witness: null;
      readonly reason_chain: readonly PublicReason[];
      readonly unknown_reasons: readonly [];
    }
  | {
      readonly state: "unknown";
      readonly witness: null;
      readonly reason_chain: readonly [];
      readonly unknown_reasons: readonly string[];
    };

export type VariableResolution =
  | {
      readonly state: "resolved" | "ambiguous" | "inconsistent";
      readonly unknown_reasons: readonly [];
    }
  | {
      readonly state: "unknown";
      readonly unknown_reasons: readonly string[];
    };

export interface ExplainScope {
  readonly requested_variable_ids: readonly string[];
  readonly effective_variable_ids: readonly string[];
  readonly limit: number;
}

export interface SkippedConstraint {
  readonly constraint_id: string;
  readonly reason_code: "RCG-RSN-006";
}

export interface OneOfExplainAnalysis {
  readonly target: Recognition;
  readonly complete: boolean;
  readonly truncated: boolean;
  readonly support: {
    readonly state: "supported" | "unsupported";
    readonly records: readonly SupportRecord[];
  };
  readonly viability: CandidateViability | null;
  readonly variable_resolution: VariableResolution | null;
  readonly scope: ExplainScope | null;
  readonly relevant_constraints: readonly ConstraintRecognition[];
  readonly skipped_constraints: readonly SkippedConstraint[];
  readonly derivations: readonly PublicReason[];
}

export type OneOfExplainResult =
  | { readonly ok: true; readonly analysis: OneOfExplainAnalysis }
  | {
      readonly ok: false;
      readonly reason: "missing_target" | "invalid_scope";
      readonly id: string;
    };

export interface MaterializationSpaceAnalysis {
  readonly complete: boolean;
  readonly truncated: boolean;
  readonly requested_variable_ids: readonly string[];
  readonly effective_variable_ids: readonly string[];
  readonly inspected_assignment_count: number;
  readonly worlds: readonly Witness[];
  readonly indeterminate_assignment_count: number;
  readonly open_variable_ids: readonly string[];
  readonly unknown_reasons: readonly string[];
  readonly relevant_constraints: readonly ConstraintRecognition[];
}

export type MaterializationSpaceResult =
  | { readonly ok: true; readonly analysis: MaterializationSpaceAnalysis }
  | { readonly ok: false; readonly reason: "invalid_scope" };

interface ScopeContext {
  readonly requested: readonly VariableRecognition[];
  readonly effective: readonly VariableRecognition[];
  readonly relevant: readonly ConstraintRecognition[];
  readonly skipped: readonly SkippedConstraint[];
}

interface EnumerationResult {
  readonly satisfying: readonly Witness[];
  readonly blocker_derivations: readonly PublicReason[];
  readonly unknown_reasons: readonly string[];
  readonly inspected: number;
  readonly indeterminate: number;
  readonly truncated: boolean;
}

type AssignmentSelection = CandidateRecognition | null;

type ConstraintEvaluation =
  | { readonly state: "satisfied" }
  | { readonly state: "violated"; readonly reason: PublicReason }
  | { readonly state: "indeterminate"; readonly reason_code: "RCG-RSN-001" };

function recognitionsOfKind<K extends Recognition["declaration_kind"]>(
  document: SemanticDocument,
  kind: K,
): Extract<Recognition, { readonly declaration_kind: K }>[] {
  return document.recognitions.filter(
    (
      recognition,
    ): recognition is Extract<Recognition, { readonly declaration_kind: K }> =>
      recognition.declaration_kind === kind,
  );
}

function recognitionMap(
  document: SemanticDocument,
): ReadonlyMap<string, Recognition> {
  return new Map(
    document.recognitions.map((recognition) => [recognition.id, recognition]),
  );
}

function candidateVariableId(
  id: string,
  byId: ReadonlyMap<string, Recognition>,
): string | null {
  const recognition = byId.get(id);
  return recognition?.declaration_kind === "candidate"
    ? recognition.variable_id
    : null;
}

function constraintVariableIds(
  constraint: ConstraintRecognition,
  byId: ReadonlyMap<string, Recognition>,
): readonly string[] {
  if (constraint.constraint_kind === "one_of") {
    return [constraint.variable_id];
  }
  if (
    constraint.constraint_kind === "same_as" ||
    constraint.constraint_kind === "distinct_from"
  ) {
    return [constraint.left_id, constraint.right_id];
  }
  const operands =
    constraint.constraint_kind === "requires"
      ? [constraint.antecedent_id, constraint.consequent_id]
      : [constraint.left_id, constraint.right_id];
  return operands.flatMap((id) => {
    const variableId = candidateVariableId(id, byId);
    return variableId === null ? [] : [variableId];
  });
}

function referencedVariableId(
  target: Recognition,
  variables: ReadonlyMap<string, VariableRecognition>,
): string | null {
  if (target.declaration_kind !== "record") return null;
  const value = "object" in target ? target.object : target.value;
  return value.kind === "reference" && variables.has(value.id)
    ? value.id
    : null;
}

function targetVariableIds(
  target: Recognition,
  byId: ReadonlyMap<string, Recognition>,
  variables: ReadonlyMap<string, VariableRecognition>,
): readonly string[] {
  if (target.declaration_kind === "variable") return [target.id];
  if (target.declaration_kind === "candidate") return [target.variable_id];
  if (target.declaration_kind === "constraint") {
    return constraintVariableIds(target, byId);
  }
  const referenced = referencedVariableId(target, variables);
  return referenced === null ? [] : [referenced];
}

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

function buildScope(
  document: SemanticDocument,
  target: Recognition,
  requestedIds: readonly string[] | undefined,
): ScopeContext | null {
  const byId = recognitionMap(document);
  const variableList = recognitionsOfKind(document, "variable");
  const variables = new Map(
    variableList.map((variable) => [variable.id, variable]),
  );
  const seeds = unique(targetVariableIds(target, byId, variables));
  const requested = unique(requestedIds ?? seeds);
  if (
    requested.some((id) => !variables.has(id)) ||
    seeds.some((id) => !requested.includes(id))
  ) {
    return null;
  }
  if (requested.length === 0) {
    return { requested: [], effective: [], relevant: [], skipped: [] };
  }

  const constraints = recognitionsOfKind(document, "constraint");
  const effectiveIds = new Set(requested);
  let changed = true;
  while (changed) {
    changed = false;
    for (const constraint of constraints) {
      const operandIds = constraintVariableIds(constraint, byId);
      if (!operandIds.some((id) => effectiveIds.has(id))) continue;
      for (const id of operandIds) {
        if (effectiveIds.has(id)) continue;
        effectiveIds.add(id);
        changed = true;
      }
    }
  }
  const effective = variableList.filter((variable) =>
    effectiveIds.has(variable.id),
  );
  const relevant = constraints.filter((constraint) =>
    constraintVariableIds(constraint, byId).some((id) => effectiveIds.has(id)),
  );
  return {
    requested: requested.map((id) => variables.get(id)!),
    effective,
    relevant,
    skipped: [],
  };
}

function candidatesById(
  document: SemanticDocument,
): ReadonlyMap<string, CandidateRecognition> {
  return new Map(
    recognitionsOfKind(document, "candidate").map((candidate) => [
      candidate.id,
      candidate,
    ]),
  );
}

function oneOfConstraints(
  scope: ScopeContext,
  variableId: string,
): readonly Extract<
  ConstraintRecognition,
  { readonly constraint_kind: "one_of" }
>[] {
  return scope.relevant.filter(
    (
      constraint,
    ): constraint is Extract<
      ConstraintRecognition,
      { readonly constraint_kind: "one_of" }
    > =>
      constraint.constraint_kind === "one_of" &&
      constraint.variable_id === variableId,
  );
}

function viableCandidateIds(
  variable: VariableRecognition,
  scope: ScopeContext,
): readonly string[] {
  const closures = oneOfConstraints(scope, variable.id);
  if (closures.length === 0) return variable.candidate_ids;
  return variable.candidate_ids.filter((candidateId) =>
    closures.every((constraint) => constraint.member_ids.includes(candidateId)),
  );
}

function isClosed(variable: VariableRecognition, scope: ScopeContext): boolean {
  return oneOfConstraints(scope, variable.id).length > 0;
}

function selectionChoices(
  variable: VariableRecognition,
  scope: ScopeContext,
  candidates: ReadonlyMap<string, CandidateRecognition>,
  fixedTarget: CandidateRecognition | null,
): readonly AssignmentSelection[] {
  if (fixedTarget?.variable_id === variable.id) {
    return viableCandidateIds(variable, scope).includes(fixedTarget.id)
      ? [fixedTarget]
      : [];
  }
  const known = viableCandidateIds(variable, scope).flatMap((id) => {
    const candidate = candidates.get(id);
    return candidate === undefined ? [] : [candidate];
  });
  return isClosed(variable, scope) ? known : [...known, null];
}

function* assignments(
  scope: ScopeContext,
  candidates: ReadonlyMap<string, CandidateRecognition>,
  fixedTarget: CandidateRecognition | null,
  index = 0,
  selected: readonly AssignmentSelection[] = [],
): Generator<readonly AssignmentSelection[]> {
  const variable = scope.effective[index];
  if (variable === undefined) {
    yield selected;
    return;
  }
  for (const choice of selectionChoices(
    variable,
    scope,
    candidates,
    fixedTarget,
  )) {
    yield* assignments(scope, candidates, fixedTarget, index + 1, [
      ...selected,
      choice,
    ]);
  }
}

function witnessFromSelection(
  scope: ScopeContext,
  selected: readonly AssignmentSelection[],
): Witness {
  return {
    assignments: selected.flatMap((candidate, index) =>
      candidate === null
        ? []
        : [
            {
              variable_id: scope.effective[index]!.id,
              candidate_id: candidate.id,
              value: candidate.value,
            },
          ],
    ),
    open_variable_ids: scope.effective.flatMap((variable, index) =>
      selected[index] === null ? [variable.id] : [],
    ),
  };
}

function selectedCandidate(
  scope: ScopeContext,
  selected: readonly AssignmentSelection[],
  variableId: string,
): AssignmentSelection {
  const index = scope.effective.findIndex(
    (variable) => variable.id === variableId,
  );
  return index === -1 ? null : selected[index]!;
}

function valuesEqual(left: SemanticValue, right: SemanticValue): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "reference" && right.kind === "reference") {
    return left.id === right.id;
  }
  if (left.kind === "symbol" && right.kind === "symbol") {
    return left.value === right.value;
  }
  return (
    left.kind === "string" &&
    right.kind === "string" &&
    left.value === right.value
  );
}

type EqualityConstraint = BinaryConstraintRecognition & {
  readonly constraint_kind: "same_as" | "distinct_from";
};

function equalityViolationReason(
  constraint: EqualityConstraint,
  subjectId: string,
  inputs: readonly string[],
): ConstraintEvaluation {
  const identity =
    constraint.constraint_kind === "same_as"
      ? {
          code: "RCG-RSN-204",
          name: "same_as_value_mismatch",
        }
      : {
          code: "RCG-RSN-205",
          name: "distinct_from_value_collision",
        };
  return {
    state: "violated",
    reason: {
      ...identity,
      subject_id: subjectId,
      constraint_id: constraint.id,
      inputs,
    },
  };
}

function selfEqualityEvaluation(
  constraint: EqualityConstraint,
  selected: AssignmentSelection,
  fixedTarget: CandidateRecognition | null,
): ConstraintEvaluation {
  if (constraint.constraint_kind === "same_as") {
    return { state: "satisfied" };
  }
  const input = selected?.id ?? constraint.left_id;
  return equalityViolationReason(constraint, fixedTarget?.id ?? input, [
    input,
    input,
  ]);
}

function knownEqualityEvaluation(
  constraint: EqualityConstraint,
  left: CandidateRecognition,
  right: CandidateRecognition,
  fixedTarget: CandidateRecognition | null,
): ConstraintEvaluation {
  const equal = valuesEqual(left.value, right.value);
  const satisfied = constraint.constraint_kind === "same_as" ? equal : !equal;
  return satisfied
    ? { state: "satisfied" }
    : equalityViolationReason(constraint, fixedTarget?.id ?? left.id, [
        left.id,
        right.id,
      ]);
}

function equalityConstraintEvaluation(
  constraint: EqualityConstraint,
  scope: ScopeContext,
  selected: readonly AssignmentSelection[],
  fixedTarget: CandidateRecognition | null,
): ConstraintEvaluation {
  const left = selectedCandidate(scope, selected, constraint.left_id);
  const right = selectedCandidate(scope, selected, constraint.right_id);
  if (constraint.left_id === constraint.right_id) {
    return selfEqualityEvaluation(constraint, left, fixedTarget);
  }
  if (left === null || right === null) {
    return { state: "indeterminate", reason_code: "RCG-RSN-001" };
  }
  return knownEqualityEvaluation(constraint, left, right, fixedTarget);
}

function constraintEvaluation(
  constraint: ConstraintRecognition,
  scope: ScopeContext,
  selected: readonly AssignmentSelection[],
  fixedTarget: CandidateRecognition | null,
): ConstraintEvaluation {
  if (constraint.constraint_kind === "one_of") {
    return { state: "satisfied" };
  }
  const selectedIds = new Set(
    selected.flatMap((candidate) => (candidate === null ? [] : [candidate.id])),
  );
  if (constraint.constraint_kind === "excludes") {
    if (
      !selectedIds.has(constraint.left_id) ||
      !selectedIds.has(constraint.right_id)
    ) {
      return { state: "satisfied" };
    }
    return {
      state: "violated",
      reason: {
        code: "RCG-RSN-202",
        name: "excludes_pair_forbidden",
        subject_id: fixedTarget?.id ?? constraint.right_id,
        constraint_id: constraint.id,
        inputs: [constraint.left_id, constraint.right_id],
      },
    };
  }
  if (constraint.constraint_kind === "requires") {
    if (!selectedIds.has(constraint.antecedent_id)) {
      return { state: "satisfied" };
    }
    if (selectedIds.has(constraint.consequent_id)) {
      return { state: "satisfied" };
    }
    return {
      state: "violated",
      reason: {
        code: "RCG-RSN-203",
        name: "requires_consequent_unavailable",
        subject_id: fixedTarget?.id ?? constraint.antecedent_id,
        constraint_id: constraint.id,
        inputs: [constraint.antecedent_id, constraint.consequent_id],
      },
    };
  }
  return equalityConstraintEvaluation(
    constraint as EqualityConstraint,
    scope,
    selected,
    fixedTarget,
  );
}

function selectionEvaluation(
  scope: ScopeContext,
  selected: readonly AssignmentSelection[],
  fixedTarget: CandidateRecognition | null,
): ConstraintEvaluation {
  let indeterminate = false;
  for (const constraint of scope.relevant) {
    const evaluation = constraintEvaluation(
      constraint,
      scope,
      selected,
      fixedTarget,
    );
    if (evaluation.state === "violated") return evaluation;
    if (evaluation.state === "indeterminate") indeterminate = true;
  }
  return indeterminate
    ? { state: "indeterminate", reason_code: "RCG-RSN-001" }
    : { state: "satisfied" };
}

function enumerateAssignments(
  scope: ScopeContext,
  candidates: ReadonlyMap<string, CandidateRecognition>,
  fixedTarget: CandidateRecognition | null,
  limit: number,
  stopAtFirstSatisfying: boolean,
): EnumerationResult {
  const satisfying: Witness[] = [];
  const blockerDerivations: PublicReason[] = [];
  const blockerKeys = new Set<string>();
  const unknownReasonCodes = new Set<string>();
  let inspected = 0;
  let indeterminate = 0;
  for (const selected of assignments(scope, candidates, fixedTarget)) {
    if (inspected === limit) {
      return {
        satisfying,
        blocker_derivations: blockerDerivations,
        unknown_reasons: [...unknownReasonCodes],
        inspected,
        indeterminate,
        truncated: true,
      };
    }
    inspected += 1;
    const evaluation = selectionEvaluation(scope, selected, fixedTarget);
    if (evaluation.state === "satisfied") {
      satisfying.push(witnessFromSelection(scope, selected));
      if (stopAtFirstSatisfying) break;
      continue;
    }
    if (evaluation.state === "indeterminate") {
      unknownReasonCodes.add(evaluation.reason_code);
      indeterminate += 1;
      continue;
    }
    const blocker = evaluation.reason;
    const blockerKey = `${blocker.constraint_id}:${blocker.inputs.join(",")}`;
    if (!blockerKeys.has(blockerKey)) {
      blockerKeys.add(blockerKey);
      blockerDerivations.push(blocker);
    }
  }
  return {
    satisfying,
    blocker_derivations: blockerDerivations,
    unknown_reasons: [...unknownReasonCodes],
    inspected,
    indeterminate,
    truncated: false,
  };
}

export function materializeOneOfSpace(
  document: SemanticDocument,
  requestedVariableIds: readonly string[],
  limit: number,
): MaterializationSpaceResult {
  const target = document.recognitions.find(
    (recognition) =>
      recognition.id === requestedVariableIds[0] &&
      recognition.declaration_kind === "variable",
  );
  if (target === undefined) return { ok: false, reason: "invalid_scope" };
  const scope = buildScope(document, target, requestedVariableIds);
  if (scope === null) return { ok: false, reason: "invalid_scope" };

  const enumeration = enumerateAssignments(
    scope,
    candidatesById(document),
    null,
    limit,
    false,
  );
  const unknownReasons = unique([
    ...enumeration.unknown_reasons,
    ...(scope.skipped.length === 0 ? [] : ["RCG-RSN-006"]),
    ...(enumeration.truncated ? ["RCG-RSN-007"] : []),
  ]);
  return {
    ok: true,
    analysis: {
      complete: !enumeration.truncated && scope.skipped.length === 0,
      truncated: enumeration.truncated,
      requested_variable_ids: scope.requested.map((variable) => variable.id),
      effective_variable_ids: scope.effective.map((variable) => variable.id),
      inspected_assignment_count: enumeration.inspected,
      worlds: enumeration.satisfying,
      indeterminate_assignment_count: enumeration.indeterminate,
      open_variable_ids: scope.effective
        .filter((variable) => !isClosed(variable, scope))
        .map((variable) => variable.id),
      unknown_reasons: unknownReasons,
      relevant_constraints: scope.relevant,
    },
  };
}

function unknownReasons(
  variable: VariableRecognition,
  scope: ScopeContext,
  enumeration: EnumerationResult,
): readonly string[] {
  const reasons: string[] = [];
  if (!isClosed(variable, scope)) {
    reasons.push("RCG-RSN-001");
    if (variable.candidate_ids.length === 0) reasons.push("RCG-RSN-002");
  }
  reasons.push(...enumeration.unknown_reasons);
  if (scope.skipped.length > 0) reasons.push("RCG-RSN-006");
  if (enumeration.truncated) reasons.push("RCG-RSN-007");
  return unique(reasons);
}

function variableResolution(
  variable: VariableRecognition,
  scope: ScopeContext,
  enumeration: EnumerationResult,
): VariableResolution {
  const reasons = unknownReasons(variable, scope, enumeration);
  if (reasons.length > 0) {
    return { state: "unknown", unknown_reasons: reasons };
  }
  if (!enumeration.truncated && enumeration.satisfying.length === 0) {
    return { state: "inconsistent", unknown_reasons: [] };
  }
  const selectedIds = new Set(
    enumeration.satisfying.flatMap((witness) =>
      witness.assignments
        .filter((assignment) => assignment.variable_id === variable.id)
        .map((assignment) => assignment.candidate_id),
    ),
  );
  return {
    state: selectedIds.size === 1 ? "resolved" : "ambiguous",
    unknown_reasons: [],
  };
}

function forcedCandidateReasons(
  target: CandidateRecognition,
  scope: ScopeContext,
): readonly PublicReason[] {
  return scope.effective.flatMap((variable) => {
    if (variable.id === target.variable_id) return [];
    const candidates = viableCandidateIds(variable, scope);
    const closure = oneOfConstraints(scope, variable.id)[0];
    if (candidates.length !== 1 || closure === undefined) return [];
    return [
      {
        code: "RCG-RSN-201",
        name: "one_of_single_remaining",
        subject_id: candidates[0]!,
        constraint_id: closure.id,
        inputs: [candidates[0]!],
      },
    ];
  });
}

function excludedReasonChain(
  target: CandidateRecognition,
  scope: ScopeContext,
  enumeration: EnumerationResult,
): readonly PublicReason[] {
  const blockers = enumeration.blocker_derivations.map((reason) => ({
    ...reason,
    subject_id: target.id,
    inputs:
      reason.code === "RCG-RSN-202"
        ? reason.inputs.filter((id) => id !== target.id)
        : reason.inputs,
  }));
  const forced =
    blockers.length === 0 ? [] : forcedCandidateReasons(target, scope);
  const proofConstraintIds = unique([
    ...forced.flatMap((reason) =>
      reason.constraint_id === null ? [] : [reason.constraint_id],
    ),
    ...blockers.flatMap((reason) =>
      reason.constraint_id === null ? [] : [reason.constraint_id],
    ),
  ]);
  const closureIds = oneOfConstraints(scope, target.variable_id).map(
    (constraint) => constraint.id,
  );
  return [
    ...forced,
    ...blockers,
    {
      code: "RCG-RSN-206",
      name: "no_satisfying_witness",
      subject_id: target.id,
      constraint_id: null,
      inputs: proofConstraintIds.length > 0 ? proofConstraintIds : closureIds,
    },
  ];
}

function candidateViability(
  target: CandidateRecognition,
  scope: ScopeContext,
  enumeration: EnumerationResult,
): CandidateViability {
  const witness = enumeration.satisfying[0];
  if (witness !== undefined) {
    if (scope.skipped.length > 0) {
      return {
        state: "unknown",
        witness: null,
        reason_chain: [],
        unknown_reasons: ["RCG-RSN-006"],
      };
    }
    return {
      state: "allowed",
      witness,
      reason_chain: [
        {
          code: "RCG-RSN-101",
          name: "candidate_witness_found",
          subject_id: target.id,
          constraint_id: null,
          inputs: witness.assignments.map(
            (assignment) => assignment.candidate_id,
          ),
        },
      ],
      unknown_reasons: [],
    };
  }
  if (enumeration.truncated) {
    return {
      state: "unknown",
      witness: null,
      reason_chain: [],
      unknown_reasons: ["RCG-RSN-007"],
    };
  }
  if (enumeration.unknown_reasons.length > 0) {
    return {
      state: "unknown",
      witness: null,
      reason_chain: [],
      unknown_reasons: enumeration.unknown_reasons,
    };
  }
  return {
    state: "excluded",
    witness: null,
    reason_chain: excludedReasonChain(target, scope, enumeration),
    unknown_reasons: [],
  };
}

function constraintDerivations(
  target: Recognition,
  scope: ScopeContext,
): readonly PublicReason[] {
  if (target.declaration_kind !== "constraint") return [];
  if (target.constraint_kind !== "one_of") return [];
  const variable = scope.effective.find(
    (candidate) => candidate.id === target.variable_id,
  );
  if (variable === undefined) return [];
  const candidates = viableCandidateIds(variable, scope);
  if (candidates.length !== 1) return [];
  return [
    {
      code: "RCG-RSN-201",
      name: "one_of_single_remaining",
      subject_id: candidates[0]!,
      constraint_id: target.id,
      inputs: [candidates[0]!],
    },
  ];
}

function analysisVariable(
  target: Recognition,
  scope: ScopeContext,
): VariableRecognition | undefined {
  if (target.declaration_kind === "variable") return target;
  if (target.declaration_kind !== "candidate") return undefined;
  return scope.effective.find((variable) => variable.id === target.variable_id);
}

function publicScope(scope: ScopeContext, limit: number): ExplainScope | null {
  if (scope.effective.length === 0) return null;
  return {
    requested_variable_ids: scope.requested.map((item) => item.id),
    effective_variable_ids: scope.effective.map((item) => item.id),
    limit,
  };
}

interface AnalysisEnumerations {
  readonly variable: VariableRecognition | undefined;
  readonly target: EnumerationResult | null;
  readonly global: EnumerationResult | null;
}

function targetEnumeration(
  target: Recognition,
  scope: ScopeContext,
  candidates: ReadonlyMap<string, CandidateRecognition>,
  limit: number,
): EnumerationResult | null {
  if (target.declaration_kind === "candidate") {
    return enumerateAssignments(scope, candidates, target, limit, true);
  }
  if (target.declaration_kind === "constraint") {
    return enumerateAssignments(scope, candidates, null, limit, false);
  }
  return null;
}

function analysisEnumerations(
  target: Recognition,
  scope: ScopeContext,
  candidates: ReadonlyMap<string, CandidateRecognition>,
  limit: number,
): AnalysisEnumerations {
  const variable = analysisVariable(target, scope);
  const targetResult = targetEnumeration(target, scope, candidates, limit);
  const remainingLimit = limit - (targetResult?.inspected ?? 0);
  const globalEnumeration =
    variable === undefined
      ? null
      : enumerateAssignments(scope, candidates, null, remainingLimit, false);
  return {
    variable,
    target: targetResult,
    global: globalEnumeration,
  };
}

const groundedViolationCodes = new Set([
  "RCG-RSN-202",
  "RCG-RSN-203",
  "RCG-RSN-204",
  "RCG-RSN-205",
]);

function candidateDerivations(
  viability: CandidateViability | null,
  enumeration: EnumerationResult | null,
): readonly PublicReason[] {
  if (viability === null) return [];
  if (viability.state === "allowed") return viability.reason_chain;
  if (
    viability.state === "excluded" &&
    viability.reason_chain.some((reason) =>
      groundedViolationCodes.has(reason.code),
    )
  ) {
    return viability.reason_chain;
  }
  if (
    viability.state === "unknown" &&
    viability.unknown_reasons.includes("RCG-RSN-007")
  ) {
    return enumeration?.blocker_derivations ?? [];
  }
  return [];
}

function analysisViability(
  target: Recognition,
  scope: ScopeContext,
  enumeration: EnumerationResult | null,
): CandidateViability | null {
  if (target.declaration_kind !== "candidate" || enumeration === null) {
    return null;
  }
  return candidateViability(target, scope, enumeration);
}

function analysisResolution(
  variable: VariableRecognition | undefined,
  scope: ScopeContext,
  enumeration: EnumerationResult | null,
): VariableResolution | null {
  if (variable === undefined || enumeration === null) return null;
  return variableResolution(variable, scope, enumeration);
}

function analysisDerivations(
  target: Recognition,
  scope: ScopeContext,
  viability: CandidateViability | null,
  enumeration: EnumerationResult | null,
): readonly PublicReason[] {
  if (target.declaration_kind === "candidate") {
    return candidateDerivations(viability, enumeration);
  }
  if (enumeration !== null && enumeration.blocker_derivations.length > 0) {
    return enumeration.blocker_derivations;
  }
  return constraintDerivations(target, scope);
}

function analysisSupport(target: Recognition): OneOfExplainAnalysis["support"] {
  if (target.support === undefined) {
    return { state: "unsupported", records: [] };
  }
  return { state: "supported", records: [target.support] };
}

export function analyzeOneOfExplain(
  document: SemanticDocument,
  targetId: string,
  requestedVariableIds: readonly string[] | undefined,
  limit: number,
): OneOfExplainResult {
  const target = document.recognitions.find(
    (recognition) => recognition.id === targetId,
  );
  if (target === undefined) {
    return { ok: false, reason: "missing_target", id: targetId };
  }
  const scope = buildScope(document, target, requestedVariableIds);
  if (scope === null) {
    return { ok: false, reason: "invalid_scope", id: targetId };
  }
  const candidates = candidatesById(document);
  const enumerations = analysisEnumerations(target, scope, candidates, limit);
  const viability = analysisViability(target, scope, enumerations.target);
  const resolution = analysisResolution(
    enumerations.variable,
    scope,
    enumerations.global,
  );
  const truncated =
    (enumerations.target?.truncated ?? false) ||
    (enumerations.global?.truncated ?? false);
  const derivations = analysisDerivations(
    target,
    scope,
    viability,
    enumerations.target,
  );
  return {
    ok: true,
    analysis: {
      target,
      complete: !truncated && scope.skipped.length === 0,
      truncated,
      support: analysisSupport(target),
      viability,
      variable_resolution: resolution,
      scope: publicScope(scope, limit),
      relevant_constraints: scope.relevant,
      skipped_constraints: scope.skipped,
      derivations,
    },
  };
}
