# VS Code Prototype Adapter

This directory is an experimental local VS Code prototype for translating
pre-stable editor bridge JSON into VS Code-style data records and for
hosting a minimal local VS Code extension package scaffold.

The extension scaffold is not published, has no marketplace packaging,
has no LSP, and does not define a stable ABI/API.  It can consume the checked
examples under `docs/examples/editor-bridge` and can also run limited
live JSON flows from this source tree through the local command facade.
The default tests are mostly static/mock tests, not VS Code GUI
integration tests, and they run without npm install, Vivado, xsim, or
hardware.  A limited opt-in Extension Host runtime smoke exists for local
dependency-policy review; it is not a product claim.

The package includes a copied pccx aperture-mark icon and a light
`pccx SystemVerilog Light` color theme derived from the local
`pccx-UI/Systemverilog-IDE` design-system package.  These assets are
visual branding only; they do not replace the host-theme-first
presentation boundary and do not make the theme surface complete.

A text-only first-use walkthrough for the command palette, Problems/Output
panels, and current status-bar boundary is tracked in
[`docs/typical-first-time-use.md`](./docs/typical-first-time-use.md).

## Boundary Roles

`systemverilog-ide` is the editor cockpit: it owns VS Code command
registration, presentation mapping, opt-in workspace command shape, and
future context construction for editor users.  It does not become a
separate analysis backend.

`pccx-lab` is the CLI-first verification/tooling backend.  Reusable
analysis, diagnostics, declaration lookup, validation status, and log
handoff should flow through the existing facade and CLI/core boundary
rather than being duplicated inside this extension scaffold.

`pccx-llm-launcher` is a future local LLM/chat/model backend candidate.
This prototype only adds workflow boundary status and context bundle commands
behind a controlled tool boundary, plus a validation command proposal
surface that returns data only and a disabled-by-default approved
validation runner for allowlisted proposal IDs.  There are no provider/runtime calls, no
pccx-llm-launcher runtime calls, and no MCP server implementation in this
scaffold.

## Data Mapping

Problem payloads become diagnostic-like records:

- `error` -> `Error`
- `warning` -> `Warning`
- `info` or unknown severities -> `Information`
- CLI 1-based `line` / `column` values become 0-based
  `range.start.line` / `range.start.character`
- missing locations safely fall back to line `0`, character `0`

Declaration and locate payloads become navigation items that preserve
`name`, `kind`, `file`, `line`, and `column`, with additional 0-based
position fields for editor consumers.

## Live CLI Runner

`src/cli-runner.mjs` is the only subprocess layer.  It uses Node built-ins,
honors the facade process `PCCX_IDE_PYTHON` executable when set, otherwise
prefers `python` and falls back to `python3`, sets `PYTHONPATH=src`, runs
from the repository root, and passes arguments as arrays instead of shell
strings.  It only exposes helpers for known `pccx_ide_cli` JSON flows:

- `problems from-check <file> --format json`
- `problems from-xsim-log <log> --format json`
- `declarations <path> --format json`
- `locate <path> <name> --kind <kind> --format json`

`src/live-adapter.mjs` calls those known flows and translates successful
JSON payloads through the same adapter functions used by the checked
example path.  Failures return structured `ok`, `exitCode`, `stdout`,
`stderr`, and `error` fields for callers to surface.

## Live Workspace Opt-In

Checked-example remains the default.  Live workspace behavior requires
both `pccxSystemVerilog.mode=liveWorkspace` and
`pccxSystemVerilog.liveWorkspace.enabled=true`; setting only one of those
values is not enough.  Live workspace commands do not silently fall back
to checked examples, do not start background workspace scanning, do not
add file watchers, do not check on save, and do not run arbitrary shell
commands.

