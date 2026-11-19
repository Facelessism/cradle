# Text Difference Checker — Architecture

## Overview

Text Difference Checker is a lightweight, dependency-free browser tool for comparing two blocks of text. It provides a synchronized dual-pane side-by-side split view as well as a GitHub/GitLab-style inline unified view, sub-word character-level diff highlighting using the Myers diff algorithm, configurable ignore rules (ignore whitespace, ignore case, trim line endings), collapsible unchanged context blocks, and one-click standard Git Unified Diff (`.patch`) export.

The project is implemented using vanilla HTML, CSS, and JavaScript. An optimized Myers diff algorithm ($O((N+M)D)$ time complexity) with prefix/suffix trimming is used to calculate minimal edit scripts without external libraries.

## Purpose & Goals

The primary goals are:

- Provide a modern, high-performance browser-based text comparison and code review tool.
- Compare text at line level, word level, and sub-word character level.
- Support both synchronized dual-pane side-by-side split view and inline unified diff view.
- Provide sub-word character-level diff highlighting using the Myers diff algorithm.
- Offer configurable ignore rules: ignore whitespace differences, ignore character case, and trim line endings.
- Support collapsible unchanged context blocks for clean review of localized changes in large documents.
- Generate and export standard Git Unified Diff (`.patch`) files with one-click clipboard copying and file download.
- Clearly distinguish additions, removals, and modifications with accessible visual cues and hunk statistics.
- Keep the implementation dependency-free, lightweight, and easy to understand.
- Support keyboard shortcuts (Ctrl/Cmd + Enter to compare, Ctrl/Cmd + Shift + S to swap inputs).

## Folder Structure

```text
text-diff-checker/
├── index.html
├── style.css
├── script.js
├── diffEngine.js
├── thumbnail.svg
└── ARCHITECTURE.md
```

## System / Project Architecture Overview

The application follows a modular, reactive client-side architecture:

```text
User Input & Options
    │
    ▼
index.html
    │
    ├── Textareas (Original & Modified)
    ├── Mode Controls (Line / Word / Character)
    ├── View Controls (Split View / Unified View)
    ├── Ignore Options (Whitespace / Case / Endings)
    └── Action Controls (Compare / Swap / Clear / Patch Export)
    │
    ▼
script.js (UI Controller & Synchronizer)
    │
    ├── Reads input & options
    ├── Handles UI events & keyboard shortcuts
    ├── Synchronizes side-by-side pane scrolling
    ├── Invokes DiffEngine based on selected mode & options
    ├── Computes collapsible context blocks & hunks
    ├── Renders Split View or Unified View DOM
    └── Dispatches Unified Patch generation (.patch)
    │
    ▼
diffEngine.js (Core Diff & Patch Engine)
    │
    ├── Myers diff algorithm (O((N+M)D) minimal edit script)
    ├── Prefix & suffix common sequence trimming
    ├── Configurable token normalization (whitespace, case, endings)
    ├── Word-level diff generator (inlineWordDiff)
    ├── Character-level diff generator (inlineCharDiff)
    └── Git Unified Diff generator (generateUnifiedPatch)
    │
    ▼
Rendered DOM Output
    │
    ├── Synchronized Split View (#diffOutput: #leftPane & #rightPane)
    ├── Unified PR View (#unifiedDiffOutput: #unifiedPane)
    └── Patch clipboard copy / file download
```

All processing happens locally in the browser. No backend server or external API is required.

## Component Breakdown

### `index.html`

Defines the application structure and user interface:

- Application header and description.
- Mode toggles: Line Mode, Word Mode, and Character Mode (`#charModeBtn`).
- View toggles: Split View (`#splitViewBtn`) vs. Unified View (`#unifiedViewBtn`).
- Options toolbar: Ignore Whitespace (`#chkIgnoreWhitespace`), Ignore Case (`#chkIgnoreCase`), Trim Line Endings (`#chkTrimEndings`), and Collapse Unchanged Context (`#chkCollapseContext`).
- Action buttons: Compare (`#compareBtn`), Swap (`#swapBtn`), Clear (`#clearBtn`), Copy Patch (`#copyPatchBtn`), and Download Patch (`#downloadPatchBtn`).
- Original and Modified input textareas with character/line indicators.
- Statistics toolbar displaying additions, removals, modifications, and diff hunks.
- Side-by-side split output container (`#diffOutput`) with synchronized `#leftPane` and `#rightPane`.
- Unified diff output container (`#unifiedDiffOutput`) with inline `#unifiedPane`.
- Empty-state message and keyboard shortcut reference.

