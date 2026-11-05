# Regular Expression (RegEx) Visualizer & Tester Architecture

## Overview

The RegEx Visualizer & Tester is an interactive developer tool designed to test, debug, and explain regular expressions in real-time. It parses regular expressions, explains their components, runs them against user-provided test strings, and renders highlighted matches alongside an interactive capture group inspector table that maps numbered and named groups (`(?<name>...)`) to color-coded pill overlays directly inside the test string editor.

---

## Purpose & Goals

- Help developers understand regex patterns by explaining each token in plain language.
- Provide real-time match highlighting with color-coded capture group pill overlays.
- Support both numbered (`$1`, `$2`...) and named (`(?<name>...)`) capture groups with character ranges and lengths.
- Deliver an interactive capture group inspector table allowing developers to click any pill or row to instantly jump to and select that matched group inside the editor.
- Make testing fast with common templates, including named capture groups, and flag toggles.
- Keep the parsing engine separate from the DOM so it can be thoroughly unit-tested.

---

## Folder Structure

```text
projects/dev-tools/regex-visualizer/
├── ARCHITECTURE.md    # System documentation
├── index.html         # Page shell: pattern input, flags, tester, inspector, explanation panels
├── regexEngine.js     # Pure engine: token parser, capture group tree builder, ReDoS detector
├── script.js          # DOM bindings, highlight overlay, interactive inspector table
└── style.css          # Dark theme, workspace grid, 6-tier group pill palette, highlight colors
```

---

## System / Project Architecture Overview

```text
┌─────────────────────────────────┐
│     User Regex & Flags Input    │
└────────────────┬────────────────┘
                 │
                 ▼
 ┌───────────────────────────────┐
 │   Regex Visualizer Engine     │
 │    (regexEngine.js / script.js)│
 └──────┬─────────────────┬──────┘
        │                 │
        ▼                 ▼
 ┌──────────────┐  ┌───────────────────────────────────┐
 │ Pattern      │  │ Matcher & Group Tree Builder      │
 │ Explainer    │  │ (parseMatchGroups, buildGroupTree)│
 └──────┬───────┘  └──────┬────────────────────────────┘
        │                 │
        ▼                 ▼
 ┌──────────────┐  ┌───────────────────────────────────┐
 │ Human        │  │ Dynamic Color-Coded Pill Overlays │
 │ Readable     │  │ & Interactive Group Inspector     │
 │ Breakdown    │  │ (Matches Table & Group Inspector) │
 └──────────────┘  └───────────────────────────────────┘
```

---

## Component Breakdown

| File                             | Responsibility                                                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                     | Page shell: template buttons, pattern input, flag checkboxes (including `d`), explanation and tester panels, and dual-view match/group inspector table.     |
| `regexEngine.js`                 | Pure engine: `sanitizeFlags`, `compileRegex`, `detectCatastrophicPattern`, `getPatternCaptureGroups`, `parseMatchGroups`, `buildGroupTree`, `executeMatch`. |
| `script.js`                      | DOM wiring: `runRegexProcessor`, `processMatches`, interactive pill click-to-select, cross-hover highlighting between inspector and editor overlay.         |
| `style.css`                      | Dark theme, workspace grid, 6-tier group pill palette (`--group-highlight-1..6`), pill borders, glowing active states, and inspector view switcher.         |
| `tests/regex-visualizer.test.js` | Unit test suite covering compilation, flags, token breakdown, ReDoS detection, group definitions, tree rendering, and execution limits.                     |

---

## Data Flow / Execution Flow

```text
User opens index.html
        ↓
Browser loads regexEngine.js → escapeHtml.js → script.js
        ↓
runRegexProcessor() reads the pattern, flags (g, i, m, u, d), and test string
        ↓
Pre-evaluation check intercepts catastrophic backtracking patterns (ReDoS)
        ↓
new RegExp(pattern, flags) compiles; errors surface in the banner
        ↓
generateExplainer() tokenizes the pattern via RegexEngine.parsePatternTokens
        ↓
processMatches() runs regex.exec() over the test string
        ↓
getPatternCaptureGroups() scans pattern to identify numbered and named groups (?<name>...)
        ↓
parseMatchGroups() extracts exact indices, values, names, and color tiers (g1..g6)
        ↓
buildGroupTree() & renderGroupTreeNode() assemble nested pill overlay spans in highlightsOverlay
        ↓
Matches Overview & Dedicated Group Inspector tables render interactive color-coded pills
        ↓
Hovering or clicking group pills cross-highlights and selects the text range in the editor
```

---

## Key Features

- **Interactive Capture Group Inspector Table** — Inspect matches with numbered (`$1`, `$2`) and named (`(?<name>...)`) groups, showing match indices, exact character ranges, and captured values.
- **Color-Coded Pill Overlays Inside Editor** — Highlight overlays render each capture group as an interactive pill with distinct color tiers (emerald, amber, purple, rose, cyan, lime).
- **Hierarchical Group Tree Rendering** — Safely handles nested and adjacent capture groups without dropping inner groups or generating malformed overlapping HTML tags.
- **Cross-Interactive Highlighting** — Hovering over any pill or row in the inspector illuminates the corresponding pill in the test editor; clicking any group instantly focuses and selects that exact range in the editor.
- **Flag `d` (hasIndices) Integration** — Leverages modern engine indices for sub-string precision while maintaining graceful fallback indexing.
- **Pre-evaluation ReDoS Guard** — Static analysis flags catastrophic backtracking risks before regex execution.
- **Execution Limits & Timeouts** — Processing enforces a 250ms time limit and a 2,000 match cap to prevent browser freezing.
- **Templates with Named Groups** — Pre-loaded templates include common patterns and named capture group syntax (`(?<year>...)-(?<month>...)-(?<day>...)`).

