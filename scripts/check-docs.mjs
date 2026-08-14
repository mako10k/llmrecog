import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repositoryRoot = process.cwd();
const requiredFiles = [
  "README.md",
  "AGENTS.md",
  "docs/README.md",
  "docs/requirements.md",
  "docs/terminology.md",
  "docs/architecture.md",
  "docs/semantic-model.md",
  "docs/provenance-and-explainability.md",
  "docs/dsl.md",
  "docs/grammar.md",
  "docs/canonical-formatting.md",
  "docs/diagnostics.md",
  "docs/cli-contract.md",
  "docs/integration-llmthink.md",
  "docs/llmthink-grounding-audit.md",
  "docs/development.md",
  "docs/phase-2-acceptance.md",
  "docs/phase-3-acceptance.md",
  "docs/phase-4-acceptance.md",
  "docs/process/development-method.md",
  "docs/process/dogfooding.md",
  "dogfood/README.md",
  "dogfood/protocol-v1/protocol.json",
  "dogfood/protocol-v4/protocol.json",
  "dogfood/protocol-v5/protocol.json",
  "dogfood/protocol-v11/protocol.json",
  "dogfood/protocol-v12/protocol.json",
  "dogfood/protocol-v1/examples/input.example.recog",
  "dogfood/protocol-v1/examples/run-receipt.example.json",
  "dogfood/protocol-v1/examples/feedback.example.json",
  "dogfood/schemas/Llmrecog.Internal.DogfoodRunReceipt.v1.schema.json",
  "dogfood/schemas/Llmrecog.Internal.DogfoodFeedback.v1.schema.json",
  "docs/adr/0005-node-22-typescript-esm-development-baseline.md",
  "docs/adr/0006-executable-contract-v0-1.md",
  "docs/adr/0007-phase-2-read-only-command-contract.md",
  "docs/adr/0010-phase-4-complete-core-contract.md",
  "docs/adr/0011-relational-explain-text-projection-correction.md",
  "docs/adr/0012-phase-5-fail-closed-local-source-verification.md",
  "docs/examples/minimal.recog",
  "docs/examples/meeting.txt",
  "contracts/llmrecog-0.1.ebnf",
  "contracts/diagnostics-v1.json",
  "schemas/Llmrecog.Common.v1.schema.json",
  "schemas/Llmrecog.Ast.v1.schema.json",
  "schemas/Llmrecog.SemanticDocument.v1.schema.json",
  "schemas/Llmrecog.ValidationResult.v1.schema.json",
  "schemas/Llmrecog.SourceVerification.v1.schema.json",
  "schemas/Llmrecog.ValidationResult.v2.schema.json",
  "schemas/Llmrecog.ExplainResult.v1.schema.json",
  "schemas/Llmrecog.DocumentResult.v1.schema.json",
  "schemas/Llmrecog.RecognitionResult.v1.schema.json",
  "schemas/Llmrecog.QueryResult.v1.schema.json",
  "schemas/Llmrecog.MaterializationResult.v1.schema.json",
  "test/fixtures/contracts/v0.1/manifest.json",
  "test/fixtures/contracts/v0.1/source-verification/cases.json",
];

function collectMarkdownFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(absolutePath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(absolutePath);
    }
  }
  return files;
}

function lineNumber(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

const errors = [];

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(repositoryRoot, relativePath))) {
    errors.push(`required file is missing: ${relativePath}`);
  }
}

const markdownFiles = [
  path.join(repositoryRoot, "README.md"),
  path.join(repositoryRoot, "AGENTS.md"),
  ...collectMarkdownFiles(path.join(repositoryRoot, "docs")),
];

for (const markdownFile of markdownFiles) {
  const relativeFile = path.relative(repositoryRoot, markdownFile);
  const text = fs.readFileSync(markdownFile, "utf8");
  const fenceCount = text.match(/^```/gm)?.length ?? 0;
  if (fenceCount % 2 !== 0) {
    errors.push(`${relativeFile}: unbalanced fenced code blocks`);
  }

  const linkPattern = /\]\(([^)\n]+)\)/g;
  for (const match of text.matchAll(linkPattern)) {
    const rawTarget = match[1]?.replace(/^<|>$/g, "") ?? "";
    if (/^(?:[a-z]+:|#)/i.test(rawTarget)) {
      continue;
    }
    const fileTarget = rawTarget.split("#", 1)[0];
    if (fileTarget === undefined || fileTarget.length === 0) {
      continue;
    }
    const resolvedTarget = path.resolve(path.dirname(markdownFile), fileTarget);
    if (!fs.existsSync(resolvedTarget)) {
      errors.push(
        `${relativeFile}:${lineNumber(text, match.index ?? 0)}: broken local link ${rawTarget}`,
      );
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exitCode = 1;
} else {
  console.log(
    `documentation checks passed (${markdownFiles.length} Markdown files)`,
  );
}
