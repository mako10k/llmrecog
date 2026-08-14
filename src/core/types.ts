export interface TextPosition {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}

export interface SyntaxSpan {
  readonly start: TextPosition;
  readonly end: TextPosition;
}

export type AstValue =
  | { readonly kind: "identifier"; readonly value: string }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "confidence"; readonly value: number }
  | {
      readonly kind: "text_range";
      readonly start: { readonly line: number; readonly column: number };
      readonly end: { readonly line: number; readonly column: number };
    }
  | { readonly kind: "identifier_list"; readonly items: readonly string[] };

export interface AstField {
  readonly name: string;
  readonly value: AstValue;
  readonly span: SyntaxSpan;
  readonly recovered: boolean;
}

export type BootstrapDeclarationKind =
  "document" | "source" | "span" | "entity" | "record";

export interface AstDeclaration {
  readonly kind: BootstrapDeclarationKind;
  readonly id: string;
  readonly header_arguments: readonly string[];
  readonly fields: readonly AstField[];
  readonly span: SyntaxSpan;
  readonly recovered: boolean;
}

export interface AstDocument {
  readonly schema: "Llmrecog.Ast.v1";
  readonly syntax_version: "0.1";
  readonly recovered: boolean;
  readonly header: {
    readonly kind: "version_header";
    readonly version: "0.1";
    readonly span: SyntaxSpan;
  };
  readonly document: AstDeclaration;
  readonly declarations: readonly AstDeclaration[];
}

export interface Diagnostic {
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly entity_id: string | null;
  readonly span: SyntaxSpan | null;
  readonly reason_data: Readonly<Record<string, unknown>>;
  readonly related: readonly {
    readonly message: string;
    readonly entity_id: string | null;
    readonly span: SyntaxSpan | null;
  }[];
}

export interface GroundingReference {
  readonly id: string;
  readonly kind: "span" | "observation" | "recognition";
}

export interface SupportRecord {
  readonly kind: "explicit" | "linguistic" | "normalized" | "ambiguous";
  readonly grounded_in: readonly GroundingReference[];
  readonly confidence?: number;
}

export interface SourceRecord {
  readonly id: string;
  readonly kind: "text";
  readonly locator: string;
  readonly media_type?: string;
  readonly digest?: string;
  readonly observed_at?: string;
}

export interface SpanRecord {
  readonly id: string;
  readonly source_id: string;
  readonly range: {
    readonly start: { readonly line: number; readonly column: number };
    readonly end: { readonly line: number; readonly column: number };
  };
  readonly quote?: string;
}

export type SemanticValue =
  | { readonly kind: "reference"; readonly id: string }
  | { readonly kind: "symbol"; readonly value: string }
  | { readonly kind: "string"; readonly value: string };

interface RecognitionBase {
  readonly id: string;
  readonly grounded_in: readonly GroundingReference[];
  readonly support?: SupportRecord;
}

export interface EntityRecognition extends RecognitionBase {
  readonly declaration_kind: "entity";
  readonly type: string;
  readonly label: string;
}

interface RecordRecognitionBase extends RecognitionBase {
  readonly declaration_kind: "record";
  readonly subject_id?: string;
}

export interface RelationRecognition extends RecordRecognitionBase {
  readonly record_kind: "relation";
  readonly subject_id: string;
  readonly predicate: string;
  readonly object: SemanticValue;
}

export interface PropertyRecognition extends RecordRecognitionBase {
  readonly record_kind: "property";
  readonly subject_id: string;
  readonly predicate: string;
  readonly value: SemanticValue;
}

export interface SubjectValueRecognition extends RecordRecognitionBase {
  readonly record_kind: "intent" | "modality" | "polarity";
  readonly subject_id: string;
  readonly value: SemanticValue;
}

export interface AliasRecognition extends RecordRecognitionBase {
  readonly record_kind: "alias";
  readonly subject_id: string;
  readonly object: SemanticValue;
}

export type BootstrapRecognition =
  | EntityRecognition
  | RelationRecognition
  | PropertyRecognition
  | SubjectValueRecognition
  | AliasRecognition;

export interface SemanticDocument {
  readonly schema: "Llmrecog.SemanticDocument.v1";
  readonly semantic_version: "0.1";
  readonly document_id: string;
  readonly title: string;
  readonly sources: readonly SourceRecord[];
  readonly spans: readonly SpanRecord[];
  readonly observations: readonly [];
  readonly recognitions: readonly BootstrapRecognition[];
}

export interface CoreValidation {
  readonly structuralValid: boolean;
  readonly semanticValid: boolean;
  readonly complete: boolean;
  readonly truncated: boolean;
  readonly ast: AstDocument | null;
  readonly document: SemanticDocument | null;
  readonly diagnostics: readonly Diagnostic[];
}
