# systemverilog-ide

SystemVerilog IDE layer for the PCCX tooling stack.

## What this repo is

The IDE-adjacent surface that is being **spun out of [pccx-lab][pccx-lab]**.
This is not a greenfield project — the initial code base traces back to
IDE-shaped work that already lives in `pccx-lab`. As that work matures
its CLI / core boundary, the IDE-side pieces will land here while
verification, trace analysis, and diagnostics remain in `pccx-lab`.

## Status

Public surface is intentionally minimal while the `pccx-lab` CLI / core
boundary is being stabilized. The IDE will follow that boundary; it does
not duplicate analysis logic locally.

Direction, source-header policy, and style preservation rules are pinned
in [`docs/PROJECT_DIRECTION_AND_STYLE.md`](./docs/PROJECT_DIRECTION_AND_STYLE.md).
New code files and changed legacy code files are expected to carry the
repository SPDX/Copyright header.

A one-page contributor orientation is available in
[`docs/WORKSPACE_ORIENTATION.md`](./docs/WORKSPACE_ORIENTATION.md).

The initial Now / Next / Later roadmap is tracked in
[`docs/ROADMAP.md`](./docs/ROADMAP.md).
The SystemVerilog workflow boundary is tracked in
[`docs/SYSTEMVERILOG_WORKFLOW_BOUNDARY.md`](./docs/SYSTEMVERILOG_WORKFLOW_BOUNDARY.md).
The evolutionary generate / simulate / evaluate / refine loop plan is
tracked in [`docs/EVOLUTIONARY_LOOP_PLAN.md`](./docs/EVOLUTIONARY_LOOP_PLAN.md).
The later-track external editor integration plan is tracked in
[`docs/EXTERNAL_EDITOR_INTEGRATION_PLAN.md`](./docs/EXTERNAL_EDITOR_INTEGRATION_PLAN.md).
The module organization workflow is tracked in
[`docs/MODULE_ORGANIZATION_WORKFLOW.md`](./docs/MODULE_ORGANIZATION_WORKFLOW.md).

## Integration model

`pccx-lab` is **CLI-first**. The IDE consumes the same CLI / core
contract that the lab CLI itself uses. VS Code extensions and other
integration surfaces ride on top of the same contract; they do not get a
private back channel into lab internals.

Development order is fixed:

1. CLI / core boundary first (in `pccx-lab`).
2. IDE GUI surface second (in this repo).
3. VS Code extension and controlled CLI/core boundary integrations on top.

If a feature would need a side channel that bypasses the CLI / core
contract, that is a signal the contract needs to grow first — not a
signal to add a back door from the GUI.

The current direction keeps this repository as a data-boundary-first
editor cockpit over pccx-lab and launcher contracts. It must not become a
launcher/lab execution island.

## Architecture roles

- `systemverilog-ide` is the editor cockpit: VS Code commands,
  presentation boundaries, opt-in live workspace command shape, and
  future context bundle construction.
- `pccx-lab` is the CLI-first verification/tooling backend. Reusable
  analysis and validation behavior should flow through the facade and
  CLI/core contract instead of being duplicated here.
- `pccx-llm-launcher` is a future local LLM/chat backend candidate for
  local workflow mode. This repository currently contains only
  boundary work for SystemVerilog workflow experiments: workflow boundary
  status/context commands, no provider/runtime calls,
  no pccx-llm-launcher runtime calls yet, and no MCP server implementation.

## Initial track (near-term)

- SystemVerilog navigation through the CLI/editor bridge boundary.
- Diagnostics surfaced from the same place the lab CLI surfaces them.
- Existing xsim log handoff through the CLI / core boundary; xsim run
  launching remains a planned integration path.
- Project-aware view of `pccx-lab` artifacts (traces, run reports,
  verification status).

## Current scaffold

The repository currently contains a placeholder Python CLI that emits
the **diagnostics envelope** the IDE expects to consume from
`pccx-lab`. The CLI does not perform real semantic analysis — its
checks are file-shape level only (file exists, file non-empty,
`module` / `endmodule` present). The envelope schema is the artifact
that matters; analysis arrives later, through `pccx-lab`.

