import { parseBootstrapDocument } from "./bootstrap-parser.js";
import type {
  AliasRecognition,
  AstDeclaration,
  AstField,
  AstValue,
  BinaryConstraintRecognition,
  CandidateRecognition,
  ConstraintRecognition,
  CoreValidation,
  Diagnostic,
  EntityRecognition,
  GroundingReference,
  NormalizationRecord,
  NormalizedValueRecognition,
  ObservationRecord,
  OneOfConstraintRecognition,
  PropertyRecognition,
  RelationRecognition,
  Recognition,
  RequiresConstraintRecognition,
  SemanticDocument,
  SemanticValue,
  SourceRecord,
  SpanRecord,
  SubjectValueRecognition,
  SupportRecord,
  SyntaxSpan,
  VariableRecognition,
} from "./types.js";

const semanticMessages: Readonly<Record<string, string>> = {
  "RCG-SYNTAX-011": "The field value is outside the closed 0.1 registry.",
  "RCG-REF-001": "A declaration ID is repeated in the document-wide namespace.",
  "RCG-REF-002": "A referenced declaration ID does not exist.",
  "RCG-REF-003": "A reference resolves to a declaration of the wrong kind.",
  "RCG-RECORD-001": "A record kind is outside the closed 0.1 registry.",
  "RCG-RECORD-002": "Record fields do not match the declared record kind.",
  "RCG-VALUE-001": "A variable value type is outside the closed 0.1 registry.",
  "RCG-VALUE-002": "A candidate value does not match its variable value type.",
  "RCG-CANDIDATE-001":
    "A candidate header and variable candidate list disagree.",
  "RCG-CONSTRAINT-001": "A constraint kind is outside the closed 0.1 registry.",
  "RCG-CONSTRAINT-002":
    "Constraint fields do not match the declared constraint kind.",
  "RCG-CONSTRAINT-003": "A one_of constraint must have at least one member.",
  "RCG-CONSTRAINT-004":
    "A one_of member is not a candidate of the referenced variable.",
  "RCG-CONSTRAINT-005":
    "A constraint operand is not the required declaration kind.",
  "RCG-SOURCE-001": "A digest is not a lowercase sha256 value.",
  "RCG-SOURCE-002": "A source range end must follow its start.",
  "RCG-SOURCE-003": "A source observed_at value is not an RFC 3339 timestamp.",
  "RCG-GROUND-001": "A semantic declaration has no provenance path.",
  "RCG-GROUND-002":
    "A constraint must ground and positively support the relationship.",
  "RCG-NORM-001": "Normalization lacks required grounded inputs.",
  "RCG-BOUNDARY-001":
    "A reasoning, decision, or realization role cannot be declared as recognition.",
  "RCG-BOUNDARY-002":
    "A downstream inference artifact cannot be presented as original-source recognition.",
};

interface ModelResult {
  readonly document: SemanticDocument | null;
  readonly diagnostics: readonly Diagnostic[];
}

function diagnostic(
  code: string,
  entityId: string | null,
  span: SyntaxSpan | null,
  reasonData: Readonly<Record<string, unknown>>,
): Diagnostic {
  return {
    code,
    severity: "error",
    message: semanticMessages[code] ?? code,
    entity_id: entityId,
    span,
    reason_data: reasonData,
    related: [],
  };
}

function field(
  declaration: AstDeclaration,
  name: string,
): AstField | undefined {
  return declaration.fields.find((candidate) => candidate.name === name);
}

function blockFields(fieldValue: AstValue | undefined): readonly AstField[] {
  return fieldValue?.kind === "block" ? fieldValue.fields : [];
}

function nestedField(
  fields: readonly AstField[],
  name: string,
): AstField | undefined {
  return fields.find((candidate) => candidate.name === name);
}

function identifierValue(value: AstValue | undefined): string {
  return value?.kind === "identifier" ? value.value : "INVALID";
}

function stringValue(value: AstValue | undefined): string {
  return value?.kind === "string" ? value.value : "";
}

function identifierFieldValue(
  declaration: AstDeclaration,
  name: string,
): string {
  return identifierValue(field(declaration, name)?.value);
}

function listValue(value: AstValue | undefined): readonly string[] {
  return value?.kind === "identifier_list" ? value.items : [];
}

function confidenceValue(value: AstValue | undefined): number | undefined {
  return value?.kind === "confidence" ? value.value : undefined;
}

function declarationKinds(
  astDocument: AstDeclaration,
  declarations: readonly AstDeclaration[],
): ReadonlyMap<string, AstDeclaration> {
  const result = new Map<string, AstDeclaration>();
  result.set(astDocument.id, astDocument);
  for (const declaration of declarations) {
    if (!result.has(declaration.id)) result.set(declaration.id, declaration);
  }
  return result;
}

function duplicateDiagnostics(
  astDocument: AstDeclaration,
  declarations: readonly AstDeclaration[],
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const first = new Map<string, AstDeclaration>();
  for (const declaration of [astDocument, ...declarations]) {
    const existing = first.get(declaration.id);
    if (existing === undefined) {
      first.set(declaration.id, declaration);
      continue;
    }
    diagnostics.push(
      diagnostic("RCG-REF-001", declaration.id, declaration.span, {
        duplicate_id: declaration.id,
        first_declaration_kind: existing.kind,
      }),
    );
  }
  return diagnostics;
}

