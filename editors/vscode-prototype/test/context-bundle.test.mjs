// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";

import {
  CONTEXT_BUNDLE_DEVICE_SESSION_STATUS_VERSION,
  CONTEXT_BUNDLE_DIAGNOSTICS_HANDOFF_VERSION,
  CONTEXT_BUNDLE_RUNTIME_READINESS_VERSION,
  CONTEXT_BUNDLE_VERSION,
  CONTEXT_BUNDLE_XSIM_DIAGNOSTICS_VERSION,
  buildContextBundle,
  summarizeContextBundle,
} from "../src/context-bundle.mjs";
import {
  cloneDefaultDiagnosticsHandoffConsumerSummary,
  createDiagnosticsHandoffStatusSurface,
} from "../src/diagnostics-handoff-status-surface.mjs";
import {
  cloneDefaultDeviceSessionStatusConsumerSummary,
  createDeviceSessionStatusSurface,
} from "../src/device-session-status-surface.mjs";
import {
  cloneDefaultRuntimeReadinessConsumerSummary,
  createRuntimeReadinessStatusSurface,
} from "../src/runtime-readiness-status-surface.mjs";
import {
  cloneDefaultXsimDiagnosticsSummary,
  createXsimDiagnosticsStatusSurface,
} from "../src/xsim-diagnostics-status-surface.mjs";

const SECRET_KEY_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b/i;

function assertNoSecretLikeKeys(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertNoSecretLikeKeys(item);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    assert.doesNotMatch(key, SECRET_KEY_PATTERN);
    assertNoSecretLikeKeys(child);
  }
}

function fixtureInput() {
  return {
    workspaceRoot: "/repo",
    selectedFilePath: "/repo/rtl/top.sv",
    selectedRange: {
      start: { line: 10, character: 2 },
      end: { line: 12, character: 8 },
    },
    selectedSymbol: {
      name: "top",
      kind: "module",
      path: "/repo/rtl/top.sv",
      range: {
        start: { line: 10, character: 0 },
        end: { line: 10, character: 3 },
      },
    },
    selectedSymbolContext: {
      version: "pccx.selectedSymbolContext.v0",
      path: "/repo/rtl/top.sv",
      language: "systemverilog",
      symbolText: "top",
      lexicalKind: "module",
      range: {
        start: { line: 10, character: 0 },
        end: { line: 10, character: 3 },
      },
      cursor: { line: 10, character: 1 },
      currentLine: {
        number: 11,
        text: "module top;",
        truncated: false,
      },
      selectionSummary: {
        lineCount: 1,
        characterCount: 3,
        previewLines: ["top"],
        truncated: false,
      },
      enclosingDeclaration: {
        name: "top",
        kind: "module",
        path: "/repo/rtl/top.sv",
        line: 11,
        column: 1,
        range: {
          start: { line: 10, character: 0 },
          end: { line: 10, character: 3 },
        },
      },
      relatedNavigation: [
        { name: "top", kind: "module", file: "/repo/rtl/top.sv", line: 11, column: 1 },
      ],
      nearbyDiagnostics: [
        { file: "/repo/rtl/top.sv", message: "near selected symbol" },
      ],
      analysis: {
        kind: "lexical",
        semanticResolution: false,
      },
    },
    activeDiagnostics: [
      {
        file: "/repo/rtl/z.sv",
        severity: "Warning",
        message: "late declaration",
        range: {
          start: { line: 4, character: 1 },
          end: { line: 4, character: 5 },
        },
      },
      {
        file: "/repo/rtl/a.sv",
        severity: "Error",
        message: "missing endmodule",
        range: {
          start: { line: 1, character: 0 },
          end: { line: 1, character: 6 },
        },
      },
    ],
    symbolContext: {
      declarations: [
        { name: "z_mod", kind: "module", file: "/repo/rtl/z.sv", line: 5, column: 1 },
        { name: "a_mod", kind: "module", file: "/repo/rtl/a.sv", line: 1, column: 1 },
      ],
    },
    files: [
      {
        path: "/repo/rtl/z.sv",
        text: "module z_mod;\nendmodule\n",
      },
      {
        path: "/repo/rtl/a.sv",
        text: "module a_mod;\nAPI_KEY=abc123\nendmodule\n",
      },
      {
        path: "/repo/node_modules/pkg/ignored.sv",
        text: "module ignored;\nendmodule\n",
      },
      {
        path: "/repo/.vscode-test/cache/ignored.sv",
        text: "module cache_ignored;\nendmodule\n",
      },
      {
        path: "/repo/rtl/binary.sv",
        text: "module bad;\0endmodule\n",
      },
      {
        path: "/repo/.private-agent/private-worker/notes.md",
        text: "private worker instruction\n",
      },
      {
        path: "/repo/AGENTS.md",
        text: "private worker instruction\n",
      },
      {
        path: "/repo/package-lock.json",
        text: "{\"packages\":{}}\n",
      },
    ],
    configuration: {
      mode: "checkedExample",
      liveWorkspace: { enabled: false },
      workflowBoundary: { enabled: false, backend: "none" },
      pccxLab: { commandBoundary: "pccx_ide_cli" },
      validationRunner: {
        enabled: false,
        mode: "disabled",
        defaultWorkingDirectory: "repo-root",
        maxOutputLines: 120,
        timeoutMs: 30000,
      },
    },
    recentCommandStatus: {
      commandId: "pccxSystemVerilog.publishCheckedExampleDiagnostics",
      ok: true,
      actionKind: "diagnostics",
      summary: "1 diagnostic(s)",
      facade: { command: "diagnostics", mode: "example" },
      diagnosticCount: 1,
      navigationItemCount: 0,
    },
    recentValidation: {
      version: "pccx.validationResultCacheEntry.v0",
      proposalId: "vscodeAdapterSmoke",
      label: "VS Code adapter smoke",
      status: "failed",
      summaryText: "VS Code adapter smoke failed (exit 1)",
      exitCode: 1,
      durationMs: 55,
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:00.055Z",
      commandKind: "allowlisted-validation-proposal",
      workingDirectoryKind: "repo-root",
      command: "bash",
      args: ["scripts/vscode-adapter-smoke.sh"],
      stdoutSummary: {
        lines: ["adapter ok", "API_KEY=abc123", "extra"],
        lineCount: 3,
        truncated: true,
      },
      stderrSummary: {
        lines: ["failure: missing endmodule"],
        lineCount: 1,
        truncated: false,
      },
      truncated: true,
      redactionApplied: true,
      failureHints: ["failure: missing endmodule"],
      safety: {
        allowlisted: true,
        shell: false,
        fixedArgs: true,
        userProvidedCommand: false,
        writesFiles: false,
        providerCalls: false,
        launcherCalls: false,
        mcpServerCalls: false,
      },
    },
    recentValidationHistory: [
      {
        version: "pccx.validationResultCacheEntry.v0",
        proposalId: "vscodeAdapterSmoke",
        label: "VS Code adapter smoke",
        status: "failed",
        summaryText: "VS Code adapter smoke failed (exit 1)",
        exitCode: 1,
        durationMs: 55,
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: "2026-01-01T00:00:00.055Z",
        commandKind: "allowlisted-validation-proposal",
        workingDirectoryKind: "repo-root",
        stdoutSummary: {
          lines: ["adapter ok"],
          lineCount: 1,
          truncated: false,
        },
        stderrSummary: {
          lines: ["failure: missing endmodule"],
          lineCount: 1,
          truncated: false,
        },
        truncated: false,
        redactionApplied: false,
      },
      {
        version: "pccx.validationResultCacheEntry.v0",
        proposalId: "editorBridgeSmoke",
        label: "Editor bridge smoke",
        status: "passed",
        summaryText: "Editor bridge smoke passed",
        exitCode: 0,
        durationMs: 12,
        startedAt: "2026-01-01T00:01:00.000Z",
        finishedAt: "2026-01-01T00:01:00.012Z",
        commandKind: "allowlisted-validation-proposal",
        workingDirectoryKind: "repo-root",
        stdoutSummary: {
          lines: ["bridge ok"],
          lineCount: 1,
          truncated: false,
        },
        stderrSummary: {
          lines: [],
          lineCount: 0,
          truncated: false,
        },
        truncated: false,
        redactionApplied: false,
      },
    ],
    xsimDiagnosticsSummary: cloneDefaultXsimDiagnosticsSummary(),
    diagnosticsHandoffSummary: cloneDefaultDiagnosticsHandoffConsumerSummary(),
    runtimeReadinessSummary: cloneDefaultRuntimeReadinessConsumerSummary(),
    deviceSessionStatusSummary: cloneDefaultDeviceSessionStatusConsumerSummary(),
    pccxLabOutputs: [
      {
        flow: "problems from-check",
        exitCode: 1,
        summaryLines: ["token=hidden", "missing endmodule"],
      },
    ],
    userIntent: "explain active diagnostics",
  };
}