The live workspace command shape is limited to known facade argument
arrays.  `pccxSystemVerilog.publishLiveWorkspaceDiagnostics` maps to the
known diagnostics facade flow for the configured default source, and
`pccxSystemVerilog.showLiveWorkspaceNavigation` maps to the known locate
flow for the configured navigation root, module, and kind.  The older
`runDiagnosticsLive` and `runNavigationLive` command IDs remain
experimental opt-in aliases for now.  A controlled tiny fixture workspace
lives at `test/fixtures/live-workspace`; the opt-in runtime smoke uses
that fixture only and does not scan a user workspace.  The runtime smoke
now covers live diagnostics and live navigation against that fixture; live
navigation returns Location-style data and avoids QuickPick dialogs in the
smoke path.

## Command Facade

`bin/pccx-vscode-prototype.mjs` is a local command facade for the same
prototype translation layer.  It emits JSON only and requires callers to
choose an explicit mode:

```bash
node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs diagnostics \
  --mode example --source check-missing-endmodule

node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs diagnostics \
  --mode live --from-check fixtures/missing_endmodule.sv

node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs navigation \
  --mode example --source declarations

node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs navigation \
  --mode live --locate fixtures/modules pkg_defs --kind package
```

The facade supports checked-example mode and live CLI mode for known
flows only.  It does not silently fall back between modes, does not use
shell interpolation, and does not accept arbitrary command strings.

## Extension Package Scaffold

`package.json`, `src/extension.cjs`, and `src/extension.mjs` define a
minimal experimental local
VS Code extension scaffold.  The package is `private`, has version
`0.0.0`, and intentionally has no publisher, runtime dependencies,
bundler, `vsce`, or marketplace publishing script.  The only npm
dependency is the exact dev dependency `@vscode/test-electron@2.5.2` for
the guarded local Extension Host smoke.  `src/extension.cjs` is only the
VS Code manifest wrapper; the implementation stays in `src/extension.mjs`.

The contributed commands are:

- `pccxSystemVerilog.publishCheckedExampleDiagnostics`
- `pccxSystemVerilog.showCheckedExampleNavigation`
- `pccxSystemVerilog.publishLiveWorkspaceDiagnostics`
- `pccxSystemVerilog.showLiveWorkspaceNavigation`
- `pccxSystemVerilog.showDiagnosticsExample`
- `pccxSystemVerilog.showNavigationExample`
- `pccxSystemVerilog.runDiagnosticsLive`
- `pccxSystemVerilog.runNavigationLive`
- `pccxSystemVerilog.showWorkflowBoundaryStatus`
- `pccxSystemVerilog.buildWorkflowContextBundle`
- `pccxSystemVerilog.proposeValidationCommand`
- `pccxSystemVerilog.runApprovedValidationCommand`
- `pccxSystemVerilog.showRecentValidationResults`
- `pccxSystemVerilog.showValidationCacheStatus`
- `pccxSystemVerilog.clearValidationResultCache`
- `pccxSystemVerilog.showPatchProposalPreview`
- `pccxSystemVerilog.clearPatchProposalPreview`
- `pccxSystemVerilog.showLocalWorkflowStatus`
- `pccxSystemVerilog.showContextBundleAudit`
- `pccxSystemVerilog.showPccxLabBackendStatus`
- `pccxSystemVerilog.showDiagnosticsHandoffSummary`

The contributed color theme is:

- `pccx SystemVerilog Light`

The extension icon is `assets/logo/aperture-mark-128.png`, with source
SVG logo assets retained under `assets/logo/`.  The copied-asset notice is
tracked in `assets/PCCX_UI_NOTICE.md`.

The prototype-only settings are:

