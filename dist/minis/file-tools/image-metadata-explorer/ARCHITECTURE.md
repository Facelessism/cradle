# Image Metadata Explorer Architecture

## Overview

Image Metadata Explorer is a browser-based tool that reads basic metadata stored inside image files.

The application does not upload images to a server. The selected image is read directly by JavaScript in the browser using the File API and `ArrayBuffer`.

The application mainly performs these steps:

1. User selects or drops an image.
2. The image is loaded for preview and its basic file information is collected.
3. The metadata engine reads the raw binary image data.
4. The engine searches for the EXIF section inside JPEG files.
5. The EXIF section is interpreted using the TIFF structure.
6. Individual EXIF tags are identified and converted into readable values.
7. GPS coordinates and other special values are converted into normal formats.
8. Only the metadata needed by the application is kept.
9. The processed metadata is sent to the UI.
10. The user can export the final metadata as JSON.

---

## Purpose & Goals

- Read EXIF metadata from image files entirely in the browser using the File API
- Keep images private by processing them locally — nothing is uploaded to a server
- Parse the TIFF structure stored inside the JPEG EXIF segment
- Convert raw tag values into readable labels (exposure, f-number, GPS, orientation)
- Let users export the detected metadata as a JSON file

---

## Folder Structure

```text
image-metadata-explorer/
├── ARCHITECTURE.md    # This file — project documentation
├── index.html         # Entry point and UI shell (upload, preview, results)
├── metadataEngine.js  # Pure EXIF/TIFF binary parser with UMD exports
├── script.js          # DOM controller — file input, drag & drop, rendering
└── style.css          # All visual styling and responsive layout
```

---

## System / Project Architecture Overview

The project follows a simple separation of concerns:

- **metadataEngine.js** owns all binary parsing — it reads the raw file bytes, finds the EXIF segment, walks the TIFF IFD chain, and normalises the values. It has no DOM dependency.
- **script.js** handles everything user-facing: file selection, drag & drop, image preview, rendering the results, and the JSON export.
- **style.css** owns all presentation, and **index.html** provides the structure and loads the scripts in dependency order.

There is no build step — the browser loads the files directly.

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Page shell: hero, upload card, image preview, metadata groups, export button |
| `metadataEngine.js` | EXIF/TIFF parsing, value formatting, GPS conversion, metadata normalisation |
| `script.js` | File input, drag & drop, preview loading, results rendering, JSON export |
| `style.css` | Dark theme, card layout, metadata grid, responsive design |

---

## Data Flow / Execution Flow

```text

User selects or drops an image
↓
<input type="file"> event fires in script.js
↓
file.arrayBuffer() reads the raw bytes (metadataEngine.js)
↓
findExifSegment() locates the APP1/EXIF marker inside the JPEG
↓
parseTIFF() interprets the TIFF header and IFD entries
↓
normalizeMetadata() formats values (exposure, f-number, GPS, orientation)
↓
renderMetadata() updates the DOM and shows the preview
↓
User clicks Export JSON → a .json file downloads

```

---

## Key Features

- Drag & drop or file-picker upload of JPEG, PNG, and WebP images
- Camera info: make, model, lens model, and editing software
- Exposure details: exposure time, f-number, ISO, and focal length
- GPS coordinates converted from degrees/minutes/seconds to decimal degrees
- Orientation and date-taken fields mapped to readable values
- JSON export of all detected metadata, named after the original image

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Page structure and semantic markup |
| CSS3 (Grid, Flexbox, Custom Properties) | Layout, dark theme, responsive design |
| Vanilla JavaScript (ES6+, File API) | File handling and DOM updates |
| ArrayBuffer / DataView | Reading raw binary image bytes |
| Blob / URL API | Image preview and JSON download |

---

## File Responsibilities

### `metadataEngine.js`

- `parse(file)` — main entry: reads the buffer, finds the EXIF segment, returns normalised metadata
- `findExifSegment(view)` — scans JPEG markers for the APP1 "Exif\0\0" segment
- `parseTIFF(view, tiffStart)` — reads byte order, magic number, and follows the IFD chain (including EXIF and GPS sub-IFDs)
- `readIFD(view, offset, littleEndian, tagMap)` — walks IFD entries and decodes known tags
- `readValue(view, type, count, ...)` — decodes TIFF value types (ASCII, short, long, rational, etc.)
- `gpsToDecimal(coordinates, reference)` — converts DMS coordinates to signed decimal degrees
- `normalizeMetadata(raw)` — formats exposure time, f-number, focal length, GPS, orientation, and date
- `formatFileSize(bytes)` — human-readable file size string

### `script.js`

- `processImage(file)` — orchestrates preview loading and metadata parsing
- `loadImagePreview(file)` — creates an object URL and reads the image's natural dimensions
- `renderMetadata(metadata)` — writes each value into its metadata group and updates the field count
- `showError()` / `hideError()` — validation and error display
- Drag & drop handlers on the upload card, plus the "Choose Another" reset flow
- Export handler that builds a JSON blob and triggers a download

### `style.css`

- CSS custom properties under `:root` — the dark palette and accent colours
- `.upload-card`, `.preview-card`, `.metadata-card` — card layout system
- `main:has(.results-section:not(.hidden))` — hides hero/about once results are shown
- `.metadata-group` / `.metadata-grid` / `.metadata-item` — results layout
- Responsive breakpoints at 950px, 700px, 520px, and 380px

---

## Design Decisions

- **Engine Modules vs. Inline Logic Rationale**: EXIF parsing, binary ArrayBuffer TIFF parsing, GPS conversion, and data normalization are isolated in `metadataEngine.js` with UMD exports. This separates core binary parsing from DOM manipulation, allowing `metadataEngine.js` to be unit-tested headlessly via `node --test` while `script.js` manages drag-and-drop file uploads, image previews, and UI rendering.

---

## Dependencies

None. This project uses only native browser APIs — no external libraries or CDNs are required.

---

## Future Improvements

- Add map view for GPS coordinates
- Support XMP/IPTC metadata in addition to EXIF
- Allow copying individual metadata fields to the clipboard
- Add a "strip metadata" tool to remove EXIF data before sharing

---

## Known Limitations

- EXIF parsing targets JPEG files; PNG and WebP images rarely carry EXIF and mostly fall through to the empty state
- Only a curated set of tags is displayed, not the full EXIF standard
- The orientation value is read and labelled, but the preview image is not rotated to match
- MakerNote, thumbnail, and multi-IFD data are not parsed

---

## Development Notes

- Open `index.html` through a local server (e.g. `python3 -m http.server 8000`); the File API also works on `file://` for most browsers
- Run engine tests headlessly in Node: `node --test tests/image-metadata-explorer.test.js`
- `metadataEngine.js` is a standalone UMD module: `const engine = require('./metadataEngine.js')`
- No build step is required. Edit any file and refresh the browser.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None — the project uses only system fonts and no external assets.

---

## References

- [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif)
- [TIFF — Wikipedia](https://en.wikipedia.org/wiki/TIFF)
- [MDN Web Docs — File API](https://developer.mozilla.org/en-US/docs/Web/API/File_API)
