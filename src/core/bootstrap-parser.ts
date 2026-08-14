import type {
  AstDeclaration,
  AstDocument,
  AstField,
  AstValue,
  DeclarationKind,
  Diagnostic,
  SyntaxSpan,
  TextPosition,
} from "./types.js";

const encoder = new TextEncoder();
const identifierPattern = /^[A-Za-z][A-Za-z0-9_.-]*$/u;
const declarationKinds = new Set<DeclarationKind>([
  "document",
  "source",
  "span",
  "observation",
  "entity",
  "record",
  "variable",
  "candidate",
  "constraint",
]);

const diagnosticMessages: Readonly<Record<string, string>> = {
  "RCG-SYNTAX-001": "Input is not valid UTF-8.",
  "RCG-SYNTAX-002": "A UTF-8 byte-order mark is not accepted.",
  "RCG-SYNTAX-003": "The required llmrecog version header is missing.",
  "RCG-SYNTAX-004": "The declared text contract version is not supported.",
  "RCG-SYNTAX-005": "Indentation must use exact two-space levels.",
  "RCG-SYNTAX-006": "A raw tab is not allowed outside a JSON string.",
  "RCG-SYNTAX-007": "A string violates JSON string syntax.",
  "RCG-SYNTAX-008": "A text range must use a forward 1-based half-open range.",
  "RCG-SYNTAX-009": "Trailing comments are not accepted in contract 0.1.",
  "RCG-SYNTAX-010": "The top-level declaration is not part of contract 0.1.",
  "RCG-SYNTAX-011": "The field is not valid at this block position.",
  "RCG-SYNTAX-012": "A required field is missing.",
  "RCG-SYNTAX-013": "A non-repeatable field is repeated.",
  "RCG-SYNTAX-014": "Input lacks the canonical final newline.",
};

interface PhysicalLine {
  readonly number: number;
  readonly content: string;
  readonly terminator: "" | "\n" | "\r\n" | "\r";
  readonly startOffset: number;
  readonly contentEndOffset: number;
  readonly nextOffset: number;
}

export interface BootstrapParseResult {
  readonly ast: AstDocument | null;
  readonly diagnostics: readonly Diagnostic[];
}

function byteLength(value: string): number {
  return encoder.encode(value).length;
}

function makeLines(text: string): readonly PhysicalLine[] {
  const lines: PhysicalLine[] = [];
  let index = 0;
  let offset = 0;
  let lineNumber = 1;

  while (index < text.length) {
    let end = index;
    while (end < text.length && text[end] !== "\n" && text[end] !== "\r") {
      end += 1;
    }
    const content = text.slice(index, end);
    let terminator: PhysicalLine["terminator"] = "";
    if (text[end] === "\r" && text[end + 1] === "\n") {
      terminator = "\r\n";
    } else if (text[end] === "\r") {
      terminator = "\r";
    } else if (text[end] === "\n") {
      terminator = "\n";
    }
    const contentBytes = byteLength(content);
    const terminatorBytes = byteLength(terminator);
    lines.push({
      number: lineNumber,
      content,
      terminator,
      startOffset: offset,
      contentEndOffset: offset + contentBytes,
      nextOffset: offset + contentBytes + terminatorBytes,
    });
    index = end + terminator.length;
    offset += contentBytes + terminatorBytes;
    lineNumber += 1;
  }

  return lines;
}

function position(line: PhysicalLine, codeUnitIndex: number): TextPosition {
  const prefix = line.content.slice(0, codeUnitIndex);
  return {
    line: line.number,
    column: [...prefix].length + 1,
    offset: line.startOffset + byteLength(prefix),
  };
}

function contentSpan(line: PhysicalLine, startCodeUnit = 0): SyntaxSpan {
  return {
    start: position(line, startCodeUnit),
    end: position(line, line.content.length),
  };
}

