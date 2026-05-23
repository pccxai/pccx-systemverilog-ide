// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const EXTENSION_ROOT = resolve(ROOT, "editors/vscode-prototype");
const SCRIPT = resolve(ROOT, "scripts/vscode-extension-host-smoke.sh");

async function readText(path) {
  return readFile(path, "utf8");
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function testPinnedRuntimeDependencyOnly() {
  const manifest = await readJson(resolve(EXTENSION_ROOT, "package.json"));
  const lockfile = await readJson(resolve(EXTENSION_ROOT, "package-lock.json"));
  const deps = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
  };

  assert.equal(manifest.dependencies, undefined);
  assert.deepEqual(manifest.devDependencies, {
    "@vscode/test-electron": "2.5.2",
  });
  assert.equal(deps["@vscode/test-electron"], "2.5.2");
  assert.equal(deps.vscode, undefined);
  assert.equal(await pathExists(resolve(ROOT, "package-lock.json")), false);
  assert.equal(lockfile.packages[""].devDependencies["@vscode/test-electron"], "2.5.2");
  assert.equal(lockfile.packages["node_modules/@vscode/test-electron"].version, "2.5.2");
  assert.match(
    lockfile.packages["node_modules/@vscode/test-electron"].integrity,
    /^sha512-/,
  );
}

function testGuardedScriptDefault() {
  const result = spawnSync("bash", [SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      PCCX_RUN_EXTENSION_HOST_SMOKE: "",
    },
  });
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.status, 2);
  assert.match(output, /Extension Host smoke is available but not enabled by default/);
  assert.match(output, /Default coverage remains static\/mock-only/);
  assert.match(output, /opt-in local runtime check/);
  assert.match(output, /PCCX_RUN_EXTENSION_HOST_SMOKE=1 bash scripts\/vscode-extension-host-smoke\.sh/);
  assert.match(output, /npm ci --prefix editors\/vscode-prototype/);
  assert.match(output, /VS Code 1\.90\.2/);
  assert.match(output, /@vscode\/test-electron/);
  assert.match(output, /do not add vsce/);
}

