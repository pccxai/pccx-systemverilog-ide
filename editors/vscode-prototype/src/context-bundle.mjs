// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import { isAbsolute, relative } from "node:path";

import {
  DIAGNOSTICS_HANDOFF_CATEGORIES,
  DIAGNOSTICS_HANDOFF_SEVERITIES,
} from "./diagnostics-handoff-consumer.mjs";
import {
  createDiagnosticsHandoffStatusSurface,
} from "./diagnostics-handoff-status-surface.mjs";
import {
  DEVICE_SESSION_ERROR_SEVERITIES,
} from "./device-session-status-consumer.mjs";
import {
  createDeviceSessionStatusSurface,
} from "./device-session-status-surface.mjs";
import {
  createRuntimeReadinessStatusSurface,
} from "./runtime-readiness-status-surface.mjs";
import {
  XSIM_DIAGNOSTICS_SEVERITIES,
  createXsimDiagnosticsStatusSurface,
} from "./xsim-diagnostics-status-surface.mjs";

export const CONTEXT_BUNDLE_VERSION = "pccx.contextBundle.v0";
export const CONTEXT_BUNDLE_SOURCE = "pccx-systemverilog-ide";

export const DEFAULT_CONTEXT_BUNDLE_LIMITS = Object.freeze({
  maxFiles: 3,
  maxDiagnostics: 10,
  maxDeclarations: 12,
  maxSnippetLines: 40,
  maxLogSummaryLines: 20,
  maxRecentValidationResults: 5,
  maxTextCharacters: 4000,
});

export const CONTEXT_BUNDLE_DIAGNOSTICS_HANDOFF_VERSION =
  "pccx.contextBundleDiagnosticsHandoff.v0";
export const CONTEXT_BUNDLE_RUNTIME_READINESS_VERSION =
  "pccx.contextBundleRuntimeReadiness.v0";
export const CONTEXT_BUNDLE_DEVICE_SESSION_STATUS_VERSION =
  "pccx.contextBundleDeviceSessionStatus.v0";
export const CONTEXT_BUNDLE_XSIM_DIAGNOSTICS_VERSION =
  "pccx.contextBundleXsimDiagnostics.v0";

const EXCLUDED_PATH_SEGMENTS = new Set([
  ".git",
  ".vscode-test",
  "node_modules",
]);

const EXCLUDED_PATH_NAMES = new Set([
  "AGENTS.md",
  "package-lock.json",
]);

const EXCLUDED_PATH_PATTERNS = Object.freeze([
  ".git/**",
  ".vscode-test/**",
  "node_modules/**",
  "agent-instruction-files",
  "lockfiles",
  ".private-agent/**",
  "private-worker/**",
  "worker-instruction/**",
  "subagent-instruction/**",
]);

const SECRET_LIKE_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b/i;
const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b\s*[:=]/i;
const HOME_PATH_PATTERN = /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+)/g;
const PRIVATE_INSTRUCTION_PATH_PATTERN =
  /(?:^|[/\\])(?:\.private-agent|private[-_ ]?worker|worker[-_ ]?instruction|subagent[-_ ]?instruction)(?:[/\\]|$)/i;

function mergeLimits(limits = {}) {
  return {
    ...DEFAULT_CONTEXT_BUNDLE_LIMITS,
    ...Object.fromEntries(
      Object.entries(limits).filter(([, value]) => Number.isInteger(value) && value >= 0),
    ),
  };
}

function normalizeWorkspacePath(workspaceRoot) {
  if (typeof workspaceRoot !== "string" || workspaceRoot.trim().length === 0) {
    return null;
  }
  return workspaceRoot.replace(/\\/g, "/").replace(/\/+$/, "");
}

function hasExcludedPathSegment(path) {
  const segments = path.split("/").filter(Boolean);
  return segments.some((segment) => EXCLUDED_PATH_SEGMENTS.has(segment));
}

function hasExcludedPathName(path) {
  const segments = path.split("/").filter(Boolean);
  return segments.some((segment) => EXCLUDED_PATH_NAMES.has(segment));
}