```bash
# Diagnostics check — JSON output (default)
python -m pccx_ide_cli check fixtures/ok_module.sv
python -m pccx_ide_cli check fixtures/missing_endmodule.sv

# Diagnostics check — human-readable text output
python -m pccx_ide_cli check fixtures/ok_module.sv --format text
python -m pccx_ide_cli check fixtures/missing_endmodule.sv --format text

# Diagnostics check — pccx-lab backend (requires binary)
PCCX_LAB_BIN=/path/to/pccx-lab \
    python -m pccx_ide_cli check fixtures/ok_module.sv --backend pccx-lab --format text

# Module/declaration index (early scaffold — not a full parser)
python -m pccx_ide_cli index fixtures/modules/simple_module.sv
python -m pccx_ide_cli index fixtures/modules/ --format text

# Module index with name filter (exact, case-sensitive)
python -m pccx_ide_cli index fixtures/modules/ --query simple_mod
python -m pccx_ide_cli index fixtures/modules/ --query simple_mod --format text

# Declaration locate (early navigation scaffold — not LSP, not stable API)
python -m pccx_ide_cli locate fixtures/modules/ simple_mod
python -m pccx_ide_cli locate fixtures/modules/ pkg_defs --kind package
python -m pccx_ide_cli locate fixtures/modules/ bus_if --kind interface
python -m pccx_ide_cli locate fixtures/modules/ simple_mod --format text

# Declaration export for editor bridge consumers (pre-stable)
python -m pccx_ide_cli declarations fixtures/modules/ --format json

# Module organization export (pre-stable, read-only)
python -m pccx_ide_cli organization fixtures/organization/hierarchy_top.sv --format json
python -m pccx_ide_cli organization fixtures/organization/hierarchy_top.sv --format text

# Module hierarchy view (pre-stable, read-only)
python -m pccx_ide_cli hierarchy fixtures/organization/hierarchy_top.sv --format json
python -m pccx_ide_cli hierarchy fixtures/organization/hierarchy_top.sv --format text

# Module dependency view (pre-stable, read-only)
python -m pccx_ide_cli dependencies fixtures/organization/hierarchy_top.sv --format json
python -m pccx_ide_cli dependencies fixtures/organization/hierarchy_top.sv --format text
python -m pccx_ide_cli hierarchy-cycles fixtures/organization/cyclic_hierarchy.sv --format json
python -m pccx_ide_cli unresolved-instances fixtures/organization/unresolved_instances.sv --format text
python -m pccx_ide_cli module-roots fixtures/organization/hierarchy_top.sv --format json
python -m pccx_ide_cli module-leaves fixtures/organization/hierarchy_top.sv --format json
python -m pccx_ide_cli module-orphans fixtures/organization/orphan_modules.sv --format json
python -m pccx_ide_cli module-depths fixtures/organization/hierarchy_top.sv --format json
python -m pccx_ide_cli module-paths fixtures/organization/fanout_hierarchy.sv --format json
python -m pccx_ide_cli module-edges fixtures/organization/fanout_hierarchy.sv --format json
python -m pccx_ide_cli module-reachability fixtures/organization/fanout_hierarchy.sv --format json
python -m pccx_ide_cli module-order fixtures/organization/fanout_hierarchy.sv --format json
python -m pccx_ide_cli module-fanout fixtures/organization/fanout_hierarchy.sv --format json
python -m pccx_ide_cli module-fanin fixtures/organization/fanout_hierarchy.sv --format json
python -m pccx_ide_cli module-health fixtures/organization/hierarchy_top.sv --format json

# Module header/port summary view (pre-stable, read-only)
python -m pccx_ide_cli module-summary fixtures/organization/hierarchy_top.sv --format json
python -m pccx_ide_cli module-summary fixtures/organization/hierarchy_top.sv --format text

# Module boundary audit and refactor candidate list (pre-stable, read-only)
python -m pccx_ide_cli boundary-audit fixtures/organization/hierarchy_top.sv --format json
python -m pccx_ide_cli module-duplicates fixtures/organization/duplicate_modules.sv --format text
python -m pccx_ide_cli module-files fixtures/organization/hierarchy_top.sv --format text
python -m pccx_ide_cli module-spans fixtures/organization/hierarchy_top.sv --format text
python -m pccx_ide_cli refactor-candidates fixtures/organization/hierarchy_top.sv --format text
python -m pccx_ide_cli refactor-readiness fixtures/organization/hierarchy_top.sv --format json

# Target port usage view (pre-stable, read-only)
python -m pccx_ide_cli port-usage fixtures/organization/hierarchy_top.sv --module leaf_mod --format json
python -m pccx_ide_cli port-usage fixtures/organization/hierarchy_top.sv --module leaf_mod --format text

# Target port connection audit (pre-stable, read-only)
python -m pccx_ide_cli port-connections fixtures/organization/port_connection_audit.sv --module child_mod --format json
python -m pccx_ide_cli port-connections fixtures/organization/port_connection_audit.sv --module child_mod --format text

# Target module context bundle (pre-stable, read-only)
python -m pccx_ide_cli module-context fixtures/organization/hierarchy_top.sv --module leaf_mod --format json
python -m pccx_ide_cli module-context fixtures/organization/hierarchy_top.sv --module leaf_mod --format text

# Target-specific refactor impact view (pre-stable, read-only)
python -m pccx_ide_cli refactor-impact fixtures/organization/hierarchy_top.sv --module leaf_mod --format json
python -m pccx_ide_cli refactor-impact fixtures/organization/hierarchy_top.sv --module leaf_mod --format text

# Refactoring proposal export (pre-stable, proposal-only)
python -m pccx_ide_cli refactor-plan fixtures/organization/hierarchy_top.sv --action rename-module --module top_mod --new-name top_mod_next --format json
python -m pccx_ide_cli refactor-plan fixtures/organization/hierarchy_top.sv --action extract-port --module top_mod --port-name valid_i --direction input --format text
python -m pccx_ide_cli validation-plan fixtures/organization/hierarchy_top.sv --action rename-module --module top_mod --new-name top_mod_next --format json
python -m pccx_ide_cli refactor-review fixtures/organization/hierarchy_top.sv --action rename-module --module top_mod --new-name top_mod_next --format json
python -m pccx_ide_cli refactor-approval fixtures/organization/hierarchy_top.sv --action rename-module --module top_mod --new-name top_mod_next --format json
python -m pccx_ide_cli refactor-application fixtures/organization/hierarchy_top.sv --action rename-module --module top_mod --new-name top_mod_next --format json
python -m pccx_ide_cli refactor-result fixtures/organization/hierarchy_top.sv --action rename-module --module top_mod --new-name top_mod_next --format json
python -m pccx_ide_cli refactor-handoff fixtures/organization/hierarchy_top.sv --action rename-module --module top_mod --new-name top_mod_next --format json
python -m pccx_ide_cli refactor-checklist fixtures/organization/hierarchy_top.sv --action rename-module --module top_mod --new-name top_mod_next --format json
python -m pccx_ide_cli refactor-session fixtures/organization/hierarchy_top.sv --action rename-module --module top_mod --new-name top_mod_next --format json

# xsim log handoff scaffold (parses existing log files only)
python -m pccx_ide_cli xsim-log fixtures/xsim/mixed.log --format json
python -m pccx_ide_cli xsim-log fixtures/xsim/mixed.log --format text

# Editor problem export scaffold (pre-stable)
python -m pccx_ide_cli problems from-check fixtures/missing_endmodule.sv --format json
python -m pccx_ide_cli problems from-xsim-log fixtures/xsim/mixed.log --format text

# Print the diagnostics schema
python -m pccx_ide_cli schema
```

