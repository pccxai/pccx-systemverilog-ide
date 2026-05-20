// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const EXTENSION_ROOT = resolve(ROOT, "editors/vscode-prototype");
const COMMAND_IDS = [
  "pccxSystemVerilog.publishCheckedExampleDiagnostics",
  "pccxSystemVerilog.showCheckedExampleNavigation",
  "pccxSystemVerilog.publishLiveWorkspaceDiagnostics",
  "pccxSystemVerilog.showLiveWorkspaceNavigation",
  "pccxSystemVerilog.showDiagnosticsExample",
  "pccxSystemVerilog.showNavigationExample",
  "pccxSystemVerilog.runDiagnosticsLive",
  "pccxSystemVerilog.runNavigationLive",
  "pccxSystemVerilog.showWorkflowBoundaryStatus",
  "pccxSystemVerilog.buildWorkflowContextBundle",
  "pccxSystemVerilog.proposeValidationCommand",
  "pccxSystemVerilog.auditValidationProposalPreflight",
  "pccxSystemVerilog.runApprovedValidationCommand",
  "pccxSystemVerilog.showRecentValidationResults",
  "pccxSystemVerilog.showValidationCacheStatus",
  "pccxSystemVerilog.clearValidationResultCache",
  "pccxSystemVerilog.showPatchProposalPreview",
  "pccxSystemVerilog.clearPatchProposalPreview",
  "pccxSystemVerilog.showLocalWorkflowStatus",
  "pccxSystemVerilog.showContextBundleAudit",
  "pccxSystemVerilog.showPccxLabBackendStatus",
  "pccxSystemVerilog.showDiagnosticsHandoffSummary",
  "pccxSystemVerilog.showKv260StatusPanel",
  "pccxSystemVerilog.v0021.showKv260StatusPanel",
  "pccxSystemVerilog.v0021.openRunbook",
  "pccxSystemVerilog.v0021.openProjectBoard",
  "pccxSystemVerilog.v0021.showTraceInspectHelp",
];

const V0021_COMMAND_TITLES = new Map([
  ["pccxSystemVerilog.v0021.showKv260StatusPanel", "PCCX: Show KV260 Status Panel"],
  ["pccxSystemVerilog.v0021.openRunbook", "PCCX: Open v002.1 Runbook"],
  ["pccxSystemVerilog.v0021.openProjectBoard", "PCCX: Open Project Board"],
  ["pccxSystemVerilog.v0021.showTraceInspectHelp", "PCCX: Show Trace Inspect Help"],
]);

const V0021_KEYBINDINGS = [
  {
    command: "pccxSystemVerilog.v0021.showKv260StatusPanel",
    key: "ctrl+alt+k",
    mac: "cmd+alt+k",
  },
  {
    command: "pccxSystemVerilog.v0021.openRunbook",
    key: "ctrl+alt+r",
    mac: "cmd+alt+r",
  },
  {
    command: "pccxSystemVerilog.v0021.openProjectBoard",
    key: "ctrl+alt+p",
    mac: "cmd+alt+p",
  },
  {
    command: "pccxSystemVerilog.v0021.showTraceInspectHelp",
    key: "ctrl+alt+i",
    mac: "cmd+alt+i",
  },
];

async function readText(path) {
  return readFile(path, "utf8");
}

async function readPackageJson() {
  return JSON.parse(await readText(resolve(EXTENSION_ROOT, "package.json")));
}

function allManifestStrings(value, acc = []) {
  if (typeof value === "string") {
    acc.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      allManifestStrings(item, acc);
    }
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      allManifestStrings(item, acc);
    }
  }
  return acc;
}

async function testPackageManifestShape() {
  const manifest = await readPackageJson();

  assert.equal(manifest.private, true);
  assert.equal(manifest.name, "pccx-systemverilog-ide-prototype");
  assert.equal(manifest.displayName, "PCCX SystemVerilog IDE Prototype");
  assert.match(manifest.description, /experimental local VS Code extension scaffold/i);
  assert.match(manifest.description, /not published/i);
  assert.doesNotMatch(manifest.description, /marketplace/i);
  assert.ok(manifest.engines?.vscode);
  assert.equal(manifest.main, "./src/extension.cjs");
}

