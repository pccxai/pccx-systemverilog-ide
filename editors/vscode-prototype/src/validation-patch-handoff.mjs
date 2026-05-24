// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import { isAbsolute, relative } from "node:path";

export const VALIDATION_PATCH_HANDOFF_VERSION = "pccx.validationPatchHandoff.v0";

export const VALIDATION_PATCH_HANDOFF_LIMITS = Object.freeze({
  maxFailureSummaryCharacters: 800,
  maxDiagnosticMessageCharacters: 300,
  maxDiagnostics: 5,
  maxCandidateFiles: 5,
  maxValidationPlanItems: 5,
});

const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b\s*[:=]/i;
const SECRET_LIKE_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b/i;
const HOME_PATH_PATTERN = /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+)/g;
const PRIVATE_PATH_PATTERN =
  /(?:^|\/)(?:\.git|\.private-agent|\.vscode-test|node_modules|private[-_ ]?worker|worker[-_ ]?instruction|subagent[-_ ]?instruction)(?:\/|$)/i;
const GENERATED_PATH_PATTERN =
  /(?:^|\/)(?:dist|build|coverage|out|target|\.pytest_cache|__pycache__)(?:\/|$)/i;
const GENERATED_FILE_PATTERN =
  /(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|AGENTS\.md)$/i;