Diagnostics text output format:
```
backend: scaffold
source: fixtures/missing_endmodule.sv
1 diagnostic
fixtures/missing_endmodule.sv:1:1: error: PCCX-SCAFFOLD-003: `module` declared but no matching `endmodule` found
```

Module index text output format:
```
source: fixtures/modules/
3 modules
fixtures/modules/simple_module.sv:1:1: module simple_mod
fixtures/modules/two_modules.sv:1:1: module mod_a
fixtures/modules/two_modules.sv:3:1: module mod_b
```

`index` also emits a pre-stable `declarations[]` JSON list for simple
`module`, `package`, and `interface` declarations.  This is scanner-based
navigation support, not semantic resolution or a full parser.

Declaration locate text output format (one match, exit 0):
```
module simple_mod
fixtures/modules/simple_module.sv:1:1
```

No match exits 1. Multiple matches exit 2 with all candidates listed.
`locate` defaults to module-only compatibility and can target
`--kind module|package|interface|any`. It is an early scanner-based
navigation scaffold, exact name only, not semantic navigation, not LSP,
not a stable API. A future editor bridge can consume this output.

`declarations` exports the same pre-stable module/package/interface
records used by `index` without the legacy module-only wrapper. It is a
CLI bridge scaffold, not semantic resolution or a full parser.

