// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import { execFile } from "node:child_process";

const DEFAULT_LINT_COMMAND = "verible-verilog-lint";
const DEFAULT_TIMEOUT_MS = 30000;

function lintCommand(config = {}) {
  const command = config.command ?? DEFAULT_LINT_COMMAND;
  if (typeof command !== "string" || command.trim().length === 0 || /\s/.test(command)) {
    throw new Error("verible lint command must be a command name or path without arguments");
  }
  return command;
}

export function buildVeribleLintInvocation(filePath, config = {}) {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new Error("verible lint file path is required");
  }
  return {
    executable: lintCommand(config),
    args: [
      "--lint_fatal=false",
      "--parse_fatal=false",
      "--rules_config_search",
      filePath,
    ],
    shell: false,
  };
}

function rangeFromOneBased(line, column) {
  const startLine = Math.max(0, (Number.parseInt(line, 10) || 1) - 1);
  const startCharacter = Math.max(0, (Number.parseInt(column, 10) || 1) - 1);
  return {
    start: {
      line: startLine,
      character: startCharacter,
    },
    end: {
      line: startLine,
      character: startCharacter + 1,
    },
  };
}

function diagnosticSeverity(message) {
  return /\b(?:error|syntax)\b/i.test(message) ? "Error" : "Warning";
}

function diagnosticCode(message) {
  const match = /\[([^\]]+)\]\s*$/.exec(message);
  return match ? match[1] : "verible-verilog-lint";
}

export function parseVeribleLintOutput(output, fallbackFile) {
  const diagnostics = [];
  for (const rawLine of String(output ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }
    const match = /^(.*?):(\d+):(\d+):\s*(.+)$/.exec(line);
    if (!match) {
      continue;
    }
    const [, file, oneBasedLine, oneBasedColumn, message] = match;
    diagnostics.push({
      file: file || fallbackFile,
      range: rangeFromOneBased(oneBasedLine, oneBasedColumn),
      severity: diagnosticSeverity(message),
      message,
      source: "verible-verilog-lint",
      code: diagnosticCode(message),
    });
  }
  return diagnostics;
}

function captureExecFile(executable, args, options = {}) {
  const execFileFn = options.execFile ?? execFile;
  return new Promise((resolveResult) => {
    execFileFn(
      executable,
      args,
      {
        cwd: options.cwd,
        encoding: "utf8",
        env: options.env ?? process.env,
        maxBuffer: 1024 * 1024,
        shell: false,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      },
      (error, stdout, stderr) => {
        const exitCode = error ? (typeof error.code === "number" ? error.code : null) : 0;
        resolveResult({
          ok: exitCode === 0 && !error,
          exitCode,
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          error: error && typeof error.code !== "number" ? error.message : undefined,
        });
      },
    );
  });
}

export async function runVeribleLint(filePath, config = {}, deps = {}) {
  const invocation = buildVeribleLintInvocation(filePath, config);
  const result = await captureExecFile(invocation.executable, invocation.args, deps);
  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  const diagnostics = parseVeribleLintOutput(combinedOutput, filePath);
  return {
    kind: "verible-lint-diagnostics",
    ok: result.ok || diagnostics.length > 0,
    executable: invocation.executable,
    args: invocation.args,
    shell: false,
    file: filePath,
    exitCode: result.exitCode,
    diagnostics,
    diagnosticCount: diagnostics.length,
    stderr: result.stderr,
    error: result.error,
  };
}
