// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  RUNTIME_READINESS_COORDINATION_REFS,
  RUNTIME_READINESS_CONSUMER_VERSION,
  RUNTIME_READINESS_EXPECTED_STATUS_ANSWER,
  RUNTIME_READINESS_SCHEMA_VERSION,
  consumeRuntimeReadiness,
  consumeRuntimeReadinessJson,
  createRuntimeReadinessConsumerBoundaryStatus,
  runtimeReadinessConsumerJson,
  validateRuntimeReadiness,
  validateRuntimeReadinessJson,
} from "../src/runtime-readiness-consumer.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURE_PATH = resolve(
  ROOT,
  "docs/examples/runtime-readiness/launcher-runtime-readiness.gemma3n-e4b-kv260.example.json",
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
  const result = validateRuntimeReadiness(value);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), pattern);
  assert.throws(() => consumeRuntimeReadiness(value), pattern);
}

async function testBlockedFixtureSummaryIsDeterministic() {
  const readiness = await fixture();
  const summary = consumeRuntimeReadiness(readiness);
  const summaryFromJson = consumeRuntimeReadinessJson(await fixtureText());
  const rendered = runtimeReadinessConsumerJson(readiness);
  const renderedAgain = runtimeReadinessConsumerJson(readiness);

  assert.deepEqual(summary, summaryFromJson);
  assert.equal(rendered, renderedAgain);
  assert.equal(JSON.parse(rendered).version, RUNTIME_READINESS_CONSUMER_VERSION);
  assert.equal(summary.version, RUNTIME_READINESS_CONSUMER_VERSION);
  assert.equal(summary.kind, "runtime-readiness-consumer");
  assert.equal(summary.readinessSchemaVersion, RUNTIME_READINESS_SCHEMA_VERSION);
  assert.equal(summary.statusAnswer, RUNTIME_READINESS_EXPECTED_STATUS_ANSWER);
  assert.equal(summary.readinessState, "blocked");
  assert.equal(summary.evidenceState, "blocked");
  assert.deepEqual(summary.targetModel, {
    modelId: "gemma3n_e4b_placeholder",
    modelFamily: "gemma3n",
    modelVariant: "e4b",
  });
  assert.equal(summary.targetDevice, "kv260");
  assert.equal(summary.targetBoard, "xilinx_kria_kv260");
}

async function testReadinessStatesAndBlockersAreBounded() {
  const summary = consumeRuntimeReadiness(await fixture());

  assert.equal(summary.timingState, "blocked");
  assert.equal(summary.bitstreamState, "blocked");
  assert.equal(summary.implementationState, "blocked");
  assert.equal(summary.kv260SmokeState, "blocked");
  assert.equal(summary.runtimeEvidenceState, "blocked");
  assert.equal(summary.throughputState, "target");
  assert.equal(summary.blockerCount, 6);
  assert.deepEqual(summary.blockers.map((blocker) => blocker.blockerId), [
    "board_model_bitstream_runtime_environment_missing",
    "post_synth_drc_timing_open",
    "implementation_incomplete",
    "bitstream_not_available",
    "gemma3n_e4b_runtime_evidence_absent",
    "throughput_measurement_absent",
  ]);
  assert.ok(summary.blockers.every((blocker) => blocker.state === "blocked"));
}

async function testSafetyFlagsProveDataOnlyBoundary() {
  const summary = consumeRuntimeReadiness(await fixture());

  assert.deepEqual(summary.safety, {
    dataOnly: true,
    readOnly: true,
    deterministic: true,
    descriptorOnly: true,
    launcherExecution: false,
    pccxLabExecution: false,
    systemverilogIdeExecution: false,
    fpgaRepoAccess: false,
    kv260Access: false,
    runtimeExecution: false,
    modelLoaded: false,
    modelExecution: false,
    modelWeightPathsIncluded: false,
    privatePathsIncluded: false,
    secretsIncluded: false,
    tokensIncluded: false,
    artifactBlobsIncluded: false,
    hardwareDumpsIncluded: false,
    writesArtifacts: false,
    networkCalls: false,
    providerCalls: false,
    mcpCalls: false,
    lspImplemented: false,
    marketplaceFlow: false,
    telemetry: false,
    automaticUpload: false,
    writeBack: false,
    stableApiAbiClaim: false,
  });
}

async function testMissingAndInvalidReadinessDataAreRejectedSafely() {
  const missingResult = validateRuntimeReadiness(null);
  assert.equal(missingResult.ok, false);
  assert.equal(missingResult.summary, null);
  assert.match(missingResult.errors.join("\n"), /must be an object/);

  const missingText = validateRuntimeReadinessJson("");
  assert.equal(missingText.ok, false);
  assert.equal(missingText.summary, null);
  assert.match(missingText.errors.join("\n"), /parse failed/);

  const missingField = await fixture();
  delete missingField.statusAnswer;
  assertInvalid(missingField, /statusAnswer: is required/);

  const badState = await fixture();
  badState.timingEvidenceState = "closed";
  assertInvalid(badState, /timingEvidenceState: must be one of/);

  const achieved = await fixture();
  achieved.performanceTargets[0].achieved = true;
  assertInvalid(achieved, /performanceTargets\[0\]\.achieved: must be false/);

  const executing = await fixture();
  executing.safetyFlags.runtimeExecution = true;
  assertInvalid(executing, /safetyFlags\.runtimeExecution: must be false/);

  const pathLeak = await fixture();
  pathLeak.nextInputsRequired[0].summary = "/home/user/models/local.gguf";
  assertInvalid(pathLeak, /model artifact paths/);

  const claim = await fixture();
  claim.blockers[0].summary = "KV260 inference works";
  assertInvalid(claim, /unsupported runtime readiness claims/);
}

