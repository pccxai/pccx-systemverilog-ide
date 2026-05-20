// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";

import {
  buildVeribleLintInvocation,
  parseVeribleLintOutput,
  runVeribleLint,
} from "../src/verible-lint.mjs";

function testLintInvocationUsesFixedArgs() {
  assert.deepEqual(buildVeribleLintInvocation("/repo/top.sv"), {
    executable: "verible-verilog-lint",
    args: [
      "--lint_fatal=false",
      "--parse_fatal=false",
      "--rules_config_search",
      "/repo/top.sv",
    ],
    shell: false,
  });
  assert.throws(
    () => buildVeribleLintInvocation("/repo/top.sv", { command: "verible-verilog-lint --rules" }),
    /without arguments/,
  );
}

function testParseVeribleDiagnostics() {
  const diagnostics = parseVeribleLintOutput(
    [
      "/repo/top.sv:4:8: syntax error at token \"endmodule\"",
      "/repo/pkg.sv:2:1: Style finding [package-filename]",
    ].join("\n"),
    "/repo/top.sv",
  );

  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0].severity, "Error");
  assert.equal(diagnostics[0].range.start.line, 3);
  assert.equal(diagnostics[0].range.start.character, 7);
  assert.equal(diagnostics[0].source, "verible-verilog-lint");
  assert.equal(diagnostics[1].severity, "Warning");
  assert.equal(diagnostics[1].code, "package-filename");
}

async function testRunVeribleLintUsesInjectedExecFile() {
  const result = await runVeribleLint(
    "/repo/top.sv",
    { command: "verible-verilog-lint" },
    {
      execFile(executable, args, options, callback) {
        assert.equal(executable, "verible-verilog-lint");
        assert.deepEqual(args.slice(0, 3), [
          "--lint_fatal=false",
          "--parse_fatal=false",
          "--rules_config_search",
        ]);
        assert.equal(options.shell, false);
        callback({ code: 1 }, "", "/repo/top.sv:1:1: lint warning [rule]\n");
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.diagnosticCount, 1);
  assert.equal(result.diagnostics[0].code, "rule");
}

testLintInvocationUsesFixedArgs();
testParseVeribleDiagnostics();
await testRunVeribleLintUsesInjectedExecFile();

console.log("verible lint tests ok");
