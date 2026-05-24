// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DIAGNOSTICS_HANDOFF_STATUS_SURFACE_VERSION,
  cloneDefaultDiagnosticsHandoffConsumerSummary,
  createDiagnosticsHandoffStatusSurface,
  diagnosticsHandoffStatusSurfaceJson,
  formatDiagnosticsHandoffStatusSurface,
} from "../src/diagnostics-handoff-status-surface.mjs";
import {
  DIAGNOSTICS_HANDOFF_SCHEMA_VERSION,
  consumeDiagnosticsHandoff,
} from "../src/diagnostics-handoff-consumer.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURE_PATH = resolve(
  ROOT,
  "docs/examples/diagnostics-handoff/launcher-diagnostics-handoff.example.json",
);

async function fixture() {
  return JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
}

async function adapterSummary() {
  return consumeDiagnosticsHandoff(await fixture());
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function testDefaultSurfaceMatchesAdapterSummary() {
  const summary = await adapterSummary();

  assert.deepEqual(cloneDefaultDiagnosticsHandoffConsumerSummary(), summary);
}

async function testSurfaceConsumesAdapterOutputAsData() {
  const summary = await adapterSummary();
  const surface = createDiagnosticsHandoffStatusSurface(summary);

  assert.equal(surface.version, DIAGNOSTICS_HANDOFF_STATUS_SURFACE_VERSION);
  assert.equal(surface.kind, "diagnostics-handoff-status-surface");
  assert.equal(surface.source.kind, "diagnostics-handoff-consumer");
  assert.equal(surface.source.adapterOutput, true);
  assert.equal(surface.source.rawHandoffParsedByUi, false);
  assert.equal(surface.handoff.schemaVersion, DIAGNOSTICS_HANDOFF_SCHEMA_VERSION);
  assert.equal(surface.handoff.handoffId, summary.handoffId);
  assert.equal(surface.handoff.targetKind, "kv260");
  assert.equal(surface.diagnostics.count, 5);
  assert.deepEqual(surface.diagnostics.bySeverity, summary.diagnosticsBySeverity);
  assert.deepEqual(surface.diagnostics.byCategory, summary.diagnosticsByCategory);
  assert.deepEqual(surface.descriptorRefs, summary.descriptorRefs);
  assert.deepEqual(surface.transportKinds, summary.transportKinds);
  assert.equal(surface.readiness.status, "available");
  assert.equal(surface.readiness.localOnly, true);
}

async function testSafetyFlagsRemainDataOnly() {
  const surface = createDiagnosticsHandoffStatusSurface(await adapterSummary());

  assert.equal(surface.safety.dataOnly, true);
  assert.equal(surface.safety.readOnly, true);
  assert.equal(surface.safety.localOnly, true);
  assert.equal(surface.safety.launcherExecution, false);
  assert.equal(surface.safety.pccxLabExecution, false);
  assert.equal(surface.safety.pccxLabValidatorInvocation, false);
  assert.equal(surface.safety.shellExecution, false);
  assert.equal(surface.safety.providerCalls, false);
  assert.equal(surface.safety.networkCalls, false);
  assert.equal(surface.safety.runtimeCalls, false);
  assert.equal(surface.safety.mcpCalls, false);
  assert.equal(surface.safety.lspImplemented, false);
  assert.equal(surface.safety.marketplaceFlow, false);
  assert.equal(surface.safety.telemetry, false);
  assert.equal(surface.safety.automaticUpload, false);
  assert.equal(surface.safety.writeBack, false);
  assert.equal(surface.boundary.invokesLauncher, false);
  assert.equal(surface.boundary.invokesPccxLab, false);
  assert.equal(surface.boundary.invokesPccxLabValidator, false);
}

async function testDeterministicJsonAndTextOutput() {
  const summary = await adapterSummary();
  const rendered = diagnosticsHandoffStatusSurfaceJson(summary);
  const renderedAgain = diagnosticsHandoffStatusSurfaceJson(summary);
  const surface = JSON.parse(rendered);
  const text = formatDiagnosticsHandoffStatusSurface(surface);

  assert.equal(rendered, renderedAgain);
  assert.match(text, /Diagnostics Handoff Summary/);
  assert.match(text, /schema: pccx\.diagnosticsHandoff\.v0/);
  assert.match(text, /diagnostics: 5/);
  assert.match(text, /readOnly: yes/);
  assert.match(text, /dataOnly: yes/);
  assert.match(text, /execution: no launcher, no pccx-lab, no shell/);
}

async function testRejectsRawHandoffAndUnsafeSummaryData() {
  await assert.rejects(
    async () => createDiagnosticsHandoffStatusSurface(await fixture()),
    /kind: must be diagnostics-handoff-consumer/,
  );

  const missing = clone(await adapterSummary());
  delete missing.descriptorRefs.runtimeId;
  assert.throws(
    () => createDiagnosticsHandoffStatusSurface(missing),
    /descriptorRefs\.runtimeId: must be a non-empty string/,
  );

  const unsafe = clone(await adapterSummary());
  unsafe.limitations[0] = "/home/user/private.log";
  assert.throws(
    () => createDiagnosticsHandoffStatusSurface(unsafe),
    /private paths/,
  );

  const executing = clone(await adapterSummary());
  executing.safety.pccxLabExecution = true;
  assert.throws(
    () => createDiagnosticsHandoffStatusSurface(executing),
    /safety\.pccxLabExecution: must be false/,
  );
}

async function testModuleSourceHasNoExecutionTerms() {
  const source = await readFile(
    resolve(ROOT, "editors/vscode-prototype/src/diagnostics-handoff-status-surface.mjs"),
    "utf8",
  );

  assert.doesNotMatch(source, /node:child_process|\bexecFile\b|\bspawn\s*\(|\bexec\s*\(/);
  assert.doesNotMatch(source, /\bwriteFile\s*\(|\bappendFile\s*\(|\bunlink\s*\(|\brm\s*\(/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|node:https|node:http|node:net|node:tls/);
  assert.doesNotMatch(source, new RegExp("\\b(?:openai|anthropic|ge" + "mini)\\b", "i"));
  assert.doesNotMatch(source, /pccx-lab\s+diagnostics-handoff\s+validate/i);
  assert.doesNotMatch(source, /pccx-launcher\s+(?:run|status|launch|diagnostics)/i);
  assert.doesNotMatch(source, /modelcontextprotocol|McpServer|vscode-languageclient|LanguageClient/);
}

await testDefaultSurfaceMatchesAdapterSummary();
await testSurfaceConsumesAdapterOutputAsData();
await testSafetyFlagsRemainDataOnly();
await testDeterministicJsonAndTextOutput();
await testRejectsRawHandoffAndUnsafeSummaryData();
await testModuleSourceHasNoExecutionTerms();

console.log("vscode diagnostics handoff status surface tests ok");
