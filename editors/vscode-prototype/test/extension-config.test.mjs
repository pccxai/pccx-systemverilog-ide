// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  WORKFLOW_BOUNDARY_BACKENDS,
  DECLARATION_KINDS,
  FACADE_COMMAND_IDS,
  MODES,
  VALIDATION_RUNNER_CWD_KINDS,
  VALIDATION_RUNNER_MODES,
  buildFacadeArgsForCommand,
  defaultConfig,
  normalizeConfig,
} from "../src/config.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const PACKAGE_JSON = resolve(ROOT, "editors/vscode-prototype/package.json");

const REQUIRED_SETTINGS = new Map([
  ["pccxSystemVerilog.mode", { type: "string", default: "checkedExample" }],
  ["pccxSystemVerilog.liveWorkspace.enabled", { type: "boolean", default: false }],
  ["pccxSystemVerilog.pccxLab.command", { type: "string", default: "pccx_ide_cli" }],
  ["pccxSystemVerilog.workflowBoundary.enabled", { type: "boolean", default: false }],
  ["pccxSystemVerilog.workflowBoundary.backend", { type: "string", default: "none" }],
  ["pccxSystemVerilog.validationRunner.enabled", { type: "boolean", default: false }],
  ["pccxSystemVerilog.validationRunner.mode", { type: "string", default: "disabled" }],
  ["pccxSystemVerilog.validationRunner.defaultWorkingDirectory", { type: "string", default: "repo-root" }],
  ["pccxSystemVerilog.validationRunner.maxOutputLines", { type: "integer", default: 120 }],
  ["pccxSystemVerilog.validationRunner.timeoutMs", { type: "integer", default: 30000 }],
  ["pccxSystemVerilog.pythonPath", { type: "string", default: "python3" }],
  ["pccxSystemVerilog.defaultSource", { type: "string", default: "fixtures/missing_endmodule.sv" }],
  ["pccxSystemVerilog.defaultLog", { type: "string", default: "fixtures/xsim/mixed.log" }],
  ["pccxSystemVerilog.defaultNavigationRoot", { type: "string", default: "fixtures/modules" }],
  ["pccxSystemVerilog.defaultModule", { type: "string", default: "simple_mod" }],
  ["pccxSystemVerilog.defaultDeclarationKind", { type: "string", default: "module" }],
  [
    "pccxSystemVerilog.kv260.preflightTranscriptPath",
    {
      type: "string",
      default: "~/.codex/private-state/board-preflight/preflight-tty-2026-05-06.md",
    },
  ],
]);

const LIVE_WORKSPACE_CONFIG = {
  mode: "liveWorkspace",
  liveWorkspace: { enabled: true },
};

async function readPackageJson() {
  return JSON.parse(await readFile(PACKAGE_JSON, "utf8"));
}

async function testPackageConfigurationSchema() {
  const manifest = await readPackageJson();
  const configuration = manifest.contributes?.configuration;
  assert.ok(configuration);
  assert.equal(configuration.title, "PCCX SystemVerilog IDE Prototype");
  assert.deepEqual(
    Object.keys(configuration.properties ?? {}).sort(),
    Array.from(REQUIRED_SETTINGS.keys()).sort(),
  );

  for (const [setting, expected] of REQUIRED_SETTINGS) {
    assert.ok(setting.startsWith("pccxSystemVerilog."), `${setting} is not prototype-scoped`);
    const property = configuration.properties?.[setting];
    assert.ok(property, `${setting} missing`);
    assert.equal(property.type, expected.type);
    assert.equal(property.default, expected.default);
    assert.match(property.description, /experimental local prototype/i);
    assert.match(property.description, /not a stable API/i);
  }

  assert.deepEqual(configuration.properties["pccxSystemVerilog.mode"].enum, MODES);
  assert.deepEqual(
    configuration.properties["pccxSystemVerilog.workflowBoundary.backend"].enum,
    WORKFLOW_BOUNDARY_BACKENDS,
  );
  assert.deepEqual(
    configuration.properties["pccxSystemVerilog.defaultDeclarationKind"].enum,
    DECLARATION_KINDS,
  );
  assert.deepEqual(
    configuration.properties["pccxSystemVerilog.validationRunner.mode"].enum,
    VALIDATION_RUNNER_MODES,
  );
  assert.deepEqual(
    configuration.properties["pccxSystemVerilog.validationRunner.defaultWorkingDirectory"].enum,
    VALIDATION_RUNNER_CWD_KINDS,
  );
}

