import crypto from "node:crypto";

import { validateBootstrapCore } from "../core/bootstrap-model.js";
import {
  analyzeOneOfExplain,
  type CandidateViability,
  type ExplainScope,
  type OneOfExplainAnalysis,
  type PublicReason,
  type SkippedConstraint,
  type VariableResolution,
} from "../core/one-of-explain.js";
import type {
  AstDocument,
  Diagnostic,
  GroundingReference,
  NormalizationRecord,
  Recognition,
  SemanticDocument,
  SupportRecord,
} from "../core/types.js";

export const phase2ToolVersion = "0.0.0-phase2";
export const phase3ToolVersion = "0.0.0-phase3";

interface ResultInput {
  readonly path: string;
  readonly document_id: string | null;
  readonly digest: string;
}

interface SourceVerification {
  readonly mode: "none";
  readonly state: "not_requested";
}

interface ResultBase {
  readonly semantic_version: "0.1";
  readonly tool_version: string;
  readonly input: ResultInput;
  readonly complete: boolean;
  readonly truncated: boolean;
  readonly source_verification: SourceVerification;
  readonly diagnostics: readonly Diagnostic[];
}

export interface ValidationResult extends ResultBase {
  readonly schema: "Llmrecog.ValidationResult.v1";
  readonly valid: boolean;
  readonly structural_valid: boolean;
  readonly semantic_valid: boolean;
  readonly ast: AstDocument | null;
  readonly document: SemanticDocument | null;
}

export interface DocumentResult extends ResultBase {
  readonly schema: "Llmrecog.DocumentResult.v1";
  readonly summary: {
    readonly document_id: string;
    readonly title: string;
    readonly counts: {
      readonly sources: number;
      readonly spans: number;
      readonly observations: number;
      readonly entities: number;
      readonly records: number;
      readonly variables: number;
      readonly candidates: number;
      readonly constraints: number;
    };
    readonly source_ids: readonly string[];
    readonly recognition_ids: readonly string[];
    readonly variables: readonly {
      readonly id: string;
      readonly value_type: "entity_ref" | "symbol" | "string";
      readonly candidate_ids: readonly string[];
      readonly domain: "open" | "closed";
    }[];
    readonly constraint_ids: readonly string[];
  };
}

export interface RecognitionResult extends ResultBase {
  readonly schema: "Llmrecog.RecognitionResult.v1";
  readonly found: boolean;
  readonly target: {
    readonly id: string;
    readonly declaration_kind: Recognition["declaration_kind"] | null;
  };
  readonly recognition: Recognition | null;
}

interface ProvenanceEdge {
  readonly kind:
    | "selected_by"
    | "observed_in"
    | "grounded_in"
    | "normalized_by"
    | "supports"
    | "applies"
    | "depends_on"
    | "yields";
  readonly from: string;
  readonly to: string;
}

interface ExplainSourceVerification {
  readonly source_id: string;
  readonly verification: SourceVerification;
}