- `pccxSystemVerilog.mode`, default `checkedExample`
- `pccxSystemVerilog.liveWorkspace.enabled`, default `false`
- `pccxSystemVerilog.pccxLab.command`, default `pccx_ide_cli`
- `pccxSystemVerilog.workflowBoundary.enabled`, default `false`
- `pccxSystemVerilog.workflowBoundary.backend`, default `none`
- `pccxSystemVerilog.validationRunner.enabled`, default `false`
- `pccxSystemVerilog.validationRunner.mode`, default `disabled`
- `pccxSystemVerilog.validationRunner.defaultWorkingDirectory`, default `repo-root`
- `pccxSystemVerilog.validationRunner.maxOutputLines`, default `120`
- `pccxSystemVerilog.validationRunner.timeoutMs`, default `30000`
- `pccxSystemVerilog.pythonPath`, default `python3`
- `pccxSystemVerilog.defaultSource`, default `fixtures/missing_endmodule.sv`
- `pccxSystemVerilog.defaultLog`, default `fixtures/xsim/mixed.log`
- `pccxSystemVerilog.defaultNavigationRoot`, default `fixtures/modules`
- `pccxSystemVerilog.defaultModule`, default `simple_mod`
- `pccxSystemVerilog.defaultDeclarationKind`, default `module`

The default diagnostics publishing command is
`pccxSystemVerilog.publishCheckedExampleDiagnostics`.  It is experimental
and always uses the checked `check-missing-endmodule` example through the
facade boundary.  The checked-example navigation command is
`pccxSystemVerilog.showCheckedExampleNavigation`.  It is experimental,
command-first navigation, and always uses
`navigation --mode example --source declarations` through the facade
boundary.  It maps the checked declaration records into VS Code
`Uri`/`Range`/`Location`-style records and returns them to callers; it
has no LSP provider yet.  The explicit example commands always build
checked-example facade arguments, and the explicit live commands always
build known live facade arguments.  Live diagnostics uses
`--from-check <defaultSource>`.  Live navigation uses
`--locate <defaultNavigationRoot> <defaultModule> --kind <defaultDeclarationKind>`.
Live mode remains separate and explicit; the extension does not silently
fall back between live and checked-example modes.

The command handlers are thin wrappers around the local facade.  They
normalize the prototype-only settings, build known facade argument arrays,
and run `bin/pccx-vscode-prototype.mjs`; they do not call `pccx_ide_cli`
directly from the extension entry point, do not invoke raw shell command
strings, and do not accept arbitrary command execution.  Live mode calls
only known facade flows.  Live paths are still prototype-only and are
passed to known facade flows as argument-array entries.

`pccxSystemVerilog.showPccxLabBackendStatus` prepares a command palette
status surface for future pccx-lab integration.  It returns the configured
`pccxSystemVerilog.pccxLab.command` value, marks the integration as a
placeholder/status-only boundary, lists future controlled operations such
as diagnostics, index, locate, declarations, xsim-log analysis, and
validation summary, lists required future safety properties such as fixed
args, no shell interpolation, explicit user approval, bounded output, and
context bundle summary, and does not execute pccx-lab.

`src/diagnostics-handoff-consumer.mjs` is a read-only adapter for the
launcher diagnostics handoff JSON shape.  It validates the checked
`pccx.diagnosticsHandoff.v0` fixture as data and returns a deterministic
summary for future UI use.  It does not invoke `pccx-llm-launcher`, does
not invoke `pccx-lab`, does not run the pccx-lab validator command, does
not spawn shell commands, and does not implement MCP or LSP.  The boundary
is documented in
[`docs/diagnostics-handoff-consumer.md`](./docs/diagnostics-handoff-consumer.md).

`src/diagnostics-handoff-status-surface.mjs` and
`pccxSystemVerilog.showDiagnosticsHandoffSummary` expose that existing
consumer summary as a small local status surface.  The command consumes
adapter output as data, writes a deterministic summary to the prototype
output channel, and returns JSON for tests or future UI code.  It does not
read raw handoff JSON in the UI layer, does not invoke launcher or
pccx-lab, does not run the pccx-lab validator command, and does not add
provider, runtime, MCP, LSP, telemetry, upload, or marketplace behavior.

`src/runtime-readiness-consumer.mjs` is a read-only adapter for the
launcher runtime readiness JSON shape. It validates the checked
`pccx.runtimeReadiness.v0` Gemma 3N E4B plus KV260 fixture as data and
returns a deterministic bounded summary. The current consumed answer is
`blocked_not_yet_evidence_backed`: timing, implementation, bitstream,
KV260 smoke, runtime evidence, and measured throughput remain unavailable
or blocked, while throughput is target-only.

