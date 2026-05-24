// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  XSIM_DIAGNOSTICS_SOURCE_KIND,
  XSIM_DIAGNOSTICS_STATUS_SURFACE_VERSION,
  cloneDefaultXsimDiagnosticsSummary,
  createXsimDiagnosticsStatusSurface,
  formatXsimDiagnosticsStatusSurface,
  summarizeXsimDiagnosticsProblems,
  validateXsimDiagnosticsProblems,
  xsimDiagnosticsStatusSurfaceJson,
} from "../src/xsim-diagnostics-status-surface.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURE_PATH = resolve(
  ROOT,
  "docs/examples/editor-bridge/problems-xsim-mixed.example.json",
);

async function fixture() {
  return JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertInvalid(value, pattern) {
  const result = validateXsimDiagnosticsProblems(value);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), pattern);
}

async function testFixtureSummaryIsDeterministicAndBounded() {
  const summary = summarizeXsimDiagnosticsProblems(await fixture());
  const summaryAgain = summarizeXsimDiagnosticsProblems(await fixture());

  assert.deepEqual(summary, summaryAgain);
  assert.equal(summary.kind, "xsim-diagnostics-summary");
  assert.equal(summary.sourceKind, XSIM_DIAGNOSTICS_SOURCE_KIND);
  assert.equal(summary.tool, "pccx-ide-cli");
  assert.equal(summary.source, "fixtures/xsim/mixed.log");
  assert.equal(summary.problemCount, 5);
  assert.deepEqual(summary.problemsBySeverity, {
    error: 2,
    warning: 2,
    info: 1,
    hint: 0,
  });
  assert.equal(summary.locatedProblemCount, 2);
  assert.equal(summary.unlocatedProblemCount, 3);
  assert.equal(summary.codedProblemCount, 2);
  assert.deepEqual(summary.files, [
    { file: "src/top.sv", problemCount: 1 },
    { file: "src/warn.sv", problemCount: 1 },
  ]);
  assert.equal(summary.safety.dataOnly, true);
  assert.equal(summary.safety.rawLineEcho, false);
  assert.equal(summary.safety.xsimExecution, false);
  assert.equal(summary.safety.vivadoExecution, false);
  assert.equal(summary.safety.pccxLabExecution, false);
  assert.equal(summary.safety.hardwareAccess, false);
}

async function testDefaultSummaryMatchesCheckedFixture() {
  assert.deepEqual(cloneDefaultXsimDiagnosticsSummary(), summarizeXsimDiagnosticsProblems(await fixture()));
}

async function testStatusSurfaceConsumesAdapterOutputAsData() {
  const surface = createXsimDiagnosticsStatusSurface(await fixture());

  assert.equal(surface.version, XSIM_DIAGNOSTICS_STATUS_SURFACE_VERSION);
  assert.equal(surface.kind, "xsim-diagnostics-status-surface");
  assert.equal(surface.source.adapterOutput, true);
  assert.equal(surface.source.rawProblemsParsedByUi, false);
  assert.equal(surface.source.rawLogParsedByUi, false);
  assert.equal(surface.readiness.status, "available");
  assert.equal(surface.readiness.summaryAvailable, true);
  assert.equal(surface.xsimLog.sourceKind, "xsim-log");
  assert.equal(surface.diagnostics.count, 5);
  assert.equal(surface.diagnostics.bySeverity.error, 2);
  assert.equal(surface.diagnostics.bySeverity.warning, 2);
  assert.equal(surface.diagnostics.locatedCount, 2);
  assert.equal(surface.diagnostics.unlocatedCount, 3);
  assert.equal(surface.files.count, 2);
  assert.deepEqual(surface.files.items.map((item) => item.file), ["src/top.sv", "src/warn.sv"]);
}

