# URL Parser Architecture Documentation

## Overview

The URL Parser is a developer tool that breaks down a URL into its individual components.

It uses the browser's native `URL` API to extract information like protocol, hostname, path, query parameters, fragments, and file details.

---

## Purpose & Goals

- Break any URL into readable, labelled components without leaving the browser
- Auto-classify the URL: website, API endpoint, image/video/document, GitHub, YouTube, FTP, or email
- Surface query parameters individually with one-click copy per row
- Keep pure parsing logic in `urlEngine.js` so it is unit-testable in Node

---

## Folder Structure

```text
projects/dev-tools/url-parser/
├── ARCHITECTURE.md # Architecture documentation
├── index.html        # Main HTML user interface
├── urlEngine.js      # Modular URL parser, query string builder, and safe encoder
├── script.js         # UI bindings and row creation
└── style.css         # Styling rules
```

---

## System / Project Architecture Overview

```text
┌─────────────────────────────┐
│        User Input URL       │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│      URL Parser Engine      │
│       (script.js)           │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│     URL Information         │
│                             │
│ Protocol                    │
│ Hostname                    │
│ Port                        │
│ Path                        │
│ Query Parameters            │
│ Fragment                    │
│ File Details                │
└──────────────┬──────────────┘
               │
               ▼
```

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Page shell: URL input field, Parse button, result container |
| `urlEngine.js` | Pure functions: `parseURLComponents`, `buildQueryString`, safe encode/decode, `detectFileType`, `detectURLType` |
| `script.js` | UI bindings: reads input, calls the engine, renders label/value/copy rows |
| `style.css` | Card layout, result rows, responsive styling |
| `tests/url-parser.test.js` | Unit test suite covering protocol normalization, query parameter building, and URL encoding |

---

## Data Flow / Execution Flow

```text
User opens index.html
        ↓
User types or pastes a URL and clicks Parse
        ↓
script.js reads the input value
        ↓
urlEngine.parseURLComponents() validates via the native URL API
        ↓
A missing protocol is auto-prepended (https://)
        ↓
script.js builds a data object: type, protocol, host, path, filename, extension, etc.
        ↓
createRow() renders each component with a Copy button
        ↓
Query parameters render as their own section
```

---

## Key Features

- Full component breakdown: type, full URL, length, security, protocol, origin, host, hostname, port, username, path, directory, filename, extension, search, and fragment
- URL auto-classification: website, API endpoint, image/video/document, GitHub, YouTube, FTP, and email
- Query parameters listed individually
- Copy button on every component row using the Clipboard API
- Default port inference (80 for http, 443 for https)
- Auto-prepends `https://` when no scheme is given

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Page structure and semantic markup |
| CSS3 (Flexbox, Custom Properties) | Card layout and result styling |
| Vanilla JavaScript (ES6+) | Parsing logic and DOM rendering |
| URL / URLSearchParams APIs | Native component extraction and query parsing |
| Clipboard API | Per-row copy buttons |
| Node.js (`module.exports`) | Headless unit testing of `urlEngine.js` |

---

## File Responsibilities

### `urlEngine.js`

- `parseURLComponents(urlStr)` — normalizes the scheme and returns structured components or an error
- `buildQueryString(paramArray)` — rebuilds a query string from a parameter array
- `encodeURLComponentSafe` / `decodeURLComponentSafe` — safe percent-encoding helpers
- `detectFileType(extension)` — classifies an extension into Image/Video/Document
- `detectURLType(url, extension)` — human-readable URL classification
- UMD/AMD wrapper exposing the `URLEngine` global

### `script.js`

- `parseURL()` — main handler: validates input, builds the data object, and renders results
- `createRow(label, value)` — creates a label/value row with a Copy button backed by `navigator.clipboard`
- Escapes all output through the shared `escapeHtml` helper

### `index.html`

- URL input pre-filled with a sample value, Parse button, and result container

### `style.css`

- Card shell and input styling, `.item` result rows, and copy button styling

---

## Design Decisions

- **Native URL API first** — parsing delegates to `new URL()` instead of regex, giving spec-compliant host, port, and path handling; the engine only adds structure around the result.
- **Auto-protocol default** — bare hostnames get `https://` prepended so casual input parses without errors.
- **Engine/UI separation** — `urlEngine.js` is pure and UMD-wrapped so it can be unit-tested headlessly, matching the repo-wide dev-tools pattern.
- **Copy per row** — each component gets its own clipboard button so users can grab just the part they need.

---

## Dependencies

None. This project uses only native browser APIs (URL, URLSearchParams, Clipboard API) and Node.js built-in modules for testing — no external libraries are required.

---

## Future Improvements

- Add a "rebuild URL" feature that recombines edited components
- Highlight the matching URL segment in the input as the user hovers a row
- Support punycode/IDN display for internationalized hostnames
- Add a raw byte-length breakdown per component

---

## Known Limitations

- URL classification uses `hostname.includes(...)` checks, so a host like `notapi.example.com` can be misread as an API endpoint
- Password values are masked in the UI and never exposed
- Relative URLs (for example `/path`) are not supported without a base

---

## Development Notes

- Run the unit tests with Node.js built-in test runner:
  ```
  node --test tests/url-parser.test.js
  ```
- `urlEngine.js` is UMD-wrapped and can be loaded in Node directly via `require`
- No build step is required — edit the files and refresh the browser

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None. No external fonts, images, or libraries are used.

---

## References

- [MDN Web Docs — URL API](https://developer.mozilla.org/en-US/docs/Web/API/URL)
- [WHATWG URL Standard](https://url.spec.whatwg.org/)
