# Workspace Orientation

This repository is the SystemVerilog IDE spin-out from `pccx-lab`. Its
near-term job is to provide editor-facing surfaces over controlled CLI and
data contracts: diagnostics, declaration navigation, module organization
views, checked examples, local VS Code prototype commands, and bounded
status/context summaries.

The repo is intentionally data-boundary-first. Reusable analysis and
verification behavior belongs behind the `pccx-lab` CLI/core boundary.
Launcher, provider, hardware, marketplace, telemetry, upload, release,
and write-back paths are outside this repository unless a later reviewed
boundary explicitly adds them.

## Top-Level Map

| Path | Role |
|---|---|
| `src/pccx_ide_cli/` | Python CLI facade and scanner-based data exporters. |
| `tests/` | Pytest coverage for CLI contracts, schema shape, fixtures, and repository hygiene. |
| `fixtures/` | Small SystemVerilog and log inputs used by CLI tests and examples. |
| `schema/diagnostics-v0.json` | Current diagnostics envelope schema consumed by tests and examples. |
| `docs/` | Direction, handoff, workflow, editor bridge, and module organization docs. |
| `docs/examples/` | Checked JSON examples for editor bridge and handoff consumers. |
| `editors/vscode-prototype/` | Experimental local VS Code extension scaffold and command facade. |
| `scripts/` | Smoke checks and source-header policy guard. |

## Main Entry Points

- `python3 -m pccx_ide_cli check <file>` emits the diagnostics envelope
  from the local scaffold or, when explicitly selected, the `pccx-lab`
  backend.
- `python3 -m pccx_ide_cli index <path>` and
  `python3 -m pccx_ide_cli locate <path> <name>` provide early
  scanner-based declaration data for editor navigation.
- `python3 -m pccx_ide_cli organization <path>` plus the related
  hierarchy, dependency, module-health, module-context, and refactor
  proposal commands provide read-only module organization data.
- `python3 -m pccx_ide_cli xsim-log <log>` and
  `python3 -m pccx_ide_cli problems ...` transform existing local
  diagnostics/log data into editor-friendly problem records.
- `node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs ...`
  exercises the VS Code prototype translation layer in checked-example or
  explicit live mode.

## Development Loop

Use the Python package from the repository root:

```bash
python3 -m pccx_ide_cli check fixtures/missing_endmodule.sv
python3 -m pccx_ide_cli index fixtures/modules/ --format text
python3 -m pccx_ide_cli module-health fixtures/organization/hierarchy_top.sv --format json
```

Run the default checks:

```bash
python3 -m pytest -q
bash scripts/editor-bridge-smoke.sh
bash scripts/vscode-adapter-smoke.sh
python3 scripts/check-source-headers.py
```

The VS Code prototype tests live under `editors/vscode-prototype/test/`
and are Node-based. They are mostly static/mock tests and checked-example
tests; the Extension Host smoke is a guarded local runtime smoke, not a
product claim.

## Boundary Rules To Preserve

- Keep the IDE as an editor cockpit over data contracts and controlled
  command shapes.
- Do not duplicate reusable `pccx-lab` analysis logic in this repo.
- Do not add launcher execution, provider calls, KV260 runtime access,
  raw shell command strings, background workspace scanning, telemetry,
  upload, release, or write-back behavior.
- Keep live workspace behavior explicit and opt-in.
- Keep adapter outputs deterministic, bounded, and testable.
- Treat CLI/editor payloads as pre-stable unless their owning contract
  says otherwise.

## Where To Read Next

- [`PROJECT_DIRECTION_AND_STYLE.md`](./PROJECT_DIRECTION_AND_STYLE.md)
  pins current direction, safety boundaries, and style policy.
- [`EDITOR_BRIDGE_CONTRACT.md`](./EDITOR_BRIDGE_CONTRACT.md) describes
  the external editor bridge payloads.
- [`MODULE_ORGANIZATION_WORKFLOW.md`](./MODULE_ORGANIZATION_WORKFLOW.md)
  documents scanner-based hierarchy, dependency, and proposal-only
  refactor planning data.
- [`HANDOFF.md`](./HANDOFF.md) tracks integration boundaries with
  `pccx-lab`, launcher handoff examples, and read-only status surfaces.
- [`../editors/vscode-prototype/README.md`](../editors/vscode-prototype/README.md)
  explains the local VS Code extension scaffold and command facade.
