# Regular Expression (RegEx) Visualizer & Tester Architecture

## Overview

The RegEx Visualizer & Tester is an interactive developer tool designed to test, debug, and explain regular expressions in real time. It features a semantic token breakdown engine, highlighted live matches, an interactive capture group inspector with color-coded pill overlays, an automated catastrophic backtracking complexity estimator (ReDoS Meter) with visual severity ratings and remediation recommendations, and one-click multi-language code snippet generation for JavaScript, Python, Go, Rust, and Java.

---

## Purpose & Goals

- Help developers understand regular expressions by explaining each token in plain, accessible language.
- Provide real-time match highlighting with color-coded capture group pill overlays inside the test string editor.
- Support both numbered (`$1`, `$2`...) and named (`(?<name>...)`) capture groups with character ranges and lengths.
- Deliver an interactive capture group inspector table allowing developers to click any pill or row to instantly focus and select that matched group inside the editor.
- Estimate catastrophic backtracking complexity ($O(n)$, $O(n^2)$, $O(2^n)$) to flag Regular Expression Denial of Service (ReDoS) vulnerabilities before patterns reach production.
- Generate production-ready, idiomatically formatted regex code snippets across JavaScript, Python, Go, Rust, and Java with proper string escaping and flag mapping.
- Keep the parsing and analysis engine pure and decoupled from the DOM so it can be thoroughly unit-tested.

---

## Folder Structure

```text
projects/dev-tools/regex-visualizer/
├── ARCHITECTURE.md    # System architecture and technical documentation
├── index.html         # Page shell: inputs, flags, tester, inspector, ReDoS meter & code generator
├── regexEngine.js     # Pure engine: token parser, capture group tree, ReDoS analyzer & code generator
├── script.js          # DOM bindings, highlight overlay, ReDoS meter UI & code snippet copying
└── style.css          # Dark theme, ReDoS severity gauge, language tabs, code blocks & pill palette
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
 └──────┬────────────────┬───────┘
        │                │
        ├────────────────┼──────────────────────────────┐
        ▼                ▼                              ▼
 ┌──────────────┐ ┌────────────────────────────┐ ┌────────────────────────────┐
 │ Pattern      │ │ ReDoS Complexity Estimator │ │ Multi-Language Generator   │
 │ Explainer    │ │ (analyzeReDoS: O(n), O(2ⁿ))│ │ (JS, Python, Go, Rust, Java)│
 └──────┬───────┘ └──────┬─────────────────────┘ └──────┬─────────────────────┘
        │                │                              │
        ▼                ▼                              ▼
 ┌──────────────┐ ┌────────────────────────────┐ ┌────────────────────────────┐
 │ Human        │ │ ReDoS Meter Gauge, Badges, │ │ Syntax-Highlighted Snippet │
 │ Readable     │ │ Fixes & Attack Payload Box │ │ with One-Click Copy        │
 │ Breakdown    │ └────────────────────────────┘ └────────────────────────────┘
 └──────────────┘
```

---

## Component Breakdown

| File                             | Responsibility                                                                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                     | Page shell: pattern input, flag toggles, ReDoS meter card, multi-language code generator tabs, explanation, and dual-view match/group inspector table.       |
| `regexEngine.js`                 | Pure engine: `sanitizeFlags`, `compileRegex`, `analyzeReDoS`, `detectCatastrophicPattern`, `generateCodeSnippet`, `generateAllCodeSnippets`, group tree logic.|
| `script.js`                      | DOM wiring: `runRegexProcessor`, `renderReDoSMeter`, `renderCodeSnippets`, copy snippet/payload to clipboard, interactive group selection, overlay highlighting.|
| `style.css`                      | Dark theme, ReDoS risk gauge bars (`fill-safe`..`fill-critical`), language tab bar, code block container, 6-tier group pill palette (`--group-highlight-1..6`).|
| `tests/regex-visualizer.test.js` | Unit test suite covering compilation, flags, token breakdown, ReDoS complexity analysis, multi-language snippet generation, and group tree rendering.         |

---

## Data Flow / Execution Flow

