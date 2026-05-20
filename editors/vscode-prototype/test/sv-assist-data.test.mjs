// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SYSTEMVERILOG_KEYWORDS,
  UVM_SNIPPET_TEMPLATES,
  createFirstE2EDemoPlan,
  keywordCompletionRecords,
  lookupStaticHover,
  snippetCompletionRecords,
  svAssistCitationStats,
} from "../src/sv-assist-data.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SNIPPETS_PATH = resolve(
  ROOT,
  "editors/vscode-prototype/snippets/systemverilog-uvm.code-snippets",
);

async function testKeywordAndSnippetCatalogs() {
  assert.equal(new Set(SYSTEMVERILOG_KEYWORDS).size, SYSTEMVERILOG_KEYWORDS.length);
  assert.ok(SYSTEMVERILOG_KEYWORDS.length >= 200);
  assert.ok(SYSTEMVERILOG_KEYWORDS.includes("always_ff"));
  assert.ok(SYSTEMVERILOG_KEYWORDS.includes("interface"));
  assert.ok(SYSTEMVERILOG_KEYWORDS.includes("uwire"));
  assert.equal(UVM_SNIPPET_TEMPLATES.length, 20);
  assert.equal(snippetCompletionRecords().length, 20);
  assert.equal(keywordCompletionRecords().length, SYSTEMVERILOG_KEYWORDS.length);
}

async function testSnippetFileMirrorsCatalogAndCitesPages() {
  const snippetJson = JSON.parse(await readFile(SNIPPETS_PATH, "utf8"));
  const entries = Object.values(snippetJson);
  const prefixes = new Set(entries.map((entry) => entry.prefix));

  assert.equal(entries.length, UVM_SNIPPET_TEMPLATES.length);
  for (const template of UVM_SNIPPET_TEMPLATES) {
    assert.ok(prefixes.has(template.prefix), `${template.prefix} missing from snippet file`);
  }
  for (const entry of entries) {
    assert.match(entry.description, /IEEE 1800\.2-2020/);
    assert.match(entry.body[0], /^\/\/ IEEE 1800\.2-2020/);
  }
}

function testStaticHoverAndCitationStats() {
  const hover = lookupStaticHover("uvm_driver");
  const stats = svAssistCitationStats();
  const demo = createFirstE2EDemoPlan();

  assert.match(hover.citation, /13\.7/);
  assert.equal(stats.snippetCount, 20);
  assert.equal(stats.keywordCount, SYSTEMVERILOG_KEYWORDS.length);
  assert.ok(stats.uniqueCitationCount >= 20);
  assert.equal(demo.executesSimulation, false);
  assert.equal(demo.writesRtl, false);
  assert.equal(demo.safety.providerCalls, false);
}

await testKeywordAndSnippetCatalogs();
await testSnippetFileMirrorsCatalogAndCitesPages();
testStaticHoverAndCitationStats();

console.log("sv assist data tests ok");