`organization` exports scanner-based module boundary spans, a small
hierarchy seed, and proposal-only refactoring metadata. `hierarchy`
renders the same scanner data as a focused read-only hierarchy view for
editor tree consumers. `dependencies` renders direct module dependency,
dependent, and impact summaries from the same scanner data.
`hierarchy-cycles` reports scanner-detected resolved dependency cycles
for editor warnings without running validation or emitting command argv.
`unresolved-instances` reports scanner-detected instantiation candidates
whose target module is not declared in the scanned input.
`module-roots` reports scanner-detected root candidates for top-level
module entry-point review.
`module-leaves` reports scanner-detected leaf candidates for dependency-end
organization review.
`module-orphans` reports scanner-detected isolated module candidates with no
resolved dependencies or dependents.
`module-depths` groups scanner-detected hierarchy levels from root candidates
for module organization review.
`module-paths` enumerates scanner-detected root-to-leaf hierarchy paths and
blocked unresolved path terminals for path review.
`module-edges` lists scanner-detected direct instantiation edges, including
blocked unresolved targets, for dependency edge review.
`module-reachability` reports scanner-detected transitive dependency and
dependent names for reachability review.
`module-order` lists a scanner-detected dependency-first module review order
and blocks unresolved or cyclic order readiness.
`module-fanout` ranks scanner-detected modules by resolved direct dependency
count for fanout review.
`module-fanin` ranks scanner-detected modules by resolved direct dependent
count for fanin review.
`module-health` combines scanner-detected root, leaf, depth, cycle,
unresolved-instance, and duplicate-name signals into a read-only module graph
health summary for editor status panes.
`module-summary` renders conservative module header and port summaries
for editor sidebars and reviewed refactoring planning. `port-usage`
renders target port declarations with scanner-detected dependent
instantiation connection summaries. `port-connections` compares
scanner-detected target port names with named instantiation connections
and flags ordered or wildcard sites for manual review. `module-context`
bundles target summary, dependency, port-usage, and refactor-impact
review data for editor context panes. `refactor-candidates` lists scanner-detected
modules and proposal-only helper action metadata for editor action
menus. `refactor-readiness` summarizes boundary-audit and candidate
counts for editor status panes without selecting an action or emitting
command argv. `module-duplicates` reports scanner-detected duplicate
module names that would block unambiguous refactor planning.
`module-files` groups scanner-detected module declarations by source file
for move-module and file-layout review without moving or rewriting files.
`module-spans` ranks scanner-detected module declaration spans for
large-module review without semantic elaboration or rewrite actions.
`refactor-impact` renders target-specific declaration,
dependent, and dependency review data for a named module.
These commands do not edit files, apply
refactors, execute validation, run vendor tools, invoke `pccx-lab` or the
launcher, or implement semantic elaboration. The output shapes are
pre-stable and documented in
[`docs/MODULE_ORGANIZATION_WORKFLOW.md`](./docs/MODULE_ORGANIZATION_WORKFLOW.md).

`refactor-plan` emits proposal-only rename-module, extract-port, and
move-module planning envelopes over scanner-detected module boundaries.
It records requested inputs, a bounded preflight status including existing
rename-target conflicts, target-port conflicts, invalid rename or port
identifier syntax, invalid extract-port width syntax, invalid extract-port
direction, unused action inputs, and unsafe move destinations such as
absolute paths, parent traversal, unsupported extensions, or same-file moves,
and planned review steps, but it does not write files, apply patches, run
validation, invoke `pccx-lab` or the launcher, call providers, touch hardware,
or perform automatic repository actions.
`validation-plan`, `refactor-review`, `refactor-approval`,
`refactor-application`, `refactor-result`, `refactor-handoff`,
`refactor-checklist`, and `refactor-session` extend that reviewed flow with
proposal-only validation descriptors, summary-only review data, unapproved
approval gates, not-accepted application request metadata, and not-applied
result receipts, plus summary-only handoff, checklist, and session status
metadata. They do not
execute validation, run shell commands, apply edits, generate patches, write
files, publish public text, create pull requests, write comments, mutate
projects, invoke `pccx-lab` or the launcher, call providers, touch hardware, or
perform automatic repository actions.

