// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDiagnosticsPresentation,
  createNavigationPresentation,
  mapDiagnosticSeverity,
  presentAction,
  presentDiagnostics,
  presentNavigation,
} from "../src/presenter.mjs";
import {
  activate,
  deactivate,
} from "../src/extension.mjs";
import { COMMAND_IDS } from "../src/config.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function diagnosticsAction(diagnostics) {
  return {
    kind: "diagnostics",
    diagnostics,
    summary: `${diagnostics.length} diagnostic(s)`,
  };
}

function navigationAction(items) {
  return {
    kind: "navigation",
    items,
    summary: `${items.length} navigation item(s)`,
  };
}

function mockPresenterDeps() {
  const calls = {
    clear: 0,
    set: [],
    info: [],
    warning: [],
    quickPick: [],
  };

  return {
    calls,
    deps: {
      createUri(file) {
        return { uri: file };
      },
      createRange(startLine, startCharacter, endLine, endCharacter) {
        return { startLine, startCharacter, endLine, endCharacter };
      },
      createDiagnostic(range, message, severity, raw) {
        return { range, message, severity, raw };
      },
      diagnosticSeverity: {
        Error: 1,
        Warning: 2,
        Information: 3,
      },
      diagnosticsCollection: {
        clear() {
          calls.clear += 1;
        },
        set(uri, diagnostics) {
          calls.set.push({ uri, diagnostics });
        },
      },
      async showInformationMessage(message, payload) {
        calls.info.push({ message, payload });
      },
      async showWarningMessage(message, payload) {
        calls.warning.push({ message, payload });
      },
      async showQuickPick(items, options) {
        calls.quickPick.push({ items, options });
        return items[0];
      },
    },
  };
}

function testDiagnosticsPresentationGroupsByFile() {
  const action = diagnosticsAction([
    { file: "a.sv", message: "a1" },
    { file: "b.sv", message: "b1" },
    { file: "a.sv", message: "a2" },
  ]);
  const presentation = createDiagnosticsPresentation(action);

  assert.equal(presentation.kind, "diagnostics-presentation");
  assert.equal(presentation.summary, "3 diagnostic(s)");
  assert.deepEqual(
    presentation.files.map((group) => [group.file, group.diagnostics.length]),
    [["a.sv", 2], ["b.sv", 1]],
  );
}

function testDiagnosticsPresenterCallsCollectionSet() {
  const { calls, deps } = mockPresenterDeps();
  const action = diagnosticsAction([
    {
      file: "a.sv",
      message: "bad",
      severity: "Error",
      range: { start: { line: 2, character: 4 }, end: { line: 2, character: 5 } },
    },
  ]);

  const presentation = presentDiagnostics(action, deps);

  assert.equal(presentation.files.length, 1);
  assert.equal(calls.set.length, 1);
  assert.deepEqual(calls.set[0].uri, { uri: "a.sv" });
  assert.deepEqual(calls.set[0].diagnostics[0].range, {
    startLine: 2,
    startCharacter: 4,
    endLine: 2,
    endCharacter: 5,
  });
  assert.equal(calls.set[0].diagnostics[0].severity, 1);
  assert.equal(calls.set[0].diagnostics[0].source, undefined);
  assert.equal(calls.warning[0].message, "1 diagnostic(s)");
}

function testDiagnosticsPresenterMapsSourceAndCode() {
  const { calls, deps } = mockPresenterDeps();
  const action = diagnosticsAction([
    {
      file: "a.sv",
      message: "bad",
      severity: "Error",
      source: "check",
      code: "PCCX-SCAFFOLD-003",
    },
  ]);

  presentDiagnostics(action, deps);

  assert.equal(calls.set[0].diagnostics[0].source, "check");
  assert.equal(calls.set[0].diagnostics[0].code, "PCCX-SCAFFOLD-003");
}

function testDiagnosticsZeroCaseClearsCollection() {
  const { calls, deps } = mockPresenterDeps();
  const presentation = presentDiagnostics(diagnosticsAction([]), deps);

  assert.equal(presentation.files.length, 0);
  assert.equal(calls.clear, 1);
  assert.equal(calls.set.length, 0);
  assert.equal(calls.info[0].message, "0 diagnostic(s)");
}

function testDiagnosticsSeverityMapping() {
  const severity = { Error: "E", Warning: "W", Information: "I" };
  assert.equal(mapDiagnosticSeverity("Error", severity), "E");
  assert.equal(mapDiagnosticSeverity("Warning", severity), "W");
  assert.equal(mapDiagnosticSeverity("Information", severity), "I");
  assert.equal(mapDiagnosticSeverity("notice", severity), "I");
}

function testDiagnosticsMissingFileAndLocation() {
  const { calls, deps } = mockPresenterDeps();
  const action = diagnosticsAction([{ message: "missing location", severity: "notice" }]);
  const presentation = presentDiagnostics(action, deps);

  assert.equal(presentation.files[0].file, "");
  assert.deepEqual(calls.set[0].uri, { uri: "" });
  assert.deepEqual(calls.set[0].diagnostics[0].range, {
    startLine: 0,
    startCharacter: 0,
    endLine: 0,
    endCharacter: 1,
  });
  assert.equal(calls.set[0].diagnostics[0].severity, 3);
}

