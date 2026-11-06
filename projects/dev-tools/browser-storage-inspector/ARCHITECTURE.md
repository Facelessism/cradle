# Browser Storage Inspector Architecture

## Overview

Browser Storage Inspector & Backup Manager is a client-side dev tool that inspects, searches, filters, edits, and backs up data across LocalStorage, SessionStorage, Cookies, and IndexedDB stores, featuring unified multi-store JSON/CSV export/import and a storage quota usage dashboard calculated via `navigator.storage.estimate()`.

---

## Purpose & Goals

- Provide a single dashboard for inspecting LocalStorage, SessionStorage, Cookies, and IndexedDB
- Detect each stored value's data type and byte footprint at a glance
- Monitor origin storage quota utilization in real-time with an accessible visual progress meter and health indicator
- Support editing, deleting, and clearing entries across all storage stores
- Offer one-click unified JSON and CSV backup snapshots across LocalStorage, SessionStorage, and IndexedDB databases
- Provide safe, validated restoration of backup archives into browser storage
- Stay fully client-side and dependency-free using native browser storage APIs

---

## Folder Structure

```text
projects/dev-tools/browser-storage-inspector/
├── ARCHITECTURE.md    # System architecture and maintenance documentation
├── index.html         # HTML layout, summary cards, search toolbar, storage forms
├── storageEngine.js   # Storage data type detection, byte footprint calculation, store reader
├── storageExporter.js # JSON and CSV export serializers and snapshot validation
├── script.js          # Controller script, DOM event handlers, tab navigation
└── style.css          # Responsive dashboard styling, badge tags, form controls
```

---

## System / Project Architecture Overview

```mermaid
flowchart TD
  A[Browser Storage Stores] --> B[storageEngine.js - Read & Type Detect]
  B --> C[script.js - In-Memory State & Search Filter]
  C --> D[index.html - Table View Render & Badges]
  C --> E[storageExporter.js - JSON/CSV Export & Restore]
```

---

## Component Breakdown

| File                 | Role                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `storageEngine.js`   | Data type detection, byte footprint calculation, IndexedDB inspection, and storage quota estimation.               |
| `storageExporter.js` | Unified multi-store JSON/CSV snapshot serialization, RFC-4180 parsing, import validation, and atomic restoration. |
| `script.js`          | Main app controller, event routing, quota dashboard updater, IndexedDB manager, and import/export coordination.   |
| `index.html`         | Dashboard layout, storage quota meter, search & filter toolbar, storage tab sections, input forms.                |
| `style.css`          | Glassmorphic cards, storage quota progress bar, data type badge colors, responsive table wrappers.                |

---

## Data Flow / Execution Flow

```text
User opens index.html
        ↓
Browser loads tokens.css → storageEngine.js → storageExporter.js → script.js
        ↓
initializeInspector() attaches tab, form, and toolbar listeners
        ↓
refreshAll() reads stores via storageEngine (readWebStorage / readCookies)
        ↓
renderAll() filters by search query and data-type filter
        ↓
renderRows() builds table rows with type badges and byte sizes
        ↓
User submits a form / clicks Delete / Clear / Export
        ↓
script.js writes to the store or calls the exporter
        ↓
refreshAll() re-reads and re-renders the dashboard
```

---

## Key Features

- Reads and displays LocalStorage, SessionStorage, Cookie, and IndexedDB entries
- Storage Quota Dashboard with a live meter, percentage, and health classification via `navigator.storage.estimate()`
- Data type detection: JSON, JWT, Base64, Boolean, Number, String
- Byte-size estimation per key/value pair with B/KB/MB/GB formatting
- Live search across keys, values, and database stores plus a data-type filter dropdown
- One-click Unified JSON Export combining LocalStorage, SessionStorage, Cookies, and IndexedDB
- One-click Unified CSV Export serializing multi-store data into a tabular format
- Drag-and-drop / File upload import restoring snapshots to LocalStorage, SessionStorage, and IndexedDB
- Add, edit, and delete entries via per-store forms and action buttons
- Clear-all buttons per store and a "Seed Demo Data" helper
- JSON and CSV export with a versioned snapshot payload

---

## Technologies Used

| Technology                              | Purpose                                         |
| --------------------------------------- | ----------------------------------------------- |
| HTML5                                   | Page structure and semantic markup              |
| CSS3 (Grid, Flexbox, Custom Properties) | Dashboard layout, badges, responsive design     |
| Vanilla JavaScript (ES6+)               | Store reading, rendering, event handling        |
| Web Storage API                         | Reading/writing localStorage and sessionStorage |
| `document.cookie` API                   | Reading, writing, and clearing cookies          |
| IndexedDB API                           | Listing databases and object stores             |
| Blob + `URL.createObjectURL`            | Client-side JSON/CSV downloads                  |
| Space Grotesk (Google Fonts)            | UI typography                                   |