`src/runtime-readiness-status-surface.mjs` exposes that consumer summary
as local status data. The context bundle can include the same summary
when a readiness status surface or consumer summary is supplied. It
records the readiness/evidence states, target model/device, timing,
bitstream, implementation, KV260 smoke, runtime evidence, throughput,
bounded blockers, and read-only safety flags. Missing or invalid
readiness data stays unavailable or invalid context. This path does not
execute launcher, pccx-lab, FPGA repository access, KV260 runtime, model
weight loading, provider calls, MCP, LSP, marketplace, telemetry, upload,
or write-back behavior. The boundary notes are tracked in
[`docs/runtime-readiness-consumer.md`](./docs/runtime-readiness-consumer.md).

`src/device-session-status-consumer.mjs` is a read-only adapter for the
launcher device/session status JSON shape. It validates the checked
`pccx.deviceSessionStatus.v0` Gemma 3N E4B plus KV260 fixture as data and
returns a deterministic bounded summary. The current consumed answer is
`device_session_status_placeholder_blocked`: connection, discovery,
authentication, model load, session activity, log stream, diagnostics,
and runtime readiness remain placeholder, inactive, not configured, or
blocked status data.

`src/device-session-status-surface.mjs` exposes that consumer summary as
local status data. The context bundle can include the same summary when a
device/session status surface or consumer summary is supplied. It records
target model/device, connection state, discovery state, authentication
state, runtime state, model load state, session state, log stream state,
diagnostics state, readiness state, status-panel rows, counts, pccx-lab
diagnostics placeholder state, and read-only safety flags. Missing or
invalid status data stays unavailable or invalid context. This path does
not execute launcher, pccx-lab, validator, serial, network, SSH, hardware,
KV260 runtime, model weight loading, provider calls, MCP, LSP,
marketplace, telemetry, upload, or write-back behavior.

`src/command-handlers.mjs` is the experimental local command-handler
scaffold.  It maps command ID -> normalized prototype settings -> known
facade argument array -> facade JSON result -> testable UI action model.
Diagnostics facade payloads become `{ kind: "diagnostics", diagnostics,
summary }` actions, and navigation facade payloads become
`{ kind: "navigation", items, summary }` actions.  Tests use injected and
mocked VS Code-like dependencies such as `runFacade`, `updateDiagnostics`,
and `showNavigationItems` for static coverage.

`src/definition-provider.mjs` is the first experimental VS Code-native
provider smoke.  It registers a minimal `DefinitionProvider` for
SystemVerilog-like file documents and reuses the same checked-example
navigation facade boundary used by
`pccxSystemVerilog.showCheckedExampleNavigation`.  The provider returns
VS Code `Location` results mapped from
`navigation --mode example --source declarations`; it does not implement
LSP, does not scan the live workspace by default, and does not silently
switch modes.  It also does not call provider/runtimes, pccx-llm-launcher, or
chat services.  Semantic cursor and symbol resolution are not complete
in this phase, so the provider may ignore the cursor position and return
the checked-example declaration location.  Live navigation remains an
explicit and separate command path.