function fieldSpan(line: PhysicalLine, startCodeUnit: number): SyntaxSpan {
  const end: TextPosition =
    line.terminator === ""
      ? position(line, line.content.length)
      : {
          line: line.number + 1,
          column: 1,
          offset: line.nextOffset,
        };
  return { start: position(line, startCodeUnit), end };
}

function diagnostic(
  code: string,
  severity: Diagnostic["severity"],
  entityId: string | null,
  span: SyntaxSpan | null,
  reasonData: Readonly<Record<string, unknown>>,
): Diagnostic {
  return {
    code,
    severity,
    message: diagnosticMessages[code] ?? code,
    entity_id: entityId,
    span,
    reason_data: reasonData,
    related: [],
  };
}

function isIgnoredLine(line: PhysicalLine): boolean {
  const trimmed = line.content.trimStart();
  return trimmed.length === 0 || trimmed.startsWith("#");
}

function leadingSpaces(line: PhysicalLine): number {
  let count = 0;
  while (line.content[count] === " ") count += 1;
  return count;
}

function findOutsideString(content: string, target: string): number {
  let inString = false;
  let escaped = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
    } else if (character === '"') {
      inString = true;
    } else if (character === target) {
      return index;
    }
  }
  return -1;
}

function parseString(
  raw: string,
  fieldName: string,
  declarationId: string,
  span: SyntaxSpan,
  diagnostics: Diagnostic[],
): AstValue {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "string") throw new Error("not a string");
    return { kind: "string", value };
  } catch {
    diagnostics.push(
      diagnostic("RCG-SYNTAX-007", "error", declarationId, span, {
        field: fieldName,
      }),
    );
    return { kind: "string", value: "" };
  }
}

function parseIdentifier(
  raw: string,
  fieldName: string,
  declarationId: string,
  span: SyntaxSpan,
  diagnostics: Diagnostic[],
): AstValue {
  if (!identifierPattern.test(raw)) {
    diagnostics.push(
      diagnostic("RCG-SYNTAX-011", "error", declarationId, span, {
        field: fieldName,
        expected: "identifier",
      }),
    );
    return { kind: "identifier", value: "INVALID" };
  }
  return { kind: "identifier", value: raw };
}

function parseList(
  raw: string,
  fieldName: string,
  declarationId: string,
  span: SyntaxSpan,
  diagnostics: Diagnostic[],
): AstValue {
  if (!raw.startsWith("[") || !raw.endsWith("]")) {
    diagnostics.push(
      diagnostic("RCG-SYNTAX-011", "error", declarationId, span, {
        field: fieldName,
        expected: "identifier_list",
      }),
    );
    return { kind: "identifier_list", items: [] };
  }
  const inner = raw.slice(1, -1);
  const items = inner.length === 0 ? [] : inner.split(", ");
  if (items.some((item) => !identifierPattern.test(item))) {
    diagnostics.push(
      diagnostic("RCG-SYNTAX-011", "error", declarationId, span, {
        field: fieldName,
        expected: "identifier_list",
      }),
    );
    return { kind: "identifier_list", items: [] };
  }
  return { kind: "identifier_list", items };
}

function parseRange(
  raw: string,
  declarationId: string,
  span: SyntaxSpan,
  diagnostics: Diagnostic[],
): AstValue {
  const match = /^(\d+):(\d+)\.\.(\d+):(\d+)$/u.exec(raw);
  if (match === null || match.slice(1).some((part) => Number(part) < 1)) {
    diagnostics.push(
      diagnostic("RCG-SYNTAX-008", "error", declarationId, span, {
        value: raw,
      }),
    );
    return {
      kind: "text_range",
      start: { line: 1, column: 1 },
      end: { line: 1, column: 1 },
    };
  }
  return {
    kind: "text_range",
    start: { line: Number(match[1]), column: Number(match[2]) },
    end: { line: Number(match[3]), column: Number(match[4]) },
  };
}

