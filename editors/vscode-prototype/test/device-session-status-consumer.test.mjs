// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEVICE_SESSION_ERROR_SEVERITIES,
  DEVICE_SESSION_STATUS_CONSUMER_VERSION,
  DEVICE_SESSION_STATUS_COORDINATION_REFS,
  DEVICE_SESSION_STATUS_EXPECTED_STATUS_ANSWER,
  DEVICE_SESSION_STATUS_SCHEMA_VERSION,
  consumeDeviceSessionStatus,
  consumeDeviceSessionStatusJson,
  createDeviceSessionStatusConsumerBoundaryStatus,
  deviceSessionStatusConsumerJson,
  validateDeviceSessionStatus,
  validateDeviceSessionStatusJson,
} from "../src/device-session-status-consumer.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURE_PATH = resolve(
  ROOT,
  "docs/examples/device-session-status/launcher-device-session-status.gemma3n-e4b-kv260.example.json",
);

async function fixtureText() {
  return readFile(FIXTURE_PATH, "utf8");
}

async function fixture() {
  return JSON.parse(await fixtureText());
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertInvalid(value, pattern) {
  const result = validateDeviceSessionStatus(value);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), pattern);
  assert.throws(() => consumeDeviceSessionStatus(value), pattern);
}

async function testValidFixtureSummaryIsDeterministic() {
  const status = await fixture();
  const summary = consumeDeviceSessionStatus(status);
  const summaryFromJson = consumeDeviceSessionStatusJson(await fixtureText());
  const rendered = deviceSessionStatusConsumerJson(status);
  const renderedAgain = deviceSessionStatusConsumerJson(status);

  assert.deepEqual(summary, summaryFromJson);
  assert.equal(rendered, renderedAgain);
  assert.equal(JSON.parse(rendered).version, DEVICE_SESSION_STATUS_CONSUMER_VERSION);
  assert.equal(summary.version, DEVICE_SESSION_STATUS_CONSUMER_VERSION);
  assert.equal(summary.kind, "device-session-status-consumer");
  assert.equal(summary.statusSchemaVersion, DEVICE_SESSION_STATUS_SCHEMA_VERSION);
  assert.equal(summary.statusId, "device_session_status_gemma3n_e4b_kv260_placeholder");
  assert.equal(summary.statusAnswer, DEVICE_SESSION_STATUS_EXPECTED_STATUS_ANSWER);
  assert.deepEqual(summary.target, {
    device: "kv260",
    board: "xilinx_kria_kv260",
    model: "gemma3n-e4b",
  });
}

async function testStateRowsAndCountsAreBounded() {
  const summary = consumeDeviceSessionStatus(await fixture());

  assert.deepEqual(summary.states, {
    connection: "not_configured",
    discovery: "not_started",
    authentication: "not_configured",
    runtime: "planned",
    modelLoad: "not_loaded",
    session: "inactive",
    logStream: "not_started",
    diagnostics: "available_as_placeholder",
    readiness: "blocked",
  });
  assert.equal(summary.statusPanel.rowCount, 5);
  assert.deepEqual(summary.statusPanel.rows.map((row) => row.rowId), [
    "device_connection",
    "model_load",
    "session_activity",
    "pccx_lab_diagnostics",
    "runtime_readiness",
  ]);
  assert.equal(summary.discoveryPathCount, 3);
  assert.equal(summary.flowStepCount, 8);
  assert.equal(summary.errorCount, 9);
  assert.deepEqual(DEVICE_SESSION_ERROR_SEVERITIES, [
    "info",
    "warning",
    "blocked",
    "error",
    "placeholder",
  ]);
  assert.deepEqual(summary.errorsBySeverity, {
    info: 0,
    warning: 0,
    blocked: 6,
    error: 0,
    placeholder: 3,
  });
}

async function testSafetyFlagsProveDataOnlyBoundary() {
  const summary = consumeDeviceSessionStatus(await fixture());

  assert.deepEqual(summary.pccxLabDiagnostics, {
    state: "planned",
    mode: "read_only_handoff",
    lowerBoundary: "pccx-lab CLI/core",
    automaticUpload: false,
    writeBack: false,
    executesPccxLab: false,
  });
  assert.equal(summary.safety.dataOnly, true);
  assert.equal(summary.safety.readOnly, true);
  assert.equal(summary.safety.launcherExecution, false);
  assert.equal(summary.safety.pccxLabExecution, false);
  assert.equal(summary.safety.pccxLabValidatorInvocation, false);
  assert.equal(summary.safety.systemverilogIdeExecution, false);
  assert.equal(summary.safety.touchesHardware, false);
  assert.equal(summary.safety.kv260Access, false);
  assert.equal(summary.safety.opensSerialPort, false);
  assert.equal(summary.safety.networkCalls, false);
  assert.equal(summary.safety.networkScan, false);
  assert.equal(summary.safety.sshExecution, false);
  assert.equal(summary.safety.authenticationAttempt, false);
  assert.equal(summary.safety.runtimeExecution, false);
  assert.equal(summary.safety.modelLoaded, false);
  assert.equal(summary.safety.modelExecution, false);
  assert.equal(summary.safety.providerCalls, false);
  assert.equal(summary.safety.telemetry, false);
  assert.equal(summary.safety.writeBack, false);
}