function testStableBoundedShape() {
  const bundle = buildContextBundle(fixtureInput(), {
    workspaceRoot: "/repo",
    limits: {
      maxFiles: 2,
      maxDiagnostics: 1,
      maxSnippetLines: 2,
      maxLogSummaryLines: 1,
    },
  });

  assert.equal(bundle.version, CONTEXT_BUNDLE_VERSION);
  assert.equal(bundle.source, "pccx-systemverilog-ide");
  assert.equal(bundle.configuration.mode, "checkedExample");
  assert.equal(bundle.configuration.workflowBoundary.backend, "none");
  assert.deepEqual(bundle.selectedFile, { path: "rtl/top.sv" });
  assert.deepEqual(Object.keys(bundle.symbols.selected), ["name", "kind", "path", "range"]);
  assert.equal(bundle.symbols.selected.name, "top");
  assert.equal(bundle.symbols.selected.kind, "module");
  assert.equal(bundle.symbols.selected.path, "rtl/top.sv");
  assert.equal(bundle.symbols.selectedContext.symbolText, "top");
  assert.equal(bundle.symbols.selectedContext.lexicalKind, "module");
  assert.equal(bundle.symbols.selectedContext.analysis.semanticResolution, false);
  assert.equal(bundle.symbols.selectedContext.relatedNavigation.length, 1);
  assert.equal(bundle.symbols.selectedContext.nearbyDiagnostics.length, 1);
  assert.equal(bundle.diagnostics.length, 1);
  assert.equal(bundle.diagnostics[0].path, "rtl/a.sv");
  assert.equal(bundle.snippets.length, 2);
  assert.deepEqual(bundle.snippets.map((snippet) => snippet.path), ["rtl/a.sv", "rtl/z.sv"]);
  assert.ok(bundle.snippets.every((snippet) => snippet.lines.length <= 2));
  assert.equal(bundle.validation.recent.status, "failed");
  assert.equal(bundle.validation.recent.proposalId, "vscodeAdapterSmoke");
  assert.equal(bundle.validation.recent.commandLabel, "VS Code adapter smoke");
  assert.equal(bundle.validation.recent.label, "VS Code adapter smoke");
  assert.equal(bundle.validation.recent.commandKind, "allowlisted-validation-proposal");
  assert.equal(bundle.validation.recent.workingDirectoryKind, "repo-root");
  assert.equal(bundle.validation.recent.stdoutSummary.lines.length, 1);
  assert.deepEqual(bundle.validation.recent.stdoutSummary.lines, ["adapter ok"]);
  assert.deepEqual(bundle.validation.recent.stderrSummary.lines, ["failure: missing endmodule"]);
  assert.equal(bundle.validation.recent.truncated, true);
  assert.equal(bundle.validation.recent.redactionApplied, true);
  assert.equal(bundle.validation.recent.safety.allowlisted, true);
  assert.equal(bundle.validation.recent.safety.shell, false);
  assert.equal(bundle.validation.recentHistory.length, 2);
  assert.deepEqual(bundle.validation.historyPolicy, {
    maxResults: 5,
    summaryOnly: true,
    fullLogsExcluded: true,
  });
  assert.deepEqual(
    bundle.validation.recentHistory.map((entry) => entry.proposalId),
    ["vscodeAdapterSmoke", "editorBridgeSmoke"],
  );
  assert.equal(bundle.recentCommand.commandId, "pccxSystemVerilog.publishCheckedExampleDiagnostics");
  assert.equal(bundle.recentCommand.facade.mode, "example");
  assert.equal(bundle.pccxLab.outputs.length, 1);
  assert.deepEqual(bundle.pccxLab.outputs[0].lines, ["[redacted]"]);
  assert.equal(bundle.xsimDiagnostics.version, CONTEXT_BUNDLE_XSIM_DIAGNOSTICS_VERSION);
  assert.equal(bundle.xsimDiagnostics.kind, "xsim-diagnostics-context");
  assert.equal(bundle.xsimDiagnostics.status, "available");
  assert.equal(bundle.xsimDiagnostics.summaryAvailable, true);
  assert.equal(bundle.xsimDiagnostics.source.adapterOutput, true);
  assert.equal(bundle.xsimDiagnostics.source.rawProblemsParsedByUi, false);
  assert.equal(bundle.xsimDiagnostics.source.rawLogParsedByUi, false);
  assert.equal(bundle.xsimDiagnostics.xsimLog.sourceKind, "xsim-log");
  assert.equal(bundle.xsimDiagnostics.xsimLog.tool, "pccx-ide-cli");
  assert.equal(bundle.xsimDiagnostics.diagnostics.count, 5);
  assert.equal(bundle.xsimDiagnostics.diagnostics.bySeverity.error, 2);
  assert.equal(bundle.xsimDiagnostics.diagnostics.bySeverity.warning, 2);
  assert.equal(bundle.xsimDiagnostics.diagnostics.bySeverity.info, 1);
  assert.equal(bundle.xsimDiagnostics.diagnostics.locatedCount, 2);
  assert.equal(bundle.xsimDiagnostics.diagnostics.unlocatedCount, 3);
  assert.equal(bundle.xsimDiagnostics.diagnostics.codedCount, 2);
  assert.equal(bundle.xsimDiagnostics.files.count, 2);
  assert.equal(bundle.xsimDiagnostics.files.items.length, 2);
  assert.equal(bundle.xsimDiagnostics.safety.dataOnly, true);
  assert.equal(bundle.xsimDiagnostics.safety.readOnly, true);
  assert.equal(bundle.xsimDiagnostics.safety.existingLogOnly, true);
  assert.equal(bundle.xsimDiagnostics.safety.rawLogIncluded, false);
  assert.equal(bundle.xsimDiagnostics.safety.rawLineEcho, false);
  assert.equal(bundle.xsimDiagnostics.safety.xsimExecution, false);
  assert.equal(bundle.xsimDiagnostics.safety.vivadoExecution, false);
  assert.equal(bundle.xsimDiagnostics.safety.pccxLabExecution, false);
  assert.equal(bundle.xsimDiagnostics.safety.launcherExecution, false);
  assert.equal(bundle.xsimDiagnostics.safety.shellExecution, false);
  assert.equal(bundle.xsimDiagnostics.safety.hardwareAccess, false);
  assert.equal(bundle.xsimDiagnostics.safety.kv260Access, false);
  assert.equal(bundle.xsimDiagnostics.safety.providerCalls, false);
  assert.equal(bundle.xsimDiagnostics.safety.mcpCalls, false);
  assert.equal(bundle.xsimDiagnostics.safety.lspImplemented, false);
  assert.equal(bundle.diagnosticsHandoff.version, CONTEXT_BUNDLE_DIAGNOSTICS_HANDOFF_VERSION);
  assert.equal(bundle.diagnosticsHandoff.kind, "diagnostics-handoff-context");
  assert.equal(bundle.diagnosticsHandoff.status, "available");
  assert.equal(bundle.diagnosticsHandoff.summaryAvailable, true);
  assert.equal(bundle.diagnosticsHandoff.source.adapterOutput, true);
  assert.equal(bundle.diagnosticsHandoff.source.rawHandoffParsedByUi, false);
  assert.equal(bundle.diagnosticsHandoff.handoff.schemaVersion, "pccx.diagnosticsHandoff.v0");
  assert.equal(bundle.diagnosticsHandoff.handoff.handoffKind, "read_only_handoff");
  assert.equal(bundle.diagnosticsHandoff.diagnostics.count, 5);
  assert.equal(bundle.diagnosticsHandoff.diagnostics.bySeverity.blocked, 2);
  assert.equal(bundle.diagnosticsHandoff.descriptorRefs.referenceKind, "descriptor_ref_only");
  assert.equal(bundle.diagnosticsHandoff.safety.dataOnly, true);
  assert.equal(bundle.diagnosticsHandoff.safety.readOnly, true);
  assert.equal(bundle.diagnosticsHandoff.safety.launcherExecution, false);
  assert.equal(bundle.diagnosticsHandoff.safety.pccxLabExecution, false);
  assert.equal(bundle.diagnosticsHandoff.safety.pccxLabValidatorInvocation, false);
  assert.equal(bundle.diagnosticsHandoff.safety.shellExecution, false);
  assert.equal(bundle.diagnosticsHandoff.safety.providerCalls, false);
  assert.equal(bundle.diagnosticsHandoff.safety.runtimeCalls, false);
  assert.equal(bundle.diagnosticsHandoff.safety.mcpCalls, false);
  assert.equal(bundle.diagnosticsHandoff.safety.lspImplemented, false);
  assert.equal(bundle.runtimeReadiness.version, CONTEXT_BUNDLE_RUNTIME_READINESS_VERSION);
  assert.equal(bundle.runtimeReadiness.kind, "runtime-readiness-context");
  assert.equal(bundle.runtimeReadiness.status, "available");
  assert.equal(bundle.runtimeReadiness.summaryAvailable, true);
  assert.equal(bundle.runtimeReadiness.source.adapterOutput, true);
  assert.equal(bundle.runtimeReadiness.source.rawReadinessParsedByUi, false);
  assert.equal(bundle.runtimeReadiness.fixture.schemaVersion, "pccx.runtimeReadiness.v0");
  assert.equal(bundle.runtimeReadiness.readiness.statusAnswer, "blocked_not_yet_evidence_backed");
  assert.equal(bundle.runtimeReadiness.readiness.readinessState, "blocked");
  assert.equal(bundle.runtimeReadiness.readiness.evidenceState, "blocked");
  assert.equal(bundle.runtimeReadiness.target.model.modelId, "gemma3n_e4b_placeholder");
  assert.equal(bundle.runtimeReadiness.target.device, "kv260");
  assert.equal(bundle.runtimeReadiness.states.timing, "blocked");
  assert.equal(bundle.runtimeReadiness.states.bitstream, "blocked");
  assert.equal(bundle.runtimeReadiness.states.implementation, "blocked");
  assert.equal(bundle.runtimeReadiness.states.kv260Smoke, "blocked");
  assert.equal(bundle.runtimeReadiness.states.runtimeEvidence, "blocked");
  assert.equal(bundle.runtimeReadiness.states.throughput, "target");
  assert.equal(bundle.runtimeReadiness.blockers.count, 6);
  assert.equal(bundle.runtimeReadiness.safety.dataOnly, true);
  assert.equal(bundle.runtimeReadiness.safety.readOnly, true);
  assert.equal(bundle.runtimeReadiness.safety.launcherExecution, false);
  assert.equal(bundle.runtimeReadiness.safety.pccxLabExecution, false);
  assert.equal(bundle.runtimeReadiness.safety.fpgaRepoAccess, false);
  assert.equal(bundle.runtimeReadiness.safety.kv260RuntimeExecution, false);
  assert.equal(bundle.runtimeReadiness.safety.runtimeExecution, false);
  assert.equal(bundle.runtimeReadiness.safety.modelExecution, false);
  assert.equal(bundle.runtimeReadiness.safety.providerCalls, false);
  assert.equal(bundle.runtimeReadiness.safety.mcpCalls, false);
  assert.equal(bundle.runtimeReadiness.safety.lspImplemented, false);
  assert.equal(bundle.deviceSessionStatus.version, CONTEXT_BUNDLE_DEVICE_SESSION_STATUS_VERSION);
  assert.equal(bundle.deviceSessionStatus.kind, "device-session-status-context");
  assert.equal(bundle.deviceSessionStatus.status, "available");
  assert.equal(bundle.deviceSessionStatus.summaryAvailable, true);
  assert.equal(bundle.deviceSessionStatus.source.adapterOutput, true);
  assert.equal(bundle.deviceSessionStatus.source.rawStatusParsedByUi, false);
  assert.equal(bundle.deviceSessionStatus.fixture.schemaVersion, "pccx.deviceSessionStatus.v0");
  assert.equal(
    bundle.deviceSessionStatus.deviceSession.statusAnswer,
    "device_session_status_placeholder_blocked",
  );
  assert.equal(bundle.deviceSessionStatus.states.connection, "not_configured");
  assert.equal(bundle.deviceSessionStatus.states.discovery, "not_started");
  assert.equal(bundle.deviceSessionStatus.states.authentication, "not_configured");
  assert.equal(bundle.deviceSessionStatus.states.runtime, "planned");
  assert.equal(bundle.deviceSessionStatus.states.modelLoad, "not_loaded");
  assert.equal(bundle.deviceSessionStatus.states.session, "inactive");
  assert.equal(bundle.deviceSessionStatus.states.logStream, "not_started");
  assert.equal(bundle.deviceSessionStatus.states.readiness, "blocked");
  assert.equal(bundle.deviceSessionStatus.target.model, "gemma3n-e4b");
  assert.equal(bundle.deviceSessionStatus.target.device, "kv260");
  assert.equal(bundle.deviceSessionStatus.statusPanel.rowCount, 5);
  assert.equal(bundle.deviceSessionStatus.statusPanel.rows.length, 5);
  assert.equal(bundle.deviceSessionStatus.counts.discoveryPaths, 3);
  assert.equal(bundle.deviceSessionStatus.counts.flowSteps, 8);
  assert.equal(bundle.deviceSessionStatus.counts.errors, 9);
  assert.equal(bundle.deviceSessionStatus.counts.errorsBySeverity.blocked, 6);
  assert.equal(bundle.deviceSessionStatus.pccxLabDiagnostics.executesPccxLab, false);
  assert.equal(bundle.deviceSessionStatus.safety.dataOnly, true);
  assert.equal(bundle.deviceSessionStatus.safety.readOnly, true);
  assert.equal(bundle.deviceSessionStatus.safety.launcherExecution, false);
  assert.equal(bundle.deviceSessionStatus.safety.pccxLabExecution, false);
  assert.equal(bundle.deviceSessionStatus.safety.pccxLabValidatorInvocation, false);
  assert.equal(bundle.deviceSessionStatus.safety.touchesHardware, false);
  assert.equal(bundle.deviceSessionStatus.safety.kv260Access, false);
  assert.equal(bundle.deviceSessionStatus.safety.opensSerialPort, false);
  assert.equal(bundle.deviceSessionStatus.safety.networkCalls, false);
  assert.equal(bundle.deviceSessionStatus.safety.networkScan, false);
  assert.equal(bundle.deviceSessionStatus.safety.sshExecution, false);
  assert.equal(bundle.deviceSessionStatus.safety.runtimeExecution, false);
  assert.equal(bundle.deviceSessionStatus.safety.modelLoaded, false);
  assert.equal(bundle.deviceSessionStatus.safety.modelExecution, false);
  assert.equal(bundle.deviceSessionStatus.safety.providerCalls, false);
  assert.equal(bundle.deviceSessionStatus.safety.mcpCalls, false);
  assert.equal(bundle.deviceSessionStatus.safety.lspImplemented, false);
  assert.ok(bundle.excludedPathPatterns.includes("agent-instruction-files"));
  assert.equal(bundle.redaction.assignmentPolicy, "secret-like-lines-redacted");
  assert.deepEqual(summarizeContextBundle(bundle), {
    version: CONTEXT_BUNDLE_VERSION,
    selectedFile: { path: "rtl/top.sv" },
    selectedSymbol: {
      name: "top",
      kind: "module",
      path: "rtl/top.sv",
    },
    diagnosticCount: 1,
    snippetCount: 2,
    declarationCount: 2,
    pccxLabOutputCount: 1,
    validation: {
      proposalId: "vscodeAdapterSmoke",
      status: "failed",
      label: "VS Code adapter smoke",
      recentHistoryCount: 2,
    },
    xsimDiagnostics: {
      status: "available",
      sourceKind: "xsim-log",
      diagnosticCount: 5,
      errorCount: 2,
      warningCount: 2,
      locatedCount: 2,
      readOnly: true,
    },
    diagnosticsHandoff: {
      status: "available",
      schemaVersion: "pccx.diagnosticsHandoff.v0",
      diagnosticCount: 5,
      blockedCount: 2,
      readOnly: true,
    },
    runtimeReadiness: {
      status: "available",
      statusAnswer: "blocked_not_yet_evidence_backed",
      readinessState: "blocked",
      evidenceState: "blocked",
      targetDevice: "kv260",
      blockerCount: 6,
      readOnly: true,
    },
    deviceSessionStatus: {
      status: "available",
      statusAnswer: "device_session_status_placeholder_blocked",
      connectionState: "not_configured",
      sessionState: "inactive",
      readinessState: "blocked",
      targetDevice: "kv260",
      statusRowCount: 5,
      errorCount: 9,
      readOnly: true,
    },
  });
}

