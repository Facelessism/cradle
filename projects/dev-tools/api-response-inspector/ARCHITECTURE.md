# Project Architecture

## Overview

API Response Inspector is a small dev tool that sends a request to any API URL and displays the response's status code, response time, headers, and formatted body. It runs entirely client-side using the browser's `fetch` API — there is no backend or proxy.

## Purpose & Goals

* Give a quick way to inspect an API's response without leaving the browser
* Show status, timing, headers, and a pretty-printed JSON body in one view
* Keep pure formatting/parsing logic separate from DOM code so it is testable

## Folder Structure

```text
api-response-inspector/
├── index.html        # Entry point: request form, response summary, output panels
├── style.css         # Project-specific styling, built on Cradle design tokens
├── apiEngine.js      # Pure helpers: header parsing, byte/duration formatting, JSON pretty-print
├── script.js         # DOM wiring: sends the fetch request and renders the result
├── ARCHITECTURE.md   # Architectural documentation
├── README.md         # Usage instructions
└── thumbnail.svg     # Auto-generated thumbnail

```

## System / Project Architecture Overview

The project follows the same separation used by other Cradle dev-tools mini projects: `apiEngine.js` holds pure, side-effect-free functions (parsing headers, formatting bytes/duration, formatting the response body). `script.js` owns all DOM interaction and calls into `apiEngine.js` for logic. `index.html` defines the structure and loads the shared design tokens plus the shared `escapeHtml` utility for safe rendering of response headers.

```text
index.html --> apiEngine.js (pure logic) --> script.js (DOM + fetch) --> rendered result

```

## Component Breakdown

| File | Responsibility |
| --- | --- |
| `apiEngine.js` | Header text parsing, response header formatting, byte/duration formatting, JSON pretty-printing, status tone mapping, request option building |
| `script.js` | Reads form inputs, calls `fetch`, times the request, renders headers/body, copy-to-clipboard |
| `index.html` | Request form (method, URL, headers, body) and result panels |
| `style.css` | Layout and responsive styling using `--cradle-*` design tokens |

## Data Flow / Execution Flow

1. User enters a URL (and optionally a method, headers, body) and clicks **Send**.
2. `script.js` builds fetch options via `APIEngine.buildRequestOptions`.
3. `fetch()` is called; `performance.now()` measures elapsed time before and after.
4. On success, the response status, headers, and body text are formatted via `apiEngine.js` helpers and rendered into the DOM.
5. On failure (network error, invalid URL, or a CORS block), an error message is shown instead of the result panel.

## Key Features

* Status code, response time, response size, and header count summary
* Full response header list
* JSON body auto-pretty-printed; non-JSON bodies shown as raw text
* Custom request headers and body (for POST/PUT/PATCH)
* Copy-to-clipboard for the response body
* Responsive layout for mobile

## Technologies Used

* **Vanilla HTML, CSS, JavaScript** (no framework, no build step)
* **Browser `fetch` API and `performance.now()**`
* **Cradle shared design tokens** (`src/components/ui/tokens.css`)
* **Cradle shared `escapeHtml` utility** (`src/components/ui/escapeHtml.js`)

## File Responsibilities

### `index.html`

* Request form: method selector, URL input, custom header rows, request body textarea, Send button.
* Response summary strip: status code, response time, response size, header count.
* Response body panel with copy-to-clipboard button.
* Response headers list panel.
* Error message container for failed requests.

### `script.js`

* Reads form inputs (method, URL, headers, body) and constructs the `fetch` options object.
* Calls `APIEngine.buildRequestOptions(...)` to assemble headers + body consistently.
* Times the request with `performance.now()` before and after `fetch`.
* On success, calls `APIEngine.formatHeaders(...)`, `APIEngine.formatBytes(...)`, `APIEngine.formatDuration(...)`, and `APIEngine.formatBody(...)` to produce the rendered strings.
* Renders summary, headers, and body into the DOM using `escapeHtml` for any user-controlled text.
* Wires the "Copy body" button to `navigator.clipboard.writeText`.
* On failure, shows the error message panel and hides the result panels.

### `apiEngine.js`

