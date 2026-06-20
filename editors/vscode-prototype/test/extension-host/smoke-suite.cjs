// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const vscode = require("vscode");

const extensionRoot = process.env.PCCX_EXTENSION_ROOT;
const expectedCommandIds = (process.env.PCCX_EXPECTED_COMMAND_IDS || "")
  .split(",")
  .filter(Boolean);

function readManifest() {
  return JSON.parse(readFileSync(path.join(extensionRoot, "package.json"), "utf8"));
}

function localDevelopmentExtensions() {
  const expectedPath = path.resolve(extensionRoot);
  return vscode.extensions.all.filter(
    (extension) => path.resolve(extension.extensionPath) === expectedPath,
  );
}

async function importExtensionEntrypoint() {
  const entrypoint = path.join(extensionRoot, "src/extension.mjs");
  return import(pathToFileURL(entrypoint).href);
}

async function updatePrototypeConfig(key, value) {
  await vscode.workspace
    .getConfiguration("pccxSystemVerilog")
    .update(key, value, vscode.ConfigurationTarget.Global);
}

async function resetPrototypeConfig() {
  await updatePrototypeConfig("mode", "checkedExample");
  await updatePrototypeConfig("liveWorkspace.enabled", false);
  await updatePrototypeConfig("workflowBoundary.enabled", false);
  await updatePrototypeConfig("workflowBoundary.backend", "none");
  await updatePrototypeConfig("validationRunner.enabled", false);
  await updatePrototypeConfig("validationRunner.mode", "disabled");
  await updatePrototypeConfig("validationRunner.defaultWorkingDirectory", "repo-root");
  await updatePrototypeConfig("validationRunner.maxOutputLines", 120);
  await updatePrototypeConfig("validationRunner.timeoutMs", 30000);
  await updatePrototypeConfig("pythonPath", "python3");
  await updatePrototypeConfig("pccxLab.command", "pccx_ide_cli");
  await updatePrototypeConfig("defaultSource", "fixtures/missing_endmodule.sv");
  await updatePrototypeConfig("defaultNavigationRoot", "fixtures/modules");
  await updatePrototypeConfig("defaultModule", "simple_mod");
  await updatePrototypeConfig("defaultDeclarationKind", "module");
}

