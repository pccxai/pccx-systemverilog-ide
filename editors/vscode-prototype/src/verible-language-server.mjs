// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";

const JSON_RPC_VERSION = "2.0";
const DEFAULT_COMMAND = "verible-verilog-ls";
const DEFAULT_TIMEOUT_MS = 1500;

export function encodeJsonRpcMessage(payload) {
  const body = JSON.stringify(payload);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

export class JsonRpcMessageBuffer {
  constructor() {
    this.buffer = Buffer.alloc(0);
  }

  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, Buffer.from(chunk)]);
    const messages = [];

    while (this.buffer.length > 0) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) {
        break;
      }
      const header = this.buffer.subarray(0, headerEnd).toString("ascii");
      const match = /(?:^|\r\n)Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        throw new Error("LSP message missing Content-Length header");
      }
      const length = Number.parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + length;
      if (this.buffer.length < bodyEnd) {
        break;
      }
      const body = this.buffer.subarray(bodyStart, bodyEnd).toString("utf8");
      messages.push(JSON.parse(body));
      this.buffer = this.buffer.subarray(bodyEnd);
    }

    return messages;
  }
}

function normalizedCommand(config = {}) {
  const command = config.command ?? DEFAULT_COMMAND;
  if (typeof command !== "string" || command.trim().length === 0) {
    throw new Error("language server command must be a non-empty string");
  }
  if (/\s/.test(command)) {
    throw new Error("language server command must not include arguments");
  }
  return command;
}

function normalizedArgs(config = {}) {
  const args = config.args ?? [];
  if (!Array.isArray(args)) {
    throw new Error("language server args must be an array");
  }
  return args.map((arg) => {
    if (typeof arg !== "string" || arg.includes("\0")) {
      throw new Error("language server args must be strings");
    }
    return arg;
  });
}

export function buildVeribleLanguageServerInvocation(config = {}) {
  return {
    command: normalizedCommand(config),
    args: normalizedArgs(config),
    options: {
      cwd: config.cwd,
      env: config.env,
      shell: false,
      stdio: "pipe",
    },
  };
}

function createDocumentUri(document) {
  if (typeof document?.uri?.toString === "function") {
    return document.uri.toString();
  }
  if (document?.uri?.fsPath) {
    return `file://${document.uri.fsPath}`;
  }
  if (typeof document?.fileName === "string") {
    return `file://${document.fileName}`;
  }
  return "";
}

function documentText(document) {
  if (typeof document?.getText === "function") {
    return document.getText();
  }
  return String(document?.text ?? "");
}

function documentLanguageId(document) {
  return document?.languageId ?? "systemverilog";
}

function documentVersion(document) {
  return Number.isInteger(document?.version) ? document.version : 1;
}

function initializeParams(rootUri = null) {
  return {
    processId: process.pid,
    rootUri,
    capabilities: {
      textDocument: {
        completion: {
          completionItem: {
            snippetSupport: true,
          },
        },
        hover: {},
        definition: {},
        publishDiagnostics: {},
      },
      workspace: {
        workspaceFolders: true,
      },
    },
  };
}

export class VeribleLanguageServerClient extends EventEmitter {
  constructor(config = {}, deps = {}) {
    super();
    this.config = config;
    this.spawn = deps.spawn ?? spawn;
    this.timer = deps.setTimeout ?? setTimeout;
    this.clearTimer = deps.clearTimeout ?? clearTimeout;
    this.process = deps.process ?? null;
    this.nextId = 1;
    this.pending = new Map();
    this.messageBuffer = new JsonRpcMessageBuffer();
    this.started = false;
    this.initialized = false;
    this.openDocuments = new Set();
    this.stderr = "";
  }

  start() {
    if (this.started) {
      return;
    }
    const invocation = buildVeribleLanguageServerInvocation(this.config);
    this.process = this.process ?? this.spawn(invocation.command, invocation.args, invocation.options);
    this.started = true;

    this.process.stdout?.on?.("data", (chunk) => {
      for (const message of this.messageBuffer.push(chunk)) {
        this.handleMessage(message);
      }
    });
    this.process.stderr?.on?.("data", (chunk) => {
      this.stderr += Buffer.from(chunk).toString("utf8");
    });
    this.process.on?.("exit", (code, signal) => {
      this.started = false;
      this.initialized = false;
      const error = new Error(`language server exited: ${code ?? signal ?? "unknown"}`);
      for (const pending of this.pending.values()) {
        pending.reject(error);
        this.clearTimer(pending.timeout);
      }
      this.pending.clear();
      this.emit("exit", { code, signal });
    });
    this.process.on?.("error", (error) => {
      this.emit("error", error);
    });
  }

  handleMessage(message) {
    if (Object.hasOwn(message, "id")) {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      this.clearTimer(pending.timeout);
      if (message.error) {
        pending.reject(new Error(message.error.message ?? "language server request failed"));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.method === "textDocument/publishDiagnostics") {
      this.emit("diagnostics", message.params);
    } else if (message.method) {
      this.emit("notification", message);
    }
  }

  send(payload) {
    this.start();
    this.process.stdin?.write?.(encodeJsonRpcMessage(payload));
  }

  request(method, params = {}, options = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const timeoutMs = options.timeoutMs ?? this.config.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;

    return new Promise((resolve, reject) => {
      const timeout = this.timer(() => {
        this.pending.delete(id);
        reject(new Error(`language server request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      this.send({
        jsonrpc: JSON_RPC_VERSION,
        id,
        method,
        params,
      });
    });
  }

  notify(method, params = {}) {
    this.send({
      jsonrpc: JSON_RPC_VERSION,
      method,
      params,
    });
  }

  async initialize(rootUri = null) {
    if (this.initialized) {
      return { alreadyInitialized: true };
    }
    const result = await this.request("initialize", initializeParams(rootUri));
    this.notify("initialized", {});
    this.initialized = true;
    return result;
  }

  async ensureDocumentOpen(document, rootUri = null) {
    await this.initialize(rootUri);
    const uri = createDocumentUri(document);
    if (!uri || this.openDocuments.has(uri)) {
      return uri;
    }
    this.notify("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId: documentLanguageId(document),
        version: documentVersion(document),
        text: documentText(document),
      },
    });
    this.openDocuments.add(uri);
    return uri;
  }

  async completion(document, position, options = {}) {
    const uri = await this.ensureDocumentOpen(document, options.rootUri);
    return this.request("textDocument/completion", {
      textDocument: { uri },
      position,
    }, options);
  }

  async hover(document, position, options = {}) {
    const uri = await this.ensureDocumentOpen(document, options.rootUri);
    return this.request("textDocument/hover", {
      textDocument: { uri },
      position,
    }, options);
  }

  async definition(document, position, options = {}) {
    const uri = await this.ensureDocumentOpen(document, options.rootUri);
    return this.request("textDocument/definition", {
      textDocument: { uri },
      position,
    }, options);
  }

  shutdown() {
    if (!this.started) {
      return;
    }
    try {
      this.notify("exit", {});
      this.process.kill?.();
    } finally {
      this.started = false;
      this.initialized = false;
      this.openDocuments.clear();
    }
  }
}

export function createVeribleLanguageServerClient(config = {}, deps = {}) {
  return new VeribleLanguageServerClient(config, deps);
}
