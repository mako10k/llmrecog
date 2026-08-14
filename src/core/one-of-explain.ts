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

interface ScopeContext {
  readonly requested: readonly VariableRecognition[];
  readonly effective: readonly VariableRecognition[];
  readonly relevant: readonly ConstraintRecognition[];
  readonly skipped: readonly SkippedConstraint[];
}

interface EnumerationResult {
  readonly satisfying: readonly Witness[];
  readonly blocker_derivations: readonly PublicReason[];
  readonly inspected: number;
  readonly truncated: boolean;
}

type AssignmentSelection = CandidateRecognition | null;

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
    skipped: relevant.flatMap((constraint) =>
      constraint.constraint_kind === "one_of" ||
      constraint.constraint_kind === "excludes"
        ? []
        : [
            {
              constraint_id: constraint.id,
              reason_code: "RCG-RSN-006" as const,
            },
          ],
    ),
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

function excludesConstraints(
  scope: ScopeContext,
): readonly (BinaryConstraintRecognition & {
  readonly constraint_kind: "excludes";
})[] {
  return scope.relevant.filter(
    (
      constraint,
    ): constraint is BinaryConstraintRecognition & {
      readonly constraint_kind: "excludes";
    } => constraint.constraint_kind === "excludes",
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
    open_variable_ids: scope.effective
      .filter((variable) => !isClosed(variable, scope))
      .map((variable) => variable.id),
  };
}

function excludesBlocker(
  scope: ScopeContext,
  selected: readonly AssignmentSelection[],
  fixedTarget: CandidateRecognition | null,
): PublicReason | null {
  const selectedIds = new Set(
    selected.flatMap((candidate) => (candidate === null ? [] : [candidate.id])),
  );
  for (const constraint of excludesConstraints(scope)) {
    if (
      !selectedIds.has(constraint.left_id) ||
      !selectedIds.has(constraint.right_id)
    ) {
      continue;
    }
    return {
      code: "RCG-RSN-202",
      name: "excludes_pair_forbidden",
      subject_id: fixedTarget?.id ?? constraint.right_id,
      constraint_id: constraint.id,
      inputs: [constraint.left_id, constraint.right_id],
    };
  }
  return null;
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
  let inspected = 0;
  for (const selected of assignments(scope, candidates, fixedTarget)) {
    if (inspected === limit) {
      return {
        satisfying,
        blocker_derivations: blockerDerivations,
        inspected,
        truncated: true,
      };
    }
    inspected += 1;
    const blocker = excludesBlocker(scope, selected, fixedTarget);
    if (blocker === null) {
      satisfying.push(witnessFromSelection(scope, selected));
      if (stopAtFirstSatisfying) break;
      continue;
    }
    const blockerKey = `${blocker.constraint_id}:${blocker.inputs.join(",")}`;
    if (!blockerKeys.has(blockerKey)) {
      blockerKeys.add(blockerKey);
      blockerDerivations.push(blocker);
    }
  }
  return {
    satisfying,
    blocker_derivations: blockerDerivations,
    inspected,
    truncated: false,
  };
}

function unknownReasons(
  variable: VariableRecognition,
  scope: ScopeContext,
  truncated: boolean,
): readonly string[] {
  const reasons: string[] = [];
  if (!isClosed(variable, scope)) {
    reasons.push("RCG-RSN-001");
    if (variable.candidate_ids.length === 0) reasons.push("RCG-RSN-002");
  }
  if (scope.skipped.length > 0) reasons.push("RCG-RSN-006");
  if (truncated) reasons.push("RCG-RSN-007");
  return unique(reasons);
}

function variableResolution(
  variable: VariableRecognition,
  scope: ScopeContext,
  enumeration: EnumerationResult,
): VariableResolution {
  if (!enumeration.truncated && enumeration.satisfying.length === 0) {
    return { state: "inconsistent", unknown_reasons: [] };
  }
  const reasons = unknownReasons(variable, scope, enumeration.truncated);
  if (reasons.length > 0) {
    return { state: "unknown", unknown_reasons: reasons };
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
    inputs: reason.inputs.filter((id) => id !== target.id),
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
  if (target.constraint_kind === "excludes") {
    return [
      {
        code: "RCG-RSN-202",
        name: "excludes_pair_forbidden",
        subject_id: target.right_id,
        constraint_id: target.id,
        inputs: [target.left_id, target.right_id],
      },
    ];
  }
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

function analysisEnumerations(
  target: Recognition,
  scope: ScopeContext,
  candidates: ReadonlyMap<string, CandidateRecognition>,
  limit: number,
): AnalysisEnumerations {
  const variable = analysisVariable(target, scope);
  const targetEnumeration =
    target.declaration_kind === "candidate"
      ? enumerateAssignments(scope, candidates, target, limit, true)
      : null;
  const remainingLimit = limit - (targetEnumeration?.inspected ?? 0);
  const globalEnumeration =
    variable === undefined
      ? null
      : enumerateAssignments(scope, candidates, null, remainingLimit, false);
  return {
    variable,
    target: targetEnumeration,
    global: globalEnumeration,
  };
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
  if (viability?.state === "allowed") return viability.reason_chain;
  if (
    viability?.state === "excluded" &&
    viability.reason_chain.some((reason) => reason.code === "RCG-RSN-202")
  ) {
    return viability.reason_chain;
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
