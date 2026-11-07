# Markdown Editor — Architecture

> **Project:** Markdown Editor  
> **Category:** Editor  
> **Cradle Path:** `projects/editor/markdown-editor/`

---

## Overview

Markdown Editor is a split-pane writing tool that lets you write Markdown on the left and see a live HTML preview on the right. It includes zero-latency KaTeX mathematical formula rendering (inline and block math), line-based bi-directional synchronized scrolling, a rich formatting toolbar, keyboard shortcuts, word/character count, estimated reading time, resizable panes, export to `.md` and styled `.html` (with bundled math styling), and automatic local storage persistence.

---

## Purpose & Goals

- Provide a fast, distraction-free Markdown writing experience
- Render a faithful live HTML preview as the user types, including LaTeX mathematics via KaTeX
- Ensure editor source and preview stay seamlessly aligned during scrolling via bi-directional synchronized scroll
- Offer a toolbar and keyboard shortcuts for common formatting operations and math equations
- Allow exporting the document as Markdown or self-contained styled HTML with math support
- Persist content across sessions using localStorage
- Remain dependency-free (no build step; Marked.js and KaTeX loaded via CDN)

---

## Folder Structure

```text
markdown-editor/
├── index.html          # Page shell, toolbar, split pane, status bar
├── script.js           # Preview engine, toolbar actions, shortcuts, export, pane resize
├── style.css           # Split layout, toolbar, markdown body styling
└── ARCHITECTURE.md     # This file
```

---

## System / Project Architecture Overview

```mermaid
graph TD
    A[index.html] --> B[script.js]
    A --> C[style.css]
    A --> D[tokens.css]
    A --> E[marked.js CDN]
    A --> K[katex.min.js & CSS CDN]
    B --> M[processMathInMarkdown]
    M --> K
    M --> E
    B --> S[initSyncScroll - Bi-directional]
    B --> F[localStorage]
    B --> G[DOM — preview pane]
    B --> H[Blob download — export md/html]
    D --> C
```

---

## Component Breakdown

| File         | Responsibility                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `index.html` | Page structure, semantic HTML, toolbar buttons (including Math & Sync Scroll), split pane, status bar, loads tokens, Marked.js, and KaTeX |
| `script.js`  | Markdown parsing, KaTeX math extraction/restoration, bi-directional sync scrolling, toolbar actions, shortcuts, export, auto-save |
| `style.css`  | Split-pane layout, toolbar button states, KaTeX math rendering and fallback styling, responsive breakpoints              |

---

## Data Flow / Execution Flow

```text
User opens index.html
↓
Browser loads tokens.css, style.css, marked.js, script.js
↓
init() runs: loads saved content (or default), calls syncAll()
↓
syncAll() parses Markdown → renders HTML in preview pane, updates counts
↓
User types in textarea
↓
input event → syncAll() → renderPreview() → updateCounts()
↓
User clicks toolbar button or presses keyboard shortcut
↓
Action function wraps/inserts text at cursor → syncAll()
↓
Every 2s: localStorage auto-save
↓
User clicks Export → blob created → browser download prompt
```

---

## Key Features

