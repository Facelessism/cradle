# JSON Converter Architecture

## Overview

JSON Converter is a client-side tool that parses, validates, formats, and converts JSON into three popular data formats — YAML, CSV, and XML — all within the browser with zero external dependencies. It provides a split-pane code editor experience with real-time syntax highlighting, error reporting at the line and column level, and one-click copy/minify/download actions.

---

## Purpose & Goals

- Provide a fast, offline JSON validator with precise error locations (line + column)
- Support lossless conversion to YAML, CSV, and XML without server round-trips
- Demonstrate pure-function core logic separated from DOM orchestration for testability
- Keep the codebase small and dependency-free so a contributor can read it in under 20 minutes

---

## Folder Structure

```
json-converter/
├── index.html       # Entry point: split-pane layout, controls, action buttons
├── style.css        # Dark-theme styling matching dev-tools conventions
├── logic.js         # Pure functions: parse, validate, convert, highlight (UMD export)
├── script.js        # UI orchestration: event binding, highlight sync, toast, clipboard
├── ARCHITECTURE.md  # This file
└── thumbnail.svg    # Project card thumbnail for the gallery
```

---

## System / Project Architecture Overview

The project follows a simple event-driven architecture. The `index.html` provides the UI structure, while `style.css` handles the visual representation of the JSON tree (including syntax highlighting via CSS classes). `script.js` contains the core logic, managing the state of the parsed JSON, the set of collapsed paths, and the search matches.

The system operates in a loop: Input change → Debounced Parse → Tree Reconstruction → DOM Update.

---

## Component Breakdown

| File | Responsibility |
| --- | --- |
| `index.html` | Page shell, input area, tree container, and stats bar |
| `script.js` | JSON parsing, recursive tree rendering, state management (collapsed/selected), search logic, and utility functions |
| `style.css` | Layout, typography, syntax highlighting colors, and tree node animations |

---

## Data Flow / Execution Flow

```

User enters JSON in textarea
↓
300ms Debounce timer starts
↓
tryParse() called → JSON.parse()
↓
renderTree() → renderNode() recursive call
↓
DOM fragment built and appended to treeContainer
↓
updateStats() calculates keys, depth, and size
↓
User interacts (Click node / Search input)
↓
State updates (collapsedPaths / searchMatches)
↓
Partial or full re-render of the tree

```

---

## Key Features

- Real-time JSON syntax validation with line and column error reporting
- Three output formats: YAML, CSV, XML with one-click toggle
- Syntax-highlighted input pane using a transparent-textarea overlay technique
- Format (pretty-print) and Minify buttons for the input JSON
- Copy to clipboard and Download as `.yaml` / `.csv` / `.xml` file
- Keyboard shortcuts: `Tab` inserts 2-space indentation in the editor
- Responsive layout: side-by-side panes on desktop, stacked on mobile

---

## Technologies Used

| Technology | Purpose |
| --- | --- |
| HTML5 | Semantic structure and layout |
| CSS3 | Tree styling, syntax highlighting, and responsive design |
| JavaScript (ES6+) | Recursive rendering, JSON processing, and DOM manipulation |

---

## File Responsibilities

### `index.html`

- Defines the dual-pane layout.
- Provides UI hooks for the input area, search bar, and stats display.

### `script.js`

- `tryParse()`: Handles JSON validation and triggers rendering.
- `renderNode()`: Recursively generates the DOM structure for the JSON tree.
- `searchTree()`: Implements a depth-first search across keys and values.
- `toggleNode()`: Manages the `collapsedPaths` Set to persist state during re-renders.
- `updateStats()`: Computes metadata like total keys and nesting depth.

### `style.css`

- `.tree-node`, `.tree-line`: Defines the indentation and layout of the tree.
- `.tree-key`, `.tree-value-string`, etc.: Provides the syntax highlighting colors.
- `.selected`: Highlights the currently active path.

---

## Design Decisions

- **Recursive rendering**: DOM-based tree built recursively for full interactivity.
- **Collapsed state**: Stored as path strings in a Set for O(1) lookup and easy persistence.
- **Debounced parsing**: 300ms delay prevents excessive re-renders during typing.
- **Path format**: Dot notation for objects, bracket notation for arrays (`$.features[0].name`).
- **CSS escape**: Uses `CSS.escape()` for querying data-path attributes.

---

## Dependencies

None (uses native browser APIs).

---

## Future Improvements

- Support for extremely large JSON files using virtual scrolling.
- Ability to edit JSON values directly within the tree view.
- Exporting the viewed JSON to different formats (XML, YAML).

---

## Known Limitations

- Very deep nesting may lead to performance degradation due to recursive DOM construction.
- No support for circular references in JSON (would cause infinite recursion).

---

## Development Notes

- No build step required; can be run by opening `index.html` in any modern browser.
- Search implementation is case-insensitive.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None.

---

## References

- [MDN Web Docs — JSON.parse()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)
- [MDN Web Docs — CSS.escape()](https://developer.mozilla.org/en-US/docs/Web/API/CSS/escape)
