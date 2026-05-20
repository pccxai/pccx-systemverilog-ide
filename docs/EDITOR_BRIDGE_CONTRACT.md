# Editor Bridge Contract

## Status

This is an early, pre-stable CLI contract for external editor bridges.
It is not an LSP server, a published VS Code extension, a JetBrains
plugin, or a stable ABI/API.  Treat all JSON shapes as subject to change
while the `pccx-lab` boundary and IDE surface mature.

The later-track VS Code, JetBrains, and generic editor bridge direction is
tracked in
[`EXTERNAL_EDITOR_INTEGRATION_PLAN.md`](./EXTERNAL_EDITOR_INTEGRATION_PLAN.md).

## Intended Consumers

- The experimental local VS Code extension scaffold.
- Future VS Code extension work.
- Future JetBrains or other editor bridges.
- Local scripts that need deterministic JSON.
- CI or headless checks that need diagnostics, problem lists, or module
  navigation records.

## Core Flows

For tool integrations, prefer JSON output:

```bash
# File diagnostics as editor problems
python -m pccx_ide_cli problems from-check <sv-file> --format json

# Existing xsim-style log diagnostics as editor problems
python -m pccx_ide_cli problems from-xsim-log <log-file> --format json

# Declaration index for project/file navigation
python -m pccx_ide_cli index <path> --format json

# Direct declaration export for editor navigation
python -m pccx_ide_cli declarations <path> --format json

# Locate one declaration by exact name
python -m pccx_ide_cli locate <path> <name> --kind module --format json
python -m pccx_ide_cli locate <path> <name> --kind package --format json
python -m pccx_ide_cli locate <path> <name> --kind interface --format json
python -m pccx_ide_cli locate <path> <name> --kind any --format json

# Module organization for editor project trees
python -m pccx_ide_cli organization <path> --format json
python -m pccx_ide_cli boundary-audit <path> --format json
python -m pccx_ide_cli module-duplicates <path> --format json
python -m pccx_ide_cli refactor-readiness <path> --format json
python -m pccx_ide_cli hierarchy <path> --format json
python -m pccx_ide_cli dependencies <path> --format json
python -m pccx_ide_cli hierarchy-cycles <path> --format json
python -m pccx_ide_cli unresolved-instances <path> --format json
python -m pccx_ide_cli module-roots <path> --format json
python -m pccx_ide_cli module-leaves <path> --format json
python -m pccx_ide_cli module-orphans <path> --format json
python -m pccx_ide_cli module-depths <path> --format json
python -m pccx_ide_cli module-paths <path> --format json
python -m pccx_ide_cli module-edges <path> --format json
python -m pccx_ide_cli module-reachability <path> --format json
python -m pccx_ide_cli module-order <path> --format json
python -m pccx_ide_cli module-fanout <path> --format json
python -m pccx_ide_cli module-fanin <path> --format json
python -m pccx_ide_cli module-health <path> --format json
python -m pccx_ide_cli module-summary <path> --format json
python -m pccx_ide_cli port-usage <path> --module <name> --format json
python -m pccx_ide_cli module-context <path> --module <name> --format json
python -m pccx_ide_cli refactor-impact <path> --module <name> --format json
python -m pccx_ide_cli validation-plan <path> --action rename-module --module <name> --new-name <name> --format json
python -m pccx_ide_cli refactor-review <path> --action rename-module --module <name> --new-name <name> --format json
python -m pccx_ide_cli refactor-approval <path> --action rename-module --module <name> --new-name <name> --format json
python -m pccx_ide_cli refactor-application <path> --action rename-module --module <name> --new-name <name> --format json
python -m pccx_ide_cli refactor-result <path> --action rename-module --module <name> --new-name <name> --format json
python -m pccx_ide_cli refactor-handoff <path> --action rename-module --module <name> --new-name <name> --format json
python -m pccx_ide_cli refactor-checklist <path> --action rename-module --module <name> --new-name <name> --format json
python -m pccx_ide_cli refactor-session <path> --action rename-module --module <name> --new-name <name> --format json

# Opt-in pccx-lab diagnostics backend
python -m pccx_ide_cli check <sv-file> --backend pccx-lab --format json
```