---

## Technologies Used

| Technology                              | Purpose                                                |
| --------------------------------------- | ------------------------------------------------------ |
| HTML5                                   | Page structure and semantic markup                     |
| CSS3 (Flexbox, Grid, Custom Properties) | Workspace layout, pill badges, and highlight overlay   |
| Vanilla JavaScript (ES6+)               | Engine, tree nesting algorithm, and DOM logic          |
| RegExp API (with `d` flag support)      | Pattern compilation, match execution, and group ranges |
| UMD/AMD wrapper in `regexEngine.js`     | Browser global + Node.js module for testing            |
| Outfit & Fira Code (Google Fonts)       | UI typography and monospace code display               |

---

## File Responsibilities

### `regexEngine.js`

- `VALID_FLAGS` — includes `g`, `i`, `m`, `s`, `u`, `y`, and `d` (indices).
- `sanitizeFlags(flags)` — deduplicates and validates flag characters.
- `getPatternCaptureGroups(pattern)` — scans pattern to identify capturing group indices and names (`(?<name>...)`), skipping non-capturing groups `(?:...)`, lookarounds, escaped parentheses, and character sets.
- `extractGroupIndices(match, fullMatchStr)` — extracts exact start and end ranges using `match.indices` (flag `d`) with fallback sequential locator.
- `parseMatchGroups(match, patternCaptureGroups, matchNumber)` — pairs match data with group definitions and assigns color classes (`g1`..`g6`).
- `buildGroupTree(matchLength, groups)` — builds a hierarchical non-overlapping tree of group intervals for rendering.
- `renderGroupTreeNode(node, text, escapeFn)` — recursively renders the tree to HTML spans with `data-group-num` and `data-group-name`.
- `compileRegex(pattern, flags, options)` — safely builds a RegExp with ReDoS metadata.
- `detectCatastrophicPattern(pattern)` / `isCatastrophicPattern(pattern)` — static ReDoS detector.
- `executeMatch(pattern, flags, inputStr, options)` — execution wrapper with timeout and match cap.
- `parsePatternTokens(pattern)` — tokenizes regex pattern into semantic explanations.
- `executeReplace(pattern, flags, inputStr, replacement, options)` — string substitution helper.

### `script.js`

- `runRegexProcessor()` — central evaluation pipeline connecting inputs to engine and UI.
- `processMatches(regex, text, pattern)` — runs matches, builds matches table, populates group inspector, and constructs pill overlay HTML.
- `attachInspectorInteractions()` — connects mouseenter/mouseleave and click events on table pills to editor selection and overlay illumination.
- View switcher — toggles between `Matches Table` and `Group Inspector` views.
- `updateFlagsInput()` / `updateFlagsCheckboxes()` — synchronizes flag checkboxes (including `d`) with input.
- `generateExplainer(pattern)` — renders the token breakdown.

### `style.css`

- Defines the 6-tier group color palette (`--group-highlight-1..6`, `--group-border-1..6`, `--group-text-1..6`).
- `.hl-group-pill` and `.hl-group-g1..g6` — rounded pill overlay styling in the editor.
- `.group-pill` and `.pill-g1..g6`, `.pill-unmatched` — interactive pill tags in tables.
- `.active-pill` and `.active-row` — glowing accent states on hover and selection.
- View toggle buttons and responsive layout.

---

## Design Decisions

- **Interval Tree for Capture Groups** — Instead of sequential substring matching that fails on nested or duplicate-value groups, `buildGroupTree` models capture groups as an interval tree, rendering nested pill spans with 100% syntactically valid HTML.
- **Engine Separated from UI** — `regexEngine.js` contains no DOM references and works seamlessly in Node.js unit tests.
- **Named and Numbered Parity** — Named groups retain their numerical index `$N` while displaying `<name>` tags, allowing developers to cross-reference positional and named references.
- **Click-to-Select Navigation** — Clicking any group pill or row in the inspector table invokes `setSelectionRange`, focusing the user directly on the matched text in the editor.

---

## Dependencies

None at runtime beyond native RegExp and DOM APIs.

---

## Future Improvements

- Add per-token color coding directly inside the pattern input.
- Extend `parsePatternTokens` to cover Unicode property escapes (`\p{...}`).
- Add a replacement/substitution preview panel.
- Support shareable pattern URLs via the URL hash.

---

## Development Notes

- The project has no build step. Open `index.html` directly or serve through a local dev server.
- Run `npm run validate:architecture` from the repository root after editing this file.

---

## License & Attribution

- **Project License:** MIT, inherited from the Cradle repository.
- **Third-Party Assets:** None.