function testDeterministicOrdering() {
  const input = fixtureInput();
  const reversed = {
    ...input,
    activeDiagnostics: [...input.activeDiagnostics].reverse(),
    files: [...input.files].reverse(),
    symbolContext: {
      declarations: [...input.symbolContext.declarations].reverse(),
    },
  };

  assert.deepEqual(
    buildContextBundle(input, { workspaceRoot: "/repo" }),
    buildContextBundle(reversed, { workspaceRoot: "/repo" }),
  );
}

function testSelectedFileSnippetAndDiagnosticsArePrioritized() {
  const bundle = buildContextBundle(
    {
      workspaceRoot: "/repo",
      selectedFilePath: "/repo/rtl/z_selected.sv",
      selectedRange: {
        start: { line: 7, character: 0 },
        end: { line: 9, character: 0 },
      },
      files: [
        { path: "/repo/rtl/a_first.sv", text: "module a_first;\nendmodule\n" },
        { path: "/repo/rtl/z_selected.sv", text: "module z_selected;\nendmodule\n" },
      ],
      activeDiagnostics: [
        {
          file: "/repo/rtl/a_first.sv",
          message: "unrelated",
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 },
          },
        },
        {
          file: "/repo/rtl/z_selected.sv",
          message: "selected range diagnostic",
          range: {
            start: { line: 8, character: 0 },
            end: { line: 8, character: 1 },
          },
        },
      ],
    },
    {
      workspaceRoot: "/repo",
      limits: {
        maxFiles: 1,
        maxDiagnostics: 1,
      },
    },
  );

  assert.deepEqual(bundle.snippets.map((snippet) => snippet.path), ["rtl/z_selected.sv"]);
  assert.deepEqual(bundle.diagnostics.map((diagnostic) => diagnostic.path), ["rtl/z_selected.sv"]);
  assert.equal(bundle.diagnostics[0].message, "selected range diagnostic");
}

