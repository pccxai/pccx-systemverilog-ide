// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";

import {
  WORKFLOW_CONTEXT_BUNDLE_COMMAND,
  WORKFLOW_BOUNDARY_STATUS_COMMAND,
  AUDIT_VALIDATION_PREFLIGHT_COMMAND,
  APPROVED_VALIDATION_RUNNER_COMMAND,
  CLEAR_PATCH_PROPOSAL_PREVIEW_COMMAND,
  CLEAR_VALIDATION_RESULT_CACHE_COMMAND,
  COMMAND_IDS,
  CHECKED_EXAMPLE_NAVIGATION_COMMAND,
  FACADE_COMMAND_IDS,
  LIVE_WORKSPACE_NAVIGATION_COMMAND,
  PCCX_LAB_BACKEND_STATUS_COMMAND,
  SHOW_CONTEXT_BUNDLE_AUDIT_COMMAND,
  SHOW_DIAGNOSTICS_HANDOFF_SUMMARY_COMMAND,
  SHOW_KV260_STATUS_PANEL_COMMAND,
  SHOW_LOCAL_WORKFLOW_STATUS_COMMAND,
  SHOW_PATCH_PROPOSAL_PREVIEW_COMMAND,
  SHOW_RECENT_VALIDATION_RESULTS_COMMAND,
  SHOW_VALIDATION_CACHE_STATUS_COMMAND,
  VALIDATION_PROPOSAL_COMMAND,
  activate,
  buildFacadeArgsForCommand,
  buildFacadeInvocationForCommand,
  createNavigationLocationRecords,
  createPresenterDeps,
  createCommandHandler,
  deactivate,
  readKv260PreflightTranscriptSummary,
  readExtensionConfig,
  resolveCommandRequest,
} from "../src/extension.mjs";
import {
  CHECKED_EXAMPLE_DEFINITION_PROVIDER_ID,
  CHECKED_EXAMPLE_DEFINITION_SELECTOR,
  checkedExampleDefinitionProvider,
} from "../src/definition-provider.mjs";

const EXPECTED_ARGS = new Map([
  [
    "pccxSystemVerilog.publishCheckedExampleDiagnostics",
    ["diagnostics", "--mode", "example", "--source", "check-missing-endmodule"],
  ],
  [
    "pccxSystemVerilog.showDiagnosticsExample",
    ["diagnostics", "--mode", "example", "--source", "check-missing-endmodule"],
  ],
  [
    "pccxSystemVerilog.showCheckedExampleNavigation",
    ["navigation", "--mode", "example", "--source", "declarations"],
  ],
  [
    "pccxSystemVerilog.publishLiveWorkspaceDiagnostics",
    ["diagnostics", "--mode", "live", "--from-check", "fixtures/missing_endmodule.sv"],
  ],
  [
    "pccxSystemVerilog.showLiveWorkspaceNavigation",
    ["navigation", "--mode", "live", "--locate", "fixtures/modules", "simple_mod", "--kind", "module"],
  ],
  [
    "pccxSystemVerilog.showNavigationExample",
    ["navigation", "--mode", "example", "--source", "declarations"],
  ],
  [
    "pccxSystemVerilog.runDiagnosticsLive",
    ["diagnostics", "--mode", "live", "--from-check", "fixtures/missing_endmodule.sv"],
  ],
  [
    "pccxSystemVerilog.runNavigationLive",
    ["navigation", "--mode", "live", "--locate", "fixtures/modules", "simple_mod", "--kind", "module"],
  ],
]);

function configFor(commandId) {
  if (commandId === "pccxSystemVerilog.publishLiveWorkspaceDiagnostics" ||
      commandId === "pccxSystemVerilog.runDiagnosticsLive") {
    return {
      mode: "liveWorkspace",
      liveWorkspace: { enabled: true },
      defaultSource: "fixtures/missing_endmodule.sv",
    };
  }
  if (commandId === "pccxSystemVerilog.showLiveWorkspaceNavigation" ||
      commandId === "pccxSystemVerilog.runNavigationLive") {
    return {
      mode: "liveWorkspace",
      liveWorkspace: { enabled: true },
      defaultModule: "simple_mod",
      defaultDeclarationKind: "module",
    };
  }
  return {};
}

function testKnownFacadeArgs() {
  for (const commandId of FACADE_COMMAND_IDS) {
    assert.deepEqual(
      buildFacadeArgsForCommand(commandId, configFor(commandId)),
      EXPECTED_ARGS.get(commandId),
    );
  }
}

function testUnknownCommandsRejected() {
  assert.throws(
    () => buildFacadeArgsForCommand("pccxSystemVerilog.runArbitraryCommand"),
    /unknown PCCX SystemVerilog command/,
  );
}

function testCheckedExampleDiagnosticsCommandStaysExampleMode() {
  assert.deepEqual(
    buildFacadeArgsForCommand(
      "pccxSystemVerilog.publishCheckedExampleDiagnostics",
      {
        mode: "liveWorkspace",
        liveWorkspace: { enabled: true },
        defaultSource: "configured.sv",
        pythonPath: "python-custom",
      },
    ),
    ["diagnostics", "--mode", "example", "--source", "check-missing-endmodule"],
  );
}

function testCheckedExampleNavigationCommandStaysExampleMode() {
  assert.deepEqual(
    buildFacadeArgsForCommand(
      "pccxSystemVerilog.showCheckedExampleNavigation",
      {
        mode: "liveWorkspace",
        liveWorkspace: { enabled: true },
        defaultModule: "pkg_defs",
        pythonPath: "python-custom",
      },
    ),
    ["navigation", "--mode", "example", "--source", "declarations"],
  );
}

