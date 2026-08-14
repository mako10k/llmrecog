import type {
  BootstrapReadResult,
  DocumentResult,
  RecognitionResult,
  ValidationResult,
} from "../application/bootstrap-read-path.js";
import type { Diagnostic, Recognition, SemanticValue } from "../core/types.js";

function renderDiagnostics(
  diagnostics: readonly Diagnostic[],
): readonly string[] {
  if (diagnostics.length === 0) return ["diagnostics: 0"];
  return [
    "diagnostics:",
    ...diagnostics.map(
      (diagnostic) =>
        `  ${diagnostic.code} ${diagnostic.severity} entity=${diagnostic.entity_id ?? "-"} ${diagnostic.message}`,
    ),
  ];
}

function renderBase(result: BootstrapReadResult): string[] {
  return [
    `${result.schema} semantic=${result.semantic_version} tool=${result.tool_version}`,
    `input: ${result.input.path}`,
    `document: ${result.input.document_id ?? "-"}`,
    `digest: ${result.input.digest}`,
  ];
}

function renderValidation(result: ValidationResult): string {
  let astState = "-";
  if (result.ast !== null)
    astState = result.ast.recovered ? "recovered" : "complete";
  return [
    ...renderBase(result),
    `valid: ${String(result.valid)}`,
    `structural_valid: ${String(result.structural_valid)}`,
    `semantic_valid: ${String(result.semantic_valid)}`,
    `ast: ${astState}`,
    `document_model: ${result.document === null ? "-" : "present"}`,
    `source_verification: ${result.source_verification.mode}/${result.source_verification.state}`,
    `complete: ${String(result.complete)}`,
    `truncated: ${String(result.truncated)}`,
    ...renderDiagnostics(result.diagnostics),
  ].join("\n");
}

function renderDocument(result: DocumentResult): string {
  const counts = result.summary.counts;
  return [
    ...renderBase(result),
    `title: ${result.summary.title}`,
    `counts: sources=${counts.sources} spans=${counts.spans} observations=${counts.observations} entities=${counts.entities} records=${counts.records} variables=${counts.variables} candidates=${counts.candidates} constraints=${counts.constraints}`,
    `sources: ${result.summary.source_ids.join(", ") || "-"}`,
    `recognitions: ${result.summary.recognition_ids.join(", ") || "-"}`,
    ...(result.summary.variables.length === 0
      ? ["variables: -"]
      : [
          "variables:",
          ...result.summary.variables.map(
            (variable) =>
              `  ${variable.id} type=${variable.value_type} domain=${variable.domain} candidates=${variable.candidate_ids.join(",") || "-"}`,
          ),
        ]),
    `constraints: ${result.summary.constraint_ids.join(", ") || "-"}`,
    `source_verification: ${result.source_verification.mode}/${result.source_verification.state}`,
    `complete: ${String(result.complete)}`,
    `truncated: ${String(result.truncated)}`,
    ...renderDiagnostics(result.diagnostics),
  ].join("\n");
}

function renderValue(value: SemanticValue): string {
  switch (value.kind) {
    case "reference":
      return `reference ${value.id}`;
    case "symbol":
      return `symbol ${value.value}`;
    case "string":
      return `string ${JSON.stringify(value.value)}`;
  }
}

type RecordRecognition = Extract<
  Recognition,
  { readonly declaration_kind: "record" }
>;

type ConstraintRecognition = Extract<
  Recognition,
  { readonly declaration_kind: "constraint" }
>;

function renderRecordDetails(
  recognition: RecordRecognition,
): readonly string[] {
  const lines = [`record_kind: ${recognition.record_kind}`];
  if (recognition.subject_id !== undefined)
    lines.push(`subject: ${recognition.subject_id}`);
  if ("predicate" in recognition)
    lines.push(`predicate: ${recognition.predicate}`);
  if ("object" in recognition)
    lines.push(`object: ${renderValue(recognition.object)}`);
  if ("value" in recognition)
    lines.push(`value: ${renderValue(recognition.value)}`);
  return lines;
}

function renderConstraintDetails(
  recognition: ConstraintRecognition,
): readonly string[] {
  const lines = [`constraint_kind: ${recognition.constraint_kind}`];
  if (recognition.constraint_kind === "one_of") {
    return [
      ...lines,
      `variable: ${recognition.variable_id}`,
      `members: ${recognition.member_ids.join(",")}`,
    ];
  }
  if (recognition.constraint_kind === "requires") {
    return [
      ...lines,
      `antecedent: ${recognition.antecedent_id}`,
      `consequent: ${recognition.consequent_id}`,
    ];
  }
  return [
    ...lines,
    `left: ${recognition.left_id}`,
    `right: ${recognition.right_id}`,
  ];
}

function renderKindDetails(recognition: Recognition): readonly string[] {
  switch (recognition.declaration_kind) {
    case "entity":
      return [`type: ${recognition.type}`, `label: ${recognition.label}`];
    case "record":
      return renderRecordDetails(recognition);
    case "variable":
      return [
        `value_type: ${recognition.value_type}`,
        `candidates: ${recognition.candidate_ids.join(",") || "-"}`,
      ];
    case "candidate":
      return [
        `variable: ${recognition.variable_id}`,
        `value: ${renderValue(recognition.value)}`,
      ];
    case "constraint":
      return renderConstraintDetails(recognition);
  }
}

function renderSupport(recognition: Recognition): string {
  if (recognition.support === undefined) {
    return "support: -";
  }
  return `support: ${recognition.support.kind} grounded_in=${recognition.support.grounded_in.map((entry) => entry.id).join(",")}`;
}

function renderNormalization(recognition: Recognition): readonly string[] {
  if (
    recognition.declaration_kind !== "record" ||
    recognition.normalization === undefined
  ) {
    return [];
  }
  return [
    "normalization:",
    `  surface: ${recognition.normalization.surface}`,
    `  rule: ${recognition.normalization.rule}`,
    `  grounded_in: ${recognition.normalization.grounded_in.map((entry) => entry.id).join(",")}`,
    `  anchors: ${recognition.normalization.anchors.map((entry) => entry.id).join(",") || "-"}`,
  ];
}

function renderRecognitionDetails(recognition: Recognition): readonly string[] {
  return [
    `declaration_kind: ${recognition.declaration_kind}`,
    ...renderKindDetails(recognition),
    `grounded_in: ${recognition.grounded_in.map((entry) => entry.id).join(",") || "-"}`,
    renderSupport(recognition),
    ...renderNormalization(recognition),
  ];
}

function renderRecognition(result: RecognitionResult): string {
  const lines = [
    ...renderBase(result),
    `target: ${result.target.id}`,
    `found: ${String(result.found)}`,
  ];
  if (result.recognition === null) {
    lines.push("declaration_kind: -", "recognition: -");
  } else {
    lines.push(...renderRecognitionDetails(result.recognition));
  }
  lines.push(
    `source_verification: ${result.source_verification.mode}/${result.source_verification.state}`,
    `complete: ${String(result.complete)}`,
    `truncated: ${String(result.truncated)}`,
    ...renderDiagnostics(result.diagnostics),
  );
  return lines.join("\n");
}

export function renderBootstrapText(result: BootstrapReadResult): string {
  switch (result.schema) {
    case "Llmrecog.ValidationResult.v1":
      return `${renderValidation(result)}\n`;
    case "Llmrecog.DocumentResult.v1":
      return `${renderDocument(result)}\n`;
    case "Llmrecog.RecognitionResult.v1":
      return `${renderRecognition(result)}\n`;
  }
}
