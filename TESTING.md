# Testing Architecture & CI Strategy

Cradle is a static site orchestrating dozens of isolated mini-projects. To ensure quality without introducing heavyweight dependencies, the testing architecture is deliberately split between **pure headless unit tests** and **strict structural/metadata validation**.

This document outlines the testing strategies for all layers of the Cradle repository and defines the mandatory gates enforced by Continuous Integration (CI).

---

## 1. Unified Testing Architecture

### 1.1 Unit Tests (Pure Logic)
Since Cradle has zero build steps (no Webpack, no Babel), we cannot run DOM-heavy or React-style virtual tests easily in Node. 

Instead, complex mini-projects must decouple their **engine/logic** from their **DOM rendering**. 
- **Tooling**: Node.js built-in test runner (`node:test` and `node:assert`).
- **Target**: Files ending in `*Engine.js`, `*Logic.js`, `*Storage.js` or generic utility scripts that are structured as UMD modules.
- **Location**: All unit tests reside in the root `tests/` directory (e.g. `tests/chess-logic.test.js`).

### 1.2 Integration & Browser Tests
Currently, we do not mandate E2E testing (like Playwright or Cypress) for every mini-project to keep the repository lightweight. 
- **Defensive DOM Queries**: Where testing DOM behavior is necessary in Node, we use JSDOM in specific test suites (e.g., `tests/defensive-dom-queries.test.js`).
- **Future Strategy**: If complex interactive components break frequently, opt-in Playwright E2E suites may be introduced.

### 1.3 Testing Complex Behavior (Canvas / Audio)
- **HTML5 Canvas**: Logic driving canvas rendering must be decoupled. Test the geometry, physics, or game state algorithms via unit tests. Mock the `CanvasRenderingContext2D` if a function strictly requires it.
- **Web Audio API**: Decouple sound scheduling from the UI. Test audio timing logic headlessly, mocking the `AudioContext` interface where strictly necessary.

### 1.4 Accessibility (a11y) Validation
Accessibility is a first-class citizen. 
- **Automated**: `scripts/validate-accessible-labels.js` crawls all HTML to ensure ARIA labels, semantic `<button>`/`<nav>` tags, and contrast standards are loosely met.
- **Focus States & Reduced Motion**: Tests in `tests/interactive-controls-a11y.test.js` and `tests/reduced-motion-validation.test.js` enforce inclusive CSS rules.

### 1.5 Metadata & Structural Validation
The `projects/` tree is the source of truth for the site. Structural drift is prevented via validation scripts that run globally:
- `validate-projects-sync.js`: Ensures `data/projects.json` perfectly matches the disk state.
- `validate-mini-projects.js`: Ensures every project has an `index.html`, `style.css`, `script.js`, and `thumbnail.svg`.
- `validate-architecture-docs.js`: Ensures every project maintains an `ARCHITECTURE.md`.

---

## 2. CI Strategy & Mandatory Gates

All tests and structural validations are enforced in GitHub Actions (`.github/workflows/test.yml` and `.github/workflows/healthcheck.yml`). 

For a PR to be merged into `main`, the pipeline **MUST** pass the following stages in sequence:

### Gate 1: Code Quality & Formatting
- **Prettier Check**: `npm run check-format` enforces consistent styling across the codebase.

### Gate 2: Structural Validation
- **Architecture Integrity**: `npm run validate:architecture` (Ensures documentation exists).
- **Project Synchronization**: `npm run validate:projects-sync` (Ensures the JSON registry matches the folders and is alphabetically sorted).
- **Worker Integrity**: `npm run validate:worker-integrity` (Ensures Web Worker boundary security).

### Gate 3: Mini-Project Validation
- **HTML/Asset Integrity**: `npm run validate:demo-html` and `npm run validate:mini-projects` (Ensures navigation pills, assets, and standard files exist).
- **Security Check**: `npm run validate:no-dynamic-eval` (Forbids `eval()` and insecure dynamic execution).

### Gate 4: Test Suite
- **Unit Execution**: `npm test` runs the full `node:test` suite for project logic and UI utilities.

If any of these gates fail, the CI pipeline halts and marks the commit as failed.

---

## 3. Adding a New Test

1. If adding a new mini-project with complex logic (e.g. `projects/games/sudoku/`), abstract the logic into `sudokuLogic.js` (UMD module).
2. Create `tests/sudoku-logic.test.js` using `require('node:test')`.
3. The file will be automatically discovered by `npm test`.
