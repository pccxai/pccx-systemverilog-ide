// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  RUNTIME_READINESS_EXPECTED_STATUS_ANSWER,
  RUNTIME_READINESS_SCHEMA_VERSION,
  consumeRuntimeReadiness,
} from "../src/runtime-readiness-consumer.mjs";
import {
  RUNTIME_READINESS_STATUS_SURFACE_VERSION,
  cloneDefaultRuntimeReadinessConsumerSummary,
  createRuntimeReadinessStatusSurface,
  formatRuntimeReadinessStatusSurface,
  runtimeReadinessStatusSurfaceJson,
} from "../src/runtime-readiness-status-surface.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURE_PATH = resolve(
  ROOT,
  "docs/examples/runtime-readiness/launcher-runtime-readiness.gemma3n-e4b-kv260.example.json",
);

async function fixture() {
  return JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
}

async function adapterSummary() {
  return consumeRuntimeReadiness(await fixture());
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function testDefaultSurfaceMatchesAdapterSummary() {
  const summary = await adapterSummary();

  assert.deepEqual(cloneDefaultRuntimeReadinessConsumerSummary(), summary);
}

async function testSurfaceConsumesAdapterOutputAsData() {
  const summary = await adapterSummary();
  const surface = createRuntimeReadinessStatusSurface(summary);

  assert.equal(surface.version, RUNTIME_READINESS_STATUS_SURFACE_VERSION);
  assert.equal(surface.kind, "runtime-readiness-status-surface");
  assert.equal(surface.source.kind, "runtime-readiness-consumer");
  assert.equal(surface.source.adapterOutput, true);
  assert.equal(surface.source.rawReadinessParsedByUi, false);
  assert.equal(surface.fixture.schemaVersion, RUNTIME_READINESS_SCHEMA_VERSION);
  assert.equal(surface.fixture.readinessId, "runtime_readiness_gemma3n_e4b_kv260");
  assert.equal(surface.readiness.status, "available");
  assert.equal(surface.readiness.statusAnswer, RUNTIME_READINESS_EXPECTED_STATUS_ANSWER);
  assert.equal(surface.readiness.readinessState, "blocked");
  assert.equal(surface.readiness.evidenceState, "blocked");
  assert.equal(surface.target.model.modelId, "gemma3n_e4b_placeholder");
  assert.equal(surface.target.device, "kv260");
  assert.equal(surface.states.timing, "blocked");
  assert.equal(surface.states.bitstream, "blocked");
  assert.equal(surface.states.implementation, "blocked");
  assert.equal(surface.states.kv260Smoke, "blocked");
  assert.equal(surface.states.runtimeEvidence, "blocked");
  assert.equal(surface.states.throughput, "target");
  assert.equal(surface.blockers.count, 6);
}

async function testSafetyFlagsRemainDataOnly() {
  const surface = createRuntimeReadinessStatusSurface(await adapterSummary());

  assert.equal(surface.safety.dataOnly, true);
  assert.equal(surface.safety.readOnly, true);
  assert.equal(surface.safety.localOnly, true);
  assert.equal(surface.safety.launcherExecution, false);
  assert.equal(surface.safety.pccxLabExecution, false);
  assert.equal(surface.safety.pccxLabValidatorInvocation, false);
  assert.equal(surface.safety.shellExecution, false);
  assert.equal(surface.safety.fpgaRepoAccess, false);
  assert.equal(surface.safety.kv260RuntimeExecution, false);
  assert.equal(surface.safety.kv260Access, false);
  assert.equal(surface.safety.runtimeExecution, false);
  assert.equal(surface.safety.modelLoaded, false);
  assert.equal(surface.safety.modelExecution, false);
  assert.equal(surface.safety.modelWeightPathsIncluded, false);
  assert.equal(surface.safety.providerCalls, false);
  assert.equal(surface.safety.networkCalls, false);
  assert.equal(surface.safety.mcpCalls, false);
  assert.equal(surface.safety.lspImplemented, false);
  assert.equal(surface.safety.marketplaceFlow, false);
  assert.equal(surface.safety.telemetry, false);
  assert.equal(surface.safety.automaticUpload, false);
  assert.equal(surface.safety.writeBack, false);
  assert.equal(surface.boundary.invokesLauncher, false);
  assert.equal(surface.boundary.invokesPccxLab, false);
  assert.equal(surface.boundary.accessesFpgaRepo, false);
  assert.equal(surface.boundary.kv260RuntimeExecution, false);
  assert.deepEqual(surface.boundary.coordinationRefs, [
    "pccxai/systemverilog-ide#58",
    "pccxai/pccx-launcher#21",
    "pccxai/pccx-launcher#22",
  ]);
}

async function testDeterministicJsonAndTextOutput() {
  const summary = await adapterSummary();
  const rendered = runtimeReadinessStatusSurfaceJson(summary);
  const renderedAgain = runtimeReadinessStatusSurfaceJson(summary);
  const surface = JSON.parse(rendered);
  const text = formatRuntimeReadinessStatusSurface(surface);

  assert.equal(rendered, renderedAgain);
  assert.match(text, /Runtime Readiness Summary/);
  assert.match(text, /schema: pccx\.runtimeReadiness\.v0/);
  assert.match(text, /statusAnswer: blocked_not_yet_evidence_backed/);
  assert.match(text, /target: gemma3n\/e4b on kv260/);
  assert.match(text, /readinessState: blocked/);
  assert.match(text, /blockers: 6/);
  assert.match(text, /readOnly: yes/);
  assert.match(text, /dataOnly: yes/);
  assert.match(text, /execution: no launcher, no pccx-lab, no FPGA repo, no KV260 runtime, no providers/);
}

async function testRejectsRawReadinessAndUnsafeSummaryData() {
  await assert.rejects(
    async () => createRuntimeReadinessStatusSurface(await fixture()),
    /kind: must be runtime-readiness-consumer/,
  );

  const missing = clone(await adapterSummary());
  delete missing.targetModel.modelId;
  assert.throws(
    () => createRuntimeReadinessStatusSurface(missing),
    /targetModel\.modelId: must be a non-empty string/,
  );

  const unsafePath = clone(await adapterSummary());
  unsafePath.blockers[0].summary = "/home/user/private.log";
  assert.throws(
    () => createRuntimeReadinessStatusSurface(unsafePath),
    /private paths/,
  );

  const executing = clone(await adapterSummary());
  executing.safety.kv260RuntimeExecution = true;
  assert.throws(
    () => createRuntimeReadinessStatusSurface(executing),
    /safety\.kv260RuntimeExecution: must be false/,
  );
}

async function testModuleSourceHasNoExecutionTerms() {
  const source = await readFile(
    resolve(ROOT, "editors/vscode-prototype/src/runtime-readiness-status-surface.mjs"),
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

await testDefaultSurfaceMatchesAdapterSummary();
await testSurfaceConsumesAdapterOutputAsData();
await testSafetyFlagsRemainDataOnly();
await testDeterministicJsonAndTextOutput();
await testRejectsRawReadinessAndUnsafeSummaryData();
await testModuleSourceHasNoExecutionTerms();

console.log("vscode runtime readiness status surface tests ok");
