// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMMAND_IDS,
  CONFIG_KEYS,
  CONFIG_SECTION,
  FACADE_COMMAND_IDS,
  assertKnownCommandId,
  isFacadeCommandId,
  buildFacadeArgsForCommand,
  defaultConfig,
  isLiveFacadeArgs,
  normalizeConfig,
} from "./config.mjs";
import {
  createCommandExecutionPlan,
  runPrototypeCommand,
} from "./command-handlers.mjs";
import {
  presentAction,
} from "./presenter.mjs";
import {
  createNavigationLocationRecords,
} from "./navigation-locations.mjs";
import {
  registerCheckedExampleDefinitionProvider,
} from "./definition-provider.mjs";
import {
  createWorkflowBoundaryStatus,
  createWorkflowContextRequest,
} from "./workflow-boundary.mjs";
import {
  buildSelectedSymbolContext,
} from "./selected-symbol-context.mjs";
import {
  createValidationCommandProposal,
  listValidationCommandProposals,
} from "./validation-proposals.mjs";
import {
  createValidationProposalPreflightAudit,
  formatValidationProposalPreflightAudit,
} from "./validation-proposal-preflight-audit.mjs";
import {
  runApprovedValidationProposal,
} from "./approved-validation-runner.mjs";
import {
  createValidationResultCache,
  formatValidationResultCacheEntry,
  formatValidationResultCacheStatus,
} from "./validation-result-cache.mjs";
import {
  createPccxLabBackendStatus,
} from "./pccx-lab-status.mjs";
import {
  createPatchProposalPreview,
  listCheckedPatchProposals,
} from "./patch-proposal-preview.mjs";
import {
  createLocalWorkflowStatus,
  formatLocalWorkflowStatus,
} from "./local-workflow-status.mjs";
import {
  createContextBundleAudit,
  formatContextBundleAudit,
} from "./context-bundle-audit.mjs";
import {
  createDiagnosticsHandoffStatusSurface,
  formatDiagnosticsHandoffStatusSurface,
} from "./diagnostics-handoff-status-surface.mjs";
import {
  createKv260StatusPanel,
  formatKv260StatusPanel,
  parseKv260PreflightTranscript,
  renderKv260StatusPanelHtml,
} from "./kv260-status-panel.mjs";

const EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DIAGNOSTIC_FILE_ROOT = resolve(EXTENSION_ROOT, "../..");
const DEFAULT_NAVIGATION_FILE_ROOT = DEFAULT_DIAGNOSTIC_FILE_ROOT;
const DEFAULT_FACADE_PATH = resolve(EXTENSION_ROOT, "bin/pccx-vscode-prototype.mjs");
const OUTPUT_CHANNEL_NAME = "PCCX SystemVerilog IDE Prototype";
const VALIDATION_OUTPUT_CHANNEL_NAME = "PCCX SystemVerilog Validation Results";
export const CHECKED_EXAMPLE_NAVIGATION_COMMAND =
  "pccxSystemVerilog.showCheckedExampleNavigation";
export const LIVE_WORKSPACE_NAVIGATION_COMMAND =
  "pccxSystemVerilog.showLiveWorkspaceNavigation";
export const RUN_LIVE_NAVIGATION_COMMAND =
  "pccxSystemVerilog.runNavigationLive";
export const WORKFLOW_BOUNDARY_STATUS_COMMAND =
  "pccxSystemVerilog.showWorkflowBoundaryStatus";
export const WORKFLOW_CONTEXT_BUNDLE_COMMAND =
  "pccxSystemVerilog.buildWorkflowContextBundle";
export const VALIDATION_PROPOSAL_COMMAND =
  "pccxSystemVerilog.proposeValidationCommand";
export const AUDIT_VALIDATION_PREFLIGHT_COMMAND =
  "pccxSystemVerilog.auditValidationProposalPreflight";
export const APPROVED_VALIDATION_RUNNER_COMMAND =
  "pccxSystemVerilog.runApprovedValidationCommand";
export const SHOW_RECENT_VALIDATION_RESULTS_COMMAND =
  "pccxSystemVerilog.showRecentValidationResults";
export const SHOW_VALIDATION_CACHE_STATUS_COMMAND =
  "pccxSystemVerilog.showValidationCacheStatus";
export const CLEAR_VALIDATION_RESULT_CACHE_COMMAND =
  "pccxSystemVerilog.clearValidationResultCache";
export const SHOW_PATCH_PROPOSAL_PREVIEW_COMMAND =
  "pccxSystemVerilog.showPatchProposalPreview";
export const CLEAR_PATCH_PROPOSAL_PREVIEW_COMMAND =
  "pccxSystemVerilog.clearPatchProposalPreview";
export const SHOW_LOCAL_WORKFLOW_STATUS_COMMAND =
  "pccxSystemVerilog.showLocalWorkflowStatus";
export const SHOW_CONTEXT_BUNDLE_AUDIT_COMMAND =
  "pccxSystemVerilog.showContextBundleAudit";
export const PCCX_LAB_BACKEND_STATUS_COMMAND =
  "pccxSystemVerilog.showPccxLabBackendStatus";
export const SHOW_DIAGNOSTICS_HANDOFF_SUMMARY_COMMAND =
  "pccxSystemVerilog.showDiagnosticsHandoffSummary";
export const SHOW_KV260_STATUS_PANEL_COMMAND =
  "pccxSystemVerilog.showKv260StatusPanel";

const NAVIGATION_LOCATION_COMMAND_IDS = Object.freeze([
  CHECKED_EXAMPLE_NAVIGATION_COMMAND,
  LIVE_WORKSPACE_NAVIGATION_COMMAND,
  RUN_LIVE_NAVIGATION_COMMAND,
]);

export {
  COMMAND_IDS,
  FACADE_COMMAND_IDS,
  buildFacadeArgsForCommand,
  createNavigationLocationRecords,
  createCommandExecutionPlan,
  defaultConfig,
  normalizeConfig,
  presentAction,
  runPrototypeCommand,
};

