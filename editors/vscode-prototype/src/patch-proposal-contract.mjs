// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import { isAbsolute } from "node:path";

export const PATCH_PROPOSAL_CONTRACT_VERSION = "pccx.patchProposalContract.v0";
export const PATCH_PROPOSAL_SCHEMA_VERSION = 1;
export const PATCH_PROPOSAL_SOURCE = "local-prototype";

export const PATCH_PROPOSAL_RISK_LEVELS = Object.freeze(["low", "medium", "high"]);
export const PATCH_PROPOSAL_CHANGE_KINDS = Object.freeze(["modify", "add", "delete", "rename"]);

export const PATCH_PROPOSAL_LIMITS = Object.freeze({
  maxTitleCharacters: 160,
  maxSummaryCharacters: 800,
  maxReasonCharacters: 500,
  maxListItemCharacters: 300,
  maxFiles: 8,
  maxHunksPerFile: 16,
  maxPreviewCharacters: 1200,
  maxPreviewLines: 40,
  maxValidationPlanItems: 8,
  maxNonGoals: 8,
});

const TOP_LEVEL_KEYS = new Set([
  "version",
  "proposalId",
  "source",
  "title",
  "summary",
  "riskLevel",
  "files",
  "validationPlan",
  "nonGoals",
  "requiresUserReview",
]);

const FILE_KEYS = new Set([
  "path",
  "changeKind",
  "reason",
  "hunks",
]);

const HUNK_KEYS = new Set([
  "oldStart",
  "oldLines",
  "newStart",
  "newLines",
  "preview",
]);