## Output Handling Guidance

- Consume JSON for tools; text output is for humans.
- Preserve process exit codes.  For example, `locate` uses non-zero
  exits for no match or ambiguous matches.
- Do not silently fall back when an explicit backend is requested.  If
  `--backend pccx-lab` is configured and the binary is missing or
  returns invalid output, surface that failure.
- Treat all output shapes as pre-stable.  Bridge code should keep its
  adapter layer small and easy to update.

## Checked Examples

The pre-stable contract examples are checked in under
`docs/examples/editor-bridge`.  They are built from synthetic
fixtures and are intended as adapter guidance, not a stable ABI/API.
The example drift check is:

```bash
bash scripts/check-editor-bridge-examples.sh
```

The module locate example uses the single-file fixture so the sample is
unambiguous; the full fixture directory intentionally contains duplicate
module names for ambiguity tests.

## Experimental Adapter Prototype

`editors/vscode-prototype` contains a local VS Code-style adapter
prototype that consumes the checked JSON examples or limited live
`pccx_ide_cli` JSON flows and translates them into diagnostic and
navigation records.  Its local command facade requires explicit
checked-example or live mode selection and emits VS Code-style JSON for
known flows only.

The VS Code prototype is the editor cockpit over this contract.  It owns
command registration, presentation mapping, and the opt-in live workspace
command boundary.  It is not a second analysis backend, does not
duplicate pccx-lab internals, and does not implement a language server.
pccx-lab
remains the CLI-first verification/tooling backend for reusable analysis
and validation behavior.

Checked-example remains the default.  Live workspace mode is explicit
opt-in and requires both `pccxSystemVerilog.mode=liveWorkspace` and
`pccxSystemVerilog.liveWorkspace.enabled=true`; disabled live workspace
commands fail clearly instead of falling back to examples.  The current
SystemVerilog workflow boundary work is boundary-only:
workflow boundary status and context bundle commands expose local status,
bounded context, selected-symbol context, validation command proposal
data, disabled-by-default approved validation runner status/result data,
summary-only validation cache status, and proposal actions, with no provider/runtime
provider calls, no pccx-launcher runtime calls yet, and no MCP server
implementation.

The same directory now includes an experimental local VS Code extension
scaffold.  Its command handlers are thin wrappers around the local facade:
VS Code command -> prototype settings -> extension wrapper -> facade ->
JSON -> diagnostics/navigation records.  The prototype settings are
validated before command wiring and route only into known facade flows.
The command-handler scaffold converts facade JSON into testable UI action
models for diagnostics and navigation behind injected VS Code-like
dependencies.
The presenter scaffold maps those UI action models to mockable
DiagnosticCollection-like and QuickPick-like APIs without requiring real
VS Code GUI tests.  A limited opt-in Extension Host runtime smoke exists,
but it is disabled by default, remains local-only, and is not a product
claim.  When explicitly enabled, it opens the controlled
`editors/vscode-prototype/test/fixtures/live-workspace` fixture and runs
live diagnostics and live navigation only against that tiny fixture path.
Live navigation verifies `live_top` through the explicit live workspace
opt-in command path without falling back to checked examples.
The scaffold is not published, has no marketplace packaging, has a
pre-stable stdio language-server adapter, and is not a stable ABI/API.
Current coverage is mostly static/mock
tests and smoke tests; CI does not run the real Extension Host runtime
smoke yet.
The prototype documents the 1-based CLI position to 0-based editor
position conversion expected by editor adapters.

## Data Movement

The intended data path is explicit:

```text
SystemVerilog source or existing log file
  -> pccx_ide_cli command
  -> JSON output
  -> editor problem list or navigation entry

VS Code command
  -> prototype settings
  -> experimental extension wrapper
  -> local pccx-vscode-prototype facade
  -> JSON output
  -> testable diagnostics/navigation UI action
  -> mockable VS Code-like presenter
  -> diagnostics/navigation records
```

