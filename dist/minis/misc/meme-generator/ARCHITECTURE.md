# Meme Generator Studio Architecture Documentation

## Overview

The Meme Generator Studio is an interactive HTML5 Canvas meme creation tool. It features custom text overlay rendering, real-time typography styling, custom file uploads, random meme API ingestion, preset saving via LocalStorage, and image export capabilities.

## Purpose & Goals

- Let users create classic top/bottom-text memes entirely in the browser with a live canvas preview.
- Provide real-time typography controls (font size, text fill color, outline color) with no build step.
- Pull random meme templates from the meme-api.com public API for quick inspiration.
- Persist up to 10 saved meme presets in localStorage so they survive page reloads.
- Export finished memes as PNG downloads.

## Folder Structure

```text
projects/misc/meme-generator/
├── ARCHITECTURE.md    # Project documentation
├── index.html         # Studio UI shell: control panel, canvas preview, preset gallery
├── style.css          # Dark studio theme and responsive layout
├── memeEngine.js      # Canvas text wrapping and composite rendering engine
├── memeStorage.js     # localStorage preset persistence
├── script.js          # DOM binding layer, event listeners, and API fetcher
└── thumbnail.svg      # Gallery thumbnail
```

## System / Project Architecture Overview

The project follows a simple separation of concerns. `script.js` is the controller: it owns every DOM element and event listener, reads the current control values, and calls into two pure modules. `memeEngine.js` handles all canvas math and text rendering, while `memeStorage.js` handles reading and writing presets in localStorage. Both engine modules use UMD wrappers so they run in the browser and can be unit-tested with Node.js. `index.html` wires everything together with plain script tags plus the shared Cradle helpers (`storage.js` and `BackToHome.js`).

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Studio layout: control panel, live canvas preview card, preset gallery; loads shared Cradle scripts |
| `style.css` | Dark studio theme, Poppins typography, responsive two-column workspace, preset grid layout |
| `memeEngine.js` | Text wrapping math and HTML5 2D canvas drawing logic |
| `memeStorage.js` | Storage manager for keeping history of up to 10 meme presets in `localStorage` |
| `script.js` | DOM binding layer, event listeners, and API fetcher |

## Data Flow / Execution Flow

```text
┌─────────────────────────────────────────────────────────────┐
│                    Meme Generator Interface                 │
│    Text Inputs, Font Controls, Image Uploader, Presets      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────┴──────────────────────────────┐
│            Meme Engine & Text Canvas (memeEngine.js)        │
│   • Text Wrapping & Multiline Layout Engine                 │
│   • HTML5 2D Context Stroke & Fill Overlay                 │
│   • High Dynamic Resolution Rendering                       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────┴──────────────────────────────┐
│             LocalStorage Manager (memeStorage.js)           │
│   • Preset History Storage & Deserialization                │
│   • PNG Canvas Export Trigger                               │
└─────────────────────────────────────────────────────────────┘
```

User opens index.html, then:
1. The page loads `memeEngine.js`, `memeStorage.js`, `script.js`, and the shared Cradle scripts.
2. `loadMemeFromUrl()` starts the hidden source image and `renderPresetsUI()` fills the gallery.
3. Typing in the text controls or moving the font slider fires `updateMeme()`, which calls `renderMemeCanvas()` and repaints the canvas.
4. Clicking "Get Random Meme" fetches a template from the API and reloads the hidden image.
5. Clicking "Save Preset" persists the current options, and "Download Meme" exports the canvas as a PNG.

## Key Features

- Custom top and bottom meme captions with live canvas re-render on every keystroke.
- Typography controls: font size slider (16-72px), text fill color, and outline color pickers.
- Custom background image upload via FileReader.
- Random meme template fetching from the meme-api.com public API with a built-in fallback image.
- Save, load, and delete up to 10 presets persisted in localStorage.
- PNG export of the final composite via `canvas.toDataURL`.

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Semantic layout, form controls, and `<canvas>` element |
| CSS3 (Flexbox, Grid, Custom Properties) | Dark studio theme and responsive layout |
| Vanilla JavaScript (ES6+) | DOM manipulation, canvas rendering, `fetch`, storage |
| HTML5 Canvas 2D API | Composite image and caption rendering |
| localStorage API | Persisting saved meme presets |
| Google Fonts (Poppins) | UI typography |

