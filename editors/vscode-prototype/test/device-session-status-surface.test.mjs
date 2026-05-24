// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEVICE_SESSION_STATUS_EXPECTED_STATUS_ANSWER,
  DEVICE_SESSION_STATUS_SCHEMA_VERSION,
  consumeDeviceSessionStatus,
} from "../src/device-session-status-consumer.mjs";
import {
  DEVICE_SESSION_STATUS_SURFACE_VERSION,
  cloneDefaultDeviceSessionStatusConsumerSummary,
  createDeviceSessionStatusSurface,
  deviceSessionStatusSurfaceJson,
  formatDeviceSessionStatusSurface,
} from "../src/device-session-status-surface.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURE_PATH = resolve(
  ROOT,
  "docs/examples/device-session-status/launcher-device-session-status.gemma3n-e4b-kv260.example.json",
);

async function fixture() {
  return JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
}

async function adapterSummary() {
  return consumeDeviceSessionStatus(await fixture());
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function testDefaultSurfaceMatchesAdapterSummary() {
  const summary = await adapterSummary();

  assert.deepEqual(cloneDefaultDeviceSessionStatusConsumerSummary(), summary);
}

async function testSurfaceConsumesAdapterOutputAsData() {
  const summary = await adapterSummary();
  const surface = createDeviceSessionStatusSurface(summary);

  assert.equal(surface.version, DEVICE_SESSION_STATUS_SURFACE_VERSION);
  assert.equal(surface.kind, "device-session-status-surface");
  assert.equal(surface.source.kind, "device-session-status-consumer");
  assert.equal(surface.source.adapterOutput, true);
  assert.equal(surface.source.rawStatusParsedByUi, false);
  assert.equal(surface.fixture.schemaVersion, DEVICE_SESSION_STATUS_SCHEMA_VERSION);
  assert.equal(surface.fixture.statusId, "device_session_status_gemma3n_e4b_kv260_placeholder");
  assert.equal(surface.deviceSession.status, "available");
  assert.equal(surface.deviceSession.statusAnswer, DEVICE_SESSION_STATUS_EXPECTED_STATUS_ANSWER);
  assert.equal(surface.deviceSession.readinessState, "blocked");
  assert.equal(surface.target.model, "gemma3n-e4b");
  assert.equal(surface.target.device, "kv260");
  assert.equal(surface.states.connection, "not_configured");
  assert.equal(surface.states.session, "inactive");
  assert.equal(surface.statusPanel.rowCount, 5);
  assert.equal(surface.counts.discoveryPaths, 3);
  assert.equal(surface.counts.flowSteps, 8);
  assert.equal(surface.counts.errors, 9);
  assert.equal(surface.counts.errorsBySeverity.blocked, 6);
}

async function testSafetyFlagsRemainDataOnly() {
  const surface = createDeviceSessionStatusSurface(await adapterSummary());

  assert.equal(surface.safety.dataOnly, true);
  assert.equal(surface.safety.readOnly, true);
  assert.equal(surface.safety.localOnly, true);
  assert.equal(surface.safety.launcherExecution, false);
  assert.equal(surface.safety.pccxLabExecution, false);
  assert.equal(surface.safety.pccxLabValidatorInvocation, false);
  assert.equal(surface.safety.shellExecution, false);
  assert.equal(surface.safety.touchesHardware, false);
  assert.equal(surface.safety.kv260Access, false);
  assert.equal(surface.safety.opensSerialPort, false);
  assert.equal(surface.safety.serialWrites, false);
  assert.equal(surface.safety.networkCalls, false);
  assert.equal(surface.safety.networkScan, false);
  assert.equal(surface.safety.sshExecution, false);
  assert.equal(surface.safety.authenticationAttempt, false);
  assert.equal(surface.safety.kv260RuntimeExecution, false);
  assert.equal(surface.safety.runtimeExecution, false);
  assert.equal(surface.safety.modelLoaded, false);
  assert.equal(surface.safety.modelExecution, false);
  assert.equal(surface.safety.modelWeightPathsIncluded, false);
  assert.equal(surface.safety.providerCalls, false);
  assert.equal(surface.safety.mcpCalls, false);
  assert.equal(surface.safety.lspImplemented, false);
  assert.equal(surface.safety.marketplaceFlow, false);
  assert.equal(surface.safety.telemetry, false);
  assert.equal(surface.safety.automaticUpload, false);
  assert.equal(surface.safety.writeBack, false);
  assert.equal(surface.boundary.invokesLauncher, false);
  assert.equal(surface.boundary.invokesPccxLab, false);
  assert.equal(surface.boundary.invokesPccxLabValidator, false);
  assert.equal(surface.boundary.opensSerialPort, false);
  assert.equal(surface.boundary.networkCalls, false);
  assert.equal(surface.boundary.kv260Access, false);
  assert.equal(surface.boundary.runtimeExecution, false);
}

async function testDeterministicJsonAndTextOutput() {
  const summary = await adapterSummary();
  const rendered = deviceSessionStatusSurfaceJson(summary);
  const renderedAgain = deviceSessionStatusSurfaceJson(summary);
  const surface = JSON.parse(rendered);
  const text = formatDeviceSessionStatusSurface(surface);

  assert.equal(rendered, renderedAgain);
  assert.match(text, /Device Session Status/);
  assert.match(text, /schema: pccx\.deviceSessionStatus\.v0/);
  assert.match(text, /statusAnswer: device_session_status_placeholder_blocked/);
  assert.match(text, /target: gemma3n-e4b on kv260/);
  assert.match(text, /connection: not_configured/);
  assert.match(text, /session: inactive/);
  assert.match(text, /statusRows: 5/);
  assert.match(text, /readOnly: yes/);
  assert.match(text, /dataOnly: yes/);
  assert.match(text, /execution: no launcher, no pccx-lab, no serial\/network\/SSH/);
}

async function testRejectsRawStatusAndUnsafeSummaryData() {
  await assert.rejects(
    async () => createDeviceSessionStatusSurface(await fixture()),
    /kind: must be device-session-status-consumer/,
  );

  const missing = clone(await adapterSummary());
  delete missing.target.model;
  assert.throws(
    () => createDeviceSessionStatusSurface(missing),
    /target\.model: must be a non-empty string/,
  );

  const unsafePath = clone(await adapterSummary());
  unsafePath.statusPanel.rows[0].summary = "/home/user/private.log";
  assert.throws(
    () => createDeviceSessionStatusSurface(unsafePath),
    /private paths/,
  );

  const executing = clone(await adapterSummary());
  executing.safety.kv260Access = true;
  assert.throws(
    () => createDeviceSessionStatusSurface(executing),
    /safety\.kv260Access: must be false/,
  );
}

async function testModuleSourceHasNoExecutionTerms() {
  const source = await readFile(
    resolve(ROOT, "editors/vscode-prototype/src/device-session-status-surface.mjs"),
    "utf8",
  );

  assert.doesNotMatch(source, /node:child_process|\bexecFile\b|\bspawn\s*\(|\bexec\s*\(/);
  assert.doesNotMatch(source, /node:fs|readFile\s*\(|readdir\s*\(|opendir\s*\(|stat\s*\(/);
  assert.doesNotMatch(source, /\bwriteFile\s*\(|\bappendFile\s*\(|\bunlink\s*\(|\brm\s*\(/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|node:https|node:http|node:net|node:tls/);
  assert.doesNotMatch(source, /pccx-FPGA-NPU-LLM-kv260/);
  assert.doesNotMatch(source, /pccx-lab\s+(?:status|validate|run)/i);
  assert.doesNotMatch(source, /pccx-lab\s+diagnostics-handoff\s+validate/i);
  assert.doesNotMatch(source, /pccx-launcher\s+(?:run|status|launch|diagnostics)/i);
  assert.doesNotMatch(source, new RegExp("\\b(?:openai|anthropic|ge" + "mini)\\b", "i"));
  assert.doesNotMatch(source, /modelcontextprotocol|McpServer|vscode-languageclient|LanguageClient/);
}

await testDefaultSurfaceMatchesAdapterSummary();
await testSurfaceConsumesAdapterOutputAsData();
await testSafetyFlagsRemainDataOnly();
await testDeterministicJsonAndTextOutput();
await testRejectsRawStatusAndUnsafeSummaryData();
await testModuleSourceHasNoExecutionTerms();

console.log("vscode device session status surface tests ok");
