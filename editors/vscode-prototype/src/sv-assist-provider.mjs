// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import {
  createFirstE2EDemoPlan,
  svAssistCitationStats,
  keywordCompletionRecords,
  lookupStaticHover,
  snippetCompletionRecords,
} from "./sv-assist-data.mjs";
import {
  createVeribleLanguageServerClient,
} from "./verible-language-server.mjs";

export const SYSTEMVERILOG_LANGUAGE_SELECTORS = Object.freeze([
  { language: "systemverilog", scheme: "file" },
  { language: "verilog", scheme: "file" },
  { pattern: "**/*.{sv,svh,sva,v,vh}" },
]);

function completionKind(vscodeApi, kind) {
  if (kind === "snippet") {
    return vscodeApi?.CompletionItemKind?.Snippet ?? "Snippet";
  }
  return vscodeApi?.CompletionItemKind?.Keyword ?? "Keyword";
}

function markdown(vscodeApi, text) {
  if (typeof vscodeApi?.MarkdownString === "function") {
    return new vscodeApi.MarkdownString(text);
  }
  return text;
}

function snippetString(vscodeApi, text) {
  if (typeof vscodeApi?.SnippetString === "function") {
    return new vscodeApi.SnippetString(text);
  }
  return text;
}

function completionItem(vscodeApi, record) {
  const item = typeof vscodeApi?.CompletionItem === "function"
    ? new vscodeApi.CompletionItem(record.label, completionKind(vscodeApi, record.kind))
    : {
        label: record.label,
        kind: completionKind(vscodeApi, record.kind),
      };
  item.detail = record.detail;
  item.documentation = markdown(vscodeApi, record.documentation);
  if (record.kind === "snippet") {
    item.insertText = snippetString(vscodeApi, record.insertText);
  }
  return item;
}

export function createStaticCompletionItems(vscodeApi = null) {
  return [
    ...keywordCompletionRecords(),
    ...snippetCompletionRecords(),
  ].map((record) => completionItem(vscodeApi, record));
}

function lineText(document, line) {
  const entry = document?.lineAt?.(line);
  if (typeof entry === "string") {
    return entry;
  }
  return String(entry?.text ?? "");
}

function wordAt(document, position) {
  const line = lineText(document, position?.line ?? 0);
  const character = Math.max(0, position?.character ?? 0);
  const left = line.slice(0, character).match(/[A-Za-z_$][A-Za-z0-9_$]*$/)?.[0] ?? "";
  const right = line.slice(character).match(/^[A-Za-z0-9_$]*/)?.[0] ?? "";
  return `${left}${right}`;
}

function hoverFromFact(vscodeApi, fact) {
  if (!fact) {
    return null;
  }
  const value = [
    `**${fact.title}**`,
    "",
    fact.detail,
    "",
    `Citation: ${fact.citation}`,
  ].join("\n");
  if (typeof vscodeApi?.Hover === "function") {
    return new vscodeApi.Hover(markdown(vscodeApi, value));
  }
  return {
    contents: [value],
    source: "pccx-systemverilog-static-hover",
  };
}

function locationFromLsp(vscodeApi, item) {
  const target = item?.targetUri ? {
    uri: item.targetUri,
    range: item.targetSelectionRange ?? item.targetRange,
  } : {
    uri: item?.uri,
    range: item?.range,
  };
  if (!target.uri || !target.range) {
    return null;
  }
  const uri = vscodeApi?.Uri?.parse
    ? vscodeApi.Uri.parse(target.uri)
    : { uri: target.uri };
  const range = typeof vscodeApi?.Range === "function"
    ? new vscodeApi.Range(
        target.range.start.line,
        target.range.start.character,
        target.range.end.line,
        target.range.end.character,
      )
    : target.range;
  return typeof vscodeApi?.Location === "function"
    ? new vscodeApi.Location(uri, range)
    : { uri, range };
}

function normalizeLspLocations(vscodeApi, result) {
  const items = Array.isArray(result) ? result : [result].filter(Boolean);
  return items.map((item) => locationFromLsp(vscodeApi, item)).filter(Boolean);
}

function rootUriForDocument(vscodeApi, document) {
  const folder = document?.uri
    ? vscodeApi?.workspace?.getWorkspaceFolder?.(document.uri)
    : null;
  const root = folder?.uri ?? vscodeApi?.workspace?.workspaceFolders?.[0]?.uri;
  if (typeof root?.toString === "function") {
    return root.toString();
  }
  return root?.fsPath ? `file://${root.fsPath}` : null;
}

function languageServerConfig(config = {}) {
  return {
    command: config?.assist?.languageServer?.command,
    requestTimeoutMs: config?.assist?.languageServer?.requestTimeoutMs,
  };
}

function languageServerEnabled(config = {}) {
  return config?.assist?.enabled !== false &&
    config?.assist?.languageServer?.enabled !== false;
}

function clientFromRuntime(runtime, config) {
  if (!languageServerEnabled(config)) {
    return null;
  }
  if (runtime.languageServerClient) {
    return runtime.languageServerClient;
  }
  runtime.languageServerClient = createVeribleLanguageServerClient(
    languageServerConfig(config),
    runtime.languageServerDeps ?? {},
  );
  return runtime.languageServerClient;
}