async function testNoMarketplacePublishingShape() {
  const manifest = await readPackageJson();
  const manifestStrings = allManifestStrings(manifest).join("\n");

  assert.equal(Object.hasOwn(manifest, "publisher"), false);
  assert.equal(Object.hasOwn(manifest, "galleryBanner"), false);
  assert.doesNotMatch(manifestStrings, /\bvsce\b/i);
  assert.equal(manifest.scripts, undefined);
  assert.equal(manifest.scripts?.publish, undefined);
  assert.equal(manifest.scripts?.package, undefined);
  assert.equal(manifest.dependencies, undefined);
  assert.deepEqual(manifest.devDependencies, {
    "@vscode/test-electron": "2.5.2",
  });
}

async function testCommandContributions() {
  const manifest = await readPackageJson();
  const contributedCommands = new Set(
    manifest.contributes?.commands?.map((command) => command.command),
  );
  const activationEvents = new Set(manifest.activationEvents);
  const commandIds = manifest.contributes?.commands?.map((command) => command.command);

  assert.deepEqual(commandIds, COMMAND_IDS);
  assert.deepEqual(
    manifest.activationEvents,
    COMMAND_IDS.map((commandId) => `onCommand:${commandId}`),
  );
  for (const commandId of COMMAND_IDS) {
    assert.ok(contributedCommands.has(commandId), `${commandId} missing from contributes.commands`);
    assert.ok(
      activationEvents.has(`onCommand:${commandId}`),
      `${commandId} missing activation event`,
    );
  }
  for (const [commandId, title] of V0021_COMMAND_TITLES) {
    assert.equal(
      manifest.contributes.commands.find((command) => command.command === commandId)?.title,
      title,
    );
  }
  assert.equal(contributedCommands.size, COMMAND_IDS.length);
}

async function testV0021DefaultKeybindings() {
  const manifest = await readPackageJson();
  const keybindings = manifest.contributes?.keybindings;

  assert.deepEqual(keybindings, V0021_KEYBINDINGS);
  for (const keybinding of keybindings) {
    assert.ok(COMMAND_IDS.includes(keybinding.command));
    assert.match(keybinding.key, /^ctrl\+alt\+[a-z]$/);
    assert.match(keybinding.mac, /^cmd\+alt\+[a-z]$/);
    assert.equal(Object.hasOwn(keybinding, "when"), false);
  }
}

async function testDocsKeepExperimentalScope() {
  const readme = await readText(resolve(EXTENSION_ROOT, "README.md"));
  const contract = await readText(resolve(ROOT, "docs/EDITOR_BRIDGE_CONTRACT.md"));
  const combined = `${readme}\n${contract}`;

  assert.match(combined, /experimental local VS Code extension scaffold/i);
  assert.match(combined, /not published/i);
  assert.match(combined, /no marketplace packaging/i);
  assert.match(combined, /no LSP/i);
  assert.match(combined, /not a stable ABI\/API/i);
  assert.match(combined, /static\/mock tests/i);
  assert.match(combined, /limited opt-in Extension Host runtime smoke/i);
  assert.match(combined, /not a product claim/i);
  assert.match(combined, /checked-example remains the default/i);
  assert.match(combined, /live workspace .*opt-in/i);
  assert.match(combined, /SystemVerilog workflow boundary/i);
  assert.match(combined, /boundary-only/i);
  assert.match(combined, /context bundle command/i);
  assert.match(combined, /workflow boundary status command/i);
  assert.match(combined, /validation command proposal/i);
  assert.match(combined, /validation proposal preflight audit/i);
  assert.match(combined, /patch proposal contract/i);
  assert.match(combined, /validation-to-patch handoff/i);
  assert.match(combined, /pccx-lab command\s+descriptor contract/i);
  assert.match(combined, /launcher status contract/i);
  assert.match(combined, /showLocalWorkflowStatus/);
  assert.match(combined, /showContextBundleAudit/);
  assert.match(combined, /approved validation runner/i);
  assert.match(combined, /allowlisted proposal IDs/i);
  assert.match(combined, /pccx-lab backend status/i);
  assert.match(combined, /showDiagnosticsHandoffSummary/);
  assert.match(combined, /KV260 status surface/i);
  assert.match(combined, /no provider\/runtime calls/i);
  assert.match(combined, /no MCP server implementation/i);
}

await testPackageManifestShape();
await testNoMarketplacePublishingShape();
await testCommandContributions();
await testV0021DefaultKeybindings();
await testDocsKeepExperimentalScope();

console.log("vscode extension manifest tests ok");
