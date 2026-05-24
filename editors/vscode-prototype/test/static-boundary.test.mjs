// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const EXTENSION_ROOT = resolve(ROOT, "editors/vscode-prototype");
const POSITIVE_CLAIM =
  /\b(?:production[- ]ready|marketplace[- ]ready|(?<!pre-)stable\s+(?:plugin\s+)?(?:API|ABI|LSP)|(?<!pre-)stable\s+diagnostics\s+envelope|MCP\s+ready|provider\/runtime\s+ready|KV260\s+inference\s+(?:works|works\s+now|is\s+working|is\s+functional)|20\s*tok\/s\s+achieved|timing[- ]closed|unreviewed\s+automation\s+product|unreviewed\s+coding|external\s+(?:tool|runtime)\s+directly\s+controls|complete\s+provider\s+integration|fully\s+(?:validated|verified)|CI-covered|approved\s+runner\s+proves)\b/i;
const POSITIVE_CLAIM_NEGATION =
  /\b(?:no|not|never|without|does not|is not|are not|avoid|do not|forbidden|unsupported)\b/i;

function hasPositiveClaimWithoutNegation(line, context) {
  return POSITIVE_CLAIM.test(line) && !POSITIVE_CLAIM_NEGATION.test(context);
}

async function readText(path) {
  return readFile(path, "utf8");
}

async function readPackageJson() {
  return JSON.parse(await readText(resolve(EXTENSION_ROOT, "package.json")));
}

async function listFiles(root, options = {}) {
  const skipDirs = new Set(options.skipDirs ?? [".git", ".vscode-test", "node_modules"]);
  const allowedExtensions = options.allowedExtensions ?? null;
  const results = [];
  async function visit(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          await visit(path);
        }
      } else if (!allowedExtensions || allowedExtensions.some((ext) => path.endsWith(ext))) {
        results.push(path);
      }
    }
  }
  await visit(root);
  return results.sort();
}

async function readCombined(paths) {
  return (await Promise.all(paths.map((path) => readText(path)))).join("\n");
}

async function extensionSourceFiles() {
  return [
    ...await listFiles(resolve(EXTENSION_ROOT, "src"), {
      allowedExtensions: [".mjs", ".cjs", ".js"],
    }),
    ...await listFiles(resolve(EXTENSION_ROOT, "bin"), {
      allowedExtensions: [".mjs", ".cjs", ".js"],
    }),
  ];
}

