# Local Synthesis Extension Plan

This note records the editor-side boundary for local synthesis mode.

The data contract is `pccx.localSynthesisPlan.v0`. It is shared by:

- VS Code command: `pccxSystemVerilog.showLocalSynthesisPlan`
- JetBrains action: `pccx.systemverilog.showLocalSynthesisPlan`

The extension surface prepares fixed argument arrays for the CLI boundary:

```text
pccx synth --local --script synth.tcl --vendor auto --work-dir . --dry-run
pccx deploy --target kv260 --artifact build/pccx.xclbin --dry-run
```

Actual local tool invocation stays in the CLI or launcher local wrapper.
Those layers are responsible for detecting user-machine Vivado or Quartus
installations and for using `--run` after explicit user approval. The
editor surface stays plan-only, has no shell execution, and does not call
network, telemetry, upload, provider, launcher, pccx-lab, or hardware paths.

Cloud project/library sync and synthesis-result backup are optional
entitlement-gated services. The local synthesis plan marks them as
`cloudSyncRequired: false` so offline synthesis can remain available when
the user machine has the required vendor toolchain.
