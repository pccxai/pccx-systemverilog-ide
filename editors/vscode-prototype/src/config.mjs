// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

export const CONFIG_SECTION = "pccxSystemVerilog";

export const CONFIG_KEYS = Object.freeze([
  "mode",
  "liveWorkspace.enabled",
  "pccxLab.command",
  "workflowBoundary.enabled",
  "workflowBoundary.backend",
  "validationRunner.enabled",
  "validationRunner.mode",
  "validationRunner.defaultWorkingDirectory",
  "validationRunner.maxOutputLines",
  "validationRunner.timeoutMs",
  "pythonPath",
  "defaultSource",
  "defaultLog",
  "defaultNavigationRoot",
  "defaultModule",
  "defaultDeclarationKind",
]);

export const FACADE_COMMAND_IDS = Object.freeze([
  "pccxSystemVerilog.publishCheckedExampleDiagnostics",
  "pccxSystemVerilog.showCheckedExampleNavigation",
  "pccxSystemVerilog.publishLiveWorkspaceDiagnostics",
  "pccxSystemVerilog.showLiveWorkspaceNavigation",
  "pccxSystemVerilog.showDiagnosticsExample",
  "pccxSystemVerilog.showNavigationExample",
  "pccxSystemVerilog.runDiagnosticsLive",
  "pccxSystemVerilog.runNavigationLive",
]);

export const WORKFLOW_COMMAND_IDS = Object.freeze([
  "pccxSystemVerilog.showWorkflowBoundaryStatus",
  "pccxSystemVerilog.buildWorkflowContextBundle",
  "pccxSystemVerilog.proposeValidationCommand",
  "pccxSystemVerilog.auditValidationProposalPreflight",
  "pccxSystemVerilog.runApprovedValidationCommand",
  "pccxSystemVerilog.showRecentValidationResults",
  "pccxSystemVerilog.showValidationCacheStatus",
  "pccxSystemVerilog.clearValidationResultCache",
  "pccxSystemVerilog.showPatchProposalPreview",
  "pccxSystemVerilog.clearPatchProposalPreview",
  "pccxSystemVerilog.showLocalWorkflowStatus",
  "pccxSystemVerilog.showContextBundleAudit",
]);

export const PCCX_LAB_COMMAND_IDS = Object.freeze([
  "pccxSystemVerilog.showPccxLabBackendStatus",
]);

export const DIAGNOSTICS_HANDOFF_COMMAND_IDS = Object.freeze([
  "pccxSystemVerilog.showDiagnosticsHandoffSummary",
]);

export const KV260_STATUS_COMMAND_IDS = Object.freeze([
  "pccxSystemVerilog.showKv260StatusPanel",
]);

export const V0021_NAVIGATION_COMMAND_IDS = Object.freeze([
  "pccxSystemVerilog.v0021.showKv260StatusPanel",
  "pccxSystemVerilog.v0021.openRunbook",
  "pccxSystemVerilog.v0021.openProjectBoard",
  "pccxSystemVerilog.v0021.showTraceInspectHelp",
]);

export const COMMAND_IDS = Object.freeze([
  ...FACADE_COMMAND_IDS,
  ...WORKFLOW_COMMAND_IDS,
  ...PCCX_LAB_COMMAND_IDS,
  ...DIAGNOSTICS_HANDOFF_COMMAND_IDS,
  ...KV260_STATUS_COMMAND_IDS,
  ...V0021_NAVIGATION_COMMAND_IDS,
]);

export const MODES = Object.freeze(["checkedExample", "liveWorkspace"]);
export const WORKFLOW_BOUNDARY_BACKENDS = Object.freeze(["none", "pccx-llm-launcher", "mcp"]);
export const DECLARATION_KINDS = Object.freeze(["module", "package", "interface", "any"]);
export const VALIDATION_RUNNER_MODES = Object.freeze(["disabled", "allowlisted"]);
export const VALIDATION_RUNNER_CWD_KINDS = Object.freeze(["repo-root", "workspace"]);
export const LIVE_WORKSPACE_COMMAND_IDS = Object.freeze([
  "pccxSystemVerilog.publishLiveWorkspaceDiagnostics",
  "pccxSystemVerilog.showLiveWorkspaceNavigation",
  "pccxSystemVerilog.runDiagnosticsLive",
  "pccxSystemVerilog.runNavigationLive",
]);