### `script.js`

Acts as the application controller, scroll synchronizer, and UI rendering layer.

Responsibilities include:

- Reading text inputs and active configuration (mode, view, ignore rules, collapse state).
- Synchronizing vertical scroll positions between the left and right split panes with re-entrancy prevention flags (`isSyncingLeft`, `isSyncingRight`).
- Pairing changed lines in Word and Character modes to calculate intra-line modifications.
- Calculating hunk boundaries and collapsing large runs of unchanged lines (>= 6 lines) into interactive expander rows (`diff-collapse-row`).
- Rendering Split View DOM with matched row heights and blank filler rows for insertions/deletions.
- Rendering Unified View DOM with dual line-number columns (old/new), hunk headers (`@@ -old,count +new,count @@`), and diff markers (`+`, `-`, ` `).
- Generating and exporting standard `.patch` files via browser Blob downloads and system clipboard copying.
- Managing keyboard shortcuts (`Ctrl/Cmd + Enter` to compare, `Ctrl/Cmd + Shift + S` to swap).

### `diffEngine.js`

Contains the pure, reusable comparison and patch-generation logic.

Responsibilities include:

- Executing the Myers diff algorithm (`myersDiff`) with prefix/suffix trimming for $O((N+M)D)$ time and memory efficiency.
- Normalizing tokens (`normalizeToken`) according to ignore rules (`ignoreWhitespace`, `ignoreCase`, `trimLineEndings`).
- Tokenizing text into lines (`toLines`), words with whitespace (`toWordTokens`), and individual characters (`toCharTokens`).
- Generating HTML-safe word-level highlights (`inlineWordDiff`).
- Generating HTML-safe sub-word character-level highlights (`inlineCharDiff`).
- Generating standard Git Unified Diff format patches (`generateUnifiedPatch`) with hunk headers and configurable context radius.
- Exposing the diff engine via `DiffEngine` global and CommonJS `module.exports`.

### `style.css`

Controls the visual presentation, responsive layout, and diff visual indicators.

Responsibilities include:

- Options toolbar and toggle switch styling.
- Synchronized split-pane layout with matched line heights and synchronized scrolling.
- Unified PR view layout with dual line-number gutters (`.line-num-old`, `.line-num-new`) and marker gutters.
- Sub-word and character-level diff highlighting (`.char-del`, `.char-add`, `.word-del`, `.word-add`).
- Hunk headers (`.diff-hunk-header`) and collapsible context rows (`.diff-collapse-row`, `.btn-expand-context`).
- Addition (`.line-add`), deletion (`.line-del`), and modification (`.line-mod`) color tokens with accessible contrast.
- Patch export button animations and copied state feedback.

### `thumbnail.svg`

Provides the project's thumbnail/preview graphic where required by the repository.

## Data Flow / Execution Flow

1. The user enters original text and modified text.
2. The user selects a comparison mode (**Line**, **Word**, or **Character**) and a view mode (**Split** or **Unified**).
3. The user configures ignore rules (**Ignore Whitespace**, **Ignore Case**, **Trim Endings**) and toggles **Collapse Unchanged**.
4. The user clicks **Compare** or presses `Ctrl/Cmd + Enter`.
5. `script.js` extracts textarea inputs and active option flags.
6. The input is tokenized into line arrays using `toLines()`.
7. `diffArrays()` invokes `myersDiff()` with the active ignore options to produce the minimal edit script.
8. The raw diff operations are grouped into cohesive change hunks.
9. For paired additions and deletions:
   - In Word Mode: `inlineWordDiff()` performs sub-line word tokenization and Myers diffing.
   - In Character Mode: `inlineCharDiff()` performs fine-grained character tokenization and Myers diffing.