function parseConfidence(
  raw: string,
  declarationId: string,
  span: SyntaxSpan,
  diagnostics: Diagnostic[],
): AstValue {
  if (!/^(?:0|1|0\.\d+)$/u.test(raw)) {
    diagnostics.push(
      diagnostic("RCG-SYNTAX-011", "error", declarationId, span, {
        field: "confidence",
        expected: "confidence_number",
      }),
    );
    return { kind: "confidence", value: 0 };
  }
  return { kind: "confidence", value: Number(raw) };
}

function parseScalar(
  raw: string,
  fieldName: string,
  declarationId: string,
  span: SyntaxSpan,
  diagnostics: Diagnostic[],
): AstValue {
  return raw.startsWith('"')
    ? parseString(raw, fieldName, declarationId, span, diagnostics)
    : parseIdentifier(raw, fieldName, declarationId, span, diagnostics);
}

type FieldValueParser = (
  raw: string,
  fieldName: string,
  declarationId: string,
  span: SyntaxSpan,
  diagnostics: Diagnostic[],
) => AstValue;

const stringFieldParser: FieldValueParser = (
  raw,
  fieldName,
  declarationId,
  span,
  diagnostics,
) => parseString(raw, fieldName, declarationId, span, diagnostics);

const identifierFieldParser: FieldValueParser = (
  raw,
  fieldName,
  declarationId,
  span,
  diagnostics,
) => parseIdentifier(raw, fieldName, declarationId, span, diagnostics);

const scalarFieldParser: FieldValueParser = (
  raw,
  fieldName,
  declarationId,
  span,
  diagnostics,
) => parseScalar(raw, fieldName, declarationId, span, diagnostics);

const listFieldParser: FieldValueParser = (
  raw,
  fieldName,
  declarationId,
  span,
  diagnostics,
) => parseList(raw, fieldName, declarationId, span, diagnostics);

const rangeFieldParser: FieldValueParser = (
  raw,
  _fieldName,
  declarationId,
  span,
  diagnostics,
) => parseRange(raw, declarationId, span, diagnostics);

const confidenceFieldParser: FieldValueParser = (
  raw,
  _fieldName,
  declarationId,
  span,
  diagnostics,
) => parseConfidence(raw, declarationId, span, diagnostics);

const fieldValueParsers: ReadonlyMap<string, FieldValueParser> = new Map([
  ...[
    "title",
    "locator",
    "media_type",
    "digest",
    "observed_at",
    "quote",
    "label",
    "surface",
  ].map((name) => [name, stringFieldParser] as const),
  ...[
    "kind",
    "source",
    "type",
    "support",
    "subject",
    "predicate",
    "rule",
    "value_type",
    "variable",
    "antecedent",
    "consequent",
    "left",
    "right",
  ].map((name) => [name, identifierFieldParser] as const),
  ...["object", "value"].map((name) => [name, scalarFieldParser] as const),
  ...["grounded_in", "anchors", "candidates", "members"].map(
    (name) => [name, listFieldParser] as const,
  ),
  ["range", rangeFieldParser],
  ["confidence", confidenceFieldParser],
]);

function parseField(
  line: PhysicalLine,
  declarationId: string,
  declarationKind: DeclarationKind,
  diagnostics: Diagnostic[],
): AstField {
  const indent = leadingSpaces(line);
  const raw = line.content.slice(indent);
  const separator = raw.indexOf(" ");
  const name =
    separator === -1 ? raw.replace(/:$/u, "") : raw.slice(0, separator);
  const valueText = separator === -1 ? "" : raw.slice(separator + 1);
  const span = fieldSpan(line, indent);
  const before = diagnostics.length;
  const parser = fieldValueParsers.get(name);
  const value = parser?.(valueText, name, declarationId, span, diagnostics) ?? {
    kind: "identifier" as const,
    value: "INVALID",
  };
  if (parser === undefined) {
    diagnostics.push(
      diagnostic("RCG-SYNTAX-011", "error", declarationId, span, {
        field: name,
        declaration_kind: declarationKind,
      }),
    );
  }

  return {
    name: identifierPattern.test(name) ? name : "INVALID",
    value,
    span,
    recovered: diagnostics.length > before,
  };
}