const DEFAULT_CONFIG = Object.freeze({
  mode: "checkedExample",
  liveWorkspace: Object.freeze({
    enabled: false,
  }),
  pccxLab: Object.freeze({
    command: "pccx_ide_cli",
  }),
  workflowBoundary: Object.freeze({
    enabled: false,
    backend: "none",
  }),
  validationRunner: Object.freeze({
    enabled: false,
    mode: "disabled",
    defaultWorkingDirectory: "repo-root",
    maxOutputLines: 120,
    timeoutMs: 30000,
  }),
  pythonPath: "python3",
  defaultSource: "fixtures/missing_endmodule.sv",
  defaultLog: "fixtures/xsim/mixed.log",
  defaultNavigationRoot: "fixtures/modules",
  defaultModule: "simple_mod",
  defaultDeclarationKind: "module",
});

const SHELL_CONTROL_PATTERN = /(?:&&|\|\||;|`|\$\()/;

function rawConfigValue(rawConfig, key) {
  if (rawConfig && typeof rawConfig.get === "function") {
    return rawConfig.get(key);
  }
  if (rawConfig && Object.hasOwn(rawConfig, key)) {
    return rawConfig[key];
  }

  const parts = key.split(".");
  let value = rawConfig;
  for (const part of parts) {
    if (value == null || typeof value !== "object" || !Object.hasOwn(value, part)) {
      return undefined;
    }
    value = value[part];
  }
  return value;
}

function stringSetting(rawConfig, key, fallback) {
  const value = rawConfigValue(rawConfig, key);
  if (value == null) {
    return fallback;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${CONFIG_SECTION}.${key} must be a non-empty string`);
  }
  if (value.includes("\0") || value.includes("\n") || value.includes("\r")) {
    throw new Error(`${CONFIG_SECTION}.${key} must be a single-line string`);
  }
  if (SHELL_CONTROL_PATTERN.test(value)) {
    throw new Error(`${CONFIG_SECTION}.${key} must not contain shell control syntax`);
  }
  return value;
}

function commandSetting(rawConfig, key, fallback) {
  const value = stringSetting(rawConfig, key, fallback);
  if (/\s/.test(value)) {
    throw new Error(`${CONFIG_SECTION}.${key} must be a command name or path without arguments`);
  }
  return value;
}

