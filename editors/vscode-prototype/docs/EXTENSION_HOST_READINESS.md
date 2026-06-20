# Extension Host Readiness

## Current Status

This is a local experimental VS Code extension scaffold.  It is not
published, has no marketplace packaging, is not LSP, and is not a stable ABI/API.

Feasibility decision for this phase: Option A, local-only.  A limited
Extension Host runtime smoke is enabled behind
`PCCX_RUN_EXTENSION_HOST_SMOKE=1` after adding the exact dev dependency
`@vscode/test-electron@2.5.2` and the built prototype package
lockfile.  CI remains limited to deterministic static/mock smoke coverage
because the runtime path downloads VS Code/Electron on first use and
should earn CI promotion separately.

## Tested Today

- Configuration helper defaults and validation.
- Explicit live workspace configuration guard:
  `checkedExample` remains the default, and live workspace commands
  require both `mode=liveWorkspace` and `liveWorkspace.enabled=true`.
- Known facade argument arrays.
- Command handlers and UI action models.
- workflow boundary status/context commands and token-saving context bundle
  unit tests.  The current workflow boundary work is boundary-only.
- Presenter behavior with mocked VS Code-like dependencies.
- Real VS Code `DiagnosticCollection` population for the checked-example
  diagnostics command when the local runtime smoke is explicitly enabled.
- Command-first navigation for
  `pccxSystemVerilog.showCheckedExampleNavigation`, returning checked
  example declaration records as VS Code `Uri`/`Range`/`Location`-style
  data when the local runtime smoke is explicitly enabled.
- Minimal VS Code-native `DefinitionProvider` registration for
  SystemVerilog-like file documents.  The provider uses checked-example
  navigation by default through the existing facade boundary and returns
  VS Code `Location` results in the opt-in runtime smoke.
- Checked editor bridge examples.
- Live CLI runner for known local JSON flows.
- Controlled live workspace fixture diagnostics in the opt-in Extension
  Host runtime smoke.
- Fixture-backed live navigation in the opt-in Extension Host runtime
  smoke, returning Location-style records without QuickPick/UI blocking.
- workflow boundary status and context bundle command smoke with provider and
  runtime calls reported as unimplemented.
- Selected-symbol context smoke for the context bundle.  The selected
  symbol context is lexical and bounded, not full semantic analysis.
- Diagnostics handoff summary context smoke.  The context bundle carries
  the existing adapter summary as bounded read-only context and does not
  execute launcher, pccx-lab, validator commands, shell commands,
  providers, MCP, or LSP.
- Validation command proposal smoke.  The command returns data only and
  does not execute validation commands.
- Approved validation runner smoke.  The command blocks by default,
  then runs one fast allowlisted proposal only after explicit test
  configuration and feeds a bounded validation summary into the context
  bundle.
- pccx-lab backend status smoke.  The command reports the configured
  boundary and does not execute pccx-lab.
- Diagnostics handoff summary status smoke.  The command reports the
  existing adapter summary as local data and does not execute launcher,
  pccx-lab, shell commands, providers, MCP, or LSP.
- Local synthesis plan smoke.  The command returns fixed `pccx synth
  --local` and `pccx deploy --target kv260` argument arrays for the CLI
  boundary and does not execute vendor tools.
- Guard behavior for the local-only Extension Host runtime smoke.
- Pinned Extension Host activation and command-registration smoke when
  explicitly enabled locally.

## Not Tested Today

- Real QuickPick.
- Complete semantic cursor/symbol resolution.
- LSP provider registration.
- Packaging.
- `vsce`.
- Marketplace install.
- Enabled live workspace scanning, watchers, check-on-save, or arbitrary
  project indexing.
- provider/runtime calls, pccx-launcher runtime calls, chat backend
  calls, or MCP server implementation.

The runtime smoke is limited coverage for the activation, command facade,
controlled fixture, context bundle, and VS Code-native provider boundary
only.  It is not a product claim and does not imply a published extension,
marketplace packaging, LSP support, complete semantic navigation, or a
stable ABI/API.

## Guarded Local Scaffold

`scripts/vscode-extension-host-smoke.sh` is a guarded local-only runtime
smoke.  By default it exits 2 with a not-enabled message and does not
download VS Code or Electron.

To run it locally:

```bash
npm ci --prefix editors/vscode-prototype
PCCX_RUN_EXTENSION_HOST_SMOKE=1 bash scripts/vscode-extension-host-smoke.sh
```