function pathFromCommandInput(input) {
  if (typeof input === "string") {
    return input;
  }
  if (input?.fsPath) {
    return input.fsPath;
  }
  if (input?.uri?.fsPath) {
    return input.uri.fsPath;
  }
  return null;
}

export function buildFacadeInvocationForCommand(commandId, options = {}, runtime = {}) {
  const config = normalizeConfig(options);
  const facadeArgs = buildFacadeArgsForCommand(commandId, config);
  const invocation = {
    executable: runtime.nodeExecutable ?? process.execPath,
    args: [
      runtime.facadePath ?? DEFAULT_FACADE_PATH,
      ...facadeArgs,
    ],
    shell: false,
  };

  if (isLiveFacadeArgs(facadeArgs)) {
    invocation.env = { PCCX_IDE_PYTHON: config.pythonPath };
  }

  return invocation;
}

function mergedEnv(invocation, runtime) {
  if (!invocation.env && !runtime.env) {
    return process.env;
  }
  return {
    ...process.env,
    ...(invocation.env ?? {}),
    ...(runtime.env ?? {}),
  };
}

function captureExecFile(executable, args, options = {}) {
  const execFileFn = options.execFile ?? execFile;
  return new Promise((resolveResult) => {
    execFileFn(
      executable,
      args,
      {
        cwd: options.cwd ?? EXTENSION_ROOT,
        encoding: "utf8",
        env: options.env ?? process.env,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const exitCode = error ? (typeof error.code === "number" ? error.code : null) : 0;
        resolveResult({
          ok: exitCode === 0 && !error,
          exitCode,
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          error: error && typeof error.code !== "number" ? error.message : undefined,
        });
      },
    );
  });
}

export async function runFacadeInvocation(invocation, runtime = {}) {
  const result = await captureExecFile(invocation.executable, invocation.args, {
    ...runtime,
    env: mergedEnv(invocation, runtime),
  });
  if (result.ok && result.stdout.trim()) {
    try {
      result.json = JSON.parse(result.stdout);
    } catch (error) {
      result.ok = false;
      result.error = `failed to parse facade JSON stdout: ${error.message}`;
    }
  }
  return result;
}

export function readExtensionConfig(vscodeApi) {
  return normalizeConfig(readRawExtensionConfig(vscodeApi));
}

function readRawExtensionConfig(vscodeApi) {
  const settings = vscodeApi?.workspace?.getConfiguration?.(CONFIG_SECTION);
  if (!settings?.get) {
    return defaultConfig();
  }

  return Object.fromEntries(
    CONFIG_KEYS.map((key) => [key, settings.get(key)]),
  );
}

export function resolveCommandRequest(commandId, input, vscodeApi, rawConfig = readExtensionConfig(vscodeApi)) {
  const config = normalizeConfig(rawConfig);
  const explicitPath = pathFromCommandInput(input);
  const commandConfig = commandId === "pccxSystemVerilog.runDiagnosticsLive" && explicitPath
    ? normalizeConfig({ ...config, defaultSource: explicitPath })
    : config;

  if (isFacadeCommandId(commandId)) {
    buildFacadeArgsForCommand(commandId, commandConfig);
  } else {
    assertKnownCommandId(commandId);
  }
  return commandConfig;
}

export async function runFacadeForCommand(commandId, options = {}, runtime = {}) {
  const invocation = buildFacadeInvocationForCommand(commandId, options, runtime);
  return runFacadeInvocation(invocation, runtime);
}

export async function runNavigationCommandLocations(commandId, rawConfig = {}, deps = {}) {
  const result = await runPrototypeCommand(commandId, rawConfig, {
    runFacade: deps.runFacade,
  });
  if (result.ok) {
    result.locations = createNavigationLocationRecords(result.action?.items, deps);
  }
  return result;
}

export async function runCheckedExampleNavigationLocations(rawConfig = {}, deps = {}) {
  return runNavigationCommandLocations(CHECKED_EXAMPLE_NAVIGATION_COMMAND, rawConfig, deps);
}

function validationResultCacheFromRuntime(runtime = {}) {
  if (!runtime.validationResultCache) {
    runtime.validationResultCache = createValidationResultCache(runtime.validationResultCacheOptions);
  }
  return runtime.validationResultCache;
}

function shortValidationEntryLabel(entry) {
  const label = entry?.label || entry?.proposalId || "validation";
  const status = entry?.status || "unknown";
  const exitText = entry?.exitCode == null ? "" : ` exit ${entry.exitCode}`;
  return `${label}: ${status}${exitText}`;
}

function validationEntryQuickPickItems(entries) {
  return entries.map((entry) => ({
    label: entry.status === "passed" ? "$(check) " + entry.label : "$(warning) " + entry.label,
    description: [entry.status, entry.exitCode == null ? "" : `exit ${entry.exitCode}`]
      .filter(Boolean)
      .join(" "),
    detail: [
      entry.proposalId ? `proposal ${entry.proposalId}` : "",
      entry.durationMs == null ? "" : `${entry.durationMs}ms`,
      entry.redactionApplied ? "redacted" : "",
      entry.truncated ? "truncated" : "",
    ].filter(Boolean).join(" | "),
    entry,
  }));
}

function patchProposalQuickPickItems(proposals) {
  return proposals.map((proposal) => ({
    label: proposal.title,
    description: [proposal.riskLevel, proposal.proposalId].filter(Boolean).join(" "),
    detail: proposal.summary,
    proposalId: proposal.proposalId,
  }));
}

function validationPreflightQuickPickItems(proposals) {
  return proposals.map((proposal) => ({
    label: proposal.label,
    description: [proposal.runnerPolicy, proposal.riskLevel, proposal.id].filter(Boolean).join(" "),
    detail: proposal.reason,
    proposalId: proposal.id,
  }));
}

function validationOutputChannelFromRuntime(runtime = {}) {
  return runtime.validationOutputChannel ?? runtime.outputChannel;
}