function mergeLimits(limits = {}) {
  return {
    ...VALIDATION_PATCH_HANDOFF_LIMITS,
    ...Object.fromEntries(
      Object.entries(limits).filter(([, value]) => Number.isInteger(value) && value >= 0),
    ),
  };
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function scrubText(value, maxCharacters) {
  if (typeof value !== "string" || value.length === 0 || maxCharacters === 0) {
    return "";
  }
  return value
    .split(/\r?\n/)
    .map((line) => (SECRET_ASSIGNMENT_PATTERN.test(line) ? "[redacted]" : line))
    .join("\n")
    .replace(HOME_PATH_PATTERN, "[home]")
    .slice(0, maxCharacters);
}

function normalizeWorkspacePath(workspaceRoot) {
  if (typeof workspaceRoot !== "string" || workspaceRoot.trim().length === 0) {
    return null;
  }
  return workspaceRoot.replace(/\\/g, "/").replace(/\/+$/, "");
}

function normalizePathRef(path, workspaceRoot = null) {
  if (typeof path !== "string" || path.trim().length === 0) {
    return null;
  }
  if (path.includes("\0") || path.includes("\n") || path.includes("\r")) {
    return null;
  }
  let normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  const root = normalizeWorkspacePath(workspaceRoot);

  if (isAbsolute(normalized)) {
    if (!root) {
      return null;
    }
    const rel = relative(root, normalized).replace(/\\/g, "/");
    if (rel.startsWith("../") || rel === ".." || isAbsolute(rel)) {
      return null;
    }
    normalized = rel;
  }

  if (
    normalized === "" ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    PRIVATE_PATH_PATTERN.test(normalized) ||
    GENERATED_PATH_PATTERN.test(normalized) ||
    GENERATED_FILE_PATTERN.test(normalized) ||
    SECRET_LIKE_PATTERN.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function normalizeRange(range) {
  if (!range || typeof range !== "object") {
    return null;
  }
  const start = {
    line: Math.max(0, Math.floor(finiteNumber(range.start?.line))),
    character: Math.max(0, Math.floor(finiteNumber(range.start?.character))),
  };
  const end = {
    line: Math.max(0, Math.floor(finiteNumber(range.end?.line))),
    character: Math.max(0, Math.floor(finiteNumber(range.end?.character))),
  };
  if (
    end.line < start.line ||
    (end.line === start.line && end.character < start.character)
  ) {
    return { start, end: { ...start } };
  }
  return { start, end };
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
    message: scrubText(diagnostic.message ?? "", limits.maxDiagnosticMessageCharacters),
    source: scrubText(diagnostic.source ?? "", 120),
    code: scrubText(diagnostic.code ?? "", 120),
  };
}

function sortedByPathAndMessage(items) {
  return [...items].sort((a, b) => {
    const pathOrder = String(a.path ?? "").localeCompare(String(b.path ?? ""));
    if (pathOrder !== 0) {
      return pathOrder;
    }
    return String(a.message ?? "").localeCompare(String(b.message ?? ""));
  });
}

function outputLines(summary) {
  return Array.isArray(summary?.lines) ? summary.lines : [];
}

function failureSummary(validation, limits) {
  const sourceLines = [
    validation.summaryText ?? validation.summary ?? "",
    ...(Array.isArray(validation.failureHints) ? validation.failureHints : []),
    ...outputLines(validation.stderrSummary),
    ...outputLines(validation.stdoutSummary).filter((line) => (
      /error|failed|failure|traceback|timed out|timeout|blocked/i.test(String(line ?? ""))
    )),
  ].filter(Boolean);
  const text = sourceLines.join("\n");
  return scrubText(text, limits.maxFailureSummaryCharacters);
}

function suggestedValidationPlan(validation) {
  const proposalId = typeof validation?.proposalId === "string" && validation.proposalId
    ? validation.proposalId
    : "";
  if (!proposalId) {
    return ["Re-run the relevant approved validation proposal after user-reviewed changes."];
  }
  return [`Re-run ${proposalId} through the approved validation proposal after user-reviewed changes.`];
}

function candidateFilesFromDiagnostics(diagnostics, limits) {
  const seen = new Set();
  const files = [];
  for (const diagnostic of diagnostics) {
    if (!seen.has(diagnostic.path)) {
      seen.add(diagnostic.path);
      files.push(diagnostic.path);
    }
    if (files.length >= limits.maxCandidateFiles) {
      break;
    }
  }
  return files;
}

function statusAllowsHandoff(status) {
  return status !== "passed" && status !== "ok" && status !== "success";
}

export function createValidationPatchHandoffSeed(validation = {}, context = {}, options = {}) {
  const status = typeof validation?.status === "string" && validation.status
    ? validation.status
    : "unknown";
  if (!statusAllowsHandoff(status)) {
    return null;
  }

  const limits = mergeLimits(options.limits);
  const workspaceRoot = options.workspaceRoot ?? context.workspaceRoot ?? null;
  const relatedDiagnostics = sortedByPathAndMessage(
    (Array.isArray(context.relatedDiagnostics)
      ? context.relatedDiagnostics
      : Array.isArray(context.diagnostics)
        ? context.diagnostics
        : [])
      .map((diagnostic) => normalizeDiagnostic(diagnostic, workspaceRoot, limits))
      .filter(Boolean),
  ).slice(0, limits.maxDiagnostics);
  const explicitCandidateFiles = Array.isArray(context.candidateFiles)
    ? context.candidateFiles
      .map((path) => normalizePathRef(path, workspaceRoot))
      .filter(Boolean)
    : [];
  const candidateFiles = [
    ...new Set([
      ...explicitCandidateFiles,
      ...candidateFilesFromDiagnostics(relatedDiagnostics, limits),
    ]),
  ].slice(0, limits.maxCandidateFiles);

  return {
    version: VALIDATION_PATCH_HANDOFF_VERSION,
    kind: "validation-patch-context-seed",
    validationProposalId: scrubText(validation.proposalId ?? "", 120),
    validationStatus: scrubText(status, 80),
    boundedFailureSummary: failureSummary(validation, limits),
    relatedDiagnostics,
    candidateFiles,
    suggestedValidationPlan: suggestedValidationPlan(validation)
      .map((item) => scrubText(item, 300))
      .slice(0, limits.maxValidationPlanItems),
    safety: {
      summaryOnly: true,
      fullLogsExcluded: true,
      generatesPatch: false,
      appliesPatch: false,
      writesFiles: false,
      providerCalls: false,
      runtimeCalls: false,
      launcherCalls: false,
      pccxLabExecution: false,
    },
    sourceFlags: {
      validationRedactionApplied: validation.redactionApplied === true,
      validationTruncated: validation.truncated === true ||
        validation.stdoutSummary?.truncated === true ||
        validation.stderrSummary?.truncated === true,
    },
  };
}

export function createValidationPatchHandoffStatus() {
  return {
    version: VALIDATION_PATCH_HANDOFF_VERSION,
    proposalOnly: true,
    contextSeedOnly: true,
    generatesPatch: false,
    appliesPatch: false,
    writesFiles: false,
    providerCalls: false,
    runtimeCalls: false,
    launcherCalls: false,
    pccxLabExecution: false,
  };
}