function normalizePathRef(path, workspaceRoot = null) {
  if (typeof path !== "string" || path.trim().length === 0) {
    return null;
  }
  if (path.includes("\0") || path.includes("\n") || path.includes("\r")) {
    return null;
  }

  const normalizedWorkspaceRoot = normalizeWorkspacePath(workspaceRoot);
  let normalizedPath = path.replace(/\\/g, "/");

  if (isAbsolute(normalizedPath)) {
    if (!normalizedWorkspaceRoot) {
      return null;
    }
    const rel = relative(normalizedWorkspaceRoot, normalizedPath).replace(/\\/g, "/");
    if (rel.startsWith("../") || rel === ".." || isAbsolute(rel)) {
      return null;
    }
    normalizedPath = rel;
  }

  normalizedPath = normalizedPath.replace(/^\.\//, "");
  if (
    normalizedPath === "" ||
    normalizedPath.startsWith("../") ||
    normalizedPath === ".." ||
    hasExcludedPathSegment(normalizedPath) ||
    hasExcludedPathName(normalizedPath) ||
    SECRET_LIKE_PATTERN.test(normalizedPath) ||
    PRIVATE_INSTRUCTION_PATH_PATTERN.test(normalizedPath)
  ) {
    return null;
  }
  return normalizedPath;
}

function clampNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeRange(range) {
  if (!range || typeof range !== "object") {
    return null;
  }
  const normalized = {
    start: {
      line: Math.max(0, Math.floor(clampNumber(range.start?.line))),
      character: Math.max(0, Math.floor(clampNumber(range.start?.character))),
    },
    end: {
      line: Math.max(0, Math.floor(clampNumber(range.end?.line))),
      character: Math.max(0, Math.floor(clampNumber(range.end?.character))),
    },
  };
  if (
    normalized.end.line < normalized.start.line ||
    (
      normalized.end.line === normalized.start.line &&
      normalized.end.character < normalized.start.character
    )
  ) {
    normalized.end = { ...normalized.start };
  }
  return normalized;
}

function redactSecretAssignments(value) {
  return value
    .split(/\r?\n/)
    .map((line) => (SECRET_ASSIGNMENT_PATTERN.test(line) ? "[redacted]" : line))
    .join("\n");
}

function scrubText(value, maxCharacters) {
  if (typeof value !== "string" || value.length === 0 || maxCharacters === 0) {
    return "";
  }
  return redactSecretAssignments(value)
    .replace(HOME_PATH_PATTERN, "[home]")
    .slice(0, maxCharacters);
}

function isBinaryLike(text) {
  return typeof text !== "string" || text.includes("\0");
}

function boundedLines(value, limit, maxCharacters) {
  if (typeof value !== "string" || limit === 0 || maxCharacters === 0) {
    return [];
  }
  return scrubText(value, maxCharacters)
    .split(/\r?\n/)
    .slice(0, limit);
}

function boundedSnippetLines(value, limit, maxCharacters) {
  if (typeof value !== "string" || limit === 0 || maxCharacters === 0) {
    return { lines: [], truncated: typeof value === "string" && value.length > 0 };
  }
  const redacted = redactSecretAssignments(value);
  const charLimited = redacted.slice(0, maxCharacters);
  const allLines = charLimited.split(/\r?\n/);
  const lines = allLines.slice(0, limit);
  return {
    lines,
    truncated: redacted.length > charLimited.length || allLines.length > lines.length,
  };
}

function normalizeDiagnostic(diagnostic, workspaceRoot, limits) {
  const path = normalizePathRef(diagnostic?.path ?? diagnostic?.file, workspaceRoot);
  if (!path) {
    return null;
  }
  return {
    path,
    range: normalizeRange(diagnostic.range),
    severity: scrubText(diagnostic.severity ?? "Information", 80),
    message: scrubText(diagnostic.message ?? "", 500),
    source: scrubText(diagnostic.source ?? "", 120),
    code: scrubText(diagnostic.code ?? "", 120),
  };
}

function normalizeDeclaration(declaration, workspaceRoot, limits) {
  const path = normalizePathRef(declaration?.path ?? declaration?.file, workspaceRoot);
  if (!path) {
    return null;
  }
  return {
    name: scrubText(declaration.name ?? "", 160),
    kind: scrubText(declaration.kind ?? "any", 80),
    path,
    range: normalizeRange(declaration.range),
    line: declaration.line == null ? undefined : Math.max(1, Math.floor(clampNumber(declaration.line, 1))),
    column: declaration.column == null ? undefined : Math.max(1, Math.floor(clampNumber(declaration.column, 1))),
  };
}

function normalizeSnippet(file, workspaceRoot, limits) {
  const path = normalizePathRef(file?.path ?? file?.file, workspaceRoot);
  if (!path || isBinaryLike(file?.text ?? "")) {
    return null;
  }

  const snippet = boundedSnippetLines(
    file.text ?? "",
    limits.maxSnippetLines,
    limits.maxTextCharacters,
  );
  return {
    path,
    language: scrubText(file.language ?? "systemverilog", 80),
    range: normalizeRange(file.range),
    lines: snippet.lines,
    truncated: snippet.truncated,
  };
}

function sortedByPathAndName(items) {
  return [...items].sort((a, b) => {
    const pathOrder = String(a.path ?? "").localeCompare(String(b.path ?? ""));
    if (pathOrder !== 0) {
      return pathOrder;
    }
    return String(a.name ?? a.message ?? "").localeCompare(String(b.name ?? b.message ?? ""));
  });
}

function sortedSnippets(items, selectedPath) {
  return sortedByPathAndName(items).sort((a, b) => {
    const aSelected = selectedPath && a.path === selectedPath ? 0 : 1;
    const bSelected = selectedPath && b.path === selectedPath ? 0 : 1;
    return aSelected - bSelected;
  });
}

function rangeStartsWithin(range, selectedRange) {
  if (!range || !selectedRange) {
    return false;
  }
  const line = range.start?.line;
  const selectedStart = selectedRange.start?.line;
  const selectedEnd = selectedRange.end?.line;
  return Number.isInteger(line) &&
    Number.isInteger(selectedStart) &&
    Number.isInteger(selectedEnd) &&
    line >= selectedStart &&
    line <= selectedEnd;
}

function sortedDiagnostics(items, selectedPath, selectedRange) {
  return sortedByPathAndName(items).sort((a, b) => {
    const aScore = (selectedPath && a.path === selectedPath ? 0 : 2) +
      (rangeStartsWithin(a.range, selectedRange) ? 0 : 1);
    const bScore = (selectedPath && b.path === selectedPath ? 0 : 2) +
      (rangeStartsWithin(b.range, selectedRange) ? 0 : 1);
    return aScore - bScore;
  });
}

function normalizeLogSummary(entry, limits) {
  const lines = Array.isArray(entry?.summaryLines)
    ? entry.summaryLines.join("\n")
    : entry?.summary ?? "";
  return {
    label: scrubText(entry?.label ?? entry?.flow ?? "pccx-lab-output", 160),
    exitCode: entry?.exitCode == null ? null : Math.floor(clampNumber(entry.exitCode)),
    lines: boundedLines(lines, limits.maxLogSummaryLines, limits.maxTextCharacters),
  };
}

function normalizeConfiguration(configuration) {
  if (!configuration || typeof configuration !== "object") {
    return {
      mode: "unknown",
      liveWorkspace: { enabled: false },
    workflowBoundary: { enabled: false, backend: "none" },
    pccxLab: { commandBoundary: "pccx_ide_cli" },
    validationRunner: { enabled: false, mode: "disabled" },
  };
}
  return {
    mode: scrubText(configuration.mode ?? "unknown", 80),
    liveWorkspace: {
      enabled: configuration.liveWorkspace?.enabled === true,
    },
    workflowBoundary: {
      enabled: configuration.workflowBoundary?.enabled === true,
      backend: scrubText(configuration.workflowBoundary?.backend ?? "none", 80),
    },
    pccxLab: {
      commandBoundary: scrubText(configuration.pccxLab?.commandBoundary ?? "pccx_ide_cli", 120),
    },
    validationRunner: {
      enabled: configuration.validationRunner?.enabled === true,
      mode: scrubText(configuration.validationRunner?.mode ?? "disabled", 80),
      defaultWorkingDirectory: scrubText(
        configuration.validationRunner?.defaultWorkingDirectory ?? "repo-root",
        80,
      ),
      maxOutputLines: Math.max(0, Math.floor(clampNumber(
        configuration.validationRunner?.maxOutputLines,
      ))),
      timeoutMs: Math.max(0, Math.floor(clampNumber(configuration.validationRunner?.timeoutMs))),
    },
  };
}

function normalizeSelectedSymbol(symbol, workspaceRoot) {
  if (!symbol) {
    return null;
  }
  const path = normalizePathRef(symbol.path ?? symbol.file, workspaceRoot);
  if (!path) {
    return null;
  }
  return {
    name: scrubText(symbol.name ?? "", 160),
    kind: scrubText(symbol.kind ?? "any", 80),
    path,
    range: normalizeRange(symbol.range),
  };
}

function normalizeCurrentLine(currentLine, limits) {
  if (!currentLine || typeof currentLine !== "object") {
    return null;
  }
  return {
    number: Math.max(1, Math.floor(clampNumber(currentLine.number, 1))),
    text: scrubText(currentLine.text ?? "", limits.maxTextCharacters),
    truncated: currentLine.truncated === true,
  };
}

function normalizeSelectionSummary(summary, limits) {
  if (!summary || typeof summary !== "object") {
    return null;
  }
  const previewLines = Array.isArray(summary.previewLines)
    ? summary.previewLines
      .map((line) => scrubText(line, limits.maxTextCharacters))
      .slice(0, limits.maxSnippetLines)
    : [];
  return {
    lineCount: Math.max(0, Math.floor(clampNumber(summary.lineCount))),
    characterCount: Math.max(0, Math.floor(clampNumber(summary.characterCount))),
    previewLines,
    truncated: summary.truncated === true,
  };
}

function normalizeCursor(cursor) {
  if (!cursor || typeof cursor !== "object") {
    return null;
  }
  return {
    line: Math.max(0, Math.floor(clampNumber(cursor.line))),
    character: Math.max(0, Math.floor(clampNumber(cursor.character))),
  };
}

function normalizeSelectedSymbolContext(context, workspaceRoot, limits) {
  if (!context || typeof context !== "object") {
    return null;
  }
  const path = normalizePathRef(context.path ?? context.file, workspaceRoot);
  if (!path) {
    return null;
  }
  return {
    version: scrubText(context.version ?? "", 80),
    path,
    language: scrubText(context.language ?? "systemverilog", 80),
    symbolText: scrubText(context.symbolText ?? context.name ?? "", 160),
    lexicalKind: scrubText(context.lexicalKind ?? context.kind ?? "identifier", 80),
    range: normalizeRange(context.range),
    cursor: normalizeCursor(context.cursor),
    currentLine: normalizeCurrentLine(context.currentLine, limits),
    selectionSummary: normalizeSelectionSummary(context.selectionSummary, limits),
    enclosingDeclaration: normalizeDeclaration(context.enclosingDeclaration, workspaceRoot, limits),
    relatedNavigation: Array.isArray(context.relatedNavigation)
      ? sortedByPathAndName(context.relatedNavigation
        .map((item) => normalizeDeclaration(item, workspaceRoot, limits))
        .filter(Boolean))
        .slice(0, limits.maxDeclarations)
      : [],
    nearbyDiagnostics: Array.isArray(context.nearbyDiagnostics)
      ? sortedDiagnostics(context.nearbyDiagnostics
        .map((diagnostic) => normalizeDiagnostic(diagnostic, workspaceRoot, limits))
        .filter(Boolean), path, normalizeRange(context.range))
        .slice(0, limits.maxDiagnostics)
      : [],
    analysis: {
      kind: scrubText(context.analysis?.kind ?? "lexical", 80),
      semanticResolution: context.analysis?.semanticResolution === true,
    },
  };
}

function normalizeRecentCommandStatus(status, limits) {
  if (!status || typeof status !== "object") {
    return null;
  }
  return {
    commandId: scrubText(status.commandId ?? "", 160),
    ok: status.ok === true,
    actionKind: scrubText(status.actionKind ?? "", 80),
    summary: scrubText(status.summary ?? "", 500),
    facade: status.facade
      ? {
          command: scrubText(status.facade.command ?? "", 80),
          mode: scrubText(status.facade.mode ?? "", 80),
        }
      : null,
    diagnosticCount: Math.max(0, Math.floor(clampNumber(status.diagnosticCount))),
    navigationItemCount: Math.max(0, Math.floor(clampNumber(status.navigationItemCount))),
    error: scrubText(status.error ?? "", limits.maxTextCharacters),
  };
}

function normalizeOutputSummary(summary, limits) {
  const lines = Array.isArray(summary?.lines)
    ? summary.lines
      .map((line) => scrubText(String(line ?? ""), limits.maxTextCharacters))
      .slice(0, limits.maxLogSummaryLines)
    : [];
  return {
    lines,
    lineCount: Math.max(0, Math.floor(clampNumber(summary?.lineCount, lines.length))),
    truncated: summary?.truncated === true || (
      Array.isArray(summary?.lines) && summary.lines.length > lines.length
    ),
  };
}

function normalizeRecentValidation(validation, limits) {
  if (!validation || typeof validation !== "object") {
    return null;
  }
  const stdoutSummary = normalizeOutputSummary(validation.stdoutSummary, limits);
  const stderrSummary = normalizeOutputSummary(validation.stderrSummary, limits);
  const label = scrubText(validation.label ?? validation.commandLabel ?? "", 160);
  const summaryText = scrubText(validation.summaryText ?? validation.summary ?? "", 800);
  return {
    version: scrubText(validation.version ?? "", 80),
    proposalId: scrubText(validation.proposalId ?? "", 120),
    label,
    commandLabel: scrubText(validation.commandLabel ?? label, 160),
    status: scrubText(validation.status ?? "unknown", 80),
    summaryText,
    exitCode: validation.exitCode == null
      ? null
      : Math.floor(clampNumber(validation.exitCode)),
    durationMs: validation.durationMs == null
      ? null
      : Math.max(0, Math.floor(clampNumber(validation.durationMs))),
    startedAt: scrubText(validation.startedAt ?? "", 80),
    finishedAt: scrubText(validation.finishedAt ?? "", 80),
    commandKind: scrubText(validation.commandKind ?? "", 120),
    workingDirectoryKind: scrubText(
      validation.workingDirectoryKind ?? validation.cwdKind ?? "",
      80,
    ),
    stdoutSummary,
    stderrSummary,
    truncated: validation.truncated === true ||
      stdoutSummary.truncated === true ||
      stderrSummary.truncated === true,
    redactionApplied: validation.redactionApplied === true ||
      stdoutSummary.lines.some((line) => line.includes("[redacted]") || line.includes("[home]")) ||
      stderrSummary.lines.some((line) => line.includes("[redacted]") || line.includes("[home]")),
    failureHints: Array.isArray(validation.failureHints)
      ? validation.failureHints
        .map((hint) => scrubText(String(hint ?? ""), 500))
        .slice(0, 3)
      : [],
    safety: {
      allowlisted: validation.safety?.allowlisted === true,
      shell: validation.safety?.shell === true,
      fixedArgs: validation.safety?.fixedArgs === true,
      userProvidedCommand: validation.safety?.userProvidedCommand === true,
      writesFiles: validation.safety?.writesFiles === true,
      providerCalls: validation.safety?.providerCalls === true,
      launcherCalls: validation.safety?.launcherCalls === true,
      mcpServerCalls: validation.safety?.mcpServerCalls === true,
    },
  };
}

function normalizeRecentValidationHistory(history, limits) {
  if (!Array.isArray(history)) {
    return [];
  }
  return history
    .map((entry) => normalizeRecentValidation(entry, limits))
    .filter(Boolean)
    .slice(0, limits.maxRecentValidationResults);
}

function diagnosticsHandoffSafetyBase() {
  return {
    dataOnly: true,
    readOnly: true,
    localOnly: true,
    launcherExecution: false,
    pccxLabExecution: false,
    pccxLabValidatorInvocation: false,
    shellExecution: false,
    providerCalls: false,
    networkCalls: false,
    runtimeCalls: false,
    mcpCalls: false,
    lspImplemented: false,
    marketplaceFlow: false,
    telemetry: false,
    automaticUpload: false,
    writeBack: false,
  };
}

function missingDiagnosticsHandoffContext(status = "notAvailable", reason = "") {
  return {
    version: CONTEXT_BUNDLE_DIAGNOSTICS_HANDOFF_VERSION,
    kind: "diagnostics-handoff-context",
    status,
    summaryAvailable: false,
    source: {
      adapterOutput: false,
      rawHandoffParsedByUi: false,
    },
    handoff: null,
    diagnostics: {
      count: 0,
      bySeverity: {},
      byCategory: {},
    },
    descriptorRefs: null,
    transportKinds: [],
    limitations: [],
    safety: diagnosticsHandoffSafetyBase(),
    reason,
  };
}

function normalizeCountMap(value, keys) {
  return Object.fromEntries(keys.map((key) => {
    const count = value?.[key];
    return [key, Math.max(0, Math.floor(clampNumber(count)))];
  }));
}

function normalizeDiagnosticsHandoffStatusSurface(surface, limits) {
  return {
    version: CONTEXT_BUNDLE_DIAGNOSTICS_HANDOFF_VERSION,
    kind: "diagnostics-handoff-context",
    status: scrubText(surface.readiness?.status ?? "available", 80),
    summaryAvailable: surface.readiness?.summaryAvailable === true,
    source: {
      adapterOutput: surface.source?.adapterOutput === true,
      rawHandoffParsedByUi: surface.source?.rawHandoffParsedByUi === true,
    },
    handoff: surface.handoff
      ? {
          schemaVersion: scrubText(surface.handoff.schemaVersion ?? "", 120),
          handoffId: scrubText(surface.handoff.handoffId ?? "", 160),
          handoffKind: scrubText(surface.handoff.handoffKind ?? "", 120),
          producerId: scrubText(surface.handoff.producerId ?? "", 120),
          consumerId: scrubText(surface.handoff.consumerId ?? "", 120),
          targetKind: scrubText(surface.handoff.targetKind ?? "", 120),
        }
      : null,
    diagnostics: {
      count: Math.max(0, Math.floor(clampNumber(surface.diagnostics?.count))),
      bySeverity: normalizeCountMap(
        surface.diagnostics?.bySeverity,
        DIAGNOSTICS_HANDOFF_SEVERITIES,
      ),
      byCategory: normalizeCountMap(
        surface.diagnostics?.byCategory,
        DIAGNOSTICS_HANDOFF_CATEGORIES,
      ),
    },
    descriptorRefs: surface.descriptorRefs
      ? {
          launcherOperationId: scrubText(surface.descriptorRefs.launcherOperationId ?? "", 160),
          modelId: scrubText(surface.descriptorRefs.modelId ?? "", 160),
          runtimeId: scrubText(surface.descriptorRefs.runtimeId ?? "", 160),
          referenceKind: scrubText(surface.descriptorRefs.referenceKind ?? "", 120),
        }
      : null,
    transportKinds: Array.isArray(surface.transportKinds)
      ? surface.transportKinds.map((kind) => scrubText(kind, 120)).slice(0, 4)
      : [],
    limitations: Array.isArray(surface.limitations)
      ? surface.limitations.map((item) => scrubText(item, 500)).slice(0, 4)
      : [],
    safety: {
      ...diagnosticsHandoffSafetyBase(),
      dataOnly: surface.safety?.dataOnly === true,
      readOnly: surface.safety?.readOnly === true,
      localOnly: surface.safety?.localOnly === true,
      launcherExecution: surface.safety?.launcherExecution === true,
      pccxLabExecution: surface.safety?.pccxLabExecution === true,
      pccxLabValidatorInvocation: surface.safety?.pccxLabValidatorInvocation === true,
      shellExecution: surface.safety?.shellExecution === true,
      providerCalls: surface.safety?.providerCalls === true,
      networkCalls: surface.safety?.networkCalls === true,
      runtimeCalls: surface.safety?.runtimeCalls === true,
      mcpCalls: surface.safety?.mcpCalls === true,
      lspImplemented: surface.safety?.lspImplemented === true,
      marketplaceFlow: surface.safety?.marketplaceFlow === true,
      telemetry: surface.safety?.telemetry === true,
      automaticUpload: surface.safety?.automaticUpload === true,
      writeBack: surface.safety?.writeBack === true,
    },
  };
}

function assertDiagnosticsHandoffContextSafety(context) {
  const safety = context.safety ?? {};
  if (
    safety.dataOnly !== true ||
    safety.readOnly !== true ||
    safety.launcherExecution === true ||
    safety.pccxLabExecution === true ||
    safety.pccxLabValidatorInvocation === true ||
    safety.shellExecution === true ||
    safety.providerCalls === true ||
    safety.networkCalls === true ||
    safety.runtimeCalls === true ||
    safety.mcpCalls === true ||
    safety.lspImplemented === true ||
    safety.marketplaceFlow === true ||
    safety.telemetry === true ||
    safety.automaticUpload === true ||
    safety.writeBack === true ||
    context.source?.rawHandoffParsedByUi === true
  ) {
    throw new Error("diagnostics handoff context must remain data-only and read-only");
  }
}

function normalizeDiagnosticsHandoffContext(input, limits) {
  const suppliedSurface = input?.diagnosticsHandoffStatus ??
    input?.diagnosticsHandoff?.statusSurface ??
    null;
  const suppliedSummary = input?.diagnosticsHandoffSummary ??
    input?.diagnosticsHandoff?.consumerSummary ??
    null;

  if (!suppliedSurface && !suppliedSummary) {
    return missingDiagnosticsHandoffContext();
  }

  try {
    const surface = suppliedSurface?.kind === "diagnostics-handoff-status-surface"
      ? suppliedSurface
      : createDiagnosticsHandoffStatusSurface(suppliedSummary);
    const context = normalizeDiagnosticsHandoffStatusSurface(surface, limits);
    assertDiagnosticsHandoffContextSafety(context);
    return context;
  } catch (error) {
    return missingDiagnosticsHandoffContext(
      "invalid",
      scrubText(error.message, limits.maxTextCharacters),
    );
  }
}

function xsimDiagnosticsSafetyBase() {
  return {
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
  };
}

function missingXsimDiagnosticsContext(status = "notAvailable", reason = "") {
  return {
    version: CONTEXT_BUNDLE_XSIM_DIAGNOSTICS_VERSION,
    kind: "xsim-diagnostics-context",
    status,
    summaryAvailable: false,
    source: {
      adapterOutput: false,
      rawProblemsParsedByUi: false,
      rawLogParsedByUi: false,
    },
    xsimLog: null,
    diagnostics: {
      count: 0,
      bySeverity: {},
      locatedCount: 0,
      unlocatedCount: 0,
      codedCount: 0,
    },
    files: {
      count: 0,
      items: [],
    },
    limitations: [],
    safety: xsimDiagnosticsSafetyBase(),
    reason,
  };
}

function normalizeXsimDiagnosticsStatusSurface(surface, limits) {
  return {
    version: CONTEXT_BUNDLE_XSIM_DIAGNOSTICS_VERSION,
    kind: "xsim-diagnostics-context",
    status: scrubText(surface.readiness?.status ?? "available", 80),
    summaryAvailable: surface.readiness?.summaryAvailable === true,
    source: {
      adapterOutput: surface.source?.adapterOutput === true,
      rawProblemsParsedByUi: surface.source?.rawProblemsParsedByUi === true,
      rawLogParsedByUi: surface.source?.rawLogParsedByUi === true,
    },
    xsimLog: surface.xsimLog
      ? {
          source: scrubText(surface.xsimLog.source ?? "", 160),
          sourceKind: scrubText(surface.xsimLog.sourceKind ?? "", 80),
          tool: scrubText(surface.xsimLog.tool ?? "", 120),
        }
      : null,
    diagnostics: {
      count: Math.max(0, Math.floor(clampNumber(surface.diagnostics?.count))),
      bySeverity: normalizeCountMap(
        surface.diagnostics?.bySeverity,
        XSIM_DIAGNOSTICS_SEVERITIES,
      ),
      locatedCount: Math.max(0, Math.floor(clampNumber(surface.diagnostics?.locatedCount))),
      unlocatedCount: Math.max(0, Math.floor(clampNumber(surface.diagnostics?.unlocatedCount))),
      codedCount: Math.max(0, Math.floor(clampNumber(surface.diagnostics?.codedCount))),
    },
    files: {
      count: Math.max(0, Math.floor(clampNumber(surface.files?.count))),
      items: Array.isArray(surface.files?.items)
        ? surface.files.items.map((item) => ({
            file: scrubText(item.file ?? "", 160),
            problemCount: Math.max(0, Math.floor(clampNumber(item.problemCount))),
          })).slice(0, limits.maxFiles)
        : [],
    },
    limitations: Array.isArray(surface.limitations)
      ? surface.limitations.map((item) => scrubText(item, 500)).slice(0, 4)
      : [],
    safety: {
      ...xsimDiagnosticsSafetyBase(),
      dataOnly: surface.safety?.dataOnly === true,
      readOnly: surface.safety?.readOnly === true,
      localOnly: surface.safety?.localOnly === true,
      existingLogOnly: surface.safety?.existingLogOnly === true,
      rawLogIncluded: surface.safety?.rawLogIncluded === true,
      rawLineEcho: surface.safety?.rawLineEcho === true,
      xsimExecution: surface.safety?.xsimExecution === true,
      vivadoExecution: surface.safety?.vivadoExecution === true,
      pccxLabExecution: surface.safety?.pccxLabExecution === true,
      launcherExecution: surface.safety?.launcherExecution === true,
      shellExecution: surface.safety?.shellExecution === true,
      fpgaRepoAccess: surface.safety?.fpgaRepoAccess === true,
      hardwareAccess: surface.safety?.hardwareAccess === true,
      kv260Access: surface.safety?.kv260Access === true,
      runtimeExecution: surface.safety?.runtimeExecution === true,
      modelExecution: surface.safety?.modelExecution === true,
      providerCalls: surface.safety?.providerCalls === true,
      networkCalls: surface.safety?.networkCalls === true,
      mcpCalls: surface.safety?.mcpCalls === true,
      lspImplemented: surface.safety?.lspImplemented === true,
      marketplaceFlow: surface.safety?.marketplaceFlow === true,
      telemetry: surface.safety?.telemetry === true,
      automaticUpload: surface.safety?.automaticUpload === true,
      writeBack: surface.safety?.writeBack === true,
    },
  };
}

function assertXsimDiagnosticsContextSafety(context) {
  const safety = context.safety ?? {};
  if (
    safety.dataOnly !== true ||
    safety.readOnly !== true ||
    safety.existingLogOnly !== true ||
    safety.rawLogIncluded === true ||
    safety.rawLineEcho === true ||
    safety.xsimExecution === true ||
    safety.vivadoExecution === true ||
    safety.pccxLabExecution === true ||
    safety.launcherExecution === true ||
    safety.shellExecution === true ||
    safety.fpgaRepoAccess === true ||
    safety.hardwareAccess === true ||
    safety.kv260Access === true ||
    safety.runtimeExecution === true ||
    safety.modelExecution === true ||
    safety.providerCalls === true ||
    safety.networkCalls === true ||
    safety.mcpCalls === true ||
    safety.lspImplemented === true ||
    safety.marketplaceFlow === true ||
    safety.telemetry === true ||
    safety.automaticUpload === true ||
    safety.writeBack === true ||
    context.source?.rawProblemsParsedByUi === true ||
    context.source?.rawLogParsedByUi === true
  ) {
    throw new Error("xsim diagnostics context must remain existing-log data only and read-only");
  }
}

function normalizeXsimDiagnosticsContext(input, limits) {
  const suppliedSurface = input?.xsimDiagnosticsStatus ??
    input?.xsimDiagnostics?.statusSurface ??
    null;
  const suppliedSummary = input?.xsimDiagnosticsSummary ??
    input?.xsimDiagnostics?.summary ??
    null;
  const suppliedProblems = input?.xsimDiagnosticsProblems ??
    input?.xsimDiagnostics?.problemsPayload ??
    null;

  if (!suppliedSurface && !suppliedSummary && !suppliedProblems) {
    return missingXsimDiagnosticsContext();
  }

  try {
    const surface = suppliedSurface?.kind === "xsim-diagnostics-status-surface"
      ? suppliedSurface
      : createXsimDiagnosticsStatusSurface(suppliedSummary ?? suppliedProblems);
    const context = normalizeXsimDiagnosticsStatusSurface(surface, limits);
    assertXsimDiagnosticsContextSafety(context);
    return context;
  } catch (error) {
    return missingXsimDiagnosticsContext(
      "invalid",
      scrubText(error.message, limits.maxTextCharacters),
    );
  }
}

function runtimeReadinessSafetyBase() {
  return {
    dataOnly: true,
    readOnly: true,
    localOnly: true,
    launcherExecution: false,
    pccxLabExecution: false,
    pccxLabValidatorInvocation: false,
    shellExecution: false,
    fpgaRepoAccess: false,
    kv260RuntimeExecution: false,
    kv260Access: false,
    runtimeExecution: false,
    modelLoaded: false,
    modelExecution: false,
    modelWeightPathsIncluded: false,
    privatePathsIncluded: false,
    credentialDataIncluded: false,
    artifactBlobsIncluded: false,
    hardwareDumpsIncluded: false,
    writesArtifacts: false,
    providerCalls: false,
    networkCalls: false,
    mcpCalls: false,
    lspImplemented: false,
    marketplaceFlow: false,
    telemetry: false,
    automaticUpload: false,
    writeBack: false,
    stableApiAbiClaim: false,
  };
}

function missingRuntimeReadinessContext(status = "notAvailable", reason = "") {
  return {
    version: CONTEXT_BUNDLE_RUNTIME_READINESS_VERSION,
    kind: "runtime-readiness-context",
    status,
    summaryAvailable: false,
    source: {
      adapterOutput: false,
      rawReadinessParsedByUi: false,
    },
    fixture: null,
    target: null,
    readiness: null,
    states: null,
    blockers: {
      count: 0,
      items: [],
    },
    safety: runtimeReadinessSafetyBase(),
    reason,
  };
}

function normalizeRuntimeReadinessStatusSurface(surface, limits) {
  return {
    version: CONTEXT_BUNDLE_RUNTIME_READINESS_VERSION,
    kind: "runtime-readiness-context",
    status: scrubText(surface.readiness?.status ?? "available", 80),
    summaryAvailable: surface.readiness?.summaryAvailable === true,
    source: {
      adapterOutput: surface.source?.adapterOutput === true,
      rawReadinessParsedByUi: surface.source?.rawReadinessParsedByUi === true,
    },
    fixture: surface.fixture
      ? {
          schemaVersion: scrubText(surface.fixture.schemaVersion ?? "", 120),
          readinessId: scrubText(surface.fixture.readinessId ?? "", 160),
          fixtureVersion: scrubText(surface.fixture.fixtureVersion ?? "", 160),
          lastUpdatedSource: scrubText(surface.fixture.lastUpdatedSource ?? "", 160),
        }
      : null,
    target: surface.target
      ? {
          model: {
            modelId: scrubText(surface.target.model?.modelId ?? "", 160),
            modelFamily: scrubText(surface.target.model?.modelFamily ?? "", 80),
            modelVariant: scrubText(surface.target.model?.modelVariant ?? "", 80),
          },
          device: scrubText(surface.target.device ?? "", 80),
          board: scrubText(surface.target.board ?? "", 160),
        }
      : null,
    readiness: {
      statusAnswer: scrubText(surface.readiness?.statusAnswer ?? "", 120),
      readinessState: scrubText(surface.readiness?.readinessState ?? "", 80),
      evidenceState: scrubText(surface.readiness?.evidenceState ?? "", 80),
    },
    states: {
      timing: scrubText(surface.states?.timing ?? "", 80),
      bitstream: scrubText(surface.states?.bitstream ?? "", 80),
      implementation: scrubText(surface.states?.implementation ?? "", 80),
      kv260Smoke: scrubText(surface.states?.kv260Smoke ?? "", 80),
      runtimeEvidence: scrubText(surface.states?.runtimeEvidence ?? "", 80),
      throughput: scrubText(surface.states?.throughput ?? "", 80),
    },
    blockers: {
      count: Math.max(0, Math.floor(clampNumber(surface.blockers?.count))),
      items: Array.isArray(surface.blockers?.items)
        ? surface.blockers.items.map((item) => ({
            blockerId: scrubText(item.blockerId ?? "", 160),
            state: scrubText(item.state ?? "", 80),
            requiredBefore: scrubText(item.requiredBefore ?? "", 160),
            summary: scrubText(item.summary ?? "", 500),
          })).slice(0, 8)
        : [],
    },
    safety: {
      ...runtimeReadinessSafetyBase(),
      dataOnly: surface.safety?.dataOnly === true,
      readOnly: surface.safety?.readOnly === true,
      localOnly: surface.safety?.localOnly === true,
      launcherExecution: surface.safety?.launcherExecution === true,
      pccxLabExecution: surface.safety?.pccxLabExecution === true,
      pccxLabValidatorInvocation: surface.safety?.pccxLabValidatorInvocation === true,
      shellExecution: surface.safety?.shellExecution === true,
      fpgaRepoAccess: surface.safety?.fpgaRepoAccess === true,
      kv260RuntimeExecution: surface.safety?.kv260RuntimeExecution === true,
      kv260Access: surface.safety?.kv260Access === true,
      runtimeExecution: surface.safety?.runtimeExecution === true,
      modelLoaded: surface.safety?.modelLoaded === true,
      modelExecution: surface.safety?.modelExecution === true,
      modelWeightPathsIncluded: surface.safety?.modelWeightPathsIncluded === true,
      privatePathsIncluded: surface.safety?.privatePathsIncluded === true,
      credentialDataIncluded: surface.safety?.secretsIncluded === true ||
        surface.safety?.tokensIncluded === true,
      artifactBlobsIncluded: surface.safety?.artifactBlobsIncluded === true,
      hardwareDumpsIncluded: surface.safety?.hardwareDumpsIncluded === true,
      writesArtifacts: surface.safety?.writesArtifacts === true,
      providerCalls: surface.safety?.providerCalls === true,
      networkCalls: surface.safety?.networkCalls === true,
      mcpCalls: surface.safety?.mcpCalls === true,
      lspImplemented: surface.safety?.lspImplemented === true,
      marketplaceFlow: surface.safety?.marketplaceFlow === true,
      telemetry: surface.safety?.telemetry === true,
      automaticUpload: surface.safety?.automaticUpload === true,
      writeBack: surface.safety?.writeBack === true,
      stableApiAbiClaim: surface.safety?.stableApiAbiClaim === true,
    },
  };
}

function assertRuntimeReadinessContextSafety(context) {
  const safety = context.safety ?? {};
  if (
    safety.dataOnly !== true ||
    safety.readOnly !== true ||
    safety.launcherExecution === true ||
    safety.pccxLabExecution === true ||
    safety.pccxLabValidatorInvocation === true ||
    safety.shellExecution === true ||
    safety.fpgaRepoAccess === true ||
    safety.kv260RuntimeExecution === true ||
    safety.kv260Access === true ||
    safety.runtimeExecution === true ||
    safety.modelLoaded === true ||
    safety.modelExecution === true ||
    safety.modelWeightPathsIncluded === true ||
    safety.privatePathsIncluded === true ||
    safety.credentialDataIncluded === true ||
    safety.artifactBlobsIncluded === true ||
    safety.hardwareDumpsIncluded === true ||
    safety.writesArtifacts === true ||
    safety.providerCalls === true ||
    safety.networkCalls === true ||
    safety.mcpCalls === true ||
    safety.lspImplemented === true ||
    safety.marketplaceFlow === true ||
    safety.telemetry === true ||
    safety.automaticUpload === true ||
    safety.writeBack === true ||
    safety.stableApiAbiClaim === true ||
    context.source?.rawReadinessParsedByUi === true
  ) {
    throw new Error("runtime readiness context must remain data-only and read-only");
  }
}

function normalizeRuntimeReadinessContext(input, limits) {
  const suppliedSurface = input?.runtimeReadinessStatus ??
    input?.runtimeReadiness?.statusSurface ??
    null;
  const suppliedSummary = input?.runtimeReadinessSummary ??
    input?.runtimeReadiness?.consumerSummary ??
    null;

  if (!suppliedSurface && !suppliedSummary) {
    return missingRuntimeReadinessContext();
  }

  try {
    const surface = suppliedSurface?.kind === "runtime-readiness-status-surface"
      ? suppliedSurface
      : createRuntimeReadinessStatusSurface(suppliedSummary);
    const context = normalizeRuntimeReadinessStatusSurface(surface, limits);
    assertRuntimeReadinessContextSafety(context);
    return context;
  } catch (error) {
    return missingRuntimeReadinessContext(
      "invalid",
      scrubText(error.message, limits.maxTextCharacters),
    );
  }
}

function deviceSessionStatusSafetyBase() {
  return {
    dataOnly: true,
    readOnly: true,
    localOnly: true,
    launcherExecution: false,
    pccxLabExecution: false,
    pccxLabValidatorInvocation: false,
    systemverilogIdeExecution: false,
    shellExecution: false,
    touchesHardware: false,
    kv260Access: false,
    opensSerialPort: false,
    serialWrites: false,
    networkCalls: false,
    networkScan: false,
    sshExecution: false,
    authenticationAttempt: false,
    kv260RuntimeExecution: false,
    runtimeExecution: false,
    modelLoaded: false,
    modelExecution: false,
    modelWeightPathsIncluded: false,
    privatePathsIncluded: false,
    credentialDataIncluded: false,
    artifactBlobsIncluded: false,
    hardwareDumpsIncluded: false,
    providerCalls: false,
    mcpCalls: false,
    lspImplemented: false,
    marketplaceFlow: false,
    telemetry: false,
    automaticUpload: false,
    writeBack: false,
    writesArtifacts: false,
    firmwareFlashing: false,
    packageInstallation: false,
    stableApiAbiClaim: false,
  };
}

function missingDeviceSessionStatusContext(status = "notAvailable", reason = "") {
  return {
    version: CONTEXT_BUNDLE_DEVICE_SESSION_STATUS_VERSION,
    kind: "device-session-status-context",
    status,
    summaryAvailable: false,
    source: {
      adapterOutput: false,
      rawStatusParsedByUi: false,
    },
    fixture: null,
    target: null,
    deviceSession: null,
    states: null,
    statusPanel: {
      rowCount: 0,
      rows: [],
    },
    counts: {
      discoveryPaths: 0,
      flowSteps: 0,
      errors: 0,
      errorsBySeverity: {},
    },
    pccxLabDiagnostics: null,
    safety: deviceSessionStatusSafetyBase(),
    reason,
  };
}

function normalizeDeviceSessionStatusSurface(surface, limits) {
  return {
    version: CONTEXT_BUNDLE_DEVICE_SESSION_STATUS_VERSION,
    kind: "device-session-status-context",
    status: scrubText(surface.deviceSession?.status ?? "available", 80),
    summaryAvailable: surface.deviceSession?.summaryAvailable === true,
    source: {
      adapterOutput: surface.source?.adapterOutput === true,
      rawStatusParsedByUi: surface.source?.rawStatusParsedByUi === true,
    },
    fixture: surface.fixture
      ? {
          schemaVersion: scrubText(surface.fixture.schemaVersion ?? "", 120),
          statusId: scrubText(surface.fixture.statusId ?? "", 160),
          fixtureVersion: scrubText(surface.fixture.fixtureVersion ?? "", 160),
          lastUpdatedSource: scrubText(surface.fixture.lastUpdatedSource ?? "", 160),
        }
      : null,
    target: surface.target
      ? {
          device: scrubText(surface.target.device ?? "", 80),
          board: scrubText(surface.target.board ?? "", 160),
          model: scrubText(surface.target.model ?? "", 160),
        }
      : null,
    deviceSession: {
      statusAnswer: scrubText(surface.deviceSession?.statusAnswer ?? "", 120),
      readinessState: scrubText(surface.deviceSession?.readinessState ?? "", 80),
    },
    states: surface.states
      ? {
          connection: scrubText(surface.states.connection ?? "", 80),
          discovery: scrubText(surface.states.discovery ?? "", 80),
          authentication: scrubText(surface.states.authentication ?? "", 80),
          runtime: scrubText(surface.states.runtime ?? "", 80),
          modelLoad: scrubText(surface.states.modelLoad ?? "", 80),
          session: scrubText(surface.states.session ?? "", 80),
          logStream: scrubText(surface.states.logStream ?? "", 80),
          diagnostics: scrubText(surface.states.diagnostics ?? "", 80),
          readiness: scrubText(surface.states.readiness ?? "", 80),
        }
      : null,
    statusPanel: {
      rowCount: Math.max(0, Math.floor(clampNumber(surface.statusPanel?.rowCount))),
      rows: Array.isArray(surface.statusPanel?.rows)
        ? surface.statusPanel.rows.map((row) => ({
            rowId: scrubText(row.rowId ?? "", 160),
            label: scrubText(row.label ?? "", 160),
            state: scrubText(row.state ?? "", 80),
            summary: scrubText(row.summary ?? "", 500),
            nextAction: scrubText(row.nextAction ?? "", 500),
          })).slice(0, 8)
        : [],
    },
    counts: {
      discoveryPaths: Math.max(0, Math.floor(clampNumber(surface.counts?.discoveryPaths))),
      flowSteps: Math.max(0, Math.floor(clampNumber(surface.counts?.flowSteps))),
      errors: Math.max(0, Math.floor(clampNumber(surface.counts?.errors))),
      errorsBySeverity: normalizeCountMap(
        surface.counts?.errorsBySeverity,
        DEVICE_SESSION_ERROR_SEVERITIES,
      ),
    },
    pccxLabDiagnostics: surface.pccxLabDiagnostics
      ? {
          state: scrubText(surface.pccxLabDiagnostics.state ?? "", 80),
          mode: scrubText(surface.pccxLabDiagnostics.mode ?? "", 120),
          lowerBoundary: scrubText(surface.pccxLabDiagnostics.lowerBoundary ?? "", 160),
          automaticUpload: surface.pccxLabDiagnostics.automaticUpload === true,
          writeBack: surface.pccxLabDiagnostics.writeBack === true,
          executesPccxLab: surface.pccxLabDiagnostics.executesPccxLab === true,
        }
      : null,
    safety: {
      ...deviceSessionStatusSafetyBase(),
      dataOnly: surface.safety?.dataOnly === true,
      readOnly: surface.safety?.readOnly === true,
      localOnly: surface.safety?.localOnly === true,
      launcherExecution: surface.safety?.launcherExecution === true,
      pccxLabExecution: surface.safety?.pccxLabExecution === true,
      pccxLabValidatorInvocation: surface.safety?.pccxLabValidatorInvocation === true,
      systemverilogIdeExecution: surface.safety?.systemverilogIdeExecution === true,
      shellExecution: surface.safety?.shellExecution === true,
      touchesHardware: surface.safety?.touchesHardware === true,
      kv260Access: surface.safety?.kv260Access === true,
      opensSerialPort: surface.safety?.opensSerialPort === true,
      serialWrites: surface.safety?.serialWrites === true,
      networkCalls: surface.safety?.networkCalls === true,
      networkScan: surface.safety?.networkScan === true,
      sshExecution: surface.safety?.sshExecution === true,
      authenticationAttempt: surface.safety?.authenticationAttempt === true,
      kv260RuntimeExecution: surface.safety?.kv260RuntimeExecution === true,
      runtimeExecution: surface.safety?.runtimeExecution === true,
      modelLoaded: surface.safety?.modelLoaded === true,
      modelExecution: surface.safety?.modelExecution === true,
      modelWeightPathsIncluded: surface.safety?.modelWeightPathsIncluded === true,
      privatePathsIncluded: surface.safety?.privatePathsIncluded === true,
      credentialDataIncluded: surface.safety?.secretsIncluded === true ||
        surface.safety?.tokensIncluded === true,
      artifactBlobsIncluded: surface.safety?.artifactBlobsIncluded === true,
      hardwareDumpsIncluded: surface.safety?.hardwareDumpsIncluded === true,
      providerCalls: surface.safety?.providerCalls === true,
      mcpCalls: surface.safety?.mcpCalls === true,
      lspImplemented: surface.safety?.lspImplemented === true,
      marketplaceFlow: surface.safety?.marketplaceFlow === true,
      telemetry: surface.safety?.telemetry === true,
      automaticUpload: surface.safety?.automaticUpload === true,
      writeBack: surface.safety?.writeBack === true,
      writesArtifacts: surface.safety?.writesArtifacts === true,
      firmwareFlashing: surface.safety?.firmwareFlashing === true,
      packageInstallation: surface.safety?.packageInstallation === true,
      stableApiAbiClaim: surface.safety?.stableApiAbiClaim === true,
    },
  };
}

function assertDeviceSessionStatusContextSafety(context) {
  const safety = context.safety ?? {};
  if (
    safety.dataOnly !== true ||
    safety.readOnly !== true ||
    safety.launcherExecution === true ||
    safety.pccxLabExecution === true ||
    safety.pccxLabValidatorInvocation === true ||
    safety.systemverilogIdeExecution === true ||
    safety.shellExecution === true ||
    safety.touchesHardware === true ||
    safety.kv260Access === true ||
    safety.opensSerialPort === true ||
    safety.serialWrites === true ||
    safety.networkCalls === true ||
    safety.networkScan === true ||
    safety.sshExecution === true ||
    safety.authenticationAttempt === true ||
    safety.kv260RuntimeExecution === true ||
    safety.runtimeExecution === true ||
    safety.modelLoaded === true ||
    safety.modelExecution === true ||
    safety.modelWeightPathsIncluded === true ||
    safety.privatePathsIncluded === true ||
    safety.credentialDataIncluded === true ||
    safety.artifactBlobsIncluded === true ||
    safety.hardwareDumpsIncluded === true ||
    safety.providerCalls === true ||
    safety.mcpCalls === true ||
    safety.lspImplemented === true ||
    safety.marketplaceFlow === true ||
    safety.telemetry === true ||
    safety.automaticUpload === true ||
    safety.writeBack === true ||
    safety.writesArtifacts === true ||
    safety.firmwareFlashing === true ||
    safety.packageInstallation === true ||
    safety.stableApiAbiClaim === true ||
    context.source?.rawStatusParsedByUi === true ||
    context.pccxLabDiagnostics?.executesPccxLab === true ||
    context.pccxLabDiagnostics?.automaticUpload === true ||
    context.pccxLabDiagnostics?.writeBack === true
  ) {
    throw new Error("device/session status context must remain data-only and read-only");
  }
}

function normalizeDeviceSessionStatusContext(input, limits) {
  const suppliedSurface = input?.deviceSessionStatus ??
    input?.deviceSession?.statusSurface ??
    null;
  const suppliedSummary = input?.deviceSessionStatusSummary ??
    input?.deviceSession?.consumerSummary ??
    null;

  if (!suppliedSurface && !suppliedSummary) {
    return missingDeviceSessionStatusContext();
  }

  try {
    const surface = suppliedSurface?.kind === "device-session-status-surface"
      ? suppliedSurface
      : createDeviceSessionStatusSurface(suppliedSummary);
    const context = normalizeDeviceSessionStatusSurface(surface, limits);
    assertDeviceSessionStatusContextSafety(context);
    return context;
  } catch (error) {
    return missingDeviceSessionStatusContext(
      "invalid",
      scrubText(error.message, limits.maxTextCharacters),
    );
  }
}

export function buildContextBundle(input = {}, options = {}) {
  const limits = mergeLimits(options.limits);
  const workspaceRoot = options.workspaceRoot ?? input.workspaceRoot ?? null;
  const files = Array.isArray(input.files) ? input.files : [];
  const diagnostics = Array.isArray(input.activeDiagnostics) ? input.activeDiagnostics : [];
  const declarations = Array.isArray(input.symbolContext?.declarations)
    ? input.symbolContext.declarations
    : [];
  const pccxLabOutputs = Array.isArray(input.pccxLabOutputs) ? input.pccxLabOutputs : [];
  const selectedPath = normalizePathRef(input.selectedFilePath, workspaceRoot);
  const selectedRange = normalizeRange(input.selectedRange);
  const recentValidationHistory = normalizeRecentValidationHistory(
    input.recentValidationHistory,
    limits,
  );
  const recentValidation = normalizeRecentValidation(input.recentValidation, limits) ??
    recentValidationHistory[0] ??
    null;

  const snippets = sortedSnippets(
    files
      .map((file) => normalizeSnippet(file, workspaceRoot, limits))
      .filter(Boolean),
    selectedPath,
  ).slice(0, limits.maxFiles);

  return {
    version: CONTEXT_BUNDLE_VERSION,
    source: CONTEXT_BUNDLE_SOURCE,
    limits,
    configuration: normalizeConfiguration(input.configuration),
    selectedFile: selectedPath ? { path: selectedPath } : null,
    selectedRange,
    userIntent: scrubText(input.userIntent ?? "", limits.maxTextCharacters),
    diagnostics: sortedDiagnostics(
      diagnostics
        .map((diagnostic) => normalizeDiagnostic(diagnostic, workspaceRoot, limits))
        .filter(Boolean),
      selectedPath,
      selectedRange,
    ).slice(0, limits.maxDiagnostics),
    symbols: {
      selected: normalizeSelectedSymbol(input.selectedSymbol, workspaceRoot),
      selectedContext: normalizeSelectedSymbolContext(input.selectedSymbolContext, workspaceRoot, limits),
      declarations: sortedByPathAndName(
        declarations
          .map((declaration) => normalizeDeclaration(declaration, workspaceRoot, limits))
          .filter(Boolean),
      ).slice(0, limits.maxDeclarations),
    },
    snippets,
    validation: {
      recent: recentValidation,
      recentHistory: recentValidationHistory,
      historyPolicy: {
        maxResults: limits.maxRecentValidationResults,
        summaryOnly: true,
        fullLogsExcluded: true,
      },
    },
    recentCommand: normalizeRecentCommandStatus(input.recentCommandStatus, limits),
    pccxLab: {
      commandBoundary: "pccx_ide_cli",
      outputs: pccxLabOutputs
        .map((entry) => normalizeLogSummary(entry, limits))
        .slice(0, limits.maxFiles),
    },
    xsimDiagnostics: normalizeXsimDiagnosticsContext(input, limits),
    diagnosticsHandoff: normalizeDiagnosticsHandoffContext(input, limits),
    runtimeReadiness: normalizeRuntimeReadinessContext(input, limits),
    deviceSessionStatus: normalizeDeviceSessionStatusContext(input, limits),
    excludedPathSegments: [...EXCLUDED_PATH_SEGMENTS].sort(),
    excludedPathPatterns: [...EXCLUDED_PATH_PATTERNS],
    redaction: {
      assignmentPolicy: "secret-like-lines-redacted",
      absolutePaths: "workspaceRelativeOnly",
      privateInstructionPathsExcluded: true,
    },
  };
}

export function summarizeContextBundle(bundle) {
  return {
    version: bundle?.version ?? CONTEXT_BUNDLE_VERSION,
    selectedFile: bundle?.selectedFile ?? null,
    selectedSymbol: bundle?.symbols?.selected
      ? {
          name: bundle.symbols.selected.name,
          kind: bundle.symbols.selected.kind,
          path: bundle.symbols.selected.path,
        }
      : null,
    diagnosticCount: Array.isArray(bundle?.diagnostics) ? bundle.diagnostics.length : 0,
    snippetCount: Array.isArray(bundle?.snippets) ? bundle.snippets.length : 0,
    declarationCount: Array.isArray(bundle?.symbols?.declarations)
      ? bundle.symbols.declarations.length
      : 0,
    pccxLabOutputCount: Array.isArray(bundle?.pccxLab?.outputs)
      ? bundle.pccxLab.outputs.length
      : 0,
    validation: bundle?.validation?.recent
      ? {
          proposalId: bundle.validation.recent.proposalId,
          status: bundle.validation.recent.status,
          label: bundle.validation.recent.label,
          recentHistoryCount: Array.isArray(bundle.validation.recentHistory)
            ? bundle.validation.recentHistory.length
            : 0,
      }
      : null,
    xsimDiagnostics: bundle?.xsimDiagnostics?.summaryAvailable
      ? {
          status: bundle.xsimDiagnostics.status,
          sourceKind: bundle.xsimDiagnostics.xsimLog?.sourceKind ?? "",
          diagnosticCount: bundle.xsimDiagnostics.diagnostics?.count ?? 0,
          errorCount: bundle.xsimDiagnostics.diagnostics?.bySeverity?.error ?? 0,
          warningCount: bundle.xsimDiagnostics.diagnostics?.bySeverity?.warning ?? 0,
          locatedCount: bundle.xsimDiagnostics.diagnostics?.locatedCount ?? 0,
          readOnly: bundle.xsimDiagnostics.safety?.readOnly === true,
        }
      : {
          status: bundle?.xsimDiagnostics?.status ?? "notAvailable",
          diagnosticCount: 0,
          readOnly: bundle?.xsimDiagnostics?.safety?.readOnly === true,
        },
    diagnosticsHandoff: bundle?.diagnosticsHandoff?.summaryAvailable
      ? {
          status: bundle.diagnosticsHandoff.status,
          schemaVersion: bundle.diagnosticsHandoff.handoff?.schemaVersion ?? "",
          diagnosticCount: bundle.diagnosticsHandoff.diagnostics?.count ?? 0,
          blockedCount: bundle.diagnosticsHandoff.diagnostics?.bySeverity?.blocked ?? 0,
          readOnly: bundle.diagnosticsHandoff.safety?.readOnly === true,
        }
      : {
          status: bundle?.diagnosticsHandoff?.status ?? "notAvailable",
          diagnosticCount: 0,
          readOnly: bundle?.diagnosticsHandoff?.safety?.readOnly === true,
        },
    runtimeReadiness: bundle?.runtimeReadiness?.summaryAvailable
      ? {
          status: bundle.runtimeReadiness.status,
          statusAnswer: bundle.runtimeReadiness.readiness?.statusAnswer ?? "",
          readinessState: bundle.runtimeReadiness.readiness?.readinessState ?? "",
          evidenceState: bundle.runtimeReadiness.readiness?.evidenceState ?? "",
          targetDevice: bundle.runtimeReadiness.target?.device ?? "",
          blockerCount: bundle.runtimeReadiness.blockers?.count ?? 0,
          readOnly: bundle.runtimeReadiness.safety?.readOnly === true,
        }
      : {
          status: bundle?.runtimeReadiness?.status ?? "notAvailable",
          blockerCount: 0,
          readOnly: bundle?.runtimeReadiness?.safety?.readOnly === true,
        },
    deviceSessionStatus: bundle?.deviceSessionStatus?.summaryAvailable
      ? {
          status: bundle.deviceSessionStatus.status,
          statusAnswer: bundle.deviceSessionStatus.deviceSession?.statusAnswer ?? "",
          connectionState: bundle.deviceSessionStatus.states?.connection ?? "",
          sessionState: bundle.deviceSessionStatus.states?.session ?? "",
          readinessState: bundle.deviceSessionStatus.states?.readiness ?? "",
          targetDevice: bundle.deviceSessionStatus.target?.device ?? "",
          statusRowCount: bundle.deviceSessionStatus.statusPanel?.rowCount ?? 0,
          errorCount: bundle.deviceSessionStatus.counts?.errors ?? 0,
          readOnly: bundle.deviceSessionStatus.safety?.readOnly === true,
        }
      : {
          status: bundle?.deviceSessionStatus?.status ?? "notAvailable",
          statusRowCount: 0,
          readOnly: bundle?.deviceSessionStatus?.safety?.readOnly === true,
        },
  };
}
