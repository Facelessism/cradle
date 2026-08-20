# Project Architecture

## Overview

Feature Flag Playground is a local, browser-only tool for creating and toggling feature flags. Users can define flags, enable or disable them per environment (Development, Staging, Production), set a percentage rollout, and simulate whether a given user would see a flag as ON, based on a deterministic hash of the user ID and flag key.

## Purpose & Goals

* Demonstrate a realistic feature-flag mental model (per-environment state, percentage rollouts, per-user evaluation) without a backend
* Keep flag data persisted locally so it survives page refreshes
* Provide a deterministic evaluation function so rollout behavior is predictable and explainable during a demo

## Folder Structure

```text
feature-flag-playground/
├── index.html      # Page structure: header, toolbar, new-flag form, env tabs, evaluate panel
├── style.css       # Project-specific styling (extends Cradle's shared tokens.css)
├── flagEngine.js   # Pure logic: storage, hashing, evaluation — no DOM access
├── script.js       # DOM wiring: rendering, event listeners, tab switching
├── ARCHITECTURE.md # Architectural documentation
├── README.md       # Usage instructions
└── thumbnail.svg   # Showcase card thumbnail

```

## System / Project Architecture Overview

The project follows the same pattern as other Cradle dev-tools mini projects: a static HTML shell styled with shared design tokens, plus two vanilla JS files split by responsibility.

```text
User interaction → script.js (DOM layer)
                      ↓ calls
                   flagEngine.js (data/logic layer)
                      ↓ reads & writes
                   localStorage ("cradle-feature-flags")

```

## File Responsibilities

### `flagEngine.js`

* `getFlags()` / `saveFlags()` — reads/writes the flags array in `localStorage`.
* `createFlag(name, description)` — adds a new flag, disabled in all environments by default.
* `updateEnvState(id, env, patch)` — merges a partial state update for one environment.
* `bucketFor(userId, flagKey)` — djb2-style hash that maps inputs to a `0–99` bucket.
* `evaluate(flag, env, userId)` — returns `{ on, bucket }` evaluation state for a given flag, environment, and user ID.

### `script.js`

* `render()` — re-reads flags from the engine and redraws all three environment tables.
* `rowTemplate(flag, env)` — builds one table row's HTML for a flag/environment pair.
* `bindTableEvents()` — delegates toggle, rollout, and delete events per panel.
* `bindEvaluate()` — wires the user ID input and evaluation results list.

## Design Decisions

* **Flags are shared across environments, state is not:** A flag has one name/key/description but a separate `{ enabled, rollout }` per environment, mirroring how real flag platforms scope rollout to an environment rather than duplicating the whole flag.
* **Hashing instead of `Math.random()` for evaluation:** Using a string hash of `userId + flagKey` means the same user always gets the same result for a flag at a given rollout percentage, which makes rollout percentages meaningful to demo.
* **Logic/DOM split:** Keeping `flagEngine.js` free of DOM code makes the evaluation and storage logic easy to reason about and reuse.

## Dependencies

| Dependency | Version | How loaded | Purpose |
| --- | --- | --- | --- |
| **Cradle Shared UI** (`Button.js`, `BackToHome.js`, `escapeHtml.js`) | — | `<script>` tags | Shared UI components and safety utilities |
| **Cradle shared tokens.css** | — | `<link>` | Styling design tokens |
| **Space Grotesk Font** | — | Google Fonts | Primary typography |
| **Browser APIs** (`localStorage`, `document`) | — | Native | Local state persistence and DOM manipulation |

*No external libraries, build steps, or backend services are required.*

## Future Improvements

* Flag targeting rules beyond percentage rollout (e.g., targeting by specific user attributes).
* Per-flag change history / audit log.
* Shareable read-only links via URL-encoded state.

## Known Limitations

* **Local Storage Only:** Data is stored per-browser via `localStorage`; it is not shared across devices or team members.
* **Simulated Evaluation:** Rollout evaluation is a client-side simulation, not a real feature-flag SDK.

## Development Notes

* Open `index.html` directly in a browser, or serve the repository root with any static file server. No build step or dependencies are required.

## License & Attribution

* **Project License:** MIT, consistent with the rest of the Cradle repository.
* **Third-Party Assets:**
* "Space Grotesk" font by [Google Fonts](https://fonts.google.com/) (Open Font License).
* Shared Cradle UI components (`Button.js`, `BackToHome.js`, `escapeHtml.js`) — same-license, repo-wide.



## References

* Modeled on the structure of the other `projects/dev-tools/` mini projects in this repository (e.g., Browser Storage Inspector) for UI and file conventions.
* [Martin Fowler — Feature Toggles](https://martinfowler.com/articles/feature-toggles.html) — terminology and per-environment mental model.
* [djb2 hash explanation](http://www.cse.yorku.ca/~oz/hash.html) — basis for the deterministic user-bucket hash used in `bucketFor`.