function validateSourceKind(
  declaration: AstDeclaration,
  diagnostics: Diagnostic[],
): void {
  const kindField = field(declaration, "kind");
  const kind = identifierValue(kindField?.value);
  if (kind === "text") return;
  diagnostics.push(
    diagnostic("RCG-SYNTAX-011", declaration.id, kindField?.span ?? null, {
      field: "kind",
      declaration_kind: "source",
      value: kind,
      expected: "text",
    }),
  );
}

function optionalStringField(
  declaration: AstDeclaration,
  name: string,
): string | undefined {
  const candidate = field(declaration, name);
  return candidate === undefined ? undefined : stringValue(candidate.value);
}

function validateSourceDigest(
  declaration: AstDeclaration,
  digest: string | undefined,
  diagnostics: Diagnostic[],
): void {
  if (digest === undefined || /^sha256:[0-9a-f]{64}$/u.test(digest)) return;
  diagnostics.push(
    diagnostic(
      "RCG-SOURCE-001",
      declaration.id,
      field(declaration, "digest")?.span ?? null,
      { digest },
    ),
  );
}

function validateObservedAt(
  declaration: AstDeclaration,
  observedAt: string | undefined,
  diagnostics: Diagnostic[],
): void {
  const rfc3339 =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
  if (observedAt === undefined || rfc3339.test(observedAt)) return;
  diagnostics.push(
    diagnostic(
      "RCG-SOURCE-003",
      declaration.id,
      field(declaration, "observed_at")?.span ?? null,
      { observed_at: observedAt },
    ),
  );
}

function sourceFromDeclaration(
  declaration: AstDeclaration,
  diagnostics: Diagnostic[],
): SourceRecord {
  validateSourceKind(declaration, diagnostics);
  const locator = stringValue(field(declaration, "locator")?.value);
  const mediaType = optionalStringField(declaration, "media_type");
  const digest = optionalStringField(declaration, "digest");
  const observedAt = optionalStringField(declaration, "observed_at");
  validateSourceDigest(declaration, digest, diagnostics);
  validateObservedAt(declaration, observedAt, diagnostics);
  return {
    id: declaration.id,
    kind: "text",
    locator,
    ...(mediaType === undefined ? {} : { media_type: mediaType }),
    ...(digest === undefined ? {} : { digest }),
    ...(observedAt === undefined ? {} : { observed_at: observedAt }),
  };
}

function validateSourceReference(
  declaration: AstDeclaration,
  sourceField: AstField | undefined,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
): string {
  const sourceId = identifierValue(sourceField?.value);
  const target = kinds.get(sourceId);
  if (target === undefined) {
    diagnostics.push(
      diagnostic("RCG-REF-002", declaration.id, sourceField?.span ?? null, {
        reference_id: sourceId,
        expected_kinds: ["source"],
      }),
    );
  } else if (target.kind !== "source") {
    diagnostics.push(
      diagnostic("RCG-REF-003", declaration.id, sourceField?.span ?? null, {
        reference_id: sourceId,
        actual_kind: target.kind,
        expected_kinds: ["source"],
      }),
    );
  }
  return sourceId;
}

function textRange(value: AstValue | undefined): SpanRecord["range"] {
  return value?.kind === "text_range"
    ? { start: value.start, end: value.end }
    : { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };
}

function validateTextRange(
  declaration: AstDeclaration,
  rangeField: AstField | undefined,
  range: SpanRecord["range"],
  diagnostics: Diagnostic[],
): void {
  const sameLineNotForward =
    range.end.line === range.start.line &&
    range.end.column <= range.start.column;
  if (range.end.line >= range.start.line && !sameLineNotForward) return;
  diagnostics.push(
    diagnostic("RCG-SOURCE-002", declaration.id, rangeField?.span ?? null, {
      start: range.start,
      end: range.end,
    }),
  );
}

function spanFromDeclaration(
  declaration: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
): SpanRecord {
  const sourceField = field(declaration, "source");
  const sourceId = validateSourceReference(
    declaration,
    sourceField,
    kinds,
    diagnostics,
  );
  const rangeField = field(declaration, "range");
  const range = textRange(rangeField?.value);
  validateTextRange(declaration, rangeField, range, diagnostics);
  const quoteField = field(declaration, "quote");
  return {
    id: declaration.id,
    source_id: sourceId,
    range,
    ...(quoteField === undefined
      ? {}
      : { quote: stringValue(quoteField.value) }),
  };
}