async function testSafetyFlagsRemainReadOnly() {
  const surface = createXsimDiagnosticsStatusSurface(await fixture());

  assert.equal(surface.safety.dataOnly, true);
  assert.equal(surface.safety.readOnly, true);
  assert.equal(surface.safety.localOnly, true);
  assert.equal(surface.safety.existingLogOnly, true);
  assert.equal(surface.safety.rawLogIncluded, false);
  assert.equal(surface.safety.rawLineEcho, false);
  assert.equal(surface.safety.xsimExecution, false);
  assert.equal(surface.safety.vivadoExecution, false);
  assert.equal(surface.safety.pccxLabExecution, false);
  assert.equal(surface.safety.launcherExecution, false);
  assert.equal(surface.safety.shellExecution, false);
  assert.equal(surface.safety.fpgaRepoAccess, false);
  assert.equal(surface.safety.hardwareAccess, false);
  assert.equal(surface.safety.kv260Access, false);
  assert.equal(surface.safety.runtimeExecution, false);
  assert.equal(surface.safety.modelExecution, false);
  assert.equal(surface.safety.providerCalls, false);
  assert.equal(surface.safety.networkCalls, false);
  assert.equal(surface.safety.mcpCalls, false);
  assert.equal(surface.safety.lspImplemented, false);
  assert.equal(surface.safety.marketplaceFlow, false);
  assert.equal(surface.safety.telemetry, false);
  assert.equal(surface.safety.automaticUpload, false);
  assert.equal(surface.safety.writeBack, false);
}

async function testDeterministicJsonAndTextDoNotEchoRawLines() {
  const payload = await fixture();
  const rendered = xsimDiagnosticsStatusSurfaceJson(payload);
  const renderedAgain = xsimDiagnosticsStatusSurfaceJson(payload);
  const surface = JSON.parse(rendered);
  const text = formatXsimDiagnosticsStatusSurface(surface);
  const serialized = JSON.stringify(surface);

  assert.equal(rendered, renderedAgain);
  assert.match(text, /xsim Diagnostics Summary/);
  assert.match(text, /diagnostics: 5/);
  assert.match(text, /readOnly: yes/);
  assert.match(text, /execution: no xsim, no Vivado/);
  assert.doesNotMatch(serialized, /syntax error near token/);
  assert.doesNotMatch(serialized, /implicit net created/);
  assert.doesNotMatch(text, /syntax error near token/);
}

async function testRejectsUnsafeOrWrongPayloadData() {
  const wrongKind = await fixture();
  wrongKind.source_kind = "check";
  assertInvalid(wrongKind, /source_kind: must be xsim-log/);

  const privatePath = await fixture();
  privatePath.source = "/home/user/private.log";
  assertInvalid(privatePath, /private paths|relative non-private/);

  const executingSummary = clone(summarizeXsimDiagnosticsProblems(await fixture()));
  executingSummary.safety.xsimExecution = true;
  assert.throws(
    () => createXsimDiagnosticsStatusSurface(executingSummary),
    /safety\.xsimExecution: must be false/,
  );

  const claim = await fixture();
  claim.problems[0].message = ["timing", "closed"].join(" ");
  assertInvalid(claim, /unsupported runtime or readiness claims/);
}

async function testModuleSourceHasNoExecutionTerms() {
  const source = await readFile(
    resolve(ROOT, "editors/vscode-prototype/src/xsim-diagnostics-status-surface.mjs"),
    "utf8",
  );

  assert.doesNotMatch(source, /node:child_process|\bexecFile\b|\bspawn\s*\(|\bexec\s*\(/);
  assert.doesNotMatch(source, /\bwriteFile\s*\(|\bappendFile\s*\(|\bunlink\s*\(|\brm\s*\(/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|node:https|node:http|node:net|node:tls/);
  assert.doesNotMatch(source, new RegExp("\\b(?:openai|anthropic|ge" + "mini)\\b", "i"));
  assert.doesNotMatch(source, /pccx-lab\s+.*(?:run|validate|analyze)/i);
  assert.doesNotMatch(source, /pccx-launcher\s+(?:run|status|launch|diagnostics)/i);
  assert.doesNotMatch(source, /modelcontextprotocol|McpServer|vscode-languageclient|LanguageClient/);
}

await testFixtureSummaryIsDeterministicAndBounded();
await testDefaultSummaryMatchesCheckedFixture();
await testStatusSurfaceConsumesAdapterOutputAsData();
await testSafetyFlagsRemainReadOnly();
await testDeterministicJsonAndTextDoNotEchoRawLines();
await testRejectsUnsafeOrWrongPayloadData();
await testModuleSourceHasNoExecutionTerms();

console.log("vscode xsim diagnostics status surface tests ok");
