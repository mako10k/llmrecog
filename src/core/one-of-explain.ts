import type {
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
  readonly truncated: false;
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

function unique(values: readonly string[]): readonly string[] {
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
      constraint.constraint_kind === "one_of"
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

function unknownResolution(
  variable: VariableRecognition,
  scope: ScopeContext,
): VariableResolution {
  const reasons: string[] = [];
  if (!isClosed(variable, scope)) {
    reasons.push("RCG-RSN-001");
    if (variable.candidate_ids.length === 0) reasons.push("RCG-RSN-002");
  }
  if (scope.skipped.length > 0) reasons.push("RCG-RSN-006");
  return { state: "unknown", unknown_reasons: unique(reasons) };
}

function variableResolution(
  variable: VariableRecognition,
  scope: ScopeContext,
): VariableResolution {
  const scopeInconsistent = scope.effective.some(
    (candidate) =>
      isClosed(candidate, scope) &&
      viableCandidateIds(candidate, scope).length === 0,
  );
  if (scopeInconsistent) {
    return { state: "inconsistent", unknown_reasons: [] };
  }
  const candidates = viableCandidateIds(variable, scope);
  if (!isClosed(variable, scope) || scope.skipped.length > 0) {
    return unknownResolution(variable, scope);
  }
  return {
    state: candidates.length === 1 ? "resolved" : "ambiguous",
    unknown_reasons: [],
  };
}

function noSatisfyingWitness(
  target: CandidateRecognition,
  scope: ScopeContext,
): CandidateViability {
  return {
    state: "excluded",
    witness: null,
    reason_chain: [
      {
        code: "RCG-RSN-206",
        name: "no_satisfying_witness",
        subject_id: target.id,
        constraint_id: null,
        inputs: scope.relevant
          .filter((constraint) => constraint.constraint_kind === "one_of")
          .map((constraint) => constraint.id),
      },
    ],
    unknown_reasons: [],
  };
}

function candidateWitness(
  target: CandidateRecognition,
  scope: ScopeContext,
  byCandidate: ReadonlyMap<string, CandidateRecognition>,
): Witness | null {
  const assignments: WitnessAssignment[] = [];
  const openVariableIds: string[] = [];
  for (const variable of scope.effective) {
    if (!isClosed(variable, scope)) openVariableIds.push(variable.id);
    const candidateId =
      variable.id === target.variable_id
        ? target.id
        : viableCandidateIds(variable, scope)[0];
    if (candidateId === undefined) {
      if (isClosed(variable, scope)) return null;
      continue;
    }
    const candidate = byCandidate.get(candidateId);
    if (candidate === undefined) return null;
    assignments.push({
      variable_id: variable.id,
      candidate_id: candidate.id,
      value: candidate.value,
    });
  }
  return { assignments, open_variable_ids: openVariableIds };
}

function candidateViability(
  target: CandidateRecognition,
  scope: ScopeContext,
  byCandidate: ReadonlyMap<string, CandidateRecognition>,
): CandidateViability {
  const parent = scope.effective.find(
    (variable) => variable.id === target.variable_id,
  );
  if (
    parent === undefined ||
    !viableCandidateIds(parent, scope).includes(target.id)
  ) {
    return noSatisfyingWitness(target, scope);
  }
  const witness = candidateWitness(target, scope, byCandidate);
  if (witness === null) return noSatisfyingWitness(target, scope);
  if (scope.skipped.length > 0) {
    return {
      state: "unknown",
      witness: null,
      reason_chain: [],
      unknown_reasons: ["RCG-RSN-006"],
    };
  }
  const reason: PublicReason = {
    code: "RCG-RSN-101",
    name: "candidate_witness_found",
    subject_id: target.id,
    constraint_id: null,
    inputs: witness.assignments.map((assignment) => assignment.candidate_id),
  };
  return {
    state: "allowed",
    witness,
    reason_chain: [reason],
    unknown_reasons: [],
  };
}

function constraintDerivations(
  target: Recognition,
  scope: ScopeContext,
): readonly PublicReason[] {
  if (
    target.declaration_kind !== "constraint" ||
    target.constraint_kind !== "one_of"
  ) {
    return [];
  }
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

function analysisViability(
  document: SemanticDocument,
  target: Recognition,
  scope: ScopeContext,
): CandidateViability | null {
  if (target.declaration_kind !== "candidate") return null;
  return candidateViability(target, scope, candidatesById(document));
}

function publicScope(scope: ScopeContext, limit: number): ExplainScope | null {
  if (scope.effective.length === 0) return null;
  return {
    requested_variable_ids: scope.requested.map((item) => item.id),
    effective_variable_ids: scope.effective.map((item) => item.id),
    limit,
  };
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
  const variable = analysisVariable(target, scope);
  const viability = analysisViability(document, target, scope);
  const derivations =
    viability?.state === "allowed"
      ? viability.reason_chain
      : constraintDerivations(target, scope);
  return {
    ok: true,
    analysis: {
      target,
      complete: scope.skipped.length === 0,
      truncated: false,
      support: {
        state: target.support === undefined ? "unsupported" : "supported",
        records: target.support === undefined ? [] : [target.support],
      },
      viability,
      variable_resolution:
        variable === undefined ? null : variableResolution(variable, scope),
      scope: publicScope(scope, limit),
      relevant_constraints: scope.relevant,
      skipped_constraints: scope.skipped,
      derivations,
    },
  };
}
