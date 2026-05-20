# Theme Consistency Rules

The VS Code prototype contributes paired local themes:
`pccx SystemVerilog Light` and `pccx SystemVerilog Dark`.  The light theme
comes from the pccx-UI integration work and the dark theme is its follow-up
variant.  Keep them reviewed as one pair so the dark theme stays a contrast
variant of the same SystemVerilog editor surface, not a separate design
system.

This document is a maintenance rule set for:

- `../themes/pccx-systemverilog-light-color-theme.json`
- `../themes/pccx-systemverilog-dark-color-theme.json`
- the `contributes.themes` entries in `../package.json`

It does not make the prototype marketplace-ready, LSP-backed, or a complete
custom theme engine.  The presentation policy remains host-theme-first for
runtime UI records and future webview-like surfaces.

## Pairing Rules

- Both theme files must keep `semanticHighlighting: true`.
- Both theme files must keep the same top-level shape: `name`, `type`,
  `semanticHighlighting`, `colors`, and `tokenColors`.
- `package.json` must contribute both themes together.  The light entry uses
  `uiTheme: "vs"` and the dark entry uses `uiTheme: "vs-dark"`.
- The `colors` maps should keep the same VS Code color keys unless a key is
  demonstrably unavailable or inappropriate for one theme.  Any exception
  should be documented in this file or the adjacent review notes.
- The `tokenColors` arrays must keep the same bucket names, bucket order, and
  scope lists.  Only foreground values should differ between light and dark.
- Shared SystemVerilog token buckets are comments, keywords, types,
  identifiers, literals, diagnostics/invalid tokens, and source default.
- Shared workbench surface groups are activity bar, title bar, command center,
  editor, gutter, side bar, list, panel, tabs, status bar, notifications,
  quick input, terminal, and text links.

## Shared Semantic Roles

Use the same semantic role when choosing different light and dark values.

| Role | Light rule | Dark rule |
| --- | --- | --- |
| Primary pccx action/accent | Use `#0b5fff` for primary action and focus surfaces. | Keep `#0b5fff` for the same structural accent surfaces. |
| Editor foreground/background | Dark text on white or near-white editor surfaces. | Light text on near-black editor surfaces. |
| Muted text | Lower-contrast gray that remains readable on light surfaces. | Higher-luminance gray that remains readable on dark surfaces. |
| Selection/focus fill | Low-saturation blue fill that does not obscure syntax. | Deeper blue fill with enough contrast from the editor shell. |
| Hover/secondary fill | Neutral gray fill distinct from the editor background. | Near-black or slate fill distinct from the editor background. |
| Error/deleted | Red role for diagnostics and deletion. | Brighter red role for diagnostics and deletion. |
| Warning/literals | Amber role for warnings and literal-like tokens. | Brighter amber role for warnings and literal-like tokens. |
| Info/identifier | Blue role for information and identifier-like tokens. | Brighter blue role for information and identifier-like tokens. |
| Added | Green role for additions. | Brighter green role for additions. |

The shared accent `#0b5fff` is expected on paired structural surfaces such as
buttons, focus borders, progress bars, modified gutters, activity badges, tab
active borders, panel active borders, and prominent status bar items.  A dark
theme may use a brighter related value for hover text, links, cursor, or syntax
when contrast requires it.

## Allowed Differences

The dark theme may differ from the light theme for contrast and legibility:

- background luminance and shell layering;
- default, muted, inactive, and placeholder foreground values;
- selection, hover, line-highlight, and find-match fills;
- action hover colors;
- terminal ANSI bright colors;
- diagnostic foreground brightness;
- link and cursor foreground brightness.

Avoid introducing a new hue family or changing the meaning of a token bucket
in only one theme.  For example, if keywords are purple in the light theme,
the dark theme should use a contrast-adjusted purple rather than moving
keywords to blue or green.

## Review Checklist

Before merging future theme changes:

- Compare the two JSON files for key parity in `colors`.
- Compare the two `tokenColors` arrays for matching bucket names, order, and
  scope lists.
- Confirm both themes still appear in `package.json` with the expected
  `uiTheme` values and file paths.
- Check that the primary pccx action/accent surfaces still use `#0b5fff`
  unless a specific contrast exception is recorded.
- Review diagnostics, gutter, and terminal colors as semantic pairs, not as
  isolated palette values.
- Capture or review both themes with the same fixture workspace, editor tab,
  side bar, panel, status bar, selection state, and representative
  SystemVerilog syntax.

Do not use theme documentation or screenshots to imply marketplace
availability, production readiness, stable API/ABI, LSP support, provider
runtime calls, launcher calls, pccx-lab execution, or completed custom theme
support.
