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
  | { readonly kind: "identifier_list"; readonly items: readonly string[] }
  | { readonly kind: "block"; readonly fields: readonly AstField[] };

export interface AstField {
  readonly name: string;
  readonly value: AstValue;
  readonly span: SyntaxSpan;
  readonly recovered: boolean;
}

export type DeclarationKind =
  | "document"
  | "source"
  | "span"
  | "observation"
  | "entity"
  | "record"
  | "variable"
  | "candidate"
  | "constraint";

export interface AstDeclaration {
  readonly kind: DeclarationKind;
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

export interface ObservationRecord {
  readonly id: string;
  readonly surface: string;
  readonly grounded_in: readonly GroundingReference[];
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

export interface NormalizationRecord {
  readonly surface: string;
  readonly rule: string;
  readonly grounded_in: readonly GroundingReference[];
  readonly anchors: readonly GroundingReference[];
}

export interface EntityRecognition extends RecognitionBase {
  readonly declaration_kind: "entity";
  readonly type: string;
  readonly label: string;
}

interface RecordRecognitionBase extends RecognitionBase {
  readonly declaration_kind: "record";
  readonly subject_id?: string;
  readonly normalization?: NormalizationRecord;
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

export interface NormalizedValueRecognition extends RecordRecognitionBase {
  readonly record_kind: "normalized_value";
  readonly value: SemanticValue;
  readonly normalization: NormalizationRecord;
}

export interface VariableRecognition extends RecognitionBase {
  readonly declaration_kind: "variable";
  readonly value_type: "entity_ref" | "symbol" | "string";
  readonly candidate_ids: readonly string[];
}

export interface CandidateRecognition extends RecognitionBase {
  readonly declaration_kind: "candidate";
  readonly variable_id: string;
  readonly value: SemanticValue;
}

interface ConstraintRecognitionBase extends RecognitionBase {
  readonly declaration_kind: "constraint";
  readonly support: SupportRecord;
}

export interface OneOfConstraintRecognition extends ConstraintRecognitionBase {
  readonly constraint_kind: "one_of";
  readonly variable_id: string;
  readonly member_ids: readonly string[];
}

export interface RequiresConstraintRecognition extends ConstraintRecognitionBase {
  readonly constraint_kind: "requires";
  readonly antecedent_id: string;
  readonly consequent_id: string;
}

export interface BinaryConstraintRecognition extends ConstraintRecognitionBase {
  readonly constraint_kind: "excludes" | "same_as" | "distinct_from";
  readonly left_id: string;
  readonly right_id: string;
}

export type ConstraintRecognition =
  | OneOfConstraintRecognition
  | RequiresConstraintRecognition
  | BinaryConstraintRecognition;

export type Recognition =
  | EntityRecognition
  | RelationRecognition
  | PropertyRecognition
  | SubjectValueRecognition
  | AliasRecognition
  | NormalizedValueRecognition
  | VariableRecognition
  | CandidateRecognition
  | ConstraintRecognition;

export interface SemanticDocument {
  readonly schema: "Llmrecog.SemanticDocument.v1";
  readonly semantic_version: "0.1";
  readonly document_id: string;
  readonly title: string;
  readonly sources: readonly SourceRecord[];
  readonly spans: readonly SpanRecord[];
  readonly observations: readonly ObservationRecord[];
  readonly recognitions: readonly Recognition[];
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
