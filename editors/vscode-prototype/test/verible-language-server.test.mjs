// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import {
  JsonRpcMessageBuffer,
  buildVeribleLanguageServerInvocation,
  createVeribleLanguageServerClient,
  encodeJsonRpcMessage,
} from "../src/verible-language-server.mjs";

class FakeProcess extends EventEmitter {
  constructor() {
    super();
    this.stdin = new PassThrough();
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
    this.killed = false;
  }

  kill() {
    this.killed = true;
    this.emit("exit", 0, null);
  }
}

function decodeMessages(chunks) {
  const buffer = new JsonRpcMessageBuffer();
  return chunks.flatMap((chunk) => buffer.push(chunk));
}

function nextTick() {
  return new Promise((resolve) => process.nextTick(resolve));
}

function testMessageBufferParsesSplitFrames() {
  const buffer = new JsonRpcMessageBuffer();
  const encoded = encodeJsonRpcMessage({ jsonrpc: "2.0", id: 1, result: { ok: true } });
  const midpoint = Math.floor(encoded.length / 2);

  assert.deepEqual(buffer.push(encoded.slice(0, midpoint)), []);
  assert.deepEqual(buffer.push(encoded.slice(midpoint)), [
    { jsonrpc: "2.0", id: 1, result: { ok: true } },
  ]);
}

function testInvocationIsStdioWithoutShell() {
  assert.deepEqual(buildVeribleLanguageServerInvocation({
    command: "verible-verilog-ls",
    requestTimeoutMs: 1000,
  }), {
    command: "verible-verilog-ls",
    args: [],
    options: {
      cwd: undefined,
      env: undefined,
      shell: false,
      stdio: "pipe",
    },
  });
  assert.throws(
    () => buildVeribleLanguageServerInvocation({ command: "verible-verilog-ls --stdio" }),
    /must not include arguments/,
  );
}

async function testClientSendsInitializeOpenAndCompletion() {
  const fake = new FakeProcess();
  const written = [];
  fake.stdin.on("data", (chunk) => written.push(chunk));
  const client = createVeribleLanguageServerClient(
    { command: "verible-verilog-ls", requestTimeoutMs: 1000 },
    { spawn: () => fake },
  );

  const initialized = client.initialize("file:///repo");
  await nextTick();
  let messages = decodeMessages(written);
  assert.equal(messages[0].method, "initialize");
  assert.equal(messages[0].params.rootUri, "file:///repo");
  fake.stdout.write(encodeJsonRpcMessage({
    jsonrpc: "2.0",
    id: messages[0].id,
    result: { capabilities: { hoverProvider: true } },
  }));
  assert.deepEqual(await initialized, { capabilities: { hoverProvider: true } });

  written.length = 0;
  const completion = client.completion(
    {
      uri: { toString: () => "file:///repo/top.sv", fsPath: "/repo/top.sv" },
      languageId: "systemverilog",
      version: 7,
      getText: () => "module top; endmodule\n",
    },
    { line: 0, character: 3 },
    { rootUri: "file:///repo", timeoutMs: 1000 },
  );
  await nextTick();
  messages = decodeMessages(written);
  assert.equal(messages[0].method, "textDocument/didOpen");
  assert.equal(messages[0].params.textDocument.uri, "file:///repo/top.sv");
  assert.equal(messages[1].method, "textDocument/completion");
  fake.stdout.write(encodeJsonRpcMessage({
    jsonrpc: "2.0",
    id: messages[1].id,
    result: { isIncomplete: false, items: [{ label: "top" }] },
  }));

  assert.deepEqual(await completion, { isIncomplete: false, items: [{ label: "top" }] });
  client.shutdown();
  assert.equal(fake.killed, true);
}

testMessageBufferParsesSplitFrames();
testInvocationIsStdioWithoutShell();
await testClientSendsInitializeOpenAndCompletion();

console.log("verible language server tests ok");
