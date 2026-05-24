// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import { isAbsolute, relative } from "node:path";

export const SELECTED_SYMBOL_CONTEXT_VERSION = "pccx.selectedSymbolContext.v0";

export const DEFAULT_SELECTED_SYMBOL_CONTEXT_LIMITS = Object.freeze({
  maxWindowLines: 80,
  maxLineCharacters: 240,
  maxSelectionPreviewLines: 4,
  maxRelatedReferences: 6,
  maxNearbyDiagnostics: 4,
});

const IDENTIFIER_PATTERN = /[A-Za-z_][A-Za-z0-9_$]*/g;
const EXCLUDED_PATH_SEGMENTS = new Set([".git", ".vscode-test", "node_modules"]);
const EXCLUDED_PATH_NAMES = new Set(["AGENTS.md", "package-lock.json"]);
const SECRET_LIKE_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b/i;
const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b\s*[:=]/i;
const PRIVATE_INSTRUCTION_PATH_PATTERN =
  /(?:^|[/\\])(?:\.private-agent|private[-_ ]?worker|worker[-_ ]?instruction|subagent[-_ ]?instruction)(?:[/\\]|$)/i;

function mergeLimits(limits = {}) {
  return {
    ...DEFAULT_SELECTED_SYMBOL_CONTEXT_LIMITS,
    ...Object.fromEntries(
      Object.entries(limits).filter(([, value]) => Number.isInteger(value) && value >= 0),
    ),
  };
}

function normalizeWorkspacePath(workspaceRoot) {
  if (typeof workspaceRoot !== "string" || workspaceRoot.trim().length === 0) {
    return null;
  }
  return workspaceRoot.replace(/\\/g, "/").replace(/\/+$/, "");
}

function pathHasExcludedSegment(path) {
  const segments = path.split("/").filter(Boolean);
  return segments.some((segment) => EXCLUDED_PATH_SEGMENTS.has(segment));
}

function pathHasExcludedName(path) {
  const segments = path.split("/").filter(Boolean);
  return segments.some((segment) => EXCLUDED_PATH_NAMES.has(segment));
}

