import type {
  AuditResult,
  BootstrapReadResult,
  DocumentResult,
  ExplainResult,
  LocalSourceSpanVerification,
  LocalValidationResult,
  MaterializationResult,
  QueryResult,
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

function renderValidationState(
  result: ValidationResult | LocalValidationResult,
): readonly string[] {
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
  ];
}

function renderValidation(result: ValidationResult): string {
  return [
    ...renderValidationState(result),
    `source_verification: ${result.source_verification.mode}/${result.source_verification.state}`,
    `complete: ${String(result.complete)}`,
    `truncated: ${String(result.truncated)}`,
    ...renderDiagnostics(result.diagnostics),
  ].join("\n");
}

function renderOptionalDigest(value: string | null): string {
  return value ?? "-";
}

function renderLocalSpan(span: LocalSourceSpanVerification): string {
  const { start, end } = span.range.selector;
  return `    span ${span.span_id} ${span.state} range=${span.range.state} selector=${start.line}:${start.column}..${end.line}:${end.column} quote=${span.quote.state} expected=${renderOptionalDigest(span.quote.expected_digest)} actual=${renderOptionalDigest(span.quote.actual_digest)}`;
}

function renderLocalValidation(result: LocalValidationResult): string {
  const verification = result.source_verification;
  return [
    ...renderValidationState(result),
    `source_verification: ${verification.mode}/${verification.state} root=${JSON.stringify(verification.verification_root)} max_source_bytes=${String(verification.maximum_source_bytes)} complete=${String(verification.complete)}`,
    ...verification.sources.flatMap((source) => [
      `  source ${source.source_id} ${source.state} locator=${JSON.stringify(source.locator)} path=${source.resolved_path === null ? "-" : JSON.stringify(source.resolved_path)}`,
      `    digest ${source.digest.state} expected=${renderOptionalDigest(source.digest.expected)} actual=${renderOptionalDigest(source.digest.actual)}`,
      ...source.spans.map(renderLocalSpan),
    ]),
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

function renderExplainReason(
  reason: ExplainResult["derivations"][number],
): string {
  return `${reason.code} ${reason.name} subject=${reason.subject_id} constraint=${reason.constraint_id ?? "-"} inputs=${reason.inputs.join(",") || "-"}`;
}

function renderExplainViability(
  viability: ExplainResult["viability"],
): readonly string[] {
  if (viability === null) return ["viability: -"];
  const lines = [`viability: ${viability.state}`];
  if (viability.witness === null) {
    lines.push("witness: -");
  } else {
    lines.push(
      "witness:",
      ...viability.witness.assignments.map(
        (assignment) =>
          `  ${assignment.variable_id} = ${assignment.candidate_id} (${renderValue(assignment.value)})`,
      ),
      `open_variables: ${viability.witness.open_variable_ids.join(",") || "-"}`,
    );
  }
  if (viability.reason_chain.length === 0) {
    lines.push("reason_chain: -");
  } else {
    lines.push(
      "reason_chain:",
      ...viability.reason_chain.map(
        (reason) => `  ${renderExplainReason(reason)}`,
      ),
    );
  }
  lines.push(`unknown_reasons: ${viability.unknown_reasons.join(",") || "-"}`);
  return lines;
}

function renderExplainResolution(
  resolution: ExplainResult["variable_resolution"],
): readonly string[] {
  if (resolution === null) return ["variable_resolution: -"];
  return [
    `variable_resolution: ${resolution.state}`,
    `variable_unknown_reasons: ${resolution.unknown_reasons.join(",") || "-"}`,
  ];
}

function renderExplainScope(scope: ExplainResult["scope"]): string {
  if (scope === null) return "scope: -";
  return `scope: requested=${scope.requested_variable_ids.join(",") || "-"} effective=${scope.effective_variable_ids.join(",") || "-"} limit=${String(scope.limit)}`;
}

function renderExplainProvenance(result: ExplainResult): string {
  const edges = result.provenance.map(
    (edge) => `${edge.kind}(${edge.from},${edge.to})`,
  );
  return `provenance: ${edges.join(", ") || "-"}`;
}

function renderExplainNormalization(result: ExplainResult): string {
  const normalization = result.normalization;
  if (normalization === null) return "normalization: -";
  const grounded = normalization.grounded_in
    .map((reference) => reference.id)
    .join(",");
  const anchors = normalization.anchors
    .map((reference) => reference.id)
    .join(",");
  return `normalization: surface=${JSON.stringify(normalization.surface)} rule=${normalization.rule} grounded_in=${grounded} anchors=${anchors || "-"}`;
}

function renderExplainSourceVerification(result: ExplainResult): string {
  const entries = result.source_verification.map(
    (entry) =>
      `${entry.source_id} ${entry.verification.mode}/${entry.verification.state}`,
  );
  return `source_verification: ${entries.join(", ") || "-"}`;
}

function renderSkippedConstraints(result: ExplainResult): string {
  const entries = result.skipped_constraints.map(
    (entry) => `${entry.constraint_id}:${entry.reason_code}`,
  );
  return `skipped_constraints: ${entries.join(", ") || "-"}`;
}

function renderExplain(result: ExplainResult): string {
  const supportRecords = result.support.records
    .map(
      (support) =>
        `${support.kind} grounded_in=${support.grounded_in.map((reference) => reference.id).join(",")}`,
    )
    .join("; ");
  return [
    ...renderBase(result),
    `target: ${result.target.id} kind=${result.target.declaration_kind}`,
    "recognition:",
    ...renderRecognitionDetails(result.recognition).map((line) => `  ${line}`),
    `support: ${result.support.state}`,
    `support_records: ${supportRecords || "-"}`,
    ...renderExplainViability(result.viability),
    ...renderExplainResolution(result.variable_resolution),
    renderExplainScope(result.scope),
    renderExplainProvenance(result),
    renderExplainNormalization(result),
    renderExplainSourceVerification(result),
    `constraints: ${result.relevant_constraint_ids.join(", ") || "-"}`,
    renderSkippedConstraints(result),
    ...(result.derivations.length === 0
      ? ["derivations: -"]
      : [
          "derivations:",
          ...result.derivations.map(
            (reason) => `  ${renderExplainReason(reason)}`,
          ),
        ]),
    `complete: ${String(result.complete)}`,
    `truncated: ${String(result.truncated)}`,
    ...renderDiagnostics(result.diagnostics),
  ].join("\n");
}

function renderCompactValue(value: SemanticValue): string {
  switch (value.kind) {
    case "reference":
      return `reference:${value.id}`;
    case "symbol":
      return `symbol:${value.value}`;
    case "string":
      return `string:${JSON.stringify(value.value)}`;
  }
}

function queryReasonCodes(
  viability: QueryResult["items"][number]["viability"],
): readonly string[] {
  if (viability === null) return [];
  if (viability.state === "unknown") return viability.unknown_reasons;
  return viability.reason_chain.map((reason) => reason.code);
}

function renderQueryItem(item: QueryResult["items"][number]): string {
  const support = item.support?.state ?? "-";
  const viability = item.viability?.state ?? "-";
  const reasons = queryReasonCodes(item.viability);
  const scope = item.scope?.effective_variable_ids.join(",") || "-";
  const suffix = `support=${support} viability=${viability} reasons=${reasons.join(",") || "-"} scope=${scope}`;
  if (item.recognition.declaration_kind === "candidate") {
    return `candidate ${item.recognition.id} variable=${item.recognition.variable_id} value=${renderCompactValue(item.recognition.value)} ${suffix}`;
  }
  return `${item.recognition.declaration_kind} ${item.recognition.id} ${suffix}`;
}

function renderQuery(result: QueryResult): string {
  const filters = result.filters;
  return [
    result.schema,
    `filters: kind=${filters.kind ?? "-"} variable=${filters.variable_id ?? "-"} support=${filters.support ?? "-"} viability=${filters.viability ?? "-"} grounded_in=${filters.grounded_in_span_id ?? "-"}`,
    `limits: results=${String(result.result_limit)} assignments=${String(result.assignment_limit)}`,
    `matched: ${String(result.matched_count)}`,
    ...result.items.map(renderQueryItem),
    `source_verification: ${result.source_verification.mode}/${result.source_verification.state}`,
    `complete: ${String(result.complete)}`,
    `truncated: ${String(result.truncated)}`,
  ].join("\n");
}

function renderMaterializedWorld(
  world: MaterializationResult["worlds"][number],
): string {
  const assignments = world.assignments
    .map(
      (assignment) =>
        `${assignment.variable_id}=${assignment.candidate_id}(${renderCompactValue(assignment.value)})`,
    )
    .join(", ");
  return `world ${String(world.index)}: ${assignments || "-"} open=${world.open_variable_ids.join(",") || "-"}`;
}

function renderMaterialization(result: MaterializationResult): string {
  return [
    result.schema,
    `scope: requested=${result.requested_variable_ids.join(",")} effective=${result.effective_variable_ids.join(",")}`,
    `limit: ${String(result.limit)}`,
    `inspected_assignments: ${String(result.inspected_assignment_count)}`,
    ...(result.worlds.length === 0
      ? ["worlds: -"]
      : result.worlds.map(renderMaterializedWorld)),
    `indeterminate_assignments: ${String(result.indeterminate_assignment_count)}`,
    `open_variables: ${result.open_variable_ids.join(", ") || "-"}`,
    `unknown_reasons: ${result.unknown_reasons.join(", ") || "-"}`,
    `constraints: ${result.relevant_constraint_ids.join(", ") || "-"}`,
    `source_verification: ${result.source_verification.mode}/${result.source_verification.state}`,
    `require_complete: ${String(result.require_complete)}`,
    `complete: ${String(result.complete)}`,
    `truncated: ${String(result.truncated)}`,
  ].join("\n");
}

function renderAuditReasonData(
  reasonData: Readonly<Record<string, unknown>>,
): string {
  return Object.entries(reasonData)
    .map(
      ([key, value]) =>
        `${key}=${Array.isArray(value) ? value.join(",") : String(value)}`,
    )
    .join(" ");
}

function renderAuditDiagnosticSpan(diagnostic: Diagnostic): string {
  if (diagnostic.span === null) return "-";
  const { start, end } = diagnostic.span;
  return `${start.line}:${start.column}..${end.line}:${end.column}`;
}

function renderAudit(result: AuditResult): string {
  return [
    ...renderBase(result),
    `profile: ${result.profile}`,
    `fail_on: ${result.fail_on}`,
    `passed: ${String(result.passed)}`,
    `source_verification: ${result.source_verification.mode}/${result.source_verification.state}`,
    `evaluated_rules: ${result.evaluated_rule_codes.join(", ")}`,
    `summary: errors=${result.summary.errors} warnings=${result.summary.warnings} info=${result.summary.info}`,
    `complete: ${String(result.complete)}`,
    `truncated: ${String(result.truncated)}`,
    ...(result.diagnostics.length === 0
      ? ["diagnostics: 0"]
      : [
          "diagnostics:",
          ...result.diagnostics.map((diagnostic) => {
            const reasonData = renderAuditReasonData(diagnostic.reason_data);
            const reasonSuffix =
              reasonData.length === 0 ? "" : ` ${reasonData}`;
            const span = renderAuditDiagnosticSpan(diagnostic);
            return `  ${diagnostic.code} ${diagnostic.severity} entity=${diagnostic.entity_id ?? "-"} span=${span} ${diagnostic.message}${reasonSuffix}`;
          }),
        ]),
  ].join("\n");
}

export function renderBootstrapText(result: BootstrapReadResult): string {
  switch (result.schema) {
    case "Llmrecog.ValidationResult.v1":
      return `${renderValidation(result)}\n`;
    case "Llmrecog.ValidationResult.v2":
      return `${renderLocalValidation(result)}\n`;
    case "Llmrecog.DocumentResult.v1":
      return `${renderDocument(result)}\n`;
    case "Llmrecog.RecognitionResult.v1":
      return `${renderRecognition(result)}\n`;
    case "Llmrecog.ExplainResult.v2":
      return `${renderExplain(result)}\n`;
    case "Llmrecog.QueryResult.v1":
      return `${renderQuery(result)}\n`;
    case "Llmrecog.MaterializationResult.v1":
      return `${renderMaterialization(result)}\n`;
    case "Llmrecog.AuditResult.v1":
      return `${renderAudit(result)}\n`;
  }
}