async function testBoundaryStatusIsExecutionFree() {
  const status = createRuntimeReadinessConsumerBoundaryStatus();

  assert.equal(status.version, RUNTIME_READINESS_CONSUMER_VERSION);
  assert.equal(status.kind, "runtime-readiness-consumer-boundary");
  assert.equal(status.supportedSchemaVersion, RUNTIME_READINESS_SCHEMA_VERSION);
  assert.equal(status.expectedStatusAnswer, RUNTIME_READINESS_EXPECTED_STATUS_ANSWER);
  assert.deepEqual(status.coordinationRefs, [...RUNTIME_READINESS_COORDINATION_REFS]);
  assert.ok(status.coordinationRefs.includes("pccxai/systemverilog-ide#58"));
  assert.ok(status.coordinationRefs.includes("pccxai/pccx-launcher#21"));
  assert.ok(status.coordinationRefs.includes("pccxai/pccx-launcher#22"));
  assert.equal(status.dataOnly, true);
  assert.equal(status.readOnly, true);
  assert.equal(status.fixtureConsumer, true);
  assert.equal(status.validatesLocalJson, true);
  assert.equal(status.invokesLauncher, false);
  assert.equal(status.invokesPccxLab, false);
  assert.equal(status.invokesPccxLabValidator, false);
  assert.equal(status.accessesFpgaRepo, false);
  assert.equal(status.kv260RuntimeExecution, false);
  assert.equal(status.modelExecution, false);
  assert.equal(status.modelWeightPathsIncluded, false);
  assert.equal(status.providerCalls, false);
  assert.equal(status.networkCalls, false);
  assert.equal(status.runtimeCalls, false);
  assert.equal(status.mcpCalls, false);
  assert.equal(status.lspImplemented, false);
  assert.equal(status.marketplaceFlow, false);
  assert.equal(status.telemetry, false);
  assert.equal(status.automaticUpload, false);
  assert.equal(status.writeBack, false);
  assert.equal(status.stableApi, false);
}

async function testModuleSourceHasNoExecutionOrRepoAccessTerms() {
  const source = await readFile(
    resolve(ROOT, "editors/vscode-prototype/src/runtime-readiness-consumer.mjs"),
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
  assert.doesNotMatch(source, /\b(?:telemetry|upload|write-back)\s+(?:enabled|true)\b/i);
}

async function testSummaryDoesNotEchoPrivateInputWhenInvalid() {
  const readiness = clone(await fixture());
  readiness.nextInputsRequired[0].summary = "/home/user/models/local.gguf";
  const result = validateRuntimeReadiness(readiness);

  assert.equal(result.ok, false);
  assert.equal(result.summary, null);
  assert.doesNotMatch(JSON.stringify(result), /\/home\/user/);
  assert.doesNotMatch(JSON.stringify(result), /local\.gguf/);
}

async function testFixtureAndSummaryDoNotContainUnsupportedClaims() {
  const readiness = await fixture();
  const summary = consumeRuntimeReadiness(readiness);
  const text = `${JSON.stringify(readiness)}\n${JSON.stringify(summary)}`;

  // Unsupported claim patterns stay absent from the fixture and summary.
  assert.doesNotMatch(text, new RegExp(["KV260 inference", "works"].join(" "), "i"));
  assert.doesNotMatch(text, new RegExp(["Gemma 3N E4B runs", "on KV260"].join(" "), "i"));
  assert.doesNotMatch(text, new RegExp(["20 tok/s", "achieved"].join(" "), "i"));
  assert.doesNotMatch(text, new RegExp(["timing", "closed"].join(" "), "i"));
  assert.doesNotMatch(
    text,
    new RegExp([
      ["production", "ready"].join("-"),
      ["marketplace", "ready"].join("-"),
      ["stable", "API"].join(" "),
      ["stable", "ABI"].join(" "),
    ].join("|"), "i"),
  );
}

await testBlockedFixtureSummaryIsDeterministic();
await testReadinessStatesAndBlockersAreBounded();
await testSafetyFlagsProveDataOnlyBoundary();
await testMissingAndInvalidReadinessDataAreRejectedSafely();
await testBoundaryStatusIsExecutionFree();
await testModuleSourceHasNoExecutionOrRepoAccessTerms();
await testSummaryDoesNotEchoPrivateInputWhenInvalid();
await testFixtureAndSummaryDoNotContainUnsupportedClaims();

console.log("vscode runtime readiness consumer tests ok");