function appendValidationOutput(outputChannel, commandId, result) {
  if (!outputChannel?.appendLine) {
    return;
  }

  outputChannel.appendLine(`[${commandId}]`);
  if (result.kind === "validation-result-cache") {
    outputChannel.appendLine(`cachedResultCount: ${result.entries?.length ?? 0}`);
    if (result.selected) {
      outputChannel.appendLine(formatValidationResultCacheEntry(result.selected));
    } else {
      for (const entry of result.entries ?? []) {
        outputChannel.appendLine(formatValidationResultCacheEntry(entry, { maxDisplayLines: 0 }));
      }
    }
  }
  if (result.kind === "validation-result-cache-status") {
    outputChannel.appendLine(formatValidationResultCacheStatus(result.status));
  }
  if (result.kind === "validation-result-cache-clear") {
    outputChannel.appendLine(`clearedCount: ${result.clearedCount}`);
  }
  if (result.kind === "approved-validation-result" && result.resultSummary) {
    outputChannel.appendLine(formatValidationResultCacheEntry(result.resultSummary));
  }
  if (result.error) {
    outputChannel.appendLine(result.error);
  }
  outputChannel.show?.(true);
}

function appendCommandOutput(outputChannel, commandId, result) {
  if (!outputChannel?.appendLine) {
    return;
  }

  outputChannel.appendLine(`[${commandId}]`);
  if (result.status?.status && result.status?.kind !== "pccx-lab-backend-status") {
    outputChannel.appendLine(`workflow boundary status: ${result.status.status}`);
  }
  if (result.contextSummary) {
    outputChannel.appendLine(JSON.stringify(result.contextSummary, null, 2));
  }
  if (result.kind === "validation-command-proposal") {
    outputChannel.appendLine(JSON.stringify({
      kind: result.kind,
      proposalCount: result.proposals?.length ?? 0,
      execution: result.execution,
      diagnosticsHandoff: result.diagnosticsHandoffContext?.status ?? "unavailable",
    }, null, 2));
  }
  if (result.kind === "validation-proposal-preflight-audit") {
    outputChannel.appendLine(formatValidationProposalPreflightAudit(result));
  }
  if (result.kind === "approved-validation-result") {
    outputChannel.appendLine(JSON.stringify({
      kind: result.kind,
      proposalId: result.proposalId,
      status: result.status,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
    }, null, 2));
  }
  if (result.kind === "validation-result-cache") {
    outputChannel.appendLine(JSON.stringify({
      kind: result.kind,
      count: result.entries?.length ?? 0,
      entries: (result.entries ?? []).map((entry) => ({
        proposalId: entry.proposalId,
        label: entry.label,
        status: entry.status,
        exitCode: entry.exitCode,
        durationMs: entry.durationMs,
        commandKind: entry.commandKind,
        workingDirectoryKind: entry.workingDirectoryKind,
        truncated: entry.truncated,
        redactionApplied: entry.redactionApplied,
      })),
    }, null, 2));
  }
  if (result.kind === "validation-result-cache-status") {
    outputChannel.appendLine(JSON.stringify({
      kind: result.kind,
      status: result.status,
    }, null, 2));
  }
  if (result.kind === "validation-result-cache-clear") {
    outputChannel.appendLine(JSON.stringify({
      kind: result.kind,
      clearedCount: result.clearedCount,
    }, null, 2));
  }
  if (result.kind === "patch-proposal-preview") {
    outputChannel.appendLine(result.previewText);
  }
  if (result.kind === "patch-proposal-preview-clear") {
    outputChannel.appendLine(JSON.stringify({
      kind: result.kind,
      cleared: result.cleared,
    }, null, 2));
  }
  if (result.kind === "local-workflow-status") {
    outputChannel.appendLine(formatLocalWorkflowStatus(result.status));
  }
  if (result.kind === "context-bundle-audit") {
    outputChannel.appendLine(formatContextBundleAudit(result.audit));
  }
  if (result.kind === "diagnostics-handoff-status") {
    outputChannel.appendLine(formatDiagnosticsHandoffStatusSurface(result.surface));
  }
  if (result.kind === "kv260-status-panel") {
    outputChannel.appendLine(formatKv260StatusPanel(result.panel));
  }
  if (result.status?.kind === "pccx-lab-backend-status") {
    outputChannel.appendLine(JSON.stringify(result.status, null, 2));
  }
  if (result.action?.summary) {
    outputChannel.appendLine(result.action.summary);
  }
  if (result.action) {
    outputChannel.appendLine(JSON.stringify(result.action, null, 2));
  }
  if (result.error) {
    outputChannel.appendLine(result.error);
  }
  outputChannel.show?.(true);
}

function showKv260StatusWebview(vscodeApi, panel) {
  const createWebviewPanel = vscodeApi?.window?.createWebviewPanel;
  if (typeof createWebviewPanel !== "function") {
    return null;
  }
  const viewColumn = vscodeApi?.ViewColumn?.Beside ?? vscodeApi?.ViewColumn?.One ?? 1;
  const webviewPanel = createWebviewPanel.call(
    vscodeApi.window,
    "pccxKv260Readiness",
    "PCCX KV260 Readiness",
    viewColumn,
    { enableScripts: false },
  );
  if (!webviewPanel?.webview) {
    return null;
  }
  webviewPanel.webview.html = renderKv260StatusPanelHtml(panel);
  return webviewPanel;
}

function facadeRunnerFromRuntime(runtime = {}) {
  return async (facadeArgs, env = {}) => {
    const invocation = {
      executable: runtime.nodeExecutable ?? process.execPath,
      args: [
        runtime.facadePath ?? DEFAULT_FACADE_PATH,
        ...facadeArgs,
      ],
      shell: false,
      env,
    };
    return runFacadeInvocation(invocation, runtime);
  };
}

function diagnosticFileForUri(file, root = DEFAULT_DIAGNOSTIC_FILE_ROOT) {
  const filePath = file == null ? "" : String(file);
  if (filePath.length === 0 || isAbsolute(filePath)) {
    return filePath;
  }
  return resolve(root, filePath);
}

