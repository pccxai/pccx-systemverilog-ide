// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";

import {
  VALIDATION_PATCH_HANDOFF_VERSION,
  createValidationPatchHandoffSeed,
  createValidationPatchHandoffStatus,
} from "../src/validation-patch-handoff.mjs";

function failedValidation(overrides = {}) {
  return {
    proposalId: "vscodeAdapterSmoke",
    status: "failed",
    summaryText: "VS Code adapter smoke failed (exit 1)",
    stdoutSummary: {
      lines: ["adapter ok", "TOKEN=hidden", "error: missing endmodule"],
      lineCount: 3,
      truncated: false,
    },
    stderrSummary: {
      lines: ["/home/dev/repo/rtl/top.sv:1: failure"],
      lineCount: 1,
      truncated: false,
    },
    failureHints: ["TOKEN=hidden", "failure: missing endmodule"],
    truncated: false,
    redactionApplied: false,
    ...overrides,
  };
}

function testFailedValidationCreatesBoundedContextSeed() {
  const seed = createValidationPatchHandoffSeed(
    failedValidation(),
    {
      workspaceRoot: "/repo",
      relatedDiagnostics: [
        {
          file: "/repo/rtl/top.sv",
          severity: "Error",
          message: "missing endmodule",
          source: "pccx_ide_cli",
          code: "PCCX-SCAFFOLD-003",
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 6 },
          },
        },
      ],
    },
    { workspaceRoot: "/repo" },
  );
  const serialized = JSON.stringify(seed);

  assert.equal(seed.version, VALIDATION_PATCH_HANDOFF_VERSION);
  assert.equal(seed.kind, "validation-patch-context-seed");
  assert.equal(seed.validationProposalId, "vscodeAdapterSmoke");
  assert.equal(seed.validationStatus, "failed");
  assert.match(seed.boundedFailureSummary, /VS Code adapter smoke failed/);
  assert.match(seed.boundedFailureSummary, /\[redacted\]/);
  assert.match(seed.boundedFailureSummary, /\[home\]/);
  assert.deepEqual(seed.candidateFiles, ["rtl/top.sv"]);
  assert.equal(seed.relatedDiagnostics.length, 1);
  assert.equal(seed.relatedDiagnostics[0].path, "rtl/top.sv");
  assert.equal(seed.relatedDiagnostics[0].message, "missing endmodule");
  assert.deepEqual(seed.suggestedValidationPlan, [
    "Re-run vscodeAdapterSmoke through the approved validation proposal after user-reviewed changes.",
  ]);
  assert.equal(seed.safety.summaryOnly, true);
  assert.equal(seed.safety.fullLogsExcluded, true);
  assert.equal(seed.safety.generatesPatch, false);
  assert.equal(seed.safety.appliesPatch, false);
  assert.equal(seed.safety.providerCalls, false);
  assert.equal(seed.safety.pccxLabExecution, false);
  assert.doesNotMatch(serialized, /TOKEN=hidden/);
  assert.doesNotMatch(serialized, /\/home\/dev/);
}

function testPassingValidationDoesNotCreateFakeFixSeed() {
  const seed = createValidationPatchHandoffSeed({
    proposalId: "pytestBaseline",
    status: "passed",
    summaryText: "pytest baseline passed",
  });

  assert.equal(seed, null);
}

function testHandoffBoundsDiagnosticsAndExcludesUnsafePaths() {
  const diagnostics = [
    { file: "/repo/rtl/z.sv", message: "z" },
    { file: "/repo/node_modules/pkg/ignored.sv", message: "ignored" },
    { file: "/repo/.private-agent/private.md", message: "ignored" },
    { file: "/home/dev/outside.sv", message: "outside" },
    { file: "/repo/rtl/a.sv", message: "a" },
    { file: "/repo/rtl/b.sv", message: "b" },
  ];
  const seed = createValidationPatchHandoffSeed(
    failedValidation({
      summaryText: "x".repeat(120),
      stdoutSummary: { lines: ["error " + "y".repeat(120)], lineCount: 1, truncated: true },
      stderrSummary: { lines: [], lineCount: 0, truncated: false },
      truncated: true,
    }),
    {
      workspaceRoot: "/repo",
      relatedDiagnostics: diagnostics,
      candidateFiles: [
        "/repo/rtl/explicit.sv",
        "/repo/package-lock.json",
        "/repo/rtl/api-token.sv",
      ],
    },
    {
      workspaceRoot: "/repo",
      limits: {
        maxFailureSummaryCharacters: 40,
        maxDiagnostics: 2,
        maxCandidateFiles: 2,
      },
    },
  );
  const serialized = JSON.stringify(seed);

  assert.ok(seed.boundedFailureSummary.length <= 40);
  assert.deepEqual(seed.relatedDiagnostics.map((diagnostic) => diagnostic.path), [
    "rtl/a.sv",
    "rtl/b.sv",
  ]);
  assert.deepEqual(seed.candidateFiles, ["rtl/explicit.sv", "rtl/a.sv"]);
  assert.equal(seed.sourceFlags.validationTruncated, true);
  assert.doesNotMatch(serialized, /package-lock\.json/);
  assert.doesNotMatch(serialized, /api-token/);
  assert.doesNotMatch(serialized, /node_modules/);
  assert.doesNotMatch(serialized, /\.private-agent/);
  assert.doesNotMatch(serialized, /\/home\/dev/);
}

function testHandoffStatusIsContractOnly() {
  const status = createValidationPatchHandoffStatus();

  assert.equal(status.version, VALIDATION_PATCH_HANDOFF_VERSION);
  assert.equal(status.proposalOnly, true);
  assert.equal(status.contextSeedOnly, true);
  assert.equal(status.generatesPatch, false);
  assert.equal(status.appliesPatch, false);
  assert.equal(status.writesFiles, false);
  assert.equal(status.providerCalls, false);
  assert.equal(status.runtimeCalls, false);
  assert.equal(status.launcherCalls, false);
  assert.equal(status.pccxLabExecution, false);
}

testFailedValidationCreatesBoundedContextSeed();
testPassingValidationDoesNotCreateFakeFixSeed();
testHandoffBoundsDiagnosticsAndExcludesUnsafePaths();
testHandoffStatusIsContractOnly();

console.log("vscode validation patch handoff tests ok");
