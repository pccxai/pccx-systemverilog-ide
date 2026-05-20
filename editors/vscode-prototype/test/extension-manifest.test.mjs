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
];

async function readText(path) {
  return readFile(path, "utf8");
}

async function readBytes(path) {
  return readFile(path);
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
  assert.equal(manifest.icon, "assets/logo/aperture-mark-128.png");
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
  assert.equal(contributedCommands.size, COMMAND_IDS.length);
}

async function testVisualAssetContributions() {
  const manifest = await readPackageJson();
  const themes = manifest.contributes?.themes ?? [];

  assert.deepEqual(themes, [
    {
      label: "pccx SystemVerilog Light",
      uiTheme: "vs",
      path: "./themes/pccx-systemverilog-light-color-theme.json",
    },
    {
      label: "pccx SystemVerilog Dark",
      uiTheme: "vs-dark",
      path: "./themes/pccx-systemverilog-dark-color-theme.json",
    },
  ]);

  const icon = await readBytes(resolve(EXTENSION_ROOT, manifest.icon));
  assert.ok(icon.length > 0);

  const mark = await readText(resolve(EXTENSION_ROOT, "assets/logo/aperture-mark.svg"));
  assert.match(mark, /#0b5fff/);
  assert.match(mark, /#0e1320/);

  const theme = JSON.parse(await readText(resolve(
    EXTENSION_ROOT,
    "themes/pccx-systemverilog-light-color-theme.json",
  )));
  assert.equal(theme.type, "light");
  assert.equal(theme.colors["editor.background"], "#ffffff");
  assert.equal(theme.colors["editor.foreground"], "#0e1320");
  assert.equal(theme.colors["button.background"], "#0b5fff");
  assert.ok(theme.tokenColors.some((token) => (
    token.name === "Keywords" && token.settings?.foreground === "#7c3aed"
  )));
  assert.ok(theme.tokenColors.some((token) => (
    token.name === "Types" && token.settings?.foreground === "#0d9488"
  )));
}

async function testThemeJsonTypes() {
  const manifest = await readPackageJson();
  const themes = manifest.contributes?.themes ?? [];

  for (const contribution of themes) {
    const theme = JSON.parse(await readText(resolve(EXTENSION_ROOT, contribution.path)));
    if (contribution.uiTheme === "vs-dark") {
      assert.equal(theme.type, "dark");
    } else {
      assert.equal(theme.type, "light");
    }
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
  assert.match(combined, /no provider\/runtime calls/i);
  assert.match(combined, /no MCP server implementation/i);
}

await testPackageManifestShape();
await testNoMarketplacePublishingShape();
await testCommandContributions();
await testVisualAssetContributions();
await testThemeJsonTypes();
await testDocsKeepExperimentalScope();

console.log("vscode extension manifest tests ok");
