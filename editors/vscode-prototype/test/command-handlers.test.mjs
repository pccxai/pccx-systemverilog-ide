// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";

import {
  createCommandExecutionPlan,
  runPrototypeCommand,
  toDiagnosticsUiAction,
  toNavigationUiAction,
} from "../src/command-handlers.mjs";
import {
  COMMAND_IDS,
  FACADE_COMMAND_IDS,
} from "../src/config.mjs";
import {
  activate,
  deactivate,
} from "../src/extension.mjs";

const LIVE_WORKSPACE_CONFIG = {
  mode: "liveWorkspace",
  liveWorkspace: { enabled: true },
};

function configForCommand(commandId) {
  return commandId.includes("Live") ? LIVE_WORKSPACE_CONFIG : {};
}

function mockDeps(payloadOrResult) {
  const calls = {
    runFacade: [],
    info: [],
    warning: [],
    diagnostics: [],
    navigation: [],
  };

  return {
    calls,
    deps: {
      async runFacade(args, env, plan) {
        calls.runFacade.push({ args, env, plan });
        if (payloadOrResult && Object.hasOwn(payloadOrResult, "ok")) {
          return payloadOrResult;
        }
        return { ok: true, json: payloadOrResult };
      },
      async showInformationMessage(message, action) {
        calls.info.push({ message, action });
      },
      async showWarningMessage(message, action) {
        calls.warning.push({ message, action });
      },
      async updateDiagnostics(diagnostics, action) {
        calls.diagnostics.push({ diagnostics, action });
      },
      async showNavigationItems(items, action) {
        calls.navigation.push({ items, action });
      },
    },
  };
}

function testPlansForKnownCommands() {
  for (const commandId of FACADE_COMMAND_IDS) {
    const plan = createCommandExecutionPlan(commandId, configForCommand(commandId));
    assert.equal(plan.commandId, commandId);
    assert.ok(Array.isArray(plan.facadeArgs));
    assert.ok(plan.facadeArgs.every((arg) => typeof arg === "string"));
  }
}

function testUnknownCommandRejected() {
  assert.throws(
    () => createCommandExecutionPlan("pccxSystemVerilog.runArbitraryCommand"),
    /unknown PCCX SystemVerilog command/,
  );
}

async function testDiagnosticsExampleAction() {
  const diagnostic = { file: "a.sv", message: "bad", severity: "Error" };
  const { calls, deps } = mockDeps({
    kind: "vscode-diagnostics",
    diagnostics: [diagnostic],
  });

  const result = await runPrototypeCommand(
    "pccxSystemVerilog.showDiagnosticsExample",
    {},
    deps,
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.action, {
    kind: "diagnostics",
    diagnostics: [diagnostic],
    summary: "1 diagnostic(s)",
  });
  assert.deepEqual(calls.runFacade[0].args, [
    "diagnostics",
    "--mode",
    "example",
    "--source",
    "check-missing-endmodule",
  ]);
  assert.deepEqual(calls.diagnostics[0].diagnostics, [diagnostic]);
  assert.equal(calls.warning[0].message, "1 diagnostic(s)");
}

async function testPublishCheckedExampleDiagnosticsAction() {
  const diagnostic = { file: "a.sv", message: "bad", severity: "Error" };
  const { calls, deps } = mockDeps({
    kind: "vscode-diagnostics",
    diagnostics: [diagnostic],
  });

  const result = await runPrototypeCommand(
    "pccxSystemVerilog.publishCheckedExampleDiagnostics",
    {
      mode: "liveWorkspace",
      liveWorkspace: { enabled: true },
      defaultSource: "live.sv",
      pythonPath: "python-custom",
    },
    deps,
  );

  assert.equal(result.ok, true);
  assert.deepEqual(calls.runFacade[0].args, [
    "diagnostics",
    "--mode",
    "example",
    "--source",
    "check-missing-endmodule",
  ]);
  assert.deepEqual(calls.runFacade[0].env, {});
  assert.equal(result.action.kind, "diagnostics");
  assert.equal(result.action.diagnostics.length, 1);
}