function withOptionalSupport(base: readonly string[]): readonly string[][] {
  return [[...base], [...base, "support"], [...base, "support", "confidence"]];
}

function withOptionalSupportAndNormalization(
  base: readonly string[],
): readonly string[][] {
  return [
    ...withOptionalSupport(base),
    [...base, "normalization"],
    [...base, "support", "normalization"],
    [...base, "support", "confidence", "normalization"],
  ];
}

function constraintSequences(base: readonly string[]): readonly string[][] {
  return [
    [...base],
    [...base, "grounded_in"],
    [...base, "grounded_in", "support"],
    [...base, "grounded_in", "support", "confidence"],
  ];
}

function expectedFieldSequences(
  kind: DeclarationKind,
): readonly (readonly string[])[] {
  switch (kind) {
    case "document":
      return [["title"]];
    case "source":
      return [
        ["kind", "locator"],
        ["kind", "locator", "media_type"],
        ["kind", "locator", "digest"],
        ["kind", "locator", "observed_at"],
        ["kind", "locator", "media_type", "digest"],
        ["kind", "locator", "media_type", "observed_at"],
        ["kind", "locator", "digest", "observed_at"],
        ["kind", "locator", "media_type", "digest", "observed_at"],
      ];
    case "span":
      return [
        ["source", "range"],
        ["source", "range", "quote"],
      ];
    case "observation":
      return [["surface", "grounded_in"]];
    case "entity":
      return withOptionalSupport(["type", "label", "grounded_in"]);
    case "record":
      return [
        ...withOptionalSupportAndNormalization([
          "kind",
          "subject",
          "predicate",
          "object",
          "grounded_in",
        ]),
        ...withOptionalSupportAndNormalization([
          "kind",
          "subject",
          "predicate",
          "value",
          "grounded_in",
        ]),
        ...withOptionalSupportAndNormalization([
          "kind",
          "subject",
          "value",
          "grounded_in",
        ]),
        ...withOptionalSupportAndNormalization([
          "kind",
          "subject",
          "object",
          "grounded_in",
        ]),
        ...withOptionalSupportAndNormalization([
          "kind",
          "value",
          "grounded_in",
        ]),
      ];
    case "variable":
      return [["value_type", "candidates", "grounded_in"]];
    case "candidate":
      return withOptionalSupport(["value", "grounded_in"]);
    case "constraint":
      return [
        ...constraintSequences(["kind", "variable", "members"]),
        ...constraintSequences(["kind", "antecedent", "consequent"]),
        ...constraintSequences(["kind", "left", "right"]),
      ];
  }
}

const requiredFields: Readonly<Record<DeclarationKind, readonly string[]>> = {
  document: ["title"],
  source: ["kind", "locator"],
  span: ["source", "range"],
  observation: ["surface", "grounded_in"],
  entity: ["type", "label", "grounded_in"],
  record: ["kind", "grounded_in"],
  variable: ["value_type", "candidates", "grounded_in"],
  candidate: ["value", "grounded_in"],
  constraint: ["kind"],
};

function duplicateField(fields: readonly AstField[]): AstField | undefined {
  const names = fields.map((candidate) => candidate.name);
  const duplicateName = names.find(
    (name, index) => names.indexOf(name) !== index && name !== "INVALID",
  );
  return [...fields]
    .reverse()
    .find((candidate) => candidate.name === duplicateName);
}

function reportMissingFields(
  declaration: AstDeclaration,
  names: readonly string[],
  diagnostics: Diagnostic[],
): boolean {
  const missing = requiredFields[declaration.kind].filter(
    (name) => !names.includes(name),
  );
  for (const name of missing) {
    diagnostics.push(
      diagnostic("RCG-SYNTAX-012", "error", declaration.id, declaration.span, {
        field: name,
        declaration_kind: declaration.kind,
      }),
    );
  }
  return missing.length > 0;
}

