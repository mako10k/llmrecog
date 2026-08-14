import { parseBootstrapDocument } from "./bootstrap-parser.js";
import type {
  AliasRecognition,
  AstDeclaration,
  AstField,
  AstValue,
  BootstrapRecognition,
  CoreValidation,
  Diagnostic,
  EntityRecognition,
  GroundingReference,
  PropertyRecognition,
  RelationRecognition,
  SemanticDocument,
  SemanticValue,
  SourceRecord,
  SpanRecord,
  SubjectValueRecognition,
  SupportRecord,
  SyntaxSpan,
} from "./types.js";

const semanticMessages: Readonly<Record<string, string>> = {
  "RCG-SYNTAX-011": "The field value is outside the closed 0.1 registry.",
  "RCG-REF-001": "A declaration ID is repeated in the document-wide namespace.",
  "RCG-REF-002": "A referenced declaration ID does not exist.",
  "RCG-REF-003": "A reference resolves to a declaration of the wrong kind.",
  "RCG-RECORD-001": "A record kind is outside the closed 0.1 registry.",
  "RCG-RECORD-002": "Record fields do not match the declared record kind.",
  "RCG-SOURCE-001": "A digest is not a lowercase sha256 value.",
  "RCG-SOURCE-002": "A source range end must follow its start.",
  "RCG-SOURCE-003": "A source observed_at value is not an RFC 3339 timestamp.",
  "RCG-GROUND-001": "A semantic declaration has no provenance path.",
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
  if (target.kind === "entity" || target.kind === "record") {
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
  return target?.kind === "entity" || target?.kind === "record"
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
  "relation" | "property" | "intent" | "modality" | "polarity" | "alias";

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

function buildRecordRecognition(
  declaration: AstDeclaration,
  kinds: ReadonlyMap<string, AstDeclaration>,
  recordKind: SupportedRecordKind,
  base: Omit<RelationRecognition, "record_kind" | "predicate" | "object">,
): Exclude<BootstrapRecognition, EntityRecognition> {
  switch (recordKind) {
    case "relation": {
      const result: RelationRecognition = {
        ...base,
        record_kind: "relation",
        predicate: identifierFieldValue(declaration, "predicate"),
        object: semanticFieldValue(declaration, "object", kinds),
      };
      return result;
    }
    case "property": {
      const result: PropertyRecognition = {
        ...base,
        record_kind: "property",
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
        value: semanticFieldValue(declaration, "value", kinds),
      };
      return result;
    }
    case "alias": {
      const result: AliasRecognition = {
        ...base,
        record_kind: "alias",
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
): BootstrapRecognition | null {
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
  const subjectId = requireSubject(declaration, kinds, diagnostics);
  const base = {
    declaration_kind: "record" as const,
    id: declaration.id,
    subject_id: subjectId,
    grounded_in: groundedIn,
    ...(support === undefined ? {} : { support }),
  };
  return buildRecordRecognition(declaration, kinds, recordKind, base);
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
  const recognitions: BootstrapRecognition[] = [];
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
    }
  }
  const document: SemanticDocument = {
    schema: "Llmrecog.SemanticDocument.v1",
    semantic_version: "0.1",
    document_id: astDocument.id,
    title: stringValue(field(astDocument, "title")?.value),
    sources,
    spans,
    observations: [],
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