async function testPublishLiveWorkspaceDiagnosticsAction() {
  const { calls, deps } = mockDeps({
    kind: "vscode-diagnostics",
    diagnostics: [],
  });

  const result = await runPrototypeCommand(
    "pccxSystemVerilog.publishLiveWorkspaceDiagnostics",
    {
      mode: "liveWorkspace",
      liveWorkspace: { enabled: true },
      defaultSource: "rtl/top.sv",
      pythonPath: "python-custom",
    },
    deps,
  );

  assert.equal(result.ok, true);
  assert.equal(result.action.summary, "0 diagnostic(s)");
  assert.deepEqual(calls.runFacade[0].args, [
    "diagnostics",
    "--mode",
    "live",
    "--from-check",
    "rtl/top.sv",
  ]);
  assert.deepEqual(calls.runFacade[0].env, { PCCX_IDE_PYTHON: "python-custom" });
  assert.equal(calls.info[0].message, "0 diagnostic(s)");
}

async function testNavigationExampleAction() {
  const item = { name: "simple_mod", kind: "module", file: "simple.sv" };
  const { calls, deps } = mockDeps({
    kind: "vscode-navigation",
    items: [item],
  });

  const result = await runPrototypeCommand(
    "pccxSystemVerilog.showNavigationExample",
    {},
    deps,
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.action, {
    kind: "navigation",
    items: [item],
    summary: "1 navigation item(s)",
  });
  assert.deepEqual(calls.runFacade[0].args, [
    "navigation",
    "--mode",
    "example",
    "--source",
    "declarations",
  ]);
  assert.deepEqual(calls.navigation[0].items, [item]);
}

async function testCheckedExampleNavigationAction() {
  const item = { name: "pkg_defs", kind: "package", file: "pkg.sv" };
  const { calls, deps } = mockDeps({
    kind: "vscode-navigation",
    items: [item],
  });

  const result = await runPrototypeCommand(
    "pccxSystemVerilog.showCheckedExampleNavigation",
    {
      mode: "liveWorkspace",
      liveWorkspace: { enabled: true },
      pythonPath: "python-custom",
    },
    deps,
  );

  assert.equal(result.ok, true);
  assert.deepEqual(calls.runFacade[0].args, [
    "navigation",
    "--mode",
    "example",
    "--source",
    "declarations",
  ]);
  assert.deepEqual(calls.runFacade[0].env, {});
  assert.equal(result.action.kind, "navigation");
  assert.deepEqual(result.action.items, [item]);
}

async function testShowLiveWorkspaceNavigationAction() {
  const { calls, deps } = mockDeps({
    kind: "vscode-navigation",
    items: [],
  });

  const result = await runPrototypeCommand(
    "pccxSystemVerilog.showLiveWorkspaceNavigation",
    {
      mode: "liveWorkspace",
      liveWorkspace: { enabled: true },
      defaultNavigationRoot: "editors/vscode-prototype/test/fixtures/live-workspace",
      defaultModule: "pkg_defs",
      defaultDeclarationKind: "package",
      pythonPath: "python-custom",
    },
    deps,
  );

  assert.equal(result.ok, true);
  assert.equal(result.action.summary, "0 navigation item(s)");
  assert.deepEqual(calls.runFacade[0].args, [
    "navigation",
    "--mode",
    "live",
    "--locate",
    "editors/vscode-prototype/test/fixtures/live-workspace",
    "pkg_defs",
    "--kind",
    "package",
  ]);
  assert.deepEqual(calls.runFacade[0].env, { PCCX_IDE_PYTHON: "python-custom" });
}

async function testLiveWorkspaceDisabledControlledFailure() {
  const { calls, deps } = mockDeps({
    kind: "vscode-diagnostics",
    diagnostics: [],
  });

  const result = await runPrototypeCommand(
    "pccxSystemVerilog.publishLiveWorkspaceDiagnostics",
    {},
    deps,
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /live workspace commands require/);
  assert.equal(calls.runFacade.length, 0);
  assert.match(calls.warning[0].message, /live workspace commands require/);
}

