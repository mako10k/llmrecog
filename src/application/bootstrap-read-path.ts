import crypto from "node:crypto";

import { validateBootstrapCore } from "../core/bootstrap-model.js";
import type {
  AstDocument,
  BootstrapRecognition,
  Diagnostic,
  SemanticDocument,
} from "../core/types.js";

export const bootstrapToolVersion = "0.0.0-bootstrap";

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
      readonly variables: 0;
      readonly candidates: 0;
      readonly constraints: 0;
    };
    readonly source_ids: readonly string[];
    readonly recognition_ids: readonly string[];
    readonly variables: readonly [];
    readonly constraint_ids: readonly [];
  };
}

export interface RecognitionResult extends ResultBase {
  readonly schema: "Llmrecog.RecognitionResult.v1";
  readonly found: boolean;
  readonly target: {
    readonly id: string;
    readonly declaration_kind: BootstrapRecognition["declaration_kind"] | null;
  };
  readonly recognition: BootstrapRecognition | null;
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
    tool_version: input.toolVersion ?? bootstrapToolVersion,
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
        observations: 0,
        entities: document.recognitions.filter(
          (recognition) => recognition.declaration_kind === "entity",
        ).length,
        records: document.recognitions.filter(
          (recognition) => recognition.declaration_kind === "record",
        ).length,
        variables: 0,
        candidates: 0,
        constraints: 0,
      },
      source_ids: document.sources.map((source) => source.id),
      recognition_ids: document.recognitions.map(
        (recognition) => recognition.id,
      ),
      variables: [],
      constraint_ids: [],
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
