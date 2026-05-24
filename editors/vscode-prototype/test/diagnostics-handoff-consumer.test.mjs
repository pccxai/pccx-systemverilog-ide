// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DIAGNOSTICS_HANDOFF_CATEGORIES,
  DIAGNOSTICS_HANDOFF_CONSUMER_VERSION,
  DIAGNOSTICS_HANDOFF_SCHEMA_VERSION,
  DIAGNOSTICS_HANDOFF_SEVERITIES,
  consumeDiagnosticsHandoff,
  consumeDiagnosticsHandoffJson,
  createDiagnosticsHandoffConsumerBoundaryStatus,
  diagnosticsHandoffConsumerJson,
  validateDiagnosticsHandoff,
} from "../src/diagnostics-handoff-consumer.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURE_PATH = resolve(
  ROOT,
  "docs/examples/diagnostics-handoff/launcher-diagnostics-handoff.example.json",
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
  const result = validateDiagnosticsHandoff(value);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), pattern);
  assert.throws(() => consumeDiagnosticsHandoff(value), pattern);
}

async function testValidFixtureSummaryIsDeterministic() {
  const handoff = await fixture();
  const summary = consumeDiagnosticsHandoff(handoff);
  const summaryFromJson = consumeDiagnosticsHandoffJson(await fixtureText());
  const rendered = diagnosticsHandoffConsumerJson(handoff);
  const renderedAgain = diagnosticsHandoffConsumerJson(handoff);

  assert.deepEqual(summary, summaryFromJson);
  assert.equal(rendered, renderedAgain);
  assert.equal(JSON.parse(rendered).version, DIAGNOSTICS_HANDOFF_CONSUMER_VERSION);
  assert.equal(summary.version, DIAGNOSTICS_HANDOFF_CONSUMER_VERSION);
  assert.equal(summary.kind, "diagnostics-handoff-consumer");
  assert.equal(summary.handoffSchemaVersion, DIAGNOSTICS_HANDOFF_SCHEMA_VERSION);
  assert.equal(summary.handoffId, "launcher_diagnostics_handoff_gemma3n_e4b_kv260_placeholder");
  assert.equal(summary.handoffKind, "read_only_handoff");
  assert.equal(summary.producerId, "pccx-launcher");
  assert.equal(summary.consumerId, "pccx-lab");
  assert.equal(summary.targetKind, "kv260");
  assert.equal(summary.diagnosticCount, 5);
}

async function testValidFixtureCountsAndReferences() {
  const summary = consumeDiagnosticsHandoff(await fixture());

  assert.deepEqual(DIAGNOSTICS_HANDOFF_SEVERITIES, [
    "info",
    "warning",
    "blocked",
    "error",
  ]);
  assert.deepEqual(DIAGNOSTICS_HANDOFF_CATEGORIES, [
    "configuration",
    "model_descriptor",
    "runtime_descriptor",
    "target_device",
    "evidence",
    "safety",
    "diagnostics_handoff",
  ]);
  assert.equal(summary.diagnosticsBySeverity.info, 2);
  assert.equal(summary.diagnosticsBySeverity.warning, 1);
  assert.equal(summary.diagnosticsBySeverity.blocked, 2);
  assert.equal(summary.diagnosticsBySeverity.error, 0);
  assert.equal(summary.diagnosticsByCategory.configuration, 1);
  assert.equal(summary.diagnosticsByCategory.runtime_descriptor, 1);
  assert.equal(summary.diagnosticsByCategory.evidence, 1);
  assert.equal(summary.diagnosticsByCategory.safety, 1);
  assert.deepEqual(summary.descriptorRefs, {
    launcherOperationId: "pccxlab.diagnostics.handoff",
    modelId: "gemma3n_e4b_placeholder",
    runtimeId: "kv260_pccx_placeholder",
    referenceKind: "descriptor_ref_only",
  });
  assert.deepEqual(summary.transportKinds, [
    "json_file",
    "stdout_json",
    "read_only_local_artifact_reference",
  ]);
}

async function testReadOnlySafetyFlagsAreCarriedToSummary() {
  const summary = consumeDiagnosticsHandoff(await fixture());

  assert.deepEqual(summary.safety, {
    dataOnly: true,
    readOnly: true,
    fixtureConsumer: true,
    launcherExecution: false,
    pccxLabExecution: false,
    shellExecution: false,
    providerCalls: false,
    networkCalls: false,
    runtimeCalls: false,
    mcpCalls: false,
    lspImplemented: false,
    marketplaceFlow: false,
    telemetry: false,
    automaticUpload: false,
    writeBack: false,
  });
}

async function testInvalidMissingFieldsAndUnsafeValuesAreRejected() {
  const missing = await fixture();
  delete missing.handoffId;
  assertInvalid(missing, /handoffId: is required/);

  const badSeverity = await fixture();
  badSeverity.diagnostics[0].severity = "fatal";
  assertInvalid(badSeverity, /diagnostics\[0\]\.severity: must be one of/);

  const upload = await fixture();
  upload.privacyFlags.automaticUpload = true;
  assertInvalid(upload, /privacyFlags\.automaticUpload: must be false/);

  const pathLeak = await fixture();
  pathLeak.artifactRefs[0].reference = "/home/user/private.log";
  assertInvalid(pathLeak, /private paths/);

  const claim = await fixture();
  claim.diagnostics[0].summary = "KV260 inference works";
  assertInvalid(claim, /unsupported runtime or readiness claims/);
}

async function testBoundaryStatusIsDataOnlyAndDoesNotInvokeBackends() {
  const status = createDiagnosticsHandoffConsumerBoundaryStatus();

  assert.equal(status.version, DIAGNOSTICS_HANDOFF_CONSUMER_VERSION);
  assert.equal(status.kind, "diagnostics-handoff-consumer-boundary");
  assert.equal(status.supportedSchemaVersion, DIAGNOSTICS_HANDOFF_SCHEMA_VERSION);
  assert.equal(status.dataOnly, true);
  assert.equal(status.readOnly, true);
  assert.equal(status.validatesLocalJson, true);
  assert.equal(status.invokesLauncher, false);
  assert.equal(status.invokesPccxLab, false);
  assert.equal(status.invokesPccxLabValidator, false);
  assert.equal(status.shellExecution, false);
  assert.equal(status.providerCalls, false);
  assert.equal(status.runtimeCalls, false);
  assert.equal(status.mcpCalls, false);
  assert.equal(status.lspImplemented, false);
  assert.equal(status.marketplaceFlow, false);
  assert.equal(status.stableApi, false);
}

async function testModuleSourceHasNoExecutionTerms() {
  const source = await readFile(
    resolve(ROOT, "editors/vscode-prototype/src/diagnostics-handoff-consumer.mjs"),
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

async function testSummaryDoesNotEchoPrivateInputWhenInvalid() {
  const handoff = clone(await fixture());
  handoff.artifactRefs[0].reference = "/home/user/private.log";
  const result = validateDiagnosticsHandoff(handoff);

  assert.equal(result.ok, false);
  assert.equal(result.summary, null);
  assert.doesNotMatch(JSON.stringify(result), /\/home\/user/);
}

await testValidFixtureSummaryIsDeterministic();
await testValidFixtureCountsAndReferences();
await testReadOnlySafetyFlagsAreCarriedToSummary();
await testInvalidMissingFieldsAndUnsafeValuesAreRejected();
await testBoundaryStatusIsDataOnlyAndDoesNotInvokeBackends();
await testModuleSourceHasNoExecutionTerms();
await testSummaryDoesNotEchoPrivateInputWhenInvalid();

console.log("vscode diagnostics handoff consumer tests ok");