function groundingReference(
  id: string,
  declaration: AstDeclaration,
  groundingField: AstField | undefined,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
): GroundingReference | null {
  const expectedKinds = ["span", "observation", "recognition"];
  const target = kinds.get(id);
  if (target === undefined) {
    diagnostics.push(
      diagnostic("RCG-REF-002", declaration.id, groundingField?.span ?? null, {
        reference_id: id,
        expected_kinds: expectedKinds,
      }),
    );
    return null;
  }
  if (target.kind === "span") return { id, kind: "span" };
  if (target.kind === "observation") return { id, kind: "observation" };
  if (
    ["entity", "record", "variable", "candidate", "constraint"].includes(
      target.kind,
    )
  ) {
    return { id, kind: "recognition" };
  }
  diagnostics.push(
    diagnostic("RCG-REF-003", declaration.id, groundingField?.span ?? null, {
      reference_id: id,
      actual_kind: target.kind,
      expected_kinds: expectedKinds,
    }),
  );
  return null;
}

function groundingReferences(
  declaration: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
): readonly GroundingReference[] {
  const groundingField = field(declaration, "grounded_in");
  const ids = listValue(groundingField?.value);
  if (ids.length === 0) {
    diagnostics.push(
      diagnostic(
        "RCG-GROUND-001",
        declaration.id,
        groundingField?.span ?? declaration.span,
        {
          missing_field: "grounded_in",
        },
      ),
    );
    return [];
  }
  const result: GroundingReference[] = [];
  for (const id of ids) {
    const reference = groundingReference(
      id,
      declaration,
      groundingField,
      kinds,
      diagnostics,
    );
    if (reference !== null) result.push(reference);
  }
  return result;
}

function supportRecord(
  declaration: AstDeclaration,
  groundedIn: readonly GroundingReference[],
  diagnostics: Diagnostic[],
): SupportRecord | undefined {
  const supportField = field(declaration, "support");
  if (supportField === undefined) return undefined;
  const kind = identifierValue(supportField.value);
  if (!["explicit", "linguistic", "normalized", "ambiguous"].includes(kind)) {
    diagnostics.push(
      diagnostic("RCG-SYNTAX-011", declaration.id, supportField.span, {
        field: "support",
        value: kind,
      }),
    );
    return undefined;
  }
  const confidence = confidenceValue(field(declaration, "confidence")?.value);
  return {
    kind: kind as SupportRecord["kind"],
    grounded_in: groundedIn,
    ...(confidence === undefined ? {} : { confidence }),
  };
}

function requireSubject(
  declaration: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
): string {
  const subjectField = field(declaration, "subject");
  const subjectId = identifierValue(subjectField?.value);
  const target = kinds.get(subjectId);
  if (target === undefined) {
    diagnostics.push(
      diagnostic("RCG-REF-002", declaration.id, subjectField?.span ?? null, {
        reference_id: subjectId,
        expected_kinds: ["entity", "variable"],
      }),
    );
  } else if (target.kind !== "entity") {
    diagnostics.push(
      diagnostic("RCG-REF-003", declaration.id, subjectField?.span ?? null, {
        reference_id: subjectId,
        actual_kind: target.kind,
        expected_kinds: ["entity", "variable"],
      }),
    );
  }
  return subjectId;
}

function semanticValue(
  value: AstValue | undefined,
  kinds: ReadonlyMap<string, AstDeclaration>,
): SemanticValue {
  if (value?.kind === "string") return { kind: "string", value: value.value };
  const identifier = identifierValue(value);
  const target = kinds.get(identifier);
  return target !== undefined &&
    ["entity", "record", "variable", "candidate", "constraint"].includes(
      target.kind,
    )
    ? { kind: "reference", id: identifier }
    : { kind: "symbol", value: identifier };
}

function semanticFieldValue(
  declaration: AstDeclaration,
  name: string,
  kinds: ReadonlyMap<string, AstDeclaration>,
): SemanticValue {
  return semanticValue(field(declaration, name)?.value, kinds);
}

function observationFromDeclaration(
  declaration: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
): ObservationRecord {
  return {
    id: declaration.id,
    surface: stringValue(field(declaration, "surface")?.value),
    grounded_in: groundingReferences(declaration, kinds, diagnostics),
  };
}

function entityFromDeclaration(
  declaration: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
): EntityRecognition {
  const groundedIn = groundingReferences(declaration, kinds, diagnostics);
  const support = supportRecord(declaration, groundedIn, diagnostics);
  return {
    declaration_kind: "entity",
    id: declaration.id,
    type: identifierValue(field(declaration, "type")?.value),
    label: stringValue(field(declaration, "label")?.value),
    grounded_in: groundedIn,
    ...(support === undefined ? {} : { support }),
  };
}

type SupportedRecordKind =
  | "relation"
  | "property"
  | "intent"
  | "modality"
  | "polarity"
  | "alias"
  | "normalized_value";

interface RecordShape {
  readonly required: readonly string[];
  readonly forbidden: readonly string[];
}

const recordShapes: Readonly<Record<SupportedRecordKind, RecordShape>> = {
  relation: {
    required: ["subject", "predicate", "object"],
    forbidden: [],
  },
  property: {
    required: ["subject", "predicate", "value"],
    forbidden: [],
  },
  intent: { required: ["subject", "value"], forbidden: ["predicate"] },
  modality: { required: ["subject", "value"], forbidden: ["predicate"] },
  polarity: { required: ["subject", "value"], forbidden: ["predicate"] },
  alias: { required: ["subject", "object"], forbidden: ["predicate"] },
  normalized_value: {
    required: ["value", "normalization"],
    forbidden: ["subject", "predicate", "object"],
  },
};

