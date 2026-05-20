// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

export const LAUNCHER_NPU_STATUS_MIRROR_VERSION =
  "pccx.ide.launcher-npu-status.local-mirror.v0";
export const LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION =
  "pccx.launcher.kv260-serial-preflight.v0";
export const TRACE_MANIFEST_SCHEMA_VERSION = "pccx.lab.kv260.trace-manifest.v0";
export const KV260_STATUS_PANEL_VERSION = "pccx.ide.kv260-status-panel.v0";

export const DEFAULT_SERIAL_PREFLIGHT_STATUS = Object.freeze({
  schema_version: LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION,
  status: "not_run",
  tty_port: null,
  login_ok: null,
  kernel_uname: null,
  xrt_present: null,
  last_preflight_at: null,
});

export const DEFAULT_PREFLIGHT_TRANSCRIPT_SUMMARY = Object.freeze({
  status: "not_captured",
  captured: false,
  winningPort: null,
  baud: null,
  loginOk: null,
  uname: null,
  unameDisplay: "no preflight captured yet",
  xrtVersion: null,
  xmutilAppCount: null,
  message: "no preflight captured yet",
});

export const DEFAULT_LAUNCHER_NPU_STATUS = Object.freeze({
  bitstream_loaded: false,
  bitstream_uuid: null,
  axi_base_addr: null,
  axi_stat_register_value: null,
  last_error: "fixture only; lower-layer evidence not supplied",
  serial_probe: DEFAULT_SERIAL_PREFLIGHT_STATUS,
});

export const DEFAULT_TRACE_MANIFEST = Object.freeze({
  schema_version: TRACE_MANIFEST_SCHEMA_VERSION,
  bitstream_uuid: "00000000-0000-0000-0000-000000000160",
  axi_base: "0x00000000a0000000",
  isa_version: "pccx_v002",
  frame_count: 1,
  checksums: Object.freeze([
    Object.freeze({
      algorithm: "sha256",
      value: "fixture-only-not-a-hardware-capture",
      frame_idx: null,
    }),
  ]),
  runbook_ref: "pccxai/pccx-lab#160",
  source_kind: "file_replay",
  frames: Object.freeze([
    Object.freeze({
      frame_idx: 0,
      axi_stat_register_value: 1,
      engine_completion_mask: 3,
      cycle_count: 128,
      result_payload: "a55a0001",
    }),
  ]),
});