function testNavigationPresentationCreatesQuickPickItems() {
  const action = navigationAction([
    {
      name: "simple_mod",
      kind: "module",
      file: "fixtures/modules/simple_module.sv",
      line: 1,
      column: 1,
    },
  ]);
  const presentation = createNavigationPresentation(action);

  assert.equal(presentation.kind, "navigation-presentation");
  assert.deepEqual(presentation.items[0], {
    label: "module simple_mod",
    description: "fixtures/modules/simple_module.sv:1:1",
    detail: "module",
    file: "fixtures/modules/simple_module.sv",
    line: 1,
    column: 1,
  });
}

async function testNavigationPresenterCallsQuickPick() {
  const { calls, deps } = mockPresenterDeps();
  const action = navigationAction([
    { name: "pkg_defs", kind: "package", file: "pkg.sv", line: 1, column: 1 },
  ]);

  const presentation = await presentNavigation(action, deps);

  assert.equal(presentation.items.length, 1);
  assert.equal(calls.quickPick.length, 1);
  assert.equal(calls.quickPick[0].items[0].label, "package pkg_defs");
  assert.equal(calls.quickPick[0].options.placeHolder, "1 navigation item(s)");
}

async function testNavigationZeroCaseShowsInformation() {
  const { calls, deps } = mockPresenterDeps();
  const presentation = await presentNavigation(navigationAction([]), deps);

  assert.equal(presentation.items.length, 0);
  assert.equal(calls.quickPick.length, 0);
  assert.equal(calls.info[0].message, "0 navigation item(s)");
}

function testInvalidActionsRejected() {
  assert.throws(
    () => createDiagnosticsPresentation({ kind: "navigation", items: [] }),
    /expected diagnostics UI action/,
  );
  assert.throws(
    () => createNavigationPresentation({ kind: "diagnostics", diagnostics: [] }),
    /expected navigation UI action/,
  );
}

async function testPresentActionDispatches() {
  const diagnosticsDeps = mockPresenterDeps();
  const diagnosticPresentation = await presentAction(
    diagnosticsAction([{ file: "a.sv", message: "bad" }]),
    diagnosticsDeps.deps,
  );
  assert.equal(diagnosticPresentation.kind, "diagnostics-presentation");
  assert.equal(diagnosticsDeps.calls.set.length, 1);

  const navigationDeps = mockPresenterDeps();
  const navigationPresentation = await presentAction(
    navigationAction([{ name: "simple_mod", kind: "module", file: "a.sv" }]),
    navigationDeps.deps,
  );
  assert.equal(navigationPresentation.kind, "navigation-presentation");
  assert.equal(navigationDeps.calls.quickPick.length, 1);
}

async function testExtensionEntrypointCanWirePresenter() {
  assert.equal(typeof activate, "function");
  assert.equal(typeof deactivate, "function");

  const commandHandlers = new Map();
  const calls = {
    set: [],
    warning: [],
  };
  const vscodeApi = {
    commands: {
      registerCommand(commandId, handler) {
        commandHandlers.set(commandId, handler);
        return { dispose() {} };
      },
    },
    window: {
      createOutputChannel() {
        return { appendLine() {}, show() {}, dispose() {} };
      },
      showWarningMessage(message) {
        calls.warning.push(message);
      },
    },
  };

  const activation = await activate(
    { subscriptions: [] },
    vscodeApi,
    {
      async runFacade() {
        return {
          ok: true,
          json: {
            kind: "vscode-diagnostics",
            diagnostics: [{ file: "a.sv", message: "bad", severity: "Error" }],
          },
        };
      },
      presenterDeps: {
        createUri(file) {
          return { uri: file };
        },
        diagnosticsCollection: {
          set(uri, diagnostics) {
            calls.set.push({ uri, diagnostics });
          },
          clear() {},
        },
      },
    },
  );

  assert.deepEqual(activation.commandIds, COMMAND_IDS);
  const result = await commandHandlers.get("pccxSystemVerilog.showDiagnosticsExample")();
  assert.equal(result.ok, true);
  assert.equal(calls.set.length, 1);
  assert.deepEqual(calls.set[0].uri, { uri: "a.sv" });
}

async function testPresenterDoesNotImportVscode() {
  const source = await readFile(resolve(ROOT, "editors/vscode-prototype/src/presenter.mjs"), "utf8");
  const testSource = await readFile(resolve(ROOT, "editors/vscode-prototype/test/presenter.test.mjs"), "utf8");

  assert.doesNotMatch(source, /from ["']vscode["']|import\(["']vscode["']\)/);
  assert.doesNotMatch(testSource, /from ["']vscode["']|import\(["']vscode["']\)/);
}

function testPresenterDoesNotReturnShellStrings() {
  const diagnostics = createDiagnosticsPresentation(diagnosticsAction([]));
  const navigation = createNavigationPresentation(navigationAction([]));
  assert.doesNotMatch(JSON.stringify(diagnostics), /(?:&&|\|\||;|`|\$\()/);
  assert.doesNotMatch(JSON.stringify(navigation), /(?:&&|\|\||;|`|\$\()/);
}

testDiagnosticsPresentationGroupsByFile();
testDiagnosticsPresenterCallsCollectionSet();
testDiagnosticsPresenterMapsSourceAndCode();
testDiagnosticsZeroCaseClearsCollection();
testDiagnosticsSeverityMapping();
testDiagnosticsMissingFileAndLocation();
testNavigationPresentationCreatesQuickPickItems();
await testNavigationPresenterCallsQuickPick();
await testNavigationZeroCaseShowsInformation();
testInvalidActionsRejected();
await testPresentActionDispatches();
await testExtensionEntrypointCanWirePresenter();
await testPresenterDoesNotImportVscode();
testPresenterDoesNotReturnShellStrings();

console.log("vscode presenter tests ok");