- **Split-pane layout** — side-by-side editor and live preview with draggable divider
- **KaTeX Math Rendering** — inline (`$...$`) and multiline display (`$$...$$`) math formulas rendered seamlessly with KaTeX and graceful text fallback
- **Synchronized Bi-Directional Scrolling** — line-based proportional tracking between editor textarea and preview pane with smooth edge snapping and on/off toggle
- **15 toolbar actions** — heading, bold, italic, strikethrough, lists, checklist, link, image, code, code block, quote, table, horizontal rule, math formula
- **Keyboard shortcuts** — Ctrl+B, Ctrl+I, Ctrl+D, Ctrl+K, Ctrl+Q, Ctrl+H, Ctrl+`, Ctrl+M (math), Ctrl+S (export)
- **Live Markdown parsing** via Marked.js with GFM support and code block rendering
- **Word and character count** — updated in real time
- **Estimated reading time** — based on 200 words/minute
- **Cursor position indicator** — line and column number
- **Export to Markdown** — downloads a `.md` file
- **Export to styled HTML** — downloads a self-contained `.html` file with inline CSS and KaTeX styling
- **Resizable panes** — drag the divider to resize
- **Auto-save** — content persists to localStorage every 2 seconds
- **Tab support** — inserts 2 spaces instead of changing focus
- **Responsive design** — stacks vertically on mobile
- **Default content** — showcases Markdown, math equations, code blocks, and formatting

---

## Technologies Used

| Technology                                          | Purpose                                           |
| --------------------------------------------------- | ------------------------------------------------- |
| HTML5                                               | Page structure and semantic markup                |
| CSS3 (Flexbox, Custom Properties)                   | Split-pane layout, responsive design              |
| Vanilla JavaScript (ES6+)                           | Editor logic, preview, export, keyboard shortcuts |
| Marked.js 12.x (CDN)                                | Markdown-to-HTML parsing with GFM support         |
| KaTeX 0.16.x (CDN)                                  | Zero-latency mathematical typesetting (LaTeX math)|
| localStorage API                                    | Auto-save document content across sessions        |
| Cradle `tokens.css`                                 | Shared design token system                        |
| Cradle `BackToHome.js`                              | Back-to-home navigation component                 |
| Font Awesome 6.x (CDN)                              | Toolbar and UI icons                              |
| Google Fonts (Space Grotesk, Inter, JetBrains Mono) | UI and monospace typography                       |

---

## File Responsibilities

### `index.html`

- Defines the shell: header, toolbar (16 buttons including Math & Sync Scroll), split editor/preview container, status bar, footer
- Loads Cradle `tokens.css` and `BackToHome.js`
- Loads Marked.js 12.x from CDN for Markdown parsing
- Loads KaTeX 0.16.x CSS & JS from CDN for math formulas
- Loads Font Awesome icons and Google Fonts (including JetBrains Mono for monospace)
- Uses semantic `<main>`, `<header>`, `<div role="toolbar">` for accessibility

### `script.js`

- **Marked.js setup** — configures GFM, line breaks, custom renderer for code blocks with language labels
- **Math preprocessing (`processMathInMarkdown`)** — extracts block (`$$...$$`) and inline (`$...$`) math before Marked parser can mangle symbols (underscores, pipes, backslashes), parses Markdown, and renders math tokens with KaTeX (or clean fallback)
- **Bi-directional sync scroll (`initSyncScroll`)** — tracks editor line position proportionally mapped to preview scroll height and vice versa; debounced with `requestAnimationFrame` and locked with `isSyncingScroll` to avoid scroll reverberation
- **`syncAll()`** — orchestrates renderPreview(), updateCounts(), updateLineInfo()
- **`renderPreview()`** — runs math processing + marked parsing and updates `$preview.innerHTML`
- **`updateCounts()`** — calculates characters, words, and estimated reading time
- **`updateLineInfo()`** — tracks cursor position (line, column) for status bar
- **`actions` object** — 15 formatting actions including math (`actions.math`)
- **Selection helpers** — `getSelection_()`, `replaceSelection()`, `insertAtCursor()`, `wrapSelection()`, `wrapLines()`
- **Export functions** — `exportMarkdown()`, `exportHTML()` (with bundled KaTeX CDN stylesheet link) create downloadable blobs
- **Pane resize** — mousedown/mousemove/mouseup handlers on the divider element
- **Keyboard shortcuts** — Ctrl+B/I/D/K/Q/H/`/M/S mapped to toolbar actions
- **Tab key** — inserts 2 spaces instead of moving focus
- **Auto-save** — setInterval every 2s writes to localStorage; init loads saved content or default

### `style.css`

- Uses Cradle design tokens (`--cradle-*`) for all colors, spacing, shadows, radii
- Implements the 3-column split layout with flexbox (editor | divider | preview)
- Styles the toolbar as a horizontal button bar with hover/active states (including `.tool-btn.active` for sync scroll)
- Provides comprehensive markdown body typography (headings, code, tables, blockquotes, lists)
- Styles KaTeX mathematical expressions (`.math-block`, `.katex-display`, `.katex-block-fallback`, `.katex-inline-fallback`, `.katex-error`)
- Responsive: stacks vertically below 768px, single column below 480px
- Custom scrollbar styling for editor and preview panes

