# Cradle ⟵⁠(⁠o⁠_⁠O⁠)

[![Tests](https://github.com/Facelessism/cradle/actions/workflows/test.yml/badge.svg)](https://github.com/Facelessism/cradle/actions/workflows/test.yml)

A personal collection of small ideas, experiments, and geeky projects I'm exploring and building.

## What this repository contains

Cradle is a repository for my small ideas, experiments and lightweight prototypes. It contains runnable demos, maybe eventually some short technical notes and utility scripts intended for rapid iteration and learning.

## Each project folder includes

- an `ARCHITECTURE.md` describing the goal, architecture, and how to run or test it,
- minimal dependency manifest (`requirements.txt`, `package.json` etc.)
- example usage or quick demo scripts if possible.

## Project Structure

```bash
Cradle/
│
├── data/
│   └── projects.json
│
├── projects/
│   ├── aiml/                  # AI & Machine Learning prototypes
│   ├── dev-tools/             # Developer utilities & code formatters
│   ├── editor/                # Creative design & document generation tools
│   ├── file-tools/            # File processing & metadata analyzers
│   ├── games/                 # Interactive browser & arcade games
│   ├── math/                  # Mathematical visualizations & algorithms
│   ├── misc/                  # Audio, camera & hardware utilities
│   └── productivity/          # Personal trackers & planning tools
│
├── scripts/                   # Generators & project validation scripts
├── src/                       # Shared UI components & design tokens
├── tests/                     # Automated test suites & validation checks
│
├── ARCHITECTURE.md            # Overall repository architecture overview
├── ARCHITECTURE_TEMPLATE.md   # Standardized template for mini projects
├── CONTRIBUTING.md            # Guidelines for repository contributors
├── README.md                  # Project overview documentation
├── index.html                 # Main landing page entry point
├── script.js                  # Global landing page logic & search engine
└── style.css                  # Core CSS design system
```

## Getting started

### Prerequisites

- **Node.js**: `v20.0.0` or higher (CI and recommended runtime is `v24.x` / see [.nvmrc](.nvmrc))
- **npm**: `v9.0.0` or higher
- **Python**: `3.x` (optional, for local HTTP static file serving)

### Setup

1. Clone the repo after forking

```bash
git clone https://github.com/<yourusername>/cradle.git
```

1. Open the local repository

```bash
cd cradle
```

1. Open the Landing page

- Simply just open the `index.html` on your browser... OR
- Use a local server using Python(recomended by me)

```bash
python -m http.server 8000
```

Then visit

```bash
http://localhost:8000
```

### Run Individual Projects

Projects that do not use browser-restricted features can be opened directly from their `index.html`.

Projects that use JavaScript modules, Web Workers, or other browser features restricted under `file://` should be run through a local HTTP server.

```bash
python -m http.server 8000
```

Then visit:

```text
http://localhost:8000/projects/<category>/<project>/
```

For example:

```text
http://localhost:8000/projects/aiml/image-classifier/
```

## ⌨️ Keyboard Shortcuts

The Cradle landing page supports intuitive keyboard navigation:

- `<kbd>/</kbd>` or `<kbd>Ctrl</kbd>+<kbd>K</kbd>` / `<kbd>Cmd</kbd>+<kbd>K</kbd>` — Focus the project search bar
- `<kbd>Esc</kbd>` — Clear active search query and reset category filters / close modal dialogs
- `<kbd>T</kbd>` — Toggle light / dark color theme
- `<kbd>?</kbd>` — Open / close the keyboard shortcuts help dialog

## 🌐 Browser Compatibility & Progressive Fallbacks

Cradle is built using standard static web technologies (HTML5, CSS Custom Properties, ES6+ JavaScript modules) designed to run natively in modern browsers without complex build tools or transpilation steps.

### Supported Browsers

| Browser Family | Recommended Expectations | Key Technology Requirements |
| :--- | :--- | :--- |
| **Chrome / Chromium** (Edge, Brave, Opera) | Modern Evergreen versions | ES6 Modules, Web Workers, IndexedDB, Web Audio API, Canvas 2D |
| **Firefox** | Modern Evergreen versions | ES6 Modules, Web Workers, IndexedDB, Web Audio API, Canvas 2D |
| **Safari** (macOS / iOS) | Modern Evergreen versions (Safari 14+) | ES6 Modules, Web Workers, IndexedDB, Web Audio API, Canvas 2D |

> [!NOTE]
> **Local Server Recommendation**: Browsers enforce strict security policies under `file://` URIs for ES6 modules (`<script type="module">`), Web Workers, and `fetch()`. Always run Cradle through a local HTTP server (such as `python -m http.server 8000` or `npm run dev`) for full feature compatibility.

### API Compatibility & Fallback Matrix

The table below documents the browser APIs utilized across Cradle, where they are used, whether they are required or optional, and their verified fallback behavior:

| Browser API | Application Usage | Required / Optional | Fallback / Progressive Degradation Behavior |
| :--- | :--- | :--- | :--- |
| **Web Workers** (`Worker`) | Search filtering (`src/utils/filterWorker.js`), Chess AI search (`projects/games/chess/ai-worker.js`) | Optional | Search filtering automatically falls back to synchronous main-thread filtering in `script.js` when workers fail or are unsupported. Chess AI falls back to 2-player local mode. |
| **IndexedDB API** (`window.indexedDB`) | Landing page project registry caching (`CradleDB` in `script.js`) | Optional | If IndexedDB is disabled, unsupported, or blocked (e.g. private browsing), `script.js` catches the error and directly fetches `data/projects.json` via HTTP `fetch()` on every visit. |
| **localStorage API** (`window.localStorage`) | Theme persistence (`scripts/theme.js`), `CradleStorage` (`src/components/ui/storage.js`), project high scores | Optional | `CradleStorage` wraps all `localStorage` calls in `try/catch`. If storage access throws (e.g. third-party cookie restrictions or quota limits), it falls back to an in-memory storage map or safe default value. Theme falls back to OS preference (`prefers-color-scheme`) or default dark theme. |
| **Web Audio API** (`AudioContext`) | Musical instruments (`piano`, `guitar`, `violin`, `guzheng`, `percussion`), audio visualizers, morse code studio | Optional / Feature-specific | Uses vendor-prefix fallback (`AudioContext` \|\| `webkitAudioContext`). Handles browser autoplay policies by initializing or resuming audio context on explicit user interaction. If unsupported, audio synthesis is disabled while visual controls remain interactive. |
| **Canvas 2D API** (`<canvas>`) | Math visualizers, arcade games (`2048`, `cannon-shooting`), generators (`meme-generator`, `avatar-creator`), camera utility | Required for visualizer/game rendering | HTML5 standard. If 2D context creation (`getContext('2d')`) fails, rendering calls are safely bypassed or display an on-screen notice. |
| **Clipboard API** (`navigator.clipboard`) | Chess PGN/FEN copy buttons, text/resume exporters | Optional | Uses `navigator.clipboard.writeText()` when available in secure contexts (HTTPS/localhost). If blocked or unsupported, notifies the user with a fallback status message or alternative text display. |
| **MediaDevices / Camera API** (`navigator.mediaDevices.getUserMedia`) | Real-time video input in ASCII Camera (`projects/misc/ascii-camera`) | Required for live camera mode | Checks `navigator.mediaDevices && navigator.mediaDevices.getUserMedia`. If camera access is denied, unsupported, or served over insecure HTTP, displays an on-screen error banner explaining requirements. |
| **matchMedia API** (`window.matchMedia`) | Light/dark theme detection (`prefers-color-scheme: light`) | Optional | Defaults to dark theme if `matchMedia` is unsupported. |

### Progressive Enhancement Principles

- **Feature Detection**: Features check for API availability before invoking browser-specific calls (e.g., `'Worker' in window`, `'AudioContext' in window`, `'mediaDevices' in navigator`).
- **Graceful Degradation**: Non-essential features (caching, off-thread search, sound effects) step down to simpler alternatives (direct fetch, main-thread search, silent mode) without breaking core application usability.
- **Explicit User Notices**: Interactive tools requiring hardware or permission-restricted APIs (such as camera input) provide visible status messages when APIs are unavailable.

### Developer Guidance

When adding new features or browser APIs to Cradle:
1. Always use feature detection (e.g. `typeof API !== "undefined"` or `'API' in window`) before executing modern browser capabilities.
2. Provide a graceful fallback or disable optional UI controls cleanly if an API is missing or permission is denied.
3. Avoid introducing hard runtime dependencies on experimental or non-standard browser APIs.
4. Test project pages under both local HTTP (`http://localhost:8000`) and standard browser environments to ensure fallback paths function as expected.

## 🗂️ Architecture Documentation

Every project in Cradle includes an `ARCHITECTURE.md` file that explains its folder structure, components, data flow, and design decisions. If you are adding a new project, use the standardized template at the repository root:

```text
ARCHITECTURE_TEMPLATE.md
```

See [CONTRIBUTING.md](CONTRIBUTING.md#architecture-documentation) for full instructions on how to fill it in. For details on the repository's testing strategies and CI gates, refer to [TESTING.md](TESTING.md).

## 🔧 Troubleshooting

Running into issues? Check the [Troubleshooting Guide](TROUBLESHOOT.md) for solutions to common setup, development, and Git problems before opening a new issue.

## 🤝 Contributing

Contributions are welcome! Whether you're fixing bugs, improving documentation, or adding new ideas and experiments, your help is greatly appreciated.

Before getting started, please read our [Contributing Guide](CONTRIBUTING.md) for information about the development workflow, coding standards, and pull request process.

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

## Very Important Note

Don't forget to leave a star behind for the repo if you're visiting this