`src/presenter.mjs` is the experimental local presenter scaffold.  It
consumes command-handler UI actions and maps diagnostics/navigation
actions to mocked VS Code-like APIs.  Diagnostics presentation groups
records by file for a `DiagnosticCollection`-like dependency, and
navigation presentation creates deterministic QuickPick-like items.
The opt-in Extension Host runtime smoke additionally verifies that the
checked-example diagnostics command publishes at least one real VS Code
diagnostic with URI, range, severity, message, and source fields through
a `DiagnosticCollection`, and that the checked-example navigation
command returns at least one Location-style record with URI, range,
symbol, target kind, and source fields.  The same opt-in smoke opens the
controlled fixture workspace and executes `vscode.executeDefinitionProvider`
to verify that the experimental VS Code-native `DefinitionProvider`
returns at least one `Location` with sane URI and range fields.  A guarded
local-only Extension Host runtime smoke exists at
`scripts/vscode-extension-host-smoke.sh`, but it exits 2 by default and
only runs when `PCCX_RUN_EXTENSION_HOST_SMOKE=1` is set.  The runtime
smoke loads the local extension package, verifies activation/command
registration, confirms live workspace commands fail clearly while
disabled, runs live diagnostics against the controlled fixture only, and
executes live navigation against the same fixture without QuickPick
blocking.  It also executes the checked-example diagnostics/navigation
command paths plus the provider-boundary smoke.  It checks the workflow boundary status
command, selected-symbol context bundle command, validation command
proposal, disabled approved validation runner behavior, one explicit
allowlisted validation run, validation summary handoff into the context
bundle, local validation-result cache commands, and pccx-lab
backend status command without provider/runtime calls.  It does not
package the extension, add an LSP provider, or install through a
marketplace flow.  Extension Host gates are
tracked in
[`docs/EXTENSION_HOST_READINESS.md`](./docs/EXTENSION_HOST_READINESS.md).

## Workflow Boundary and Context Bundle

`src/workflow-boundary.mjs` models a future local workflow
mode as proposals only.  `pccxSystemVerilog.showWorkflowBoundaryStatus`
returns the local status, configured backend, and proposal boundaries.
Allowed proposal kinds are `explainDiagnostics`, `proposePatch`,
`proposeValidationCommand`, `summarizeLog`, `askForMoreContext`, and
`openRelatedSymbol`.  Direct `writeFile`, `commit`, `push`, `merge`,
`release`, `tag`, `changeRuleset`, `accessSecrets`, and `accessStaging`
actions are disallowed.  User approval remains required before any patch,
validation command, or commit is executed outside this proposal boundary.

`src/context-bundle.mjs` is a token-saving context bundle contract for
future SystemVerilog workflow boundary experiments.
`pccxSystemVerilog.buildWorkflowContextBundle` returns a bounded JSON object
for the active editor state without calling a provider.  It prefers the
current file path, selected range, bounded lexical selected-symbol
context, active diagnostics near the selection, recent navigation
references, recent command status, current mode/configuration, and small
bounded snippets only for explicit selections.  It can also include the
latest approved validation runner cache summary and a small bounded
recent validation history: proposal ID, status, allowlist label, exit
code, duration/timestamps, working-directory kind, command kind, bounded
stdout/stderr summaries, truncation/redaction flags, failure hints, and
safety metadata.  It does not include full logs, raw shell command
strings, raw absolute private paths, build artifacts, or bulk file
content.  The bundle can also include the diagnostics handoff summary
section from `src/diagnostics-handoff-status-surface.mjs` as read-only
adapter data.  That section carries counts, descriptor references,
transport kinds, and safety flags only; missing or invalid handoff data is
reported as unavailable/invalid context and does not trigger launcher,
pccx-lab, validator, shell, provider, runtime, MCP, LSP, telemetry,
upload, or write-back behavior.  The selected-symbol
context extracts simple SystemVerilog-like lexical cues such as the symbol
text, current line, and nearby module/package/interface/parameter/function
or task declaration; it is not full semantic analysis.  The bundle
references files by path/range instead of including whole workspaces,
excludes dependency caches, test runtime directories, lockfiles,
agent instruction files, binary-like content, and internal instruction
paths, and redacts secret-like assignment lines.  This is a
JSON contract only: no provider/runtime calls, no
pccx-llm-launcher runtime calls yet, no MCP server implementation, no
direct file modification, and no stable API claim.
The boundary notes are tracked in
[`docs/LIVE_WORKSPACE_BOUNDARY.md`](./docs/LIVE_WORKSPACE_BOUNDARY.md).

