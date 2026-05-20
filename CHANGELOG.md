# Changelog

All notable changes to this project are documented in this file.

The format follows Keep a Changelog. Entries here describe repository changes
under review and do not claim a published extension, marketplace package, tag,
release, or stable API/ABI.

## [Unreleased]

The 2026-05-07 v002.1 PR ramp is grouped below. Late-day additions after
the initial changelog pass are appended after the first #124-#129 stack.

### Status Surface

- Added local read-only KV260 status readers, example JSON fixtures, CLI output,
  documentation, and a VS Code prototype panel for launcher NPU status and lab
  trace manifest data. [#124](https://github.com/pccxai/systemverilog-ide/pull/124)

### UI Theme

- Integrated copied pccx aperture logo assets, a prototype extension icon, the
  pccx SystemVerilog Light color theme, and a copied-asset notice. [#125](https://github.com/pccxai/systemverilog-ide/pull/125)

### Preflight Binding

- Extended the read-only launcher status data with serial preflight snapshot
  fields and surfaced tty, kernel, XRT, and timestamp values with missing-data
  defaults. [#126](https://github.com/pccxai/systemverilog-ide/pull/126)

### Polish

- Rendered readiness details in a no-script VS Code webview with status pills,
  evidence-path details, and maintainer empty states while retaining the
  output-channel fallback. [#127](https://github.com/pccxai/systemverilog-ide/pull/127)

### Palette

- Added v002.1 command-palette navigation for the status panel, runbook, project
  board, and trace help through the read-only panel or VS Code external URL
  opening. [#128](https://github.com/pccxai/systemverilog-ide/pull/128)

### Docs

- Added the v002.1 readiness panel developer guide covering local enablement,
  launcher-side data environment names, panel pill semantics, feedback routing,
  and command-palette entries. [#129](https://github.com/pccxai/systemverilog-ide/pull/129)

### Preflight Summary

- Added a read-only board preflight summary card that parses bounded local
  transcript fields, exposes a configurable transcript path, and keeps a
  graceful empty state when no transcript is captured. [#130](https://github.com/pccxai/systemverilog-ide/pull/130)

### Theme Variant

- Added the pccx SystemVerilog Dark theme beside the light theme, including
  manifest wiring, README listing, and JSON theme validation coverage. [#132](https://github.com/pccxai/systemverilog-ide/pull/132)

### Settings

- Added a checked settings schema for panel data sources, refresh interval, and
  log level, mirrored the schema into the VS Code prototype contributions, and
  normalized the settings at runtime. [#133](https://github.com/pccxai/systemverilog-ide/pull/133)

### Keymap

- Added default shortcuts for the read-only v002.1 PCCX commands and locked the
  command-to-key mapping in the VS Code prototype manifest test. [#134](https://github.com/pccxai/systemverilog-ide/pull/134)

### Developer Environment

- Added a development Dockerfile for Python, Node, open HDL tools, OSS CAD
  Suite, XRT utilities, Xilinx bootgen, OpenOCD, and openFPGALoader. [#135](https://github.com/pccxai/systemverilog-ide/pull/135)

### Settings Docs

- Added a dedicated VS Code prototype settings reference, linked it from the
  prototype README, and covered schema-to-doc alignment in tests. [#136](https://github.com/pccxai/systemverilog-ide/pull/136)

### Examples

- Added a text-only first-use guide covering command palette, Problems and
  Output panels, status-bar expectations, and the no-screenshot evidence
  boundary. [#137](https://github.com/pccxai/systemverilog-ide/pull/137)

### Quickstart

- Added a five-step SV-IDE quickstart for install, panel, preflight, status, and
  JSON export, with links from the root README and VS Code prototype README. [#138](https://github.com/pccxai/systemverilog-ide/pull/138)

### Test Taxonomy

- Added a T0-T7 test taxonomy for the Python CLI, checked examples, VS Code
  prototype, boundary guards, and manual review evidence. [#139](https://github.com/pccxai/systemverilog-ide/pull/139)

### Theme Docs

- Added theme consistency rules for paired light and dark themes, including
  structural parity, color keys, token buckets, and shared semantic roles. [#140](https://github.com/pccxai/systemverilog-ide/pull/140)

### Guardrails

- This changelog summarizes the #124-#130 and #132-#140 PR stack only; it does
  not add or claim launcher execution, pccx-lab execution, serial writes, SSH,
  board commands, provider calls, telemetry, uploads, write-back, packaging,
  tags, or release flow.
- This changelog makes no marketplace flow claim and no stable API/ABI claim.