function reportFieldSequenceMismatch(
  declaration: AstDeclaration,
  names: readonly string[],
  diagnostics: Diagnostic[],
): void {
  const mismatchIndex = names.findIndex((name, index) =>
    expectedFieldSequences(declaration.kind).every(
      (sequence) => sequence[index] !== name,
    ),
  );
  const mismatch = declaration.fields[Math.max(0, mismatchIndex)];
  diagnostics.push(
    diagnostic(
      "RCG-SYNTAX-011",
      "error",
      declaration.id,
      mismatch?.span ?? declaration.span,
      {
        field: mismatch?.name ?? null,
        declaration_kind: declaration.kind,
      },
    ),
  );
}

function validateFieldSequence(
  declaration: AstDeclaration,
  diagnostics: Diagnostic[],
): void {
  const names = declaration.fields.map((field) => field.name);
  const duplicate = duplicateField(declaration.fields);
  if (duplicate !== undefined) {
    diagnostics.push(
      diagnostic("RCG-SYNTAX-013", "error", declaration.id, duplicate.span, {
        field: duplicate.name,
        declaration_kind: declaration.kind,
      }),
    );
    return;
  }

  const matches = expectedFieldSequences(declaration.kind).some(
    (sequence) =>
      sequence.length === names.length &&
      sequence.every((name, index) => names[index] === name),
  );
  if (matches || declaration.fields.some((field) => field.recovered)) return;
  if (reportMissingFields(declaration, names, diagnostics)) return;
  reportFieldSequenceMismatch(declaration, names, diagnostics);
}

interface ParsedDeclarationHeader {
  readonly kind: DeclarationKind;
  readonly id: string;
  readonly headerArguments: readonly string[];
  readonly malformed: boolean;
}

function parseDeclarationHeader(
  headerLine: PhysicalLine,
  diagnostics: Diagnostic[],
): ParsedDeclarationHeader {
  const candidateMatch =
    /^candidate ([A-Za-z][A-Za-z0-9_.-]*) in ([A-Za-z][A-Za-z0-9_.-]*):$/u.exec(
      headerLine.content,
    );
  if (candidateMatch !== null) {
    return {
      kind: "candidate",
      id: candidateMatch[1]!,
      headerArguments: [candidateMatch[2]!],
      malformed: false,
    };
  }
  const match = /^([A-Za-z][A-Za-z0-9_.-]*) ([A-Za-z][A-Za-z0-9_.-]*):$/u.exec(
    headerLine.content,
  );
  if (match === null) {
    const keyword = headerLine.content.split(/[ :]/u, 1)[0] ?? "";
    diagnostics.push(
      diagnostic("RCG-SYNTAX-010", "error", null, contentSpan(headerLine), {
        declaration: keyword,
      }),
    );
    return {
      kind: "record",
      id: "INVALID",
      headerArguments: [],
      malformed: true,
    };
  }

  const kindText = match[1]!;
  const id = match[2]!;
  if (!declarationKinds.has(kindText as DeclarationKind)) {
    diagnostics.push(
      diagnostic("RCG-SYNTAX-010", "error", id, contentSpan(headerLine), {
        declaration: kindText,
      }),
    );
    return { kind: "record", id, headerArguments: [], malformed: false };
  }
  if (kindText === "candidate") {
    diagnostics.push(
      diagnostic("RCG-SYNTAX-010", "error", id, contentSpan(headerLine), {
        declaration: "candidate",
        expected_header: "candidate <id> in <variable-id>:",
      }),
    );
  }
  return {
    kind: kindText as DeclarationKind,
    id,
    headerArguments: [],
    malformed: false,
  };
}

const normalizationFieldOrder = [
  "surface",
  "rule",
  "grounded_in",
  "anchors",
] as const;