function resolveConfiguredPath(path, runtime = {}) {
  const value = typeof path === "string" ? path : "";
  if (value === "~") {
    return runtime.homeDir ?? homedir();
  }
  if (value.startsWith("~/")) {
    return resolve(runtime.homeDir ?? homedir(), value.slice(2));
  }
  if (isAbsolute(value)) {
    return value;
  }
  return resolve(runtime.repoRoot ?? DEFAULT_DIAGNOSTIC_FILE_ROOT, value);
}

export async function readKv260PreflightTranscriptSummary(rawConfig = {}, runtime = {}) {
  if (typeof runtime.kv260PreflightTranscriptText === "string") {
    return parseKv260PreflightTranscript(runtime.kv260PreflightTranscriptText);
  }
  const config = normalizeConfig(rawConfig);
  const configuredPath = config.kv260.preflightTranscriptPath;
  const transcriptPath = resolveConfiguredPath(configuredPath, runtime);
  const reader = runtime.kv260PreflightTranscriptReader ?? readFile;
  try {
    return parseKv260PreflightTranscript(await reader(transcriptPath, "utf8"));
  } catch {
    return parseKv260PreflightTranscript("");
  }
}

export function createPresenterDeps(vscodeApi, runtime = {}) {
  const diagnosticSeverity = {
    Error: vscodeApi?.DiagnosticSeverity?.Error ?? "Error",
    Warning: vscodeApi?.DiagnosticSeverity?.Warning ?? "Warning",
    Information: vscodeApi?.DiagnosticSeverity?.Information ?? "Information",
  };

  return {
    createUri(file) {
      const filePath = diagnosticFileForUri(file, runtime.diagnosticFileRoot);
      return vscodeApi?.Uri?.file ? vscodeApi.Uri.file(filePath) : { fsPath: filePath };
    },
    createRange(startLine, startCharacter, endLine, endCharacter) {
      return typeof vscodeApi?.Range === "function"
        ? new vscodeApi.Range(startLine, startCharacter, endLine, endCharacter)
        : {
            start: { line: startLine, character: startCharacter },
            end: { line: endLine, character: endCharacter },
          };
    },
    createDiagnostic(range, message, severity) {
      return typeof vscodeApi?.Diagnostic === "function"
        ? new vscodeApi.Diagnostic(range, message, severity)
        : { range, message, severity };
    },
    createLocation(uri, range) {
      return typeof vscodeApi?.Location === "function"
        ? new vscodeApi.Location(uri, range)
        : { uri, range };
    },
    diagnosticSeverity,
    diagnosticsCollection: runtime.diagnosticsCollection,
    showInformationMessage: vscodeApi?.window?.showInformationMessage?.bind(vscodeApi.window),
    showWarningMessage: (
      vscodeApi?.window?.showWarningMessage ?? vscodeApi?.window?.showErrorMessage
    )?.bind(vscodeApi.window),
    showQuickPick: vscodeApi?.window?.showQuickPick?.bind(vscodeApi.window),
  };
}

function plainRange(range) {
  if (!range) {
    return null;
  }
  return {
    start: {
      line: Number.isInteger(range.start?.line) ? range.start.line : 0,
      character: Number.isInteger(range.start?.character) ? range.start.character : 0,
    },
    end: {
      line: Number.isInteger(range.end?.line) ? range.end.line : 0,
      character: Number.isInteger(range.end?.character) ? range.end.character : 0,
    },
  };
}

function rangeIsEmpty(range) {
  return !range ||
    (
      range.start?.line === range.end?.line &&
      range.start?.character === range.end?.character
    );
}

function selectionCursor(selection) {
  const active = selection?.active ?? selection?.start;
  return {
    line: Number.isInteger(active?.line) ? active.line : 0,
    character: Number.isInteger(active?.character) ? active.character : 0,
  };
}

function collectLineWindow(document, selection, options = {}) {
  if (!document || typeof document.lineAt !== "function") {
    return [];
  }
  const before = Number.isInteger(options.before) ? options.before : 80;
  const after = Number.isInteger(options.after) ? options.after : 20;
  const cursor = selectionCursor(selection);
  const lineCount = Number.isInteger(document.lineCount) ? document.lineCount : cursor.line + 1;
  const start = Math.max(0, cursor.line - before);
  const end = Math.min(Math.max(0, lineCount - 1), cursor.line + after);
  const lines = [];
  for (let line = start; line <= end; line += 1) {
    const entry = document.lineAt(line);
    lines.push({
      line,
      text: typeof entry === "string" ? entry : String(entry?.text ?? ""),
    });
  }
  return lines;
}

function diagnosticSeverityName(vscodeApi, severity) {
  const diagnosticSeverity = vscodeApi?.DiagnosticSeverity ?? {};
  if (severity === diagnosticSeverity.Error || severity === 0) {
    return "Error";
  }
  if (severity === diagnosticSeverity.Warning || severity === 1) {
    return "Warning";
  }
  if (severity === diagnosticSeverity.Information || severity === 2) {
    return "Information";
  }
  if (severity === diagnosticSeverity.Hint || severity === 3) {
    return "Hint";
  }
  return "Information";
}

function diagnosticCode(value) {
  if (value == null) {
    return "";
  }
  if (typeof value === "object" && value.value != null) {
    return String(value.value);
  }
  return String(value);
}

function workspaceRootForDocument(vscodeApi, document) {
  const folder = document?.uri
    ? vscodeApi?.workspace?.getWorkspaceFolder?.(document.uri)
    : null;
  return folder?.uri?.fsPath ?? vscodeApi?.workspace?.workspaceFolders?.[0]?.uri?.fsPath ?? null;
}

