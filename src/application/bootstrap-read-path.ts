import crypto from "node:crypto";

import { validateBootstrapCore } from "../core/bootstrap-model.js";
import type {
  AstDocument,
  Diagnostic,
  Recognition,
  SemanticDocument,
} from "../core/types.js";

export const phase2ToolVersion = "0.0.0-phase2";

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

export type BootstrapReadResult =
  ValidationResult | DocumentResult | RecognitionResult;

export interface BootstrapReadInput {
  readonly bytes: Uint8Array;
  readonly path: string;
  readonly maximumDiagnostics?: number;
  readonly toolVersion?: string;
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