function isSupportedRecordKind(value: string): value is SupportedRecordKind {
  return Object.hasOwn(recordShapes, value);
}

function recordShapeMatches(
  recordKind: SupportedRecordKind,
  declaration: AstDeclaration,
): boolean {
  const names = new Set(declaration.fields.map((candidate) => candidate.name));
  const shape = recordShapes[recordKind];
  return (
    shape.required.every((name) => names.has(name)) &&
    shape.forbidden.every((name) => !names.has(name))
  );
}

function boundaryDiagnostics(
  declaration: AstDeclaration,
  recordKind: string,
  spans: readonly SpanRecord[],
  sources: readonly SourceRecord[],
  diagnostics: Diagnostic[],
): boolean {
  if (
    !["hypothesis", "inference", "conclusion", "decision"].includes(recordKind)
  ) {
    return false;
  }
  const kindSpan = field(declaration, "kind")?.span ?? declaration.span;
  diagnostics.push(
    diagnostic("RCG-BOUNDARY-001", declaration.id, kindSpan, {
      record_kind: recordKind,
      owner: "llmthink",
    }),
  );
  const groundingIds = listValue(field(declaration, "grounded_in")?.value);
  for (const groundingId of groundingIds) {
    const sourceId = spans.find(
      (candidate) => candidate.id === groundingId,
    )?.source_id;
    const source = sources.find((candidate) => candidate.id === sourceId);
    if (source?.locator.startsWith("llmthink://") === true) {
      diagnostics.push(
        diagnostic("RCG-BOUNDARY-002", declaration.id, kindSpan, {
          source_id: source.id,
          source_locator: source.locator,
        }),
      );
      break;
    }
  }
  return true;
}

function referencesFromField(
  declaration: AstDeclaration,
  referenceField: AstField | undefined,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
): readonly GroundingReference[] {
  const result: GroundingReference[] = [];
  for (const id of listValue(referenceField?.value)) {
    const reference = groundingReference(
      id,
      declaration,
      referenceField,
      kinds,
      diagnostics,
    );
    if (reference !== null) result.push(reference);
  }
  return result;
}

function normalizationFromDeclaration(
  declaration: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
): NormalizationRecord | undefined {
  const normalizationField = field(declaration, "normalization");
  if (normalizationField === undefined) return undefined;
  const fields = blockFields(normalizationField.value);
  const missingFields = ["surface", "rule", "grounded_in"].filter(
    (name) => nestedField(fields, name) === undefined,
  );
  const groundingField = nestedField(fields, "grounded_in");
  if (
    groundingField !== undefined &&
    listValue(groundingField.value).length === 0
  ) {
    missingFields.push("grounded_in");
  }
  if (missingFields.length > 0) {
    diagnostics.push(
      diagnostic("RCG-NORM-001", declaration.id, normalizationField.span, {
        missing_fields: [...new Set(missingFields)],
      }),
    );
    return undefined;
  }
  return {
    surface: stringValue(nestedField(fields, "surface")?.value),
    rule: identifierValue(nestedField(fields, "rule")?.value),
    grounded_in: referencesFromField(
      declaration,
      groundingField,
      kinds,
      diagnostics,
    ),
    anchors: referencesFromField(
      declaration,
      nestedField(fields, "anchors"),
      kinds,
      diagnostics,
    ),
  };
}

type CompleteRecordRecognition =
  | RelationRecognition
  | PropertyRecognition
  | SubjectValueRecognition
  | AliasRecognition
  | NormalizedValueRecognition;

interface BuiltRecordBase {
  readonly declaration_kind: "record";
  readonly id: string;
  readonly grounded_in: readonly GroundingReference[];
  readonly support?: SupportRecord;
  readonly normalization?: NormalizationRecord;
}

function buildRecordRecognition(
  declaration: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
  recordKind: SupportedRecordKind,
  base: BuiltRecordBase,
): CompleteRecordRecognition | null {
  if (recordKind === "normalized_value") {
    if (base.normalization === undefined) return null;
    return {
      ...base,
      record_kind: "normalized_value",
      value: semanticFieldValue(declaration, "value", kinds),
      normalization: base.normalization,
    };
  }
  const subjectId = requireSubject(declaration, kinds, diagnostics);
  switch (recordKind) {
    case "relation": {
      const result: RelationRecognition = {
        ...base,
        record_kind: "relation",
        subject_id: subjectId,
        predicate: identifierFieldValue(declaration, "predicate"),
        object: semanticFieldValue(declaration, "object", kinds),
      };
      return result;
    }
    case "property": {
      const result: PropertyRecognition = {
        ...base,
        record_kind: "property",
        subject_id: subjectId,
        predicate: identifierFieldValue(declaration, "predicate"),
        value: semanticFieldValue(declaration, "value", kinds),
      };
      return result;
    }
    case "intent":
    case "modality":
    case "polarity": {
      const result: SubjectValueRecognition = {
        ...base,
        record_kind: recordKind,
        subject_id: subjectId,
        value: semanticFieldValue(declaration, "value", kinds),
      };
      return result;
    }
    case "alias": {
      const result: AliasRecognition = {
        ...base,
        record_kind: "alias",
        subject_id: subjectId,
        object: semanticFieldValue(declaration, "object", kinds),
      };
      return result;
    }
  }
}