async function testReadinessDocsAndCiPolicy() {
  const readme = await readText(resolve(EXTENSION_ROOT, "README.md"));
  const readiness = await readText(resolve(EXTENSION_ROOT, "docs/EXTENSION_HOST_READINESS.md"));
  const ci = await readText(resolve(ROOT, ".github/workflows/ci.yml"));
  const extensionEntrypoint = await readText(resolve(EXTENSION_ROOT, "src/extension.mjs"));
  const extensionWrapper = await readText(resolve(EXTENSION_ROOT, "src/extension.cjs"));
  const definitionProvider = await readText(resolve(EXTENSION_ROOT, "src/definition-provider.mjs"));

  assert.match(readme, /experimental local VS Code prototype/i);
  assert.match(readme, /mostly static\/mock tests/i);
  assert.match(readme, /limited opt-in\s+Extension Host runtime smoke/i);
  assert.match(readiness, /Option A/i);
  assert.match(readiness, /local-only Extension Host runtime smoke/i);
  assert.match(readiness, /not a product claim/i);
  assert.match(readiness, /PCCX_RUN_EXTENSION_HOST_SMOKE=1/);
  assert.match(readiness, /marketplace packaging/i);
  assert.match(readiness, /(?:not LSP|LSP support|LSP server)/i);
  assert.match(readiness, /(?:not a stable ABI\/API|stable ABI\/API claim)/i);
  assert.match(readiness, /facade boundary/i);
  assert.match(`${readme}\n${readiness}`, /DiagnosticCollection/);
  assert.match(`${readme}\n${readiness}`, /showCheckedExampleNavigation/);
  assert.match(`${readme}\n${readiness}`, /DefinitionProvider/);
  assert.match(`${readme}\n${readiness}`, /VS Code-native\s+provider smoke/i);
  assert.match(`${readme}\n${readiness}`, /command-first navigation/i);
  assert.match(`${readme}\n${readiness}`, /live workspace .*opt-in/i);
  assert.match(`${readme}\n${readiness}`, /controlled fixture/i);
  assert.match(`${readme}\n${readiness}`, /showWorkflowBoundaryStatus/);
  assert.match(`${readme}\n${readiness}`, /buildWorkflowContextBundle/);
  assert.match(`${readme}\n${readiness}`, /selected-symbol context/i);
  assert.match(`${readme}\n${readiness}`, /proposeValidationCommand/);
  assert.match(`${readme}\n${readiness}`, /auditValidationProposalPreflight/);
  assert.match(`${readme}\n${readiness}`, /runApprovedValidationCommand/);
  assert.match(`${readme}\n${readiness}`, /showRecentValidationResults/);
  assert.match(`${readme}\n${readiness}`, /showValidationCacheStatus/);
  assert.match(`${readme}\n${readiness}`, /clearValidationResultCache/);
  assert.match(`${readme}\n${readiness}`, /showPatchProposalPreview/);
  assert.match(`${readme}\n${readiness}`, /clearPatchProposalPreview/);
  assert.match(`${readme}\n${readiness}`, /showLocalWorkflowStatus/);
  assert.match(`${readme}\n${readiness}`, /showContextBundleAudit/);
  assert.match(`${readme}\n${readiness}`, /showLocalSynthesisPlan/);
  assert.match(`${readme}\n${readiness}`, /showPccxLabBackendStatus/);
  assert.match(`${readme}\n${readiness}`, /showDiagnosticsHandoffSummary/);
  assert.match(`${readme}\n${readiness}`, /showAssistStatus/);
  assert.match(`${readme}\n${readiness}`, /runVeribleLintDiagnostics/);
  assert.match(`${readme}\n${readiness}`, /prepareSimulationHandoff/);
  assert.match(`${readme}\n${readiness}`, /context bundle command/i);
  assert.match(`${readme}\n${readiness}`, /validation command proposal/i);
  assert.match(`${readme}\n${readiness}`, /validation proposal preflight audit/i);
  assert.match(`${readme}\n${readiness}`, /patch proposal contract/i);
  assert.match(`${readme}\n${readiness}`, /validation-to-patch handoff/i);
  assert.match(`${readme}\n${readiness}`, /pccx-lab command descriptor contract/i);
  assert.match(`${readme}\n${readiness}`, /launcher status contract/i);
  assert.match(`${readme}\n${readiness}`, /pccx-lab backend status/i);
  assert.match(`${readme}\n${readiness}`, /workflow boundary .*boundary/i);
  assert.match(`${readme}\n${readiness}`, /pccx-launcher .*future local LLM\/chat backend/i);
  assert.match(`${readme}\n${readiness}`, /stdio language-server adapter/i);
  assert.match(`${readme}\n${readiness}`, /verible-verilog-ls/i);
  assert.match(`${readme}\n${readiness}`, /host theme first/i);
  assert.match(`${readme}\n${readiness}`, /not a completed\s+custom theme system/i);
  assert.doesNotMatch(ci, /vscode-extension-host-smoke\.sh/);
  assert.doesNotMatch(ci, /PCCX_RUN_EXTENSION_HOST_SMOKE/);
  assert.doesNotMatch(extensionEntrypoint, /pccx_ide_cli/);
  assert.doesNotMatch(extensionWrapper, /pccx_ide_cli/);
  assert.doesNotMatch(definitionProvider, /pccx_ide_cli/);
  assert.doesNotMatch(`${extensionEntrypoint}\n${definitionProvider}`, /LanguageClient|vscode-languageclient/);
  assert.match(definitionProvider, /checkedExampleDefinitionProvider/);
  assert.match(extensionEntrypoint, /registerCheckedExampleDefinitionProvider/);
  assert.match(extensionWrapper, /require\("vscode"\)/);
  assert.match(extensionWrapper, /import\("\.\/extension\.mjs"\)/);
}