* `buildRequestOptions(method, url, headers, body)` — returns a fetch options object with method, headers map, and body normalized.
* `parseHeaderString(headerString)` — splits a raw `Key: Value` header line into a trimmed `[key, value]` pair.
* `formatHeaders(headersIterable)` — turns a `Headers` iterator into a sorted array of `[key, value]` pairs for rendering.
* `formatBytes(bytes)` — human-readable byte size (e.g. 1.2 KB).
* `formatDuration(ms)` — human-readable duration (e.g. 123 ms).
* `formatBody(text, contentType)` — pretty-prints JSON, leaves other content types as raw text.
* `statusTone(statusCode)` — returns `"success"` | `"redirect"` | `"client"` | `"server"` for colour-coded status badges.

### `style.css`

* Layout grid: form on top, summary strip below, body + headers side by side.
* Responsive collapse to single column on narrow viewports.
* Status-tone CSS classes (`.tone-success`, `.tone-redirect`, etc.) mapping to Cradle design tokens.
* Copy-button hover/active states.

## Design Decisions

* **Logic Split:** Logic is split into `apiEngine.js` (pure) vs `script.js` (DOM) so the formatting/parsing functions can be tested without a browser environment, matching the pattern used by `url-parser` and `browser-storage-inspector`.
* **Header Iteration:** Response headers are read via the `fetch` `Headers` iterator rather than a raw string, since that's the only header access the browser exposes for cross-origin responses.
* **XSS Defense:** `escapeHtml` is applied to every header value before rendering to defend against XSS from a malicious API echoing script back in its headers.

## Dependencies

| Dependency | Version | How loaded | Purpose |
| --- | --- | --- | --- |
| **Cradle shared tokens.css** | — | `<link>` from `../../../src/components/ui/tokens.css` | Design tokens (colours, spacing, typography) |
| **Cradle shared escapeHtml.js** | — | `<script>` from `../../../src/components/ui/escapeHtml.js` | Safe HTML escaping for response header / body rendering |
| **Browser fetch + Headers + performance.now()** | — | Native | HTTP request, header iteration, timing |

*No external libraries, CDNs, fonts, or runtime packages are required.*

## Future Improvements

* Persist the last N requests to `localStorage` so a session survives a page reload (history / re-run).
* Add a "Save as collection" export to JSON for sharing with teammates.
* Support GraphQL queries with a dedicated request body editor.
* Add response diffing against a saved baseline for regression testing.
* Surface `Content-Security-Policy` and other security-relevant headers with a dedicated, more visible panel.

## Known Limitations

* **CORS Header Exposure:** Cross-origin responses only expose the headers the server allows via `Access-Control-Expose-Headers`; some APIs will show fewer headers than a tool like `curl` would.
* **CORS Restrictions:** Requests to APIs without CORS support will fail with a network error; this is a browser security restriction, not a bug in this tool.
* **No Persistence:** No request history or saved collections (out of scope for this mini).
* **No Streaming:** Streaming responses (SSE, chunked streaming) are not handled — the body is awaited in full before rendering.

## Development Notes

* Open `index.html` directly in a browser, or run the repo's dev server (`npm run dev`). No build step is required for this project itself.
* `apiEngine.js` is plain ES with no DOM access, so it can be loaded into a Node.js test harness via `require()` after a small UMD wrapper (not yet added — see Future Improvements).
* The shared `tokens.css` and `escapeHtml.js` are loaded via relative paths; if you move the project folder, update the `<link href>` and `<script src>` in `index.html`.

## License & Attribution

* **Project License:** MIT, consistent with the rest of the Cradle repository.
* **Third-Party Assets:** None. No images, fonts, or audio files are bundled; all styling is CSS and all logic is vanilla JavaScript.
* **References:**
* [MDN Web Docs — fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
* [MDN Web Docs — Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers)
* [MDN Web Docs — Performance.now()](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now)
* [RFC 7230 — HTTP/1.1 Message Syntax](https://datatracker.ietf.org/doc/html/rfc7230)
* Other Cradle `projects/dev-tools/` mini-projects (e.g. `url-parser`, `browser-storage-inspector`) — file-convention reference