const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b\s*[:=]/i;
const PRIVATE_PATH_PATTERN = /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+|[A-Za-z]:\\Users\\)/;
const MODEL_ARTIFACT_PATTERN =
  /\.(?:gguf|safetensors|ckpt|pt|pth|onnx|xclbin|bit)(?:\s|$|["'])/i;
const UNSUPPORTED_MARKER_PARTS = Object.freeze([
  ["production", "ready"],
  ["marketplace", "ready"],
  ["stable", "api"],
  ["stable", "abi"],
  ["kv260 inference ", "works"],
  ["gemma 3n e4b runs on ", "kv260"],
  ["20 tok/s ", "achieved"],
  ["timing ", "closed"],
]);
const APERTURE_MARK_SVG = `
<svg class="aperture-mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <polyline points="13,24 13,13 51,13 51,24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"></polyline>
  <polyline points="13,40 13,51 51,51 51,40" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"></polyline>
  <rect x="28" y="4" width="8" height="56" fill="#0b5fff"></rect>
  <rect x="24" y="4" width="16" height="3" fill="#0b5fff"></rect>
  <rect x="24" y="57" width="16" height="3" fill="#0b5fff"></rect>
</svg>`;
const STATUS_PRESENTATION = Object.freeze({
  pass: Object.freeze({ label: "PASS", className: "status-pass" }),
  blocked: Object.freeze({ label: "FAIL", className: "status-fail" }),
  not_run: Object.freeze({ label: "PENDING", className: "status-pending" }),
});
const EVIDENCE_PATHS_BY_ITEM_ID = Object.freeze({
  serial_tty_port: "launcher.serial_probe.tty_port",
  serial_login: "launcher.serial_probe.login_ok",
  serial_xrt: "launcher.serial_probe.xrt_present",
  serial_probe_timestamp: "launcher.serial_probe.last_preflight_at",
});
const EVIDENCE_SOURCES_BY_ITEM_ID = Object.freeze({
  serial_tty_port: "launcher serial preflight snapshot",
  serial_login: "launcher serial preflight snapshot",
  serial_xrt: "launcher serial preflight snapshot",
  serial_probe_timestamp: "launcher serial preflight snapshot",
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function addError(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function assertSafeText(value, errors) {
  let text = "";
  try {
    text = JSON.stringify(value ?? {});
  } catch {
    addError(errors, "input", "must be JSON-serializable");
    return;
  }
  const lower = text.toLowerCase();
  if (
    SECRET_ASSIGNMENT_PATTERN.test(text) ||
    PRIVATE_PATH_PATTERN.test(text) ||
    MODEL_ARTIFACT_PATTERN.test(text)
  ) {
    addError(errors, "input", "must not include secrets, private paths, or model artifact paths");
  }
  for (const parts of UNSUPPORTED_MARKER_PARTS) {
    if (lower.includes(parts.join(""))) {
      addError(errors, "input", "must not include unsupported runtime or readiness claims");
    }
  }
}

function stringField(value, path, errors, maxCharacters = 500) {
  if (typeof value !== "string" || value.trim().length === 0) {
    addError(errors, path, "must be a non-empty string");
    return "";
  }
  if (
    value.length > maxCharacters ||
    value.includes("\0") ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    addError(errors, path, `must be a single-line string up to ${maxCharacters} characters`);
  }
  return value;
}

function optionalStringField(value, path, errors, maxCharacters = 500) {
  if (value == null) {
    return null;
  }
  return stringField(value, path, errors, maxCharacters);
}

function boolField(value, path, errors) {
  if (typeof value !== "boolean") {
    addError(errors, path, "must be a boolean");
    return false;
  }
  return value;
}

function optionalBoolField(value, path, errors) {
  if (value == null) {
    return null;
  }
  return boolField(value, path, errors);
}

function optionalIntegerField(value, path, errors) {
  if (value == null) {
    return null;
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    addError(errors, path, "must be null or a non-negative integer");
    return null;
  }
  return value;
}

function optionalNonNegativeIntegerField(value, path, errors) {
  if (value == null) {
    return null;
  }
  return integerField(value, path, errors);
}

function integerField(value, path, errors) {
  if (!Number.isSafeInteger(value) || value < 0) {
    addError(errors, path, "must be a non-negative integer");
    return 0;
  }
  return value;
}

function firstPresent(value, keys) {
  for (const key of keys) {
    if (Object.hasOwn(value, key)) {
      return value[key];
    }
  }
  return undefined;
}

function compactWhitespace(value) {
  return String(value ?? "")
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function boundedSingleLine(value, maxCharacters = 160) {
  const text = compactWhitespace(value);
  if (text.length <= maxCharacters) {
    return text;
  }
  return `${text.slice(0, maxCharacters - 3)}...`;
}

function parseBooleanText(value) {
  const text = compactWhitespace(value).toLowerCase();
  if (/^(?:ok|pass|passed|true|yes|success|successful)$/.test(text)) {
    return true;
  }
  if (/^(?:fail|failed|false|no|not ok|blocked)$/.test(text)) {
    return false;
  }
  return null;
}

function parseIntegerText(value) {
  const text = compactWhitespace(value);
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const parsed = Number.parseInt(text, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function firstMatch(text, patterns, map = (match) => match[1]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = map(match);
      if (value != null && value !== "") {
        return value;
      }
    }
  }
  return null;
}

function parseWinningPort(text) {
  return firstMatch(text, [
    /\b(?:winning|selected|chosen)\s+(?:serial\s+)?port\s*[:=]\s*([^\s,;@]+)/i,
    /\bport\s*[:=]\s*([^\s,;@]+)[^\n\r]{0,80}\bbaud\b/i,
    /\b([/A-Za-z0-9_.:-]*(?:tty|cu|COM)[A-Za-z0-9_.:-]*)\s*@\s*\d{4,7}\b/i,
  ], (match) => boundedSingleLine(match[1], 80));
}

function parseBaud(text) {
  return firstMatch(text, [
    /\b(?:winning|selected|chosen)\s+(?:serial\s+)?port\s*[:=]\s*[^\s,;@]+(?:\s*(?:@|,|\bbaud\b)\s*(?:baud\s*)?)(\d{4,7})\b/i,
    /\bbaud(?:rate)?\s*[:=]?\s*(\d{4,7})\b/i,
    /\b[/A-Za-z0-9_.:-]*(?:tty|cu|COM)[A-Za-z0-9_.:-]*\s*@\s*(\d{4,7})\b/i,
  ], (match) => parseIntegerText(match[1]));
}

function parseLoginOk(text) {
  return firstMatch(text, [
    /\blogin[_\s-]*ok\s*[:=]\s*(ok|pass|passed|true|yes|success|successful|fail|failed|false|no|not ok|blocked)\b/i,
    /\blogin\s*[:=]\s*(ok|pass|passed|true|yes|success|successful|fail|failed|false|no|not ok|blocked)\b/i,
    /\blogin\s+(ok|successful|failed)\b/i,
  ], (match) => parseBooleanText(match[1]));
}

function parseUname(text) {
  return firstMatch(text, [
    /\b(?:kernel[_\s-]*)?uname(?:\s+-a)?\s*[:=]\s*([^\n\r]+)/i,
    /(?:^|\n)\s*\$?\s*uname\s+-a\s*\r?\n\s*([^\n\r]+)/i,
  ], (match) => boundedSingleLine(match[1], 240));
}

function parseXrtVersion(text) {
  return firstMatch(text, [
    /\bxrt(?:[_\s-]*(?:version|build version))?\s*[:=]\s*([^\n\r]+)/i,
    /\bxrt-smi[^\n\r]{0,80}\bversion\s*[:=]\s*([^\n\r]+)/i,
  ], (match) => boundedSingleLine(match[1], 120));
}

function parseXmutilAppCount(text) {
  return firstMatch(text, [
    /\bxmutil(?:\s+(?:app|apps|application|applications))?\s+count\s*[:=]\s*(\d+)\b/i,
    /\bxmutil[^\n\r]{0,80}\b(?:app|apps|application|applications)\b[^\n\r]{0,40}\bcount\s*[:=]\s*(\d+)\b/i,
    /\bxmutil[^\n\r]{0,80}\b(\d+)\s+(?:app|apps|application|applications)\b/i,
  ], (match) => parseIntegerText(match[1]));
}

function normalizePreflightTranscriptSummary(summary = DEFAULT_PREFLIGHT_TRANSCRIPT_SUMMARY) {
  const errors = [];
  if (!isObject(summary)) {
    throw new Error("preflight transcript summary must be an object");
  }
  const captured = summary.captured === true || summary.status === "captured";
  const normalized = {
    status: captured ? "captured" : "not_captured",
    captured,
    winningPort: optionalStringField(
      summary.winningPort,
      "preflightTranscript.winningPort",
      errors,
      80,
    ),
    baud: optionalNonNegativeIntegerField(summary.baud, "preflightTranscript.baud", errors),
    loginOk: optionalBoolField(summary.loginOk, "preflightTranscript.loginOk", errors),
    uname: optionalStringField(summary.uname, "preflightTranscript.uname", errors, 240),
    xrtVersion: optionalStringField(
      summary.xrtVersion,
      "preflightTranscript.xrtVersion",
      errors,
      120,
    ),
    xmutilAppCount: optionalNonNegativeIntegerField(
      summary.xmutilAppCount,
      "preflightTranscript.xmutilAppCount",
      errors,
    ),
    message: optionalStringField(summary.message, "preflightTranscript.message", errors, 160),
  };
  normalized.unameDisplay = captured
    ? truncateText(normalized.uname, 80)
    : DEFAULT_PREFLIGHT_TRANSCRIPT_SUMMARY.unameDisplay;
  normalized.message = normalized.message ??
    (captured ? "preflight transcript captured" : DEFAULT_PREFLIGHT_TRANSCRIPT_SUMMARY.message);
  assertSafeText(normalized, errors);
  if (errors.length > 0) {
    throw new Error(`invalid preflight transcript summary: ${errors.join("; ")}`);
  }
  return Object.freeze(normalized);
}

export function parseKv260PreflightTranscript(text = "") {
  const transcript = typeof text === "string" ? text : "";
  if (transcript.trim().length === 0) {
    return normalizePreflightTranscriptSummary();
  }
  const summary = {
    status: "captured",
    captured: true,
    winningPort: parseWinningPort(transcript),
    baud: parseBaud(transcript),
    loginOk: parseLoginOk(transcript),
    uname: parseUname(transcript),
    xrtVersion: parseXrtVersion(transcript),
    xmutilAppCount: parseXmutilAppCount(transcript),
    message: "preflight transcript captured",
  };
  if (
    summary.winningPort == null &&
    summary.baud == null &&
    summary.loginOk == null &&
    summary.uname == null &&
    summary.xrtVersion == null &&
    summary.xmutilAppCount == null
  ) {
    return normalizePreflightTranscriptSummary();
  }
  return normalizePreflightTranscriptSummary(summary);
}

function preflightTranscriptFromInput(inputs) {
  if (typeof inputs.preflightTranscriptText === "string") {
    return parseKv260PreflightTranscript(inputs.preflightTranscriptText);
  }
  return normalizePreflightTranscriptSummary(
    inputs.preflightTranscript ?? inputs.preflightTranscriptSummary,
  );
}

function arrayField(value, path, errors) {
  if (!Array.isArray(value)) {
    addError(errors, path, "must be an array");
    return [];
  }
  return value;
}

function normalizeSerialPreflightStatus(value, errors) {
  const probe = value ?? DEFAULT_SERIAL_PREFLIGHT_STATUS;
  if (!isObject(probe)) {
    addError(errors, "serial_probe", "must be an object");
    return { ...DEFAULT_SERIAL_PREFLIGHT_STATUS };
  }
  const schemaVersion = probe.schema_version ?? LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION;
  if (schemaVersion !== LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION) {
    addError(
      errors,
      "serial_probe.schema_version",
      `must be ${LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION}`,
    );
  }
  const status = probe.status ?? "not_run";
  if (!["available", "blocked", "not_run"].includes(status)) {
    addError(errors, "serial_probe.status", "must be available, blocked, or not_run");
  }
  return {
    schema_version: schemaVersion,
    status,
    tty_port: optionalStringField(probe.tty_port, "serial_probe.tty_port", errors, 240),
    login_ok: optionalBoolField(probe.login_ok, "serial_probe.login_ok", errors),
    kernel_uname: optionalStringField(
      probe.kernel_uname,
      "serial_probe.kernel_uname",
      errors,
      500,
    ),
    xrt_present: optionalBoolField(probe.xrt_present, "serial_probe.xrt_present", errors),
    last_preflight_at: optionalStringField(
      firstPresent(probe, ["last_preflight_at", "checked_at"]),
      "serial_probe.last_preflight_at",
      errors,
      120,
    ),
  };
}

function normalizeTraceFrame(value, index, errors) {
  const frame = isObject(value) ? value : {};
  if (!isObject(value)) {
    addError(errors, `frames[${index}]`, "must be an object");
  }
  const resultPayload = frame.result_payload == null
    ? null
    : stringField(frame.result_payload, `frames[${index}].result_payload`, errors, 10000);
  const error = frame.error == null ? null : frame.error;
  if (error != null && !isObject(error)) {
    addError(errors, `frames[${index}].error`, "must be null or an object");
  }
  return {
    frame_idx: integerField(frame.frame_idx, `frames[${index}].frame_idx`, errors),
    axi_stat_register_value: integerField(
      frame.axi_stat_register_value,
      `frames[${index}].axi_stat_register_value`,
      errors,
    ),
    engine_completion_mask: integerField(
      frame.engine_completion_mask,
      `frames[${index}].engine_completion_mask`,
      errors,
    ),
    cycle_count: integerField(frame.cycle_count, `frames[${index}].cycle_count`, errors),
    result_payload: resultPayload,
    error,
  };
}

export class LauncherStatusReader {
  static consume(status = DEFAULT_LAUNCHER_NPU_STATUS) {
    const errors = [];
    if (!isObject(status)) {
      throw new Error("launcher NPU status must be an object");
    }
    assertSafeText(status, errors);
    const normalized = {
      bitstream_loaded: boolField(status.bitstream_loaded, "bitstream_loaded", errors),
      bitstream_uuid: optionalStringField(status.bitstream_uuid, "bitstream_uuid", errors, 160),
      axi_base_addr: optionalIntegerField(status.axi_base_addr, "axi_base_addr", errors),
      axi_stat_register_value: optionalIntegerField(
        status.axi_stat_register_value,
        "axi_stat_register_value",
        errors,
      ),
      last_error: optionalStringField(status.last_error, "last_error", errors, 500),
      serial_probe: normalizeSerialPreflightStatus(status.serial_probe, errors),
    };
    if (errors.length > 0) {
      throw new Error(errors.join("; "));
    }
    return Object.freeze(normalized);
  }
}

export class LabTraceReader {
  static consume(manifest = DEFAULT_TRACE_MANIFEST) {
    const errors = [];
    if (!isObject(manifest)) {
      throw new Error("trace manifest must be an object");
    }
    assertSafeText(manifest, errors);
    const schemaVersion = stringField(manifest.schema_version, "schema_version", errors);
    if (schemaVersion !== TRACE_MANIFEST_SCHEMA_VERSION) {
      addError(errors, "schema_version", `must be ${TRACE_MANIFEST_SCHEMA_VERSION}`);
    }
    const sourceKind = stringField(manifest.source_kind, "source_kind", errors);
    if (sourceKind !== "file_replay") {
      addError(errors, "source_kind", "must be file_replay");
    }
    const frames = arrayField(manifest.frames, "frames", errors)
      .map((frame, index) => normalizeTraceFrame(frame, index, errors));
    const frameCount = integerField(manifest.frame_count, "frame_count", errors);
    if (frameCount !== frames.length) {
      addError(errors, "frame_count", "must match inline frames");
    }
    const normalized = {
      schema_version: schemaVersion,
      bitstream_uuid: stringField(manifest.bitstream_uuid, "bitstream_uuid", errors, 160),
      axi_base: stringField(manifest.axi_base, "axi_base", errors, 80),
      isa_version: stringField(manifest.isa_version, "isa_version", errors, 80),
      frame_count: frameCount,
      checksums: arrayField(manifest.checksums, "checksums", errors).map(clone),
      runbook_ref: stringField(manifest.runbook_ref, "runbook_ref", errors, 240),
      source_kind: sourceKind,
      frames,
    };
    if (errors.length > 0) {
      throw new Error(errors.join("; "));
    }
    return Object.freeze(normalized);
  }
}

function hexOrUnavailable(value) {
  return value == null ? "unavailable" : `0x${value.toString(16)}`;
}

function yesNo(value) {
  return value ? "yes" : "no";
}

function probeEvidence(probe, value, unavailable = "preflight not run") {
  if (probe.status === "not_run") {
    return unavailable;
  }
  if (value == null || value === "") {
    return "unavailable";
  }
  return value;
}

function boolProbeItem(itemId, label, probe, value, trueText, falseText) {
  const notRun = probe.status === "not_run";
  return Object.freeze({
    itemId,
    label,
    state: notRun ? "not_run" : value ? "pass" : "blocked",
    satisfied: value === true,
    evidence: notRun ? "preflight not run" : value ? trueText : falseText,
  });
}

function truncateText(value, maxCharacters = 96) {
  if (!value) {
    return "preflight not run";
  }
  if (value.length <= maxCharacters) {
    return value;
  }
  return `${value.slice(0, maxCharacters - 3)}...`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusPresentationForItem(item) {
  const state = item.state ?? (item.satisfied ? "pass" : "blocked");
  return STATUS_PRESENTATION[state] ?? STATUS_PRESENTATION.not_run;
}

function evidencePathForItem(item) {
  return EVIDENCE_PATHS_BY_ITEM_ID[item.itemId] ?? "panel.preflight.items";
}

function evidenceSourceForItem(item) {
  return EVIDENCE_SOURCES_BY_ITEM_ID[item.itemId] ?? "readiness panel input";
}

function panelEmptyState(panel) {
  if (panel.serialProbe.status === "not_run") {
    return "Launcher status input is not configured, so no serial preflight snapshot is available. Set the launcher-side status JSON input before relying on this panel; the IDE does not probe the board.";
  }
  if (panel.serialProbe.status === "blocked") {
    return "The launcher serial preflight reports the board is not reachable. Keep launch paths gated until the launcher writes a fresh reachable snapshot.";
  }
  return "";
}

export function createPreflightProposal(launcherStatus, _traceManifest) {
  const probe = launcherStatus.serial_probe;
  return Object.freeze({
    kind: "kv260-preflight-proposal",
    items: Object.freeze([
      Object.freeze({
        itemId: "serial_tty_port",
        label: "serial tty port",
        state: probe.status === "not_run" ? "not_run" : probe.tty_port ? "pass" : "blocked",
        satisfied: Boolean(probe.tty_port),
        evidence: probeEvidence(probe, probe.tty_port),
      }),
      boolProbeItem("serial_login", "serial login", probe, probe.login_ok, "login OK", "login not OK"),
      boolProbeItem("serial_xrt", "XRT present", probe, probe.xrt_present, "xrt_present true", "xrt_present false"),
      Object.freeze({
        itemId: "serial_probe_timestamp",
        label: "serial preflight timestamp",
        state: probe.status === "not_run" ? "not_run" : probe.last_preflight_at ? "pass" : "blocked",
        satisfied: Boolean(probe.last_preflight_at),
        evidence: probeEvidence(probe, probe.last_preflight_at),
      }),
    ]),
  });
}

export function createKv260StatusPanel(inputs = {}) {
  const launcherStatus = LauncherStatusReader.consume(inputs.launcherStatus);
  const traceManifest = LabTraceReader.consume(inputs.traceManifest);
  const preflightTranscript = preflightTranscriptFromInput(inputs);
  return Object.freeze({
    version: KV260_STATUS_PANEL_VERSION,
    kind: "kv260-status-panel",
    source: Object.freeze({
      launcherTypeMirror: LAUNCHER_NPU_STATUS_MIRROR_VERSION,
      labManifestParser: "real",
      adapterOutput: true,
      executesLauncher: false,
      executesPccxLab: false,
      rawManifestParsedByUi: false,
    }),
    launcher: Object.freeze(launcherStatus),
    serialProbe: Object.freeze({
      schemaVersion: launcherStatus.serial_probe.schema_version,
      status: launcherStatus.serial_probe.status,
      ttyPort: launcherStatus.serial_probe.tty_port,
      loginOk: launcherStatus.serial_probe.login_ok,
      kernelUname: launcherStatus.serial_probe.kernel_uname,
      kernelUnameDisplay: truncateText(launcherStatus.serial_probe.kernel_uname),
      xrtPresent: launcherStatus.serial_probe.xrt_present,
      lastPreflightAt: launcherStatus.serial_probe.last_preflight_at,
    }),
    lab: Object.freeze({
      schemaVersion: traceManifest.schema_version,
      bitstreamUuid: traceManifest.bitstream_uuid,
      axiBase: traceManifest.axi_base,
      isaVersion: traceManifest.isa_version,
      frameCount: traceManifest.frame_count,
      sourceKind: traceManifest.source_kind,
      runbookRef: traceManifest.runbook_ref,
    }),
    preflight: createPreflightProposal(launcherStatus, traceManifest),
    preflightTranscript,
    safety: Object.freeze({
      dataOnly: true,
      readOnly: true,
      localOnly: true,
      launcherExecution: false,
      pccxLabExecution: false,
      shellExecution: false,
      sshExecution: false,
      kv260Control: false,
      providerCalls: false,
      networkCalls: false,
      telemetry: false,
      automaticUpload: false,
      writeBack: false,
    }),
  });
}

export function kv260StatusPanelJson(inputs = {}) {
  return `${JSON.stringify(createKv260StatusPanel(inputs), null, 2)}\n`;
}

export function renderKv260StatusPanelHtml(panel = createKv260StatusPanel()) {
  const emptyState = panelEmptyState(panel);
  const transcript = panel.preflightTranscript ?? DEFAULT_PREFLIGHT_TRANSCRIPT_SUMMARY;
  const transcriptWinning = transcript.winningPort
    ? `${transcript.winningPort}${transcript.baud == null ? "" : ` @ ${transcript.baud}`}`
    : "not captured";
  const checklistItems = panel.preflight.items.map((item) => {
    const status = statusPresentationForItem(item);
    const evidencePath = evidencePathForItem(item);
    const evidenceSource = evidenceSourceForItem(item);
    return `
      <li class="checklist-item">
        <div class="checklist-row">
          <span class="checklist-label">${escapeHtml(item.label)}</span>
          <span class="status-pill ${status.className}">${status.label}</span>
        </div>
        <details class="evidence-path">
          <summary>Evidence path</summary>
          <dl>
            <dt>Artifact source</dt>
            <dd>${escapeHtml(evidenceSource)}</dd>
            <dt>Artifact field</dt>
            <dd><code>${escapeHtml(evidencePath)}</code></dd>
            <dt>Rendered evidence</dt>
            <dd>${escapeHtml(item.evidence)}</dd>
          </dl>
        </details>
      </li>`;
  }).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>KV260 Readiness</title>
  <style>
    :root {
      color-scheme: light dark;
      --panel-border: var(--vscode-panel-border, #d1d5db);
      --panel-muted: var(--vscode-descriptionForeground, #4b5563);
      --panel-bg: var(--vscode-editor-background, #ffffff);
      --panel-fg: var(--vscode-editor-foreground, #111827);
      --panel-soft: var(--vscode-editorWidget-background, #f9fafb);
      --panel-accent: #0b5fff;
      --pass-bg: #dcfce7;
      --pass-fg: #166534;
      --pass-border: #86efac;
      --pending-bg: #fef3c7;
      --pending-fg: #92400e;
      --pending-border: #fbbf24;
      --fail-bg: #fee2e2;
      --fail-fg: #991b1b;
      --fail-border: #fca5a5;
    }
    body {
      margin: 0;
      padding: 20px;
      background: var(--panel-bg);
      color: var(--panel-fg);
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      line-height: 1.45;
    }
    .panel-shell {
      max-width: 880px;
      margin: 0 auto;
    }
    .panel-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--panel-border);
    }
    .aperture-mark {
      width: 36px;
      height: 36px;
      color: var(--panel-fg);
      flex: 0 0 auto;
    }
    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 650;
      letter-spacing: 0;
    }
    .subtitle {
      margin: 2px 0 0;
      color: var(--panel-muted);
    }
    .empty-state {
      margin: 16px 0;
      padding: 12px 14px;
      border: 1px solid var(--pending-border);
      background: var(--pending-bg);
      color: var(--pending-fg);
    }
    .metadata {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
      margin: 16px 0;
    }
    .metadata-item {
      padding: 10px 12px;
      border: 1px solid var(--panel-border);
      background: var(--panel-soft);
    }
    .metadata-label {
      display: block;
      margin-bottom: 2px;
      color: var(--panel-muted);
      font-size: 12px;
    }
    .metadata-value {
      font-family: var(--vscode-editor-font-family, ui-monospace, monospace);
      overflow-wrap: anywhere;
    }
    .summary-card {
      margin: 14px 0 18px;
      padding: 12px;
      border: 1px solid var(--panel-border);
      background: var(--panel-soft);
    }
    .summary-card h2 {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 650;
      letter-spacing: 0;
    }
    .summary-card .summary-state {
      margin: 0 0 10px;
      color: var(--panel-muted);
    }
    .checklist {
      list-style: none;
      margin: 0;
      padding: 0;
      border-top: 1px solid var(--panel-border);
    }
    .checklist-item {
      padding: 12px 0;
      border-bottom: 1px solid var(--panel-border);
    }
    .checklist-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .checklist-label {
      font-weight: 600;
    }
    .status-pill {
      min-width: 74px;
      padding: 3px 8px;
      border: 1px solid;
      border-radius: 999px;
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .status-pass {
      background: var(--pass-bg);
      border-color: var(--pass-border);
      color: var(--pass-fg);
    }
    .status-pending {
      background: var(--pending-bg);
      border-color: var(--pending-border);
      color: var(--pending-fg);
    }
    .status-fail {
      background: var(--fail-bg);
      border-color: var(--fail-border);
      color: var(--fail-fg);
    }
    .evidence-path {
      margin-top: 8px;
      color: var(--panel-muted);
    }
    .evidence-path summary {
      cursor: pointer;
      width: fit-content;
      color: var(--panel-accent);
    }
    dl {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 4px 10px;
      margin: 8px 0 0;
      padding-left: 10px;
      border-left: 2px solid var(--panel-border);
    }
    dt {
      color: var(--panel-muted);
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    code {
      font-family: var(--vscode-editor-font-family, ui-monospace, monospace);
      font-size: 0.95em;
    }
  </style>
</head>
<body>
  <main class="panel-shell">
    <header class="panel-header">
      ${APERTURE_MARK_SVG}
      <div>
        <h1>KV260 Readiness</h1>
        <p class="subtitle">Read-only launcher and lab status surface</p>
      </div>
    </header>
    ${emptyState ? `<p class="empty-state">${escapeHtml(emptyState)}</p>` : ""}
    <section class="metadata" aria-label="Status metadata">
      <div class="metadata-item">
        <span class="metadata-label">Serial preflight</span>
        <span class="metadata-value">${escapeHtml(panel.serialProbe.status)}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">TTY port</span>
        <span class="metadata-value">${escapeHtml(panel.serialProbe.ttyPort || "not supplied")}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Lab manifest</span>
        <span class="metadata-value">${escapeHtml(`${panel.lab.sourceKind}; ${panel.lab.frameCount} frame(s)`)}</span>
      </div>
    </section>
    <section class="summary-card" aria-label="Preflight transcript summary">
      <h2>Preflight Transcript</h2>
      <p class="summary-state">${escapeHtml(transcript.message)}</p>
      <dl>
        <dt>Winning port</dt>
        <dd>${escapeHtml(transcriptWinning)}</dd>
        <dt>Login OK</dt>
        <dd>${escapeHtml(transcript.loginOk == null ? "not captured" : yesNo(transcript.loginOk))}</dd>
        <dt>uname</dt>
        <dd>${escapeHtml(transcript.unameDisplay)}</dd>
        <dt>XRT version</dt>
        <dd>${escapeHtml(transcript.xrtVersion || "not captured")}</dd>
        <dt>xmutil apps</dt>
        <dd>${escapeHtml(transcript.xmutilAppCount == null ? "not captured" : String(transcript.xmutilAppCount))}</dd>
      </dl>
    </section>
    <ol class="checklist" aria-label="Readiness checklist">
      ${checklistItems}
    </ol>
  </main>
</body>
</html>`;
}

export function formatKv260StatusPanel(panel = createKv260StatusPanel()) {
  const lines = [
    "KV260 Status Surface",
    `version: ${panel.version}`,
    `launcherMirror: ${panel.source.launcherTypeMirror}`,
    `launcher.bitstreamLoaded: ${yesNo(panel.launcher.bitstream_loaded)}`,
    `launcher.bitstreamUuid: ${panel.launcher.bitstream_uuid || "unavailable"}`,
    `launcher.axiBaseAddr: ${hexOrUnavailable(panel.launcher.axi_base_addr)}`,
    `launcher.axiStatus: ${hexOrUnavailable(panel.launcher.axi_stat_register_value)}`,
    `launcher.lastError: ${panel.launcher.last_error || "none"}`,
    `serial.ttyPort: ${panel.serialProbe.ttyPort || "preflight not run"}`,
    `serial.kernelUname: ${panel.serialProbe.kernelUnameDisplay}`,
    `serial.xrtPresent: ${
      panel.serialProbe.xrtPresent == null ? "preflight not run" : yesNo(panel.serialProbe.xrtPresent)
    }`,
    `serial.lastPreflightAt: ${panel.serialProbe.lastPreflightAt || "preflight not run"}`,
    `lab.schema: ${panel.lab.schemaVersion}`,
    `lab.sourceKind: ${panel.lab.sourceKind}`,
    `lab.frames: ${panel.lab.frameCount}`,
    `lab.axiBase: ${panel.lab.axiBase}`,
    `lab.isaVersion: ${panel.lab.isaVersion}`,
    `preflightTranscript: ${panel.preflightTranscript.message}`,
    `preflightTranscript.winning: ${
      panel.preflightTranscript.winningPort
        ? `${panel.preflightTranscript.winningPort}${
          panel.preflightTranscript.baud == null ? "" : ` @ ${panel.preflightTranscript.baud}`
        }`
        : "not captured"
    }`,
    `preflightTranscript.loginOk: ${
      panel.preflightTranscript.loginOk == null ? "not captured" : yesNo(panel.preflightTranscript.loginOk)
    }`,
    `preflightTranscript.uname: ${panel.preflightTranscript.unameDisplay}`,
    `preflightTranscript.xrtVersion: ${panel.preflightTranscript.xrtVersion || "not captured"}`,
    `preflightTranscript.xmutilAppCount: ${
      panel.preflightTranscript.xmutilAppCount == null
        ? "not captured"
        : panel.preflightTranscript.xmutilAppCount
    }`,
    "preflight:",
  ];
  for (const item of panel.preflight.items) {
    const state = item.state ?? (item.satisfied ? "pass" : "blocked");
    lines.push(`- ${item.label}: ${state} (${item.evidence})`);
  }
  lines.push("execution: no launcher, no pccx-lab, no shell, no SSH, no KV260 control");
  lines.push("writeBack: no");
  return `${lines.join("\n")}\n`;
}