Future local workflow mode should use the same controlled data
path.  Context bundle records should carry selected file/range,
bounded lexical selected-symbol context, diagnostics, declaration
references, recent command status, current mode, validation summaries, and
bounded snippets by path/range instead of whole workspaces.  Any command
proposal or validation proposal must remain proposal-only until an
editor/user-controlled executor accepts an allowlisted proposal ID.
Validation proposal preflight audit sits before that approved runner
handoff and returns bounded status only: it checks proposal ID, fixed
command shape, existing allowlist membership, blocked launcher/pccx-lab
or shell paths, unsupported execution wording, and diagnostics handoff
context-only handling without executing commands.
Patch proposals are also contract-only: they may describe reviewed edits
with repository-relative paths and bounded hunk previews, but they do not
apply changes or execute commands.
Validation-to-patch handoff may create bounded context seeds from failed
validation summaries and related diagnostics, but it does not create patch
content for passing validation results and does not apply changes.
pccx-lab command descriptors are data-only preparation for a future
CLI/core boundary and do not execute pccx-lab.
Launcher status contracts are also status-only and do not call
pccx-launcher, include model paths, include board logs, or make device
performance claims.
Approved validation execution must use fixed argument arrays, bounded
output, an explicit user-approved command invocation, no shell
interpolation, and a passing preflight audit immediately before the
runner reaches execution.  pccx-lab command execution remains
future/prepared in this prototype.

`problems` converts local diagnostics and log records into editor-friendly
problem records.  `index` provides scanner-based module/package/interface
declaration records.  `declarations` exports those records directly, and
`locate` resolves exact declaration names by requested kind. `organization`
adds scanner-based module boundary spans, hierarchy edges, root candidates,
and proposal-only refactoring metadata for project tree and reviewed
refactoring workflows. `boundary-audit` emits read-only module boundary
completeness and refactor-readiness audit data from the same scanner output;
`refactor-readiness` summarizes that audit plus refactor-candidate counts for
editor status panes without selecting an action or emitting command argv. These
surfaces do not write files, apply refactors, generate patches, run validation,
invoke pccx-lab or the launcher, run vendor tools, call providers, touch
hardware, or perform automatic repository actions. `hierarchy`,
`dependencies`, `hierarchy-cycles`, `unresolved-instances`, `module-roots`,
`module-leaves`, `module-orphans`, `module-depths`, `module-paths`,
`module-edges`, `module-reachability`, `module-order`, `module-fanout`,
`module-fanin`,
`module-health`,
`module-summary`, `port-usage`, `module-context`, and `refactor-impact`
render focused read-only views from the same scanner data, including
hierarchy cycle warnings, unresolved instantiation warnings, root-candidate
summaries, leaf-candidate summaries, orphan-candidate summaries,
depth-level summaries,
hierarchy path reports, direct dependency edge reports, reachability reports,
dependency-first order reports, fanout rankings, fanin rankings,
module graph health summaries,
conservative module header/port summaries, target port usage summaries,
target module context bundles, and
target-specific refactor impact review data. The
organization surface is documented in
[`MODULE_ORGANIZATION_WORKFLOW.md`](./MODULE_ORGANIZATION_WORKFLOW.md).
`refactor-plan` extends the same boundary with proposal-only
rename-module, extract-port, and move-module planning envelopes. It emits
preflight metadata and review steps only; it does not apply edits, move
files, run validation, invoke pccx-lab or the launcher, call providers, touch
hardware, or perform automatic repository actions.
`validation-plan` emits proposal-only validation planning envelopes for those
refactor requests. It returns fixed argument-array command descriptors with
`proposed-not-run` state and explicit approval metadata; it does not execute
validation, run shell commands, apply edits, invoke pccx-lab or the launcher,
run vendor tools, call providers, touch hardware, or perform automatic
repository actions.
`refactor-review` emits a summary-only review packet over module context,
refactor proposal, and validation-plan metadata. It summarizes validation
descriptor phases and command IDs, but does not include command argv, execute
validation, run shell commands, apply edits, invoke pccx-lab or the launcher,
run vendor tools, call providers, touch hardware, or perform automatic
repository actions.
`refactor-approval` emits proposal-only approval decision metadata over the
review packet. It records an unapproved or blocked decision gate and summarizes
review and validation state without command argv; it does not grant approval,
execute validation, run shell commands, apply edits, write files, invoke
pccx-lab or the launcher, run vendor tools, call providers, touch hardware, or
perform automatic repository actions.
`refactor-application` emits proposal-only application request metadata over
the approval decision. It records a not-accepted or blocked application gate
with `accepted: false` and `applied: false`; it does not include command argv,
accept a write request, apply edits, execute validation, run shell commands,
write files, invoke pccx-lab or the launcher, run vendor tools, call providers,
touch hardware, or perform automatic repository actions.
`refactor-result` emits proposal-only application result metadata over the
application request. It records a not-applied or blocked result receipt with no
write attempt, no generated patch, no changed files, no validation run, and no
rollback requirement; it does not include command argv, accept a write request,
apply edits, execute validation, run shell commands, write files, invoke
pccx-lab or the launcher, run vendor tools, call providers, touch hardware, or
perform automatic repository actions.
`refactor-handoff` emits summary-only refactor handoff metadata over the
application result receipt. It records ready-for-review or blocked handoff
state with no public text publication, no pull request creation, no comment
writing, no project mutation, no write attempt, no generated patch, no changed
files, no validation run, and no rollback requirement; it does not include
command argv, accept a write request, apply edits, execute validation, run
shell commands, write files, invoke pccx-lab or the launcher, run vendor tools,
call providers, touch hardware, or perform automatic repository actions.
`refactor-checklist` emits summary-only checklist metadata over the refactor
handoff. It records preflight, context review, validation-plan review, approval
gate, application gate, and handoff review items without command argv; it does
not grant approval, accept application requests, apply edits, execute
validation, run shell commands, write files, publish public text, create pull
requests, write comments, mutate projects, invoke pccx-lab or the launcher,
run vendor tools, call providers, touch hardware, or perform automatic
repository actions.
`refactor-session` emits summary-only session status metadata over that
checklist. It records the current stage, checklist counts, incomplete required
items, and next required action without command argv, session persistence,
status writeback, notification dispatch, approval grants, application
acceptance, edits, validation, shell execution, public text publication, pull
request creation, comments, project mutation, pccx-lab or launcher invocation,
vendor tools, providers, hardware, or automatic repository actions.