`src/patch-proposal-contract.mjs` defines a provider-free patch proposal
contract for future user-reviewed edits.  The contract accepts only
repository-relative paths, bounded hunk previews, bounded rationale and
validation plan text, explicit risk level, and `requiresUserReview=true`.
It rejects private paths, secret-like assignments, shell commands,
build artifacts, model files, raw provider output, unknown command
fields, and auto-apply flags.  It does not apply patches, write files,
execute validation, call pccx-lab, call pccx-llm-launcher, call provider/runtime services
provider, implement MCP, implement LSP, package the extension, create a
release, or create a tag.  The contract notes are tracked in
[`docs/patch-proposal-contract.md`](./docs/patch-proposal-contract.md).
`pccxSystemVerilog.showPatchProposalPreview` previews checked patch
proposals through VS Code-native output without applying changes, and
`pccxSystemVerilog.clearPatchProposalPreview` clears only the in-memory
preview state.

`src/validation-patch-handoff.mjs` maps failed or blocked validation
summaries into bounded patch proposal context seeds.  Passing validation
summaries produce no seed.  The helper carries proposal ID, status,
bounded failure summary, related diagnostics, candidate file paths, and a
suggested approved validation plan without full logs, private paths,
build artifacts, shell commands, patch creation, or patch
application.  The handoff notes are tracked in
[`docs/validation-patch-handoff.md`](./docs/validation-patch-handoff.md).

`src/pccx-lab-command-descriptor.mjs` defines a data-only pccx-lab command
descriptor contract.  The checked descriptor is `labStatus` with
`executionState: "future"`, fixed empty args, explicit approval required,
and bounded output policy.  The contract rejects raw command strings,
unsafe args, private paths, secrets, and output policies that do not redact
or drop private paths.  It does not execute pccx-lab.  The boundary notes
are tracked in
[`docs/pccx-lab-command-boundary.md`](./docs/pccx-lab-command-boundary.md).

`src/launcher-status-contract.mjs` defines a status-only launcher
integration contract for future pccx-llm-launcher work.  The default
status is fixture-only and future-state, uses a deterministic timestamp,
and rejects secrets, private paths, model artifacts, board logs, and board
performance claims.  It does not call the launcher or communicate with a
device.  The boundary notes are tracked in
[`docs/launcher-integration-boundary.md`](./docs/launcher-integration-boundary.md).

`src/local-workflow-status.mjs` summarizes local prototype state for
`pccxSystemVerilog.showLocalWorkflowStatus`: extension mode, live workspace
gate, validation runner state, recent validation cache status, pccx-lab
descriptor state, launcher fixture state, and a bounded context item count.
It uses local/fixture data only and does not execute pccx-lab, call the
launcher, call providers, implement MCP, implement LSP, or package the
extension.

`src/context-bundle-audit.mjs` reports approximate context bundle size,
diagnostic/snippet/validation summary counts, redaction/truncation flags,
and excluded categories for `pccxSystemVerilog.showContextBundleAudit`.
The audit is local-only, summary-only, and does not upload context or call
providers.

`pccxSystemVerilog.proposeValidationCommand` returns allowlisted
validation command proposals as JSON data.  The proposal includes
allowlisted proposal IDs, argument-array templates, reasons, risk levels, and
explicit user approval requirements.  It can also include experimental
local diagnostics handoff preflight context derived from the normalized
context-bundle `diagnosticsHandoff` section.  That context reports
available, unavailable, or invalid handoff status and bounded notes for UI
display.  It does not parse raw handoff JSON in the proposal layer, spawn
a process, call pccx-lab, call provider/runtime services, write files, or run git
operations.

`pccxSystemVerilog.auditValidationProposalPreflight` is a review-only
preflight audit between proposal display and the approved runner handoff.
It accepts a proposal ID or checked proposal-shaped data, re-resolves the
existing proposal allowlist, and returns bounded JSON/text explaining
whether the proposal is eligible for the existing approved runner path.
It checks for missing or unknown IDs, malformed command shape, raw shell
strings, launcher commands, pccx-lab commands, pccx-lab diagnostics
handoff validator invocation, provider/runtime/KV260/MCP/LSP/marketplace
execution wording, and diagnostics handoff data appearing as execution
input.  The audit does not execute commands and does not broaden the
runner allowlist.

