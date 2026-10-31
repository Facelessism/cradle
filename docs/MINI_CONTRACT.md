# Mini-Project Module Contract

A **mini** is one self-contained experiment at `projects/<category>/<slug>/`. This document states what every mini must provide so that discovery, the landing page, and validation can treat all minis the same way. It describes what the repository already enforces or does, plus a few SHOULD rules that are only reported as warnings for now.

Check your mini with:

```bash
npm run validate:mini-contract              # prints problems, never fails
npm run validate:mini-contract -- --strict  # exits 1 if any MUST rule is broken
```

The check lives in `scripts/validate-mini-contract.js`. It only warns by default because some existing minis do not meet every rule yet.

The words **MUST** and **SHOULD** are used as in RFC 2119. In the validator, MUST rules are `error`s (they fail `--strict`) and SHOULD rules are `warning`s (they never fail `--strict`).

---

## 1. Identity and discovery

`scripts/project-discovery.js` treats every directory two levels below `projects/` as a mini. Nothing else is registered by hand.

| Derived value   | How it is derived                                                                                                                        |
| :-------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `category`      | The parent folder name (`aiml`, `dev-tools`, `games`, ...).                                                                              |
| `path`          | `projects/<category>/<slug>/` (with trailing slash).                                                                                     |
| `title`         | The slug with `-`/`_` replaced by spaces and Title Cased; acronyms such as `ai`, `api`, `qr` are upper-cased.                            |
| `dateAdded`     | Date of the first git commit touching the folder (kept from the previous registry if git history is missing).                            |
| `thumbnailHash` | First 8 hex characters of the SHA-256 of `thumbnail.svg`; omitted if there is no thumbnail (see [ASSET_PIPELINE.md](ASSET_PIPELINE.md)). |

`npm run generate` writes `title`, `category`, `path`, `dateAdded`, and `thumbnailHash` to `data/projects.json`. The registry has **no description field**: the landing page does not read one, so the text in `index.html` (`<title>`, `<meta name="description">`) and `ARCHITECTURE.md` is the only description a mini has.

Rules:

- The slug MUST be unique across the whole repository, because it determines the title and titles must be unique (the generator reports duplicates).
- The slug SHOULD be lowercase words separated by hyphens (`^[a-z0-9]+(-[a-z0-9]+)*$`).
- `data/projects.json` is generated; do not edit it by hand (`npm run validate:projects-sync` checks it).

## 2. Files

| File                                                                                | Status           | Notes                                                                                                                                      |
| :---------------------------------------------------------------------------------- | :--------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                                                                        | **Required**     | The entrypoint. Non-empty, with a `<title>`.                                                                                               |
| `style.css`                                                                         | **Required**     | Mini-specific styling.                                                                                                                     |
| `script.js`                                                                         | **Required**     | Mini-specific behavior. Exception: the minis listed in `MODULAR_PROJECTS` in `scripts/validate-mini-projects.js` use several module files. |
| `thumbnail.svg`                                                                     | **Required**     | Card image. `npm run generate` creates a placeholder if it is missing.                                                                     |
| `ARCHITECTURE.md`                                                                   | **Required**     | Non-empty, based on `ARCHITECTURE_TEMPLATE.md` (section headings are checked by `npm run validate:architecture`).                          |
| Extra scripts (`*Engine.js`, `*Logic.js`, `algorithms.js`, workers)                 | Optional         | Keep pure logic apart from DOM code so it can be unit tested from `tests/` (see `TESTING.md`).                                             |
| `assets/`, images, fonts                                                            | Optional         | Local assets used by the mini.                                                                                                             |
| `.env`, `.env.*`                                                                    | **Forbidden**    | See `CREDENTIALS_AND_SECRETS.md`.                                                                                                          |
| `package.json`, `node_modules`                                                     | **Forbidden**    | Per-mini package trees are prohibited; manage dependencies at root (see [BUILD_STRATEGY.md](BUILD_STRATEGY.md)).                         |
| Unbuilt source (`.ts`, `.tsx`, `.jsx`, `.scss`, etc.)                               | Conditional      | Must not exist in Tier 1; in Tier 2/3 must be registered in `scripts/build-minis.js` with committed bundle (see [BUILD_STRATEGY.md](BUILD_STRATEGY.md)). |