function recordFromDeclaration(
  declaration: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
  sources: readonly SourceRecord[],
  spans: readonly SpanRecord[],
  diagnostics: Diagnostic[],
): Recognition | null {
  const kindField = field(declaration, "kind");
  const recordKind = identifierValue(kindField?.value);
  if (
    boundaryDiagnostics(declaration, recordKind, spans, sources, diagnostics)
  ) {
    return null;
  }
  if (!isSupportedRecordKind(recordKind)) {
    diagnostics.push(
      diagnostic(
        "RCG-RECORD-001",
        declaration.id,
        kindField?.span ?? declaration.span,
        {
          record_kind: recordKind,
        },
      ),
    );
    return null;
  }
  if (!recordShapeMatches(recordKind, declaration)) {
    diagnostics.push(
      diagnostic(
        "RCG-RECORD-002",
        declaration.id,
        kindField?.span ?? declaration.span,
        {
          record_kind: recordKind,
          fields: declaration.fields.map((candidate) => candidate.name),
        },
      ),
    );
    return null;
  }

  const groundedIn = groundingReferences(declaration, kinds, diagnostics);
  const support = supportRecord(declaration, groundedIn, diagnostics);
  const normalization = normalizationFromDeclaration(
    declaration,
    kinds,
    diagnostics,
  );
  const base = {
    declaration_kind: "record" as const,
    id: declaration.id,
    grounded_in: groundedIn,
    ...(support === undefined ? {} : { support }),
    ...(normalization === undefined ? {} : { normalization }),
  };
  return buildRecordRecognition(
    declaration,
    kinds,
    diagnostics,
    recordKind,
    base,
  );
}

const valueTypes = ["entity_ref", "symbol", "string"] as const;

function isValueType(
  value: string,
): value is VariableRecognition["value_type"] {
  return valueTypes.includes(value as VariableRecognition["value_type"]);
}

function declarationHeaderSpan(declaration: AstDeclaration): SyntaxSpan {
  const firstField = declaration.fields[0];
  if (firstField === undefined) return declaration.span;
  return {
    start: declaration.span.start,
    end: {
      line: firstField.span.start.line,
      column: 1,
      offset: firstField.span.start.offset - (firstField.span.start.column - 1),
    },
  };
}

function validatedValueType(
  declaration: AstDeclaration,
  diagnostics: Diagnostic[],
): VariableRecognition["value_type"] {
  const valueTypeField = field(declaration, "value_type");
  const rawValueType = identifierValue(valueTypeField?.value);
  if (isValueType(rawValueType)) return rawValueType;
  diagnostics.push(
    diagnostic(
      "RCG-VALUE-001",
      declaration.id,
      valueTypeField?.span ?? declaration.span,
      { value_type: rawValueType },
    ),
  );
  return "symbol";
}

function validateVariableCandidate(
  variable: AstDeclaration,
  candidateId: string,
  candidateField: AstField | undefined,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
): void {
  const candidate = kinds.get(candidateId);
  if (candidate === undefined) {
    diagnostics.push(
      diagnostic("RCG-REF-002", variable.id, candidateField?.span ?? null, {
        reference_id: candidateId,
        expected_kinds: ["candidate"],
      }),
    );
    return;
  }
  if (candidate.kind !== "candidate") {
    diagnostics.push(
      diagnostic("RCG-REF-003", variable.id, candidateField?.span ?? null, {
        reference_id: candidateId,
        actual_kind: candidate.kind,
        expected_kinds: ["candidate"],
      }),
    );
    return;
  }
  if (candidate.header_arguments[0] === variable.id) return;
  diagnostics.push(
    diagnostic(
      "RCG-CANDIDATE-001",
      candidate.id,
      candidateField?.span ?? null,
      {
        candidate_id: candidate.id,
        variable_id: variable.id,
        declared_variable_id: candidate.header_arguments[0] ?? null,
      },
    ),
  );
}

function variableFromDeclaration(
  declaration: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
): VariableRecognition {
  const candidateField = field(declaration, "candidates");
  const candidateIds = listValue(candidateField?.value);
  for (const candidateId of candidateIds) {
    validateVariableCandidate(
      declaration,
      candidateId,
      candidateField,
      kinds,
      diagnostics,
    );
  }
  return {
    declaration_kind: "variable",
    id: declaration.id,
    value_type: validatedValueType(declaration, diagnostics),
    candidate_ids: candidateIds,
    grounded_in: groundingReferences(declaration, kinds, diagnostics),
  };
}