const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b\s*[:=]/i;
const SECRET_LIKE_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b/i;
const HOME_PATH_PATTERN = /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+)/;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const SHELL_CONTROL_PATTERN = /(?:&&|\|\||;|`|\$\(|>|<)/;
const SHELL_COMMAND_PATTERN =
  /\b(?:bash|sh|zsh|fish|python|python3|node|npm|pnpm|yarn|git|gh|rm|mv|cp|curl|wget|make)\s+[^\n]+/i;
const PRIVATE_PATH_PATTERN =
  /(?:^|\/)(?:\.git|\.private-agent|\.vscode-test|node_modules|private[-_ ]?worker|worker[-_ ]?instruction|subagent[-_ ]?instruction)(?:\/|$)/i;
const GENERATED_PATH_PATTERN =
  /(?:^|\/)(?:dist|build|coverage|out|target|\.pytest_cache|__pycache__)(?:\/|$)/i;
const GENERATED_FILE_PATTERN =
  /(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|AGENTS\.md)$/i;
const MODEL_OR_BINARY_ARTIFACT_PATTERN =
  /\.(?:bit|bin|elf|onnx|pt|pth|safetensors|xclbin|zip|tar|tgz|gz)$/i;

function mergeLimits(limits = {}) {
  return {
    ...PATCH_PROPOSAL_LIMITS,
    ...Object.fromEntries(
      Object.entries(limits).filter(([, value]) => Number.isInteger(value) && value >= 0),
    ),
  };
}

function addError(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function unknownKeys(value, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value).filter((key) => !allowedKeys.has(key));
}

function boundedString(value, path, errors, maxCharacters, options = {}) {
  if (typeof value !== "string" || value.trim().length === 0) {
    addError(errors, path, "must be a non-empty string");
    return "";
  }
  if (value.includes("\0")) {
    addError(errors, path, "must not contain NUL bytes");
    return "";
  }
  if (value.length > maxCharacters) {
    addError(errors, path, `must be at most ${maxCharacters} characters`);
    return "";
  }
  if (SECRET_ASSIGNMENT_PATTERN.test(value)) {
    addError(errors, path, "must not include secret-like assignments");
  }
  if (HOME_PATH_PATTERN.test(value)) {
    addError(errors, path, "must not include private absolute home paths");
  }
  if (options.rejectShellCommands !== false && (
    SHELL_CONTROL_PATTERN.test(value) ||
    SHELL_COMMAND_PATTERN.test(value)
  )) {
    addError(errors, path, "must not include shell commands");
  }
  return value;
}

function boundedStringList(value, path, errors, maxItems, maxCharacters) {
  if (!Array.isArray(value)) {
    addError(errors, path, "must be an array");
    return [];
  }
  if (value.length > maxItems) {
    addError(errors, path, `must contain at most ${maxItems} item(s)`);
  }
  return value.slice(0, maxItems).map((item, index) => (
    boundedString(item, `${path}[${index}]`, errors, maxCharacters)
  ));
}

function normalizeRelativePath(value, path, errors) {
  if (typeof value !== "string" || value.trim().length === 0) {
    addError(errors, path, "must be a non-empty relative path");
    return "";
  }
  if (value.includes("\0") || value.includes("\n") || value.includes("\r")) {
    addError(errors, path, "must be a single-line relative path");
    return "";
  }
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "");
  if (
    isAbsolute(normalized) ||
    WINDOWS_ABSOLUTE_PATH_PATTERN.test(value) ||
    normalized === "" ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    addError(errors, path, "must be relative to the repository");
  }
  if (
    PRIVATE_PATH_PATTERN.test(normalized) ||
    GENERATED_PATH_PATTERN.test(normalized) ||
    GENERATED_FILE_PATTERN.test(normalized) ||
    MODEL_OR_BINARY_ARTIFACT_PATTERN.test(normalized) ||
    SECRET_LIKE_PATTERN.test(normalized)
  ) {
    addError(errors, path, "must not target private, derived, secret-like, or binary artifact paths");
  }
  return normalized;
}

function integerField(value, path, errors, min = 0) {
  if (!Number.isInteger(value) || value < min) {
    addError(errors, path, `must be an integer >= ${min}`);
    return min;
  }
  return value;
}

function normalizeHunk(hunk, path, errors, limits) {
  if (!hunk || typeof hunk !== "object" || Array.isArray(hunk)) {
    addError(errors, path, "must be an object");
    return null;
  }
  for (const key of unknownKeys(hunk, HUNK_KEYS)) {
    addError(errors, `${path}.${key}`, "is not allowed in patch proposals");
  }
  const preview = boundedString(
    hunk.preview ?? "",
    `${path}.preview`,
    errors,
    limits.maxPreviewCharacters,
    { rejectShellCommands: false },
  );
  if (preview.split(/\r?\n/).length > limits.maxPreviewLines) {
    addError(errors, `${path}.preview`, `must contain at most ${limits.maxPreviewLines} line(s)`);
  }
  if (SECRET_ASSIGNMENT_PATTERN.test(preview) || HOME_PATH_PATTERN.test(preview)) {
    addError(errors, `${path}.preview`, "must stay redacted and path-safe");
  }
  return {
    oldStart: integerField(hunk.oldStart, `${path}.oldStart`, errors, 1),
    oldLines: integerField(hunk.oldLines, `${path}.oldLines`, errors, 0),
    newStart: integerField(hunk.newStart, `${path}.newStart`, errors, 1),
    newLines: integerField(hunk.newLines, `${path}.newLines`, errors, 0),
    preview,
  };
}

function normalizeFile(file, path, errors, limits) {
  if (!file || typeof file !== "object" || Array.isArray(file)) {
    addError(errors, path, "must be an object");
    return null;
  }
  for (const key of unknownKeys(file, FILE_KEYS)) {
    addError(errors, `${path}.${key}`, "is not allowed in patch proposals");
  }
  const changeKind = file.changeKind;
  if (!PATCH_PROPOSAL_CHANGE_KINDS.includes(changeKind)) {
    addError(errors, `${path}.changeKind`, `must be one of: ${PATCH_PROPOSAL_CHANGE_KINDS.join(", ")}`);
  }
  const hunks = Array.isArray(file.hunks) ? file.hunks : [];
  if (!Array.isArray(file.hunks)) {
    addError(errors, `${path}.hunks`, "must be an array");
  }
  if (hunks.length > limits.maxHunksPerFile) {
    addError(errors, `${path}.hunks`, `must contain at most ${limits.maxHunksPerFile} hunk(s)`);
  }
  return {
    path: normalizeRelativePath(file.path, `${path}.path`, errors),
    changeKind: PATCH_PROPOSAL_CHANGE_KINDS.includes(changeKind) ? changeKind : "modify",
    reason: boundedString(file.reason ?? "", `${path}.reason`, errors, limits.maxReasonCharacters),
    hunks: hunks
      .slice(0, limits.maxHunksPerFile)
      .map((hunk, index) => normalizeHunk(hunk, `${path}.hunks[${index}]`, errors, limits))
      .filter(Boolean),
  };
}

export function normalizePatchProposal(proposal = {}, options = {}) {
  const limits = mergeLimits(options.limits);
  const errors = [];

  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    throw new Error("patch proposal must be an object");
  }
  for (const key of unknownKeys(proposal, TOP_LEVEL_KEYS)) {
    addError(errors, key, "is not allowed in patch proposals");
  }
  if (proposal.version !== PATCH_PROPOSAL_SCHEMA_VERSION) {
    addError(errors, "version", `must be ${PATCH_PROPOSAL_SCHEMA_VERSION}`);
  }
  if (proposal.source !== PATCH_PROPOSAL_SOURCE) {
    addError(errors, "source", `must be ${PATCH_PROPOSAL_SOURCE}`);
  }
  if (!PATCH_PROPOSAL_RISK_LEVELS.includes(proposal.riskLevel)) {
    addError(errors, "riskLevel", `must be one of: ${PATCH_PROPOSAL_RISK_LEVELS.join(", ")}`);
  }
  if (proposal.requiresUserReview !== true) {
    addError(errors, "requiresUserReview", "must be true");
  }
  const files = Array.isArray(proposal.files) ? proposal.files : [];
  if (!Array.isArray(proposal.files)) {
    addError(errors, "files", "must be an array");
  }
  if (files.length === 0) {
    addError(errors, "files", "must contain at least one file");
  }
  if (files.length > limits.maxFiles) {
    addError(errors, "files", `must contain at most ${limits.maxFiles} file(s)`);
  }

  const normalized = {
    version: PATCH_PROPOSAL_SCHEMA_VERSION,
    proposalId: boundedString(proposal.proposalId ?? "", "proposalId", errors, 120),
    source: PATCH_PROPOSAL_SOURCE,
    title: boundedString(proposal.title ?? "", "title", errors, limits.maxTitleCharacters),
    summary: boundedString(proposal.summary ?? "", "summary", errors, limits.maxSummaryCharacters),
    riskLevel: PATCH_PROPOSAL_RISK_LEVELS.includes(proposal.riskLevel)
      ? proposal.riskLevel
      : "medium",
    files: files
      .slice(0, limits.maxFiles)
      .map((file, index) => normalizeFile(file, `files[${index}]`, errors, limits))
      .filter(Boolean),
    validationPlan: boundedStringList(
      proposal.validationPlan,
      "validationPlan",
      errors,
      limits.maxValidationPlanItems,
      limits.maxListItemCharacters,
    ),
    nonGoals: boundedStringList(
      proposal.nonGoals,
      "nonGoals",
      errors,
      limits.maxNonGoals,
      limits.maxListItemCharacters,
    ),
    requiresUserReview: true,
  };

  if (errors.length > 0) {
    throw new Error(`invalid patch proposal: ${errors.join("; ")}`);
  }
  return normalized;
}

export function validatePatchProposal(proposal = {}, options = {}) {
  try {
    return {
      ok: true,
      proposal: normalizePatchProposal(proposal, options),
      errors: [],
    };
  } catch (error) {
    return {
      ok: false,
      proposal: null,
      errors: error.message.replace(/^invalid patch proposal: /, "").split("; "),
    };
  }
}

export function createPatchProposalContractStatus() {
  return {
    version: PATCH_PROPOSAL_CONTRACT_VERSION,
    schemaVersion: PATCH_PROPOSAL_SCHEMA_VERSION,
    source: PATCH_PROPOSAL_SOURCE,
    proposalOnly: true,
    appliesPatches: false,
    writesFiles: false,
    providerCalls: false,
    runtimeCalls: false,
    requiresUserReview: true,
    allowedChangeKinds: [...PATCH_PROPOSAL_CHANGE_KINDS],
    allowedRiskLevels: [...PATCH_PROPOSAL_RISK_LEVELS],
    disallowedActions: [
      "applyPatch",
      "writeFile",
      "executeCommand",
      "spawnProcess",
      "providerCall",
      "launcherCall",
      "mcpCall",
      "release",
      "tag",
      "changeRuleset",
      "accessSecrets",
    ],
  };
}