For existing xsim logs, the VS Code prototype can consume the checked
`problems from-xsim-log` JSON as a read-only status/context summary.  The
summary carries problem counts by severity, located/unlocated counts,
relative file counts, and safety flags.  It does not read raw logs in
the UI layer, echo raw log lines into context bundles, run xsim or
Vivado, invoke pccx-lab or the launcher, touch hardware, implement an
MCP server, or bundle a language server.  The surface is documented in
`editors/vscode-prototype/docs/xsim-diagnostics-status-surface.md`.
The planning boundary for the shared diagnostic schema draft, read-only
xsim path, and text surface sketches is documented in
[`docs/DIAGNOSTICS_XSIM_INTEGRATION_PLAN.md`](./DIAGNOSTICS_XSIM_INTEGRATION_PLAN.md).

## Limitations

- Scanner-based scaffolds, not full SystemVerilog parsing.
- Module organization, boundary audits, header/port summaries, port usage
  summaries, refactor impact review, refactor planning, and validation planning
  are scanner-based; refactor review packets, approval decisions, application
  requests, application results, handoff summaries, and checklists are summary-only
  metadata over those
  surfaces. They are not semantic elaboration and do not apply refactors or
  execute validation.
- No bundled language server in this repository today; the VS Code
  scaffold can call a local `verible-verilog-ls` command over stdio.
- No published editor extension or marketplace packaging is implemented
  here.
- No VS Code GUI integration test in this repository today.
- No stable schema yet.
- No real xsim or Vivado execution.
- No hardware access or hardware correctness claim.
- No provider/runtime calls or local chat backend integration in this repo
  today.
- No MCP server implementation in this repo today.
- No pccx-launcher runtime call yet; future integration requires an
  explicit reviewed contract.
