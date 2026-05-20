#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 pccxai
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "error: node is required for the VS Code adapter prototype smoke" >&2
  exit 127
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 is required for the source header policy check" >&2
  exit 127
fi

python3 scripts/check-source-headers.py
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
node editors/vscode-prototype/test/xsim-diagnostics-status-surface.test.mjs
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
node editors/vscode-prototype/test/sv-assist-data.test.mjs
node editors/vscode-prototype/test/verible-language-server.test.mjs
node editors/vscode-prototype/test/verible-lint.test.mjs
node editors/vscode-prototype/test/extension-entrypoint.test.mjs
node editors/vscode-prototype/test/command-handlers.test.mjs
node editors/vscode-prototype/test/presenter.test.mjs
node editors/vscode-prototype/test/presentation-boundary.test.mjs
node editors/vscode-prototype/test/extension-host-readiness.test.mjs
node editors/vscode-prototype/src/adapter.mjs diagnostics \
  docs/examples/editor-bridge/problems-xsim-mixed.example.json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const d=JSON.parse(s);if(!Array.isArray(d)||d.length===0)process.exit(1);})"
node editors/vscode-prototype/src/adapter.mjs navigation \
  docs/examples/editor-bridge/declarations.example.json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const d=JSON.parse(s);if(!Array.isArray(d)||!d.some(x=>x.kind==='package'))process.exit(1);})"
node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs diagnostics \
  --mode example --source check-missing-endmodule \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const d=JSON.parse(s);if(d.kind!=='vscode-diagnostics'||d.mode!=='example'||d.diagnostics.length===0)process.exit(1);})"
node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs navigation \
  --mode example --source declarations \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const d=JSON.parse(s);if(d.kind!=='vscode-navigation'||!d.items.some(x=>x.kind==='interface'))process.exit(1);})"

echo "vscode adapter prototype smoke ok"