`pccxSystemVerilog.runApprovedValidationCommand` is a separate approved
validation runner boundary.  It is disabled by default; execution requires
`pccxSystemVerilog.validationRunner.enabled=true` and
`pccxSystemVerilog.validationRunner.mode=allowlisted`.  The command
accepts proposal IDs only, not raw command strings, and re-resolves those
IDs through the internal allowlist and preflight audit before execution.
Initial runnable IDs
are `vscodeAdapterSmoke`, `editorBridgeSmoke`, `exampleDriftCheck`, and
`pytestBaseline`.  `extensionHostSmokeOptIn` remains proposal-only from
inside the runner.  The runner uses fixed executable and argument arrays
with `shell=false`, enforces a timeout, bounds stdout/stderr summaries,
and returns JSON with safety metadata.  The runner does not add a UI
approval dialog in this prototype; callers should invoke it only after a
user-approved validation proposal.  It does not execute destructive
commands, git write operations, release/tag/settings/secrets commands,
patch proposals, provider/runtime calls, pccx-llm-launcher runtime calls, MCP
server operations, or pccx-lab commands.

Approved validation summaries are cached in memory only and kept brief.
The cache stores summary-only, redacted entries for recent runner results;
it does not persist to disk and does not store full stdout/stderr logs,
secrets, tokens, private home paths, raw command strings, artifact blobs,
model paths, or pccx-lab outputs.  `pccxSystemVerilog.showRecentValidationResults`
shows the small recent cache through VS Code-native surfaces, and
`pccxSystemVerilog.showValidationCacheStatus` reports the cache count,
max size, latest status, and redaction/truncation flags through a
summary-only validation output channel.
`pccxSystemVerilog.clearValidationResultCache` clears the in-memory cache.
This cache boundary does not add provider/runtime calls, MCP, LSP, marketplace
packaging, pccx-llm-launcher calls, real pccx-lab execution, releases, or
tags.

## Theme-Neutral Presentation Boundary

`src/presentation-boundary.mjs` defines the first theme-neutral
presentation boundary for editor-facing records.  Diagnostics and command
output carry semantic fields such as file, range, severity, message, and
source; they do not carry editor colors or style constants.  The VS Code
path uses native `DiagnosticSeverity` and `DiagnosticCollection` APIs.

The current policy is host theme first.  Future UI or webview surfaces
should use host theme tokens or explicit user-provided theme tokens.
VS Code, Xcode, and JetBrains are future presentation preset families,
not implemented skins and not completion claims.  This is not a completed
custom theme system, and the current work is not a custom theme engine.

This scaffold is not LSP, not a full IDE replacement, not a stable
ABI/API, and has no marketplace packaging or published extension.
CI does not run the real Extension Host runtime smoke yet.

## Daily-Driver Roadmap

Now:

- checked-example diagnostics, navigation, and DefinitionProvider smoke
- explicit live workspace boundary with controlled fixture diagnostics
- fixture-backed live navigation smoke
- workflow boundary status command and bounded context bundle command
- selected-symbol context
- validation command proposal
- validation proposal preflight audit
- patch proposal contract
- disabled-by-default approved validation runner boundary
- recent validation summary and cache status command
- pccx-lab backend status command
- diagnostics handoff summary status command
- runtime readiness consumer and context status data
- device/session status consumer and context status data

Next:

- selected-symbol to declaration context through live navigation
- diagnostics-aware context builder
- patch proposal format
- pccx-lab command palette execution with allowlisted commands

Later:

- pccx-llm-launcher local workflow backend behind a reviewed contract
- MCP controlled tool boundary
- richer editor UI/panels
- optional theme presets through host/user theme tokens

## Prototype Daily-Driver Loop

