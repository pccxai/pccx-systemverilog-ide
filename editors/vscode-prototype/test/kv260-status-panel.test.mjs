// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  KV260_STATUS_PANEL_VERSION,
  LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION,
  LAUNCHER_NPU_STATUS_MIRROR_VERSION,
  LabTraceReader,
  LauncherStatusReader,
  createKv260StatusPanel,
  formatKv260StatusPanel,
  kv260StatusPanelJson,
  parseKv260PreflightTranscript,
  renderKv260StatusPanelHtml,
} from "../src/kv260-status-panel.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const LAUNCHER_FIXTURE = resolve(
  ROOT,
  "docs/examples/kv260-status/launcher-npu-status.example.json",
);
const TRACE_FIXTURE = resolve(
  ROOT,
  "docs/examples/kv260-status/lab-trace-manifest.example.json",
);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function testReadersParseFixtures() {
  const launcher = LauncherStatusReader.consume(await readJson(LAUNCHER_FIXTURE));
  const trace = LabTraceReader.consume(await readJson(TRACE_FIXTURE));

  assert.equal(launcher.bitstream_loaded, false);
  assert.equal(launcher.bitstream_uuid, null);
  assert.equal(launcher.serial_probe.status, "not_run");
  assert.equal(trace.schema_version, "pccx.lab.kv260.trace-manifest.v0");
  assert.equal(trace.frame_count, 1);
  assert.equal(trace.frames[0].result_payload, "a55a0001");
}

async function testPanelRendersPreflightAndSafety() {
  const launcherStatus = await readJson(LAUNCHER_FIXTURE);
  launcherStatus.serial_probe = {
    schema_version: LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION,
    status: "available",
    tty_port: "/dev/ttyUSB0",
    login_ok: true,
    kernel_uname: "Linux kv260 6.6.0-test #1 SMP PREEMPT aarch64 GNU/Linux",
    xrt_present: true,
    last_preflight_at: "2026-05-06T09:00:00Z",
  };
  const panel = createKv260StatusPanel({
    launcherStatus,
    traceManifest: await readJson(TRACE_FIXTURE),
  });
  const text = formatKv260StatusPanel(panel);
  const jsonText = kv260StatusPanelJson({
    launcherStatus: await readJson(LAUNCHER_FIXTURE),
    traceManifest: await readJson(TRACE_FIXTURE),
  });

  assert.equal(panel.version, KV260_STATUS_PANEL_VERSION);
  assert.equal(panel.source.launcherTypeMirror, LAUNCHER_NPU_STATUS_MIRROR_VERSION);
  assert.equal(panel.source.labManifestParser, "real");
  assert.equal(panel.safety.readOnly, true);
  assert.equal(panel.safety.launcherExecution, false);
  assert.equal(panel.safety.pccxLabExecution, false);
  assert.equal(panel.safety.sshExecution, false);
  assert.equal(panel.serialProbe.ttyPort, "/dev/ttyUSB0");
  assert.equal(panel.serialProbe.xrtPresent, true);
  assert.equal(panel.serialProbe.lastPreflightAt, "2026-05-06T09:00:00Z");
  assert.equal(panel.preflightTranscript.captured, false);
  assert.equal(panel.preflightTranscript.message, "no preflight captured yet");
  assert.deepEqual(panel.preflight.items.map((item) => item.itemId), [
    "serial_tty_port",
    "serial_login",
    "serial_xrt",
    "serial_probe_timestamp",
  ]);
  assert.match(text, /KV260 Status Surface/);
  assert.match(text, /serial\.ttyPort: \/dev\/ttyUSB0/);
  assert.match(text, /serial\.kernelUname: Linux kv260/);
  assert.match(text, /serial\.xrtPresent: yes/);
  assert.match(text, /serial\.lastPreflightAt: 2026-05-06T09:00:00Z/);
  assert.match(text, /launcherMirror: pccx\.ide\.launcher-npu-status\.local-mirror\.v0/);
  assert.match(text, /execution: no launcher, no pccx-lab, no shell, no SSH, no KV260 control/);
  assert.equal(JSON.parse(jsonText).kind, "kv260-status-panel");
}