---

## File Responsibilities

### `storageEngine.js`

- `detectDataType(value)` — classifies a raw string as json, jwt, base64, boolean, number, or string
- `calculateByteSize(key, value)` — estimates UTF-16 byte footprint of a key/value pair
- `formatBytes(bytes)` — renders the size as B, KB, MB, or GB
- `filterItems(items, query, typeFilter)` — search and data-type filtering
- `readWebStorage(storeType)` — reads all entries from localStorage or sessionStorage
- `readCookies()` — parses `document.cookie` into structured items
- `getStorageQuotaEstimate()` — estimates origin quota and usage using `navigator.storage.estimate()`
- `readAllIndexedDB()` — discovers and reads all IndexedDB databases, object stores, and records

### `storageExporter.js`

- `exportUnifiedJSON(storesData)` — creates multi-store JSON snapshot with metadata and item counts
- `exportUnifiedCSV(storesData)` — serializes all storage stores into unified CSV table
- `exportToJSON(items, storeType)` — builds a single-store JSON snapshot with metadata
- `exportToCSV(items)` — serializes single-store rows to CSV with double-quote escaping
- `parseCSV(text)` — RFC-4180 compliant CSV parser
- `validateUnifiedImport(payloadString)` — validates both unified and single-store JSON and CSV snapshots
- `restoreUnifiedStorage(dataStores, options)` — restores data into LocalStorage, SessionStorage, and IndexedDB

### `script.js`

- `initializeInspector()` — binds tabs, forms, clear buttons, import triggers, and toolbar actions
- `updateQuotaDashboard()` — renders quota meter, percentage, remaining space, and health badges
- `refreshAll()` — reads all stores and re-renders
- `renderAll()` / `renderRows()` — applies filters and builds table rows
- `handleImportFile()` — reads backup file and executes restoration
- `exportUnifiedJSON()` / `exportUnifiedCSV()` — triggers unified snapshot downloads
- `handleFormSubmit()` — saves new entries to the target store
- `deleteItem()` / `clearStorage()` — removes single entries or whole stores
- `seedDemoData()` — populates demo records across all stores

### `index.html`

- Summary card grid with live per-store counts
- Search box and data-type filter toolbar
- Tab navigation for the four storage panels
- Per-store editor forms and clear/action buttons
- Table wrappers for each store's rows

### `style.css`

- Glassmorphic panels, summary cards, and tab styling
- Per-type badge colors (`badge-json`, `badge-jwt`, `badge-base64`, etc.)
- Responsive breakpoints at 900px and 560px

---

## Design Decisions

- **Engine/exporter split** — pure logic lives in `storageEngine.js` and `storageExporter.js`, wrapped in UMD-style IIFEs so the same functions work as browser globals (`window.StorageEngine` / `window.StorageExporter`) and as `require()`-able modules for unit tests.
- **Heuristic type detection** — values are classified by shape (a JSON parse attempt, JWT dot-segments, Base64 charset/length) rather than by any storage-side schema, since web storage carries no type information.
- **In-memory state in `script.js`** — `storageState` holds the last snapshot read from the stores so search and filtering re-render without touching storage on every keystroke.
- **No framework** — vanilla JS and native browser APIs keep the tool dependency-free and easy for a first-time contributor to read.

---

## Dependencies

None beyond native browser APIs. The only external resource is the "Space Grotesk" webfont loaded from Google Fonts — no runtime libraries are required.

---

## Future Improvements

- ~~Add JSON snapshot import/restore to the UI~~ **Fixed** — unified JSON and CSV import/restore across LocalStorage, SessionStorage, and IndexedDB
- Add copy-to-clipboard for individual values
- Show a per-store total byte count in the summary grid

---

## Known Limitations

- HttpOnly cookies cannot be read or displayed due to browser security rules
- IndexedDB listing works only in Chromium-based browsers and some recent browsers
- Byte sizes estimate UTF-16 code units rather than exact UTF-8 storage bytes
- Editing is limited to string values; binary Blobs in IndexedDB are not editable

---

## Development Notes

- Open `index.html` through a local server for the most consistent storage behavior
- `storageEngine.js` and `storageExporter.js` can be unit-tested with Node.js via their UMD exports
- No build step is required — edit the files and refresh the browser

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:**
  - "Space Grotesk" font by [Google Fonts](https://fonts.google.com/specimen/Space+Grotesk) (OFL License)

---

## References

- [MDN Web Docs — Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- [MDN Web Docs — IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [MDN Web Docs — Document: cookie property](https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie)