async function testInvalidMissingFieldsAndUnsafeValuesAreRejected() {
  const missingResult = validateDeviceSessionStatus(null);
  assert.equal(missingResult.ok, false);
  assert.equal(missingResult.summary, null);
  assert.match(missingResult.errors.join("\n"), /must be an object/);

  const missingText = validateDeviceSessionStatusJson("");
  assert.equal(missingText.ok, false);
  assert.equal(missingText.summary, null);
  assert.match(missingText.errors.join("\n"), /parse failed/);

  const missingField = await fixture();
  delete missingField.statusAnswer;
  assertInvalid(missingField, /statusAnswer: is required/);

  const badTransport = await fixture();
  badTransport.discoveryPaths[0].transport = "scan_network";
  assertInvalid(badTransport, /discoveryPaths\[0\]\.transport: must be one of/);

  const badOrder = await fixture();
  badOrder.connectionLaunchFlow[1].order = 8;
  assertInvalid(badOrder, /connectionLaunchFlow\[1\]\.order: must be contiguous from 1/);

  const executing = await fixture();
  executing.safetyFlags.runtimeExecution = true;
  assertInvalid(executing, /safetyFlags\.runtimeExecution: must be false/);

  const pathLeak = await fixture();
  pathLeak.statusPanel[0].summary = "/home/user/models/local.gguf";
  assertInvalid(pathLeak, /model artifact paths/);

  const claim = await fixture();
  claim.errorTaxonomy[0].claimBoundary = "KV260 inference works";
  assertInvalid(claim, /unsupported device\/session claims/);
}

async function testBoundaryStatusIsExecutionFree() {
  const status = createDeviceSessionStatusConsumerBoundaryStatus();

  assert.equal(status.version, DEVICE_SESSION_STATUS_CONSUMER_VERSION);
  assert.equal(status.kind, "device-session-status-consumer-boundary");
  assert.equal(status.supportedSchemaVersion, DEVICE_SESSION_STATUS_SCHEMA_VERSION);
  assert.equal(status.expectedStatusAnswer, DEVICE_SESSION_STATUS_EXPECTED_STATUS_ANSWER);
  assert.deepEqual(status.coordinationRefs, [...DEVICE_SESSION_STATUS_COORDINATION_REFS]);
  assert.ok(status.coordinationRefs.includes("pccxai/systemverilog-ide#61"));
  assert.ok(status.coordinationRefs.includes("pccxai/pccx-launcher#2"));
  assert.ok(status.coordinationRefs.includes("pccxai/pccx-launcher#10"));
  assert.ok(status.coordinationRefs.includes("pccxai/pccx-lab#50"));
  assert.equal(status.dataOnly, true);
  assert.equal(status.readOnly, true);
  assert.equal(status.fixtureConsumer, true);
  assert.equal(status.validatesLocalJson, true);
  assert.equal(status.invokesLauncher, false);
  assert.equal(status.invokesPccxLab, false);
  assert.equal(status.invokesPccxLabValidator, false);
  assert.equal(status.shellExecution, false);
  assert.equal(status.opensSerialPort, false);
  assert.equal(status.serialWrites, false);
  assert.equal(status.sshExecution, false);
  assert.equal(status.networkCalls, false);
  assert.equal(status.networkScan, false);
  assert.equal(status.touchesHardware, false);
  assert.equal(status.kv260Access, false);
  assert.equal(status.runtimeExecution, false);
  assert.equal(status.modelExecution, false);
  assert.equal(status.providerCalls, false);
  assert.equal(status.telemetry, false);
  assert.equal(status.automaticUpload, false);
  assert.equal(status.writeBack, false);
  assert.equal(status.stableApi, false);
}

async function testModuleSourceHasNoExecutionOrRepoAccessTerms() {
  const source = await readFile(
    resolve(ROOT, "editors/vscode-prototype/src/device-session-status-consumer.mjs"),
    "utf8",
  );

  assert.doesNotMatch(source, /node:child_process|\bexecFile\b|\bspawn\s*\(|\bexec\s*\(/);
  assert.doesNotMatch(source, /node:fs|readFile\s*\(|readdir\s*\(|opendir\s*\(|stat\s*\(/);
  assert.doesNotMatch(source, /\bwriteFile\s*\(|\bappendFile\s*\(|\bunlink\s*\(|\brm\s*\(/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|node:https|node:http|node:net|node:tls/);
  assert.doesNotMatch(source, /pccx-FPGA-NPU-LLM-kv260/);
  assert.doesNotMatch(source, /pccx-lab\s+(?:status|diagnostics|validate|run)/i);
  assert.doesNotMatch(source, /pccx-launcher\s+(?:run|status|launch|diagnostics)/i);
  assert.doesNotMatch(source, new RegExp("\\b(?:openai|anthropic|ge" + "mini)\\b", "i"));
  assert.doesNotMatch(source, /modelcontextprotocol|McpServer|vscode-languageclient|LanguageClient/);
}

async function testSummaryDoesNotEchoPrivateInputWhenInvalid() {
  const status = clone(await fixture());
  status.statusPanel[0].summary = "/home/user/models/local.gguf";
  const result = validateDeviceSessionStatus(status);

  assert.equal(result.ok, false);
  assert.equal(result.summary, null);
  assert.doesNotMatch(JSON.stringify(result), /\/home\/user/);
  assert.doesNotMatch(JSON.stringify(result), /local\.gguf/);
}

await testValidFixtureSummaryIsDeterministic();
await testStateRowsAndCountsAreBounded();
await testSafetyFlagsProveDataOnlyBoundary();
await testInvalidMissingFieldsAndUnsafeValuesAreRejected();
await testBoundaryStatusIsExecutionFree();
await testModuleSourceHasNoExecutionOrRepoAccessTerms();
await testSummaryDoesNotEchoPrivateInputWhenInvalid();

console.log("vscode device session status consumer tests ok");
