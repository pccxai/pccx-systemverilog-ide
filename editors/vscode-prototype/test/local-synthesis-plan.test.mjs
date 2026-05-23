// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";

import {
  JETBRAINS_LOCAL_SYNTHESIS_ACTION,
  LOCAL_SYNTHESIS_PLAN_VERSION,
  SHOW_LOCAL_SYNTHESIS_PLAN_COMMAND,
  createLocalSynthesisPlan,
  formatLocalSynthesisPlan,
} from "../src/local-synthesis-plan.mjs";

function testDefaultPlanIsLocalOfflineAndPlanOnly() {
  const plan = createLocalSynthesisPlan();

  assert.equal(plan.version, LOCAL_SYNTHESIS_PLAN_VERSION);
  assert.equal(plan.kind, "local-synthesis-plan");
  assert.equal(plan.proposalOnly, true);
  assert.equal(plan.surfaces.vscode.commandId, SHOW_LOCAL_SYNTHESIS_PLAN_COMMAND);
  assert.equal(plan.surfaces.jetbrains.actionId, JETBRAINS_LOCAL_SYNTHESIS_ACTION);
  assert.equal(plan.localBuild.vendor, "auto");
  assert.equal(plan.localBuild.target, "kv260");
  assert.deepEqual(plan.localBuild.synthArgv, [
    "pccx",
    "synth",
    "--local",
    "--script",
    "synth.tcl",
    "--vendor",
    "auto",
    "--work-dir",
    ".",
    "--dry-run",
  ]);
  assert.deepEqual(plan.localBuild.deployArgv, [
    "pccx",
    "deploy",
    "--target",
    "kv260",
    "--artifact",
    "build/pccx.xclbin",
    "--dry-run",
  ]);
  assert.equal(plan.localBuild.localToolchain, true);
  assert.equal(plan.localBuild.offlineSupported, true);
  assert.equal(plan.syncStatus.cloudSyncRequired, false);
  assert.equal(plan.safety.planOnly, true);
  assert.equal(plan.safety.executes, false);
  assert.equal(plan.safety.shellExecution, false);
  assert.equal(plan.safety.networkCalls, false);
  assert.equal(plan.safety.providerCalls, false);
  assert.equal(plan.safety.automaticUpload, false);
  assert.equal(plan.safety.writeBack, false);
  assert.doesNotMatch(JSON.stringify(plan), /\/home\/|TOKEN=|model\.gguf/);
}

function testCustomPlanKeepsFixedArgvShape() {
  const plan = createLocalSynthesisPlan({
    vendor: "quartus",
    scriptPath: "fpga/synth.tcl",
    workDir: "build/local",
    artifactPath: "build/local/pccx.xclbin",
    run: true,
  });

  assert.equal(plan.localBuild.vendor, "quartus");
  assert.deepEqual(plan.localBuild.synthArgv, [
    "pccx",
    "synth",
    "--local",
    "--script",
    "fpga/synth.tcl",
    "--vendor",
    "quartus",
    "--work-dir",
    "build/local",
    "--run",
  ]);
  assert.deepEqual(plan.localBuild.deployArgv, [
    "pccx",
    "deploy",
    "--target",
    "kv260",
    "--artifact",
    "build/local/pccx.xclbin",
    "--run",
  ]);
  assert.ok(plan.localBuild.synthArgv.every((arg) => typeof arg === "string"));
  assert.doesNotMatch(plan.localBuild.synthArgv.join("\n"), /(?:&&|\|\||;|`|\$\(|>|<)/);
}

function testUnsafeInputsAreRejected() {
  assert.throws(
    () => createLocalSynthesisPlan({ vendor: "ise" }),
    /vendor must be one of: auto, vivado, quartus/,
  );
  assert.throws(
    () => createLocalSynthesisPlan({ scriptPath: "synth.tcl; rm -rf /" }),
    /scriptPath must not contain shell control syntax/,
  );
  assert.throws(
    () => createLocalSynthesisPlan({ workDir: "build && whoami" }),
    /workDir must not contain shell control syntax/,
  );
}

function testFormatterNamesBothEditorSurfaces() {
  const text = formatLocalSynthesisPlan(createLocalSynthesisPlan());

  assert.match(text, /Local Synthesis Plan/);
  assert.match(text, /offline: yes/);
  assert.match(text, /cloudSyncRequired: no/);
  assert.match(text, /VS Code: pccxSystemVerilog\.showLocalSynthesisPlan/);
  assert.match(text, /JetBrains: pccx\.systemverilog\.showLocalSynthesisPlan/);
  assert.match(text, /pccx synth --local/);
  assert.match(text, /no shell execution/);
  assert.match(text, /no network calls/);
}

testDefaultPlanIsLocalOfflineAndPlanOnly();
testCustomPlanKeepsFixedArgvShape();
testUnsafeInputsAreRejected();
testFormatterNamesBothEditorSurfaces();

console.log("vscode local synthesis plan tests ok");