```text
User opens index.html or modifies pattern/flags
        ↓
runRegexProcessor() reads pattern, flags (g, i, m, u, d), and test string
        ↓
RegexEngine.analyzeReDoS() evaluates backtracking risk (O(n), O(n²), O(2ⁿ)):
   ├── Checks for nested quantifiers e.g. (a+)+$, ([0-9]+)+
   ├── Checks for overlapping alternation in repeated groups e.g. (a|aa)+$
   └── Checks for adjacent unbounded repetitions e.g. .*.*, \d+\d+
        ↓
renderReDoSMeter() updates the visual gauge, complexity badge, severity pill, remediation list, and attack payload
        ↓
renderCodeSnippets() generates language-specific code for the selected tab (JavaScript, Python, Go, Rust, Java)
        ↓
If pattern is flagged unsafe for execution:
   Evaluation halts on the test string to protect the browser thread, while token breakdown and fixes remain accessible
        ↓
If pattern is safe:
   new RegExp(pattern, flags) executes against the test string
   processMatches() renders match pills, group trees, and table inspections
```

---

## Key Features

- **Automated Catastrophic Backtracking Complexity Estimator (ReDoS Meter)**:
  - Detects nested quantifiers (`(a+)+$`, `(a*)*`, `([0-9]+)+`), overlapping alternation repetitions (`(a|aa)+$`), and adjacent unbounded quantifiers (`.*.*`).
  - Estimates asymptotic backtracking complexity: $O(n)$ Linear, $O(n^2)$ Polynomial, or $O(2^n)$ Exponential.
  - Visual color-coded severity ratings: **Safe** (Green), **Low Risk** (Blue), **Moderate Risk** (Amber), and **Critical ReDoS** (Red pulse).
  - Actionable remediation recommendations tailored to the specific detected vulnerability pattern.
  - Example malicious backtracking payload generator with 1-click clipboard copying.
- **One-Click Multi-Language Code Snippet Generation**:
  - Target languages: **JavaScript** (`RegExp`), **Python** (`re`), **Go** (`regexp`), **Rust** (`regex`), and **Java** (`java.util.regex.Pattern`).
  - Native string escaping: handles raw string literals (`r"..."`, `` `...` ``), slash escaping, and Java double backslash escapes (`\\\\`).
  - Flag translation: maps browser regex flags (`i`, `m`, `s`, `u`) into language-specific flag constants and builder methods.
  - One-click copy snippet button with visual feedback.
- **Interactive Capture Group Inspector Table**:
  - Inspect matches with numbered (`$1`, `$2`) and named (`(?<name>...)`) groups, showing indices, character ranges, and captured values.
- **Color-Coded Pill Overlays Inside Editor**:
  - Highlight overlays render each capture group as an interactive pill with distinct color tiers (emerald, amber, purple, rose, cyan, lime).
- **Hierarchical Group Tree Rendering**:
  - Safely handles nested and adjacent capture groups without dropping inner groups or generating malformed overlapping HTML tags.
- **Pre-evaluation ReDoS Guard**:
  - Static analysis flags catastrophic backtracking risks before regex execution to prevent browser UI freezing.

---

## Technologies Used

| Technology                              | Purpose                                                          |
| --------------------------------------- | ---------------------------------------------------------------- |
| HTML5                                   | Page structure, semantic tabs, accessible tables, and code tags  |
| CSS3 (Flexbox, Grid, Custom Properties) | Workspace layout, ReDoS gauge, pill badges, and code container   |
| Vanilla JavaScript (ES6+)               | Engine, ReDoS complexity estimator, code generation, DOM logic   |
| RegExp API (with `d` flag support)      | Pattern compilation, match execution, and group ranges           |
| UMD/AMD wrapper in `regexEngine.js`     | Browser global + Node.js module for headless testing             |
| Outfit & Fira Code (Google Fonts)       | UI typography and monospace code display                         |

---

## File Responsibilities

### `regexEngine.js`