function validateNormalizationFields(
  declarationId: string,
  fields: readonly AstField[],
  diagnostics: Diagnostic[],
): boolean {
  const before = diagnostics.length;
  const duplicate = duplicateField(fields);
  if (duplicate !== undefined) {
    diagnostics.push(
      diagnostic("RCG-SYNTAX-013", "error", declarationId, duplicate.span, {
        field: duplicate.name,
        declaration_kind: "record",
      }),
    );
    return true;
  }
  let previousOrder = -1;
  for (const nestedField of fields) {
    const order = normalizationFieldOrder.indexOf(
      nestedField.name as (typeof normalizationFieldOrder)[number],
    );
    if (order < 0 || order <= previousOrder) {
      if (!nestedField.recovered) {
        diagnostics.push(
          diagnostic(
            "RCG-SYNTAX-011",
            "error",
            declarationId,
            nestedField.span,
            {
              field: nestedField.name,
              declaration_kind: "record",
            },
          ),
        );
      }
      return true;
    }
    previousOrder = order;
  }
  return diagnostics.length > before || fields.some((field) => field.recovered);
}

function collectNormalizationField(
  lines: readonly PhysicalLine[],
  meaningfulIndexes: readonly number[],
  headerPosition: number,
  declarationId: string,
  diagnostics: Diagnostic[],
): { readonly field: AstField; readonly nextPosition: number } {
  const header = lines[meaningfulIndexes[headerPosition]!]!;
  const nestedFields: AstField[] = [];
  let nextPosition = headerPosition + 1;
  const before = diagnostics.length;
  while (nextPosition < meaningfulIndexes.length) {
    const line = lines[meaningfulIndexes[nextPosition]!]!;
    const indent = leadingSpaces(line);
    if (indent <= 2) break;
    if (indent !== 4) {
      diagnostics.push(
        diagnostic(
          "RCG-SYNTAX-005",
          "error",
          declarationId,
          contentSpan(line, indent),
          { indentation: indent, expected: 4 },
        ),
      );
      nextPosition += 1;
      while (nextPosition < meaningfulIndexes.length) {
        const deeper = lines[meaningfulIndexes[nextPosition]!]!;
        if (leadingSpaces(deeper) <= indent) break;
        nextPosition += 1;
      }
      continue;
    }
    nestedFields.push(parseField(line, declarationId, "record", diagnostics));
    nextPosition += 1;
  }
  const recovered = validateNormalizationFields(
    declarationId,
    nestedFields,
    diagnostics,
  );
  return {
    field: {
      name: "normalization",
      value: { kind: "block", fields: nestedFields },
      span: fieldSpan(header, 2),
      recovered: recovered || diagnostics.length > before,
    },
    nextPosition,
  };
}

function collectDeclarationFields(
  lines: readonly PhysicalLine[],
  meaningfulIndexes: readonly number[],
  meaningfulPosition: number,
  declarationId: string,
  declarationKind: DeclarationKind,
  diagnostics: Diagnostic[],
): { readonly fields: readonly AstField[]; readonly nextPosition: number } {
  const fields: AstField[] = [];
  let nextPosition = meaningfulPosition + 1;
  while (nextPosition < meaningfulIndexes.length) {
    const line = lines[meaningfulIndexes[nextPosition]!]!;
    const indent = leadingSpaces(line);
    if (indent === 0) break;
    if (indent !== 2) {
      diagnostics.push(
        diagnostic(
          "RCG-SYNTAX-005",
          "error",
          declarationId,
          contentSpan(line, indent),
          { indentation: indent, expected: 2 },
        ),
      );
      if (indent > 2) {
        nextPosition += 1;
        while (nextPosition < meaningfulIndexes.length) {
          const nested = lines[meaningfulIndexes[nextPosition]!]!;
          if (leadingSpaces(nested) <= 2) break;
          nextPosition += 1;
        }
        continue;
      }
    }
    if (
      declarationKind === "record" &&
      indent === 2 &&
      line.content.slice(indent) === "normalization:"
    ) {
      const nested = collectNormalizationField(
        lines,
        meaningfulIndexes,
        nextPosition,
        declarationId,
        diagnostics,
      );
      fields.push(nested.field);
      nextPosition = nested.nextPosition;
      continue;
    }
    fields.push(parseField(line, declarationId, declarationKind, diagnostics));
    nextPosition += 1;
  }
  return { fields, nextPosition };
}

