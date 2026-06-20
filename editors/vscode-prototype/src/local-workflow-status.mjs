// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import {
  createLauncherStatusContractStatus,
} from "./launcher-status-contract.mjs";
import {
  createPccxLabCommandDescriptorStatus,
} from "./pccx-lab-command-descriptor.mjs";
import {
  createDiagnosticsHandoffConsumerBoundaryStatus,
} from "./diagnostics-handoff-consumer.mjs";
import {
  createDiagnosticsHandoffStatusSurface,
} from "./diagnostics-handoff-status-surface.mjs";
import {
  createRuntimeReadinessConsumerBoundaryStatus,
} from "./runtime-readiness-consumer.mjs";
import {
  createRuntimeReadinessStatusSurface,
} from "./runtime-readiness-status-surface.mjs";
import {
  createLocalSynthesisPlan,
} from "./local-synthesis-plan.mjs";

export const LOCAL_WORKFLOW_STATUS_VERSION = "pccx.localWorkflowStatus.v0";

function validationStatusFromCache(cache) {
  if (!cache || typeof cache.status !== "function") {
    return {
      count: 0,
      maxSize: 0,
      latestStatus: "none",
      latestProposalId: "",
      redactionApplied: false,
      truncated: false,
    };
  }
  const status = cache.status();
  return {
    count: status.count,
    maxSize: status.maxSize,
    latestStatus: status.latest?.status ?? "none",
    latestProposalId: status.latest?.proposalId ?? "",
    redactionApplied: status.redactionApplied === true,
    truncated: status.truncated === true,
  };
}

function contextBundleEstimate(input = {}) {
  const contextSummary = input.contextSummary ?? null;
  return {
    itemCount: [
      contextSummary?.diagnosticCount ?? input.diagnosticCount ?? 0,
      contextSummary?.snippetCount ?? input.snippetCount ?? 0,
      contextSummary?.declarationCount ?? input.declarationCount ?? 0,
      contextSummary?.pccxLabOutputCount ?? input.pccxLabOutputCount ?? 0,
      input.validationHistoryCount ?? 0,
      input.launcherStatusCount ?? 0,
      input.labStatusCount ?? 0,
      input.runtimeReadinessBlockerCount ?? 0,
    ].reduce((sum, value) => sum + Math.max(0, Number.isInteger(value) ? value : 0), 0),
    diagnosticCount: contextSummary?.diagnosticCount ?? input.diagnosticCount ?? 0,
    snippetCount: contextSummary?.snippetCount ?? input.snippetCount ?? 0,
    declarationCount: contextSummary?.declarationCount ?? input.declarationCount ?? 0,
    validationHistoryCount: input.validationHistoryCount ?? 0,
  };
}