async function testRuntimeRunnerIsPinnedAndBounded() {
  const script = await readText(SCRIPT);
  const runnerPath = resolve(EXTENSION_ROOT, "test/extension-host/run-extension-host-smoke.mjs");
  const suitePath = resolve(EXTENSION_ROOT, "test/extension-host/smoke-suite.cjs");
  const runner = await readText(runnerPath);
  const suite = await readText(suitePath);

  assert.match(script, /PCCX_RUN_EXTENSION_HOST_SMOKE/);
  assert.match(script, /run-extension-host-smoke\.mjs/);
  assert.match(script, /npm ci --prefix editors\/vscode-prototype/);
  assert.match(runner, /VSCODE_TEST_VERSION = "1\.90\.2"/);
  assert.match(runner, /runTests/);
  assert.match(runner, /extensionDevelopmentPath/);
  assert.match(runner, /LIVE_WORKSPACE_FIXTURE/);
  assert.match(runner, /test\/fixtures\/live-workspace/);
  assert.match(runner, /\.vscode-test/);
  assert.match(runner, /--extensions-dir=/);
  assert.match(runner, /--user-data-dir=/);
  assert.match(suite, /getCommands/);
  assert.match(suite, /publishCheckedExampleDiagnostics/);
  assert.match(suite, /showCheckedExampleNavigation/);
  assert.match(suite, /publishLiveWorkspaceDiagnostics/);
  assert.match(suite, /showLiveWorkspaceNavigation/);
  assert.match(suite, /liveNavigationResult/);
  assert.match(suite, /live_top/);
  assert.match(suite, /live workspace commands require/);
  assert.match(suite, /broken_missing_endmodule\.sv/);
  assert.match(suite, /showWorkflowBoundaryStatus/);
  assert.match(suite, /buildWorkflowContextBundle/);
  assert.match(suite, /selectedContext/);
  assert.match(suite, /proposeValidationCommand/);
  assert.match(suite, /auditValidationProposalPreflight/);
  assert.match(suite, /runApprovedValidationCommand/);
  assert.match(suite, /showRecentValidationResults/);
  assert.match(suite, /showValidationCacheStatus/);
  assert.match(suite, /clearValidationResultCache/);
  assert.match(suite, /clearValidationCache/);
  assert.match(suite, /recentValidationResultsEmpty/);
  assert.match(suite, /showPatchProposalPreview/);
  assert.match(suite, /clearPatchProposalPreview/);
  assert.match(suite, /showLocalWorkflowStatus/);
  assert.match(suite, /showContextBundleAudit/);
  assert.match(suite, /showLocalSynthesisPlan/);
  assert.match(suite, /validationRunner\.enabled/);
  assert.match(suite, /vscodeAdapterSmoke/);
  assert.match(suite, /showPccxLabBackendStatus/);
  assert.match(suite, /showDiagnosticsHandoffSummary/);
  assert.match(suite, /providerCallsImplemented/);
  assert.match(suite, /getDiagnostics/);
  assert.match(suite, /DiagnosticSeverity\.Error/);
  assert.match(suite, /navigationResult\.locations/);
  assert.match(suite, /vscode\.Location/);
  assert.match(suite, /vscode\.executeDefinitionProvider/);
  assert.match(suite, /definitionProviders/);
  assert.match(suite, /definitionProvider\.checkedExample/);
  assert.doesNotMatch(suite, /executeCommand\(\s*"pccxSystemVerilog\.runDiagnosticsLive"/);
  assert.doesNotMatch(suite, /executeCommand\(\s*"pccxSystemVerilog\.runNavigationLive"/);
}

await testPinnedRuntimeDependencyOnly();
testGuardedScriptDefault();
await testReadinessDocsAndCiPolicy();
await testRuntimeRunnerIsPinnedAndBounded();

console.log("vscode extension host readiness tests ok");