function candidateValueMatches(
  declaration: AstDeclaration,
  variable: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
): boolean {
  const rawValue = field(declaration, "value")?.value;
  const valueType = identifierFieldValue(variable, "value_type");
  if (valueType === "string") return rawValue?.kind === "string";
  if (valueType === "symbol") {
    return (
      rawValue?.kind === "identifier" && kinds.get(rawValue.value) === undefined
    );
  }
  if (valueType === "entity_ref" && rawValue?.kind === "identifier") {
    return kinds.get(rawValue.value)?.kind === "entity";
  }
  return false;
}

function candidateFromDeclaration(
  declaration: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
): CandidateRecognition {
  const variableId = declaration.header_arguments[0] ?? "INVALID";
  const variable = kinds.get(variableId);
  if (variable === undefined) {
    diagnostics.push(
      diagnostic(
        "RCG-REF-002",
        declaration.id,
        declarationHeaderSpan(declaration),
        { reference_id: variableId, expected_kinds: ["variable"] },
      ),
    );
  } else if (variable.kind !== "variable") {
    diagnostics.push(
      diagnostic(
        "RCG-REF-003",
        declaration.id,
        declarationHeaderSpan(declaration),
        {
          reference_id: variableId,
          actual_kind: variable.kind,
          expected_kinds: ["variable"],
        },
      ),
    );
  } else {
    const listed = listValue(field(variable, "candidates")?.value).includes(
      declaration.id,
    );
    if (!listed) {
      diagnostics.push(
        diagnostic(
          "RCG-CANDIDATE-001",
          declaration.id,
          declarationHeaderSpan(declaration),
          { candidate_id: declaration.id, variable_id: variableId },
        ),
      );
    }
    if (!candidateValueMatches(declaration, variable, kinds)) {
      diagnostics.push(
        diagnostic(
          "RCG-VALUE-002",
          declaration.id,
          field(declaration, "value")?.span ?? declaration.span,
          {
            variable_id: variableId,
            value_type: identifierFieldValue(variable, "value_type"),
          },
        ),
      );
    }
  }
  const groundedIn = groundingReferences(declaration, kinds, diagnostics);
  const support = supportRecord(declaration, groundedIn, diagnostics);
  return {
    declaration_kind: "candidate",
    id: declaration.id,
    variable_id: variableId,
    value: semanticFieldValue(declaration, "value", kinds),
    grounded_in: groundedIn,
    ...(support === undefined ? {} : { support }),
  };
}

type SupportedConstraintKind =
  "one_of" | "requires" | "excludes" | "same_as" | "distinct_from";

const constraintShapes: Readonly<
  Record<SupportedConstraintKind, readonly string[]>
> = {
  one_of: ["variable", "members"],
  requires: ["antecedent", "consequent"],
  excludes: ["left", "right"],
  same_as: ["left", "right"],
  distinct_from: ["left", "right"],
};

function isConstraintKind(value: string): value is SupportedConstraintKind {
  return Object.hasOwn(constraintShapes, value);
}

function constraintShapeMatches(
  declaration: AstDeclaration,
  constraintKind: SupportedConstraintKind,
): boolean {
  const semanticFields = declaration.fields
    .map((candidate) => candidate.name)
    .filter(
      (name) =>
        !["kind", "grounded_in", "support", "confidence"].includes(name),
    );
  const expected = constraintShapes[constraintKind];
  return (
    semanticFields.length === expected.length &&
    expected.every((name, index) => semanticFields[index] === name)
  );
}

function requireConstraintReference(
  declaration: AstDeclaration,
  name: string,
  expectedKind: "candidate" | "variable",
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
): AstDeclaration | undefined {
  const operandField = field(declaration, name);
  const referenceId = identifierValue(operandField?.value);
  const target = kinds.get(referenceId);
  if (target === undefined) {
    diagnostics.push(
      diagnostic("RCG-REF-002", declaration.id, operandField?.span ?? null, {
        reference_id: referenceId,
        expected_kinds: [expectedKind],
      }),
    );
    return undefined;
  }
  if (target.kind !== expectedKind) {
    diagnostics.push(
      diagnostic(
        "RCG-CONSTRAINT-005",
        declaration.id,
        operandField?.span ?? null,
        {
          operand: name,
          reference_id: referenceId,
          actual_kind: target.kind,
          expected_kind: expectedKind,
        },
      ),
    );
    return undefined;
  }
  return target;
}

function constraintRelationship(
  declaration: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
): {
  readonly groundedIn: readonly GroundingReference[];
  readonly support: SupportRecord;
} | null {
  const groundingField = field(declaration, "grounded_in");
  const supportField = field(declaration, "support");
  const missingFields: string[] = [];
  if (
    groundingField === undefined ||
    listValue(groundingField.value).length === 0
  ) {
    missingFields.push("grounded_in");
  }
  if (supportField === undefined) missingFields.push("support");
  if (missingFields.length > 0) {
    diagnostics.push(
      diagnostic(
        "RCG-GROUND-002",
        declaration.id,
        declarationHeaderSpan(declaration),
        { missing_fields: missingFields },
      ),
    );
    return null;
  }
  const groundedIn = referencesFromField(
    declaration,
    groundingField,
    kinds,
    diagnostics,
  );
  const support = supportRecord(declaration, groundedIn, diagnostics);
  return support === undefined ? null : { groundedIn, support };
}