function testInvalidSelectedSymbolAndRangesAreControlled() {
  const bundle = buildContextBundle(
    {
      workspaceRoot: "/repo",
      selectedFilePath: "/repo/rtl/top.sv",
      selectedRange: {
        start: { line: 5, character: 10 },
        end: { line: 4, character: 1 },
      },
      selectedSymbol: {
        name: "ignored",
        kind: "module",
        path: "/repo/node_modules/pkg/ignored.sv",
      },
    },
    { workspaceRoot: "/repo" },
  );

  assert.deepEqual(bundle.selectedRange, {
    start: { line: 5, character: 10 },
    end: { line: 5, character: 10 },
  });
  assert.equal(bundle.symbols.selected, null);
}

function testLongSingleLineSnippetReportsTruncation() {
  const bundle = buildContextBundle(
    {
      workspaceRoot: "/repo",
      selectedFilePath: "/repo/rtl/top.sv",
      files: [
        { path: "/repo/rtl/top.sv", text: "module top; " + "x".repeat(200) },
      ],
    },
    {
      workspaceRoot: "/repo",
      limits: {
        maxTextCharacters: 24,
        maxSnippetLines: 10,
      },
    },
  );

  assert.equal(bundle.snippets.length, 1);
  assert.equal(bundle.snippets[0].truncated, true);
  assert.ok(bundle.snippets[0].lines[0].length <= 24);
}

