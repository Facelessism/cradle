# Text Difference Checker — Architecture

## Overview

Text Difference Checker is a lightweight, dependency-free browser tool for comparing two blocks of text. It provides a side-by-side view of the original and modified text and highlights additions, removals, and modifications.

The project is implemented using vanilla HTML, CSS, and JavaScript. A custom Longest Common Subsequence (LCS) algorithm is used to calculate differences without external libraries.

## Purpose & Goals

The primary goals are:

* Provide a simple browser-based text comparison tool.
* Compare text at line level and word level.
* Clearly distinguish additions, removals, and modified lines.
* Provide side-by-side comparison for easier visual inspection.
* Display basic change statistics.
* Keep the implementation dependency-free and easy to understand.
* Support keyboard-based comparison using Ctrl/Cmd + Enter.

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

The application follows a simple client-side architecture:

```text
User Input
    │
    ▼
index.html
    │
    ├── Textareas
    ├── Mode Controls
    └── Action Controls
    │
    ▼
script.js
    │
    ├── Reads input
    ├── Handles UI events
    ├── Selects diff mode
    └── Renders comparison results
    │
    ▼
diffEngine.js
    │
    ├── LCS line comparison
    ├── LCS word comparison
    ├── Tokenization
    └── Inline word diff generation
    │
    ▼
Rendered DOM
    │
    ├── Original pane
    └── Modified pane
```

All processing happens locally in the browser. No backend server or external API is required.

## Component Breakdown

### `index.html`

Defines the application structure and user interface:

* Application header and description.
* Line Mode and Word Mode controls.
* Compare, Swap, and Clear buttons.
* Original and Modified textareas.
* Statistics display.
* Side-by-side diff output panes.
* Empty-state message.

### `script.js`

Acts as the application controller and UI layer.

Responsibilities include:

* Reading text input.
* Handling button and keyboard events.
* Managing the selected comparison mode.
* Calling the diff engine.
* Pairing changed lines in Word Mode.
* Generating rendered diff rows.
* Updating addition, removal, and modification statistics.
* Updating the DOM.

### `diffEngine.js`

Contains the reusable comparison logic.

Responsibilities include:

* Performing LCS-based array comparison.
* Converting text into lines.
* Converting text into word/whitespace tokens.
* Escaping HTML-sensitive characters.
* Producing inline word-level differences.
* Exposing the diff functionality through `DiffEngine`.

### `style.css`

Controls the visual presentation of the application.

Responsibilities include:

* Layout and responsive behavior.
* Input and button styling.
* Side-by-side diff layout.
* Addition, deletion, and modification highlighting.
* Line-number styling.
* Empty-line visualization.
* Word-level highlighting.

### `thumbnail.svg`

Provides the project's thumbnail/preview graphic where required by the repository.

## Data Flow / Execution Flow

1. The user enters original text and modified text.
2. The user selects Line Mode or Word Mode.
3. The user clicks **Compare** or presses Ctrl/Cmd + Enter.
4. `script.js` reads both textarea values.
5. The input is converted into line arrays using `toLines()`.
6. `diffArrays()` compares the two line arrays using LCS.
7. The resulting operations are grouped into change blocks.
8. In Line Mode, changed lines are rendered as additions or removals.
9. In Word Mode, paired changed lines are treated as modifications.
10. Modified line pairs are passed to `inlineWordDiff()`.
11. Word-level differences are highlighted.
12. `script.js` generates the corresponding DOM markup.
13. The left and right diff panes are updated.
14. Addition, removal, and modification statistics are displayed.

## Key Features

* Side-by-side original and modified text comparison.
* Line-based difference detection.
* Word-level difference detection.
* LCS-based diff algorithm.
* Addition highlighting.
* Removal highlighting.
* Modification highlighting.
* Word-level inline highlighting.
* Line numbers.
* Addition/removal/modification statistics.
* Swap input functionality.
* Clear functionality.
* Ctrl/Cmd + Enter comparison shortcut.
* Responsive layout for smaller screens.
* Dependency-free client-side implementation.