function contextConfiguration(config) {
  const defaultPccxLabCommand = defaultConfig().pccxLab.command;
  return {
    mode: config.mode,
    liveWorkspace: {
      enabled: config.liveWorkspace.enabled,
    },
    workflowBoundary: {
      enabled: config.workflowBoundary.enabled,
      backend: config.workflowBoundary.backend,
    },
    pccxLab: {
      commandBoundary: config.pccxLab.command === defaultPccxLabCommand
        ? defaultPccxLabCommand
        : "custom",
    },
    validationRunner: {
      enabled: config.validationRunner.enabled,
      mode: config.validationRunner.mode,
      defaultWorkingDirectory: config.validationRunner.defaultWorkingDirectory,
      maxOutputLines: config.validationRunner.maxOutputLines,
      timeoutMs: config.validationRunner.timeoutMs,
    },
  };
}

function diagnosticsHandoffStatusFromRuntime(runtime = {}) {
  if (runtime.recentDiagnosticsHandoffStatus?.kind === "diagnostics-handoff-status-surface") {
    return runtime.recentDiagnosticsHandoffStatus;
  }
  try {
    return createDiagnosticsHandoffStatusSurface(runtime.diagnosticsHandoffSummary);
  } catch {
    return null;
  }
}

function collectActiveDiagnostics(vscodeApi, runtime, document) {
  if (!document?.uri) {
    return [];
  }
  const diagnostics = typeof vscodeApi?.languages?.getDiagnostics === "function"
    ? vscodeApi.languages.getDiagnostics(document.uri)
    : runtime.diagnosticsCollection?.get?.(document.uri);
  if (!Array.isArray(diagnostics)) {
    return [];
  }
  return diagnostics.map((diagnostic) => ({
    file: document.uri.fsPath,
    range: plainRange(diagnostic.range),
    severity: diagnosticSeverityName(vscodeApi, diagnostic.severity),
    message: diagnostic.message,
    source: diagnostic.source,
    code: diagnosticCode(diagnostic.code),
  }));
}

function collectActiveDocumentContext(vscodeApi, runtime, config) {
  const editor = vscodeApi?.window?.activeTextEditor;
  const document = editor?.document;
  const workspaceRoot = workspaceRootForDocument(vscodeApi, document);
  const selectionRange = plainRange(editor?.selection);
  const activeDiagnostics = collectActiveDiagnostics(vscodeApi, runtime, document);
  const validationCache = validationResultCacheFromRuntime(runtime);
  const recentValidationHistory = validationCache.list();
  const selectedText = (
    document?.uri?.fsPath &&
    editor?.selection &&
    !rangeIsEmpty(editor.selection) &&
    typeof document.getText === "function"
  )
    ? document.getText(editor.selection)
    : "";
  const selectedSymbolContext = buildSelectedSymbolContext({
    workspaceRoot,
    path: document?.uri?.fsPath,
    language: document?.languageId ?? "systemverilog",
    selectionRange,
    cursorPosition: selectionCursor(editor?.selection),
    selectionText: selectedText,
    lines: collectLineWindow(document, editor?.selection),
    diagnostics: activeDiagnostics,
    navigationItems: Array.isArray(runtime.recentNavigationItems)
      ? runtime.recentNavigationItems
      : [],
  }, { workspaceRoot });
  const files = [];

  if (
    document?.uri?.fsPath &&
    editor?.selection &&
    !rangeIsEmpty(editor.selection) &&
    selectedText.length > 0
  ) {
    files.push({
      path: document.uri.fsPath,
      language: document.languageId ?? "systemverilog",
      range: selectionRange,
      text: selectedText,
    });
  }

  return {
    workspaceRoot,
    input: {
      workspaceRoot,
      selectedFilePath: document?.uri?.fsPath,
      selectedRange: selectionRange,
      selectedSymbol: selectedSymbolContext?.symbolText
        ? {
            name: selectedSymbolContext.symbolText,
            kind: selectedSymbolContext.lexicalKind,
            path: document?.uri?.fsPath,
            range: selectedSymbolContext.range,
          }
        : null,
      selectedSymbolContext,
      activeDiagnostics,
      symbolContext: {
        declarations: Array.isArray(runtime.recentNavigationItems)
          ? runtime.recentNavigationItems
          : [],
      },
      files,
      configuration: contextConfiguration(config),
      recentCommandStatus: runtime.recentCommandStatus ?? null,
      recentValidation: recentValidationHistory[0] ?? runtime.recentValidationSummary ?? null,
      recentValidationHistory,
      diagnosticsHandoffStatus: diagnosticsHandoffStatusFromRuntime(runtime),
    },
  };
}

function facadeStatusFromPlan(plan) {
  const args = Array.isArray(plan?.facadeArgs) ? plan.facadeArgs : [];
  const modeIndex = args.indexOf("--mode");
  return {
    command: args[0] ?? "",
    mode: modeIndex >= 0 ? args[modeIndex + 1] ?? "" : "",
  };
}

function rememberCommandResult(runtime, commandId, result) {
  runtime.recentCommandStatus = {
    commandId,
    ok: result?.ok === true,
    actionKind: result?.action?.kind ?? "",
    summary: result?.action?.summary ?? "",
    facade: facadeStatusFromPlan(result?.plan),
    diagnosticCount: Array.isArray(result?.action?.diagnostics)
      ? result.action.diagnostics.length
      : 0,
    navigationItemCount: Array.isArray(result?.action?.items)
      ? result.action.items.length
      : 0,
    error: result?.error ?? "",
  };
  if (Array.isArray(result?.action?.items)) {
    runtime.recentNavigationItems = result.action.items;
  }
}