function astFieldEnd(field: AstField | undefined): TextPosition | undefined {
  if (field?.value.kind !== "block") return field?.span.end;
  return field.value.fields.at(-1)?.span.end ?? field.span.end;
}

function parseDeclaration(
  lines: readonly PhysicalLine[],
  meaningfulIndexes: readonly number[],
  meaningfulPosition: number,
  diagnostics: Diagnostic[],
): { readonly declaration: AstDeclaration; readonly nextPosition: number } {
  const headerIndex = meaningfulIndexes[meaningfulPosition]!;
  const headerLine = lines[headerIndex]!;
  const parsedHeader = parseDeclarationHeader(headerLine, diagnostics);
  if (parsedHeader.malformed) {
    const declaration: AstDeclaration = {
      kind: "record",
      id: "INVALID",
      header_arguments: [],
      fields: [],
      span: contentSpan(headerLine),
      recovered: true,
    };
    let nextPosition = meaningfulPosition + 1;
    while (nextPosition < meaningfulIndexes.length) {
      const line = lines[meaningfulIndexes[nextPosition]!]!;
      if (leadingSpaces(line) === 0) break;
      nextPosition += 1;
    }
    return { declaration, nextPosition };
  }
  const { fields, nextPosition } = collectDeclarationFields(
    lines,
    meaningfulIndexes,
    meaningfulPosition,
    parsedHeader.id,
    parsedHeader.kind,
    diagnostics,
  );

  const end =
    astFieldEnd(fields.at(-1)) ??
    (headerLine.terminator === ""
      ? position(headerLine, headerLine.content.length)
      : {
          line: headerLine.number + 1,
          column: 1,
          offset: headerLine.nextOffset,
        });
  const declaration: AstDeclaration = {
    kind: parsedHeader.kind,
    id: parsedHeader.id,
    header_arguments: parsedHeader.headerArguments,
    fields,
    span: { start: position(headerLine, 0), end },
    recovered: false,
  };
  const before = diagnostics.length;
  validateFieldSequence(declaration, diagnostics);
  const recoveredDeclaration = {
    ...declaration,
    recovered:
      fields.some((field) => field.recovered) || diagnostics.length > before,
  };
  return { declaration: recoveredDeclaration, nextPosition };
}

function scanDiagnostics(
  bytes: Uint8Array,
  text: string,
  lines: readonly PhysicalLine[],
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    diagnostics.push(
      diagnostic("RCG-SYNTAX-002", "error", null, null, {
        byte_order_mark: "utf-8",
      }),
    );
    return diagnostics;
  }
  for (const line of lines) {
    const tabIndex = findOutsideString(line.content, "\t");
    if (tabIndex >= 0) {
      diagnostics.push(
        diagnostic(
          "RCG-SYNTAX-006",
          "error",
          null,
          contentSpan(line, tabIndex),
          { line: line.number },
        ),
      );
    }
    const commentIndex = findOutsideString(line.content, "#");
    if (
      commentIndex >= 0 &&
      line.content.slice(0, commentIndex).trim().length > 0
    ) {
      diagnostics.push(
        diagnostic(
          "RCG-SYNTAX-009",
          "error",
          null,
          contentSpan(line, commentIndex),
          { line: line.number },
        ),
      );
    }
    if (line.terminator === "\r") {
      diagnostics.push(
        diagnostic("RCG-SYNTAX-005", "error", null, contentSpan(line), {
          newline: "bare_cr",
        }),
      );
    }
  }
  if (text.length > 0 && bytes.at(-1) !== 0x0a) {
    diagnostics.push(
      diagnostic("RCG-SYNTAX-014", "warning", null, null, {
        canonical_newline: "LF_or_CRLF",
      }),
    );
  }
  return diagnostics;
}

