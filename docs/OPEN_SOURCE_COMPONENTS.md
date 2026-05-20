# Open-source components

This repository keeps the IDE surface pre-stable and dependency-light.
The component list below is derived from committed dependency manifests
only; it does not use environment inspection.

## Sources

| Ecosystem | Source file | Scope |
|---|---|---|
| npm | `editors/vscode-prototype/package.json` | Declared VS Code prototype dependencies |
| npm | `editors/vscode-prototype/package-lock.json` | Resolved VS Code prototype dependency tree |
| Python | `pyproject.toml` | Build, runtime, and optional test dependencies |

## npm components

The VS Code prototype declares no runtime npm dependencies. Its test
tooling dependency is listed below with the resolved lockfile tree.

| Component | Version | Scope | License in lockfile |
|---|---:|---|---|
| `@vscode/test-electron` | 2.5.2 | direct dev dependency | MIT |
| `agent-base` | 7.1.4 | transitive dev dependency | MIT |
| `ansi-regex` | 6.2.2 | transitive dev dependency | MIT |
| `chalk` | 5.6.2 | transitive dev dependency | MIT |
| `cli-cursor` | 5.0.0 | transitive dev dependency | MIT |
| `cli-spinners` | 2.9.2 | transitive dev dependency | MIT |
| `core-util-is` | 1.0.3 | transitive dev dependency | MIT |
| `debug` | 4.4.3 | transitive dev dependency | MIT |
| `emoji-regex` | 10.6.0 | transitive dev dependency | MIT |
| `get-east-asian-width` | 1.5.0 | transitive dev dependency | MIT |
| `http-proxy-agent` | 7.0.2 | transitive dev dependency | MIT |
| `https-proxy-agent` | 7.0.6 | transitive dev dependency | MIT |
| `immediate` | 3.0.6 | transitive dev dependency | MIT |
| `inherits` | 2.0.4 | transitive dev dependency | ISC |
| `is-interactive` | 2.0.0 | transitive dev dependency | MIT |
| `is-unicode-supported` | 2.1.0 | transitive dev dependency | MIT |
| `isarray` | 1.0.0 | transitive dev dependency | MIT |
| `jszip` | 3.10.1 | transitive dev dependency | MIT OR GPL-3.0-or-later |
| `lie` | 3.3.0 | transitive dev dependency | MIT |
| `log-symbols` | 6.0.0 | transitive dev dependency | MIT |
| `log-symbols/node_modules/is-unicode-supported` | 1.3.0 | transitive dev dependency | MIT |
| `mimic-function` | 5.0.1 | transitive dev dependency | MIT |
| `ms` | 2.1.3 | transitive dev dependency | MIT |
| `onetime` | 7.0.0 | transitive dev dependency | MIT |
| `ora` | 8.2.0 | transitive dev dependency | MIT |
| `pako` | 1.0.11 | transitive dev dependency | MIT AND Zlib |
| `process-nextick-args` | 2.0.1 | transitive dev dependency | MIT |
| `readable-stream` | 2.3.8 | transitive dev dependency | MIT |
| `restore-cursor` | 5.1.0 | transitive dev dependency | MIT |
| `safe-buffer` | 5.1.2 | transitive dev dependency | MIT |
| `semver` | 7.7.4 | transitive dev dependency | ISC |
| `setimmediate` | 1.0.5 | transitive dev dependency | MIT |
| `signal-exit` | 4.1.0 | transitive dev dependency | ISC |
| `stdin-discarder` | 0.2.2 | transitive dev dependency | MIT |
| `string_decoder` | 1.1.1 | transitive dev dependency | MIT |
| `string-width` | 7.2.0 | transitive dev dependency | MIT |
| `strip-ansi` | 7.2.0 | transitive dev dependency | MIT |
| `util-deprecate` | 1.0.2 | transitive dev dependency | MIT |

## Python components

Python dependencies are declared in `pyproject.toml`. The repository does
not currently commit a Python lockfile, so this table lists the static
declared requirements rather than resolved transitive packages.

| Component | Version specifier | Scope |
|---|---|---|
| `hatchling` | any version accepted by the build frontend | build backend |
| `jsonschema` | `>=4` | runtime dependency |
| `pytest` | any version accepted by the installer | optional `test` extra |

## Notes

- The repository package itself is licensed under the `LICENSE` file.
- The npm license column is copied from the committed lockfile.
- Python dependency license metadata is not declared in `pyproject.toml`;
  verify it from the package artifacts selected by the installer when
  preparing a release artifact.