export interface ExplainResult {
  readonly schema: "Llmrecog.ExplainResult.v2";
  readonly semantic_version: "0.1";
  readonly tool_version: string;
  readonly input: ResultInput;
  readonly complete: boolean;
  readonly truncated: boolean;
  readonly target: {
    readonly id: string;
    readonly declaration_kind: Recognition["declaration_kind"];
  };
  readonly recognition: Recognition;
  readonly support: {
    readonly state: "supported" | "unsupported" | "conflicted";
    readonly records: readonly SupportRecord[];
  };
  readonly viability: CandidateViability | null;
  readonly variable_resolution: VariableResolution | null;
  readonly scope: ExplainScope | null;
  readonly provenance: readonly ProvenanceEdge[];
  readonly normalization: NormalizationRecord | null;
  readonly source_verification: readonly ExplainSourceVerification[];
  readonly relevant_constraint_ids: readonly string[];
  readonly skipped_constraints: readonly SkippedConstraint[];
  readonly derivations: readonly PublicReason[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface AuditResult extends ResultBase {
  readonly schema: "Llmrecog.AuditResult.v1";
  readonly profile: "base";
  readonly fail_on: "warning" | "error";
  readonly passed: boolean;
  readonly evaluated_rule_codes: readonly [
    "RCG-GROUND-003",
    "RCG-SUPPORT-001",
    "RCG-CSP-001",
    "RCG-CSP-002",
  ];
  readonly summary: {
    readonly errors: number;
    readonly warnings: number;
    readonly info: number;
  };
}

export type BootstrapReadResult =
  | ValidationResult
  | DocumentResult
  | RecognitionResult
  | ExplainResult
  | AuditResult;

export interface BootstrapReadInput {
  readonly bytes: Uint8Array;
  readonly path: string;
  readonly maximumDiagnostics?: number;
  readonly toolVersion?: string;
}

export interface ExplainOptions {
  readonly requestedVariableIds?: readonly string[];
  readonly limit?: number;
}

export interface AuditOptions {
  readonly failOn?: "warning" | "error";
}

export class ExplainInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExplainInputError";
  }
}

function validatedExplainLimit(value: number | undefined): number {
  const limit = value ?? 100;
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new ExplainInputError("--limit must be a positive integer.");
  }
  return limit;
}

function validatedScope(
  value: readonly string[] | undefined,
): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (
    value.length === 0 ||
    value.some((id) => !/^[A-Za-z][A-Za-z0-9_.-]*$/u.test(id)) ||
    new Set(value).size !== value.length
  ) {
    throw new ExplainInputError(
      "--scope must be a duplicate-free variable ID list.",
    );
  }
  return value;
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function inputIdentity(
  input: BootstrapReadInput,
  documentId: string | null,
): ResultInput {
  return {
    path: input.path,
    document_id: documentId,
    digest: sha256(input.bytes),
  };
}

function sourceVerification(): SourceVerification {
  return { mode: "none", state: "not_requested" };
}

export function validateBootstrapInput(
  input: BootstrapReadInput,
): ValidationResult {
  const validation = validateBootstrapCore(
    input.bytes,
    input.maximumDiagnostics ?? 100,
  );
  const documentId =
    validation.document?.document_id ?? validation.ast?.document.id ?? null;
  return {
    schema: "Llmrecog.ValidationResult.v1",
    semantic_version: "0.1",
    tool_version: input.toolVersion ?? phase2ToolVersion,
    input: inputIdentity(input, documentId),
    complete: validation.complete,
    truncated: validation.truncated,
    valid: validation.structuralValid && validation.semanticValid,
    structural_valid: validation.structuralValid,
    semantic_valid: validation.semanticValid,
    source_verification: sourceVerification(),
    ast: validation.ast,
    document: validation.document,
    diagnostics: validation.diagnostics,
  };
}

export function showBootstrapDocument(
  input: BootstrapReadInput,
): ValidationResult | DocumentResult {
  const validation = validateBootstrapInput(input);
  if (!validation.valid || validation.document === null) return validation;
  const document = validation.document;
  const variables = document.recognitions.filter(
    (recognition) => recognition.declaration_kind === "variable",
  );
  const constraints = document.recognitions.filter(
    (recognition) => recognition.declaration_kind === "constraint",
  );
  return {
    schema: "Llmrecog.DocumentResult.v1",
    semantic_version: "0.1",
    tool_version: validation.tool_version,
    input: validation.input,
    complete: validation.complete,
    truncated: validation.truncated,
    source_verification: validation.source_verification,
    summary: {
      document_id: document.document_id,
      title: document.title,
      counts: {
        sources: document.sources.length,
        spans: document.spans.length,
        observations: document.observations.length,
        entities: document.recognitions.filter(
          (recognition) => recognition.declaration_kind === "entity",
        ).length,
        records: document.recognitions.filter(
          (recognition) => recognition.declaration_kind === "record",
        ).length,
        variables: variables.length,
        candidates: document.recognitions.filter(
          (recognition) => recognition.declaration_kind === "candidate",
        ).length,
        constraints: constraints.length,
      },
      source_ids: document.sources.map((source) => source.id),
      recognition_ids: document.recognitions.map(
        (recognition) => recognition.id,
      ),
      variables: variables.map((variable) => ({
        id: variable.id,
        value_type: variable.value_type,
        candidate_ids: variable.candidate_ids,
        domain: constraints.some(
          (constraint) =>
            constraint.constraint_kind === "one_of" &&
            constraint.variable_id === variable.id,
        )
          ? "closed"
          : "open",
      })),
      constraint_ids: constraints.map((constraint) => constraint.id),
    },
    diagnostics: validation.diagnostics,
  };
}

