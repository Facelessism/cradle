# Cradle ⟵⁠(⁠o⁠_⁠O⁠) [![Tests](https://github.com/Facelessism/cradle/actions/workflows/test.yml/badge.svg)](https://github.com/Facelessism/cradle/actions/workflows/test.yml)

**Live demo:** [https://cradle-zeta.vercel.app](https://cradle-zeta.vercel.app)

A personal collection of small ideas, experiments, and geeky projects I'm exploring and building.

## Badges of Participation

[![Nexus Spring of Code](https://img.shields.io/badge/Nexus%20Spring%20of%20Code-2026-blue)](https://nexusspringofcode.com)
[![ECSoC26](https://img.shields.io/badge/ECSoC26-2026-green)](https://ecsoc26.org)

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
├── docs/
│   ├── ASSET_PIPELINE.md      # Asset naming, fingerprinting and caching
│   └── MINI_CONTRACT.md       # Contract every mini-project must follow
├── README.md                  # Project overview documentation
├── SECURE_DEPLOYMENT_CHECKLIST.md # Baseline security checklist for production
├── SECURITY.md                # Vulnerability disclosure, incident response, and security policy
├── STORAGE_POLICY.md          # Storage API and conflict-resolution strategy
├── THIRD_PARTY_POLICY.md      # Rules for loading external models and scripts
├── index.html                 # Main landing page entry point
├── script.js                  # Global landing page logic & search engine
└── style.css                  # Core CSS design system
```

## Available Projects

<!-- projects-table-start -->

| Name                          | Category     | Link                                                                                                       |
| ----------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------- |
| 2048 Game                     | games        | [projects/games/2048-game/](projects/games/2048-game/)                                                     |
| Advanced QR Code Generator    | productivity | [projects/productivity/advanced-qr-code-generator/](projects/productivity/advanced-qr-code-generator/)     |
| AI Circuit Builder            | aiml         | [projects/aiml/ai-circuit-builder/](projects/aiml/ai-circuit-builder/)                                     |
| API Response Inspector        | dev-tools    | [projects/dev-tools/api-response-inspector/](projects/dev-tools/api-response-inspector/)                   |
| ASCII Camera                  | misc         | [projects/misc/ascii-camera/](projects/misc/ascii-camera/)                                                 |
| Attendance Tracker            | productivity | [projects/productivity/attendance-tracker/](projects/productivity/attendance-tracker/)                     |
| Audio Spectrogram Analyzer    | misc         | [projects/misc/audio-spectrogram-analyzer/](projects/misc/audio-spectrogram-analyzer/)                     |
| Audio Waveform Generator      | misc         | [projects/misc/audio-waveform-generator/](projects/misc/audio-waveform-generator/)                         |
| Avatar Creator                | misc         | [projects/misc/avatar-creator/](projects/misc/avatar-creator/)                                             |
| Brain Dump Collector          | productivity | [projects/productivity/brain-dump-collector/](projects/productivity/brain-dump-collector/)                 |
| Browser Storage Inspector     | dev-tools    | [projects/dev-tools/browser-storage-inspector/](projects/dev-tools/browser-storage-inspector/)             |
| Cannon Shooting               | games        | [projects/games/cannon-shooting/](projects/games/cannon-shooting/)                                         |
| Chess                         | games        | [projects/games/chess/](projects/games/chess/)                                                             |
| Collaborative Whiteboard      | misc         | [projects/misc/collaborative-whiteboard/](projects/misc/collaborative-whiteboard/)                         |
| Color Contrast Checker        | dev-tools    | [projects/dev-tools/color-contrast-checker/](projects/dev-tools/color-contrast-checker/)                   |
| Color Palette Generator       | editor       | [projects/editor/color-palette-generator/](projects/editor/color-palette-generator/)                       |
| CPU Emulator                  | dev-tools    | [projects/dev-tools/cpu-emulator/](projects/dev-tools/cpu-emulator/)                                       |
| CSS Clamp Calculator          | dev-tools    | [projects/dev-tools/css-clamp-calculator/](projects/dev-tools/css-clamp-calculator/)                       |
| CSS Gradient Generator        | editor       | [projects/editor/css-gradient-generator/](projects/editor/css-gradient-generator/)                         |
| CSS Grid Generator            | dev-tools    | [projects/dev-tools/css-grid-generator/](projects/dev-tools/css-grid-generator/)                           |
| CSS Shape Designer            | editor       | [projects/editor/css-shape-designer/](projects/editor/css-shape-designer/)                                 |
| CSV Data Cleaner              | file-tools   | [projects/file-tools/csv-data-cleaner/](projects/file-tools/csv-data-cleaner/)                             |
| Cyberpunk Pixel Art Generator | misc         | [projects/misc/cyberpunk-pixel-art-generator/](projects/misc/cyberpunk-pixel-art-generator/)               |
| Dot Game                      | games        | [projects/games/dot-game/](projects/games/dot-game/)                                                       |
| Encoding Toolkit              | dev-tools    | [projects/dev-tools/encoding-toolkit/](projects/dev-tools/encoding-toolkit/)                               |
| Feature Flag Playground       | dev-tools    | [projects/dev-tools/feature-flag-playground/](projects/dev-tools/feature-flag-playground/)                 |
| File Difference Visualizer    | file-tools   | [projects/file-tools/file-difference-visualizer/](projects/file-tools/file-difference-visualizer/)         |
| Flashcard Study               | productivity | [projects/productivity/flashcard-study/](projects/productivity/flashcard-study/)                           |
| Fourier Series Visualizer     | math         | [projects/math/fourier-series-visualizer/](projects/math/fourier-series-visualizer/)                       |
| Graph Theory Explorer         | math         | [projects/math/graph-theory-explorer/](projects/math/graph-theory-explorer/)                               |
| Guitar                        | instruments  | [projects/instruments/guitar/](projects/instruments/guitar/)                                               |
| Guzheng                       | instruments  | [projects/instruments/guzheng/](projects/instruments/guzheng/)                                             |
| Image Classifier              | aiml         | [projects/aiml/image-classifier/](projects/aiml/image-classifier/)                                         |
| Image Metadata Explorer       | file-tools   | [projects/file-tools/image-metadata-explorer/](projects/file-tools/image-metadata-explorer/)               |
| Invoice Generator             | productivity | [projects/productivity/invoice-generator/](projects/productivity/invoice-generator/)                       |
| JSON Converter                | dev-tools    | [projects/dev-tools/json-converter/](projects/dev-tools/json-converter/)                                   |
| JSON Tree Viewer              | dev-tools    | [projects/dev-tools/json-tree-viewer/](projects/dev-tools/json-tree-viewer/)                               |
| Knowledge Graph               | productivity | [projects/productivity/knowledge-graph/](projects/productivity/knowledge-graph/)                           |
| Ludo Game                     | games        | [projects/games/ludo-game/](projects/games/ludo-game/)                                                     |
| Markdown Editor               | editor       | [projects/editor/markdown-editor/](projects/editor/markdown-editor/)                                       |
| Markdown Resume Generator     | editor       | [projects/editor/markdown-resume-generator/](projects/editor/markdown-resume-generator/)                   |
| Matrix Playground             | math         | [projects/math/matrix-playground/](projects/math/matrix-playground/)                                       |
| Meme Generator                | misc         | [projects/misc/meme-generator/](projects/misc/meme-generator/)                                             |
| Memory Flip Game              | games        | [projects/games/memory-flip-game/](projects/games/memory-flip-game/)                                       |
| Monopoly                      | games        | [projects/games/monopoly/](projects/games/monopoly/)                                                       |
| Morse Code Studio             | misc         | [projects/misc/morse-code-studio/](projects/misc/morse-code-studio/)                                       |
| Neural Network Playground     | aiml         | [projects/aiml/neural-network-playground/](projects/aiml/neural-network-playground/)                       |
| Pathfinding Visualizer        | math         | [projects/math/pathfinding-visualizer/](projects/math/pathfinding-visualizer/)                             |
| Percussion                    | instruments  | [projects/instruments/percussion/](projects/instruments/percussion/)                                       |
| Periodic Table                | misc         | [projects/misc/periodic-table/](projects/misc/periodic-table/)                                             |
| Piano                         | instruments  | [projects/instruments/piano/](projects/instruments/piano/)                                                 |
| Pomodoro Infinity Timer       | productivity | [projects/productivity/pomodoro-infinity-timer/](projects/productivity/pomodoro-infinity-timer/)           |
| Pomodoro Timer                | productivity | [projects/productivity/pomodoro-timer/](projects/productivity/pomodoro-timer/)                             |
| Procedural Dungeon Generator  | games        | [projects/games/procedural-dungeon-generator/](projects/games/procedural-dungeon-generator/)               |
| Reading Progress Tracker      | productivity | [projects/productivity/reading-progress-tracker/](projects/productivity/reading-progress-tracker/)         |
| Regex Visualizer              | dev-tools    | [projects/dev-tools/regex-visualizer/](projects/dev-tools/regex-visualizer/)                               |
| Snake Game                    | games        | [projects/games/snake-game/](projects/games/snake-game/)                                                   |
| Sound Wave Visualizer         | misc         | [projects/misc/sound-wave-visualizer/](projects/misc/sound-wave-visualizer/)                               |
| Stone Paper Scissors Game     | games        | [projects/games/stone-paper-scissors-game/](projects/games/stone-paper-scissors-game/)                     |
| Sudoku Solver                 | games        | [projects/games/sudoku-solver/](projects/games/sudoku-solver/)                                             |
| Terminal Portfolio Generator  | productivity | [projects/productivity/terminal-portfolio-generator/](projects/productivity/terminal-portfolio-generator/) |
| Text Diff Checker             | dev-tools    | [projects/dev-tools/text-diff-checker/](projects/dev-tools/text-diff-checker/)                             |
| Time Blocking Planner         | productivity | [projects/productivity/time-blocking-planner/](projects/productivity/time-blocking-planner/)               |
| Typing Speed Racer            | games        | [projects/games/typing-speed-racer/](projects/games/typing-speed-racer/)                                   |
| Typing Speed Test             | misc         | [projects/misc/typing-speed-test/](projects/misc/typing-speed-test/)                                       |
| Unit Circle Explorer          | math         | [projects/math/unit-circle-explorer/](projects/math/unit-circle-explorer/)                                 |
| Unit Converter                | productivity | [projects/productivity/unit-converter/](projects/productivity/unit-converter/)                             |
| URL Parser                    | dev-tools    | [projects/dev-tools/url-parser/](projects/dev-tools/url-parser/)                                           |
| Violin                        | instruments  | [projects/instruments/violin/](projects/instruments/violin/)                                               |
| Weather                       | productivity | [projects/productivity/weather/](projects/productivity/weather/)                                           |
| Wordle Clone                  | games        | [projects/games/wordle-clone/](projects/games/wordle-clone/)                                               |

<!-- projects-table-end -->

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

2. Open the local repository

```bash
cd cradle
```

3. Install dependencies

```bash
npm install
```

4. Open the Landing page

- Simply just open the `index.html` on your browser... OR
- Use a local server using Python (recommended by me)

```bash
python -m http.server 8000
```

- Or use the npm development server

```bash
npm run dev
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

### Run the tests

Run the automated test suite:

```bash
npm test
```

Run the complete healthcheck suite (formatting check, project validations, security audit, and tests):

```bash
npm run healthcheck
```

Check code formatting:

```bash
npm run check-format
```

For more details on testing strategies, CI validation gates, and adding new tests, see [TESTING.md](TESTING.md).

## ⌨️ Keyboard Shortcuts

The Cradle landing page supports intuitive keyboard navigation:

- <kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd> / <kbd>Cmd</kbd>+<kbd>K</kbd> — Focus the project search bar
- <kbd>Esc</kbd> — Clear active search query and reset category filters / close modal dialogs
- <kbd>T</kbd> — Toggle light / dark color theme
- <kbd>?</kbd> — Open / close the keyboard shortcuts help dialog

## 🌐 Browser Compatibility & Progressive Fallbacks

Cradle is built using standard static web technologies (HTML5, CSS Custom Properties, ES6+ JavaScript modules) designed to run natively in modern browsers without complex build tools or transpilation steps.

### Supported Browsers

| Browser Family                             | Recommended Expectations               | Key Technology Requirements                                   |
| :----------------------------------------- | :------------------------------------- | :------------------------------------------------------------ |
| **Chrome / Chromium** (Edge, Brave, Opera) | Modern Evergreen versions              | ES6 Modules, Web Workers, IndexedDB, Web Audio API, Canvas 2D |
| **Firefox**                                | Modern Evergreen versions              | ES6 Modules, Web Workers, IndexedDB, Web Audio API, Canvas 2D |
| **Safari** (macOS / iOS)                   | Modern Evergreen versions (Safari 14+) | ES6 Modules, Web Workers, IndexedDB, Web Audio API, Canvas 2D |

> [!NOTE]
> **Local Server Recommendation**: Browsers enforce strict security policies under `file://` URIs for ES6 modules (`<script type="module">`), Web Workers, and `fetch()`. Always run Cradle through a local HTTP server (such as `python -m http.server 8000` or `npm run dev`) for full feature compatibility.

### API Compatibility & Fallback Matrix

The table below documents the browser APIs utilized across Cradle, where they are used, whether they are required or optional, and their verified fallback behavior:

| Browser API                                                           | Application Usage                                                                                                           | Required / Optional                    | Fallback / Progressive Degradation Behavior                                                                                                                                                                                                                                                        |
| :-------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- | :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web Workers** (`Worker`)                                            | Search filtering (`src/utils/filterWorker.js`), Chess AI search (`projects/games/chess/ai-worker.js`)                       | Optional                               | Search filtering automatically falls back to synchronous main-thread filtering in `script.js` when workers fail or are unsupported. Chess AI falls back to 2-player local mode with an accessible in-app status notice.                                                                                                                    |
| **IndexedDB API** (`window.indexedDB`)                                | Landing page project registry caching (`CradleDB` in `script.js`)                                                           | Optional                               | If IndexedDB is disabled, unsupported, or blocked (e.g. private browsing), `script.js` catches the error and directly fetches `data/projects.json` via HTTP `fetch()` on every visit.                                                                                                              |
| **localStorage API** (`window.localStorage`)                          | Theme persistence (`scripts/theme.js`), `CradleStorage` (`src/components/ui/storage.js`), project high scores               | Optional                               | `CradleStorage` wraps all `localStorage` calls in `try/catch`. If storage access throws (e.g. third-party cookie restrictions or quota limits), it falls back to an in-memory storage map or safe default value. Theme falls back to OS preference (`prefers-color-scheme`) or default dark theme. |
| **Web Audio API** (`AudioContext`)                                    | Musical instruments (`piano`, `guitar`, `violin`, `guzheng`, `percussion`), audio visualizers, morse code studio            | Optional / Feature-specific            | Uses vendor-prefix fallback (`AudioContext` \|\| `webkitAudioContext`). Handles browser autoplay policies and resume rejection failures gracefully by detecting blocked states and surfacing interactive on-screen recovery paths to enable audio upon direct user gesture. If unsupported, audio synthesis is disabled while visual controls remain interactive. |
| **Canvas 2D API** (`<canvas>`)                                        | Math visualizers, arcade games (`2048`, `cannon-shooting`), generators (`meme-generator`, `avatar-creator`), camera utility | Required for visualizer/game rendering | HTML5 standard. If 2D context creation (`getContext('2d')`) fails, rendering calls are safely bypassed or display an on-screen notice.                                                                                                                                                             |
| **Clipboard API** (`navigator.clipboard`)                             | Chess PGN/FEN copy buttons, text/resume exporters                                                                           | Optional                               | Uses `navigator.clipboard.writeText()` when available in secure contexts (HTTPS/localhost). If blocked or unsupported, notifies the user with a fallback status message or alternative text display.                                                                                               |
| **MediaDevices / Camera API** (`navigator.mediaDevices.getUserMedia`) | Real-time video input in ASCII Camera (`projects/misc/ascii-camera`)                                                        | Required for live camera mode          | Checks `navigator.mediaDevices && navigator.mediaDevices.getUserMedia`. If camera access is denied, unsupported, or served over insecure HTTP, displays an on-screen error banner explaining requirements.                                                                                         |
| **matchMedia API** (`window.matchMedia`)                              | Light/dark theme detection (`prefers-color-scheme: light`)                                                                  | Optional                               | Defaults to dark theme if `matchMedia` is unsupported.                                                                                                                                                                                                                                             |

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

See [CONTRIBUTING.md](CONTRIBUTING.md#architecture-documentation) for full instructions on how to fill it in. For details on the repository's testing strategies and CI gates, refer to [TESTING.md](TESTING.md). For rules regarding external dependencies, refer to [THIRD_PARTY_POLICY.md](THIRD_PARTY_POLICY.md). For persistent data storage and conflict resolution policies, refer to [STORAGE_POLICY.md](STORAGE_POLICY.md). For production hardening and deployment security controls, see [SECURE_DEPLOYMENT_CHECKLIST.md](SECURE_DEPLOYMENT_CHECKLIST.md) and [SECURITY.md](SECURITY.md). For the files, entrypoint, lifecycle, and API rules every mini must follow, see [docs/MINI_CONTRACT.md](docs/MINI_CONTRACT.md).

## 🔒 Security & Vulnerability Disclosure

Cradle takes security seriously and follows a coordinated vulnerability disclosure model.

- **Private Reporting:** If you discover a vulnerability, please **do not open a public issue**. Report it confidentially via [GitHub Private Vulnerability Reporting](https://github.com/Facelessism/cradle/security/advisories/new) or email **`security@cradle.dev`** (or maintainer contact: `facelessism@users.noreply.github.com`).
- **Response SLAs:** Initial acknowledgment within **24 hours**; Critical vulnerabilities (CVSS 9.0+) triaged and mitigated within **48 hours**; High-severity issues within **7 days**.
- **Full Policy:** For our complete incident response process, CVSS triage matrix, remediation SLAs, and researcher safe harbor terms, see [SECURITY.md](SECURITY.md).

## 🔧 Troubleshooting

Running into issues? Check the [Troubleshooting Guide](TROUBLESHOOT.md) for solutions to common setup, development, and Git problems before opening a new issue.

## 🤝 Contributing

Contributions are welcome! Whether you're fixing bugs, improving documentation, or adding new ideas and experiments, your help is greatly appreciated.

Before getting started, please read our [Contributing Guide](CONTRIBUTING.md) for information about the development workflow, coding standards, and pull request process.

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

## Note

This project is part of **Nexus Spring of Code 2026**.

## Very Important Note

Don't forget to leave a star behind for the repo if you're visiting this
