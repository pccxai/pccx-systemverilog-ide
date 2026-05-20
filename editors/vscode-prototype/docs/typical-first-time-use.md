# Typical First-Time Use

This page describes a typical first run of the experimental local VS Code
prototype.  It is text-only documentation: no real screenshots are captured,
checked in, or required for this flow.

The prototype is not published, not LSP, and not a stable API.  First-time
use should start with checked-example commands because they exercise the
presentation boundary without scanning a user workspace or running arbitrary
commands.

## Starting Point

Open the repository in a VS Code Extension Development Host with the prototype
extension active.  The default mode is `checkedExample`, so the command
palette examples use checked fixture data unless live workspace mode is
explicitly enabled.

Expected initial surfaces:

- Command Palette entries prefixed with `PCCX SystemVerilog:`.
- Problems panel entries after publishing diagnostics.
- Output panel channel named `PCCX SystemVerilog IDE Prototype`.
- Output panel channel named `PCCX SystemVerilog Validation Results` after
  validation-result commands are used.
- No persistent PCCX status-bar item yet.

## Command Palette

The command palette is the primary first-use entry point.  A typical first
pass is:

```text
Command Palette
> PCCX SystemVerilog: Publish Checked Example Diagnostics (Experimental)
> PCCX SystemVerilog: Show Checked Example Navigation (Experimental)
> PCCX SystemVerilog: Show Local Workflow Status (Experimental)
> PCCX SystemVerilog: Show pccx-lab Backend Status (Experimental)
```

`Publish Checked Example Diagnostics` publishes the checked
`check-missing-endmodule` fixture as VS Code diagnostics.  The user-facing
result is a VS Code notification plus diagnostics in the Problems panel.

`Show Checked Example Navigation` opens a Quick Pick titled
`PCCX SystemVerilog Navigation`.  The listed items come from checked
declaration fixture data and preserve kind, name, file, line, and column.

`Show Local Workflow Status` writes a bounded local status summary to the
prototype output channel.  It reports mode, live-workspace opt-in state,
validation runner state, recent validation cache status, pccx-lab descriptor
state, fixture-backed launcher state, and read-only handoff/readiness
summaries.

`Show pccx-lab Backend Status` is status-only.  It reports the configured
future pccx-lab command boundary and does not execute pccx-lab.

## Panel View

The first panel to check is VS Code's Problems panel.  After the checked
diagnostics command runs, it should show the fixture diagnostic for
`fixtures/missing_endmodule.sv`.

```text
Problems
fixtures/missing_endmodule.sv
  error PCCX-SCAFFOLD-003 module declared but no matching endmodule found
```

The second panel to check is the Output panel.  Select
`PCCX SystemVerilog IDE Prototype` from the output channel picker.
Command results are appended there as bounded JSON or formatted status text,
depending on the command.

```text
Output: PCCX SystemVerilog IDE Prototype
Local Workflow Status
extensionMode: checkedExample
liveWorkspaceEnabled: no
validationRunner: disabled (disabled)
...
safety: no provider calls, no launcher calls, no pccx-lab execution, no FPGA repo access, no KV260 runtime
```

Validation runner output, when explicitly enabled and invoked through an
allowlisted proposal, uses the separate
`PCCX SystemVerilog Validation Results` output channel.  The default first-use
path does not require enabling validation execution.

## Status Bar

The current prototype does not contribute a persistent status-bar item.  For
first-time use, status is surfaced through command palette commands,
notifications, the Problems panel, and the Output panel.

This is intentional for the current boundary: status commands are explicit,
bounded, and data-only.  A future status-bar surface should mirror the same
bounded summaries and must not imply provider calls, launcher execution,
pccx-lab execution, FPGA access, KV260 runtime execution, LSP support,
marketplace packaging, telemetry, automatic upload, or write-back behavior.

## Live Workspace Opt-In

After the checked-example path is understood, live workspace mode can be
tested explicitly.  It requires both settings:

```text
pccxSystemVerilog.mode = liveWorkspace
pccxSystemVerilog.liveWorkspace.enabled = true
```

Then use:

```text
Command Palette
> PCCX SystemVerilog: Publish Live Workspace Diagnostics (Experimental, Opt-In)
> PCCX SystemVerilog: Show Live Workspace Navigation (Experimental, Opt-In)
```

Live workspace commands use known facade argument arrays only.  They do not
silently fall back to checked examples, do not start background scanning, do
not add file watchers, do not check on save, and do not accept raw shell
commands.

## Text-Only Capture Checklist

Use this checklist when documenting or reviewing first-use behavior without
real screenshots:

- Command palette: command names are visible and use the contributed titles.
- Problems panel: checked diagnostics appear after the checked diagnostics
  command.
- Output panel: local workflow and backend status commands append bounded
  summaries to `PCCX SystemVerilog IDE Prototype`.
- Validation output: validation-result commands use
  `PCCX SystemVerilog Validation Results`.
- Status bar: no persistent PCCX status-bar item is expected in the current
  prototype.
- Safety boundary: the first-use path does not execute pccx-lab, call a
  launcher, call provider/runtime services, access FPGA hardware, upload
  telemetry, or write back to the workspace.