function testDefaultConfig() {
  assert.deepEqual(defaultConfig(), {
    mode: "checkedExample",
    liveWorkspace: {
      enabled: false,
    },
    pccxLab: {
      command: "pccx_ide_cli",
    },
    workflowBoundary: {
      enabled: false,
      backend: "none",
    },
    validationRunner: {
      enabled: false,
      mode: "disabled",
      defaultWorkingDirectory: "repo-root",
      maxOutputLines: 120,
      timeoutMs: 30000,
    },
    pythonPath: "python3",
    defaultSource: "fixtures/missing_endmodule.sv",
    defaultLog: "fixtures/xsim/mixed.log",
    defaultNavigationRoot: "fixtures/modules",
    defaultModule: "simple_mod",
    defaultDeclarationKind: "module",
    kv260: {
      preflightTranscriptPath: "~/.codex/private-state/board-preflight/preflight-tty-2026-05-06.md",
    },
  });
}

function testNormalizeConfigRejectsInvalidSettings() {
  assert.throws(
    () => normalizeConfig({ mode: "automatic" }),
    /pccxSystemVerilog\.mode must be one of: checkedExample, liveWorkspace/,
  );
  assert.throws(
    () => normalizeConfig({ liveWorkspace: { enabled: "yes" } }),
    /pccxSystemVerilog\.liveWorkspace\.enabled must be a boolean/,
  );
  assert.throws(
    () => normalizeConfig({ pccxLab: { command: "pccx_ide_cli --format json" } }),
    /pccxSystemVerilog\.pccxLab\.command must be a command name or path without arguments/,
  );
  assert.throws(
    () => normalizeConfig({ workflowBoundary: { backend: "openai" } }),
    /pccxSystemVerilog\.workflowBoundary\.backend must be one of: none, pccx-llm-launcher, mcp/,
  );
  assert.throws(
    () => normalizeConfig({ validationRunner: { enabled: "yes" } }),
    /pccxSystemVerilog\.validationRunner\.enabled must be a boolean/,
  );
  assert.throws(
    () => normalizeConfig({ validationRunner: { mode: "shell" } }),
    /pccxSystemVerilog\.validationRunner\.mode must be one of: disabled, allowlisted/,
  );
  assert.throws(
    () => normalizeConfig({ validationRunner: { defaultWorkingDirectory: "tmp" } }),
    /pccxSystemVerilog\.validationRunner\.defaultWorkingDirectory must be one of: repo-root, workspace/,
  );
  assert.throws(
    () => normalizeConfig({ validationRunner: { maxOutputLines: 0 } }),
    /pccxSystemVerilog\.validationRunner\.maxOutputLines must be between 1 and 500/,
  );
  assert.throws(
    () => normalizeConfig({ validationRunner: { timeoutMs: 999 } }),
    /pccxSystemVerilog\.validationRunner\.timeoutMs must be between 1000 and 120000/,
  );
  assert.throws(
    () => normalizeConfig({ defaultDeclarationKind: "class" }),
    /pccxSystemVerilog\.defaultDeclarationKind must be one of: module, package, interface, any/,
  );
  assert.throws(
    () => normalizeConfig({ pythonPath: "" }),
    /pccxSystemVerilog\.pythonPath must be a non-empty string/,
  );
  assert.throws(
    () => normalizeConfig({ defaultSource: "fixtures/ok_module.sv; rm -rf /" }),
    /pccxSystemVerilog\.defaultSource must not contain shell control syntax/,
  );
  assert.throws(
    () => normalizeConfig({ defaultNavigationRoot: "fixtures/modules && whoami" }),
    /pccxSystemVerilog\.defaultNavigationRoot must not contain shell control syntax/,
  );
  assert.throws(
    () => normalizeConfig({ kv260: { preflightTranscriptPath: "preflight.md; cat secret" } }),
    /pccxSystemVerilog\.kv260\.preflightTranscriptPath must not contain shell control syntax/,
  );
}