function missingRecognitionDiagnostic(id: string): Diagnostic {
  return {
    code: "RCG-REF-002",
    severity: "error",
    message: "The requested recognition ID does not exist.",
    entity_id: id,
    span: null,
    reason_data: { reference_id: id, expected_kind: "recognition" },
    related: [],
  };
}

export function showBootstrapRecognition(
  input: BootstrapReadInput,
  id: string,
): ValidationResult | RecognitionResult {
  const validation = validateBootstrapInput(input);
  if (!validation.valid || validation.document === null) return validation;
  const recognition = validation.document.recognitions.find(
    (candidate) => candidate.id === id,
  );
  const found = recognition !== undefined;
  return {
    schema: "Llmrecog.RecognitionResult.v1",
    semantic_version: "0.1",
    tool_version: validation.tool_version,
    input: validation.input,
    complete: validation.complete,
    truncated: validation.truncated,
    found,
    source_verification: validation.source_verification,
    target: {
      id,
      declaration_kind: recognition?.declaration_kind ?? null,
    },
    recognition: recognition ?? null,
    diagnostics: found
      ? validation.diagnostics
      : [missingRecognitionDiagnostic(id)],
  };
}

function targetNormalization(target: Recognition): NormalizationRecord | null {
  return target.declaration_kind === "record" &&
    target.normalization !== undefined
    ? target.normalization
    : null;
}