async function testRunFacadeUsesArgumentArray() {
  const { calls, deps } = mockDeps({
    kind: "vscode-navigation",
    items: [],
  });

  await runPrototypeCommand("pccxSystemVerilog.showNavigationExample", {}, deps);

  assert.ok(Array.isArray(calls.runFacade[0].args));
  assert.ok(calls.runFacade[0].args.every((arg) => typeof arg === "string"));
  assert.doesNotMatch(calls.runFacade[0].args.join("\n"), /(?:&&|\|\||;|`|\$\()/);
}

async function testInvalidConfigControlledFailure() {
  const { calls, deps } = mockDeps({
    kind: "vscode-diagnostics",
    diagnostics: [],
  });

  const result = await runPrototypeCommand(
    "pccxSystemVerilog.runDiagnosticsLive",
    { mode: "automatic" },
    deps,
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /pccxSystemVerilog\.mode must be one of/);
  assert.equal(calls.runFacade.length, 0);
  assert.match(calls.warning[0].message, /pccxSystemVerilog\.mode/);
}

async function testFacadeFailureControlledFailure() {
  const { calls, deps } = mockDeps({
    ok: false,
    error: "facade failed",
  });

  const result = await runPrototypeCommand(
    "pccxSystemVerilog.showDiagnosticsExample",
    {},
    deps,
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, "facade failed");
  assert.equal(calls.runFacade.length, 1);
  assert.equal(calls.warning[0].message, "facade failed");
}

async function testInvalidFacadeKindControlledFailure() {
  const { calls, deps } = mockDeps({
    kind: "vscode-symbols",
    items: [],
  });

  const result = await runPrototypeCommand(
    "pccxSystemVerilog.showNavigationExample",
    {},
    deps,
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /unsupported facade payload kind: vscode-symbols/);
  assert.equal(calls.navigation.length, 0);
  assert.match(calls.warning[0].message, /unsupported facade payload kind/);
}

function testActionSummaries() {
  assert.equal(
    toDiagnosticsUiAction({ kind: "vscode-diagnostics", diagnostics: [{}, {}] }).summary,
    "2 diagnostic(s)",
  );
  assert.equal(
    toNavigationUiAction({ kind: "vscode-navigation", items: [{}, {}, {}] }).summary,
    "3 navigation item(s)",
  );
}

async function testExtensionExportsAndRegistration() {
  assert.equal(typeof activate, "function");
  assert.equal(typeof deactivate, "function");

  const commandIds = [];
  const activation = await activate(
    { subscriptions: [] },
    {
      commands: {
        registerCommand(commandId) {
          commandIds.push(commandId);
          return { dispose() {} };
        },
      },
      window: {
        createOutputChannel() {
          return { appendLine() {}, show() {}, dispose() {} };
        },
      },
    },
    {
      async runFacade() {
        return { ok: true, json: { kind: "vscode-diagnostics", diagnostics: [] } };
      },
    },
  );

  assert.deepEqual(activation.commandIds, COMMAND_IDS);
  assert.deepEqual(commandIds, COMMAND_IDS);
}

testPlansForKnownCommands();
testUnknownCommandRejected();
await testDiagnosticsExampleAction();
await testPublishCheckedExampleDiagnosticsAction();
await testPublishLiveWorkspaceDiagnosticsAction();
await testNavigationExampleAction();
await testCheckedExampleNavigationAction();
await testShowLiveWorkspaceNavigationAction();
await testRunFacadeUsesArgumentArray();
await testLiveWorkspaceDisabledControlledFailure();
await testInvalidConfigControlledFailure();
await testFacadeFailureControlledFailure();
await testInvalidFacadeKindControlledFailure();
testActionSummaries();
await testExtensionExportsAndRegistration();

console.log("vscode command handler tests ok");