10. If Split View is active:
    - `renderSplitView()` outputs parallel rows into `#leftPane` and `#rightPane`.
    - Blank placeholder lines (`diff-empty`) are inserted where additions or deletions occur on one side.
    - Scroll listeners synchronize scrolling across both panes smoothly.
11. If Unified View is active:
    - `renderUnifiedView()` generates a single-column inline stream with dual line numbers and hunk headers.
    - If "Collapse Unchanged" is checked, blocks of unchanged lines are collapsed into interactive buttons (`↕ Show X unchanged lines`).
12. Hunk and change statistics are updated in the statistics bar.
13. If the user clicks **Copy .patch** or **Export .patch**, `generateUnifiedPatch()` formats the diff into a standard git patch file.

## Key Features

- **Synchronized Dual-Pane Split View**: Parallel left/right panes with proportional line-locked scroll synchronization.
- **GitHub/GitLab Style Unified View**: Single-stream diff with dual line-number columns, hunk indicators, and clean line markers.
- **Myers Diff Algorithm**: Fast $O((N+M)D)$ minimal edit script generation with prefix/suffix trimming.
- **Sub-Word Character-Level Highlighting**: Detailed character-by-character change visualization for typos, numerical adjustments, and syntax tweaks.
- **Word-Level Highlighting**: Word tokenization preserving whitespace for natural prose and source code diffs.
- **Configurable Ignore Rules**:
  - *Ignore Whitespace*: Disregards differences in indentation and whitespace padding.
  - *Ignore Case*: Performs case-insensitive character comparisons.
  - *Trim Line Endings*: Strips carriage return (`\r`) differences between Unix and Windows line endings.
- **Collapsible Unchanged Context Blocks**: Collapses large runs of unchanged lines with one-click expansion.
- **Standard Git Unified Patch Export**: One-click clipboard copying and `.patch` file download compatible with `git apply`.
- **Real-Time Statistics**: Additions count, deletions count, modifications count, and diff hunk tally.
- **Input Manipulation Controls**: Quick Swap Inputs (`Ctrl+Shift+S`) and Clear Inputs.
- **Keyboard Shortcuts**: `Ctrl/Cmd + Enter` to compare, `Ctrl/Cmd + Shift + S` to swap.
- **Security & Safety**: Full HTML entity escaping across all tokenizers to prevent XSS.
- **Dependency-Free**: 100% vanilla JavaScript, CSS3, and HTML5 without any external libraries.

## Technologies Used

- HTML5
- CSS3 (Flexbox, CSS Grid, Custom Properties)
- Vanilla JavaScript (ES2020+)
- DOM APIs & Mutation Observers
- Myers Diff Algorithm ($O((N+M)D)$ shortest edit script)
- Browser Blob & Clipboard APIs

No framework, package manager, backend service, or external runtime dependency is required.

## File Responsibilities

| File              | Responsibility                                                    |
| ----------------- | ----------------------------------------------------------------- |
| `index.html`      | Defines application markup and UI structure                       |
| `style.css`       | Handles layout, styling, highlighting, and responsiveness         |
| `script.js`       | Handles application state, events, diff rendering, and statistics |
| `diffEngine.js`   | Provides Myers diff algorithm, character/word-level diffing, ignore rules, and git unified patch generation |
| `thumbnail.svg`   | Provides project thumbnail/preview artwork                        |
| `ARCHITECTURE.md` | Documents project architecture and implementation decisions       |

## Design Decisions

### Vanilla JavaScript

The project intentionally uses vanilla JavaScript instead of a frontend framework. The application is small and primarily performs DOM manipulation and algorithmic text comparison, so a framework would introduce unnecessary complexity.

### Myers Diff Algorithm

Rather than using an $O(N \times M)$ dynamic programming matrix that exhausts browser memory on large texts, the diff engine implements Eugene W. Myers' $O((N+M)D)$ shortest edit script algorithm. Common prefixes and suffixes are trimmed in $O(K)$ prior to running the diagonal exploration, drastically decreasing $D$ (the edit distance) and yielding instantaneous diff computation for source code and documentation.

### Sub-Word and Character-Level Granularity