async function testPreflightNotRunIsGracefulDefault() {
  const panel = createKv260StatusPanel({
    launcherStatus: await readJson(LAUNCHER_FIXTURE),
    traceManifest: await readJson(TRACE_FIXTURE),
  });
  const text = formatKv260StatusPanel(panel);

  assert.equal(panel.serialProbe.status, "not_run");
  assert.equal(panel.preflightTranscript.status, "not_captured");
  assert.ok(panel.preflight.items.every((item) => item.state === "not_run"));
  assert.match(text, /serial\.ttyPort: preflight not run/);
  assert.match(text, /serial\.kernelUname: preflight not run/);
  assert.match(text, /serial\.xrtPresent: preflight not run/);
  assert.match(text, /preflightTranscript: no preflight captured yet/);
}

async function testParsesAndRendersPreflightTranscriptSummaryCard() {
  const longUname =
    "Linux kv260 6.6.0-xilinx-v2024.2 #1 SMP PREEMPT_DYNAMIC Wed May 6 09:00:00 UTC 2026 aarch64 GNU/Linux";
  const transcript = [
    "# KV260 board preflight",
    "winning port: /dev/ttyUSB1 @ 115200",
    "login_ok: true",
    `uname -a: ${longUname}`,
    "xrt version: 2.16.204",
    "xmutil app count: 3",
    "workspace note: /home/user/private-state/raw-capture.md",
  ].join("\n");
  const parsed = parseKv260PreflightTranscript(transcript);
  const panel = createKv260StatusPanel({
    launcherStatus: await readJson(LAUNCHER_FIXTURE),
    traceManifest: await readJson(TRACE_FIXTURE),
    preflightTranscriptText: transcript,
  });
  const text = formatKv260StatusPanel(panel);
  const html = renderKv260StatusPanelHtml(panel);

  assert.equal(parsed.captured, true);
  assert.equal(parsed.winningPort, "/dev/ttyUSB1");
  assert.equal(parsed.baud, 115200);
  assert.equal(parsed.loginOk, true);
  assert.equal(parsed.xrtVersion, "2.16.204");
  assert.equal(parsed.xmutilAppCount, 3);
  assert.equal(panel.preflightTranscript.unameDisplay.length, 80);
  assert.match(text, /preflightTranscript\.winning: \/dev\/ttyUSB1 @ 115200/);
  assert.match(text, /preflightTranscript\.loginOk: yes/);
  assert.match(text, /preflightTranscript\.xrtVersion: 2\.16\.204/);
  assert.match(text, /preflightTranscript\.xmutilAppCount: 3/);
  assert.match(html, /Preflight Transcript/);
  assert.match(html, /\/dev\/ttyUSB1 @ 115200/);
  assert.match(html, /xmutil apps/);
  assert.doesNotMatch(JSON.stringify(panel), /\/home\/user/);
}

