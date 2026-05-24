#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 pccxai
# PCCX(TM) SystemVerilog IDE public smoke test.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PYTHONPATH="${ROOT}/src${PYTHONPATH:+:${PYTHONPATH}}"

python3 -m pytest -q
python3 -m pccx_ide_cli check fixtures/ok_module.sv >/dev/null
if python3 -m pccx_ide_cli check fixtures/missing_endmodule.sv >/dev/null 2>&1; then
  echo "expected missing_endmodule fixture to fail" >&2
  exit 1
fi
python3 -m pccx_ide_cli index fixtures/modules --format json >/dev/null
python3 -m pccx_ide_cli declarations fixtures/modules --format json >/dev/null
python3 -m pccx_ide_cli xsim-log fixtures/xsim/mixed.log --format json >/dev/null

echo "systemverilog-ide smoke ok"