function validateOneOfMember(
  declaration: AstDeclaration,
  variableId: string,
  variableCandidates: readonly string[],
  memberId: string,
  membersField: AstField | undefined,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
): void {
  const member = kinds.get(memberId);
  if (member === undefined) {
    diagnostics.push(
      diagnostic("RCG-REF-002", declaration.id, membersField?.span ?? null, {
        reference_id: memberId,
        expected_kinds: ["candidate"],
      }),
    );
    return;
  }
  const matches =
    member.kind === "candidate" &&
    member.header_arguments[0] === variableId &&
    variableCandidates.includes(memberId);
  if (matches) return;
  diagnostics.push(
    diagnostic(
      "RCG-CONSTRAINT-004",
      declaration.id,
      membersField?.span ?? null,
      { variable_id: variableId, member_id: memberId },
    ),
  );
}

function oneOfConstraint(
  declaration: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
  base: Omit<
    OneOfConstraintRecognition,
    "constraint_kind" | "variable_id" | "member_ids"
  >,
): OneOfConstraintRecognition {
  const variableId = identifierFieldValue(declaration, "variable");
  const variable = requireConstraintReference(
    declaration,
    "variable",
    "variable",
    kinds,
    diagnostics,
  );
  const membersField = field(declaration, "members");
  const memberIds = listValue(membersField?.value);
  if (memberIds.length === 0) {
    diagnostics.push(
      diagnostic(
        "RCG-CONSTRAINT-003",
        declaration.id,
        membersField?.span ?? declaration.span,
        { variable_id: variableId },
      ),
    );
  }
  const variableCandidates =
    variable?.kind === "variable"
      ? listValue(field(variable, "candidates")?.value)
      : [];
  for (const memberId of memberIds) {
    validateOneOfMember(
      declaration,
      variableId,
      variableCandidates,
      memberId,
      membersField,
      kinds,
      diagnostics,
    );
  }
  return {
    ...base,
    constraint_kind: "one_of",
    variable_id: variableId,
    member_ids: memberIds,
  };
}

function requiresConstraint(
  declaration: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
  base: Omit<
    RequiresConstraintRecognition,
    "constraint_kind" | "antecedent_id" | "consequent_id"
  >,
): RequiresConstraintRecognition {
  requireConstraintReference(
    declaration,
    "antecedent",
    "candidate",
    kinds,
    diagnostics,
  );
  requireConstraintReference(
    declaration,
    "consequent",
    "candidate",
    kinds,
    diagnostics,
  );
  return {
    ...base,
    constraint_kind: "requires",
    antecedent_id: identifierFieldValue(declaration, "antecedent"),
    consequent_id: identifierFieldValue(declaration, "consequent"),
  };
}

function binaryConstraint(
  declaration: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
  constraintKind: BinaryConstraintRecognition["constraint_kind"],
  base: Omit<
    BinaryConstraintRecognition,
    "constraint_kind" | "left_id" | "right_id"
  >,
): BinaryConstraintRecognition {
  const expectedKind = constraintKind === "excludes" ? "candidate" : "variable";
  const left = requireConstraintReference(
    declaration,
    "left",
    expectedKind,
    kinds,
    diagnostics,
  );
  const right = requireConstraintReference(
    declaration,
    "right",
    expectedKind,
    kinds,
    diagnostics,
  );
  if (
    expectedKind === "variable" &&
    left?.kind === "variable" &&
    right?.kind === "variable" &&
    identifierFieldValue(left, "value_type") !==
      identifierFieldValue(right, "value_type")
  ) {
    diagnostics.push(
      diagnostic(
        "RCG-CONSTRAINT-005",
        declaration.id,
        field(declaration, "right")?.span ?? null,
        {
          operand: "right",
          reference_id: right.id,
          expected_value_type: identifierFieldValue(left, "value_type"),
          actual_value_type: identifierFieldValue(right, "value_type"),
        },
      ),
    );
  }
  return {
    ...base,
    constraint_kind: constraintKind,
    left_id: identifierFieldValue(declaration, "left"),
    right_id: identifierFieldValue(declaration, "right"),
  };
}

function validatedConstraintKind(
  declaration: AstDeclaration,
  diagnostics: Diagnostic[],
): SupportedConstraintKind | null {
  const kindField = field(declaration, "kind");
  const constraintKind = identifierValue(kindField?.value);
  if (!isConstraintKind(constraintKind)) {
    diagnostics.push(
      diagnostic(
        "RCG-CONSTRAINT-001",
        declaration.id,
        kindField?.span ?? declaration.span,
        { constraint_kind: constraintKind },
      ),
    );
    return null;
  }
  if (constraintShapeMatches(declaration, constraintKind)) {
    return constraintKind;
  }
  diagnostics.push(
    diagnostic(
      "RCG-CONSTRAINT-002",
      declaration.id,
      kindField?.span ?? declaration.span,
      {
        constraint_kind: constraintKind,
        fields: declaration.fields.map((candidate) => candidate.name),
      },
    ),
  );
  return null;
}