function readConfig(runtime, vscodeApi) {
  return runtime.readConfig?.()
    ?? runtime.config
    ?? {
      assist: {
        enabled: true,
        languageServer: {
          enabled: true,
          command: "verible-verilog-ls",
          requestTimeoutMs: 1500,
        },
      },
    };
}

function createCompletionProvider(vscodeApi, runtime = {}) {
  return {
    async provideCompletionItems(document, position) {
      const config = readConfig(runtime, vscodeApi);
      const localItems = createStaticCompletionItems(vscodeApi);
      const client = clientFromRuntime(runtime, config);
      if (!client) {
        return localItems;
      }
      try {
        const result = await client.completion(document, position, {
          rootUri: rootUriForDocument(vscodeApi, document),
          timeoutMs: config.assist.languageServer.requestTimeoutMs,
        });
        const lspItems = Array.isArray(result?.items)
          ? result.items
          : Array.isArray(result)
            ? result
            : [];
        return [...localItems, ...lspItems];
      } catch (error) {
        runtime.outputChannel?.appendLine?.(`language server completion unavailable: ${error.message}`);
        return localItems;
      }
    },
  };
}

function createHoverProvider(vscodeApi, runtime = {}) {
  return {
    async provideHover(document, position) {
      const config = readConfig(runtime, vscodeApi);
      const staticHover = hoverFromFact(vscodeApi, lookupStaticHover(wordAt(document, position)));
      const client = clientFromRuntime(runtime, config);
      if (!client) {
        return staticHover;
      }
      try {
        const result = await client.hover(document, position, {
          rootUri: rootUriForDocument(vscodeApi, document),
          timeoutMs: config.assist.languageServer.requestTimeoutMs,
        });
        return result ?? staticHover;
      } catch (error) {
        runtime.outputChannel?.appendLine?.(`language server hover unavailable: ${error.message}`);
        return staticHover;
      }
    },
  };
}

function createDefinitionProvider(vscodeApi, runtime = {}) {
  return {
    async provideDefinition(document, position) {
      const config = readConfig(runtime, vscodeApi);
      const client = clientFromRuntime(runtime, config);
      if (!client) {
        return [];
      }
      try {
        const result = await client.definition(document, position, {
          rootUri: rootUriForDocument(vscodeApi, document),
          timeoutMs: config.assist.languageServer.requestTimeoutMs,
        });
        return normalizeLspLocations(vscodeApi, result);
      } catch (error) {
        runtime.outputChannel?.appendLine?.(`language server definition unavailable: ${error.message}`);
        return [];
      }
    },
  };
}

export function createAssistStatus(config = {}, runtime = {}) {
  const stats = svAssistCitationStats();
  return {
    kind: "systemverilog-assist-status",
    enabled: config?.assist?.enabled !== false,
    languageServer: {
      enabled: config?.assist?.languageServer?.enabled !== false,
      command: config?.assist?.languageServer?.command ?? "verible-verilog-ls",
      transport: "stdio-json-rpc",
      bundled: false,
      clientLayer: "pccx-lightweight-stdio-adapter",
    },
    lint: {
      command: config?.assist?.lint?.command ?? "verible-verilog-lint",
      runsOnCommand: true,
    },
    completions: {
      keywordCount: stats.keywordCount,
      snippetCount: stats.snippetCount,
    },
    citations: stats,
    demoPlan: createFirstE2EDemoPlan(),
    runtime: {
      hasLanguageServerClient: Boolean(runtime.languageServerClient),
    },
  };
}

export function registerSystemVerilogAssist(vscodeApi, context, runtime = {}) {
  const providers = [];
  if (!vscodeApi?.languages) {
    return providers;
  }

  if (typeof vscodeApi.languages.registerCompletionItemProvider === "function") {
    const disposable = vscodeApi.languages.registerCompletionItemProvider(
      SYSTEMVERILOG_LANGUAGE_SELECTORS,
      createCompletionProvider(vscodeApi, runtime),
      "`",
      "_",
      ".",
    );
    context?.subscriptions?.push?.(disposable);
    providers.push({ id: "systemverilog-completion", active: true });
  }

  if (typeof vscodeApi.languages.registerHoverProvider === "function") {
    const disposable = vscodeApi.languages.registerHoverProvider(
      SYSTEMVERILOG_LANGUAGE_SELECTORS,
      createHoverProvider(vscodeApi, runtime),
    );
    context?.subscriptions?.push?.(disposable);
    providers.push({ id: "systemverilog-hover", active: true });
  }

  if (typeof vscodeApi.languages.registerDefinitionProvider === "function") {
    const disposable = vscodeApi.languages.registerDefinitionProvider(
      SYSTEMVERILOG_LANGUAGE_SELECTORS,
      createDefinitionProvider(vscodeApi, runtime),
    );
    context?.subscriptions?.push?.(disposable);
    providers.push({ id: "systemverilog-lsp-definition", active: true });
  }

  return providers;
}
