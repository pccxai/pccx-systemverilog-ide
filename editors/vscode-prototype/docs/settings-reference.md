# Settings Reference

## Status

These settings belong to the experimental local VS Code prototype. They are
not a stable API, not a stable ABI, not a marketplace contract, and not an
LSP contract. The source of truth for the setting shape is
[`../../../schema/sv-ide-settings-v0.json`](../../../schema/sv-ide-settings-v0.json);
the VS Code package manifest mirrors that schema.

Checked-example mode remains the default. Live workspace commands require
both `pccxSystemVerilog.mode=liveWorkspace` and
`pccxSystemVerilog.liveWorkspace.enabled=true`.

## Settings

### `pccxSystemVerilog.mode`

- Type: `string`
- Default: `checkedExample`
- Allowed values: `checkedExample`, `liveWorkspace`
- Purpose: selects whether prototype commands use checked examples or the
  explicit live workspace command shape.
- Notes: `liveWorkspace` does not enable live commands by itself; the
  live-workspace opt-in flag must also be enabled.

### `pccxSystemVerilog.liveWorkspace.enabled`

- Type: `boolean`
- Default: `false`
- Purpose: opt-in gate for live workspace commands.
- Notes: checked-example behavior remains the default. Live commands are
  blocked unless this is `true` and `pccxSystemVerilog.mode` is
  `liveWorkspace`.

### `pccxSystemVerilog.pccxLab.command`

- Type: `string`
- Default: `pccx_ide_cli`
- Purpose: command-boundary name for the future pccx-lab CLI-first backend
  status surface.
- Notes: the current status command reports this value but does not execute
  pccx-lab. The value must be a single command name or path without
  arguments, newlines, null bytes, or shell control syntax.

### `pccxSystemVerilog.workflowBoundary.enabled`

- Type: `boolean`
- Default: `false`
- Purpose: opt-in flag for workflow boundary status and context-bundle
  surfaces.
- Notes: disabled means the boundary reports a disabled status. Enabling this
  setting does not add provider calls, runtime calls, MCP, LSP, write-file
  behavior, or direct execution.

### `pccxSystemVerilog.workflowBoundary.backend`

- Type: `string`
- Default: `none`
- Allowed values: `none`, `pccx-llm-launcher`, `mcp`
- Purpose: labels the future controlled workflow backend candidate.
- Notes: `none` reports not configured when the workflow boundary is enabled.
  Non-`none` values report a proposal-only boundary in this scaffold; they do
  not start a launcher, provider, runtime, or MCP server.

### `pccxSystemVerilog.validationRunner.enabled`

- Type: `boolean`
- Default: `false`
- Purpose: opt-in gate for approved validation runner execution.
- Notes: execution remains blocked unless this is `true` and
  `pccxSystemVerilog.validationRunner.mode` is `allowlisted`.

### `pccxSystemVerilog.validationRunner.mode`

- Type: `string`
- Default: `disabled`
- Allowed values: `disabled`, `allowlisted`
- Purpose: selects the approved validation runner mode.
- Notes: `allowlisted` must be explicit and still only accepts known proposal
  IDs. The runner does not accept raw shell command strings.

### `pccxSystemVerilog.validationRunner.defaultWorkingDirectory`

- Type: `string`
- Default: `repo-root`
- Allowed values: `repo-root`, `workspace`
- Purpose: default working-directory policy for approved validation runner
  commands.
- Notes: allowlisted command proposals may specify their own working-directory
  policy. Unknown policy values fall back to the repo root after schema/config
  validation would normally reject them.

### `pccxSystemVerilog.validationRunner.maxOutputLines`

- Type: `integer`
- Default: `120`
- Range: `1` to `500`
- Purpose: maximum stdout and stderr lines retained in approved validation
  summaries.
- Notes: this controls bounded summaries only; full logs are not persisted by
  the in-memory validation-result cache.

### `pccxSystemVerilog.validationRunner.timeoutMs`

- Type: `integer`
- Default: `30000`
- Range: `1000` to `120000`
- Purpose: timeout in milliseconds for approved validation runner commands.
- Notes: timed-out commands return bounded structured results through the
  validation runner surface.

### `pccxSystemVerilog.pythonPath`

- Type: `string`
- Default: `python3`
- Purpose: Python executable used by the live CLI prototype path.
- Notes: the value must be a non-empty single-line string without null bytes,
  newlines, or shell control syntax.

### `pccxSystemVerilog.defaultSource`

- Type: `string`
- Default: `fixtures/missing_endmodule.sv`
- Purpose: workspace-relative default SystemVerilog source for live
  diagnostics.
- Notes: live diagnostics map this value to the facade argument
  `--from-check <defaultSource>`. The value must be a non-empty single-line
  string without null bytes, newlines, or shell control syntax.

### `pccxSystemVerilog.defaultLog`

- Type: `string`
- Default: `fixtures/xsim/mixed.log`
- Purpose: workspace-relative default synthetic xsim-style log for prototype
  diagnostics surfaces.
- Notes: the setting is part of the normalized configuration and context
  shape. It is reserved for known log-oriented prototype flows; it does not
  enable arbitrary log scanning.

### `pccxSystemVerilog.defaultNavigationRoot`

- Type: `string`
- Default: `fixtures/modules`
- Purpose: workspace-relative source root used by live navigation.
- Notes: live navigation maps this value to the facade argument
  `--locate <defaultNavigationRoot> <defaultModule> --kind <defaultDeclarationKind>`.
  The value must be a non-empty single-line string without null bytes,
  newlines, or shell control syntax.

### `pccxSystemVerilog.defaultModule`

- Type: `string`
- Default: `simple_mod`
- Purpose: default declaration name used by live navigation examples.
- Notes: despite the setting name, this is the lookup name supplied to the
  facade locate flow and is paired with `defaultDeclarationKind`.

### `pccxSystemVerilog.defaultDeclarationKind`

- Type: `string`
- Default: `module`
- Allowed values: `module`, `package`, `interface`, `any`
- Purpose: declaration kind used by live navigation.
- Notes: this is passed to the facade locate flow as `--kind`.

### `pccxSystemVerilog.panel.dataSources`

- Type: `array` of `string`
- Default: `diagnosticsHandoff`, `runtimeReadiness`, `deviceSession`,
  `localWorkflow`
- Allowed values: `diagnosticsHandoff`, `runtimeReadiness`, `deviceSession`,
  `localWorkflow`
- Purpose: selected status-panel data sources for future settings UI
  surfaces.
- Notes: entries must be unique. This setting is a prototype UI data-source
  selector and does not enable provider calls, runtime calls, or external
  services.

### `pccxSystemVerilog.panel.refreshIntervalMs`

- Type: `integer`
- Default: `5000`
- Range: `1000` to `60000`
- Purpose: status-panel refresh interval in milliseconds for future UI
  surfaces.
- Notes: this is reserved for UI refresh behavior and does not add background
  workspace scanning in the current scaffold.

### `pccxSystemVerilog.logLevel`

- Type: `string`
- Default: `info`
- Allowed values: `error`, `warn`, `info`, `debug`, `trace`
- Purpose: extension-side status and diagnostics verbosity label.
- Notes: this is normalized with the rest of the prototype configuration and
  remains local to extension-side status surfaces.