function testFacadeInvocationIsArgumentArray() {
  const invocation = buildFacadeInvocationForCommand(
    "pccxSystemVerilog.runDiagnosticsLive",
    {
      mode: "liveWorkspace",
      liveWorkspace: { enabled: true },
      defaultSource: "fixtures/missing_endmodule.sv",
      pythonPath: "python3",
    },
    { nodeExecutable: "node", facadePath: "editors/vscode-prototype/bin/pccx-vscode-prototype.mjs" },
  );

  assert.equal(invocation.executable, "node");
  assert.equal(invocation.shell, false);
  assert.deepEqual(invocation.env, { PCCX_IDE_PYTHON: "python3" });
  assert.ok(Array.isArray(invocation.args));
  assert.deepEqual(invocation.args.slice(1), EXPECTED_ARGS.get("pccxSystemVerilog.runDiagnosticsLive"));
  assert.doesNotMatch(invocation.args.join("\n"), /(?:&&|\|\||;|`|\$\()/);
}

function testPresenterDepsResolveRelativeDiagnosticFiles() {
  const created = [];
  const deps = createPresenterDeps(
    {
      Uri: {
        file(file) {
          created.push(file);
          return { fsPath: file };
        },
      },
    },
    { diagnosticFileRoot: "/repo/root" },
  );

  assert.deepEqual(deps.createUri("fixtures/missing_endmodule.sv"), {
    fsPath: "/repo/root/fixtures/missing_endmodule.sv",
  });
  assert.deepEqual(deps.createUri("/tmp/file.sv"), { fsPath: "/tmp/file.sv" });
  assert.deepEqual(created, [
    "/repo/root/fixtures/missing_endmodule.sv",
    "/tmp/file.sv",
  ]);
}

function testNavigationLocationMapping() {
  const records = createNavigationLocationRecords(
    [
      {
        name: "pkg_defs",
        kind: "package",
        file: "fixtures/modules/package_defs.sv",
        line: 1,
        column: 1,
        zero_based_line: 0,
        zero_based_column: 0,
      },
    ],
    {
      fileRoot: "/repo/root",
      createUri(file) {
        return { fsPath: file };
      },
      createRange(startLine, startCharacter, endLine, endCharacter) {
        return {
          start: { line: startLine, character: startCharacter },
          end: { line: endLine, character: endCharacter },
        };
      },
      createLocation(uri, range) {
        return { uri, range };
      },
    },
  );

  assert.equal(records.length, 1);
  assert.equal(records[0].uri.fsPath, "/repo/root/fixtures/modules/package_defs.sv");
  assert.equal(records[0].range.start.line, 0);
  assert.equal(records[0].range.start.character, 0);
  assert.equal(records[0].range.end.character, 1);
  assert.equal(records[0].targetKind, "package");
  assert.equal(records[0].symbol, "pkg_defs");
  assert.equal(records[0].source, "pccx-vscode-prototype");
}

function testResolveCommandRequestUsesVsCodeSettings() {
  const settings = new Map([
    ["mode", "liveWorkspace"],
    ["liveWorkspace.enabled", true],
    ["pccxLab.command", "pccx_ide_cli"],
    ["workflowBoundary.enabled", false],
    ["workflowBoundary.backend", "none"],
    ["validationRunner.enabled", false],
    ["validationRunner.mode", "disabled"],
    ["validationRunner.defaultWorkingDirectory", "repo-root"],
    ["validationRunner.maxOutputLines", 120],
    ["validationRunner.timeoutMs", 30000],
    ["pythonPath", "python-custom"],
    ["defaultSource", "configured.sv"],
    ["defaultLog", "configured.log"],
    ["defaultNavigationRoot", "configured/modules"],
    ["defaultModule", "pkg_defs"],
    ["defaultDeclarationKind", "package"],
  ]);
  const vscodeApi = {
    workspace: {
      getConfiguration(section) {
        assert.equal(section, "pccxSystemVerilog");
        return {
          get(key) {
            return settings.get(key);
          },
        };
      },
    },
  };

  assert.deepEqual(readExtensionConfig(vscodeApi), {
    mode: "liveWorkspace",
    liveWorkspace: {
      enabled: true,
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
    pythonPath: "python-custom",
    defaultSource: "configured.sv",
    defaultLog: "configured.log",
    defaultNavigationRoot: "configured/modules",
    defaultModule: "pkg_defs",
    defaultDeclarationKind: "package",
    kv260: {
      preflightTranscriptPath: "~/.codex/private-state/board-preflight/preflight-tty-2026-05-06.md",
    },
  });
  assert.deepEqual(
    resolveCommandRequest("pccxSystemVerilog.runDiagnosticsLive", undefined, vscodeApi),
    {
      mode: "liveWorkspace",
      liveWorkspace: {
        enabled: true,
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
      pythonPath: "python-custom",
      defaultSource: "configured.sv",
      defaultLog: "configured.log",
      defaultNavigationRoot: "configured/modules",
      defaultModule: "pkg_defs",
      defaultDeclarationKind: "package",
      kv260: {
        preflightTranscriptPath: "~/.codex/private-state/board-preflight/preflight-tty-2026-05-06.md",
      },
    },
  );
  assert.deepEqual(
    resolveCommandRequest("pccxSystemVerilog.runNavigationLive", undefined, vscodeApi),
    {
      mode: "liveWorkspace",
      liveWorkspace: {
        enabled: true,
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
      pythonPath: "python-custom",
      defaultSource: "configured.sv",
      defaultLog: "configured.log",
      defaultNavigationRoot: "configured/modules",
      defaultModule: "pkg_defs",
      defaultDeclarationKind: "package",
      kv260: {
        preflightTranscriptPath: "~/.codex/private-state/board-preflight/preflight-tty-2026-05-06.md",
      },
    },
  );
  assert.deepEqual(
    resolveCommandRequest("pccxSystemVerilog.runDiagnosticsLive", { fsPath: "explicit.sv" }, vscodeApi),
    {
      mode: "liveWorkspace",
      liveWorkspace: {
        enabled: true,
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
      pythonPath: "python-custom",
      defaultSource: "explicit.sv",
      defaultLog: "configured.log",
      defaultNavigationRoot: "configured/modules",
      defaultModule: "pkg_defs",
      defaultDeclarationKind: "package",
      kv260: {
        preflightTranscriptPath: "~/.codex/private-state/board-preflight/preflight-tty-2026-05-06.md",
      },
    },
  );
}

async function testEntrypointExportsAndActivation() {
  assert.equal(typeof activate, "function");
  assert.equal(typeof deactivate, "function");

  const registered = new Map();
  const subscriptions = [];
  const outputLines = [];
  const vscodeApi = {
    commands: {
      registerCommand(commandId, handler) {
        registered.set(commandId, handler);
        return { dispose() {} };
      },
    },
    window: {
      createOutputChannel() {
        return {
          appendLine(line) {
            outputLines.push(line);
          },
          show() {},
          dispose() {},
        };
      },
      showInformationMessage() {},
      showErrorMessage() {},
    },
  };

  const activation = await activate(
    { subscriptions },
    vscodeApi,
    {
      async runFacade() {
        return {
          ok: true,
          json: { kind: "vscode-diagnostics", diagnostics: [] },
        };
      },
    },
  );

  assert.deepEqual(activation.registered, COMMAND_IDS);
  assert.equal(activation.definitionProviders.length, 1);
  assert.equal(activation.definitionProviders[0].id, CHECKED_EXAMPLE_DEFINITION_PROVIDER_ID);
  assert.equal(activation.definitionProviders[0].registered, false);
  assert.equal(registered.size, COMMAND_IDS.length);
  assert.equal(subscriptions.length, COMMAND_IDS.length + 2);

  const result = await registered.get("pccxSystemVerilog.showDiagnosticsExample")();
  assert.equal(result.ok, true);
  assert.ok(outputLines.some((line) => line.includes("pccxSystemVerilog.showDiagnosticsExample")));
}

async function testCheckedExampleNavigationCommandReturnsLocations() {
  const registered = new Map();
  const quickPickCalls = [];
  const vscodeApi = {
    Uri: {
      file(file) {
        return { fsPath: file };
      },
    },
    Range: class Range {
      constructor(startLine, startCharacter, endLine, endCharacter) {
        this.start = { line: startLine, character: startCharacter };
        this.end = { line: endLine, character: endCharacter };
      }
    },
    Location: class Location {
      constructor(uri, range) {
        this.uri = uri;
        this.range = range;
      }
    },
    commands: {
      registerCommand(commandId, handler) {
        registered.set(commandId, handler);
        return { dispose() {} };
      },
    },
    window: {
      createOutputChannel() {
        return { appendLine() {}, show() {}, dispose() {} };
      },
      showInformationMessage() {},
      showErrorMessage() {},
      showQuickPick(...args) {
        quickPickCalls.push(args);
      },
    },
  };

  await activate(
    { subscriptions: [] },
    vscodeApi,
    {
      async runFacade(args) {
        assert.deepEqual(args, ["navigation", "--mode", "example", "--source", "declarations"]);
        return {
          ok: true,
          json: {
            kind: "vscode-navigation",
            items: [
              {
                name: "simple_mod",
                kind: "module",
                file: "fixtures/modules/simple_module.sv",
                line: 1,
                column: 1,
                zero_based_line: 0,
                zero_based_column: 0,
              },
            ],
          },
        };
      },
    },
  );

  const result = await registered.get("pccxSystemVerilog.showCheckedExampleNavigation")();
  assert.equal(result.ok, true);
  assert.equal(result.commandId, "pccxSystemVerilog.showCheckedExampleNavigation");
  assert.equal(result.action.kind, "navigation");
  assert.equal(result.locations.length, 1);
  assert.match(result.locations[0].uri.fsPath, /fixtures\/modules\/simple_module\.sv$/);
  assert.equal(result.locations[0].range.start.line, 0);
  assert.equal(result.locations[0].targetKind, "module");
  assert.equal(result.locations[0].symbol, "simple_mod");
  assert.equal(result.locations[0].source, "pccx-vscode-prototype");
  assert.deepEqual(result.locations[0].location.uri, result.locations[0].uri);
  assert.equal(quickPickCalls.length, 0);
}

async function testLiveWorkspaceNavigationCommandReturnsLocationsWithoutQuickPick() {
  const registered = new Map();
  const quickPickCalls = [];
  const settings = new Map([
    ["mode", "liveWorkspace"],
    ["liveWorkspace.enabled", true],
    ["pccxLab.command", "pccx_ide_cli"],
    ["workflowBoundary.enabled", false],
    ["workflowBoundary.backend", "none"],
    ["validationRunner.enabled", false],
    ["validationRunner.mode", "disabled"],
    ["validationRunner.defaultWorkingDirectory", "repo-root"],
    ["validationRunner.maxOutputLines", 120],
    ["validationRunner.timeoutMs", 30000],
    ["pythonPath", "python3"],
    ["defaultSource", "ignored.sv"],
    ["defaultLog", "ignored.log"],
    ["defaultNavigationRoot", "/repo/live-fixture"],
    ["defaultModule", "live_top"],
    ["defaultDeclarationKind", "module"],
  ]);
  const vscodeApi = {
    Uri: {
      file(file) {
        return { fsPath: file };
      },
    },
    Range: class Range {
      constructor(startLine, startCharacter, endLine, endCharacter) {
        this.start = { line: startLine, character: startCharacter };
        this.end = { line: endLine, character: endCharacter };
      }
    },
    Location: class Location {
      constructor(uri, range) {
        this.uri = uri;
        this.range = range;
      }
    },
    commands: {
      registerCommand(commandId, handler) {
        registered.set(commandId, handler);
        return { dispose() {} };
      },
    },
    workspace: {
      getConfiguration(section) {
        assert.equal(section, "pccxSystemVerilog");
        return {
          get(key) {
            return settings.get(key);
          },
        };
      },
    },
    window: {
      createOutputChannel() {
        return { appendLine() {}, show() {}, dispose() {} };
      },
      showInformationMessage() {},
      showErrorMessage() {},
      showQuickPick(...args) {
        quickPickCalls.push(args);
        throw new Error("live navigation smoke must not dialog QuickPick");
      },
    },
  };
  const facadeCalls = [];

  await activate(
    { subscriptions: [] },
    vscodeApi,
    {
      async runFacade(args, env) {
        facadeCalls.push({ args, env });
        return {
          ok: true,
          json: {
            kind: "vscode-navigation",
            items: [
              {
                name: "live_top",
                kind: "module",
                file: "/repo/live-fixture/top.sv",
                line: 1,
                column: 8,
                zero_based_line: 0,
                zero_based_column: 7,
              },
            ],
          },
        };
      },
    },
  );

  const result = await registered.get(LIVE_WORKSPACE_NAVIGATION_COMMAND)();

  assert.equal(result.ok, true);
  assert.equal(result.commandId, LIVE_WORKSPACE_NAVIGATION_COMMAND);
  assert.deepEqual(facadeCalls[0].args, [
    "navigation",
    "--mode",
    "live",
    "--locate",
    "/repo/live-fixture",
    "live_top",
    "--kind",
    "module",
  ]);
  assert.deepEqual(facadeCalls[0].env, { PCCX_IDE_PYTHON: "python3" });
  assert.equal(result.locations.length, 1);
  assert.equal(result.locations[0].symbol, "live_top");
  assert.equal(result.locations[0].targetKind, "module");
  assert.equal(result.locations[0].uri.fsPath, "/repo/live-fixture/top.sv");
  assert.equal(result.locations[0].range.start.character, 7);
  assert.equal(quickPickCalls.length, 0);
}

async function testCheckedExampleDefinitionProviderReturnsLocations() {
  const location = { uri: { fsPath: "/repo/root/pkg.sv" }, range: { start: { line: 0 } } };
  const provider = checkedExampleDefinitionProvider({
    async runCheckedExampleNavigationLocations() {
      return {
        ok: true,
        locations: [
          { location },
          { uri: { fsPath: "/repo/root/simple.sv" }, range: { start: { line: 1 } } },
        ],
      };
    },
  });

  const definitions = await provider.provideDefinition({}, {}, {});

  assert.equal(definitions.length, 2);
  assert.equal(definitions[0], location);
  assert.deepEqual(definitions[1], {
    uri: { fsPath: "/repo/root/simple.sv" },
    range: { start: { line: 1 } },
  });
}

async function testActivationRegistersCheckedExampleDefinitionProvider() {
  const registered = new Map();
  const subscriptions = [];
  const definitionRegistrations = [];
  const facadeCalls = [];
  const vscodeApi = {
    Uri: {
      file(file) {
        return { fsPath: file };
      },
    },
    Range: class Range {
      constructor(startLine, startCharacter, endLine, endCharacter) {
        this.start = { line: startLine, character: startCharacter };
        this.end = { line: endLine, character: endCharacter };
      }
    },
    Location: class Location {
      constructor(uri, range) {
        this.uri = uri;
        this.range = range;
      }
    },
    commands: {
      registerCommand(commandId, handler) {
        registered.set(commandId, handler);
        return { dispose() {} };
      },
    },
    languages: {
      registerDefinitionProvider(selector, provider) {
        definitionRegistrations.push({ selector, provider });
        return { dispose() {} };
      },
    },
    window: {
      createOutputChannel() {
        return { appendLine() {}, show() {}, dispose() {} };
      },
      showInformationMessage() {},
      showErrorMessage() {},
    },
  };

  const activation = await activate(
    { subscriptions },
    vscodeApi,
    {
      async runFacade(args, env, plan) {
        facadeCalls.push({ args, env, plan });
        return {
          ok: true,
          json: {
            kind: "vscode-navigation",
            items: [
              {
                name: "pkg_defs",
                kind: "package",
                file: "fixtures/modules/package_defs.sv",
                line: 1,
                column: 1,
                zero_based_line: 0,
                zero_based_column: 0,
              },
            ],
          },
        };
      },
    },
  );

  assert.deepEqual(activation.registered, COMMAND_IDS);
  assert.deepEqual(activation.definitionProviders, [
    {
      id: CHECKED_EXAMPLE_DEFINITION_PROVIDER_ID,
      selector: CHECKED_EXAMPLE_DEFINITION_SELECTOR,
      registered: true,
    },
  ]);
  assert.equal(definitionRegistrations.length, 1);
  assert.equal(definitionRegistrations[0].selector, CHECKED_EXAMPLE_DEFINITION_SELECTOR);
  assert.ok(
    CHECKED_EXAMPLE_DEFINITION_SELECTOR.some((selector) => selector.language === "systemverilog"),
  );
  assert.ok(
    CHECKED_EXAMPLE_DEFINITION_SELECTOR.some((selector) => selector.pattern === "**/*.sv"),
  );
  assert.equal(subscriptions.length, COMMAND_IDS.length + 3);

  const definitions = await definitionRegistrations[0].provider.provideDefinition(
    { uri: { fsPath: "/workspace/smoke.sv" } },
    { line: 0, character: 7 },
    {},
  );

  assert.equal(facadeCalls.length, 1);
  assert.equal(facadeCalls[0].plan.commandId, CHECKED_EXAMPLE_NAVIGATION_COMMAND);
  assert.deepEqual(facadeCalls[0].args, [
    "navigation",
    "--mode",
    "example",
    "--source",
    "declarations",
  ]);
  assert.deepEqual(facadeCalls[0].env, {});
  assert.equal(definitions.length, 1);
  assert.match(definitions[0].uri.fsPath, /fixtures\/modules\/package_defs\.sv$/);
  assert.equal(definitions[0].range.start.line, 0);
  assert.equal(definitions[0].range.start.character, 0);
  assert.equal(definitions[0].range.end.character, 1);
}

async function testNoVsCodeRuntimeIsANoop() {
  const activation = await activate({ subscriptions: [] }, { commands: null });
  assert.deepEqual(activation.registered, []);
}

async function testCommandHandlerCanBeUsedWithoutRealVsCode() {
  const handler = createCommandHandler(
    "pccxSystemVerilog.showNavigationExample",
    null,
    {
      async runFacade() {
        return {
          ok: true,
          json: { kind: "vscode-navigation", items: [] },
        };
      },
    },
  );

  const result = await handler();
  assert.equal(result.ok, true);
}

async function testWorkflowStatusCommandReturnsDisabledBackendNone() {
  const handler = createCommandHandler(WORKFLOW_BOUNDARY_STATUS_COMMAND, null, {});

  const result = await handler();

  assert.equal(result.ok, true);
  assert.equal(result.commandId, WORKFLOW_BOUNDARY_STATUS_COMMAND);
  assert.equal(result.status.status, "disabled");
  assert.equal(result.status.backend, "none");
  assert.equal(result.status.providerCalls, false);
  assert.equal(result.status.runtimeCalls, false);
  assert.equal(result.status.providerCallsImplemented, false);
  assert.equal(result.status.runtimeCallsImplemented, false);
  assert.equal(result.status.mcpServerImplemented, false);
  assert.deepEqual(
    result.status.allowedActions.map((action) => action.kind),
    [
      "explainDiagnostics",
      "proposePatch",
      "proposeValidationCommand",
      "summarizeLog",
      "askForMoreContext",
      "openRelatedSymbol",
    ],
  );
  assert.ok(result.status.allowedActions.every((action) => action.execution === "proposalOnly"));
  assert.ok(result.status.disallowedActions.includes("writeFile"));
  assert.ok(result.status.disallowedActions.includes("release"));
  assert.ok(result.status.disallowedActions.includes("accessSecrets"));
}

async function testWorkflowContextBundleCommandUsesActiveEditorSelectionAndDiagnostics() {
  const document = {
    uri: { fsPath: "/repo/rtl/top.sv" },
    languageId: "systemverilog",
    lineCount: 2,
    lineAt(line) {
      return {
        text: [
          "module top;",
          "endmodule",
        ][line],
      };
    },
    getText(range) {
      assert.equal(range.start.line, 0);
      return "top";
    },
  };
  const selection = {
    start: { line: 0, character: 7 },
    end: { line: 0, character: 10 },
  };
  const vscodeApi = {
    DiagnosticSeverity: {
      Error: 0,
      Warning: 1,
      Information: 2,
      Hint: 3,
    },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: "/repo" } }],
      getWorkspaceFolder() {
        return { uri: { fsPath: "/repo" } };
      },
    },
    window: {
      activeTextEditor: {
        document,
        selection,
      },
    },
    languages: {
      getDiagnostics(uri) {
        assert.equal(uri.fsPath, "/repo/rtl/top.sv");
        return [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 6 },
            },
            severity: 0,
            message: "missing endmodule",
            source: "pccx_ide_cli",
            code: "PCCX-SCAFFOLD-003",
          },
        ];
      },
    },
  };
  const runtime = {
    recentNavigationItems: [
      {
        name: "top",
        kind: "module",
        file: "/repo/rtl/top.sv",
        line: 1,
        column: 1,
      },
    ],
    recentCommandStatus: {
      commandId: "pccxSystemVerilog.publishCheckedExampleDiagnostics",
      ok: true,
      actionKind: "diagnostics",
      summary: "1 diagnostic(s)",
      facade: { command: "diagnostics", mode: "example" },
      diagnosticCount: 1,
      navigationItemCount: 0,
    },
  };
  const handler = createCommandHandler(WORKFLOW_CONTEXT_BUNDLE_COMMAND, vscodeApi, runtime);

  const result = await handler();

  assert.equal(result.ok, true);
  assert.equal(result.commandId, WORKFLOW_CONTEXT_BUNDLE_COMMAND);
  assert.equal(result.kind, "workflow-context-bundle");
  assert.equal(result.status, "disabled");
  assert.equal(result.backend, "none");
  assert.equal(result.providerCalls, false);
  assert.equal(result.runtimeCalls, false);
  assert.deepEqual(result.contextBundle.selectedFile, { path: "rtl/top.sv" });
  assert.equal(result.contextBundle.selectedRange.start.line, 0);
  assert.equal(result.contextBundle.configuration.mode, "checkedExample");
  assert.equal(result.contextBundle.configuration.workflowBoundary.enabled, false);
  assert.equal(result.contextBundle.configuration.validationRunner.enabled, false);
  assert.equal(result.contextBundle.configuration.validationRunner.mode, "disabled");
  assert.equal(result.contextBundle.diagnostics.length, 1);
  assert.equal(result.contextBundle.diagnostics[0].path, "rtl/top.sv");
  assert.equal(result.contextBundle.snippets.length, 1);
  assert.equal(result.contextBundle.snippets[0].path, "rtl/top.sv");
  assert.equal(result.contextBundle.symbols.selected.name, "top");
  assert.equal(result.contextBundle.symbols.selected.kind, "module");
  assert.equal(result.contextBundle.symbols.selected.path, "rtl/top.sv");
  assert.equal(result.contextBundle.symbols.selectedContext.symbolText, "top");
  assert.equal(result.contextBundle.symbols.selectedContext.lexicalKind, "module");
  assert.equal(result.contextBundle.symbols.selectedContext.currentLine.text, "module top;");
  assert.equal(result.contextBundle.symbols.declarations.length, 1);
  assert.equal(result.contextBundle.symbols.declarations[0].path, "rtl/top.sv");
  assert.equal(result.contextBundle.recentCommand.commandId, "pccxSystemVerilog.publishCheckedExampleDiagnostics");
  assert.equal(result.contextBundle.diagnosticsHandoff.status, "available");
  assert.equal(result.contextBundle.diagnosticsHandoff.summaryAvailable, true);
  assert.equal(result.contextBundle.diagnosticsHandoff.source.adapterOutput, true);
  assert.equal(result.contextBundle.diagnosticsHandoff.source.rawHandoffParsedByUi, false);
  assert.equal(result.contextBundle.diagnosticsHandoff.diagnostics.count, 5);
  assert.equal(result.contextBundle.diagnosticsHandoff.safety.readOnly, true);
  assert.equal(result.contextBundle.diagnosticsHandoff.safety.launcherExecution, false);
  assert.equal(result.contextBundle.diagnosticsHandoff.safety.pccxLabExecution, false);
  assert.equal(result.contextBundle.diagnosticsHandoff.safety.pccxLabValidatorInvocation, false);
  assert.equal(result.contextBundle.diagnosticsHandoff.safety.shellExecution, false);
  assert.equal(result.contextBundle.diagnosticsHandoff.safety.providerCalls, false);
  assert.equal(result.contextBundle.diagnosticsHandoff.safety.runtimeCalls, false);
  assert.equal(result.contextSummary.diagnosticsHandoff.status, "available");
  assert.equal(result.contextSummary.diagnosticsHandoff.diagnosticCount, 5);
  assert.doesNotMatch(JSON.stringify(result.contextBundle), /\/repo/);
}

async function testValidationProposalCommandReturnsDataOnly() {
  const handler = createCommandHandler(VALIDATION_PROPOSAL_COMMAND, null, {});

  const result = await handler({ command: "git push origin main" });

  assert.equal(result.ok, true);
  assert.equal(result.commandId, VALIDATION_PROPOSAL_COMMAND);
  assert.equal(result.kind, "validation-command-proposal");
  assert.equal(result.execution, "proposalOnly");
  assert.equal(result.executes, false);
  assert.equal(result.providerCalls, false);
  assert.equal(result.runtimeCalls, false);
  assert.equal(result.diagnosticsHandoffContext.status, "available");
  assert.equal(result.diagnosticsHandoffContext.summaryAvailable, true);
  assert.equal(result.diagnosticsHandoffContext.diagnostics.count, 5);
  assert.equal(result.diagnosticsHandoffContext.safety.launcherExecution, false);
  assert.equal(result.diagnosticsHandoffContext.safety.pccxLabExecution, false);
  assert.equal(result.diagnosticsHandoffContext.safety.pccxLabValidatorInvocation, false);
  assert.equal(result.diagnosticsHandoffContext.safety.shellExecution, false);
  assert.ok(result.proposals.some((proposal) => (
    proposal.command?.argv?.join(" ") === "bash scripts/vscode-adapter-smoke.sh"
  )));
  assert.ok(result.proposals.every((proposal) => (
    proposal.preflight.diagnosticsHandoff.status === "available"
  )));
  assert.doesNotMatch(JSON.stringify(result), /git push/);
}

async function testValidationPreflightAuditCommandReturnsAuditOnly() {
  const outputLines = [];
  const informationMessages = [];
  const warningMessages = [];
  const handler = createCommandHandler(
    AUDIT_VALIDATION_PREFLIGHT_COMMAND,
    {
      window: {
        showInformationMessage(...args) {
          informationMessages.push(args);
        },
        showWarningMessage(...args) {
          warningMessages.push(args);
        },
      },
    },
    {
      outputChannel: {
        appendLine(line) {
          outputLines.push(line);
        },
        show() {},
      },
    },
  );

  const result = await handler({ proposalId: "vscodeAdapterSmoke" });
  const blocked = await handler({
    proposalId: "vscodeAdapterSmoke",
    command: "bash scripts/vscode-adapter-smoke.sh; rm -rf /",
  });

  assert.equal(result.ok, true);
  assert.equal(result.commandId, AUDIT_VALIDATION_PREFLIGHT_COMMAND);
  assert.equal(result.kind, "validation-proposal-preflight-audit");
  assert.equal(result.status, "passed");
  assert.equal(result.eligibleForApprovedRunner, true);
  assert.equal(result.executes, false);
  assert.equal(result.safety.automaticExecution, false);
  assert.equal(result.safety.allowlistBroadened, false);
  assert.equal(result.diagnosticsHandoff.status, "available");
  assert.equal(result.diagnosticsHandoff.contextOnly, true);
  assert.equal(blocked.ok, true);
  assert.equal(blocked.status, "failed");
  assert.equal(blocked.eligibleForApprovedRunner, false);
  assert.equal(blocked.findings.rawShellString, true);
  assert.ok(outputLines.some((line) => line.includes("Validation Proposal Preflight Audit")));
  assert.ok(informationMessages.some(([message]) => /Validation preflight audit: vscodeAdapterSmoke passed/.test(message)));
  assert.ok(warningMessages.some(([message]) => /Validation preflight audit: vscodeAdapterSmoke failed/.test(message)));
  assert.doesNotMatch(JSON.stringify(blocked), /rm -rf/);
}

async function testApprovedValidationRunnerBlocksByDefaultAndUpdatesContext() {
  const settings = new Map([
    ["mode", "checkedExample"],
    ["liveWorkspace.enabled", false],
    ["pccxLab.command", "pccx_ide_cli"],
    ["workflowBoundary.enabled", false],
    ["workflowBoundary.backend", "none"],
    ["validationRunner.enabled", false],
    ["validationRunner.mode", "disabled"],
    ["validationRunner.defaultWorkingDirectory", "repo-root"],
    ["validationRunner.maxOutputLines", 2],
    ["validationRunner.timeoutMs", 30000],
    ["pythonPath", "python3"],
    ["defaultSource", "fixtures/missing_endmodule.sv"],
    ["defaultLog", "fixtures/xsim/mixed.log"],
    ["defaultNavigationRoot", "fixtures/modules"],
    ["defaultModule", "simple_mod"],
    ["defaultDeclarationKind", "module"],
  ]);
  const runtime = {};
  const vscodeApi = {
    workspace: {
      workspaceFolders: [{ uri: { fsPath: "/repo" } }],
      getConfiguration() {
        return {
          get(key) {
            return settings.get(key);
          },
        };
      },
    },
  };
  const handler = createCommandHandler(APPROVED_VALIDATION_RUNNER_COMMAND, vscodeApi, runtime);

  const result = await handler("vscodeAdapterSmoke");

  assert.equal(result.ok, false);
  assert.equal(result.commandId, APPROVED_VALIDATION_RUNNER_COMMAND);
  assert.equal(result.kind, "approved-validation-result");
  assert.equal(result.proposalId, "vscodeAdapterSmoke");
  assert.equal(result.status, "blocked");
  assert.match(result.blockedReason, /runner is disabled/);
  assert.equal(result.safety.allowlisted, true);
  assert.equal(result.safety.shell, false);
  assert.equal(runtime.recentValidationSummary.proposalId, "vscodeAdapterSmoke");
  assert.equal(runtime.recentValidationSummary.status, "blocked");
  assert.equal(runtime.recentValidationSummary.commandKind, "allowlisted-validation-proposal");
  assert.equal(runtime.validationResultCache.size(), 1);
  assert.equal(runtime.validationResultCache.latest().proposalId, "vscodeAdapterSmoke");
}

async function testApprovedValidationRunnerRequiresProposalIdWhenEnabled() {
  const settings = new Map([
    ["mode", "checkedExample"],
    ["liveWorkspace.enabled", false],
    ["pccxLab.command", "pccx_ide_cli"],
    ["workflowBoundary.enabled", false],
    ["workflowBoundary.backend", "none"],
    ["validationRunner.enabled", true],
    ["validationRunner.mode", "allowlisted"],
    ["validationRunner.defaultWorkingDirectory", "repo-root"],
    ["validationRunner.maxOutputLines", 2],
    ["validationRunner.timeoutMs", 30000],
    ["pythonPath", "python3"],
    ["defaultSource", "fixtures/missing_endmodule.sv"],
    ["defaultLog", "fixtures/xsim/mixed.log"],
    ["defaultNavigationRoot", "fixtures/modules"],
    ["defaultModule", "simple_mod"],
    ["defaultDeclarationKind", "module"],
  ]);
  const calls = [];
  const handler = createCommandHandler(
    APPROVED_VALIDATION_RUNNER_COMMAND,
    {
      workspace: {
        workspaceFolders: [{ uri: { fsPath: "/repo/workspace" } }],
        getConfiguration() {
          return {
            get(key) {
              return settings.get(key);
            },
          };
        },
      },
    },
    {
      repoRoot: "/repo",
      validationExecFile(...args) {
        calls.push(args);
      },
    },
  );

  const result = await handler();

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.match(result.blockedReason, /proposal ID only/);
  assert.equal(calls.length, 0);
}

async function testApprovedValidationRunnerExecutesAllowlistedProposalWhenEnabled() {
  const settings = new Map([
    ["mode", "checkedExample"],
    ["liveWorkspace.enabled", false],
    ["pccxLab.command", "pccx_ide_cli"],
    ["workflowBoundary.enabled", false],
    ["workflowBoundary.backend", "none"],
    ["validationRunner.enabled", true],
    ["validationRunner.mode", "allowlisted"],
    ["validationRunner.defaultWorkingDirectory", "repo-root"],
    ["validationRunner.maxOutputLines", 2],
    ["validationRunner.timeoutMs", 30000],
    ["pythonPath", "python3"],
    ["defaultSource", "fixtures/missing_endmodule.sv"],
    ["defaultLog", "fixtures/xsim/mixed.log"],
    ["defaultNavigationRoot", "fixtures/modules"],
    ["defaultModule", "simple_mod"],
    ["defaultDeclarationKind", "module"],
  ]);
  const calls = [];
  const vscodeApi = {
    workspace: {
      workspaceFolders: [{ uri: { fsPath: "/repo/workspace" } }],
      getConfiguration() {
        return {
          get(key) {
            return settings.get(key);
          },
        };
      },
    },
  };
  const handler = createCommandHandler(APPROVED_VALIDATION_RUNNER_COMMAND, vscodeApi, {
    repoRoot: "/repo",
    validationExecFile(executable, args, options, done) {
      calls.push({ executable, args, options });
      done(null, "ok\n", "");
    },
  });

  const result = await handler({ proposalId: "vscodeAdapterSmoke" });

  assert.equal(result.ok, true);
  assert.equal(result.status, "passed");
  assert.equal(result.command, "bash");
  assert.deepEqual(result.args, ["scripts/vscode-adapter-smoke.sh"]);
  assert.equal(result.stdoutSummary.lines[0], "ok");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].executable, "bash");
  assert.deepEqual(calls[0].args, ["scripts/vscode-adapter-smoke.sh"]);
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].options.cwd, "/repo");
}

async function testValidationResultCacheCommandsShowAndClear() {
  const settings = new Map([
    ["mode", "checkedExample"],
    ["liveWorkspace.enabled", false],
    ["pccxLab.command", "pccx_ide_cli"],
    ["workflowBoundary.enabled", false],
    ["workflowBoundary.backend", "none"],
    ["validationRunner.enabled", true],
    ["validationRunner.mode", "allowlisted"],
    ["validationRunner.defaultWorkingDirectory", "repo-root"],
    ["validationRunner.maxOutputLines", 3],
    ["validationRunner.timeoutMs", 30000],
    ["pythonPath", "python3"],
    ["defaultSource", "fixtures/missing_endmodule.sv"],
    ["defaultLog", "fixtures/xsim/mixed.log"],
    ["defaultNavigationRoot", "fixtures/modules"],
    ["defaultModule", "simple_mod"],
    ["defaultDeclarationKind", "module"],
  ]);
  const quickPickCalls = [];
  const informationMessages = [];
  const validationOutputLines = [];
  const vscodeApi = {
    workspace: {
      workspaceFolders: [{ uri: { fsPath: "/repo/workspace" } }],
      getConfiguration() {
        return {
          get(key) {
            return settings.get(key);
          },
        };
      },
    },
    window: {
      showInformationMessage(...args) {
        informationMessages.push(args);
      },
      showQuickPick(items, options) {
        quickPickCalls.push({ items, options });
        return items[0];
      },
    },
  };
  const runtime = {
    repoRoot: "/repo",
    validationOutputChannel: {
      appendLine(line) {
        validationOutputLines.push(line);
      },
      show() {},
    },
    validationExecFile(_executable, _args, _options, done) {
      done(null, "ok\nTOKEN=hidden\n/home/dev/repo/file.sv\n", "");
    },
  };
  const runHandler = createCommandHandler(APPROVED_VALIDATION_RUNNER_COMMAND, vscodeApi, runtime);
  const showHandler = createCommandHandler(SHOW_RECENT_VALIDATION_RESULTS_COMMAND, vscodeApi, runtime);
  const statusHandler = createCommandHandler(SHOW_VALIDATION_CACHE_STATUS_COMMAND, vscodeApi, runtime);
  const clearHandler = createCommandHandler(CLEAR_VALIDATION_RESULT_CACHE_COMMAND, vscodeApi, runtime);

  await runHandler({ proposalId: "vscodeAdapterSmoke" });
  const shown = await showHandler();
  const status = await statusHandler();

  assert.equal(shown.ok, true);
  assert.equal(shown.kind, "validation-result-cache");
  assert.equal(shown.entries.length, 1);
  assert.equal(shown.entries[0].proposalId, "vscodeAdapterSmoke");
  assert.equal(shown.entries[0].commandKind, "allowlisted-validation-proposal");
  assert.equal(shown.entries[0].redactionApplied, true);
  assert.equal(shown.selected.proposalId, "vscodeAdapterSmoke");
  assert.equal(quickPickCalls.length, 1);
  assert.equal(quickPickCalls[0].options.title, "Recent Validation Results");
  assert.match(quickPickCalls[0].items[0].detail, /proposal vscodeAdapterSmoke/);
  assert.match(quickPickCalls[0].items[0].detail, /redacted/);
  assert.equal(status.ok, true);
  assert.equal(status.kind, "validation-result-cache-status");
  assert.equal(status.status.count, 1);
  assert.equal(status.status.maxSize, 5);
  assert.equal(status.status.latest.proposalId, "vscodeAdapterSmoke");
  assert.equal(status.status.latest.status, "passed");
  assert.equal(status.status.summaryOnly, true);
  assert.equal(status.status.fullLogsExcluded, true);
  assert.doesNotMatch(JSON.stringify(shown.entries), /TOKEN=hidden/);
  assert.doesNotMatch(JSON.stringify(shown.entries), /\/home\/dev/);
  assert.doesNotMatch(JSON.stringify(shown.entries), /scripts\/vscode-adapter-smoke\.sh/);
  assert.ok(validationOutputLines.some((line) => line.includes("Validation Result Summary")));
  assert.ok(validationOutputLines.some((line) => line.includes("proposalId: vscodeAdapterSmoke")));
  assert.ok(validationOutputLines.some((line) => line.includes("Validation Cache Status")));
  assert.ok(validationOutputLines.some((line) => line.includes("fullLogsExcluded: yes")));
  assert.doesNotMatch(validationOutputLines.join("\n"), /TOKEN=hidden/);
  assert.doesNotMatch(validationOutputLines.join("\n"), /\/home\/dev/);
  assert.doesNotMatch(validationOutputLines.join("\n"), /scripts\/vscode-adapter-smoke\.sh/);

  const cleared = await clearHandler();

  assert.equal(cleared.ok, true);
  assert.equal(cleared.kind, "validation-result-cache-clear");
  assert.equal(cleared.clearedCount, 1);
  assert.equal(runtime.validationResultCache.size(), 0);
  assert.equal(runtime.recentValidationSummary, null);
  assert.ok(informationMessages.some(([message]) => /Cleared 1 cached validation result/.test(message)));
}

async function testPatchProposalPreviewCommandsShowAndClearCheckedProposalOnly() {
  const informationMessages = [];
  const warningMessages = [];
  const outputLines = [];
  const runtime = {
    outputChannel: {
      appendLine(line) {
        outputLines.push(line);
      },
      show() {},
    },
  };
  const vscodeApi = {
    window: {
      showInformationMessage(...args) {
        informationMessages.push(args);
      },
      showWarningMessage(...args) {
        warningMessages.push(args);
      },
    },
  };
  const showHandler = createCommandHandler(SHOW_PATCH_PROPOSAL_PREVIEW_COMMAND, vscodeApi, runtime);
  const clearHandler = createCommandHandler(CLEAR_PATCH_PROPOSAL_PREVIEW_COMMAND, vscodeApi, runtime);

  const shown = await showHandler("missingEndmodulePreview");

  assert.equal(shown.ok, true);
  assert.equal(shown.kind, "patch-proposal-preview");
  assert.equal(shown.summary.proposalId, "missingEndmodulePreview");
  assert.equal(shown.proposalOnly, true);
  assert.equal(shown.appliesPatches, false);
  assert.equal(shown.writesFiles, false);
  assert.equal(shown.providerCalls, false);
  assert.equal(shown.runtimeCalls, false);
  assert.equal(runtime.recentPatchProposalPreview.summary.proposalId, "missingEndmodulePreview");
  assert.ok(outputLines.some((line) => line.includes("Patch Proposal Preview")));
  assert.ok(outputLines.some((line) => line.includes("appliesPatches: no")));
  assert.ok(informationMessages.some(([message]) => /Patch proposal preview/.test(message)));
  assert.doesNotMatch(JSON.stringify(shown), /\/home\/|TOKEN=|scripts\/private/);

  const rejected = await showHandler({ proposal: { proposalId: "unsafe" } });

  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /checked proposal IDs only/);
  assert.ok(warningMessages.some(([message]) => /checked proposal IDs only/.test(message)));

  const cleared = await clearHandler();

  assert.equal(cleared.ok, true);
  assert.equal(cleared.kind, "patch-proposal-preview-clear");
  assert.equal(cleared.cleared, true);
  assert.equal(runtime.recentPatchProposalPreview, null);
}

async function testLocalWorkflowStatusCommandReturnsFixtureOnlyBoundaryState() {
  const outputLines = [];
  const informationMessages = [];
  const runtime = {
    outputChannel: {
      appendLine(line) {
        outputLines.push(line);
      },
      show() {},
    },
  };
  const handler = createCommandHandler(
    SHOW_LOCAL_WORKFLOW_STATUS_COMMAND,
    {
      window: {
        showInformationMessage(...args) {
          informationMessages.push(args);
        },
      },
    },
    runtime,
  );

  const result = await handler();

  assert.equal(result.ok, true);
  assert.equal(result.commandId, SHOW_LOCAL_WORKFLOW_STATUS_COMMAND);
  assert.equal(result.kind, "local-workflow-status");
  assert.equal(result.status.extensionMode, "checkedExample");
  assert.equal(result.status.validationRunner.enabled, false);
  assert.equal(result.status.recentValidation.count, 0);
  assert.equal(result.status.pccxLabBoundary.state, "future");
  assert.equal(result.status.pccxLabBoundary.executes, false);
  assert.equal(result.status.launcherBoundary.state, "future");
  assert.equal(result.status.launcherBoundary.launcherCalls, false);
  assert.equal(result.status.safety.providerCalls, false);
  assert.equal(result.status.safety.pccxLabExecution, false);
  assert.ok(outputLines.some((line) => line.includes("Local Workflow Status")));
  assert.ok(informationMessages.some(([message]) => /Local workflow status/.test(message)));
}

async function testContextBundleAuditCommandReturnsBoundedAudit() {
  const outputLines = [];
  const informationMessages = [];
  const document = {
    uri: { fsPath: "/repo/rtl/top.sv" },
    languageId: "systemverilog",
    lineCount: 1,
    lineAt() {
      return { text: "module top;" };
    },
    getText() {
      return "top";
    },
  };
  const handler = createCommandHandler(
    SHOW_CONTEXT_BUNDLE_AUDIT_COMMAND,
    {
      workspace: {
        workspaceFolders: [{ uri: { fsPath: "/repo" } }],
        getWorkspaceFolder() {
          return { uri: { fsPath: "/repo" } };
        },
      },
      window: {
        activeTextEditor: {
          document,
          selection: {
            start: { line: 0, character: 7 },
            end: { line: 0, character: 10 },
          },
        },
        showInformationMessage(...args) {
          informationMessages.push(args);
        },
      },
      languages: {
        getDiagnostics() {
          return [{ message: "missing endmodule", range: { start: { line: 0 }, end: { line: 0 } } }];
        },
      },
    },
    {
      outputChannel: {
        appendLine(line) {
          outputLines.push(line);
        },
        show() {},
      },
    },
  );

  const result = await handler();

  assert.equal(result.ok, true);
  assert.equal(result.commandId, SHOW_CONTEXT_BUNDLE_AUDIT_COMMAND);
  assert.equal(result.kind, "context-bundle-audit");
  assert.ok(result.audit.approximateCharacterCount > 0);
  assert.equal(result.audit.diagnosticCount, 1);
  assert.equal(result.audit.snippetCount, 1);
  assert.equal(result.audit.safety.providerCalls, false);
  assert.equal(result.audit.safety.fullLogsExcluded, true);
  assert.ok(outputLines.some((line) => line.includes("Context Bundle Audit")));
  assert.ok(informationMessages.some(([message]) => /Context bundle audit/.test(message)));
  assert.doesNotMatch(JSON.stringify(result.audit), /\/repo/);
}

async function testDiagnosticsHandoffSummaryCommandReturnsDataOnlySurface() {
  const outputLines = [];
  const informationMessages = [];
  const facadeCalls = [];
  const handler = createCommandHandler(
    SHOW_DIAGNOSTICS_HANDOFF_SUMMARY_COMMAND,
    {
      window: {
        showInformationMessage(...args) {
          informationMessages.push(args);
        },
        showWarningMessage() {
          throw new Error("diagnostics handoff summary should not warn for the default surface");
        },
      },
    },
    {
      outputChannel: {
        appendLine(line) {
          outputLines.push(line);
        },
        show() {},
      },
      async runFacade(...args) {
        facadeCalls.push(args);
        throw new Error("diagnostics handoff summary must not call the facade");
      },
    },
  );

  const result = await handler();
  const renderedAgain = await handler();

  assert.equal(result.ok, true);
  assert.equal(result.commandId, SHOW_DIAGNOSTICS_HANDOFF_SUMMARY_COMMAND);
  assert.equal(result.kind, "diagnostics-handoff-status");
  assert.equal(result.surface.kind, "diagnostics-handoff-status-surface");
  assert.equal(result.surface.source.adapterOutput, true);
  assert.equal(result.surface.source.rawHandoffParsedByUi, false);
  assert.equal(result.surface.diagnostics.count, 5);
  assert.equal(result.surface.safety.dataOnly, true);
  assert.equal(result.surface.safety.readOnly, true);
  assert.equal(result.surface.safety.launcherExecution, false);
  assert.equal(result.surface.safety.pccxLabExecution, false);
  assert.equal(result.surface.safety.pccxLabValidatorInvocation, false);
  assert.equal(result.surface.safety.shellExecution, false);
  assert.equal(result.surface.safety.providerCalls, false);
  assert.equal(result.surface.safety.runtimeCalls, false);
  assert.equal(result.surface.safety.mcpCalls, false);
  assert.equal(result.surface.safety.lspImplemented, false);
  assert.equal(result.surface.safety.marketplaceFlow, false);
  assert.deepEqual(result.surface, renderedAgain.surface);
  assert.equal(facadeCalls.length, 0);
  assert.ok(outputLines.some((line) => line.includes("Diagnostics Handoff Summary")));
  assert.ok(outputLines.some((line) => line.includes("execution: no launcher, no pccx-lab")));
  assert.ok(informationMessages.some(([message]) => /Diagnostics handoff summary/.test(message)));
  assert.doesNotMatch(JSON.stringify(result.surface), /\/home\/|TOKEN=|\.gguf|\.safetensors/);
}

async function testPccxLabBackendStatusCommandReturnsStatusOnly() {
  const settings = new Map([
    ["mode", "checkedExample"],
    ["liveWorkspace.enabled", false],
    ["pccxLab.command", "custom-lab"],
    ["workflowBoundary.enabled", false],
    ["workflowBoundary.backend", "none"],
    ["validationRunner.enabled", false],
    ["validationRunner.mode", "disabled"],
    ["validationRunner.defaultWorkingDirectory", "repo-root"],
    ["validationRunner.maxOutputLines", 120],
    ["validationRunner.timeoutMs", 30000],
    ["pythonPath", "python3"],
    ["defaultSource", "fixtures/missing_endmodule.sv"],
    ["defaultLog", "fixtures/xsim/mixed.log"],
    ["defaultNavigationRoot", "fixtures/modules"],
    ["defaultModule", "simple_mod"],
    ["defaultDeclarationKind", "module"],
  ]);
  const handler = createCommandHandler(
    PCCX_LAB_BACKEND_STATUS_COMMAND,
    {
      workspace: {
        getConfiguration() {
          return {
            get(key) {
              return settings.get(key);
            },
          };
        },
      },
    },
    {},
  );

  const result = await handler();

  assert.equal(result.ok, true);
  assert.equal(result.commandId, PCCX_LAB_BACKEND_STATUS_COMMAND);
  assert.equal(result.status.kind, "pccx-lab-backend-status");
  assert.equal(result.status.configuredCommand, "custom-lab");
  assert.equal(result.status.executes, false);
  assert.equal(result.status.backendCommandExecuted, false);
  assert.ok(result.status.futureControlledOperations.includes("declarations"));
  assert.ok(result.status.futureControlledOperations.includes("validation summary"));
  assert.ok(result.status.futureSafetyRequirements.includes("fixed args"));
}

async function testKv260StatusPanelCommandReturnsDataOnlySurface() {
  const handler = createCommandHandler(SHOW_KV260_STATUS_PANEL_COMMAND, null, {
    async kv260PreflightTranscriptReader() {
      const error = new Error("missing");
      error.code = "ENOENT";
      throw error;
    },
  });

  const result = await handler();

  assert.equal(result.ok, true);
  assert.equal(result.commandId, SHOW_KV260_STATUS_PANEL_COMMAND);
  assert.equal(result.kind, "kv260-status-panel");
  assert.equal(result.panel.kind, "kv260-status-panel");
  assert.equal(result.panel.source.launcherTypeMirror, "pccx.ide.launcher-npu-status.local-mirror.v0");
  assert.equal(result.panel.source.labManifestParser, "real");
  assert.equal(result.panel.safety.launcherExecution, false);
  assert.equal(result.panel.safety.pccxLabExecution, false);
  assert.equal(result.panel.safety.shellExecution, false);
  assert.equal(result.panel.safety.sshExecution, false);
  assert.equal(result.panel.preflightTranscript.message, "no preflight captured yet");
}

async function testKv260StatusPanelCommandRendersExistingWebviewOnly() {
  const webviewPanel = { webview: { html: "" } };
  const vscodeApi = {
    ViewColumn: { One: 1 },
    window: {
      createWebviewPanel(viewType, title, viewColumn, options) {
        assert.equal(viewType, "pccxKv260Readiness");
        assert.equal(title, "PCCX KV260 Readiness");
        assert.equal(viewColumn, 1);
        assert.deepEqual(options, { enableScripts: false });
        return webviewPanel;
      },
      showInformationMessage() {},
    },
  };
  const handler = createCommandHandler(SHOW_KV260_STATUS_PANEL_COMMAND, vscodeApi, {
    kv260PreflightTranscriptText: [
      "selected port: /dev/ttyUSB2 baud 115200",
      "login: ok",
      "uname: Linux kv260 6.6.0-xilinx aarch64 GNU/Linux",
      "xrt version: 2.16.204",
      "xmutil app count: 4",
    ].join("\n"),
  });

  const result = await handler();

  assert.equal(result.ok, true);
  assert.equal(result.presentation, "webview");
  assert.match(webviewPanel.webview.html, /class="aperture-mark"/);
  assert.match(webviewPanel.webview.html, /status-pill status-pending">PENDING/);
  assert.match(webviewPanel.webview.html, /<details class="evidence-path">/);
  assert.match(webviewPanel.webview.html, /\/dev\/ttyUSB2 @ 115200/);
  assert.equal(result.panel.preflightTranscript.xmutilAppCount, 4);
}

async function testKv260PreflightTranscriptPathIsConfigurableAndGraceful() {
  const settings = new Map([
    ["kv260.preflightTranscriptPath", "~/private/preflight.md"],
  ]);
  const vscodeApi = {
    workspace: {
      getConfiguration() {
        return {
          get(key) {
            return settings.get(key);
          },
        };
      },
    },
  };
  const readCalls = [];
  const summary = await readKv260PreflightTranscriptSummary(
    readExtensionConfig(vscodeApi),
    {
      homeDir: "/tmp/home",
      async kv260PreflightTranscriptReader(path, encoding) {
        readCalls.push([path, encoding]);
        return [
          "winning port: /dev/ttyUSB3 @ 921600",
          "login_ok: yes",
          "uname -a: Linux kv260 6.6.0-test aarch64 GNU/Linux",
          "xrt version: 2.17.0",
          "xmutil app count: 2",
        ].join("\n");
      },
    },
  );
  const missing = await readKv260PreflightTranscriptSummary(
    readExtensionConfig(vscodeApi),
    {
      homeDir: "/tmp/home",
      async kv260PreflightTranscriptReader() {
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      },
    },
  );

  assert.deepEqual(readCalls, [["/tmp/home/private/preflight.md", "utf8"]]);
  assert.equal(summary.winningPort, "/dev/ttyUSB3");
  assert.equal(summary.baud, 921600);
  assert.equal(summary.loginOk, true);
  assert.equal(summary.xrtVersion, "2.17.0");
  assert.equal(summary.xmutilAppCount, 2);
  assert.equal(missing.captured, false);
  assert.equal(missing.message, "no preflight captured yet");
}

testKnownFacadeArgs();
testUnknownCommandsRejected();
testCheckedExampleDiagnosticsCommandStaysExampleMode();
testCheckedExampleNavigationCommandStaysExampleMode();
testFacadeInvocationIsArgumentArray();
testPresenterDepsResolveRelativeDiagnosticFiles();
testNavigationLocationMapping();
testResolveCommandRequestUsesVsCodeSettings();
await testEntrypointExportsAndActivation();
await testCheckedExampleNavigationCommandReturnsLocations();
await testLiveWorkspaceNavigationCommandReturnsLocationsWithoutQuickPick();
await testCheckedExampleDefinitionProviderReturnsLocations();
await testActivationRegistersCheckedExampleDefinitionProvider();
await testNoVsCodeRuntimeIsANoop();
await testCommandHandlerCanBeUsedWithoutRealVsCode();
await testWorkflowStatusCommandReturnsDisabledBackendNone();
await testWorkflowContextBundleCommandUsesActiveEditorSelectionAndDiagnostics();
await testValidationProposalCommandReturnsDataOnly();
await testValidationPreflightAuditCommandReturnsAuditOnly();
await testApprovedValidationRunnerBlocksByDefaultAndUpdatesContext();
await testApprovedValidationRunnerRequiresProposalIdWhenEnabled();
await testApprovedValidationRunnerExecutesAllowlistedProposalWhenEnabled();
await testValidationResultCacheCommandsShowAndClear();
await testPatchProposalPreviewCommandsShowAndClearCheckedProposalOnly();
await testLocalWorkflowStatusCommandReturnsFixtureOnlyBoundaryState();
await testContextBundleAuditCommandReturnsBoundedAudit();
await testDiagnosticsHandoffSummaryCommandReturnsDataOnlySurface();
await testPccxLabBackendStatusCommandReturnsStatusOnly();
await testKv260StatusPanelCommandReturnsDataOnlySurface();
await testKv260StatusPanelCommandRendersExistingWebviewOnly();
await testKv260PreflightTranscriptPathIsConfigurableAndGraceful();

console.log("vscode extension entrypoint tests ok");