function testNoHugeFileOrRestrictedPathInclusion() {
  const hugeText = Array.from({ length: 100 }, (_, index) => `line ${index}`).join("\n");
  const bundle = buildContextBundle(
    {
      workspaceRoot: "/repo",
      files: [
        { path: "/repo/rtl/huge.sv", text: hugeText },
        { path: "/repo/node_modules/pkg/ignored.sv", text: hugeText },
        { path: "/repo/.vscode-test/ignored.sv", text: hugeText },
        { path: "/repo/AGENTS.md", text: hugeText },
        { path: "/repo/package-lock.json", text: hugeText },
        { path: "/repo/.git/config", text: hugeText },
        { path: "/repo/.private-agent/notes.md", text: hugeText },
        { path: "/repo/private-worker/notes.md", text: hugeText },
        { path: "/repo/worker-instruction/notes.md", text: hugeText },
        { path: "/repo/subagent-instruction/notes.md", text: hugeText },
        { path: "/repo/rtl/api-token.sv", text: hugeText },
      ],
      activeDiagnostics: [
        { file: "/repo/node_modules/pkg/ignored.sv", message: "ignored" },
        { file: "/repo/.vscode-test/ignored.sv", message: "ignored" },
        { file: "/repo/rtl/client_secret.sv", message: "ignored" },
      ],
    },
    {
      workspaceRoot: "/repo",
      limits: { maxSnippetLines: 5 },
    },
  );

  assert.deepEqual(bundle.snippets.map((snippet) => snippet.path), ["rtl/huge.sv"]);
  assert.equal(bundle.snippets[0].lines.length, 5);
  assert.equal(bundle.snippets[0].truncated, true);
  assert.deepEqual(bundle.diagnostics, []);
}