async function testRendererUsesAperturePillsEvidenceAndEmptyState() {
  const pendingPanel = createKv260StatusPanel({
    launcherStatus: await readJson(LAUNCHER_FIXTURE),
    traceManifest: await readJson(TRACE_FIXTURE),
  });
  const pendingHtml = renderKv260StatusPanelHtml(pendingPanel);

  assert.match(pendingHtml, /class="aperture-mark"/);
  assert.match(pendingHtml, /#0b5fff/);
  assert.match(pendingHtml, /status-pill status-pending">PENDING/);
  assert.match(pendingHtml, /<details class="evidence-path">/);
  assert.match(pendingHtml, /launcher serial preflight snapshot/);
  assert.match(pendingHtml, /launcher\.serial_probe\.tty_port/);
  assert.match(pendingHtml, /Launcher status input is not configured/);
  assert.match(pendingHtml, /no preflight captured yet/);
  assert.doesNotMatch(pendingHtml, /\bAI\b|artificial intelligence/i);

  const blockedStatus = await readJson(LAUNCHER_FIXTURE);
  blockedStatus.serial_probe = {
    schema_version: LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION,
    status: "blocked",
    tty_port: null,
    login_ok: false,
    kernel_uname: null,
    xrt_present: false,
    last_preflight_at: "2026-05-06T09:00:00Z",
  };
  const blockedHtml = renderKv260StatusPanelHtml(createKv260StatusPanel({
    launcherStatus: blockedStatus,
    traceManifest: await readJson(TRACE_FIXTURE),
  }));

  assert.match(blockedHtml, /status-pill status-fail">FAIL/);
  assert.match(blockedHtml, /board is not reachable/);

  const availableStatus = await readJson(LAUNCHER_FIXTURE);
  availableStatus.serial_probe = {
    schema_version: LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION,
    status: "available",
    tty_port: "/dev/ttyUSB0",
    login_ok: true,
    kernel_uname: "Linux kv260",
    xrt_present: true,
    last_preflight_at: "2026-05-06T09:00:00Z",
  };
  const availableHtml = renderKv260StatusPanelHtml(createKv260StatusPanel({
    launcherStatus: availableStatus,
    traceManifest: await readJson(TRACE_FIXTURE),
  }));

  assert.match(availableHtml, /status-pill status-pass">PASS/);
}

async function testRendererEscapesArtifactEvidence() {
  const launcherStatus = await readJson(LAUNCHER_FIXTURE);
  launcherStatus.serial_probe = {
    schema_version: LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION,
    status: "available",
    tty_port: "<script>alert(1)</script>",
    login_ok: true,
    kernel_uname: "Linux kv260",
    xrt_present: true,
    last_preflight_at: "2026-05-06T09:00:00Z",
  };
  const html = renderKv260StatusPanelHtml(createKv260StatusPanel({
    launcherStatus,
    traceManifest: await readJson(TRACE_FIXTURE),
  }));

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
}

async function testLiveSerialProbeTypeOnlySkipWithoutData() {
  const raw = process.env.PCCX_KV260_SERIAL_PREFLIGHT_JSON;
  if (!raw) {
    console.log("skip: no live KV260 serial preflight JSON");
    return;
  }
  const launcherStatus = await readJson(LAUNCHER_FIXTURE);
  launcherStatus.serial_probe = JSON.parse(raw);
  const panel = createKv260StatusPanel({
    launcherStatus,
    traceManifest: await readJson(TRACE_FIXTURE),
  });

  assert.equal(panel.serialProbe.schemaVersion, LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION);
  assert.ok(["available", "blocked", "not_run"].includes(panel.serialProbe.status));
}

async function testRejectsInvalidOrUnsafeInputs() {
  assert.throws(
    () => LauncherStatusReader.consume({ bitstream_loaded: "false" }),
    /bitstream_loaded/,
  );

  const invalid = await readJson(TRACE_FIXTURE);
  invalid.source_kind = "ssh_log_tail";
  assert.throws(
    () => LabTraceReader.consume(invalid),
    /source_kind: must be file_replay/,
  );

  const unsafe = await readJson(LAUNCHER_FIXTURE);
  unsafe.last_error = "/home/user/private.log";
  assert.throws(
    () => LauncherStatusReader.consume(unsafe),
    /private paths/,
  );
}

async function testModuleSourceHasNoExecutionTerms() {
  const source = await readFile(
    resolve(ROOT, "editors/vscode-prototype/src/kv260-status-panel.mjs"),
    "utf8",
  );

  assert.doesNotMatch(source, /node:child_process|\bexecFile\b|\bspawn\s*\(|\bexec\s*\(/);
  assert.doesNotMatch(source, /node:fs|readFile\s*\(|readdir\s*\(|opendir\s*\(|stat\s*\(/);
  assert.doesNotMatch(source, /\bwriteFile\s*\(|\bappendFile\s*\(|\bunlink\s*\(|\brm\s*\(/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|node:https|node:http|node:net|node:tls/);
  assert.doesNotMatch(source, /\b(?:openai|anthropic|gemini)\b/i);
  assert.doesNotMatch(source, /modelcontextprotocol|McpServer|vscode-languageclient|LanguageClient/);
}

await testReadersParseFixtures();
await testPanelRendersPreflightAndSafety();
await testPreflightNotRunIsGracefulDefault();
await testParsesAndRendersPreflightTranscriptSummaryCard();
await testRendererUsesAperturePillsEvidenceAndEmptyState();
await testRendererEscapesArtifactEvidence();
await testLiveSerialProbeTypeOnlySkipWithoutData();
await testRejectsInvalidOrUnsafeInputs();
await testModuleSourceHasNoExecutionTerms();

console.log("vscode kv260 status panel tests ok");