function groundingEdges(
  document: SemanticDocument,
  target: Recognition,
  derivations: readonly PublicReason[] = [],
): readonly ProvenanceEdge[] {
  const edges: ProvenanceEdge[] = target.grounded_in.map((reference) => ({
    kind: "grounded_in",
    from: target.id,
    to: reference.id,
  }));
  const observations = new Map(
    document.observations.map((observation) => [observation.id, observation]),
  );
  for (const reference of target.grounded_in) {
    if (reference.kind !== "observation") continue;
    const observation = observations.get(reference.id);
    if (observation === undefined) continue;
    edges.push(
      ...observation.grounded_in.map((grounding) => ({
        kind: "observed_in" as const,
        from: observation.id,
        to: grounding.id,
      })),
    );
  }
  const normalization = targetNormalization(target);
  if (normalization !== null) {
    edges.push({
      kind: "normalized_by",
      from: target.id,
      to: normalization.rule,
    });
  }
  if (target.declaration_kind === "candidate") {
    const appliedConstraintIds = uniqueStrings(
      derivations.flatMap((derivation) =>
        derivation.code === "RCG-RSN-202" && derivation.constraint_id !== null
          ? [derivation.constraint_id]
          : [],
      ),
    );
    edges.push(
      ...appliedConstraintIds.map((constraintId) => ({
        kind: "applies" as const,
        from: target.id,
        to: constraintId,
      })),
    );
  }
  return edges;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function supportedExcludedDiagnostic(
  candidateId: string,
  constraintIds: readonly string[],
): Diagnostic {
  return {
    code: "RCG-CSP-002",
    severity: "warning",
    message:
      "A source-supported candidate is excluded by grounded constraints.",
    entity_id: candidateId,
    span: null,
    reason_data: { constraint_ids: constraintIds },
    related: [],
  };
}

function exclusionConstraintIds(
  analysis: OneOfExplainAnalysis,
): readonly string[] {
  if (analysis.viability?.state !== "excluded") return [];
  const usedIds = new Set(
    analysis.viability.reason_chain.flatMap((reason) => [
      ...(reason.constraint_id === null ? [] : [reason.constraint_id]),
      ...reason.inputs,
    ]),
  );
  return analysis.relevant_constraints
    .map((constraint) => constraint.id)
    .filter((id) => usedIds.has(id));
}

function sourceIdsForGrounding(
  document: SemanticDocument,
  roots: readonly Recognition[],
): readonly string[] {
  const spans = new Map(document.spans.map((span) => [span.id, span]));
  const observations = new Map(
    document.observations.map((observation) => [observation.id, observation]),
  );
  const recognitions = new Map(
    document.recognitions.map((recognition) => [recognition.id, recognition]),
  );
  const pending: GroundingReference[] = roots.flatMap(
    (recognition) => recognition.grounded_in,
  );
  const visited = new Set<string>();
  const sourceIds = new Set<string>();
  while (pending.length > 0) {
    const reference = pending.shift()!;
    const key = `${reference.kind}:${reference.id}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (reference.kind === "span") {
      const sourceId = spans.get(reference.id)?.source_id;
      if (sourceId !== undefined) sourceIds.add(sourceId);
      continue;
    }
    const grounded =
      reference.kind === "observation"
        ? observations.get(reference.id)?.grounded_in
        : recognitions.get(reference.id)?.grounded_in;
    if (grounded !== undefined) pending.push(...grounded);
  }
  return document.sources
    .map((source) => source.id)
    .filter((sourceId) => sourceIds.has(sourceId));
}

function explainSourceVerification(
  document: SemanticDocument,
  roots: readonly Recognition[],
): readonly ExplainSourceVerification[] {
  return sourceIdsForGrounding(document, roots).map((sourceId) => ({
    source_id: sourceId,
    verification: sourceVerification(),
  }));
}

export function explainBootstrapRecognition(
  input: BootstrapReadInput,
  id: string,
  options: ExplainOptions = {},
): ValidationResult | RecognitionResult | ExplainResult {
  const limit = validatedExplainLimit(options.limit);
  const requestedVariableIds = validatedScope(options.requestedVariableIds);
  const phase3Input: BootstrapReadInput = {
    ...input,
    toolVersion: input.toolVersion ?? phase3ToolVersion,
  };
  const validation = validateBootstrapInput(phase3Input);
  if (!validation.valid || validation.document === null) return validation;
  const analysis = analyzeOneOfExplain(
    validation.document,
    id,
    requestedVariableIds,
    limit,
  );
  if (!analysis.ok) {
    if (analysis.reason === "missing_target") {
      return showBootstrapRecognition(phase3Input, id);
    }
    throw new ExplainInputError(
      "--scope must contain existing variable IDs and every target seed.",
    );
  }
  const result = analysis.analysis;
  const exclusionIds = exclusionConstraintIds(result);
  const explainDiagnostics =
    result.target.declaration_kind === "candidate" &&
    result.target.support !== undefined &&
    result.viability?.state === "excluded" &&
    result.derivations.some((derivation) => derivation.code === "RCG-RSN-202")
      ? [supportedExcludedDiagnostic(result.target.id, exclusionIds)]
      : [];
  return {
    schema: "Llmrecog.ExplainResult.v2",
    semantic_version: "0.1",
    tool_version: validation.tool_version,
    input: validation.input,
    complete: result.complete,
    truncated: result.truncated,
    target: {
      id: result.target.id,
      declaration_kind: result.target.declaration_kind,
    },
    recognition: result.target,
    support: result.support,
    viability: result.viability,
    variable_resolution: result.variable_resolution,
    scope: result.scope,
    provenance: groundingEdges(
      validation.document,
      result.target,
      result.derivations,
    ),
    normalization: targetNormalization(result.target),
    source_verification: explainSourceVerification(validation.document, [
      result.target,
      ...result.relevant_constraints,
    ]),
    relevant_constraint_ids: result.relevant_constraints.map(
      (constraint) => constraint.id,
    ),
    skipped_constraints: result.skipped_constraints,
    derivations: result.derivations,
    diagnostics: [...validation.diagnostics, ...explainDiagnostics],
  };
}

function auditCoreAnalysis(
  document: SemanticDocument,
  id: string,
): OneOfExplainAnalysis {
  const result = analyzeOneOfExplain(
    document,
    id,
    undefined,
    Number.MAX_SAFE_INTEGER,
  );
  if (!result.ok) {
    throw new Error(`validated audit target ${id} was not analyzable`);
  }
  return result.analysis;
}

function unsealedSourceDiagnostic(
  source: SemanticDocument["sources"][number],
): Diagnostic {
  return {
    code: "RCG-GROUND-003",
    severity: "warning",
    message: "A locatable source is not sealed by a digest.",
    entity_id: source.id,
    span: null,
    reason_data: { source_id: source.id, locator: source.locator },
    related: [],
  };
}

function unsupportedRecognitionDiagnostic(
  recognition: Recognition,
): Diagnostic {
  return {
    code: "RCG-SUPPORT-001",
    severity: "warning",
    message: "A candidate or record has no positive support record.",
    entity_id: recognition.id,
    span: null,
    reason_data: { recognition_id: recognition.id },
    related: [],
  };
}

function inconsistentVariableDiagnostic(
  variableId: string,
  constraintIds: readonly string[],
): Diagnostic {
  return {
    code: "RCG-CSP-001",
    severity: "error",
    message: "A closed variable has no satisfying assignment.",
    entity_id: variableId,
    span: null,
    reason_data: { variable_id: variableId, constraint_ids: constraintIds },
    related: [],
  };
}

function diagnosticOrder(left: Diagnostic, right: Diagnostic): number {
  const leftOffset = left.span?.start.offset ?? Number.MAX_SAFE_INTEGER;
  const rightOffset = right.span?.start.offset ?? Number.MAX_SAFE_INTEGER;
  if (leftOffset !== rightOffset) return leftOffset - rightOffset;
  const code = left.code.localeCompare(right.code);
  if (code !== 0) return code;
  return (left.entity_id ?? "").localeCompare(right.entity_id ?? "");
}

function inconsistentVariableDiagnostics(
  variableAnalyses: ReadonlyMap<string, OneOfExplainAnalysis>,
): readonly Diagnostic[] {
  return [...variableAnalyses.entries()].flatMap(([variableId, analysis]) =>
    analysis.variable_resolution?.state === "inconsistent"
      ? [
          inconsistentVariableDiagnostic(
            variableId,
            analysis.relevant_constraints.map((constraint) => constraint.id),
          ),
        ]
      : [],
  );
}

function supportAuditDiagnostic(recognition: Recognition): Diagnostic | null {
  const supportRelevant =
    recognition.declaration_kind === "candidate" ||
    recognition.declaration_kind === "record";
  if (!supportRelevant || recognition.support !== undefined) return null;
  return unsupportedRecognitionDiagnostic(recognition);
}

function excludedCandidateAuditDiagnostic(
  document: SemanticDocument,
  recognition: Recognition,
  variableAnalyses: ReadonlyMap<string, OneOfExplainAnalysis>,
): Diagnostic | null {
  if (
    recognition.declaration_kind !== "candidate" ||
    recognition.support === undefined
  ) {
    return null;
  }
  const analysis = auditCoreAnalysis(document, recognition.id);
  if (analysis.viability?.state !== "excluded") return null;
  const parentInconsistent =
    variableAnalyses.get(recognition.variable_id)?.variable_resolution
      ?.state === "inconsistent";
  const constraintIds = parentInconsistent
    ? analysis.relevant_constraints.map((constraint) => constraint.id)
    : exclusionConstraintIds(analysis);
  return supportedExcludedDiagnostic(recognition.id, constraintIds);
}

function recognitionAuditDiagnostics(
  document: SemanticDocument,
  variableAnalyses: ReadonlyMap<string, OneOfExplainAnalysis>,
): readonly Diagnostic[] {
  return document.recognitions.flatMap((recognition) => {
    const diagnostics = [
      supportAuditDiagnostic(recognition),
      excludedCandidateAuditDiagnostic(document, recognition, variableAnalyses),
    ];
    return diagnostics.filter(
      (diagnostic): diagnostic is Diagnostic => diagnostic !== null,
    );
  });
}

function focusedAuditDiagnostics(document: SemanticDocument): Diagnostic[] {
  const variables = document.recognitions.filter(
    (recognition) => recognition.declaration_kind === "variable",
  );
  const variableAnalyses = new Map(
    variables.map((variable) => [
      variable.id,
      auditCoreAnalysis(document, variable.id),
    ]),
  );

  const diagnostics = [
    ...inconsistentVariableDiagnostics(variableAnalyses),
    ...recognitionAuditDiagnostics(document, variableAnalyses),
    ...document.sources
      .filter((source) => source.digest === undefined)
      .map(unsealedSourceDiagnostic),
  ];
  return diagnostics.sort(diagnosticOrder);
}

function diagnosticSummary(
  diagnostics: readonly Diagnostic[],
): AuditResult["summary"] {
  return {
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error")
      .length,
    warnings: diagnostics.filter(
      (diagnostic) => diagnostic.severity === "warning",
    ).length,
    info: diagnostics.filter((diagnostic) => diagnostic.severity === "info")
      .length,
  };
}

function diagnosticSeverityRank(diagnostic: Diagnostic): number {
  if (diagnostic.severity === "error") return 2;
  if (diagnostic.severity === "warning") return 1;
  return 0;
}

export function auditBootstrapDocument(
  input: BootstrapReadInput,
  options: AuditOptions = {},
): ValidationResult | AuditResult {
  const phase3Input: BootstrapReadInput = {
    ...input,
    toolVersion: input.toolVersion ?? phase3ToolVersion,
  };
  const validation = validateBootstrapInput(phase3Input);
  if (!validation.valid || validation.document === null) return validation;
  const failOn = options.failOn ?? "error";
  const allDiagnostics = [
    ...validation.diagnostics,
    ...focusedAuditDiagnostics(validation.document),
  ].sort(diagnosticOrder);
  const maximumDiagnostics = input.maximumDiagnostics ?? 100;
  const truncated = allDiagnostics.length > maximumDiagnostics;
  const diagnostics = allDiagnostics.slice(0, maximumDiagnostics);
  const threshold = failOn === "warning" ? 1 : 2;
  const passed =
    !truncated &&
    !diagnostics.some(
      (diagnostic) => diagnosticSeverityRank(diagnostic) >= threshold,
    );
  return {
    schema: "Llmrecog.AuditResult.v1",
    semantic_version: "0.1",
    tool_version: validation.tool_version,
    input: validation.input,
    complete: !truncated,
    truncated,
    profile: "base",
    fail_on: failOn,
    passed,
    source_verification: validation.source_verification,
    evaluated_rule_codes: [
      "RCG-GROUND-003",
      "RCG-SUPPORT-001",
      "RCG-CSP-001",
      "RCG-CSP-002",
    ],
    summary: diagnosticSummary(diagnostics),
    diagnostics,
  };
}