function testValidationHistoryIsSummaryOnlyAndBounded() {
  const bundle = buildContextBundle(
    {
      workspaceRoot: "/repo",
      recentValidationHistory: [
        {
          proposalId: "newest",
          label: "Newest",
          status: "failed",
          summaryText: "failed without full logs",
          exitCode: 1,
          commandKind: "allowlisted-validation-proposal",
          workingDirectoryKind: "repo-root",
          command: "bash",
          args: ["scripts/private.sh"],
          fullStdout: "full log must not flow",
          stdoutSummary: {
            lines: [
              "line one",
              "TOKEN=hidden",
              "/home/dev/private/path.sv",
              "line four",
            ],
            lineCount: 4,
            truncated: false,
          },
          stderrSummary: {
            lines: ["failure"],
            lineCount: 1,
            truncated: false,
          },
        },
        {
          proposalId: "older",
          label: "Older",
          status: "passed",
          stdoutSummary: { lines: ["ok"], lineCount: 1, truncated: false },
          stderrSummary: { lines: [], lineCount: 0, truncated: false },
        },
      ],
    },
    {
      workspaceRoot: "/repo",
      limits: {
        maxLogSummaryLines: 2,
        maxRecentValidationResults: 1,
      },
    },
  );
  const serialized = JSON.stringify(bundle.validation);

  assert.equal(bundle.validation.recent.proposalId, "newest");
  assert.equal(bundle.validation.recentHistory.length, 1);
  assert.deepEqual(bundle.validation.recentHistory[0].stdoutSummary.lines, ["line one", "[redacted]"]);
  assert.equal(bundle.validation.recentHistory[0].stdoutSummary.truncated, true);
  assert.doesNotMatch(serialized, /full log must not flow/);
  assert.doesNotMatch(serialized, /scripts\/private\.sh/);
  assert.doesNotMatch(serialized, /TOKEN=hidden/);
  assert.doesNotMatch(serialized, /\/home\/dev/);
  assert.doesNotMatch(serialized, /line four/);
}

function testNoSecretValuesOrSecretLikeKeys() {
  const bundle = buildContextBundle(fixtureInput(), { workspaceRoot: "/repo" });
  const serialized = JSON.stringify(bundle);

  assertNoSecretLikeKeys(bundle);
  assert.doesNotMatch(serialized, /abc123/);
  assert.doesNotMatch(serialized, /API_KEY=/);
  assert.doesNotMatch(serialized, /token=hidden/);
  assert.doesNotMatch(serialized, /API_KEY=abc123/);
  assert.doesNotMatch(serialized, /scripts\/vscode-adapter-smoke\.sh/);
  assert.doesNotMatch(serialized, /AGENTS\.md/);
  assert.doesNotMatch(serialized, /package-lock\.json/);
}

function testNoAbsoluteHomePathLeakage() {
  const bundle = buildContextBundle(
    {
      workspaceRoot: "/home/dev/work/repo",
      selectedFilePath: "/home/dev/work/repo/rtl/top.sv",
      files: [
        { path: "/home/dev/work/repo/rtl/top.sv", text: "module top;\nendmodule\n" },
        { path: "/home/dev/.ssh/config", text: "Host example\n" },
      ],
      activeDiagnostics: [
        { file: "/home/dev/work/repo/rtl/top.sv", message: "inside" },
        { file: "/home/dev/outside.sv", message: "outside" },
      ],
    },
    { workspaceRoot: "/home/dev/work/repo" },
  );
  const serialized = JSON.stringify(bundle);

  assert.deepEqual(bundle.selectedFile, { path: "rtl/top.sv" });
  assert.equal(bundle.snippets.length, 1);
  assert.equal(bundle.diagnostics.length, 1);
  assert.doesNotMatch(serialized, /\/home\/dev/);
  assert.doesNotMatch(serialized, /\.ssh/);
}