---

## Design Decisions

- **Math Placeholder Extraction** — LaTeX expressions often contain underscores (e.g., `x_i`), asterisks (e.g., `A * B`), pipes, or backslashes that standard Markdown parsers interpret as italics, bold, or escaped characters. Extracting math blocks into unique tokens (`@@KATEX_BLOCK_X@@` and `@@KATEX_INLINE_X@@`) prior to Markdown compilation guarantees zero formula corruption.
- **Graceful Math Fallback** — In offline environments or test runtimes where KaTeX is unavailable, formulas are gracefully wrapped into monospace fallback spans/blocks without throwing errors or halting rendering.
- **Line-Based Proportional Synchronized Scrolling** — Calculating the editor's scroll position based on line indices and textarea line height aligns preview sections proportionally with editor text. Edge snapping at 0 and max-scroll ensures reaching the top or bottom of either pane synchronizes the opposing pane completely.
- **Marked.js via CDN** — chosen for mature GFM support without a build step; loaded before script.js
- **Auto-save instead of manual save** — reduces cognitive load; content is always recoverable
- **Placeholder text in actions** — when no text is selected, toolbar wraps a descriptive placeholder so the user can see the syntax
- **Draggable divider** — gives users control over editor/preview ratio without requiring a settings panel
- **Monospace font in editor** — JetBrains Mono for code-like editing experience
- **Default demo content** — showcases all Markdown features so new users immediately understand capabilities
- **Status bar** — provides IDE-like feedback (line/column, reading time) that is absent from most online editors
- **Self-contained HTML export** — includes inline CSS so the exported file renders correctly without external resources

---

## Dependencies

| Dependency                                          | Version | How loaded           | Purpose                              |
| --------------------------------------------------- | ------- | -------------------- | ------------------------------------ |
| Marked.js                                           | 12.x    | CDN `<script>` tag   | Markdown-to-HTML parsing             |
| KaTeX                                               | 0.16.11 | CDN `<link>`/`<script>` | Fast mathematical LaTeX typesetting |
| Cradle `tokens.css`                                 | —       | Local `<link>` tag   | Design tokens                        |
| Cradle `BackToHome.js`                              | —       | Local `<script>` tag | Navigation                           |
| Font Awesome                                        | 6.5.1   | CDN                  | Icons                                |
| Google Fonts (Space Grotesk, Inter, JetBrains Mono) | —       | Google Fonts CDN     | Typography                           |

---

## Future Improvements

- Add syntax highlighting for code blocks (e.g., Prism.js or Highlight.js)
- Support split view toggle (side-by-side vs. tabbed view)
- Add a "find and replace" dialog
- Implement diff mode to show unsaved changes vs. last save
- Add a command palette for quick actions (Ctrl+Shift+P)

---

## Known Limitations

- No real-time collaboration or cloud sync
- No syntax highlighting in the code blocks (plain text only)
- Exported HTML uses a minimal stylesheet — not a full GitHub-flavored Markdown renderer
- Tab size is fixed at 2 spaces; no configuration option
- No undo/redo beyond the browser's built-in textarea undo

---

## Development Notes

- Open `index.html` through a local HTTP server (e.g., `python3 -m http.server 8000`) because the Marked.js CDN script may fail under `file://` due to CORS.
- Marked.js is loaded before `script.js` — ensure the CDN is accessible.
- The default Markdown content is embedded in `script.js` as `DEFAULT_MARKDOWN`.
- Auto-save key: `md_editor_content` in localStorage.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:**
  - Marked.js — [marked.js.org](https://marked.js.org) (MIT License)
  - Font Awesome 6.5.1 — [Font Awesome](https://fontawesome.com) (free icons)
  - JetBrains Mono — [Google Fonts](https://fonts.google.com) (OFL License)
  - Space Grotesk, Inter — [Google Fonts](https://fonts.google.com) (OFL License)

---

## References

- [Markdown Guide](https://www.markdownguide.org/)
- [Marked.js Documentation](https://marked.js.org/)
- [GitHub Flavored Markdown Spec](https://github.github.com/gfm/)
- [MDN Web Docs — textarea](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea)