function testFacadeArgsForKnownCommands() {
  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.showDiagnosticsExample"),
    ["diagnostics", "--mode", "example", "--source", "check-missing-endmodule"],
  );
  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.showCheckedExampleNavigation"),
    ["navigation", "--mode", "example", "--source", "declarations"],
  );
  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.showNavigationExample"),
    ["navigation", "--mode", "example", "--source", "declarations"],
  );
  assert.deepEqual(
    buildFacadeArgsForCommand(
      "pccxSystemVerilog.publishLiveWorkspaceDiagnostics",
      LIVE_WORKSPACE_CONFIG,
    ),
    ["diagnostics", "--mode", "live", "--from-check", "fixtures/missing_endmodule.sv"],
  );
  assert.deepEqual(
    buildFacadeArgsForCommand(
      "pccxSystemVerilog.showLiveWorkspaceNavigation",
      LIVE_WORKSPACE_CONFIG,
    ),
    ["navigation", "--mode", "live", "--locate", "fixtures/modules", "simple_mod", "--kind", "module"],
  );
  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.runDiagnosticsLive", LIVE_WORKSPACE_CONFIG),
    ["diagnostics", "--mode", "live", "--from-check", "fixtures/missing_endmodule.sv"],
  );
  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.runNavigationLive", LIVE_WORKSPACE_CONFIG),
    ["navigation", "--mode", "live", "--locate", "fixtures/modules", "simple_mod", "--kind", "module"],
  );
}

function testFacadeArgsUseNormalizedLiveConfig() {
  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.runDiagnosticsLive", {
      mode: "liveWorkspace",
      "liveWorkspace.enabled": true,
      defaultSource: "rtl/top.sv",
      defaultLog: "logs/xsim.log",
      defaultNavigationRoot: "rtl",
      pythonPath: "python-custom",
    }),
    ["diagnostics", "--mode", "live", "--from-check", "rtl/top.sv"],
  );

  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.runNavigationLive", {
      mode: "liveWorkspace",
      liveWorkspace: { enabled: true },
      defaultNavigationRoot: "rtl",
      defaultModule: "pkg_defs",
      defaultDeclarationKind: "any",
    }),
    ["navigation", "--mode", "live", "--locate", "rtl", "pkg_defs", "--kind", "any"],
  );
}

function testLiveWorkspaceRequiresExplicitOptIn() {
  for (const commandId of [
    "pccxSystemVerilog.publishLiveWorkspaceDiagnostics",
    "pccxSystemVerilog.showLiveWorkspaceNavigation",
    "pccxSystemVerilog.runDiagnosticsLive",
    "pccxSystemVerilog.runNavigationLive",
  ]) {
    assert.throws(
      () => buildFacadeArgsForCommand(commandId),
      /live workspace commands require pccxSystemVerilog\.mode=liveWorkspace/,
    );
    assert.throws(
      () => buildFacadeArgsForCommand(commandId, { liveWorkspace: { enabled: true } }),
      /live workspace commands require pccxSystemVerilog\.mode=liveWorkspace/,
    );
    assert.throws(
      () => buildFacadeArgsForCommand(commandId, { mode: "liveWorkspace" }),
      /live workspace commands require pccxSystemVerilog\.mode=liveWorkspace/,
    );
  }
}

function testUnknownCommandAndShellShape() {
  assert.throws(
    () => buildFacadeArgsForCommand("pccxSystemVerilog.runArbitraryCommand"),
    /unknown PCCX SystemVerilog command/,
  );

  for (const commandId of FACADE_COMMAND_IDS) {
    const args = commandId.includes("Live")
      ? buildFacadeArgsForCommand(commandId, LIVE_WORKSPACE_CONFIG)
      : buildFacadeArgsForCommand(commandId);
    assert.ok(Array.isArray(args));
    assert.ok(args.every((arg) => typeof arg === "string"));
    assert.doesNotMatch(args.join("\n"), /(?:&&|\|\||;|`|\$\()/);
  }
}

await testPackageConfigurationSchema();
testDefaultConfig();
testNormalizeConfigRejectsInvalidSettings();
testFacadeArgsForKnownCommands();
testFacadeArgsUseNormalizedLiveConfig();
testLiveWorkspaceRequiresExplicitOptIn();
testUnknownCommandAndShellShape();

console.log("vscode extension config tests ok");
