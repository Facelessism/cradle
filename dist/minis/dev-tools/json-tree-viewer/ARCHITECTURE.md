# Project Architecture

## Overview

JSON Tree Viewer is an interactive developer tool for viewing, exploring, and searching JSON data. It features a collapsible tree with syntax highlighting, real-time search, path copying, and format/minify tools.

Self-contained with no dependencies — vanilla HTML, CSS, and JavaScript.

---

## Purpose & Goals

- Parse and visualize JSON data as an interactive tree
- Allow collapsing/expanding individual nodes or all at once
- Search across keys and values with match highlighting
- Copy JSON paths for quick reference
- Format and minify JSON input

---

## Folder Structure

```text
json-tree-viewer/
├── index.html          # Two-panel layout: input + tree view
├── script.js           # Parser, tree renderer, search, copy, stats
├── style.css           # Syntax highlighting, tree styling, responsive
├── ARCHITECTURE.md     # This file
└── thumbnail.svg       # Preview thumbnail
```

---

## Key Features

| Feature | Description |
|---|---|
| **Collapsible Tree** | Click nodes to expand/collapse, toggle individual or all |
| **Syntax Highlighting** | Color-coded: keys (cyan), strings (green), numbers (amber), booleans (purple), null (red) |
| **Real-time Parsing** | 300ms debounced input parsing |
| **Search** | Find keys and values, highlights matches, expands to first match |
| **Path Copying** | Click any node to select its JSON path, copy with button |
| **Format / Minify** | Pretty-print or compress JSON input |
| **Sample Data** | One-click load of realistic sample JSON |
| **Stats Bar** | Type, key count, depth, size, selected path |
| **Keyboard Shortcuts** | Ctrl+F (search), Escape (clear search) |

---

## Technical Decisions

- **Recursive rendering**: DOM-based tree built recursively for full interactivity
- **Collapsed state**: Stored as path strings in a Set for O(1) lookup
- **Debounced parsing**: 300ms delay prevents excessive re-renders during typing
- **Path format**: Dot notation for objects, bracket notation for arrays (`$.features[0].name`)
- **CSS escape**: Uses `CSS.escape()` for querying data-path attributes