1. Inspect checked-example or explicit live workspace diagnostics and navigation.
2. Build a selected-symbol workflow context bundle for the active editor state.
3. Propose a validation command as data with `pccxSystemVerilog.proposeValidationCommand`.
4. Audit the proposal handoff with `pccxSystemVerilog.auditValidationProposalPreflight`.
5. User approves an allowlisted validation proposal ID.
6. Run `pccxSystemVerilog.runApprovedValidationCommand` only after the runner is explicitly enabled.
7. Inspect the bounded validation cache status and feed the summary back into the context bundle.
8. Future local workflow mode can propose a patch or next validation step, but does not execute either directly.

## Local Smoke

```bash
node editors/vscode-prototype/test/adapter.test.mjs
node editors/vscode-prototype/test/cli-runner.test.mjs
node editors/vscode-prototype/test/facade.test.mjs
node editors/vscode-prototype/test/extension-manifest.test.mjs
node editors/vscode-prototype/test/extension-config.test.mjs
node editors/vscode-prototype/test/context-bundle.test.mjs
node editors/vscode-prototype/test/selected-symbol-context.test.mjs
node editors/vscode-prototype/test/workflow-boundary.test.mjs
node editors/vscode-prototype/test/validation-proposals.test.mjs
node editors/vscode-prototype/test/validation-proposal-preflight-audit.test.mjs
node editors/vscode-prototype/test/patch-proposal-contract.test.mjs
node editors/vscode-prototype/test/patch-proposal-preview.test.mjs
node editors/vscode-prototype/test/validation-patch-handoff.test.mjs
node editors/vscode-prototype/test/pccx-lab-command-descriptor.test.mjs
node editors/vscode-prototype/test/launcher-status-contract.test.mjs
node editors/vscode-prototype/test/diagnostics-handoff-consumer.test.mjs
node editors/vscode-prototype/test/diagnostics-handoff-status-surface.test.mjs
node editors/vscode-prototype/test/runtime-readiness-consumer.test.mjs
node editors/vscode-prototype/test/runtime-readiness-status-surface.test.mjs
node editors/vscode-prototype/test/device-session-status-consumer.test.mjs
node editors/vscode-prototype/test/device-session-status-surface.test.mjs
node editors/vscode-prototype/test/local-workflow-status.test.mjs
node editors/vscode-prototype/test/context-bundle-audit.test.mjs
node editors/vscode-prototype/test/validation-result-summary.test.mjs
node editors/vscode-prototype/test/validation-result-cache.test.mjs
node editors/vscode-prototype/test/approved-validation-runner.test.mjs
node editors/vscode-prototype/test/static-boundary.test.mjs
node editors/vscode-prototype/test/extension-entrypoint.test.mjs
node editors/vscode-prototype/test/command-handlers.test.mjs
node editors/vscode-prototype/test/presenter.test.mjs
node editors/vscode-prototype/test/presentation-boundary.test.mjs
node editors/vscode-prototype/test/extension-host-readiness.test.mjs
bash scripts/vscode-adapter-smoke.sh
```

`scripts/vscode-extension-host-smoke.sh` is intentionally guarded.  By
default it exits with a clear not-enabled message and does not download
VS Code or Electron.  The enabled local path uses pinned
`@vscode/test-electron@2.5.2` and VS Code `1.90.2`; the first enabled run
downloads that VS Code build into `editors/vscode-prototype/.vscode-test`.

```bash
# Expected exit 2 unless the local runtime smoke is explicitly enabled.
bash scripts/vscode-extension-host-smoke.sh

# Opt-in local Extension Host runtime smoke.
npm ci --prefix editors/vscode-prototype
PCCX_RUN_EXTENSION_HOST_SMOKE=1 bash scripts/vscode-extension-host-smoke.sh
```

The adapter can also print translated examples:

```bash
node editors/vscode-prototype/src/adapter.mjs diagnostics \
  docs/examples/editor-bridge/problems-xsim-mixed.example.json

node editors/vscode-prototype/src/adapter.mjs navigation \
  docs/examples/editor-bridge/declarations.example.json
```