function testNoActiveEditorContextShape() {
  const bundle = buildContextBundle({}, {});

  assert.equal(bundle.selectedFile, null);
  assert.equal(bundle.selectedRange, null);
  assert.deepEqual(bundle.diagnostics, []);
  assert.deepEqual(bundle.snippets, []);
  assert.equal(bundle.recentCommand, null);
  assert.equal(bundle.configuration.mode, "unknown");
  assert.equal(bundle.xsimDiagnostics.status, "notAvailable");
  assert.equal(bundle.xsimDiagnostics.summaryAvailable, false);
  assert.equal(bundle.xsimDiagnostics.safety.readOnly, true);
  assert.equal(bundle.xsimDiagnostics.safety.existingLogOnly, true);
  assert.equal(bundle.xsimDiagnostics.safety.xsimExecution, false);
  assert.equal(bundle.xsimDiagnostics.safety.vivadoExecution, false);
  assert.equal(bundle.diagnosticsHandoff.status, "notAvailable");
  assert.equal(bundle.diagnosticsHandoff.summaryAvailable, false);
  assert.equal(bundle.diagnosticsHandoff.safety.readOnly, true);
  assert.equal(bundle.diagnosticsHandoff.safety.launcherExecution, false);
  assert.equal(bundle.runtimeReadiness.status, "notAvailable");
  assert.equal(bundle.runtimeReadiness.summaryAvailable, false);
  assert.equal(bundle.runtimeReadiness.safety.readOnly, true);
  assert.equal(bundle.runtimeReadiness.safety.launcherExecution, false);
  assert.equal(bundle.runtimeReadiness.safety.fpgaRepoAccess, false);
  assert.equal(bundle.deviceSessionStatus.status, "notAvailable");
  assert.equal(bundle.deviceSessionStatus.summaryAvailable, false);
  assert.equal(bundle.deviceSessionStatus.safety.readOnly, true);
  assert.equal(bundle.deviceSessionStatus.safety.launcherExecution, false);
  assert.equal(bundle.deviceSessionStatus.safety.kv260Access, false);
  assert.equal(bundle.deviceSessionStatus.safety.opensSerialPort, false);
}

function testXsimDiagnosticsStatusSurfaceInputIsAccepted() {
  const surface = createXsimDiagnosticsStatusSurface(
    cloneDefaultXsimDiagnosticsSummary(),
  );
  const bundle = buildContextBundle({ xsimDiagnosticsStatus: surface }, {});

  assert.equal(bundle.xsimDiagnostics.status, "available");
  assert.equal(bundle.xsimDiagnostics.source.adapterOutput, true);
  assert.equal(bundle.xsimDiagnostics.source.rawProblemsParsedByUi, false);
  assert.equal(bundle.xsimDiagnostics.source.rawLogParsedByUi, false);
  assert.equal(bundle.xsimDiagnostics.diagnostics.count, 5);
  assert.equal(bundle.xsimDiagnostics.diagnostics.bySeverity.error, 2);
  assert.equal(bundle.xsimDiagnostics.diagnostics.locatedCount, 2);
  assert.deepEqual(summarizeContextBundle(bundle).xsimDiagnostics, {
    status: "available",
    sourceKind: "xsim-log",
    diagnosticCount: 5,
    errorCount: 2,
    warningCount: 2,
    locatedCount: 2,
    readOnly: true,
  });
}

function testInvalidXsimDiagnosticsDataIsSafeAndBounded() {
  const unsafeSurface = createXsimDiagnosticsStatusSurface(
    cloneDefaultXsimDiagnosticsSummary(),
  );
  unsafeSurface.safety.xsimExecution = true;
  unsafeSurface.xsimLog.source = "/home/user/private.log";
  const bundle = buildContextBundle(
    { xsimDiagnosticsStatus: unsafeSurface },
    { limits: { maxTextCharacters: 80 } },
  );
  const serialized = JSON.stringify(bundle.xsimDiagnostics);

  assert.equal(bundle.xsimDiagnostics.status, "invalid");
  assert.equal(bundle.xsimDiagnostics.summaryAvailable, false);
  assert.equal(bundle.xsimDiagnostics.source.rawProblemsParsedByUi, false);
  assert.equal(bundle.xsimDiagnostics.source.rawLogParsedByUi, false);
  assert.equal(bundle.xsimDiagnostics.safety.xsimExecution, false);
  assert.equal(bundle.xsimDiagnostics.safety.vivadoExecution, false);
  assert.doesNotMatch(serialized, /\/home\/user/);
  assert.match(bundle.xsimDiagnostics.reason, /existing-log data only and read-only/);
}

function testDiagnosticsHandoffStatusSurfaceInputIsAccepted() {
  const surface = createDiagnosticsHandoffStatusSurface(
    cloneDefaultDiagnosticsHandoffConsumerSummary(),
  );
  const bundle = buildContextBundle({ diagnosticsHandoffStatus: surface }, {});

  assert.equal(bundle.diagnosticsHandoff.status, "available");
  assert.equal(bundle.diagnosticsHandoff.source.adapterOutput, true);
  assert.equal(bundle.diagnosticsHandoff.source.rawHandoffParsedByUi, false);
  assert.equal(bundle.diagnosticsHandoff.diagnostics.count, 5);
  assert.deepEqual(summarizeContextBundle(bundle).diagnosticsHandoff, {
    status: "available",
    schemaVersion: "pccx.diagnosticsHandoff.v0",
    diagnosticCount: 5,
    blockedCount: 2,
    readOnly: true,
  });
}

function testInvalidDiagnosticsHandoffDataIsSafeAndBounded() {
  const unsafeSurface = createDiagnosticsHandoffStatusSurface(
    cloneDefaultDiagnosticsHandoffConsumerSummary(),
  );
  unsafeSurface.safety.pccxLabExecution = true;
  unsafeSurface.limitations = ["/home/user/private.log"];
  const bundle = buildContextBundle(
    { diagnosticsHandoffStatus: unsafeSurface },
    { limits: { maxTextCharacters: 80 } },
  );
  const serialized = JSON.stringify(bundle.diagnosticsHandoff);

  assert.equal(bundle.diagnosticsHandoff.status, "invalid");
  assert.equal(bundle.diagnosticsHandoff.summaryAvailable, false);
  assert.equal(bundle.diagnosticsHandoff.source.rawHandoffParsedByUi, false);
  assert.equal(bundle.diagnosticsHandoff.safety.pccxLabExecution, false);
  assert.doesNotMatch(serialized, /\/home\/user/);
  assert.match(bundle.diagnosticsHandoff.reason, /data-only and read-only/);
}

