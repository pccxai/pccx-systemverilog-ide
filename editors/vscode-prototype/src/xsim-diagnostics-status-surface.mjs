// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

export const XSIM_DIAGNOSTICS_SUMMARY_VERSION =
  "pccx.ideXsimDiagnosticsSummary.v0";
export const XSIM_DIAGNOSTICS_STATUS_SURFACE_VERSION =
  "pccx.ideXsimDiagnosticsStatusSurface.v0";
export const XSIM_DIAGNOSTICS_SOURCE_KIND = "xsim-log";
export const XSIM_DIAGNOSTICS_SEVERITIES = Object.freeze([
  "error",
  "warning",
  "info",
  "hint",
]);

const SUMMARY_KIND = "xsim-diagnostics-summary";
const STATUS_SURFACE_KIND = "xsim-diagnostics-status-surface";
const PAYLOAD_KIND = "editor-problems";
const PAYLOAD_TOOL = "pccx-ide-cli";

const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b\s*[:=]/i;
const HOME_PATH_PATTERN = /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+|[A-Za-z]:\\Users\\)/;
const MODEL_ARTIFACT_PATTERN =
  /\.(?:gguf|safetensors|ckpt|pt|pth|onnx|xclbin|bit)(?:\s|$|["'])/i;
const PRIVATE_INSTRUCTION_PATH_PATTERN =
  /(?:^|[/\\])(?:\.private-agent|private[-_ ]?worker|worker[-_ ]?instruction|subagent[-_ ]?instruction)(?:[/\\]|$)/i;
const UNSUPPORTED_MARKER_PARTS = Object.freeze([
  ["production", "ready"],
  ["marketplace", "ready"],
  ["stable", "api"],
  ["stable", "abi"],
  ["kv260 inference ", "works"],
  ["gemma 3n e4b runs on ", "kv260"],
  ["20 tok/s ", "achieved"],
  ["timing ", "closed"],
  ["unreviewed automation ", "system"],
]);

const DEFAULT_LIMITATIONS = Object.freeze([
  "Consumes existing editor-problems JSON from the xsim-log bridge only.",
  "No xsim, Vivado, pccx-lab, launcher, shell, hardware, runtime, provider, MCP, or LSP execution is performed.",
  "Raw log lines are not echoed into the status surface or context bundle.",
  "The status surface is an experimental adapter summary, not a compatibility commitment.",
]);

const DEFAULT_SAFETY = Object.freeze({
  dataOnly: true,
  readOnly: true,
  localOnly: true,
  existingLogOnly: true,
  rawLogIncluded: false,
  rawLineEcho: false,
  xsimExecution: false,
  vivadoExecution: false,
  pccxLabExecution: false,
  launcherExecution: false,
  shellExecution: false,
  fpgaRepoAccess: false,
  hardwareAccess: false,
  kv260Access: false,
  runtimeExecution: false,
  modelExecution: false,
  providerCalls: false,
  networkCalls: false,
  mcpCalls: false,
  lspImplemented: false,
  marketplaceFlow: false,
  telemetry: false,
  automaticUpload: false,
  writeBack: false,
});

export const DEFAULT_XSIM_DIAGNOSTICS_SUMMARY = Object.freeze({
  version: XSIM_DIAGNOSTICS_SUMMARY_VERSION,
  kind: SUMMARY_KIND,
  source: "fixtures/xsim/mixed.log",
  sourceKind: XSIM_DIAGNOSTICS_SOURCE_KIND,
  tool: PAYLOAD_TOOL,
  problemCount: 5,
  problemsBySeverity: Object.freeze({
    error: 2,
    warning: 2,
    info: 1,
    hint: 0,
  }),
  locatedProblemCount: 2,
  unlocatedProblemCount: 3,
  codedProblemCount: 2,
  files: Object.freeze([
    Object.freeze({ file: "src/top.sv", problemCount: 1 }),
    Object.freeze({ file: "src/warn.sv", problemCount: 1 }),
  ]),
  limitations: DEFAULT_LIMITATIONS,
  safety: DEFAULT_SAFETY,
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function addError(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function stringField(value, path, errors) {
  if (typeof value !== "string" || value.trim().length === 0) {
    addError(errors, path, "must be a non-empty string");
    return "";
  }
  if (value.includes("\0") || value.includes("\n") || value.includes("\r")) {
    addError(errors, path, "must be a single-line string");
  }
  return value;
}

function optionalStringField(value, path, errors) {
  if (value == null) {
    return "";
  }
  return stringField(value, path, errors);
}

function countField(value, path, errors) {
  if (!Number.isInteger(value) || value < 0) {
    addError(errors, path, "must be a non-negative integer");
    return 0;
  }
  return value;
}

function positiveIntegerField(value, path, errors) {
  if (value == null) {
    return null;
  }
  if (!Number.isInteger(value) || value < 1) {
    addError(errors, path, "must be a positive integer");
    return null;
  }
  return value;
}

function boolField(value, expected, path, errors) {
  if (typeof value !== "boolean") {
    addError(errors, path, "must be a boolean");
    return false;
  }
  if (value !== expected) {
    addError(errors, path, `must be ${expected}`);
  }
  return value;
}

function ensureValue(actual, expected, path, errors) {
  if (actual !== expected) {
    addError(errors, path, `must be ${expected}`);
  }
}

function ensureAllowed(actual, allowed, path, errors) {
  if (!allowed.includes(actual)) {
    addError(errors, path, `must be one of: ${allowed.join(", ")}`);
  }
}

function assertSafeSerializedText(value, errors) {
  let text = "";
  try {
    text = JSON.stringify(value ?? {});
  } catch {
    addError(errors, "payload", "must be JSON-serializable");
    return;
  }
  const lower = text.toLowerCase();
  if (
    SECRET_ASSIGNMENT_PATTERN.test(text) ||
    HOME_PATH_PATTERN.test(text) ||
    MODEL_ARTIFACT_PATTERN.test(text)
  ) {
    addError(
      errors,
      "payload",
      "must not include secrets, private paths, or model artifact paths",
    );
  }
  for (const parts of UNSUPPORTED_MARKER_PARTS) {
    if (lower.includes(parts.join(""))) {
      addError(errors, "payload", "must not include unsupported runtime or readiness claims");
    }
  }
}

function validateRelativeReference(value, path, errors) {
  const reference = stringField(value, path, errors).replace(/\\/g, "/");
  if (
    reference === "" ||
    reference.startsWith("/") ||
    /^[A-Za-z]:\//.test(reference) ||
    reference.startsWith("../") ||
    reference === ".." ||
    reference.includes("/../") ||
    HOME_PATH_PATTERN.test(reference) ||
    PRIVATE_INSTRUCTION_PATH_PATTERN.test(reference) ||
    SECRET_ASSIGNMENT_PATTERN.test(reference)
  ) {
    addError(errors, path, "must be a relative non-private artifact reference");
  }
  return reference;
}

function zeroCounts() {
  return Object.fromEntries(XSIM_DIAGNOSTICS_SEVERITIES.map((severity) => [severity, 0]));
}

function normalizeCountMap(value, path, errors) {
  if (!isObject(value)) {
    addError(errors, path, "must be an object");
    return zeroCounts();
  }
  return Object.fromEntries(XSIM_DIAGNOSTICS_SEVERITIES.map((severity) => [
    severity,
    countField(value[severity], `${path}.${severity}`, errors),
  ]));
}

function normalizeSafety(value, errors) {
  const safety = isObject(value) ? value : {};
  return {
    dataOnly: boolField(safety.dataOnly, true, "safety.dataOnly", errors),
    readOnly: boolField(safety.readOnly, true, "safety.readOnly", errors),
    localOnly: boolField(safety.localOnly, true, "safety.localOnly", errors),
    existingLogOnly: boolField(safety.existingLogOnly, true, "safety.existingLogOnly", errors),
    rawLogIncluded: boolField(safety.rawLogIncluded, false, "safety.rawLogIncluded", errors),
    rawLineEcho: boolField(safety.rawLineEcho, false, "safety.rawLineEcho", errors),
    xsimExecution: boolField(safety.xsimExecution, false, "safety.xsimExecution", errors),
    vivadoExecution: boolField(safety.vivadoExecution, false, "safety.vivadoExecution", errors),
    pccxLabExecution: boolField(safety.pccxLabExecution, false, "safety.pccxLabExecution", errors),
    launcherExecution: boolField(safety.launcherExecution, false, "safety.launcherExecution", errors),
    shellExecution: boolField(safety.shellExecution, false, "safety.shellExecution", errors),
    fpgaRepoAccess: boolField(safety.fpgaRepoAccess, false, "safety.fpgaRepoAccess", errors),
    hardwareAccess: boolField(safety.hardwareAccess, false, "safety.hardwareAccess", errors),
    kv260Access: boolField(safety.kv260Access, false, "safety.kv260Access", errors),
    runtimeExecution: boolField(safety.runtimeExecution, false, "safety.runtimeExecution", errors),
    modelExecution: boolField(safety.modelExecution, false, "safety.modelExecution", errors),
    providerCalls: boolField(safety.providerCalls, false, "safety.providerCalls", errors),
    networkCalls: boolField(safety.networkCalls, false, "safety.networkCalls", errors),
    mcpCalls: boolField(safety.mcpCalls, false, "safety.mcpCalls", errors),
    lspImplemented: boolField(safety.lspImplemented, false, "safety.lspImplemented", errors),
    marketplaceFlow: boolField(safety.marketplaceFlow, false, "safety.marketplaceFlow", errors),
    telemetry: boolField(safety.telemetry, false, "safety.telemetry", errors),
    automaticUpload: boolField(safety.automaticUpload, false, "safety.automaticUpload", errors),
    writeBack: boolField(safety.writeBack, false, "safety.writeBack", errors),
  };
}

function sortedFiles(filesByName) {
  return [...filesByName.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([file, problemCount]) => ({ file, problemCount }));
}

function summarizeProblemsPayload(payload, errors) {
  ensureValue(payload.kind, PAYLOAD_KIND, "kind", errors);
  ensureValue(payload.source_kind, XSIM_DIAGNOSTICS_SOURCE_KIND, "source_kind", errors);
  ensureValue(payload.tool, PAYLOAD_TOOL, "tool", errors);

  const source = validateRelativeReference(payload.source, "source", errors);
  const problems = Array.isArray(payload.problems) ? payload.problems : [];
  if (!Array.isArray(payload.problems)) {
    addError(errors, "problems", "must be an array");
  }

  const counts = zeroCounts();
  const filesByName = new Map();
  let locatedProblemCount = 0;
  let codedProblemCount = 0;

  problems.forEach((problem, index) => {
    if (!isObject(problem)) {
      addError(errors, `problems[${index}]`, "must be an object");
      return;
    }
    ensureValue(problem.source_kind, XSIM_DIAGNOSTICS_SOURCE_KIND, `problems[${index}].source_kind`, errors);
    const severity = stringField(problem.severity, `problems[${index}].severity`, errors);
    ensureAllowed(severity, XSIM_DIAGNOSTICS_SEVERITIES, `problems[${index}].severity`, errors);
    if (Object.hasOwn(counts, severity)) {
      counts[severity] += 1;
    }

    stringField(problem.message, `problems[${index}].message`, errors);
    optionalStringField(problem.code, `problems[${index}].code`, errors);
    optionalStringField(problem.raw, `problems[${index}].raw`, errors);
    const file = problem.file == null
      ? ""
      : validateRelativeReference(problem.file, `problems[${index}].file`, errors);
    positiveIntegerField(problem.line, `problems[${index}].line`, errors);
    positiveIntegerField(problem.column, `problems[${index}].column`, errors);

    if (problem.code != null) {
      codedProblemCount += 1;
    }
    if (file) {
      locatedProblemCount += 1;
      filesByName.set(file, (filesByName.get(file) ?? 0) + 1);
    }
  });

  return {
    version: XSIM_DIAGNOSTICS_SUMMARY_VERSION,
    kind: SUMMARY_KIND,
    source,
    sourceKind: XSIM_DIAGNOSTICS_SOURCE_KIND,
    tool: PAYLOAD_TOOL,
    problemCount: problems.length,
    problemsBySeverity: counts,
    locatedProblemCount,
    unlocatedProblemCount: problems.length - locatedProblemCount,
    codedProblemCount,
    files: sortedFiles(filesByName),
    limitations: [...DEFAULT_LIMITATIONS],
    safety: { ...DEFAULT_SAFETY },
  };
}

function validateSummary(summary, errors) {
  ensureValue(summary.version, XSIM_DIAGNOSTICS_SUMMARY_VERSION, "version", errors);
  ensureValue(summary.kind, SUMMARY_KIND, "kind", errors);
  ensureValue(summary.sourceKind, XSIM_DIAGNOSTICS_SOURCE_KIND, "sourceKind", errors);
  ensureValue(summary.tool, PAYLOAD_TOOL, "tool", errors);
  const source = validateRelativeReference(summary.source, "source", errors);
  const problemCount = countField(summary.problemCount, "problemCount", errors);
  const problemsBySeverity = normalizeCountMap(
    summary.problemsBySeverity,
    "problemsBySeverity",
    errors,
  );
  const severityTotal = Object.values(problemsBySeverity).reduce((sum, count) => sum + count, 0);
  if (severityTotal !== problemCount) {
    addError(errors, "problemsBySeverity", "must add up to problemCount");
  }

  const locatedProblemCount = countField(
    summary.locatedProblemCount,
    "locatedProblemCount",
    errors,
  );
  const unlocatedProblemCount = countField(
    summary.unlocatedProblemCount,
    "unlocatedProblemCount",
    errors,
  );
  if (locatedProblemCount + unlocatedProblemCount !== problemCount) {
    addError(errors, "locatedProblemCount", "must add with unlocatedProblemCount to problemCount");
  }
  const codedProblemCount = countField(summary.codedProblemCount, "codedProblemCount", errors);
  if (codedProblemCount > problemCount) {
    addError(errors, "codedProblemCount", "must be less than or equal to problemCount");
  }

  const files = Array.isArray(summary.files) ? summary.files : [];
  if (!Array.isArray(summary.files)) {
    addError(errors, "files", "must be an array");
  }
  const normalizedFiles = files.map((fileEntry, index) => {
    if (!isObject(fileEntry)) {
      addError(errors, `files[${index}]`, "must be an object");
      return null;
    }
    return {
      file: validateRelativeReference(fileEntry.file, `files[${index}].file`, errors),
      problemCount: countField(fileEntry.problemCount, `files[${index}].problemCount`, errors),
    };
  }).filter(Boolean);
  const fileProblemTotal = normalizedFiles.reduce((sum, item) => sum + item.problemCount, 0);
  if (fileProblemTotal !== locatedProblemCount) {
    addError(errors, "files", "problemCount values must add up to locatedProblemCount");
  }

  const limitations = Array.isArray(summary.limitations)
    ? summary.limitations.map((item, index) => stringField(item, `limitations[${index}]`, errors))
    : [];
  if (!Array.isArray(summary.limitations)) {
    addError(errors, "limitations", "must be an array");
  }

  const safety = normalizeSafety(summary.safety, errors);

  return {
    version: XSIM_DIAGNOSTICS_SUMMARY_VERSION,
    kind: SUMMARY_KIND,
    source,
    sourceKind: XSIM_DIAGNOSTICS_SOURCE_KIND,
    tool: PAYLOAD_TOOL,
    problemCount,
    problemsBySeverity,
    locatedProblemCount,
    unlocatedProblemCount,
    codedProblemCount,
    files: normalizedFiles.sort((left, right) => left.file.localeCompare(right.file)),
    limitations,
    safety,
  };
}

export function summarizeXsimDiagnosticsProblems(payload = {}) {
  const errors = [];
  if (!isObject(payload)) {
    throw new Error("xsim diagnostics problems payload must be an object");
  }
  assertSafeSerializedText(payload, errors);
  const summary = summarizeProblemsPayload(payload, errors);
  if (errors.length > 0) {
    throw new Error(`invalid xsim diagnostics problems: ${errors.join("; ")}`);
  }
  return summary;
}

function normalizeSummaryInput(input = DEFAULT_XSIM_DIAGNOSTICS_SUMMARY) {
  const errors = [];
  if (!isObject(input)) {
    throw new Error("xsim diagnostics summary input must be an object");
  }
  assertSafeSerializedText(input, errors);
  const summary = input.kind === SUMMARY_KIND
    ? validateSummary(input, errors)
    : summarizeProblemsPayload(input, errors);
  if (errors.length > 0) {
    throw new Error(`invalid xsim diagnostics summary: ${errors.join("; ")}`);
  }
  return summary;
}

export function validateXsimDiagnosticsProblems(payload = {}) {
  try {
    return {
      ok: true,
      summary: summarizeXsimDiagnosticsProblems(payload),
      errors: [],
    };
  } catch (error) {
    return {
      ok: false,
      summary: null,
      errors: error.message.replace(/^invalid xsim diagnostics problems: /, "").split("; "),
    };
  }
}

export function createXsimDiagnosticsStatusSurface(
  summaryInput = DEFAULT_XSIM_DIAGNOSTICS_SUMMARY,
) {
  const summary = normalizeSummaryInput(summaryInput);
  const severity = summary.problemsBySeverity;
  const displaySummary = [
    `${summary.problemCount} problem item(s)`,
    `${severity.error} error`,
    `${severity.warning} warning`,
    `${summary.locatedProblemCount} located`,
    "read-only",
  ].join(", ");

  return {
    version: XSIM_DIAGNOSTICS_STATUS_SURFACE_VERSION,
    kind: STATUS_SURFACE_KIND,
    source: {
      kind: summary.kind,
      version: summary.version,
      adapterOutput: true,
      rawProblemsParsedByUi: false,
      rawLogParsedByUi: false,
    },
    readiness: {
      status: "available",
      summaryAvailable: true,
      localOnly: true,
      experimental: true,
    },
    xsimLog: {
      source: summary.source,
      sourceKind: summary.sourceKind,
      tool: summary.tool,
    },
    diagnostics: {
      count: summary.problemCount,
      bySeverity: summary.problemsBySeverity,
      locatedCount: summary.locatedProblemCount,
      unlocatedCount: summary.unlocatedProblemCount,
      codedCount: summary.codedProblemCount,
    },
    files: {
      count: summary.files.length,
      items: summary.files,
    },
    limitations: summary.limitations,
    safety: summary.safety,
    display: {
      title: "xsim Diagnostics Summary",
      summary: displaySummary,
      detailLines: [
        `source: ${summary.source}`,
        `sourceKind: ${summary.sourceKind}`,
        `tool: ${summary.tool}`,
        `severity: error=${severity.error} warning=${severity.warning} info=${severity.info} hint=${severity.hint}`,
        `locations: located=${summary.locatedProblemCount} unlocated=${summary.unlocatedProblemCount}`,
        "safety: existing-log summary only, no xsim/Vivado execution",
      ],
    },
  };
}

export function xsimDiagnosticsStatusSurfaceJson(
  summaryInput = DEFAULT_XSIM_DIAGNOSTICS_SUMMARY,
) {
  return `${JSON.stringify(createXsimDiagnosticsStatusSurface(summaryInput), null, 2)}\n`;
}

export function formatXsimDiagnosticsStatusSurface(surface) {
  const status = surface ?? createXsimDiagnosticsStatusSurface();
  const severity = status.diagnostics?.bySeverity ?? {};
  return [
    status.display?.title ?? "xsim Diagnostics Summary",
    `source: ${status.xsimLog?.source ?? ""}`,
    `sourceKind: ${status.xsimLog?.sourceKind ?? ""}`,
    `diagnostics: ${status.diagnostics?.count ?? 0}`,
    `severity: error=${severity.error ?? 0} warning=${severity.warning ?? 0} info=${severity.info ?? 0} hint=${severity.hint ?? 0}`,
    `locations: located=${status.diagnostics?.locatedCount ?? 0} unlocated=${status.diagnostics?.unlocatedCount ?? 0}`,
    `readOnly: ${status.safety?.readOnly ? "yes" : "no"}`,
    `dataOnly: ${status.safety?.dataOnly ? "yes" : "no"}`,
    "execution: no xsim, no Vivado, no pccx-lab, no launcher, no shell, no hardware",
  ].join("\n");
}

export function cloneDefaultXsimDiagnosticsSummary() {
  return clone(DEFAULT_XSIM_DIAGNOSTICS_SUMMARY);
}