`xsim-log` is an early handoff scaffold. It parses existing synthetic
xsim-style log files into diagnostics-like JSON or text output. It does
not run xsim or Vivado, does not prove hardware correctness, and does
not claim full Vivado/xsim coverage. The output shape is pre-stable; a
future `pccx-lab` integration may provide richer log and report handoff.

`problems` is an early editor bridge scaffold. It exports
editor-friendly problem records from existing local diagnostics and
xsim-log parsing. It does not implement LSP, a VS Code extension,
a JetBrains plugin, or any GUI. It does not run xsim or Vivado. The
output shape is pre-stable; future editor bridges may consume it.

The VS Code prototype can also summarize existing
`problems from-xsim-log` JSON as an `xsimDiagnostics` status/context
surface. That surface records counts by severity, located/unlocated
problem counts, and relative file counts. It does not read raw log files
in the UI layer, echo raw log lines into context bundles, run xsim or
Vivado, execute pccx-lab, call the launcher, touch hardware, or implement
MCP/LSP.

The external editor bridge CLI contract is documented in
[`docs/EDITOR_BRIDGE_CONTRACT.md`](./docs/EDITOR_BRIDGE_CONTRACT.md).
It is a pre-stable CLI contract, not an editor extension implementation.

Tests are run with:

```bash
python -m pytest -q
bash scripts/editor-bridge-smoke.sh
```

The current pre-stable envelope shape is described in
[`schema/diagnostics-v0.json`](./schema/diagnostics-v0.json).
Handoff notes for the eventual `pccx-lab` and xsim integration paths
live in [`docs/HANDOFF.md`](./docs/HANDOFF.md).
The initial roadmap for navigation, diagnostics, read-only handoff
surfaces, external editor planning, and later workflow tracks lives in
[`docs/ROADMAP.md`](./docs/ROADMAP.md).
The scanner-based module organization workflow for module boundaries,
hierarchy views, dependency views, module header/port summaries, and
target-specific refactor candidate and impact review data plus
proposal-only refactoring planning, including the target module context
bundle, is documented in
[`docs/MODULE_ORGANIZATION_WORKFLOW.md`](./docs/MODULE_ORGANIZATION_WORKFLOW.md).
The planned SystemVerilog workflow boundary, permission boundary, and
pccx-lab controlled tool dependency are documented in
[`docs/SYSTEMVERILOG_WORKFLOW_BOUNDARY.md`](./docs/SYSTEMVERILOG_WORKFLOW_BOUNDARY.md).
The deferred evolutionary loop plan and fitness-criteria sketch are
documented in [`docs/EVOLUTIONARY_LOOP_PLAN.md`](./docs/EVOLUTIONARY_LOOP_PLAN.md).
The external editor integration direction for VS Code and other editor
families is documented in
[`docs/EXTERNAL_EDITOR_INTEGRATION_PLAN.md`](./docs/EXTERNAL_EDITOR_INTEGRATION_PLAN.md).
The diagnostics/xsim planning boundary for the shared schema draft,
read-only log path, and text surface sketches is documented in
[`docs/DIAGNOSTICS_XSIM_INTEGRATION_PLAN.md`](./docs/DIAGNOSTICS_XSIM_INTEGRATION_PLAN.md).

The experimental VS Code prototype under
[`editors/vscode-prototype`](./editors/vscode-prototype) keeps
checked-example mode as the safe default. Live workspace commands are
opt-in and require an explicit configuration gate; the current local
workflow mode work is limited to workflow boundary status and
token-saving context bundle commands with no provider calls.  The
guarded Extension Host runtime smoke uses only the controlled fixture
under `editors/vscode-prototype/test/fixtures/live-workspace`.

