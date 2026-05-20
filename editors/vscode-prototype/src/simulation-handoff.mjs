// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

function selectedFileFromInput(input, vscodeApi) {
  if (typeof input === "string" && input.length > 0) {
    return input;
  }
  if (input?.fsPath) {
    return input.fsPath;
  }
  if (input?.uri?.fsPath) {
    return input.uri.fsPath;
  }
  return vscodeApi?.window?.activeTextEditor?.document?.uri?.fsPath ?? null;
}

export function createSimulationHandoff(input, vscodeApi, options = {}) {
  const selectedFile = selectedFileFromInput(input, vscodeApi);
  const workspaceRoot = options.workspaceRoot
    ?? vscodeApi?.workspace?.workspaceFolders?.[0]?.uri?.fsPath
    ?? null;

  return {
    kind: "systemverilog-simulation-handoff",
    status: selectedFile ? "ready" : "blocked",
    selectedFile,
    workspaceRoot,
    target: "local-validation-boundary",
    executesSimulation: false,
    requiresUserApproval: true,
    writesRtl: false,
    pccxNpuSelfContained: true,
    steps: [
      "use current SystemVerilog file as the handoff source",
      "keep RTL unchanged",
      "run local lint or validation only after an explicit approved command",
      "surface simulator output back as editor diagnostics",
    ],
    blockedReason: selectedFile ? "" : "no active SystemVerilog file",
  };
}
