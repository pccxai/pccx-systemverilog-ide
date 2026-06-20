// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";

import {
  LOCAL_WORKFLOW_STATUS_VERSION,
  createLocalWorkflowStatus,
  formatLocalWorkflowStatus,
} from "../src/local-workflow-status.mjs";
import {
  createValidationResultCache,
} from "../src/validation-result-cache.mjs";

function testLocalWorkflowStatusUsesDeterministicLocalDataOnly() {
  const cache = createValidationResultCache({ maxSize: 5 });
  cache.add({
    proposalId: "vscodeAdapterSmoke",
    commandLabel: "VS Code adapter smoke",
    status: "passed",
    exitCode: 0,
    durationMs: 12,
    stdoutSummary: { lines: ["ok"], lineCount: 1, truncated: false },
    stderrSummary: { lines: [], lineCount: 0, truncated: false },
    safety: { allowlisted: true, shell: false, fixedArgs: true },
  });

  const status = createLocalWorkflowStatus(
    {
      mode: "liveWorkspace",
      liveWorkspace: { enabled: true },
      validationRunner: { enabled: true, mode: "allowlisted" },
    },
    {
      validationResultCache: cache,
      contextSummary: {
        diagnosticCount: 2,
        snippetCount: 1,
        declarationCount: 3,
        pccxLabOutputCount: 0,
      },
      validationHistoryCount: 1,
      launcherStatusCount: 1,
      labStatusCount: 1,
    },
  );

  assert.equal(status.version, LOCAL_WORKFLOW_STATUS_VERSION);
  assert.equal(status.kind, "local-workflow-status");
  assert.equal(status.extensionMode, "liveWorkspace");
  assert.equal(status.liveWorkspace.enabled, true);
  assert.deepEqual(status.validationRunner, { enabled: true, mode: "allowlisted" });
  assert.equal(status.recentValidation.count, 1);
  assert.equal(status.recentValidation.maxSize, 5);
  assert.equal(status.recentValidation.latestStatus, "passed");
  assert.equal(status.recentValidation.latestProposalId, "vscodeAdapterSmoke");
  assert.equal(status.pccxLabBoundary.state, "future");
  assert.equal(status.pccxLabBoundary.descriptorOnly, true);
  assert.equal(status.pccxLabBoundary.executes, false);
  assert.equal(status.launcherBoundary.state, "future");
  assert.equal(status.launcherBoundary.fixtureOnly, true);
  assert.equal(status.launcherBoundary.runtimeCalls, false);
  assert.equal(status.diagnosticsHandoffBoundary.supportedSchemaVersion, "pccx.diagnosticsHandoff.v0");
  assert.equal(status.diagnosticsHandoffBoundary.fixtureConsumer, true);
  assert.equal(status.diagnosticsHandoffBoundary.readOnly, true);
  assert.equal(status.diagnosticsHandoffBoundary.invokesLauncher, false);
  assert.equal(status.diagnosticsHandoffBoundary.invokesPccxLab, false);
  assert.equal(status.diagnosticsHandoffBoundary.lspImplemented, false);
  assert.equal(status.diagnosticsHandoffBoundary.surfaceStatus, "available");
  assert.equal(status.diagnosticsHandoffBoundary.summaryAvailable, true);
  assert.equal(status.diagnosticsHandoffBoundary.diagnosticCount, 5);
  assert.equal(status.runtimeReadinessBoundary.supportedSchemaVersion, "pccx.runtimeReadiness.v0");
  assert.equal(status.runtimeReadinessBoundary.expectedStatusAnswer, "blocked_not_yet_evidence_backed");
  assert.equal(status.runtimeReadinessBoundary.fixtureConsumer, true);
  assert.equal(status.runtimeReadinessBoundary.readOnly, true);
  assert.equal(status.runtimeReadinessBoundary.invokesLauncher, false);
  assert.equal(status.runtimeReadinessBoundary.invokesPccxLab, false);
  assert.equal(status.runtimeReadinessBoundary.accessesFpgaRepo, false);
  assert.equal(status.runtimeReadinessBoundary.kv260RuntimeExecution, false);
  assert.equal(status.runtimeReadinessBoundary.modelExecution, false);
  assert.equal(status.runtimeReadinessBoundary.providerCalls, false);
  assert.equal(status.runtimeReadinessBoundary.mcpCalls, false);
  assert.equal(status.runtimeReadinessBoundary.lspImplemented, false);
  assert.equal(status.runtimeReadinessBoundary.surfaceStatus, "available");
  assert.equal(status.runtimeReadinessBoundary.summaryAvailable, true);
  assert.equal(status.runtimeReadinessBoundary.statusAnswer, "blocked_not_yet_evidence_backed");
  assert.equal(status.runtimeReadinessBoundary.readinessState, "blocked");
  assert.equal(status.runtimeReadinessBoundary.evidenceState, "blocked");
  assert.equal(status.runtimeReadinessBoundary.targetModelId, "gemma3n_e4b_placeholder");
  assert.equal(status.runtimeReadinessBoundary.targetDevice, "kv260");
  assert.equal(status.runtimeReadinessBoundary.timingState, "blocked");
  assert.equal(status.runtimeReadinessBoundary.bitstreamState, "blocked");
  assert.equal(status.runtimeReadinessBoundary.implementationState, "blocked");
  assert.equal(status.runtimeReadinessBoundary.kv260SmokeState, "blocked");
  assert.equal(status.runtimeReadinessBoundary.runtimeEvidenceState, "blocked");
  assert.equal(status.runtimeReadinessBoundary.throughputState, "target");
  assert.equal(status.runtimeReadinessBoundary.blockerCount, 6);
  assert.equal(status.localSynthesisBoundary.version, "pccx.localSynthesisPlan.v0");
  assert.equal(status.localSynthesisBoundary.status, "plan-only");
  assert.equal(status.localSynthesisBoundary.vendor, "auto");
  assert.equal(status.localSynthesisBoundary.target, "kv260");
  assert.equal(status.localSynthesisBoundary.offlineSupported, true);
  assert.equal(status.localSynthesisBoundary.cloudSyncRequired, false);
  assert.equal(
    status.localSynthesisBoundary.vscodeCommandId,
    "pccxSystemVerilog.showLocalSynthesisPlan",
  );
  assert.equal(
    status.localSynthesisBoundary.jetbrainsActionId,
    "pccx.systemverilog.showLocalSynthesisPlan",
  );
  assert.equal(status.localSynthesisBoundary.executes, false);
  assert.equal(status.localSynthesisBoundary.shellExecution, false);
  assert.equal(status.localSynthesisBoundary.networkCalls, false);
  assert.equal(status.localSynthesisBoundary.providerCalls, false);
  assert.deepEqual(status.localSynthesisBoundary.synthArgv.slice(0, 3), [
    "pccx",
    "synth",
    "--local",
  ]);
  assert.deepEqual(status.localSynthesisBoundary.deployArgv.slice(0, 4), [
    "pccx",
    "deploy",
    "--target",
    "kv260",
  ]);
  assert.equal(status.contextBundle.itemCount, 15);
  assert.equal(status.safety.providerCalls, false);
  assert.equal(status.safety.launcherCalls, false);
  assert.equal(status.safety.pccxLabExecution, false);
  assert.equal(status.safety.fpgaRepoAccess, false);
  assert.equal(status.safety.kv260RuntimeExecution, false);
  assert.equal(status.safety.localSynthesisExecution, false);
  assert.equal(status.safety.networkCalls, false);
  assert.equal(status.safety.cloudSyncRequired, false);
  assert.equal(status.safety.telemetry, false);
  assert.equal(status.safety.automaticUpload, false);
  assert.equal(status.safety.writeBack, false);
}

