# Regular Expression (RegEx) Visualizer & Tester Architecture

## Overview

The RegEx Visualizer & Tester is an interactive developer tool designed to test, debug, and explain regular expressions in real-time. It parses the regular expression, explains its components, runs it against user-provided test strings, and renders highlighted matches and capture groups dynamically.

---

## Purpose & Goals

- Help developers understand regex patterns by explaining each token in plain language
- Provide real-time match highlighting with capture-group visualization
- Make testing quick with common templates and an instant tester
- Keep the parsing engine separate from the DOM so it can be unit-tested

---

## Folder Structure

```text
projects/dev-tools/regex-visualizer/
├── ARCHITECTURE.md    # System documentation
├── index.html         # Page shell: pattern input, flags, tester, explanation panels
├── regexEngine.js     # Pure engine: token parser, flag validator, replace helper
├── script.js          # DOM bindings, highlight overlay, match tables
└── style.css          # Dark theme, workspace grid, highlight colors
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
 ┌──────────────┐  ┌──────────────┐
 │ Pattern      │  │ Matcher &    │
 │ Explainer    │  │ Highlighter  │
 └──────┬───────┘  └──────┬───────┘
        │                 │
        ▼                 ▼
 ┌──────────────┐  ┌──────────────┐
 │ Human        │  │ Dynamic HTML │
 │ Readable     │  │ Highlighted  │
 │ Breakdown    │  │ Overlay      │
 └──────────────┘  └──────────────┘
```

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Page shell: template buttons, pattern input, flag checkboxes, explanation and tester panels |
| `regexEngine.js` | Pure engine: `sanitizeFlags`, `compileRegex`, `parsePatternTokens`, `executeReplace` |
| `script.js` | DOM wiring: `runRegexProcessor`, `processMatches`, `generateExplainer`, overlay highlighting |
| `style.css` | Dark theme, workspace grid, match and capture-group highlight colors |
| `tests/regex-visualizer.test.js` | Unit test suite covering compilation, flags, token breakdown, and replacements |

---

## Data Flow / Execution Flow

```text
User opens index.html
        ↓
Browser loads regexEngine.js → escapeHtml.js → script.js
        ↓
runRegexProcessor() reads the pattern, flags, and test string
        ↓
new RegExp(pattern, flags) compiles; errors surface in the banner
        ↓
generateExplainer() tokenizes the pattern via RegexEngine.parsePatternTokens
        ↓
processMatches() runs regex.exec() over the test string
        ↓
Match highlights render in the overlay; rows fill the matches table
        ↓
User edits pattern / flags / text → the pipeline runs again
```

---

## Key Features

- Live pattern testing with an instant match-count badge
- Highlight overlay over the test textarea showing matches and capture groups
- Semantic token-by-token explanation of the pattern
- Flag controls (g, i, m, u) as both checkboxes and a manual flag field
- Five common templates: email, URL, phone number, date, and IPv4 address
- Matches table with index range, matched value, and capture-group detail
- Invalid-pattern error banner showing the underlying JS error message

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Page structure and semantic markup |
| CSS3 (Flexbox, Grid, Custom Properties) | Workspace layout and highlight overlay |
| Vanilla JavaScript (ES6+) | Engine and DOM logic |
| RegExp API | Pattern compilation and matching |
| UMD/AMD wrapper in `regexEngine.js` | Browser global + Node.js module for testing |
| Outfit & Fira Code (Google Fonts) | UI typography and monospace code display |

---

## File Responsibilities

### `regexEngine.js`

- `sanitizeFlags(flags)` — keeps only the valid flags `g`, `i`, `m`, `s`, `u`, `y`
- `compileRegex(pattern, flags)` — safely builds a RegExp and returns `{ regex, error }`
- `parsePatternTokens(pattern)` — walks the pattern and returns tokens with explanations for anchors, escapes, quantifiers, groups, and literals
- `executeReplace(pattern, flags, inputStr, replacement)` — substitution helper used by the tests

### `script.js`

- `runRegexProcessor()` — main pipeline: compile, explain, match, and render
- `processMatches(regex, text)` — collects matches, guards against zero-width infinite loops, and builds the overlay and table HTML
- `generateExplainer(pattern)` — renders the token explanations, using `RegexEngine` when available
- `updateFlagsInput()` / `updateFlagsCheckboxes()` — keep flag checkboxes and the flag text field in sync
- `escapeHtml()` — delegates to the shared `CradleEscape` helper

### `style.css`

- `.highlights-overlay` — transparent overlay aligned with the textarea
- `.hl-match` and `.hl-group-1..3` — match and capture-group highlight colors
- `.explanation-item` — token/description rows in the semantic breakdown
- `.matches-table` — match detail table styling

---

## Design Decisions

- **Engine separated from UI** — `regexEngine.js` is pure (no DOM) and wrapped in a UMD/AMD module so the same functions load as a browser global or a `require()`-able module in tests.
- **Overlay highlighting** — a transparent textarea sits on top of a highlight layer so matches can be colored without losing native editing behavior; scroll positions stay in sync.
- **Zero-width match guard** — `processMatches` advances `lastIndex` when a match does not consume input, preventing infinite loops with patterns like `(?=x)*`.
- **No framework** — vanilla JS keeps the tool small and dependency-free.

---

## Dependencies

None at runtime beyond the native RegExp and DOM APIs. The only external resources are the "Outfit" and "Fira Code" fonts loaded from Google Fonts.

---

## Future Improvements

- Add per-token color coding directly inside the pattern input
- Extend `parsePatternTokens` to cover character classes and look-around constructs
- Add a replacement/substitution preview panel
- Support shareable pattern URLs via the URL hash

---

## Known Limitations

- `parsePatternTokens` covers anchors, escapes, quantifiers, groups, and literals, but not full character-class or look-around parsing
- Capture-group highlighting approximates sub-ranges with `indexOf`, which can misalign when the same text appears more than once inside a match
- The generated explanations are English-only

---

## Development Notes

- `regexEngine.js` is UMD/AMD so it can be unit-tested with Node.js built-in test runner:
  ```
  node --test tests/regex-visualizer.test.js
  ```
- `index.html` loads the shared `escapeHtml.js` helper for safe HTML interpolation
- No build step is required — edit the files and refresh the browser

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:**
  - "Outfit" and "Fira Code" fonts by [Google Fonts](https://fonts.google.com) (OFL License)

---

## References

- [MDN Web Docs — Regular Expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions)
- [MDN Web Docs — RegExp](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp)
- [regex101](https://regex101.com/) — pattern tester inspiration
```