function buildConstraintRecognition(
  declaration: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
  constraintKind: SupportedConstraintKind,
  base: Omit<ConstraintRecognition, "constraint_kind">,
): ConstraintRecognition {
  switch (constraintKind) {
    case "one_of":
      return oneOfConstraint(declaration, kinds, diagnostics, base);
    case "requires":
      return requiresConstraint(declaration, kinds, diagnostics, base);
    case "excludes":
    case "same_as":
    case "distinct_from":
      return binaryConstraint(
        declaration,
        kinds,
        diagnostics,
        constraintKind,
        base,
      );
  }
}

function constraintFromDeclaration(
  declaration: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
  diagnostics: Diagnostic[],
): ConstraintRecognition | null {
  const constraintKind = validatedConstraintKind(declaration, diagnostics);
  if (constraintKind === null) return null;
  const relationship = constraintRelationship(declaration, kinds, diagnostics);
  if (relationship === null) return null;
  const base = {
    declaration_kind: "constraint" as const,
    id: declaration.id,
    grounded_in: relationship.groundedIn,
    support: relationship.support,
  };
  return buildConstraintRecognition(
    declaration,
    kinds,
    diagnostics,
    constraintKind,
    base,
  );
}

function buildModel(
  astDocument: AstDeclaration,
  declarations: readonly AstDeclaration[],
): ModelResult {
  const diagnostics = [...duplicateDiagnostics(astDocument, declarations)];
  const kinds = declarationKinds(astDocument, declarations);
  const sources = declarations
    .filter((declaration) => declaration.kind === "source")
    .map((declaration) => sourceFromDeclaration(declaration, diagnostics));
  const spans = declarations
    .filter((declaration) => declaration.kind === "span")
    .map((declaration) => spanFromDeclaration(declaration, kinds, diagnostics));
  const observations = declarations
    .filter((declaration) => declaration.kind === "observation")
    .map((declaration) =>
      observationFromDeclaration(declaration, kinds, diagnostics),
    );
  const recognitions: Recognition[] = [];
  for (const declaration of declarations) {
    if (declaration.kind === "entity") {
      recognitions.push(entityFromDeclaration(declaration, kinds, diagnostics));
    } else if (declaration.kind === "record") {
      const recognition = recordFromDeclaration(
        declaration,
        kinds,
        sources,
        spans,
        diagnostics,
      );
      if (recognition !== null) recognitions.push(recognition);
    } else if (declaration.kind === "variable") {
      recognitions.push(
        variableFromDeclaration(declaration, kinds, diagnostics),
      );
    } else if (declaration.kind === "candidate") {
      recognitions.push(
        candidateFromDeclaration(declaration, kinds, diagnostics),
      );
    } else if (declaration.kind === "constraint") {
      const constraint = constraintFromDeclaration(
        declaration,
        kinds,
        diagnostics,
      );
      if (constraint !== null) recognitions.push(constraint);
    }
  }
  const document: SemanticDocument = {
    schema: "Llmrecog.SemanticDocument.v1",
    semantic_version: "0.1",
    document_id: astDocument.id,
    title: stringValue(field(astDocument, "title")?.value),
    sources,
    spans,
    observations,
    recognitions,
  };
  return {
    document: diagnostics.some((entry) => entry.severity === "error")
      ? null
      : document,
    diagnostics,
  };
}

function sortDiagnostics(
  diagnostics: readonly Diagnostic[],
): readonly Diagnostic[] {
  return [...diagnostics].sort((left, right) => {
    const leftOffset = left.span?.start.offset ?? -1;
    const rightOffset = right.span?.start.offset ?? -1;
    if (leftOffset !== rightOffset) return leftOffset - rightOffset;
    const codeOrder = compareCodeUnits(left.code, right.code);
    if (codeOrder !== 0) return codeOrder;
    return compareCodeUnits(left.entity_id ?? "", right.entity_id ?? "");
  });
}

function compareCodeUnits(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function validateBootstrapCore(
  bytes: Uint8Array,
  maximumDiagnostics = 100,
): CoreValidation {
  const parsed = parseBootstrapDocument(bytes);
  const structuralValid =
    parsed.ast !== null &&
    !parsed.diagnostics.some((entry) => entry.severity === "error");
  const model =
    structuralValid && parsed.ast !== null
      ? buildModel(parsed.ast.document, parsed.ast.declarations)
      : { document: null, diagnostics: [] };
  const allDiagnostics = sortDiagnostics([
    ...parsed.diagnostics,
    ...model.diagnostics,
  ]);
  const truncated = allDiagnostics.length > maximumDiagnostics;
  const diagnostics = allDiagnostics.slice(0, maximumDiagnostics);
  const semanticValid = structuralValid && model.document !== null;
  return {
    structuralValid,
    semanticValid,
    complete: !truncated,
    truncated,
    ast: parsed.ast,
    document: semanticValid ? model.document : null,
    diagnostics,
  };
}