function testLocalWorkflowStatusDefaultsAreDisabledAndSafe() {
  const status = createLocalWorkflowStatus({}, {});
  const text = formatLocalWorkflowStatus(status);

  assert.equal(status.extensionMode, "checkedExample");
  assert.equal(status.liveWorkspace.enabled, false);
  assert.deepEqual(status.validationRunner, { enabled: false, mode: "disabled" });
  assert.equal(status.recentValidation.count, 0);
  assert.equal(status.pccxLabBoundary.executes, false);
  assert.equal(status.launcherBoundary.launcherCalls, false);
  assert.equal(status.diagnosticsHandoffBoundary.invokesLauncher, false);
  assert.equal(status.diagnosticsHandoffBoundary.invokesPccxLab, false);
  assert.equal(status.diagnosticsHandoffBoundary.surfaceStatus, "available");
  assert.equal(status.diagnosticsHandoffBoundary.summaryAvailable, true);
  assert.equal(status.runtimeReadinessBoundary.invokesLauncher, false);
  assert.equal(status.runtimeReadinessBoundary.invokesPccxLab, false);
  assert.equal(status.runtimeReadinessBoundary.accessesFpgaRepo, false);
  assert.equal(status.runtimeReadinessBoundary.kv260RuntimeExecution, false);
  assert.equal(status.runtimeReadinessBoundary.statusAnswer, "blocked_not_yet_evidence_backed");
  assert.equal(status.runtimeReadinessBoundary.blockerCount, 6);
  assert.equal(status.localSynthesisBoundary.executes, false);
  assert.equal(status.localSynthesisBoundary.offlineSupported, true);
  assert.equal(status.localSynthesisBoundary.cloudSyncRequired, false);
  assert.match(text, /Local Workflow Status/);
  assert.match(text, /validationRunner: disabled/);
  assert.match(text, /diagnosticsHandoffBoundary: pccx\.diagnosticsHandoff\.v0 readOnly=yes/);
  assert.match(text, /diagnosticsHandoffSummary: available diagnostics=5/);
  assert.match(text, /runtimeReadinessBoundary: pccx\.runtimeReadiness\.v0 readOnly=yes/);
  assert.match(text, /runtimeReadinessSummary: blocked_not_yet_evidence_backed readiness=blocked blockers=6/);
  assert.match(text, /localSynthesisBoundary: pccx\.localSynthesisPlan\.v0 vendor=auto offline=yes vscode=yes jetbrains=yes/);
  assert.match(text, /no pccx-lab execution/);
  assert.match(text, /no FPGA repo access/);
  assert.match(text, /no KV260 runtime/);
  assert.doesNotMatch(JSON.stringify(status), /\/home\/|TOKEN=|model\.gguf/);
}

testLocalWorkflowStatusUsesDeterministicLocalDataOnly();
testLocalWorkflowStatusDefaultsAreDisabledAndSafe();

console.log("vscode local workflow status tests ok");
