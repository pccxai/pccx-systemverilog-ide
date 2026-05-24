# PCCX SystemVerilog IDE Quickstart

This guide verifies the public scaffold from a clean checkout.

## Requirements

- Python 3.9 or newer
- `pip`

## Install

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[test]"
```

## Run The CLI

```bash
pccx-ide check fixtures/ok_module.sv
pccx-ide check fixtures/missing_endmodule.sv --format text
pccx-ide index fixtures/modules --format text
pccx-ide locate fixtures/modules simple_mod --format text
pccx-ide xsim-log fixtures/xsim/mixed.log --format text
```

The broken fixture command is expected to return a non-zero exit code because
it contains a missing `endmodule` example.

## Run The Smoke Test

```bash
bash scripts/smoke.sh
```

The smoke test runs local fixture-backed checks only. It does not invoke
Vivado, Verible, pccx-lab, pccx-launcher, hardware, provider APIs, source
upload, or release publishing.

## Next Files

- [README.md](./README.md) for product scope and command examples
- [CONTRIBUTING.md](./CONTRIBUTING.md) for pull request expectations
- [SECURITY.md](./SECURITY.md) for vulnerability reporting
- [docs/RELEASE.md](./docs/RELEASE.md) for release operator steps