The VS Code prototype also has a read-only diagnostics handoff consumer
for the launcher / pccx-lab `pccx.diagnosticsHandoff.v0` JSON shape. It
parses a checked local fixture and returns deterministic summary data for
future UI use. The `showDiagnosticsHandoffSummary` command surfaces that
adapter summary as local status data, and the local context bundle can
carry the same bounded summary as read-only context. It does not execute
the launcher, execute pccx-lab, invoke the pccx-lab validator, implement
MCP or LSP, call providers, or touch hardware.

Validation command proposals can also include a small preflight context
derived from that normalized context-bundle `diagnosticsHandoff` section.
The proposal data reports available, unavailable, or invalid handoff
status plus bounded notes for local UI display. It does not parse raw
handoff JSON in the proposal layer and does not add any execution path.
The prototype also has a validation proposal preflight audit command that
checks a proposal ID and fixed command template before the approved runner
handoff. That audit returns bounded JSON/text status only; it does not
execute launcher, pccx-lab, validator, shell, provider, runtime, MCP, LSP,
marketplace, telemetry, upload, or write-back flows.

The prototype also has an experimental read-only runtime readiness
consumer for the launcher `pccx.runtimeReadiness.v0` JSON shape. The
checked local example represents Gemma 3N E4B plus KV260 as
`blocked_not_yet_evidence_backed`. The summary carries readiness and
evidence state, target model/device, timing, bitstream, implementation,
KV260 smoke, runtime evidence, throughput state, bounded blockers, and
safety flags. It is context/status data only: it does not execute the
launcher, execute pccx-lab, access the FPGA repository, execute KV260
runtime code, load model weights, call providers, implement MCP or LSP,
upload telemetry, or write back state.

The VS Code prototype also has a read-only device/session status consumer
for launcher `pccx.deviceSessionStatus.v0` JSON. The checked local example
represents the KV260 connection, model load, session activity, diagnostics,
and runtime readiness rows as placeholder or blocked status data. It
validates only local JSON supplied by tests or future UI code and returns a
bounded status surface for context use. It does not execute the launcher,
execute pccx-lab, invoke a validator, open serial ports, scan networks,
attempt SSH or authentication, access hardware, load model assets, call
providers, upload telemetry, or write back state.

## Later track (deferred)

- Local workflow mode can propose interactions with `pccx-lab`
  through a controlled tool boundary; the IDE surfaces those flows but
  does not own the reusable analysis contract.
- Evolutionary generate / simulate / evaluate / refine loop, again
  driven through the lab boundary.
- VS Code extension distribution.

These items are explicitly *deferred* — not part of the near-term
surface — and depend on the CLI / core boundary in `pccx-lab` being
formal enough to bind to.

## Non-goals

- Not a Vivado replacement.
- No claim of complete LSP coverage today.
- This repo is not labelled as stable, and there is no commitment to a
  frozen plugin ABI yet.
- No autonomous hardware design claim.
- No automatic merge or release actions driven by the IDE.

## Related

- [pccxai/pccx][pccx] — spec / docs / roadmap / release coordination
- [pccxai/pccx-lab][pccx-lab] — verification lab + CLI / core boundary
- [pccxai/pccx-FPGA-NPU-LLM-kv260][pccx-fpga] — RTL / KV260 / hardware evidence (v002 LLM line)
- [pccxai/pccx-LLM-v003][pccx-llm-v003] — active LLM RTL track in a separate repository
- [pccxai/pccx-vision-v001][pccx-vision-v001] — active vision track for related KV260-oriented work
- [pccxai/pccx-llm-launcher][pccx-launcher] — user-facing local LLM launcher

## License

Apache License 2.0 — see [LICENSE](./LICENSE).

[pccx]: https://github.com/pccxai/pccx
[pccx-lab]: https://github.com/pccxai/pccx-lab
[pccx-fpga]: https://github.com/pccxai/pccx-FPGA-NPU-LLM-kv260
[pccx-launcher]: https://github.com/pccxai/pccx-llm-launcher
[pccx-llm-v003]: https://github.com/pccxai/pccx-LLM-v003
[pccx-vision-v001]: https://github.com/pccxai/pccx-vision-v001