The runner lives under `editors/vscode-prototype/test/extension-host/`.
It uses `@vscode/test-electron@2.5.2`, pins VS Code to `1.90.2`, opens
`test/fixtures/live-workspace`, loads the local extension package,
verifies the expected command IDs, checks that live diagnostics and
navigation fail clearly while live workspace is disabled, and executes
the checked-example diagnostics/navigation command paths.  The
diagnostics command uses checked example diagnostics by default, goes
through the facade boundary, and verifies that VS Code receives at least
one diagnostic with URI, range, severity, message, and source fields.
The navigation command uses checked example mode by default through
`navigation --mode example --source declarations`; it returns
Location-style records with URI, range, symbol, target kind, and source
fields.  The same smoke opens a fixture SystemVerilog document and
executes `vscode.executeDefinitionProvider` to verify that the
experimental VS Code-native `DefinitionProvider` returns at least one
`Location` with sane URI and range fields.  The provider currently reuses
the checked-example declaration result and does not complete semantic
cursor/symbol resolution.

The enabled live path is limited to the controlled fixture.  The smoke
explicitly sets `mode=liveWorkspace` and `liveWorkspace.enabled=true`,
runs `pccxSystemVerilog.publishLiveWorkspaceDiagnostics` against
`broken_missing_endmodule.sv`, and asserts the returned diagnostics came
from that fixture rather than checked examples.  It also runs
`pccxSystemVerilog.showLiveWorkspaceNavigation` with the fixture as the
navigation root and `live_top` as the requested module, verifies
Location-style records, and checks that the result did not fall back to
checked-example symbols.  It executes
`pccxSystemVerilog.showWorkflowBoundaryStatus`,
`pccxSystemVerilog.buildWorkflowContextBundle`,
`pccxSystemVerilog.proposeValidationCommand`, and
`pccxSystemVerilog.auditValidationProposalPreflight`,
`pccxSystemVerilog.runApprovedValidationCommand`,
`pccxSystemVerilog.showRecentValidationResults`,
`pccxSystemVerilog.showValidationCacheStatus`,
`pccxSystemVerilog.clearValidationResultCache`, and
`pccxSystemVerilog.showPccxLabBackendStatus`,
`pccxSystemVerilog.showDiagnosticsHandoffSummary`,
`pccxSystemVerilog.showAssistStatus`, and
`pccxSystemVerilog.prepareSimulationHandoff`, verifying
disabled/backend `none` status, proposal-only actions, validation
proposal preflight audit data, disabled runner blocking behavior, one
explicitly enabled allowlisted validation run, bounded active-file and
selected-symbol context, bounded validation-result cache summary handoff,
status-only pccx-lab boundary data, diagnostics handoff summary data,
pre-stable stdio language-server adapter status, data-only simulation
handoff status, and no provider/runtime calls.

## Workflow Boundary

The prototype has a future SystemVerilog workflow boundary
boundary, not a model integration.  pccx-launcher is a future local LLM/chat backend candidate, and any later integration must use a reviewed
contract.  The current extension code makes no provider/runtime calls, no
pccx-launcher runtime calls, and implements no MCP server. Workflow
actions are modeled as proposals, including command proposal and
validation proposal shapes, plus a checked patch proposal contract for
future user-reviewed edits, rather than direct execution.  User approval
is still required before applying patches, running validation commands,
or committing changes.
`pccxSystemVerilog.showPatchProposalPreview` previews checked proposal IDs
only, and `pccxSystemVerilog.clearPatchProposalPreview` clears the
in-memory preview state without file writes.
The validation-to-patch handoff helper is a bounded context seed only; it
does not generate a patch for passing validation results and does not
apply changes.
The pccx-lab command descriptor contract is data-only future-state
preparation and does not execute pccx-lab.
The launcher status contract is fixture-only future-state metadata and
does not call pccx-launcher or communicate with devices.
`pccxSystemVerilog.showLocalWorkflowStatus` summarizes local/fixture
workflow state without pccx-lab execution, launcher calls, provider calls,
MCP, or LSP.
`pccxSystemVerilog.showContextBundleAudit` reports local context bundle
size and safety metadata without uploading context or calling providers.
`pccxSystemVerilog.showDiagnosticsHandoffSummary` reports the checked
diagnostics handoff adapter summary as a local status surface. It consumes
adapter output as data, does not read raw handoff JSON in the UI layer,
does not execute launcher or pccx-lab, and does not invoke the pccx-lab
validator command.
The same summary can flow into `pccxSystemVerilog.buildWorkflowContextBundle`
as a bounded `diagnosticsHandoff` context section. Missing or invalid
handoff data is kept as local unavailable/invalid context and does not
start a backend command.