## 3. Entrypoint rules

`index.html` is the only entrypoint. The repository has no bundler, so the browser must be able to run the files exactly as committed.

- **Build model & static runtime.** By default, minis operate on **Tier 1: Static (Zero-Build)**—no transpiling, bundling, or per-project install step is needed to run. Minis requiring compilation must follow the centralized build model (**Tier 2: Centrally Bundled**) registered with `scripts/build-minis.js` or **Tier 3: Individually Bundled** for pre-compiled Wasm/DSP. In all cases, the mini MUST be runnable directly from `index.html` without running a per-mini build or install command. See [BUILD_STRATEGY.md](BUILD_STRATEGY.md).
- **Relative paths only.** Every local `src` and `href` in `index.html` MUST be relative and MUST resolve to an existing file. A path starting with a single `/` (for example `/style.css`) is an error because it breaks when the site is hosted under a sub-path.
- **Shared files** live outside the mini and are referenced relatively, for example `../../../assets/favicon.svg` and `../../../src/components/ui/tokens.css`.
- **Required head/body content** (from `CONTRIBUTING.md`, enforced by `npm run validate:mini-projects`): a meaningful descriptive `<title>`, the shared favicon `<link rel="icon" ...>` and the shared Back-to-Home navigation (`BackToHome.js`, the UI bundle `components/ui/index.js`, or `data-cradle-back-to-home`).
- **ES modules** (`<script type="module">`, used for example by `projects/math/pathfinding-visualizer`) are allowed, but browsers block them on `file://`. Say so in `ARCHITECTURE.md` and test with `npm run dev` or `python -m http.server` (see the README note on local servers).
- **Remote scripts** MUST follow `THIRD_PARTY_POLICY.md`: an allowed CDN (`unpkg.com`, `jsdelivr.net`, `cdnjs.cloudflare.com`, `huggingface.co`) plus `integrity` and `crossorigin="anonymous"`. A missing `integrity` is an error; a script from another origin is a warning. Anything else must be vendored into the mini's `assets/`.
- **No dynamic code execution** (`eval`, `new Function`, string timers, inline handlers). Enforced by `npm run validate:no-dynamic-eval`.
- Web Workers must be same-origin files (`npm run validate:worker-integrity`).

## 4. Lifecycle expectations

A mini starts when `index.html` loads and ends when the tab closes or navigates away. Any resource it starts SHOULD be released when it is no longer needed:

| Resource                                                              | Release with                                  | Example in the repo                                                                   |
| :-------------------------------------------------------------------- | :-------------------------------------------- | :------------------------------------------------------------------------------------ |
| `setInterval` timers                                                  | `clearInterval`                               | `projects/games/typing-speed-racer/script.js` (`clearInterval(state.timerId)`)        |
| Object URLs (`URL.createObjectURL`)                                   | `URL.revokeObjectURL`, also on `beforeunload` | `projects/aiml/image-classifier/script.js` (`cleanupObjectUrls`)                      |
| Web Workers                                                           | `worker.terminate()`                          | `projects/games/chess/script.js`, `projects/aiml/neural-network-playground/script.js` |
| Camera / microphone streams                                           | `stream.getTracks().forEach(t => t.stop())`   | `projects/misc/ascii-camera/script.js`                                                |
| Animation frames                                                      | `cancelAnimationFrame`                        | `projects/aiml/neural-network-playground/script.js`                                   |
| Listeners added to `document`/`window` for a gesture (drag, mouse up) | `removeEventListener` when the gesture ends   | `projects/games/cannon-shooting/script.js`                                            |
| Audio nodes                                                           | `oscillator.stop()` when a note ends          | `projects/instruments/guitar/guitarEngine.js`                                         |