function testRuntimeReadinessStatusSurfaceInputIsAccepted() {
  const surface = createRuntimeReadinessStatusSurface(
    cloneDefaultRuntimeReadinessConsumerSummary(),
  );
  const bundle = buildContextBundle({ runtimeReadinessStatus: surface }, {});

  assert.equal(bundle.runtimeReadiness.status, "available");
  assert.equal(bundle.runtimeReadiness.source.adapterOutput, true);
  assert.equal(bundle.runtimeReadiness.source.rawReadinessParsedByUi, false);
  assert.equal(bundle.runtimeReadiness.readiness.statusAnswer, "blocked_not_yet_evidence_backed");
  assert.equal(bundle.runtimeReadiness.blockers.count, 6);
  assert.deepEqual(summarizeContextBundle(bundle).runtimeReadiness, {
    status: "available",
    statusAnswer: "blocked_not_yet_evidence_backed",
    readinessState: "blocked",
    evidenceState: "blocked",
    targetDevice: "kv260",
    blockerCount: 6,
    readOnly: true,
  });
}

function testInvalidRuntimeReadinessDataIsSafeAndBounded() {
  const unsafeSurface = createRuntimeReadinessStatusSurface(
    cloneDefaultRuntimeReadinessConsumerSummary(),
  );
  unsafeSurface.safety.fpgaRepoAccess = true;
  unsafeSurface.blockers.items[0].summary = "/home/user/private.log";
  const bundle = buildContextBundle(
    { runtimeReadinessStatus: unsafeSurface },
    { limits: { maxTextCharacters: 80 } },
  );
  const serialized = JSON.stringify(bundle.runtimeReadiness);

  assert.equal(bundle.runtimeReadiness.status, "invalid");
  assert.equal(bundle.runtimeReadiness.summaryAvailable, false);
  assert.equal(bundle.runtimeReadiness.source.rawReadinessParsedByUi, false);
  assert.equal(bundle.runtimeReadiness.safety.fpgaRepoAccess, false);
  assert.equal(bundle.runtimeReadiness.safety.kv260RuntimeExecution, false);
  assert.doesNotMatch(serialized, /\/home\/user/);
  assert.match(bundle.runtimeReadiness.reason, /data-only and read-only/);
}

function testDeviceSessionStatusSurfaceInputIsAccepted() {
  const surface = createDeviceSessionStatusSurface(
    cloneDefaultDeviceSessionStatusConsumerSummary(),
  );
  const bundle = buildContextBundle({ deviceSessionStatus: surface }, {});

  assert.equal(bundle.deviceSessionStatus.status, "available");
  assert.equal(bundle.deviceSessionStatus.source.adapterOutput, true);
  assert.equal(bundle.deviceSessionStatus.source.rawStatusParsedByUi, false);
  assert.equal(
    bundle.deviceSessionStatus.deviceSession.statusAnswer,
    "device_session_status_placeholder_blocked",
  );
  assert.equal(bundle.deviceSessionStatus.statusPanel.rowCount, 5);
  assert.deepEqual(summarizeContextBundle(bundle).deviceSessionStatus, {
    status: "available",
    statusAnswer: "device_session_status_placeholder_blocked",
    connectionState: "not_configured",
    sessionState: "inactive",
    readinessState: "blocked",
    targetDevice: "kv260",
    statusRowCount: 5,
    errorCount: 9,
    readOnly: true,
  });
}

function testInvalidDeviceSessionStatusDataIsSafeAndBounded() {
  const unsafeSurface = createDeviceSessionStatusSurface(
    cloneDefaultDeviceSessionStatusConsumerSummary(),
  );
  unsafeSurface.safety.kv260Access = true;
  unsafeSurface.statusPanel.rows[0].summary = "/home/user/private.log";
  const bundle = buildContextBundle(
    { deviceSessionStatus: unsafeSurface },
    { limits: { maxTextCharacters: 80 } },
  );
  const serialized = JSON.stringify(bundle.deviceSessionStatus);

  assert.equal(bundle.deviceSessionStatus.status, "invalid");
  assert.equal(bundle.deviceSessionStatus.summaryAvailable, false);
  assert.equal(bundle.deviceSessionStatus.source.rawStatusParsedByUi, false);
  assert.equal(bundle.deviceSessionStatus.safety.kv260Access, false);
  assert.equal(bundle.deviceSessionStatus.safety.runtimeExecution, false);
  assert.doesNotMatch(serialized, /\/home\/user/);
  assert.match(bundle.deviceSessionStatus.reason, /data-only and read-only/);
}

testStableBoundedShape();
testDeterministicOrdering();
testSelectedFileSnippetAndDiagnosticsArePrioritized();
testInvalidSelectedSymbolAndRangesAreControlled();
testLongSingleLineSnippetReportsTruncation();
testNoHugeFileOrRestrictedPathInclusion();
testValidationHistoryIsSummaryOnlyAndBounded();
testNoSecretValuesOrSecretLikeKeys();
testNoAbsoluteHomePathLeakage();
testNoActiveEditorContextShape();
testXsimDiagnosticsStatusSurfaceInputIsAccepted();
testInvalidXsimDiagnosticsDataIsSafeAndBounded();
testDiagnosticsHandoffStatusSurfaceInputIsAccepted();
testInvalidDiagnosticsHandoffDataIsSafeAndBounded();
testRuntimeReadinessStatusSurfaceInputIsAccepted();
testInvalidRuntimeReadinessDataIsSafeAndBounded();
testDeviceSessionStatusSurfaceInputIsAccepted();
testInvalidDeviceSessionStatusDataIsSafeAndBounded();

console.log("vscode context bundle tests ok");