export function createCommandHandler(commandId, vscodeApi, runtime = {}) {
  assertKnownCommandId(commandId);
  return async (input) => {
    const rawConfig = readRawExtensionConfig(vscodeApi);

    if (commandId === WORKFLOW_BOUNDARY_STATUS_COMMAND) {
      let result;
      try {
        const status = createWorkflowBoundaryStatus(rawConfig);
        result = { ok: true, commandId, status };
      } catch (error) {
        result = { ok: false, commandId, error: error.message };
        vscodeApi?.window?.showWarningMessage?.(result.error, result);
      }
      appendCommandOutput(runtime.outputChannel, commandId, result);
      return result;
    }

    if (commandId === WORKFLOW_CONTEXT_BUNDLE_COMMAND) {
      let result;
      try {
        const config = normalizeConfig(rawConfig);
        const context = collectActiveDocumentContext(vscodeApi, runtime, config);
        const request = createWorkflowContextRequest(config, context.input, {
          workspaceRoot: context.workspaceRoot,
        });
        result = {
          ok: true,
          commandId,
          ...request,
        };
      } catch (error) {
        result = { ok: false, commandId, error: error.message };
        vscodeApi?.window?.showWarningMessage?.(result.error, result);
      }
      appendCommandOutput(runtime.outputChannel, commandId, result);
      return result;
    }

    if (commandId === VALIDATION_PROPOSAL_COMMAND) {
      let result;
      try {
        const request = createWorkflowContextRequest(rawConfig, {
          diagnosticsHandoffStatus: diagnosticsHandoffStatusFromRuntime(runtime),
        });
        result = {
          ok: true,
          commandId,
          ...createValidationCommandProposal({
            contextBundle: {
              diagnosticsHandoff: request.contextBundle.diagnosticsHandoff,
            },
          }),
        };
      } catch (error) {
        result = { ok: false, commandId, error: error.message };
        vscodeApi?.window?.showWarningMessage?.(result.error, result);
      }
      appendCommandOutput(runtime.outputChannel, commandId, result);
      return result;
    }

    if (commandId === AUDIT_VALIDATION_PREFLIGHT_COMMAND) {
      let result;
      try {
        const request = createWorkflowContextRequest(rawConfig, {
          diagnosticsHandoffStatus: diagnosticsHandoffStatusFromRuntime(runtime),
        });
        let auditInput = input;
        if (auditInput == null && typeof vscodeApi?.window?.showQuickPick === "function") {
          const selected = await vscodeApi.window.showQuickPick(
            validationPreflightQuickPickItems(listValidationCommandProposals({
              contextBundle: {
                diagnosticsHandoff: request.contextBundle.diagnosticsHandoff,
              },
            })),
            {
              title: "Validation Proposal Preflight Audit",
              placeHolder: "Select a validation proposal to audit",
            },
          );
          auditInput = selected?.proposalId ?? null;
        }
        result = {
          ok: true,
          commandId,
          ...createValidationProposalPreflightAudit(auditInput ?? {}, {
            contextBundle: {
              diagnosticsHandoff: request.contextBundle.diagnosticsHandoff,
            },
          }),
        };
        const message =
          `Validation preflight audit: ${result.proposalId || "unknown"} ${result.status}.`;
        if (result.status === "passed") {
          vscodeApi?.window?.showInformationMessage?.(message, result);
        } else {
          vscodeApi?.window?.showWarningMessage?.(message, result);
        }
      } catch (error) {
        result = { ok: false, commandId, error: error.message };
        vscodeApi?.window?.showWarningMessage?.(result.error, result);
      }
      appendCommandOutput(runtime.outputChannel, commandId, result);
      return result;
    }

    if (commandId === SHOW_RECENT_VALIDATION_RESULTS_COMMAND) {
      let result;
      try {
        const entries = validationResultCacheFromRuntime(runtime).list();
        result = {
          ok: true,
          commandId,
          kind: "validation-result-cache",
          entries,
          selected: null,
        };
        if (entries.length === 0) {
          vscodeApi?.window?.showInformationMessage?.(
            "No recent validation results are cached.",
            result,
          );
        } else if (typeof vscodeApi?.window?.showQuickPick === "function") {
          const selected = await vscodeApi.window.showQuickPick(
            validationEntryQuickPickItems(entries),
            { title: "Recent Validation Results", placeHolder: "Select a cached validation summary" },
          );
          result.selected = selected?.entry ?? null;
          if (result.selected) {
            vscodeApi?.window?.showInformationMessage?.(
              `Validation summary: ${shortValidationEntryLabel(result.selected)}`,
              result,
            );
          }
        } else {
          vscodeApi?.window?.showInformationMessage?.(
            `${entries.length} recent validation result(s) cached. ${shortValidationEntryLabel(entries[0])}`,
            result,
          );
        }
      } catch (error) {
        result = { ok: false, commandId, error: error.message };
        vscodeApi?.window?.showWarningMessage?.(result.error, result);
      }
      appendValidationOutput(validationOutputChannelFromRuntime(runtime), commandId, result);
      appendCommandOutput(runtime.outputChannel, commandId, result);
      return result;
    }

    if (commandId === SHOW_VALIDATION_CACHE_STATUS_COMMAND) {
      let result;
      try {
        const cache = validationResultCacheFromRuntime(runtime);
        const status = cache.status();
        result = {
          ok: true,
          commandId,
          kind: "validation-result-cache-status",
          status,
        };
        const latestText = status.latest
          ? ` Latest: ${status.latest.label || status.latest.proposalId} ${status.latest.status}.`
          : "";
        vscodeApi?.window?.showInformationMessage?.(
          `Validation cache: ${status.count}/${status.maxSize} result(s).${latestText}`,
          result,
        );
      } catch (error) {
        result = { ok: false, commandId, error: error.message };
        vscodeApi?.window?.showWarningMessage?.(result.error, result);
      }
      appendValidationOutput(validationOutputChannelFromRuntime(runtime), commandId, result);
      appendCommandOutput(runtime.outputChannel, commandId, result);
      return result;
    }

    if (commandId === CLEAR_VALIDATION_RESULT_CACHE_COMMAND) {
      let result;
      try {
        const cache = validationResultCacheFromRuntime(runtime);
        const clearedCount = cache.clear();
        runtime.recentValidationSummary = null;
        result = {
          ok: true,
          commandId,
          kind: "validation-result-cache-clear",
          clearedCount,
        };
        vscodeApi?.window?.showInformationMessage?.(
          `Cleared ${clearedCount} cached validation result(s).`,
          result,
        );
      } catch (error) {
        result = { ok: false, commandId, error: error.message };
        vscodeApi?.window?.showWarningMessage?.(result.error, result);
      }
      appendValidationOutput(validationOutputChannelFromRuntime(runtime), commandId, result);
      appendCommandOutput(runtime.outputChannel, commandId, result);
      return result;
    }

    if (commandId === SHOW_PATCH_PROPOSAL_PREVIEW_COMMAND) {
      let result;
      try {
        let request = input;
        if (request == null && typeof vscodeApi?.window?.showQuickPick === "function") {
          const selected = await vscodeApi.window.showQuickPick(
            patchProposalQuickPickItems(listCheckedPatchProposals({
              checkedPatchProposals: runtime.checkedPatchProposals,
            })),
            {
              title: "Patch Proposal Preview",
              placeHolder: "Select a checked patch proposal",
            },
          );
          request = selected?.proposalId ?? null;
        }
        result = {
          ok: true,
          commandId,
          ...createPatchProposalPreview(request, {
            checkedPatchProposals: runtime.checkedPatchProposals,
          }),
        };
        runtime.recentPatchProposalPreview = result;
        vscodeApi?.window?.showInformationMessage?.(
          `Patch proposal preview: ${result.summary.title}`,
          result,
        );
      } catch (error) {
        result = { ok: false, commandId, error: error.message };
        vscodeApi?.window?.showWarningMessage?.(result.error, result);
      }
      appendCommandOutput(runtime.outputChannel, commandId, result);
      return result;
    }

    if (commandId === CLEAR_PATCH_PROPOSAL_PREVIEW_COMMAND) {
      let result;
      try {
        const cleared = runtime.recentPatchProposalPreview != null;
        runtime.recentPatchProposalPreview = null;
        result = {
          ok: true,
          commandId,
          kind: "patch-proposal-preview-clear",
          cleared,
        };
        vscodeApi?.window?.showInformationMessage?.(
          cleared ? "Cleared patch proposal preview." : "No patch proposal preview was cached.",
          result,
        );
      } catch (error) {
        result = { ok: false, commandId, error: error.message };
        vscodeApi?.window?.showWarningMessage?.(result.error, result);
      }
      appendCommandOutput(runtime.outputChannel, commandId, result);
      return result;
    }

    if (commandId === SHOW_LOCAL_WORKFLOW_STATUS_COMMAND) {
      let result;
      try {
        const config = normalizeConfig(rawConfig);
        const validationCache = validationResultCacheFromRuntime(runtime);
        let contextSummary = null;
        try {
          const context = collectActiveDocumentContext(vscodeApi, runtime, config);
          const request = createWorkflowContextRequest(config, context.input, {
            workspaceRoot: context.workspaceRoot,
          });
          contextSummary = request.contextSummary;
        } catch {
          contextSummary = null;
        }
        const status = createLocalWorkflowStatus(config, {
          validationResultCache: validationCache,
          contextSummary,
          validationHistoryCount: validationCache.size(),
          launcherStatusCount: 1,
          labStatusCount: 1,
        });
        result = {
          ok: true,
          commandId,
          kind: "local-workflow-status",
          status,
        };
        vscodeApi?.window?.showInformationMessage?.(
          `Local workflow status: ${status.extensionMode}, validation ${status.recentValidation.latestStatus}.`,
          result,
        );
      } catch (error) {
        result = { ok: false, commandId, error: error.message };
        vscodeApi?.window?.showWarningMessage?.(result.error, result);
      }
      appendCommandOutput(runtime.outputChannel, commandId, result);
      return result;
    }

    if (commandId === SHOW_CONTEXT_BUNDLE_AUDIT_COMMAND) {
      let result;
      try {
        const config = normalizeConfig(rawConfig);
        const context = collectActiveDocumentContext(vscodeApi, runtime, config);
        const request = createWorkflowContextRequest(config, context.input, {
          workspaceRoot: context.workspaceRoot,
        });
        const audit = createContextBundleAudit(request.contextBundle);
        result = {
          ok: true,
          commandId,
          kind: "context-bundle-audit",
          audit,
        };
        vscodeApi?.window?.showInformationMessage?.(
          `Context bundle audit: ${audit.approximateCharacterCount} character(s), ${audit.diagnosticCount} diagnostic(s).`,
          result,
        );
      } catch (error) {
        result = { ok: false, commandId, error: error.message };
        vscodeApi?.window?.showWarningMessage?.(result.error, result);
      }
      appendCommandOutput(runtime.outputChannel, commandId, result);
      return result;
    }

    if (commandId === SHOW_DIAGNOSTICS_HANDOFF_SUMMARY_COMMAND) {
      let result;
      try {
        const surface = createDiagnosticsHandoffStatusSurface(runtime.diagnosticsHandoffSummary);
        runtime.recentDiagnosticsHandoffStatus = surface;
        result = {
          ok: true,
          commandId,
          kind: "diagnostics-handoff-status",
          surface,
        };
        vscodeApi?.window?.showInformationMessage?.(
          `Diagnostics handoff summary: ${surface.display.summary}.`,
          result,
        );
      } catch (error) {
        result = { ok: false, commandId, error: error.message };
        vscodeApi?.window?.showWarningMessage?.(result.error, result);
      }
      appendCommandOutput(runtime.outputChannel, commandId, result);
      return result;
    }

    if (commandId === SHOW_KV260_STATUS_PANEL_COMMAND) {
      let result;
      try {
        const preflightTranscript = await readKv260PreflightTranscriptSummary(rawConfig, runtime);
        const panel = createKv260StatusPanel({
          ...(runtime.kv260StatusInputs ?? {}),
          preflightTranscript,
        });
        result = {
          ok: true,
          commandId,
          kind: "kv260-status-panel",
          panel,
        };
        const webviewPanel = showKv260StatusWebview(vscodeApi, panel);
        if (webviewPanel) {
          result.presentation = "webview";
        }
        vscodeApi?.window?.showInformationMessage?.(
          `KV260 status surface: ${panel.lab.frameCount} trace frame(s).`,
          result,
        );
      } catch (error) {
        result = { ok: false, commandId, error: error.message };
        vscodeApi?.window?.showWarningMessage?.(result.error, result);
      }
      appendCommandOutput(runtime.outputChannel, commandId, result);
      return result;
    }

    if (commandId === APPROVED_VALIDATION_RUNNER_COMMAND) {
      let result;
      try {
        const workspaceRoot = vscodeApi?.workspace?.workspaceFolders?.[0]?.uri?.fsPath ?? null;
        result = await runApprovedValidationProposal(
          input,
          rawConfig,
          {
            repoRoot: runtime.repoRoot ?? DEFAULT_DIAGNOSTIC_FILE_ROOT,
            workspaceRoot,
            execFile: runtime.validationExecFile,
            env: runtime.env,
          },
        );
        runtime.recentValidationSummary = result.resultSummary
          ? validationResultCacheFromRuntime(runtime).add(result.resultSummary)
          : null;
      } catch (error) {
        result = { ok: false, commandId, error: error.message };
        vscodeApi?.window?.showWarningMessage?.(result.error, result);
      }
      result.commandId = commandId;
      if (runtime.recentValidationSummary) {
        appendValidationOutput(
          validationOutputChannelFromRuntime(runtime),
          commandId,
          {
            kind: "validation-result-cache",
            entries: [runtime.recentValidationSummary],
            selected: runtime.recentValidationSummary,
          },
        );
      }
      appendCommandOutput(runtime.outputChannel, commandId, result);
      return result;
    }

    if (commandId === PCCX_LAB_BACKEND_STATUS_COMMAND) {
      let result;
      try {
        result = {
          ok: true,
          commandId,
          status: createPccxLabBackendStatus(rawConfig),
        };
      } catch (error) {
        result = { ok: false, commandId, error: error.message };
        vscodeApi?.window?.showWarningMessage?.(result.error, result);
      }
      appendCommandOutput(runtime.outputChannel, commandId, result);
      return result;
    }

    const returnsNavigationLocations = NAVIGATION_LOCATION_COMMAND_IDS.includes(commandId);
    const explicitPath = pathFromCommandInput(input);
    const request = (
      commandId === "pccxSystemVerilog.publishLiveWorkspaceDiagnostics" ||
      commandId === "pccxSystemVerilog.runDiagnosticsLive"
    ) && explicitPath
      ? { ...rawConfig, defaultSource: explicitPath }
      : rawConfig;
    const presenterDeps = {
      ...createPresenterDeps(vscodeApi, runtime),
      ...(runtime.presenterDeps ?? {}),
    };
    const deps = {
      runFacade: runtime.runFacade ?? facadeRunnerFromRuntime(runtime),
      updateDiagnostics: (_diagnostics, action) => presentAction(action, presenterDeps),
      showNavigationItems: returnsNavigationLocations
        ? undefined
        : (_items, action) => presentAction(action, presenterDeps),
    };
    const result = returnsNavigationLocations
      ? await runNavigationCommandLocations(commandId, request, {
        ...presenterDeps,
        runFacade: deps.runFacade,
        fileRoot: runtime.navigationFileRoot ?? DEFAULT_NAVIGATION_FILE_ROOT,
      })
      : await runPrototypeCommand(commandId, request, deps);
    rememberCommandResult(runtime, commandId, result);
    if (!result.ok) {
      presenterDeps.showWarningMessage?.(result.error, result);
    }
    appendCommandOutput(runtime.outputChannel, commandId, result);
    return result;
  };
}