Also:

- Start long-running work (models, streams, audio) only after a user action, not on page load (`THIRD_PARTY_POLICY.md` section 3; browsers also require a gesture to start audio).
- Minis share an origin but are independent: do not rely on globals or storage keys of other minis, and namespace your own storage keys.

The validator checks the first four rows with a plain text search over the mini's `.js`/`.mjs` files and `index.html` (for example "`setInterval` is used but `clearInterval` never appears"). These are warnings only because a text search cannot prove that a resource really leaks.

## 5. Browser APIs

Minis target current evergreen Chrome, Firefox, and Safari with no polyfill or build step. The full table of APIs in use, with their fallbacks, is in the README under [Browser Compatibility & Progressive Fallbacks](../README.md#-browser-compatibility--progressive-fallbacks). In short:

- **No ceremony needed:** DOM, Canvas 2D, SVG, Web Audio (start it from a user gesture), Fetch to same-origin files, `matchMedia`, File API and `Blob` downloads.
- **Needs feature detection and a fallback:** Web Workers, Clipboard, IndexedDB, and any other API that can be missing or blocked (`'Worker' in window`, `navigator.mediaDevices?.getUserMedia`). The rest of the mini keeps working without it.
- **Permission-gated APIs** (camera, microphone, screen capture, geolocation, notifications, clipboard read): request only after the user clicks something that explains why, handle denial and insecure contexts with an on-screen message, and stop the stream when done. `projects/misc/ascii-camera` is the reference.
- **Networking:** a mini SHOULD work offline. If it needs a remote service, say so in `ARCHITECTURE.md` and degrade gracefully when the request fails. Never embed an API key (section 6).
- If you use an API that is not in the README matrix, add a row for it.

## 6. Storage, secrets, and third-party code

- **Storage:** use `CradleStorage` (or the `cradle-storage` plugin), not `localStorage` directly, and validate what you read. IndexedDB is for binary data and large payloads. See [STORAGE_POLICY.md](../STORAGE_POLICY.md). The validator warns on direct `localStorage` use in a mini that never mentions `CradleStorage`.
- **Secrets:** no keys, tokens, or `.env` files, ever. See [CREDENTIALS_AND_SECRETS.md](../CREDENTIALS_AND_SECRETS.md).
- **Third-party code and models:** allowed CDNs, SRI, lazy loading, fallbacks, and licence attribution are in [THIRD_PARTY_POLICY.md](../THIRD_PARTY_POLICY.md). Every third-party dependency MUST be listed in the mini's `ARCHITECTURE.md` with its licence.
- **Security issues** go through [SECURITY.md](../SECURITY.md).

## 7. How the contract is enforced

| Check                              | Command                                                                         | Covers                                                 |
| :--------------------------------- | :------------------------------------------------------------------------------ | :----------------------------------------------------- |
| Contract report (this document)    | `npm run validate:mini-contract [-- --strict]`                                  | Sections 2-6, per mini, with `error`/`warning` levels. |
| Required files, navigation, assets | `npm run validate:mini-projects`                                                | Existing CI gate (fails on any problem).               |
| Architecture docs                  | `npm run validate:architecture`                                                 | Presence and required sections of `ARCHITECTURE.md`.   |
| Registry sync                      | `npm run validate:projects-sync`                                                | `data/projects.json` matches the folders.              |
| Build strategy compliance          | `npm run validate:build-strategy`                                               | Zero rogue tooling, valid build tiers (BUILD_STRATEGY).|
| Dynamic code, workers, labels      | `validate:no-dynamic-eval`, `validate:worker-integrity`, `validate:a11y-labels` | Section 3 and accessibility.                           |

The contract validator reuses the file, navigation, and favicon checks from `scripts/validate-mini-projects.js` and the folder scan from `scripts/project-discovery.js`, so the rules cannot drift apart. It is not part of CI yet; once the remaining violations are fixed it can be added next to the other gates.