## Technologies Used

* HTML5
* CSS3
* Vanilla JavaScript
* DOM APIs
* LCS (Longest Common Subsequence) algorithm

No framework, package manager, backend service, or external runtime dependency is required.

## File Responsibilities

| File              | Responsibility                                                    |
| ----------------- | ----------------------------------------------------------------- |
| `index.html`      | Defines application markup and UI structure                       |
| `style.css`       | Handles layout, styling, highlighting, and responsiveness         |
| `script.js`       | Handles application state, events, diff rendering, and statistics |
| `diffEngine.js`   | Provides LCS comparison and word-level diff utilities             |
| `thumbnail.svg`   | Provides project thumbnail/preview artwork                        |
| `ARCHITECTURE.md` | Documents project architecture and implementation decisions       |

## Design Decisions

### Vanilla JavaScript

The project intentionally uses vanilla JavaScript instead of a frontend framework. The application is small and primarily performs DOM manipulation and algorithmic text comparison, so a framework would introduce unnecessary complexity.

### LCS-Based Comparison

The Longest Common Subsequence algorithm provides a deterministic way to identify common and changed tokens between two text inputs.

The same generic `diffArrays()` function is reused for both line-level and word-level comparison.

### Separate Diff Engine

Comparison logic is isolated in `diffEngine.js` rather than being embedded entirely in the UI controller. This keeps the algorithm reusable and makes the core logic easier to test independently.

### Two Comparison Modes

Line Mode provides a simpler high-level comparison, while Word Mode provides additional detail by identifying changes inside modified lines.

### Client-Side Processing

All text comparison happens locally in the browser. User-provided text is not sent to a server or external service.

### HTML Escaping

Diff content is escaped before being inserted into `innerHTML` to prevent user-provided text from being interpreted as HTML.

## Dependencies

The project has no external runtime dependencies.

It relies only on:

* Standard browser DOM APIs.
* Native JavaScript language features.
* HTML5 and CSS3.

The shared repository `escapeHtml.js` utility is also loaded by the page, while `diffEngine.js` contains its own escaping helper for standalone reuse of the diff engine.

## Future Improvements

Potential improvements include:

* Add unified diff output mode.
* Add copy-to-clipboard functionality.
* Add download/export functionality.
* Add configurable whitespace handling.
* Add case-sensitive/case-insensitive comparison options.
* Improve handling of very large text inputs.
* Add synchronized scrolling between the two diff panes.
* Add more detailed statistics such as changed words.
* Add automated unit tests for the diff engine.
* Improve accessibility with additional keyboard navigation and screen-reader feedback.

## Known Limitations

* The LCS implementation uses a dynamic programming matrix, which can consume significant memory for very large inputs.
* Word Mode pairs changed lines based on their position inside a change block and may not always produce the most semantically optimal pairing.
* The tool currently focuses on text comparison and does not provide patch generation or merge functionality.
* Comparison is performed entirely in the browser, so very large documents may affect browser performance.
* Whitespace is preserved during comparison and may therefore appear as a difference.
* The current interface does not provide synchronized scrolling between the two result panes.

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
3. Test both Line Mode and Word Mode.
4. Verify addition, deletion, and modification statistics.
5. Test Swap and Clear controls.
6. Test Ctrl/Cmd + Enter.
7. Test empty inputs and inputs containing HTML-sensitive characters.
8. Run repository validation scripts before committing.

## License & Attribution

This project is part of the Cradle repository and was created for issue #138.

The implementation does not depend on third-party libraries or copied runtime code.

Repository:
https://github.com/Facelessism/cradle

Issue:
https://github.com/Facelessism/cradle/issues/138

## References

* Cradle repository: https://github.com/Facelessism/cradle
* Issue #138: https://github.com/Facelessism/cradle/issues/138
* Longest Common Subsequence algorithm: https://en.wikipedia.org/wiki/Longest_common_subsequence_problem
* MDN Web Docs — DOM APIs: https://developer.mozilla.org/en-US/docs/Web/API
* MDN Web Docs — `String.prototype.match()`: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/match