async function loadVscodeApi() {
  try {
    return await import("vscode");
  } catch {
    return null;
  }
}

export async function activate(context, injectedVscodeApi = null, runtime = {}) {
  const vscodeApi = injectedVscodeApi ?? await loadVscodeApi();
  if (!vscodeApi?.commands?.registerCommand) {
    return { registered: [] };
  }

  const outputChannel = vscodeApi.window?.createOutputChannel?.(OUTPUT_CHANNEL_NAME);
  const validationOutputChannel =
    vscodeApi.window?.createOutputChannel?.(VALIDATION_OUTPUT_CHANNEL_NAME);
  const diagnosticsCollection = runtime.diagnosticsCollection
    ?? vscodeApi.languages?.createDiagnosticCollection?.(OUTPUT_CHANNEL_NAME);
  const commandRuntime = {
    ...runtime,
    diagnosticsCollection,
    outputChannel,
    validationOutputChannel,
  };
  const registered = [];
  const definitionProviders = [];

  for (const commandId of COMMAND_IDS) {
    const disposable = vscodeApi.commands.registerCommand(
      commandId,
      createCommandHandler(commandId, vscodeApi, commandRuntime),
    );
    context?.subscriptions?.push?.(disposable);
    registered.push(commandId);
  }

  definitionProviders.push(registerCheckedExampleDefinitionProvider(vscodeApi, context, {
    runCheckedExampleNavigationLocations() {
      const rawConfig = readRawExtensionConfig(vscodeApi);
      const presenterDeps = {
        ...createPresenterDeps(vscodeApi, commandRuntime),
        ...(commandRuntime.presenterDeps ?? {}),
      };
      return runCheckedExampleNavigationLocations(rawConfig, {
        ...presenterDeps,
        runFacade: commandRuntime.runFacade ?? facadeRunnerFromRuntime(commandRuntime),
        fileRoot: commandRuntime.navigationFileRoot ?? DEFAULT_NAVIGATION_FILE_ROOT,
      });
    },
  }));

  if (outputChannel) {
    context?.subscriptions?.push?.(outputChannel);
  }
  if (validationOutputChannel) {
    context?.subscriptions?.push?.(validationOutputChannel);
  }
  if (diagnosticsCollection && diagnosticsCollection !== runtime.diagnosticsCollection) {
    context?.subscriptions?.push?.(diagnosticsCollection);
  }
  return { registered, definitionProviders };
}

export function deactivate() {}