function booleanSetting(rawConfig, key, fallback) {
  const value = rawConfigValue(rawConfig, key);
  if (value == null) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${CONFIG_SECTION}.${key} must be a boolean`);
  }
  return value;
}

function enumSetting(rawConfig, key, fallback, allowedValues) {
  const value = stringSetting(rawConfig, key, fallback);
  if (!allowedValues.includes(value)) {
    throw new Error(
      `${CONFIG_SECTION}.${key} must be one of: ${allowedValues.join(", ")}`,
    );
  }
  return value;
}

function integerSetting(rawConfig, key, fallback, options = {}) {
  const value = rawConfigValue(rawConfig, key);
  if (value == null) {
    return fallback;
  }
  if (!Number.isInteger(value)) {
    throw new Error(`${CONFIG_SECTION}.${key} must be an integer`);
  }
  const min = Number.isInteger(options.min) ? options.min : Number.MIN_SAFE_INTEGER;
  const max = Number.isInteger(options.max) ? options.max : Number.MAX_SAFE_INTEGER;
  if (value < min || value > max) {
    throw new Error(`${CONFIG_SECTION}.${key} must be between ${min} and ${max}`);
  }
  return value;
}

export function defaultConfig() {
  return {
    ...DEFAULT_CONFIG,
    liveWorkspace: { ...DEFAULT_CONFIG.liveWorkspace },
    pccxLab: { ...DEFAULT_CONFIG.pccxLab },
    workflowBoundary: { ...DEFAULT_CONFIG.workflowBoundary },
    validationRunner: { ...DEFAULT_CONFIG.validationRunner },
  };
}

export function normalizeConfig(rawConfig = {}) {
  return {
    mode: enumSetting(rawConfig, "mode", DEFAULT_CONFIG.mode, MODES),
    liveWorkspace: {
      enabled: booleanSetting(
        rawConfig,
        "liveWorkspace.enabled",
        DEFAULT_CONFIG.liveWorkspace.enabled,
      ),
    },
    pccxLab: {
      command: commandSetting(rawConfig, "pccxLab.command", DEFAULT_CONFIG.pccxLab.command),
    },
    workflowBoundary: {
      enabled: booleanSetting(
        rawConfig,
        "workflowBoundary.enabled",
        DEFAULT_CONFIG.workflowBoundary.enabled,
      ),
      backend: enumSetting(
        rawConfig,
        "workflowBoundary.backend",
        DEFAULT_CONFIG.workflowBoundary.backend,
        WORKFLOW_BOUNDARY_BACKENDS,
      ),
    },
    validationRunner: {
      enabled: booleanSetting(
        rawConfig,
        "validationRunner.enabled",
        DEFAULT_CONFIG.validationRunner.enabled,
      ),
      mode: enumSetting(
        rawConfig,
        "validationRunner.mode",
        DEFAULT_CONFIG.validationRunner.mode,
        VALIDATION_RUNNER_MODES,
      ),
      defaultWorkingDirectory: enumSetting(
        rawConfig,
        "validationRunner.defaultWorkingDirectory",
        DEFAULT_CONFIG.validationRunner.defaultWorkingDirectory,
        VALIDATION_RUNNER_CWD_KINDS,
      ),
      maxOutputLines: integerSetting(
        rawConfig,
        "validationRunner.maxOutputLines",
        DEFAULT_CONFIG.validationRunner.maxOutputLines,
        { min: 1, max: 500 },
      ),
      timeoutMs: integerSetting(
        rawConfig,
        "validationRunner.timeoutMs",
        DEFAULT_CONFIG.validationRunner.timeoutMs,
        { min: 1000, max: 120000 },
      ),
    },
    pythonPath: stringSetting(rawConfig, "pythonPath", DEFAULT_CONFIG.pythonPath),
    defaultSource: stringSetting(rawConfig, "defaultSource", DEFAULT_CONFIG.defaultSource),
    defaultLog: stringSetting(rawConfig, "defaultLog", DEFAULT_CONFIG.defaultLog),
    defaultNavigationRoot: stringSetting(
      rawConfig,
      "defaultNavigationRoot",
      DEFAULT_CONFIG.defaultNavigationRoot,
    ),
    defaultModule: stringSetting(rawConfig, "defaultModule", DEFAULT_CONFIG.defaultModule),
    defaultDeclarationKind: enumSetting(
      rawConfig,
      "defaultDeclarationKind",
      DEFAULT_CONFIG.defaultDeclarationKind,
      DECLARATION_KINDS,
    ),
  };
}

export function isKnownCommandId(commandId) {
  return COMMAND_IDS.includes(commandId);
}

export function isFacadeCommandId(commandId) {
  return FACADE_COMMAND_IDS.includes(commandId);
}

export function assertKnownCommandId(commandId) {
  if (!isKnownCommandId(commandId)) {
    throw new Error(`unknown PCCX SystemVerilog command: ${commandId}`);
  }
}

export function assertFacadeCommandId(commandId) {
  if (!isFacadeCommandId(commandId)) {
    assertKnownCommandId(commandId);
    throw new Error(`PCCX SystemVerilog command does not use the facade: ${commandId}`);
  }
}

export function isLiveWorkspaceCommand(commandId) {
  return LIVE_WORKSPACE_COMMAND_IDS.includes(commandId);
}

export function isLiveWorkspaceEnabled(config) {
  return config?.mode === "liveWorkspace" && config?.liveWorkspace?.enabled === true;
}

export function assertLiveWorkspaceEnabled(config) {
  if (!isLiveWorkspaceEnabled(config)) {
    throw new Error(
      "live workspace commands require pccxSystemVerilog.mode=liveWorkspace " +
        "and pccxSystemVerilog.liveWorkspace.enabled=true",
    );
  }
}

export function buildFacadeArgsForCommand(commandId, rawConfig = {}) {
  assertFacadeCommandId(commandId);
  const config = normalizeConfig(rawConfig);

  if (
    commandId === "pccxSystemVerilog.publishCheckedExampleDiagnostics" ||
    commandId === "pccxSystemVerilog.showDiagnosticsExample"
  ) {
    return ["diagnostics", "--mode", "example", "--source", "check-missing-endmodule"];
  }

  if (
    commandId === "pccxSystemVerilog.showCheckedExampleNavigation" ||
    commandId === "pccxSystemVerilog.showNavigationExample"
  ) {
    return ["navigation", "--mode", "example", "--source", "declarations"];
  }

  if (
    commandId === "pccxSystemVerilog.publishLiveWorkspaceDiagnostics" ||
    commandId === "pccxSystemVerilog.runDiagnosticsLive"
  ) {
    assertLiveWorkspaceEnabled(config);
    return ["diagnostics", "--mode", "live", "--from-check", config.defaultSource];
  }

  if (
    commandId === "pccxSystemVerilog.showLiveWorkspaceNavigation" ||
    commandId === "pccxSystemVerilog.runNavigationLive"
  ) {
    assertLiveWorkspaceEnabled(config);
    return [
      "navigation",
      "--mode",
      "live",
      "--locate",
      config.defaultNavigationRoot,
      config.defaultModule,
      "--kind",
      config.defaultDeclarationKind,
    ];
  }

  throw new Error(`unhandled PCCX SystemVerilog command: ${commandId}`);
}

export function isLiveFacadeArgs(args) {
  return Array.isArray(args) && args[1] === "--mode" && args[2] === "live";
}