async function testNoDirectAiProviderOrNetworkCalls() {
  const combined = await readCombined(await extensionSourceFiles());

  assert.doesNotMatch(combined, /\bfetch\s*\(/);
  assert.doesNotMatch(combined, /XMLHttpRequest/);
  assert.doesNotMatch(combined, /\bWebSocket\b/);
  assert.doesNotMatch(combined, /\bEventSource\b/);
  assert.doesNotMatch(combined, /node:https|node:http/);
  assert.doesNotMatch(combined, /node:net|node:tls/);
  assert.doesNotMatch(combined, new RegExp("\\b(?:openai|anthropic|ge" + "mini)\\b", "i"));
  assert.doesNotMatch(combined, /chat\.completions|responses\.create/i);
}

async function testNoLauncherOrMcpRuntimeImplementation() {
  const manifest = await readPackageJson();
  const source = await readCombined(await extensionSourceFiles());
  const packageStrings = JSON.stringify({
    dependencies: manifest.dependencies,
    devDependencies: manifest.devDependencies,
  });

  assert.doesNotMatch(
    source,
    /(?:execFile|spawn|request|connect|run)[\s\S]{0,120}pccx-launcher|pccx-launcher[\s\S]{0,120}(?:execFile|spawn|request|connect|run)/i,
  );
  assert.doesNotMatch(source, /\bMcpServer\s*\(|modelcontextprotocol|mcp-server/i);
  assert.doesNotMatch(packageStrings, /modelcontextprotocol|mcp-server|llm-launcher/i);
}

async function testNoDirectCliCallsFromUiOrProviderLayers() {
  const uiLayerFiles = [
    "src/extension.mjs",
    "src/extension.cjs",
    "src/command-handlers.mjs",
    "src/definition-provider.mjs",
    "src/presenter.mjs",
  ];
  const combined = (await Promise.all(
    uiLayerFiles.map((file) => readText(resolve(EXTENSION_ROOT, file))),
  )).join("\n");

  assert.doesNotMatch(combined, /pccx_ide_cli/);
  assert.doesNotMatch(combined, /LanguageClient|vscode-languageclient/);
}

async function testNoPackagingPublisherOrLspDependencies() {
  const manifest = await readPackageJson();
  const manifestText = JSON.stringify(manifest);
  const repoPolicyFiles = [
    ...await listFiles(resolve(ROOT, "scripts"), {
      allowedExtensions: [".sh", ".mjs", ".js", ".py"],
    }),
    ...await listFiles(resolve(ROOT, ".github"), {
      allowedExtensions: [".yml", ".yaml"],
    }),
  ];
  const policyText = `${manifestText}\n${await readCombined(repoPolicyFiles)}`;

  assert.equal(Object.hasOwn(manifest, "publisher"), false);
  assert.equal(Object.hasOwn(manifest, "galleryBanner"), false);
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.scripts, undefined);
  assert.doesNotMatch(policyText, /\bvsce\s+(?:package|publish|login|create-publisher)\b/i);
  assert.doesNotMatch(manifestText, /vscode-languageclient|LanguageClient/);
}

async function testNoDirectShellInterpolation() {
  const source = await readCombined([
    ...await extensionSourceFiles(),
    ...await listFiles(resolve(ROOT, "src"), {
      allowedExtensions: [".py"],
    }),
  ]);

  assert.doesNotMatch(source, /import\s*\{[^}]*\bexec\b[^}]*\}\s*from\s*["']node:child_process["']/);
  assert.doesNotMatch(source, /\bchild_process\.exec\s*\(/);
  assert.doesNotMatch(source, /(?:^|[^A-Za-z0-9_.])exec\s*\(/);
  assert.doesNotMatch(source, /shell\s*:\s*true/);
  assert.doesNotMatch(source, /shell\s*=\s*True/);
}

async function testProposalAndStatusModulesAreDataOnly() {
  const proposalAndStatusSource = await readCombined([
    resolve(EXTENSION_ROOT, "src/validation-proposals.mjs"),
    resolve(EXTENSION_ROOT, "src/validation-proposal-preflight-audit.mjs"),
    resolve(EXTENSION_ROOT, "src/patch-proposal-contract.mjs"),
    resolve(EXTENSION_ROOT, "src/patch-proposal-preview.mjs"),
    resolve(EXTENSION_ROOT, "src/validation-patch-handoff.mjs"),
    resolve(EXTENSION_ROOT, "src/pccx-lab-command-descriptor.mjs"),
    resolve(EXTENSION_ROOT, "src/launcher-status-contract.mjs"),
    resolve(EXTENSION_ROOT, "src/diagnostics-handoff-consumer.mjs"),
    resolve(EXTENSION_ROOT, "src/diagnostics-handoff-status-surface.mjs"),
    resolve(EXTENSION_ROOT, "src/runtime-readiness-consumer.mjs"),
    resolve(EXTENSION_ROOT, "src/runtime-readiness-status-surface.mjs"),
    resolve(EXTENSION_ROOT, "src/local-workflow-status.mjs"),
    resolve(EXTENSION_ROOT, "src/context-bundle-audit.mjs"),
    resolve(EXTENSION_ROOT, "src/pccx-lab-status.mjs"),
  ]);

  assert.doesNotMatch(
    proposalAndStatusSource,
    /node:child_process|\bexecFile\b|\bspawn\s*\(|\bexec\s*\(/,
  );
  assert.doesNotMatch(
    proposalAndStatusSource,
    /\bwriteFile\s*\(|\bappendFile\s*\(|\brm\s*\(|\bunlink\s*\(|\brename\s*\(/,
  );
  assert.doesNotMatch(proposalAndStatusSource, /\b(?:git|gh)\s+(?:push|commit|merge|release|tag)\b/i);
  assert.doesNotMatch(proposalAndStatusSource, /\bgh\s+(?:secret|ruleset)\b/i);
  assert.match(proposalAndStatusSource, /proposalOnly/);
  assert.match(proposalAndStatusSource, /executes: false/);
  assert.match(proposalAndStatusSource, /auditOnly/);
  assert.match(proposalAndStatusSource, /appliesPatches: false/);
  assert.match(proposalAndStatusSource, /backendCommandExecuted: false/);
  assert.match(proposalAndStatusSource, /accessesFpgaRepo: false/);
  assert.match(proposalAndStatusSource, /kv260RuntimeExecution: false/);
}

async function testApprovedValidationRunnerUsesOnlyAllowlistedExecution() {
  const runnerSource = await readText(resolve(EXTENSION_ROOT, "src/approved-validation-runner.mjs"));
  const proposalModule = await import(pathToFileURL(resolve(
    EXTENSION_ROOT,
    "src/validation-proposals.mjs",
  )).href);
  const proposals = proposalModule.listValidationCommandProposals();
  const runnable = proposals.filter((proposal) => (
    proposal.command && proposal.runnerPolicy !== "proposalOnly"
  ));
  const flattened = runnable.flatMap((proposal) => proposal.command.argv);

  assert.match(runnerSource, /execFile/);
  assert.match(runnerSource, /shell:\s*false/);
  assert.match(runnerSource, /PROPOSAL_ID_PATTERN/);
  assert.doesNotMatch(runnerSource, /\bexec\s*\(/);
  assert.doesNotMatch(runnerSource, /shell\s*:\s*true/);
  assert.ok(runnable.length >= 4);
  assert.deepEqual(
    runnable.map((proposal) => proposal.id),
    ["vscodeAdapterSmoke", "editorBridgeSmoke", "exampleDriftCheck", "pytestBaseline"],
  );
  assert.ok(runnable.every((proposal) => proposal.command.cwd === "repo-root"));
  assert.ok(runnable.every((proposal) => Array.isArray(proposal.command.argv)));
  assert.ok(runnable.every((proposal) => ["bash", "python3"].includes(proposal.command.argv[0])));
  assert.doesNotMatch(flattened.join("\n"), /(?:&&|\|\||;|`|\$\(|>|<)/);
  assert.doesNotMatch(
    flattened.join("\n"),
    /\b(?:git|gh)\s+(?:push|commit|merge|release|tag|secret|ruleset|api)\b/i,
  );
  assert.equal(
    proposals.find((proposal) => proposal.id === "extensionHostSmokeOptIn").runnerPolicy,
    "proposalOnly",
  );
}

async function testContextBundleDoesNotSerializePrivateInstructionNames() {
  const contextBundleModule = await import(pathToFileURL(resolve(
    EXTENSION_ROOT,
    "src/context-bundle.mjs",
  )).href);
  const bundle = contextBundleModule.buildContextBundle(
    {
      workspaceRoot: "/repo",
      files: [
        { path: "/repo/AGENTS.md", text: "private worker instruction" },
        { path: "/repo/package-lock.json", text: "{\"packages\":{}}" },
        { path: "/repo/rtl/top.sv", text: "module top;\nendmodule\n" },
      ],
    },
    { workspaceRoot: "/repo" },
  );
  const serialized = JSON.stringify(bundle);

  assert.deepEqual(bundle.snippets.map((snippet) => snippet.path), ["rtl/top.sv"]);
  assert.doesNotMatch(serialized, /AGENTS\.md/);
  assert.doesNotMatch(serialized, /package-lock\.json/);
}

async function testNoPositiveReadinessClaims() {
  const files = [
    ...await listFiles(ROOT, {
      allowedExtensions: [".md", ".sh", ".yml", ".yaml", ".py", ".mjs", ".cjs", ".js", ".json"],
    }),
  ].filter((path) => (
    path !== resolve(ROOT, ".github/workflows/ci.yml") &&
    !path.includes("/package-lock.json") &&
    !path.includes("/tests/") &&
    !path.endsWith("/editors/vscode-prototype/test/static-boundary.test.mjs")
  ));
  const violations = [];

  for (const file of files) {
    const lines = (await readText(file)).split(/\r?\n/);
    lines.forEach((line, index) => {
      const context = [
        lines[index - 2] ?? "",
        lines[index - 1] ?? "",
        line,
        lines[index + 1] ?? "",
      ].join(" ");
      if (hasPositiveClaimWithoutNegation(line, context)) {
        violations.push(`${file}:${index + 1}: ${line}`);
      }
    });
  }

  assert.deepEqual(violations, []);
}

function testPositiveClaimGuardCoversRoadmapPhrases() {
  [
    "production-ready",
    "marketplace-ready",
    "stable API",
    "stable ABI",
    "stable LSP",
    "MCP ready",
    "provider/runtime ready",
    "KV260 inference works",
    "20 tok/s achieved",
    "timing closed",
    "unreviewed automation product",
    "unreviewed coding",
    "external tool directly controls",
    "external runtime directly controls",
  ].forEach((claim) => {
    assert.equal(hasPositiveClaimWithoutNegation(claim, claim), true);
  });

  [
    "not a stable API",
    "pre-stable API",
    "no MCP ready claim",
    "unsupported KV260 inference works claim",
  ].forEach((claim) => {
    assert.equal(hasPositiveClaimWithoutNegation(claim, claim), false);
  });
}

await testNoDirectAiProviderOrNetworkCalls();
await testNoLauncherOrMcpRuntimeImplementation();
await testNoDirectCliCallsFromUiOrProviderLayers();
await testNoPackagingPublisherOrLspDependencies();
await testNoDirectShellInterpolation();
await testProposalAndStatusModulesAreDataOnly();
await testApprovedValidationRunnerUsesOnlyAllowlistedExecution();
await testContextBundleDoesNotSerializePrivateInstructionNames();
await testNoPositiveReadinessClaims();
testPositiveClaimGuardCoversRoadmapPhrases();

console.log("vscode static boundary tests ok");