## File Responsibilities

### `memeEngine.js`

- `wrapText(ctx, text, maxWidth)` — word-wraps uppercase text into lines that fit the canvas width using `measureText`.
- `getDefaultMemeOptions()` — returns the default rendering options (36px Impact font, white fill, black stroke).
- `renderMemeCanvas(canvas, imgElement, options)` — sizes the canvas to the source image, draws it, then strokes and fills the top and bottom caption lines with proper wrapping and line spacing.
- UMD export for Node.js unit testing.

### `memeStorage.js`

- `getSavedMemes()` — reads the `cradle_meme_presets_v1` key and returns a valid array.
- `saveMemePreset(preset)` — prepends a preset with an id and timestamp, trimming to 10 entries.
- `deleteMemePreset(id)` — removes a preset by id.
- Uses the shared `window.CradleStorage` helper with a CommonJS fallback.

### `script.js`

- `getOptionsFromUI()` — collects the current text, font size, and color values from the controls.
- `updateMeme()` — re-renders the canvas whenever a control changes.
- `loadMemeFromUrl(url)` — sets the hidden image source with `crossOrigin="anonymous"` and re-renders on load.
- `fetchRandomMeme()` — fetches a random meme from the API and falls back to a starter image on error.
- `renderPresetsUI()` — builds preset cards; preset text is inserted with `textContent` to prevent XSS.
- Download handler — saves the canvas as `meme-<timestamp>.png` via `toDataURL`.
- Event bindings for text inputs, file upload, action buttons, and preset card controls.

### `style.css`

- CSS custom properties (`--bg-dark`, `--accent`, etc.) for theme tokens.
- Responsive two-column `.studio-workspace` grid that collapses to one column below 850px.
- `.presets-grid` auto-fill card layout and primary/secondary/outline button variants.

## Design Decisions

- **Engine/UI separation** — `memeEngine.js` and `memeStorage.js` are pure, UMD-wrapped modules (testable in Node.js) while `script.js` owns all DOM interaction.
- **Hidden image element for source loading** — the image is loaded into a hidden `<img>` with `crossOrigin="anonymous"` so local uploads render cleanly and the canvas stays exportable.
- **Uppercase word wrapping on canvas** — captions are wrapped with `measureText` and drawn with both stroke (outline) and fill so they remain readable over any image.
- **XSS-safe preset rendering** — user-controlled preset text is inserted with `textContent`, never `innerHTML`.

## Dependencies

| Dependency | Version | How loaded | Purpose |
|---|---|---|---|
| Poppins (font) | — | Google Fonts CDN (`<link>` in index.html) | UI typography |
| Random Meme API | — | Remote `fetch("https://meme-api.com/gimme")` | Random meme template images |
| Cradle `storage.js` | — | Local repo `<script>` tag | Shared localStorage wrapper |
| Cradle `BackToHome.js` | — | Local repo `<script>` tag | Back-to-home navigation |

## Future Improvements

- Add drag-and-drop image positioning and scaling controls.
- Support custom meme fonts and letter spacing.
- Add a meme text preset/template library.
- Allow editing existing presets and exporting preset collections as JSON.

## Known Limitations

- Random meme templates come from the third-party meme-api.com service; cross-origin images may taint the canvas, which prevents PNG download (a fallback alert is shown).
- Captions are limited to the browser's Impact/sans-serif stack; custom font uploads are not supported.
- Presets are stored per-browser in localStorage and do not sync across devices.

## Development Notes

- Open `index.html` through a local server (e.g. `python -m http.server 8000`) for standard browser testing.
- No build step is required — edit files and refresh the browser.
- `memeEngine.js` and `memeStorage.js` use UMD wrappers so their logic can be unit-tested with Node.js.

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:**
  - 'Poppins' font by Google Fonts (OFL License)
  - Random meme template images served by the meme-api.com public API

## References

- [MDN Web Docs — Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [MDN Web Docs — CanvasRenderingContext2D](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)
- [meme-api.com](https://meme-api.com)