export function createLocalWorkflowStatus(config = {}, input = {}) {
  const pccxLabBoundary = createPccxLabCommandDescriptorStatus();
  const launcherBoundary = createLauncherStatusContractStatus();
  const diagnosticsHandoffBoundary = createDiagnosticsHandoffConsumerBoundaryStatus();
  const diagnosticsHandoffSurface = createDiagnosticsHandoffStatusSurface(
    input.diagnosticsHandoffSummary,
  );
  const runtimeReadinessBoundary = createRuntimeReadinessConsumerBoundaryStatus();
  const runtimeReadinessSurface = createRuntimeReadinessStatusSurface(
    input.runtimeReadinessSummary,
  );
  const localSynthesisPlan = createLocalSynthesisPlan(input.localSynthesis ?? {});
  const validationCache = validationStatusFromCache(input.validationResultCache);
  const extensionMode = typeof config.mode === "string" ? config.mode : "checkedExample";
  const validationRunner = config.validationRunner ?? {};

  return {
    version: LOCAL_WORKFLOW_STATUS_VERSION,
    kind: "local-workflow-status",
    extensionMode,
    liveWorkspace: {
      enabled: config.liveWorkspace?.enabled === true,
    },
    validationRunner: {
      enabled: validationRunner.enabled === true,
      mode: typeof validationRunner.mode === "string" ? validationRunner.mode : "disabled",
    },
    recentValidation: validationCache,
    pccxLabBoundary: {
      state: pccxLabBoundary.descriptors[0]?.executionState ?? "future",
      descriptorOnly: pccxLabBoundary.descriptorOnly === true,
      executes: pccxLabBoundary.executes === true,
      descriptorCount: pccxLabBoundary.descriptors.length,
    },
    launcherBoundary: {
      state: launcherBoundary.status.launcherStatus,
      fixtureOnly: launcherBoundary.fixtureOnly === true,
      runtimeCalls: launcherBoundary.runtimeCalls === true,
      launcherCalls: launcherBoundary.launcherCalls === true,
    },
    diagnosticsHandoffBoundary: {
      supportedSchemaVersion: diagnosticsHandoffBoundary.supportedSchemaVersion,
      fixtureConsumer: diagnosticsHandoffBoundary.fixtureConsumer === true,
      readOnly: diagnosticsHandoffBoundary.readOnly === true,
      invokesLauncher: diagnosticsHandoffBoundary.invokesLauncher === true,
      invokesPccxLab: diagnosticsHandoffBoundary.invokesPccxLab === true,
      lspImplemented: diagnosticsHandoffBoundary.lspImplemented === true,
      statusSurfaceVersion: diagnosticsHandoffSurface.version,
      surfaceStatus: diagnosticsHandoffSurface.readiness.status,
      summaryAvailable: diagnosticsHandoffSurface.readiness.summaryAvailable === true,
      diagnosticCount: diagnosticsHandoffSurface.diagnostics.count,
    },
    runtimeReadinessBoundary: {
      supportedSchemaVersion: runtimeReadinessBoundary.supportedSchemaVersion,
      expectedStatusAnswer: runtimeReadinessBoundary.expectedStatusAnswer,
      fixtureConsumer: runtimeReadinessBoundary.fixtureConsumer === true,
      readOnly: runtimeReadinessBoundary.readOnly === true,
      invokesLauncher: runtimeReadinessBoundary.invokesLauncher === true,
      invokesPccxLab: runtimeReadinessBoundary.invokesPccxLab === true,
      accessesFpgaRepo: runtimeReadinessBoundary.accessesFpgaRepo === true,
      kv260RuntimeExecution: runtimeReadinessBoundary.kv260RuntimeExecution === true,
      modelExecution: runtimeReadinessBoundary.modelExecution === true,
      providerCalls: runtimeReadinessBoundary.providerCalls === true,
      mcpCalls: runtimeReadinessBoundary.mcpCalls === true,
      lspImplemented: runtimeReadinessBoundary.lspImplemented === true,
      statusSurfaceVersion: runtimeReadinessSurface.version,
      surfaceStatus: runtimeReadinessSurface.readiness.status,
      summaryAvailable: runtimeReadinessSurface.readiness.summaryAvailable === true,
      statusAnswer: runtimeReadinessSurface.readiness.statusAnswer,
      readinessState: runtimeReadinessSurface.readiness.readinessState,
      evidenceState: runtimeReadinessSurface.readiness.evidenceState,
      targetModelId: runtimeReadinessSurface.target.model.modelId,
      targetDevice: runtimeReadinessSurface.target.device,
      timingState: runtimeReadinessSurface.states.timing,
      bitstreamState: runtimeReadinessSurface.states.bitstream,
      implementationState: runtimeReadinessSurface.states.implementation,
      kv260SmokeState: runtimeReadinessSurface.states.kv260Smoke,
      runtimeEvidenceState: runtimeReadinessSurface.states.runtimeEvidence,
      throughputState: runtimeReadinessSurface.states.throughput,
      blockerCount: runtimeReadinessSurface.blockers.count,
    },
    localSynthesisBoundary: {
      version: localSynthesisPlan.version,
      status: "plan-only",
      vendor: localSynthesisPlan.localBuild.vendor,
      target: localSynthesisPlan.localBuild.target,
      offlineSupported: localSynthesisPlan.localBuild.offlineSupported === true,
      cloudSyncRequired: localSynthesisPlan.localBuild.cloudSyncRequired === true,
      vscodeCommandId: localSynthesisPlan.surfaces.vscode.commandId,
      jetbrainsActionId: localSynthesisPlan.surfaces.jetbrains.actionId,
      executes: localSynthesisPlan.safety.executes === true,
      shellExecution: localSynthesisPlan.safety.shellExecution === true,
      networkCalls: localSynthesisPlan.safety.networkCalls === true,
      providerCalls: localSynthesisPlan.safety.providerCalls === true,
      synthArgv: localSynthesisPlan.localBuild.synthArgv,
      deployArgv: localSynthesisPlan.localBuild.deployArgv,
    },
    contextBundle: contextBundleEstimate({
      ...input,
      runtimeReadinessBlockerCount: runtimeReadinessSurface.blockers.count,
    }),
    safety: {
      providerCalls: false,
      launcherCalls: false,
      pccxLabExecution: false,
      fpgaRepoAccess: false,
      kv260RuntimeExecution: false,
      localSynthesisExecution: false,
      networkCalls: false,
      cloudSyncRequired: false,
      mcpCalls: false,
      lspImplemented: false,
      marketplaceFlow: false,
      telemetry: false,
      automaticUpload: false,
      writeBack: false,
    },
  };
}

export function formatLocalWorkflowStatus(status) {
  return [
    "Local Workflow Status",
    `extensionMode: ${status.extensionMode}`,
    `liveWorkspaceEnabled: ${status.liveWorkspace.enabled ? "yes" : "no"}`,
    `validationRunner: ${status.validationRunner.enabled ? "enabled" : "disabled"} (${status.validationRunner.mode})`,
    `recentValidation: ${status.recentValidation.count}/${status.recentValidation.maxSize} latest=${status.recentValidation.latestStatus}`,
    `pccxLabBoundary: ${status.pccxLabBoundary.state} descriptorOnly=${status.pccxLabBoundary.descriptorOnly ? "yes" : "no"}`,
    `launcherBoundary: ${status.launcherBoundary.state} fixtureOnly=${status.launcherBoundary.fixtureOnly ? "yes" : "no"}`,
    `diagnosticsHandoffBoundary: ${status.diagnosticsHandoffBoundary.supportedSchemaVersion} readOnly=${status.diagnosticsHandoffBoundary.readOnly ? "yes" : "no"}`,
    `diagnosticsHandoffSummary: ${status.diagnosticsHandoffBoundary.surfaceStatus} diagnostics=${status.diagnosticsHandoffBoundary.diagnosticCount}`,
    `runtimeReadinessBoundary: ${status.runtimeReadinessBoundary.supportedSchemaVersion} readOnly=${status.runtimeReadinessBoundary.readOnly ? "yes" : "no"}`,
    `runtimeReadinessSummary: ${status.runtimeReadinessBoundary.statusAnswer} readiness=${status.runtimeReadinessBoundary.readinessState} blockers=${status.runtimeReadinessBoundary.blockerCount}`,
    `localSynthesisBoundary: ${status.localSynthesisBoundary.version} vendor=${status.localSynthesisBoundary.vendor} offline=${status.localSynthesisBoundary.offlineSupported ? "yes" : "no"} vscode=yes jetbrains=yes`,
    `contextBundleItems: ${status.contextBundle.itemCount}`,
    "safety: no provider calls, no launcher calls, no pccx-lab execution, no FPGA repo access, no KV260 runtime",
  ].join("\n");
}
