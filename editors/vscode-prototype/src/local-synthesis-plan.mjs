// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

export const LOCAL_SYNTHESIS_PLAN_VERSION = "pccx.localSynthesisPlan.v0";
export const SHOW_LOCAL_SYNTHESIS_PLAN_COMMAND =
  "pccxSystemVerilog.showLocalSynthesisPlan";
export const JETBRAINS_LOCAL_SYNTHESIS_ACTION =
  "pccx.systemverilog.showLocalSynthesisPlan";

const VENDORS = Object.freeze(["auto", "vivado", "quartus"]);
const TARGETS = Object.freeze(["kv260"]);
const SHELL_CONTROL_PATTERN = /(?:&&|\|\||;|`|\$\(|>|<)/;

function singleLineString(value, fallback, label) {
  if (value == null) {
    return fallback;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  if (value.includes("\0") || value.includes("\n") || value.includes("\r")) {
    throw new Error(`${label} must be a single-line string`);
  }
  if (SHELL_CONTROL_PATTERN.test(value)) {
    throw new Error(`${label} must not contain shell control syntax`);
  }
  return value;
}

function enumValue(value, fallback, allowedValues, label) {
  const normalized = singleLineString(value, fallback, label);
  if (!allowedValues.includes(normalized)) {
    throw new Error(`${label} must be one of: ${allowedValues.join(", ")}`);
  }
  return normalized;
}

function modeFlag(input = {}) {
  return input.run === true ? "--run" : "--dry-run";
}

export function createLocalSynthesisPlan(input = {}) {
  const vendor = enumValue(input.vendor, "auto", VENDORS, "vendor");
  const target = enumValue(input.target, "kv260", TARGETS, "target");
  const scriptPath = singleLineString(input.scriptPath, "synth.tcl", "scriptPath");
  const workDir = singleLineString(input.workDir, ".", "workDir");
  const artifactPath = singleLineString(input.artifactPath, "build/pccx.xclbin", "artifactPath");
  const flag = modeFlag(input);

  return {
    version: LOCAL_SYNTHESIS_PLAN_VERSION,
    kind: "local-synthesis-plan",
    proposalOnly: true,
    surfaces: {
      vscode: {
        commandId: SHOW_LOCAL_SYNTHESIS_PLAN_COMMAND,
        execution: "plan-only",
      },
      jetbrains: {
        actionId: JETBRAINS_LOCAL_SYNTHESIS_ACTION,
        execution: "plan-only",
      },
    },
    localProject: {
      workDir,
      syncRequired: false,
    },
    syncStatus: {
      cloudSyncRequired: false,
      entitlement: "paid-only",
      projectSync: "not-configured",
      buildBackup: "not-configured",
    },
    localBuild: {
      vendor,
      target,
      scriptPath,
      workDir,
      artifactPath,
      synthArgv: [
        "pccx",
        "synth",
        "--local",
        "--script",
        scriptPath,
        "--vendor",
        vendor,
        "--work-dir",
        workDir,
        flag,
      ],
      deployArgv: [
        "pccx",
        "deploy",
        "--target",
        target,
        "--artifact",
        artifactPath,
        flag,
      ],
      localToolchain: true,
      offlineSupported: true,
      cloudSyncRequired: false,
    },
    safety: {
      planOnly: true,
      executes: false,
      shellExecution: false,
      providerCalls: false,
      networkCalls: false,
      telemetry: false,
      automaticUpload: false,
      writeBack: false,
    },
  };
}

export function formatLocalSynthesisPlan(plan) {
  return [
    "Local Synthesis Plan",
    `version: ${plan.version}`,
    `vendor: ${plan.localBuild.vendor}`,
    `target: ${plan.localBuild.target}`,
    `offline: ${plan.localBuild.offlineSupported ? "yes" : "no"}`,
    `cloudSyncRequired: ${plan.localBuild.cloudSyncRequired ? "yes" : "no"}`,
    `VS Code: ${plan.surfaces.vscode.commandId} (${plan.surfaces.vscode.execution})`,
    `JetBrains: ${plan.surfaces.jetbrains.actionId} (${plan.surfaces.jetbrains.execution})`,
    `synthArgv: ${plan.localBuild.synthArgv.join(" ")}`,
    `deployArgv: ${plan.localBuild.deployArgv.join(" ")}`,
    "safety: plan-only, no shell execution, no network calls, no upload",
  ].join("\n");
}