export function parseBootstrapDocument(
  bytes: Uint8Array,
): BootstrapParseResult {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return {
      ast: null,
      diagnostics: [
        diagnostic("RCG-SYNTAX-001", "error", null, null, {
          encoding: "utf-8",
        }),
      ],
    };
  }

  const lines = makeLines(text);
  const diagnostics = [...scanDiagnostics(bytes, text, lines)];
  if (diagnostics.some((entry) => entry.code === "RCG-SYNTAX-002")) {
    return { ast: null, diagnostics };
  }
  const meaningfulIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => !isIgnoredLine(line))
    .map(({ index }) => index);
  const headerIndex = meaningfulIndexes[0];
  if (headerIndex === undefined) {
    diagnostics.push(
      diagnostic("RCG-SYNTAX-003", "error", null, null, {
        expected_version: "0.1",
      }),
    );
    return { ast: null, diagnostics };
  }
  const headerLine = lines[headerIndex]!;
  if (headerLine.content !== "llmrecog 0.1") {
    const versionMatch = /^llmrecog (.+)$/u.exec(headerLine.content);
    diagnostics.push(
      versionMatch === null
        ? diagnostic("RCG-SYNTAX-003", "error", null, null, {
            expected_version: "0.1",
          })
        : diagnostic("RCG-SYNTAX-004", "error", null, contentSpan(headerLine), {
            declared_version: versionMatch[1],
            supported_version: "0.1",
          }),
    );
    return { ast: null, diagnostics };
  }

  let meaningfulPosition = 1;
  if (meaningfulIndexes[meaningfulPosition] === undefined) {
    diagnostics.push(
      diagnostic("RCG-SYNTAX-012", "error", null, null, {
        declaration_kind: "document",
      }),
    );
    return { ast: null, diagnostics };
  }
  const parsedDocument = parseDeclaration(
    lines,
    meaningfulIndexes,
    meaningfulPosition,
    diagnostics,
  );
  if (parsedDocument.declaration.kind !== "document") {
    diagnostics.push(
      diagnostic(
        "RCG-SYNTAX-010",
        "error",
        parsedDocument.declaration.id,
        parsedDocument.declaration.span,
        { expected_declaration: "document" },
      ),
    );
  }
  meaningfulPosition = parsedDocument.nextPosition;
  const declarations: AstDeclaration[] = [];
  while (meaningfulPosition < meaningfulIndexes.length) {
    const parsed = parseDeclaration(
      lines,
      meaningfulIndexes,
      meaningfulPosition,
      diagnostics,
    );
    if (parsed.declaration.kind === "document") {
      diagnostics.push(
        diagnostic(
          "RCG-SYNTAX-010",
          "error",
          parsed.declaration.id,
          parsed.declaration.span,
          { declaration: "document", reason: "duplicate_document" },
        ),
      );
    } else {
      declarations.push(parsed.declaration);
    }
    meaningfulPosition = parsed.nextPosition;
  }

  const hasSyntaxError = diagnostics.some(
    (entry) =>
      entry.severity === "error" && entry.code.startsWith("RCG-SYNTAX-"),
  );
  return {
    ast: {
      schema: "Llmrecog.Ast.v1",
      syntax_version: "0.1",
      recovered: hasSyntaxError,
      header: {
        kind: "version_header",
        version: "0.1",
        span: {
          start: position(headerLine, 0),
          end: position(headerLine, headerLine.content.length),
        },
      },
      document: parsedDocument.declaration,
      declarations,
    },
    diagnostics,
  };
}