While line diffing gives a coarse view of structural changes, character-level diffing decomposes changed line pairs into individual glyphs. Changed segments are wrapped in semantic `<span class="char-del">` and `<span class="char-add">` tags with distinct background and border highlights, allowing users to immediately spot single-character typos or minor variable renames.

### Configurable Ignore Rules

Text comparisons often need to filter out noise such as inconsistent line endings (CRLF vs LF) or differing indent levels. The engine provides three orthogonal token normalizers (`ignoreWhitespace`, `ignoreCase`, and `trimLineEndings`) that normalize tokens prior to equivalence checks while preserving the original raw character strings in the rendered DOM output.

### Re-Entrancy Safe Scroll Synchronization

When syncing scroll offsets between two adjacent DOM scroll containers, setting `.scrollTop` on one container immediately fires its `scroll` event, which in turn sets `.scrollTop` on the other container. To prevent infinite scroll loops and jerky jitter, boolean locks (`isSyncingLeft` and `isSyncingRight`) guard against recursive event dispatching.

### Standard Git Unified Diff Patch Export

To bridge browser diff inspection with existing developer toolchains, the patch generator strictly implements the Git Unified Diff format (`--- a/...`, `+++ b/...`, `@@ -oldStart,oldCount +newStart,newCount @@`). Patches can be copied to the clipboard or downloaded as `.patch` files and applied directly using `git apply`.

### Collapsible Context Blocks

When comparing large documents with localized changes, reviewing hundreds of unchanged lines is cumbersome. When "Collapse Unchanged" is enabled, unchanged runs exceeding 5 lines are folded into interactive collapse rows showing the hidden line count. Clicking any fold instantly unfolds that section.

### HTML Escaping & Security

All inputs, diff tokens, and unified patch lines are escaped before insertion into DOM containers to prevent XSS vulnerabilities from untrusted text snippets.

## Dependencies

The project has no external runtime dependencies.

It relies only on:

- Standard browser DOM APIs.
- Native JavaScript language features (ES2020+).
- HTML5 and CSS3.

The shared repository `escapeHtml.js` utility is also loaded by the page, while `diffEngine.js` contains its own escaping helper for standalone reuse of the diff engine.

## Future Improvements

Potential improvements include:

- Add syntax highlighting for common programming languages (JavaScript, Python, JSON, CSS).
- Add 3-way merge conflict resolution interface.
- Add image and binary file diff viewers.
- Support drag-and-drop file comparison.
- Add side-by-side minimap navigation for very large files.

## Known Limitations

- Myers diff operates synchronously on the main thread; extremely large files (>50,000 lines) may cause a momentary UI pause without Web Worker offloading.
- Word and Character mode intra-line pairing matches lines sequentially within each modification hunk.

## Development Notes

The project is designed to remain dependency-free and can be opened directly in a modern browser.

For local development, the repository can be served using:

```bash
python -m http.server 8000
```

The tool can then be accessed through the appropriate project path under the local repository server.

The main development flow is:

1. Modify HTML, CSS, or JavaScript.
2. Open or reload the application in a browser.
3. Test Line Mode, Word Mode, and Character Mode.
4. Test Split View and Unified View.
5. Verify ignore rules (whitespace, case, line endings).
6. Test collapsible context block folding and expanding.
7. Test `.patch` clipboard copy and download export.
8. Verify addition, deletion, modification, and hunk statistics.
9. Test Swap (`Ctrl+Shift+S`) and Compare (`Ctrl+Enter`).
10. Run repository validation scripts before committing.

## License & Attribution

This project is part of the Cradle repository and was created for issue #138.

The implementation does not depend on third-party libraries or copied runtime code.

Repository:
https://github.com/Facelessism/cradle

Issue:
https://github.com/Facelessism/cradle/issues/138

## References

- Cradle repository: https://github.com/Facelessism/cradle
- Issue #138: https://github.com/Facelessism/cradle/issues/138
- Eugene W. Myers — *An O(ND) Difference Algorithm and Its Variations* (1986): http://www.xmailserver.org/diff2.pdf
- Git Unified Diff Format: https://git-scm.com/docs/diff-format
- MDN Web Docs — DOM APIs: https://developer.mozilla.org/en-US/docs/Web/API
- MDN Web Docs — Clipboard API: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