- `VALID_FLAGS` — includes `g`, `i`, `m`, `s`, `u`, `y`, and `d` (indices).
- `sanitizeFlags(flags)` — deduplicates and validates flag characters.
- `analyzeReDoS(pattern)` — computes complexity score (0-100), severity (`safe`, `low`, `moderate`, `critical`), complexity notation (`O(n)`, `O(n²)`, `O(2ⁿ)`), remediation recommendations, and attack payloads.
- `detectCatastrophicPattern(pattern)` / `isCatastrophicPattern(pattern)` — backwards-compatible ReDoS check functions.
- `generateCodeSnippet(pattern, flags, language)` — produces production-ready code snippets with escaping and flag mapping for JavaScript, Python, Go, Rust, and Java.
- `generateAllCodeSnippets(pattern, flags)` — returns snippets for all supported languages.
- `getPatternCaptureGroups(pattern)` — scans pattern to identify capturing group indices and names (`(?<name>...)`).
- `buildGroupTree(matchLength, groups)` — builds a hierarchical non-overlapping tree of group intervals for rendering.
- `renderGroupTreeNode(node, text, escapeFn)` — recursively renders the tree to HTML spans.
- `compileRegex(pattern, flags, options)` — safely builds a RegExp with ReDoS metadata.
- `executeMatch(pattern, flags, inputStr, options)` — execution wrapper with timeout and match cap.
- `parsePatternTokens(pattern)` — tokenizes regex pattern into semantic explanations.
- `executeReplace(pattern, flags, inputStr, replacement, options)` — string substitution helper.

### `script.js`

- `runRegexProcessor()` — central evaluation pipeline connecting inputs to engine and UI.
- `renderReDoSMeter(pattern)` — updates ReDoS gauge, complexity and severity pills, diagnosis, remediation tips, and attack payload box.
- `renderCodeSnippets(pattern, flags)` — updates multi-language code snippet output.
- `processMatches(regex, text, pattern)` — runs matches, builds matches table, populates group inspector, and constructs pill overlay HTML.
- View switcher and language tab switcher listeners.
- Clipboard copy handlers for code snippets and attack payloads.

### `style.css`

- ReDoS risk meter gauge and animated pulse glow for critical vulnerabilities.
- Multi-language tabs bar and code snippet pre/code container styling.
- 6-tier group color palette (`--group-highlight-1..6`, `--group-border-1..6`, `--group-text-1..6`).
- Responsive layout rules and reduced-motion media query handling.

---

## Design Decisions

- **Pure Functional ReDoS Analyzer**: `analyzeReDoS()` is a pure JavaScript function without DOM dependencies, allowing it to run instantly in both client-side UI threads and headless Node.js testing environments.
- **Idiomatic Code Generation**: Each generated snippet follows community best practices for that language (e.g. `RegexBuilder` in Rust, `re.finditer` with raw string literals in Python, `FindAllStringIndex` in Go, `Pattern` with double backslashes in Java).
- **Execution Safeguard**: When a pattern is determined to exhibit exponential backtracking ($O(2^n)$), test string matching is halted to prevent browser thread freezing, while token explanations, remediation advice, and code snippets remain active.
- **Interval Tree for Capture Groups**: Instead of sequential substring matching that fails on nested groups, `buildGroupTree` models capture groups as an interval tree, ensuring valid nested HTML.

---

## Dependencies

None at runtime beyond native RegExp and DOM APIs.

---

## Future Improvements

- Support additional language targets for code generation (e.g. C# / .NET `Regex`, PHP `preg_match`, Ruby `Regexp`).
- Add interactive step-by-step backtracking visualizer demonstrating the exact branching path taken on a failing suffix.
- Add an automatic pattern fixer that rewrites common nested quantifier mistakes into safe linear equivalents.

---

## Known Limitations

- Static ReDoS analysis operates via syntactic heuristics and group stack parsing; certain extremely complex custom lookaround constructions may require dynamic regex fuzzing for full verification.
- The browser regex engine executes with JavaScript's native ECMAScript RegExp semantics; subtle dialect differences in other languages (such as POSIX character classes in Go) may require minor adjustments.

---

## Development Notes

- The project has no build step. Open `index.html` directly or serve through a local dev server.
- Unit tests can be found in `tests/regex-visualizer.test.js`.

---

## License & Attribution

- **Project License:** MIT, inherited from the Cradle repository.
- **Third-Party Assets:** None.

---

## References

- [OWASP Regular Expression Denial of Service (ReDoS)](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS)
- [MDN Web Docs — Regular Expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions)
- [Python re — Regular expression operations](https://docs.python.org/3/library/re.html)
- [Go regexp package](https://pkg.go.dev/regexp)
- [Rust regex crate](https://docs.rs/regex/latest/regex/)
- [Java java.util.regex.Pattern](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/regex/Pattern.html)