`pccxSystemVerilog.proposeValidationCommand` currently proposes only
allowlisted templates, including the VS Code adapter smoke, editor bridge
smoke, example drift check, pytest baseline, and opt-in Extension Host
smoke.  The command returns JSON data with reasons, risk levels, a
required user approval marker, and optional diagnostics handoff preflight
context from the normalized context bundle section.  It reports handoff
context as available, unavailable, or invalid with bounded notes; it does
not parse raw handoff JSON in the proposal layer or execute the command.

`pccxSystemVerilog.runApprovedValidationCommand` is a separate approved
validation runner.  It is disabled unless
`validationRunner.enabled=true` and `validationRunner.mode=allowlisted`
are set.  It accepts proposal IDs only and executes only fixed
allowlisted command/argument arrays.  Output is bounded and summarized
for a small in-memory validation-result cache and token-saving context
bundles.  `pccxSystemVerilog.showRecentValidationResults` shows cached
summary-only entries through VS Code-native surfaces, and
`pccxSystemVerilog.showValidationCacheStatus` reports summary-only cache
count, max size, latest status, and redaction/truncation flags.
`pccxSystemVerilog.clearValidationResultCache` clears that local cache.
The cache does not persist to disk and does not store full logs, raw
shell command strings, secrets, tokens, private home paths, build
blobs, model paths, or pccx-lab outputs.  It does not execute raw command
strings, destructive commands, git write operations,
release/tag/settings/secrets commands, pccx-lab commands, provider/runtime calls,
pccx-launcher runtime calls, MCP server operations, LSP, marketplace
packaging, releases, or tags.  It does not add a UI approval dialog in
this prototype; callers should invoke it only after a user-approved
validation proposal.

`pccxSystemVerilog.showPccxLabBackendStatus` is preparation for future
command palette integration.  It reports the configured
`pccxSystemVerilog.pccxLab.command`, lists future controlled operations
such as diagnostics, index, locate, declarations, xsim-log analysis, and
validation summary, lists future safety requirements such as fixed args,
no shell interpolation, explicit user approval, bounded output, and
context bundle summary, and does not execute pccx-lab.

The guarded script is not run by CI today.

## Theme Boundary

The current presentation boundary is intentionally small and
theme-neutral.  Diagnostic records and command output do not carry
hardcoded editor colors or styles; VS Code diagnostics use native
severity and `DiagnosticCollection` APIs.  Future UI or webview surfaces
should use host theme tokens first, with explicit user-provided theme
tokens as the customization path.

VS Code, Xcode, and JetBrains are future presentation preset families.
They are not implemented skins and do not imply a completed custom theme
system.

## Dependency and CI Policy

- The prototype package has one exact dev dependency:
  `@vscode/test-electron@2.5.2`.
- `editors/vscode-prototype/package-lock.json` is managed by npm and
  keeps the runtime smoke dependency graph reviewable.
- There is no root lockfile, publisher metadata, `vsce`, packaging
  script, marketplace flow, LSP server, or stable ABI/API claim.
- CI keeps running the static/mock VS Code adapter smoke only.
- CI promotion for the runtime smoke requires a separate stability review
  because the first enabled run downloads VS Code/Electron.
- Theme handling remains host theme first.  Future visual presets can be
  added through host theme tokens or explicit user-provided theme tokens;
  the current work is not a completed custom theme system or custom theme
  engine.

## Next Gates

1. Keep the facade boundary.
2. Do not call `pccx_ide_cli` directly from activation.
3. Keep runtime live CLI coverage limited to the controlled fixture until
   broader live workspace behavior has separate evidence.
4. Keep the VS Code-native `DefinitionProvider` separate from any LSP
   implementation.
5. Promote the runtime smoke to CI only after separate stability evidence.
6. Do not add `vsce`, publisher metadata, packaging scripts, LSP, or
   marketplace flow.
7. Do not make a marketplace, published-extension, or stable API claim.
8. Do not make live workspace mode the default.
9. Do not add provider/runtime calls, pccx-launcher runtime calls, or MCP
   server implementation without a separate contract review.
10. Keep approved validation execution disabled by default and restricted
    to allowlisted proposal IDs.