async function run() {
  assert.ok(extensionRoot, "PCCX_EXTENSION_ROOT must be set");
  assert.ok(process.env.PCCX_REPO_ROOT, "PCCX_REPO_ROOT must be set");
  assert.ok(process.env.PCCX_LIVE_WORKSPACE_FIXTURE, "PCCX_LIVE_WORKSPACE_FIXTURE must be set");
  await resetPrototypeConfig();
  assert.deepEqual(expectedCommandIds, [
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
    "pccxSystemVerilog.showLocalSynthesisPlan",
    "pccxSystemVerilog.showPccxLabBackendStatus",
    "pccxSystemVerilog.showDiagnosticsHandoffSummary",
    "pccxSystemVerilog.showAssistStatus",
    "pccxSystemVerilog.runVeribleLintDiagnostics",
    "pccxSystemVerilog.prepareSimulationHandoff",
  ]);

  const manifest = readManifest();
  assert.equal(manifest.private, true);
  assert.equal(manifest.publisher, undefined);
  assert.equal(manifest.devDependencies?.["@vscode/test-electron"], "2.5.2");

  const developmentExtensions = localDevelopmentExtensions();
  assert.ok(
    developmentExtensions.length >= 1,
    "local extensionDevelopmentPath was not loaded by the Extension Host",
  );
  const developmentExtension = developmentExtensions[0];
  const activation = await developmentExtension.activate();
  assert.equal(developmentExtension.isActive, true);
  assert.deepEqual(activation.commandIds, expectedCommandIds);
  assert.ok(
    activation.definitionProviders.some((provider) => (
      provider.id === "pccxSystemVerilog.definitionProvider.checkedExample" &&
      provider.active === true
    )),
    "checked-example DefinitionProvider was not active",
  );

  const commands = await vscode.commands.getCommands(true);
  for (const commandId of expectedCommandIds) {
    assert.ok(commands.includes(commandId), `${commandId} is missing`);
  }

  const disabledLiveWorkspaceResult = await vscode.commands.executeCommand(
    "pccxSystemVerilog.publishLiveWorkspaceDiagnostics",
  );
  assert.equal(disabledLiveWorkspaceResult.ok, false);
  assert.match(disabledLiveWorkspaceResult.error, /live workspace commands require/);

  const disabledLiveNavigationResult = await vscode.commands.executeCommand(
    "pccxSystemVerilog.showLiveWorkspaceNavigation",
  );
  assert.equal(disabledLiveNavigationResult.ok, false);
  assert.match(disabledLiveNavigationResult.error, /live workspace commands require/);

  const result = await vscode.commands.executeCommand(
    "pccxSystemVerilog.publishCheckedExampleDiagnostics",
  );
  assert.equal(result.ok, true);
  assert.equal(result.commandId, "pccxSystemVerilog.publishCheckedExampleDiagnostics");
  assert.equal(result.action.kind, "diagnostics");
  assert.ok(result.action.diagnostics.length > 0);

  const expectedDiagnostic = result.action.diagnostics[0];
  const expectedUri = vscode.Uri.file(path.resolve(
    process.env.PCCX_REPO_ROOT,
    expectedDiagnostic.file,
  ));
  const publishedDiagnostics = vscode.languages.getDiagnostics(expectedUri);
  assert.ok(
    publishedDiagnostics.length > 0,
    `no diagnostics were published for ${expectedUri.toString()}`,
  );
  const publishedDiagnostic = publishedDiagnostics.find(
    (diagnostic) => diagnostic.message === expectedDiagnostic.message,
  );
  assert.ok(publishedDiagnostic, "published diagnostic message was not found");
  assert.equal(publishedDiagnostic.source, expectedDiagnostic.source);
  assert.equal(publishedDiagnostic.severity, vscode.DiagnosticSeverity.Error);
  assert.equal(publishedDiagnostic.range.start.line, expectedDiagnostic.range.start.line);
  assert.equal(
    publishedDiagnostic.range.start.character,
    expectedDiagnostic.range.start.character,
  );
  assert.equal(publishedDiagnostic.range.end.line, expectedDiagnostic.range.end.line);
  assert.equal(
    publishedDiagnostic.range.end.character,
    expectedDiagnostic.range.end.character,
  );

  const navigationResult = await vscode.commands.executeCommand(
    "pccxSystemVerilog.showCheckedExampleNavigation",
  );
  assert.equal(navigationResult.ok, true);
  assert.equal(navigationResult.commandId, "pccxSystemVerilog.showCheckedExampleNavigation");
  assert.deepEqual(navigationResult.plan.facadeArgs, [
    "navigation",
    "--mode",
    "example",
    "--source",
    "declarations",
  ]);
  assert.equal(navigationResult.action.kind, "navigation");
  assert.ok(navigationResult.action.items.length > 0);
  assert.ok(Array.isArray(navigationResult.locations));
  assert.ok(navigationResult.locations.length > 0);

  const firstLocation = navigationResult.locations[0];
  assert.ok(firstLocation.uri instanceof vscode.Uri);
  assert.ok(firstLocation.range instanceof vscode.Range);
  assert.ok(firstLocation.location instanceof vscode.Location);
  assert.ok(firstLocation.uri.fsPath.endsWith(firstLocation.file));
  assert.ok(firstLocation.range.start.line >= 0);
  assert.ok(firstLocation.range.start.character >= 0);
  assert.equal(firstLocation.range.end.line, firstLocation.range.start.line);
  assert.equal(firstLocation.range.end.character, firstLocation.range.start.character + 1);
  assert.equal(typeof firstLocation.symbol, "string");
  assert.ok(firstLocation.symbol.length > 0);
  assert.equal(typeof firstLocation.targetKind, "string");
  assert.ok(firstLocation.targetKind.length > 0);
  assert.equal(firstLocation.source, "pccx-vscode-prototype");
  assert.equal(firstLocation.location.uri.toString(), firstLocation.uri.toString());
  assert.equal(firstLocation.location.range.start.line, firstLocation.range.start.line);

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  assert.ok(workspaceRoot, "runtime smoke workspace was not opened");
  assert.equal(
    path.resolve(workspaceRoot),
    path.resolve(process.env.PCCX_LIVE_WORKSPACE_FIXTURE),
  );
  const definitionUri = vscode.Uri.file(path.join(workspaceRoot, "smoke.sv"));
  const document = await vscode.workspace.openTextDocument(definitionUri);
  assert.equal(document.uri.toString(), definitionUri.toString());
  const definitionLocations = await vscode.commands.executeCommand(
    "vscode.executeDefinitionProvider",
    definitionUri,
    new vscode.Position(0, 7),
  );

  assert.ok(Array.isArray(definitionLocations));
  assert.ok(definitionLocations.length > 0);
  const providerLocation = definitionLocations[0];
  assert.ok(providerLocation instanceof vscode.Location);
  assert.ok(providerLocation.uri instanceof vscode.Uri);
  assert.ok(providerLocation.range instanceof vscode.Range);
  assert.ok(providerLocation.uri.fsPath.endsWith(".sv"));
  assert.ok(providerLocation.range.start.line >= 0);
  assert.ok(providerLocation.range.start.character >= 0);
  assert.equal(providerLocation.range.end.line, providerLocation.range.start.line);
  assert.equal(
    providerLocation.range.end.character,
    providerLocation.range.start.character + 1,
  );

  const liveBrokenPath = path.join(workspaceRoot, "broken_missing_endmodule.sv");
  await updatePrototypeConfig("mode", "liveWorkspace");
  await updatePrototypeConfig("liveWorkspace.enabled", true);
  await updatePrototypeConfig("defaultSource", liveBrokenPath);
  await updatePrototypeConfig("defaultNavigationRoot", workspaceRoot);
  await updatePrototypeConfig("defaultModule", "live_top");
  await updatePrototypeConfig("defaultDeclarationKind", "module");

  const liveResult = await vscode.commands.executeCommand(
    "pccxSystemVerilog.publishLiveWorkspaceDiagnostics",
    vscode.Uri.file(liveBrokenPath),
  );
  assert.equal(liveResult.ok, true);
  assert.equal(liveResult.commandId, "pccxSystemVerilog.publishLiveWorkspaceDiagnostics");
  assert.equal(liveResult.action.kind, "diagnostics");
  assert.equal(liveResult.plan.config.mode, "liveWorkspace");
  assert.equal(liveResult.plan.config.liveWorkspace.enabled, true);
  assert.deepEqual(liveResult.plan.facadeArgs.slice(0, 3), [
    "diagnostics",
    "--mode",
    "live",
  ]);
  assert.equal(liveResult.plan.facadeArgs[3], "--from-check");
  assert.equal(liveResult.plan.facadeArgs[4], liveBrokenPath);
  assert.ok(liveResult.action.diagnostics.length > 0);
  assert.ok(
    liveResult.action.diagnostics.every((diagnostic) => (
      path.resolve(diagnostic.file) === path.resolve(liveBrokenPath)
    )),
    "live diagnostics must come from the controlled fixture, not checked examples",
  );
  assert.ok(
    liveResult.action.diagnostics.every((diagnostic) => (
      diagnostic.file !== "fixtures/missing_endmodule.sv"
    )),
    "live diagnostics unexpectedly fell back to the checked example fixture",
  );
  const liveDiagnostics = vscode.languages.getDiagnostics(vscode.Uri.file(liveBrokenPath));
  assert.ok(liveDiagnostics.length > 0, "live fixture diagnostics were not published");

  const liveNavigationResult = await vscode.commands.executeCommand(
    "pccxSystemVerilog.showLiveWorkspaceNavigation",
  );
  assert.equal(liveNavigationResult.ok, true);
  assert.equal(liveNavigationResult.commandId, "pccxSystemVerilog.showLiveWorkspaceNavigation");
  assert.equal(liveNavigationResult.action.kind, "navigation");
  assert.equal(liveNavigationResult.plan.config.mode, "liveWorkspace");
  assert.equal(liveNavigationResult.plan.config.liveWorkspace.enabled, true);
  assert.deepEqual(liveNavigationResult.plan.facadeArgs, [
    "navigation",
    "--mode",
    "live",
    "--locate",
    workspaceRoot,
    "live_top",
    "--kind",
    "module",
  ]);
  assert.ok(Array.isArray(liveNavigationResult.action.items));
  assert.equal(liveNavigationResult.action.items.length, 1);
  assert.equal(liveNavigationResult.action.items[0].name, "live_top");
  assert.equal(liveNavigationResult.action.items[0].kind, "module");
  assert.equal(
    path.resolve(liveNavigationResult.action.items[0].file),
    path.resolve(workspaceRoot, "top.sv"),
  );
  assert.ok(Array.isArray(liveNavigationResult.locations));
  assert.equal(liveNavigationResult.locations.length, 1);
  assert.ok(liveNavigationResult.locations[0].uri instanceof vscode.Uri);
  assert.ok(liveNavigationResult.locations[0].range instanceof vscode.Range);
  assert.ok(liveNavigationResult.locations[0].location instanceof vscode.Location);
  assert.equal(liveNavigationResult.locations[0].symbol, "live_top");
  assert.equal(liveNavigationResult.locations[0].targetKind, "module");
  assert.equal(liveNavigationResult.locations[0].source, "pccx-vscode-prototype");
  assert.equal(
    path.resolve(liveNavigationResult.locations[0].uri.fsPath),
    path.resolve(workspaceRoot, "top.sv"),
  );
  assert.ok(
    liveNavigationResult.action.items.every((item) => (
      !item.file.includes("fixtures/modules") &&
      item.name !== "simple_mod" &&
      item.name !== "pkg_defs"
    )),
    "live navigation unexpectedly fell back to checked-example navigation",
  );

  const aiStatus = await vscode.commands.executeCommand(
    "pccxSystemVerilog.showWorkflowBoundaryStatus",
  );
  assert.equal(aiStatus.ok, true);
  assert.equal(aiStatus.status.status, "disabled");
  assert.equal(aiStatus.status.backend, "none");
  assert.equal(aiStatus.status.providerCalls, false);
  assert.equal(aiStatus.status.runtimeCalls, false);
  assert.equal(aiStatus.status.providerCallsImplemented, false);
  assert.equal(aiStatus.status.runtimeCallsImplemented, false);
  assert.equal(aiStatus.status.mcpServerImplemented, false);
  assert.ok(aiStatus.status.allowedActions.some((action) => action.kind === "proposePatch"));
  assert.ok(aiStatus.status.disallowedActions.includes("writeFile"));
  assert.ok(aiStatus.status.disallowedActions.includes("release"));

  const liveDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(
    path.join(workspaceRoot, "top.sv"),
  ));
  const liveEditor = await vscode.window.showTextDocument(liveDocument, { preview: false });
  liveEditor.selection = new vscode.Selection(0, 7, 0, 15);
  const contextResult = await vscode.commands.executeCommand(
    "pccxSystemVerilog.buildWorkflowContextBundle",
  );
  assert.equal(contextResult.ok, true);
  assert.equal(contextResult.kind, "workflow-context-bundle");
  assert.equal(contextResult.status, "disabled");
  assert.equal(contextResult.backend, "none");
  assert.equal(contextResult.providerCalls, false);
  assert.equal(contextResult.runtimeCalls, false);
  assert.deepEqual(contextResult.contextBundle.selectedFile, {
    path: "top.sv",
  });
  assert.equal(contextResult.contextBundle.configuration.mode, "liveWorkspace");
  assert.equal(contextResult.contextBundle.configuration.workflowBoundary.enabled, false);
  assert.equal(contextResult.contextBundle.configuration.workflowBoundary.backend, "none");
  assert.equal(contextResult.contextBundle.symbols.selected.name, "live_top");
  assert.equal(contextResult.contextBundle.symbols.selected.kind, "module");
  assert.equal(contextResult.contextBundle.symbols.selectedContext.symbolText, "live_top");
  assert.equal(contextResult.contextBundle.symbols.selectedContext.lexicalKind, "module");
  assert.equal(
    contextResult.contextBundle.symbols.selectedContext.enclosingDeclaration.kind,
    "module",
  );
  assert.equal(contextResult.contextBundle.symbols.selectedContext.relatedNavigation.length, 1);
  assert.equal(contextResult.contextBundle.snippets.length, 1);
  assert.equal(contextResult.contextBundle.snippets[0].path, "top.sv");
  assert.equal(
    contextResult.contextBundle.recentCommand.commandId,
    "pccxSystemVerilog.showLiveWorkspaceNavigation",
  );
  assert.equal(contextResult.contextBundle.diagnosticsHandoff.status, "available");
  assert.equal(contextResult.contextBundle.diagnosticsHandoff.summaryAvailable, true);
  assert.equal(contextResult.contextBundle.diagnosticsHandoff.source.adapterOutput, true);
  assert.equal(contextResult.contextBundle.diagnosticsHandoff.source.rawHandoffParsedByUi, false);
  assert.equal(contextResult.contextBundle.diagnosticsHandoff.safety.launcherExecution, false);
  assert.equal(contextResult.contextBundle.diagnosticsHandoff.safety.pccxLabExecution, false);
  assert.equal(contextResult.contextBundle.diagnosticsHandoff.safety.pccxLabValidatorInvocation, false);
  assert.equal(contextResult.contextBundle.diagnosticsHandoff.safety.shellExecution, false);
  assert.equal(contextResult.contextBundle.diagnosticsHandoff.safety.providerCalls, false);
  assert.equal(contextResult.contextBundle.diagnosticsHandoff.safety.runtimeCalls, false);
  assert.equal(contextResult.contextBundle.diagnosticsHandoff.safety.mcpCalls, false);
  assert.equal(contextResult.contextBundle.diagnosticsHandoff.safety.lspImplemented, false);
  assert.equal(contextResult.contextSummary.diagnosticsHandoff.diagnosticCount, 5);
  assert.doesNotMatch(JSON.stringify(contextResult.contextBundle), /\/home\//);
  assert.ok(contextResult.contextBundle.excludedPathPatterns.includes("node_modules/**"));
  assert.doesNotMatch(JSON.stringify(contextResult.contextBundle), /AGENTS\.md/);
  assert.doesNotMatch(JSON.stringify(contextResult.contextBundle), /package-lock\.json/);
  assert.equal(contextResult.contextBundle.redaction.assignmentPolicy, "secret-like-lines-redacted");

  const validationProposal = await vscode.commands.executeCommand(
    "pccxSystemVerilog.proposeValidationCommand",
  );
  assert.equal(validationProposal.ok, true);
  assert.equal(validationProposal.kind, "validation-command-proposal");
  assert.equal(validationProposal.execution, "proposalOnly");
  assert.equal(validationProposal.executes, false);
  assert.equal(validationProposal.providerCalls, false);
  assert.equal(validationProposal.runtimeCalls, false);
  assert.equal(validationProposal.diagnosticsHandoffContext.status, "available");
  assert.equal(validationProposal.diagnosticsHandoffContext.summaryAvailable, true);
  assert.equal(validationProposal.diagnosticsHandoffContext.safety.launcherExecution, false);
  assert.equal(validationProposal.diagnosticsHandoffContext.safety.pccxLabExecution, false);
  assert.equal(
    validationProposal.diagnosticsHandoffContext.safety.pccxLabValidatorInvocation,
    false,
  );
  assert.equal(validationProposal.diagnosticsHandoffContext.safety.shellExecution, false);
  assert.ok(validationProposal.proposals.some((proposal) => (
    proposal.id === "vscodeAdapterSmoke"
  )));
  assert.ok(validationProposal.proposals.some((proposal) => (
    proposal.command?.argv?.join(" ") === "bash scripts/vscode-adapter-smoke.sh"
  )));
  assert.ok(validationProposal.proposals.some((proposal) => (
    proposal.command?.env?.PCCX_RUN_EXTENSION_HOST_SMOKE === "1"
  )));
  assert.ok(validationProposal.proposals.every((proposal) => (
    proposal.preflight.diagnosticsHandoff.status === "available"
  )));

  const validationPreflightAudit = await vscode.commands.executeCommand(
    "pccxSystemVerilog.auditValidationProposalPreflight",
    { proposalId: "vscodeAdapterSmoke" },
  );
  assert.equal(validationPreflightAudit.ok, true);
  assert.equal(validationPreflightAudit.kind, "validation-proposal-preflight-audit");
  assert.equal(validationPreflightAudit.status, "passed");
  assert.equal(validationPreflightAudit.eligibleForApprovedRunner, true);
  assert.equal(validationPreflightAudit.executes, false);
  assert.equal(validationPreflightAudit.diagnosticsHandoff.status, "available");
  assert.equal(validationPreflightAudit.diagnosticsHandoff.contextOnly, true);
  assert.equal(validationPreflightAudit.safety.automaticExecution, false);
  assert.equal(validationPreflightAudit.safety.allowlistBroadened, false);

  const blockedValidationPreflightAudit = await vscode.commands.executeCommand(
    "pccxSystemVerilog.auditValidationProposalPreflight",
    { proposalId: "vscodeAdapterSmoke", command: "bash scripts/vscode-adapter-smoke.sh; rm -rf /" },
  );
  assert.equal(blockedValidationPreflightAudit.ok, true);
  assert.equal(blockedValidationPreflightAudit.status, "failed");
  assert.equal(blockedValidationPreflightAudit.eligibleForApprovedRunner, false);
  assert.equal(blockedValidationPreflightAudit.findings.rawShellString, true);

  const patchPreview = await vscode.commands.executeCommand(
    "pccxSystemVerilog.showPatchProposalPreview",
    "missingEndmodulePreview",
  );
  assert.equal(patchPreview.ok, true);
  assert.equal(patchPreview.kind, "patch-proposal-preview");
  assert.equal(patchPreview.summary.proposalId, "missingEndmodulePreview");
  assert.equal(patchPreview.proposalOnly, true);
  assert.equal(patchPreview.appliesPatches, false);
  assert.equal(patchPreview.writesFiles, false);
  assert.equal(patchPreview.providerCalls, false);
  assert.equal(patchPreview.runtimeCalls, false);
  assert.doesNotMatch(JSON.stringify(patchPreview), /\/home\//);

  const clearPatchPreview = await vscode.commands.executeCommand(
    "pccxSystemVerilog.clearPatchProposalPreview",
  );
  assert.equal(clearPatchPreview.ok, true);
  assert.equal(clearPatchPreview.kind, "patch-proposal-preview-clear");
  assert.equal(clearPatchPreview.cleared, true);

  const localWorkflowStatus = await vscode.commands.executeCommand(
    "pccxSystemVerilog.showLocalWorkflowStatus",
  );
  assert.equal(localWorkflowStatus.ok, true);
  assert.equal(localWorkflowStatus.kind, "local-workflow-status");
  assert.equal(localWorkflowStatus.status.extensionMode, "liveWorkspace");
  assert.equal(localWorkflowStatus.status.pccxLabBoundary.state, "future");
  assert.equal(localWorkflowStatus.status.pccxLabBoundary.executes, false);
  assert.equal(localWorkflowStatus.status.launcherBoundary.state, "future");
  assert.equal(localWorkflowStatus.status.launcherBoundary.launcherCalls, false);
  assert.equal(localWorkflowStatus.status.safety.providerCalls, false);
  assert.equal(localWorkflowStatus.status.safety.pccxLabExecution, false);
  assert.equal(localWorkflowStatus.status.localSynthesisBoundary.version, "pccx.localSynthesisPlan.v0");
  assert.equal(localWorkflowStatus.status.localSynthesisBoundary.offlineSupported, true);
  assert.equal(localWorkflowStatus.status.localSynthesisBoundary.executes, false);

  const contextBundleAudit = await vscode.commands.executeCommand(
    "pccxSystemVerilog.showContextBundleAudit",
  );
  assert.equal(contextBundleAudit.ok, true);
  assert.equal(contextBundleAudit.kind, "context-bundle-audit");
  assert.ok(contextBundleAudit.audit.approximateCharacterCount > 0);
  assert.equal(contextBundleAudit.audit.safety.providerCalls, false);
  assert.equal(contextBundleAudit.audit.safety.fullLogsExcluded, true);
  assert.doesNotMatch(JSON.stringify(contextBundleAudit.audit), /\/home\//);

  const localSynthesisPlan = await vscode.commands.executeCommand(
    "pccxSystemVerilog.showLocalSynthesisPlan",
    { vendor: "auto", scriptPath: "synth.tcl", workDir: "." },
  );
  assert.equal(localSynthesisPlan.ok, true);
  assert.equal(localSynthesisPlan.kind, "local-synthesis-plan");
  assert.equal(localSynthesisPlan.plan.version, "pccx.localSynthesisPlan.v0");
  assert.equal(localSynthesisPlan.plan.localBuild.offlineSupported, true);
  assert.equal(localSynthesisPlan.plan.localBuild.cloudSyncRequired, false);
  assert.equal(localSynthesisPlan.plan.safety.executes, false);
  assert.deepEqual(localSynthesisPlan.plan.localBuild.synthArgv.slice(0, 3), [
    "pccx",
    "synth",
    "--local",
  ]);

  const disabledValidationRun = await vscode.commands.executeCommand(
    "pccxSystemVerilog.runApprovedValidationCommand",
    "vscodeAdapterSmoke",
  );
  assert.equal(disabledValidationRun.ok, false);
  assert.equal(disabledValidationRun.kind, "approved-validation-result");
  assert.equal(disabledValidationRun.status, "blocked");
  assert.match(disabledValidationRun.blockedReason, /runner is disabled/);
  assert.equal(disabledValidationRun.safety.allowlisted, true);
  assert.equal(disabledValidationRun.safety.shell, false);

  await updatePrototypeConfig("validationRunner.enabled", true);
  await updatePrototypeConfig("validationRunner.mode", "allowlisted");
  await updatePrototypeConfig("validationRunner.maxOutputLines", 20);
  try {
    const approvedValidationRun = await vscode.commands.executeCommand(
      "pccxSystemVerilog.runApprovedValidationCommand",
      { proposalId: "vscodeAdapterSmoke" },
    );
    assert.equal(approvedValidationRun.ok, true);
    assert.equal(approvedValidationRun.status, "passed");
    assert.equal(approvedValidationRun.command, "bash");
    assert.deepEqual(approvedValidationRun.args, ["scripts/vscode-adapter-smoke.sh"]);
    assert.equal(approvedValidationRun.safety.allowlisted, true);
    assert.equal(approvedValidationRun.safety.shell, false);
    assert.ok(approvedValidationRun.stdoutSummary.lines.length <= 20);
    assert.equal(approvedValidationRun.resultSummary.proposalId, "vscodeAdapterSmoke");

    const postValidationContext = await vscode.commands.executeCommand(
      "pccxSystemVerilog.buildWorkflowContextBundle",
    );
    assert.equal(postValidationContext.ok, true);
    assert.equal(postValidationContext.contextBundle.validation.recent.proposalId, "vscodeAdapterSmoke");
    assert.equal(postValidationContext.contextBundle.validation.recent.status, "passed");
    assert.equal(
      postValidationContext.contextBundle.validation.recent.commandLabel,
      "VS Code adapter smoke",
    );
    assert.ok(
      postValidationContext.contextBundle.validation.recent.stdoutSummary.lines.length <= 20,
    );
    assert.equal(
      postValidationContext.contextBundle.validation.recent.safety.allowlisted,
      true,
    );
    assert.deepEqual(postValidationContext.contextBundle.validation.historyPolicy, {
      maxResults: 5,
      summaryOnly: true,
      fullLogsExcluded: true,
    });
    assert.equal(postValidationContext.contextBundle.diagnosticsHandoff.summaryAvailable, true);
    assert.equal(postValidationContext.contextBundle.diagnosticsHandoff.safety.readOnly, true);

    const cacheStatus = await vscode.commands.executeCommand(
      "pccxSystemVerilog.showValidationCacheStatus",
    );
    assert.equal(cacheStatus.ok, true);
    assert.equal(cacheStatus.kind, "validation-result-cache-status");
    assert.equal(cacheStatus.status.count, 2);
    assert.equal(cacheStatus.status.maxSize, 5);
    assert.equal(cacheStatus.status.latest.proposalId, "vscodeAdapterSmoke");
    assert.equal(cacheStatus.status.latest.status, "passed");
    assert.equal(cacheStatus.status.summaryOnly, true);
    assert.equal(cacheStatus.status.fullLogsExcluded, true);

    const clearValidationCache = await vscode.commands.executeCommand(
      "pccxSystemVerilog.clearValidationResultCache",
    );
    assert.equal(clearValidationCache.ok, true);
    assert.equal(clearValidationCache.kind, "validation-result-cache-clear");
    assert.equal(clearValidationCache.clearedCount, 2);

    const emptyCacheStatus = await vscode.commands.executeCommand(
      "pccxSystemVerilog.showValidationCacheStatus",
    );
    assert.equal(emptyCacheStatus.ok, true);
    assert.equal(emptyCacheStatus.kind, "validation-result-cache-status");
    assert.equal(emptyCacheStatus.status.count, 0);
    assert.equal(emptyCacheStatus.status.latest, null);

    const recentValidationResultsEmpty = await vscode.commands.executeCommand(
      "pccxSystemVerilog.showRecentValidationResults",
    );
    assert.equal(recentValidationResultsEmpty.ok, true);
    assert.equal(recentValidationResultsEmpty.kind, "validation-result-cache");
    assert.deepEqual(recentValidationResultsEmpty.entries, []);
    assert.equal(recentValidationResultsEmpty.selected, null);
  } finally {
    await updatePrototypeConfig("validationRunner.enabled", false);
    await updatePrototypeConfig("validationRunner.mode", "disabled");
    await updatePrototypeConfig("validationRunner.maxOutputLines", 120);
  }

  const pccxLabStatus = await vscode.commands.executeCommand(
    "pccxSystemVerilog.showPccxLabBackendStatus",
  );
  assert.equal(pccxLabStatus.ok, true);
  assert.equal(pccxLabStatus.status.kind, "pccx-lab-backend-status");
  assert.equal(pccxLabStatus.status.configuredCommand, "pccx_ide_cli");
  assert.equal(pccxLabStatus.status.executes, false);
  assert.equal(pccxLabStatus.status.backendCommandExecuted, false);
  assert.ok(pccxLabStatus.status.futureControlledOperations.includes("diagnostics"));

  const diagnosticsHandoffStatus = await vscode.commands.executeCommand(
    "pccxSystemVerilog.showDiagnosticsHandoffSummary",
  );
  assert.equal(diagnosticsHandoffStatus.ok, true);
  assert.equal(diagnosticsHandoffStatus.kind, "diagnostics-handoff-status");
  assert.equal(diagnosticsHandoffStatus.surface.kind, "diagnostics-handoff-status-surface");
  assert.equal(diagnosticsHandoffStatus.surface.source.adapterOutput, true);
  assert.equal(diagnosticsHandoffStatus.surface.source.rawHandoffParsedByUi, false);
  assert.equal(diagnosticsHandoffStatus.surface.safety.launcherExecution, false);
  assert.equal(diagnosticsHandoffStatus.surface.safety.pccxLabExecution, false);
  assert.equal(diagnosticsHandoffStatus.surface.safety.pccxLabValidatorInvocation, false);
  assert.equal(diagnosticsHandoffStatus.surface.safety.shellExecution, false);
  assert.equal(diagnosticsHandoffStatus.surface.safety.providerCalls, false);
  assert.equal(diagnosticsHandoffStatus.surface.safety.runtimeCalls, false);
  assert.equal(diagnosticsHandoffStatus.surface.safety.mcpCalls, false);

  const assistStatus = await vscode.commands.executeCommand(
    "pccxSystemVerilog.showAssistStatus",
  );
  assert.equal(assistStatus.ok, true);
  assert.equal(assistStatus.kind, "systemverilog-assist-status");
  assert.equal(assistStatus.completions.snippetCount, 20);
  assert.equal(assistStatus.languageServer.command, "verible-verilog-ls");

  const simulationHandoff = await vscode.commands.executeCommand(
    "pccxSystemVerilog.prepareSimulationHandoff",
    vscode.Uri.file(path.join(workspaceRoot, "top.sv")),
  );
  assert.equal(simulationHandoff.ok, true);
  assert.equal(simulationHandoff.kind, "systemverilog-simulation-handoff");
  assert.equal(simulationHandoff.executesSimulation, false);
  assert.equal(simulationHandoff.writesRtl, false);
  assert.equal(diagnosticsHandoffStatus.surface.safety.lspImplemented, false);

  const extensionModule = await importExtensionEntrypoint();
  assert.equal(typeof extensionModule.deactivate, "function");
  extensionModule.deactivate();
  await resetPrototypeConfig();
}

module.exports = { run };