function normalizePathRef(path, workspaceRoot = null) {
  if (typeof path !== "string" || path.trim().length === 0) {
    return null;
  }
  if (path.includes("\0") || path.includes("\n") || path.includes("\r")) {
    return null;
  }

  const normalizedWorkspaceRoot = normalizeWorkspacePath(workspaceRoot);
  let normalizedPath = path.replace(/\\/g, "/");
  if (isAbsolute(normalizedPath)) {
    if (!normalizedWorkspaceRoot) {
      return null;
    }
    const rel = relative(normalizedWorkspaceRoot, normalizedPath).replace(/\\/g, "/");
    if (rel.startsWith("../") || rel === ".." || isAbsolute(rel)) {
      return null;
    }
    normalizedPath = rel;
  }

  normalizedPath = normalizedPath.replace(/^\.\//, "");
  if (
    normalizedPath === "" ||
    normalizedPath.startsWith("../") ||
    normalizedPath === ".." ||
    pathHasExcludedSegment(normalizedPath) ||
    pathHasExcludedName(normalizedPath) ||
    SECRET_LIKE_PATTERN.test(normalizedPath) ||
    PRIVATE_INSTRUCTION_PATH_PATTERN.test(normalizedPath)
  ) {
    return null;
  }
  return normalizedPath;
}

function clampNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clampLineText(text, maxLineCharacters) {
  const singleLine = String(text ?? "").replace(/\r?\n/g, " ");
  const redacted = SECRET_ASSIGNMENT_PATTERN.test(singleLine) ? "[redacted]" : singleLine;
  return {
    text: redacted.slice(0, maxLineCharacters),
    truncated: redacted.length > maxLineCharacters,
  };
}

function scrubText(value, maxCharacters) {
  if (typeof value !== "string" || value.length === 0 || maxCharacters === 0) {
    return "";
  }
  if (SECRET_ASSIGNMENT_PATTERN.test(value) || SECRET_LIKE_PATTERN.test(value)) {
    return "[redacted]";
  }
  return value.slice(0, maxCharacters);
}

function normalizeRange(range) {
  if (!range || typeof range !== "object") {
    return null;
  }
  const normalized = {
    start: {
      line: Math.max(0, Math.floor(clampNumber(range.start?.line))),
      character: Math.max(0, Math.floor(clampNumber(range.start?.character))),
    },
    end: {
      line: Math.max(0, Math.floor(clampNumber(range.end?.line))),
      character: Math.max(0, Math.floor(clampNumber(range.end?.character))),
    },
  };
  if (
    normalized.end.line < normalized.start.line ||
    (
      normalized.end.line === normalized.start.line &&
      normalized.end.character < normalized.start.character
    )
  ) {
    normalized.end = { ...normalized.start };
  }
  return normalized;
}

function rangeIsEmpty(range) {
  return !range ||
    (
      range.start?.line === range.end?.line &&
      range.start?.character === range.end?.character
    );
}

function normalizeLineEntry(entry, index) {
  if (typeof entry === "string") {
    return {
      line: index,
      text: entry,
    };
  }
  if (entry && typeof entry === "object") {
    return {
      line: Math.max(0, Math.floor(clampNumber(entry.line, index))),
      text: String(entry.text ?? ""),
    };
  }
  return null;
}

function normalizeLines(lines, limits) {
  if (!Array.isArray(lines)) {
    return [];
  }
  return lines
    .map((entry, index) => normalizeLineEntry(entry, index))
    .filter(Boolean)
    .sort((a, b) => a.line - b.line)
    .slice(0, limits.maxWindowLines);
}

function identifierUnderCursor(lineText, character) {
  const cursor = Math.max(0, Math.floor(clampNumber(character)));
  for (const match of String(lineText ?? "").matchAll(IDENTIFIER_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (cursor >= start && cursor <= end) {
      return {
        text: match[0],
        range: { start, end },
      };
    }
  }
  return null;
}

function firstIdentifier(text) {
  const match = String(text ?? "").match(IDENTIFIER_PATTERN);
  return match?.[0] ?? "";
}

function findCurrentLine(lines, cursorLine) {
  return lines.find((entry) => entry.line === cursorLine) ?? null;
}

function declarationFromLine(entry) {
  const text = entry?.text ?? "";
  const simple = text.match(
    /^\s*(module|package|interface)\s+([A-Za-z_][A-Za-z0-9_$]*)\b/,
  );
  if (simple) {
    return {
      kind: simple[1],
      name: simple[2],
      column: simple.index + simple[0].lastIndexOf(simple[2]) + 1,
    };
  }

  const typedef = text.match(/\btypedef\b[\s\S]*?\b([A-Za-z_][A-Za-z0-9_$]*)\s*;/);
  if (typedef) {
    return {
      kind: "typedef",
      name: typedef[1],
      column: text.indexOf(typedef[1]) + 1,
    };
  }

  const param = text.match(/^\s*(parameter|localparam)\b[\s\S]*?\b([A-Za-z_][A-Za-z0-9_$]*)\s*(?:=|;|,)/);
  if (param) {
    return {
      kind: param[1],
      name: param[2],
      column: text.indexOf(param[2]) + 1,
    };
  }

  const callable = text.match(/^\s*(function|task)\b[\s\S]*?\b([A-Za-z_][A-Za-z0-9_$]*)\s*(?:\(|;)/);
  if (callable) {
    return {
      kind: callable[1],
      name: callable[2],
      column: text.indexOf(callable[2]) + 1,
    };
  }

  return null;
}

function findEnclosingDeclaration(lines, cursorLine, path, limits) {
  const candidates = lines
    .filter((entry) => entry.line <= cursorLine)
    .map((entry) => ({ entry, declaration: declarationFromLine(entry) }))
    .filter(({ declaration }) => declaration)
    .sort((a, b) => b.entry.line - a.entry.line);
  const candidate = candidates[0];
  if (!candidate) {
    return null;
  }

  const line = candidate.entry.line;
  const column = Math.max(1, candidate.declaration.column);
  return {
    kind: candidate.declaration.kind,
    name: scrubText(candidate.declaration.name, 160),
    path,
    range: {
      start: { line, character: column - 1 },
      end: { line, character: column - 1 + candidate.declaration.name.length },
    },
    line: line + 1,
    column,
    lineText: clampLineText(candidate.entry.text, limits.maxLineCharacters),
  };
}

function selectionSummary(selectionText, limits) {
  if (typeof selectionText !== "string" || selectionText.length === 0) {
    return null;
  }
  const redacted = SECRET_ASSIGNMENT_PATTERN.test(selectionText) ? "[redacted]" : selectionText;
  const lines = redacted
    .split(/\r?\n/)
    .slice(0, limits.maxSelectionPreviewLines)
    .map((line) => line.slice(0, limits.maxLineCharacters));
  return {
    lineCount: selectionText.split(/\r?\n/).length,
    characterCount: selectionText.length,
    previewLines: lines,
    truncated: redacted.length > lines.join("\n").length,
  };
}

function normalizeNavigationReference(item, workspaceRoot, limits) {
  const path = normalizePathRef(item?.path ?? item?.file, workspaceRoot);
  if (!path) {
    return null;
  }
  const line = Math.max(1, Math.floor(clampNumber(item?.line, 1)));
  const column = Math.max(1, Math.floor(clampNumber(item?.column, 1)));
  return {
    name: scrubText(item?.name ?? "", 160),
    kind: scrubText(item?.kind ?? "any", 80),
    path,
    range: normalizeRange(item?.range) ?? {
      start: { line: line - 1, character: column - 1 },
      end: { line: line - 1, character: column },
    },
    source: scrubText(item?.source ?? "pccx-vscode-prototype", 120),
  };
}

function normalizeDiagnostic(diagnostic, workspaceRoot, limits) {
  const path = normalizePathRef(diagnostic?.path ?? diagnostic?.file, workspaceRoot);
  if (!path) {
    return null;
  }
  return {
    path,
    range: normalizeRange(diagnostic?.range),
    severity: scrubText(diagnostic?.severity ?? "Information", 80),
    message: scrubText(diagnostic?.message ?? "", 500),
    source: scrubText(diagnostic?.source ?? "", 120),
    code: scrubText(diagnostic?.code ?? "", 120),
  };
}

function rangeTouchesLine(range, line) {
  if (!range) {
    return false;
  }
  return Number.isInteger(range.start?.line) &&
    Number.isInteger(range.end?.line) &&
    line >= range.start.line &&
    line <= range.end.line;
}

export function buildSelectedSymbolContext(input = {}, options = {}) {
  const limits = mergeLimits(options.limits);
  const workspaceRoot = options.workspaceRoot ?? input.workspaceRoot ?? null;
  const path = normalizePathRef(input.path ?? input.file, workspaceRoot);
  if (!path) {
    return null;
  }

  const lines = normalizeLines(input.lines, limits);
  if (lines.length === 0) {
    return null;
  }

  const selectedRange = normalizeRange(input.selectionRange ?? input.range);
  const cursor = {
    line: Math.max(0, Math.floor(clampNumber(
      input.cursorPosition?.line ?? selectedRange?.start?.line,
    ))),
    character: Math.max(0, Math.floor(clampNumber(
      input.cursorPosition?.character ?? selectedRange?.start?.character,
    ))),
  };
  const current = findCurrentLine(lines, cursor.line) ?? lines[0];
  const selectedText = typeof input.selectionText === "string" ? input.selectionText : "";
  const symbolFromSelection = !rangeIsEmpty(selectedRange) ? firstIdentifier(selectedText) : "";
  const symbolAtCursor = identifierUnderCursor(current.text, cursor.character);
  const symbolText = scrubText(symbolFromSelection || symbolAtCursor?.text || "", 160);
  const symbolRange = symbolAtCursor
    ? {
        start: { line: current.line, character: symbolAtCursor.range.start },
        end: { line: current.line, character: symbolAtCursor.range.end },
      }
    : selectedRange;
  const enclosingDeclaration = findEnclosingDeclaration(lines, cursor.line, path, limits);
  const relatedNavigation = Array.isArray(input.navigationItems)
    ? input.navigationItems
      .map((item) => normalizeNavigationReference(item, workspaceRoot, limits))
      .filter((item) => item && (!symbolText || item.name === symbolText))
      .slice(0, limits.maxRelatedReferences)
    : [];
  const nearbyDiagnostics = Array.isArray(input.diagnostics)
    ? input.diagnostics
      .map((diagnostic) => normalizeDiagnostic(diagnostic, workspaceRoot, limits))
      .filter((diagnostic) => diagnostic && (!selectedRange || rangeTouchesLine(diagnostic.range, cursor.line)))
      .slice(0, limits.maxNearbyDiagnostics)
    : [];
  const currentLine = clampLineText(current.text, limits.maxLineCharacters);
  const lexicalKind = enclosingDeclaration?.name === symbolText
    ? enclosingDeclaration.kind
    : "identifier";

  return {
    version: SELECTED_SYMBOL_CONTEXT_VERSION,
    path,
    language: scrubText(input.language ?? "systemverilog", 80),
    symbolText,
    lexicalKind,
    range: normalizeRange(symbolRange),
    cursor,
    currentLine: {
      number: current.line + 1,
      ...currentLine,
    },
    selectionSummary: selectionSummary(selectedText, limits),
    enclosingDeclaration,
    relatedNavigation,
    nearbyDiagnostics,
    limits,
    analysis: {
      kind: "lexical",
      semanticResolution: false,
    },
  };
}
