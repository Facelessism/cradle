# Project Architecture

## Overview

The Terminal Portfolio Generator is a browser-based web application that allows users to create, customize, preview, and download a terminal-style portfolio. It uses a split-pane layout where the left pane acts as a configuration editor and the right pane serves as a live terminal preview.

---

## Purpose & Goals

- Provide an easy-to-use interface to generate a terminal-style developer portfolio
- Allow live preview of the configuration in an interactive terminal emulator
- Enable users to export the final portfolio as a single, standalone HTML file with zero dependencies

---

## Folder Structure

```
terminal-portfolio-generator/
├── exportHtml.js       # Module to generate the standalone dependency-free HTML export
├── index.html          # Main HTML structure for the editor and live preview UI
├── portfolioEngine.js  # Core logic for data validation and parsing terminal commands
├── script.js           # Main app logic, event listeners, and DOM updates
├── style.css           # Styling for the split-pane layout and terminal components
├── theme.js            # Configuration for the available terminal color schemes
└── thumbnail.svg       # Generated preview thumbnail for the project gallery
```

---

## System / Project Architecture Overview

The project is a client-side application built with vanilla web technologies. User input from the form (`index.html`) is processed and validated by `portfolioEngine.js`. `script.js` listens to changes, applies them, and renders the live output in the terminal emulator pane. The `exportHtml.js` module takes the current state and theme configuration to assemble a fully self-contained HTML file.

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Page shell, form inputs, and terminal pane layout |
| `script.js` | UI interactions, event listeners, and live terminal updates |
| `style.css` | App layout, themes styling, and typography |
| `portfolioEngine.js` | Data model validation, command parsing, and terminal response logic |
| `exportHtml.js` | Generates a fully standalone HTML document for export |
| `theme.js` | Defines color themes and converts them to CSS custom properties |

---

## Data Flow / Execution Flow

```
User opens index.html
↓
Browser loads HTML, CSS, and JS modules
↓
Initialization — default theme applied and initial empty portfolio parsed
↓
Event listeners attach to form fields and terminal input
↓
User types in form → `script.js` rebuilds command output via `portfolioEngine.js` → Terminal preview updates
↓
User types in terminal → `portfolioEngine.js` matches command or suggests typo correction → Terminal renders output
↓
User clicks Export → `exportHtml.js` combines output and theme into a blob → User downloads standalone HTML
```

---

## Key Features

- Split-pane layout with live synchronization between config form and terminal
- Built-in terminal emulator supporting commands like `help`, `whoami`, `projects`, etc.
- Tab-completion and typo detection (Levenshtein distance) in the terminal
- 4 color themes out-of-the-box (Classic Green, Blue, Amber, Light)
- 100% client-side execution and export of a zero-dependency static HTML portfolio

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Page structure and semantic markup |
| CSS3 (Custom Properties) | Layout, styling, and dynamic themes |
| Vanilla JavaScript (ES6+) | Core logic, event handling, and HTML export |

---

## File Responsibilities

### `index.html`
- Defines the split-pane layout with the `.pane` elements.
- Holds the configuration form and the `<template>` blocks used for dynamically adding projects, experience, and education.

### `script.js`
- `rebuildAndRender()` — reads form input, builds the command registry, and renders the initial terminal blocks.
- `handleTerminalCommand()` — parses raw input, runs the command against the engine, and appends the result to the DOM.
- `handleExport()` — triggers the download of the assembled HTML blob.

### `portfolioEngine.js`
- `buildCommandOutput()` — maps the portfolio object to a registry of available commands and their pre-rendered text lines.
- `runCommand()` — uses Levenshtein distance (`findClosestCommand()`) to match mistyped commands and suggest corrections.

---

## Design Decisions

- **Client-Side Export** — The standalone HTML is generated entirely in the browser using `Blob` and `URL.createObjectURL()`, ensuring zero server dependency and immediate downloads.
- **Pure Functions for Engine Logic** — `portfolioEngine.js` logic does not interact with the DOM. It processes raw data objects and strings, making it fully decoupled and theoretically testable in a Node.js environment.

---

## Dependencies

| Dependency | Version | How loaded | Purpose |
| --- | --- | --- | --- |
| IBM Plex Mono | — | Google Fonts CDN (`<link>` tags) | Terminal UI typography |
| JetBrains Mono | — | Google Fonts CDN (`<link>` tags) | Terminal and editor typography |

This project otherwise uses only native browser APIs and the shared Cradle `escapeHtml.js` component — no external libraries are required.

---

## Future Improvements

- Add support for importing an existing configuration JSON or HTML file
- Support for more advanced terminal animations (typing effect)
- Expand available color themes and add custom theme creator

---

## Known Limitations

- Editor state is not persisted — refreshing the page resets all form fields.
- No import support for existing configuration files.
- The exported standalone HTML shows the static command output only; the interactive terminal emulator is not included in the export.
- Typo suggestions rely on an edit-distance threshold, so very distant typos fall back to a plain "command not found".

---

## Development Notes

- Open `index.html` through a local server (e.g. `python3 -m http.server 8000`), not by double-clicking the file, so the Google Fonts stylesheet loads correctly.
- `portfolioEngine.js`, `theme.js`, and `exportHtml.js` use UMD-style exports, so they can also be required in Node.js for unit testing.
- No build step is required — edit the files and refresh the browser.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:**
  - IBM Plex Mono font by IBM (https://fonts.google.com/specimen/IBM+Plex+Mono), loaded from the Google Fonts CDN.
  - JetBrains Mono font by JetBrains (https://fonts.google.com/specimen/JetBrains+Mono), loaded from the Google Fonts CDN.

---

## References

- [MDN Web Docs — Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob)
- [MDN Web Docs — URL.createObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static)
- [Levenshtein distance — Wikipedia](https://en.wikipedia.org/wiki/Levenshtein_distance)
