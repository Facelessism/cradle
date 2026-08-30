# Project Architecture

## Overview

Feature Flag Playground is a local, browser-only tool for creating and
toggling feature flags. Users can define flags, enable or disable them
per environment (Development, Staging, Production), set a percentage
rollout, and simulate whether a given user would see a flag as ON,
based on a deterministic hash of the user ID and flag key.

## Purpose & Goals

- Demonstrate a realistic feature-flag mental model (per-environment
  state, percentage rollouts, per-user evaluation) without a backend
- Keep flag data persisted locally so it survives page refreshes
- Provide a deterministic evaluation function so rollout behavior is
  predictable and explainable during a demo

## Folder Structure

```
feature-flag-playground/
├── index.html       # Page structure: header, toolbar, new-flag form, env tabs, evaluate panel
├── style.css         # Project-specific styling (extends Cradle's shared tokens.css)
├── flagEngine.js      # Pure logic: storage, hashing, evaluation — no DOM access
├── script.js         # DOM wiring: rendering, event listeners, tab switching
├── ARCHITECTURE.md   # This file
└── thumbnail.svg     # Showcase card thumbnail
```

## System / Project Architecture Overview

The project follows the same pattern as other Cradle dev-tools mini
projects: a static HTML shell styled with the shared design tokens,
plus two vanilla-JS files split by responsibility.

```
User interaction → script.js (DOM layer)
                       ↓ calls
                  flagEngine.js (data/logic layer)
                       ↓ reads & writes
                  localStorage ("cradle-feature-flags")
```

`flagEngine.js` never touches the DOM, and `script.js` never touches
`localStorage` directly — it always goes through the engine.

## Component Breakdown

| File            | Responsibility                                                                 |
| ---------------- | ------------------------------------------------------------------------------- |
| `flagEngine.js`  | CRUD for flags, environment state updates, demo-data seeding, JSON import/export, deterministic user-bucket hashing, flag evaluation |
| `script.js`      | Renders flag tables per environment, wires tabs/search/form/toggle/rollout events, drives the "Evaluate for a user" panel |
| `index.html`     | Static structure: header/summary, toolbar, new-flag form, environment tabs, evaluate panel |
| `style.css`      | Layout and visual styling, built on top of `tokens.css`                       |

## Data Flow / Execution Flow

1. On `DOMContentLoaded`, `script.js` calls `FlagEngine.getFlags()`.
2. If no data exists in `localStorage`, the engine seeds four demo
   flags and persists them.
3. `script.js` renders one table per environment tab (Development,
   Staging, Production), each showing every flag's enabled state and
   rollout percentage for that environment.
4. Toggling a switch or dragging a rollout slider calls
   `FlagEngine.updateEnvState(id, env, patch)`, which updates and
   re-saves the flags array, then the UI re-renders from storage.
5. Creating a flag calls `FlagEngine.createFlag(name, description)`,
   which adds a new flag disabled in all three environments.
6. The "Evaluate for a user" panel takes a user ID, then for the
   active environment tab calls `FlagEngine.evaluate(flag, env,
   userId)` for every flag, showing ON/OFF and the computed bucket.

## Key Features

- Per-environment enable/disable toggle switches
- Percentage rollout slider (0–100%, 5% steps) per environment
- Deterministic user-bucket hashing so the same user always gets the
  same result for a given flag and rollout percentage
- Search/filter across flag name, key, and description
- Export flags to a `.json` file and import them back
- One-click reset to demo data

## Technologies Used

- HTML5, CSS3 (Cradle shared design tokens)
- Vanilla JavaScript (ES6+, IIFE modules, no build step)
- Browser `localStorage` for persistence
- Shared Cradle UI components: `Button.js`, `BackToHome.js`,
  `escapeHtml.js`

## File Responsibilities

**`flagEngine.js`**

- `getFlags()` / `saveFlags()` — read/write the flags array
- `createFlag(name, description)` — adds a new flag, disabled in all environments
- `updateEnvState(id, env, patch)` — merges a partial state update for one environment
- `bucketFor(userId, flagKey)` — djb2-style hash → 0–99 bucket
- `evaluate(flag, env, userId)` — returns `{ on, bucket }` for a flag/env/user

**`script.js`**

- `render()` — re-reads flags from the engine and redraws all three tables
- `rowTemplate(flag, env)` — builds one table row's HTML for a flag/environment pair
- `bindTableEvents()` — delegates toggle/rollout/delete events per panel
- `bindEvaluate()` — wires the user-ID input and evaluation results list

## Design Decisions

- **Flags are shared across environments, state is not.** A flag has
  one name/key/description but a separate `{ enabled, rollout }` per
  environment, mirroring how real flag platforms scope rollout to an
  environment rather than duplicating the whole flag.
- **Hashing instead of `Math.random()` for evaluation.** Using a
  string hash of `userId + flagKey` means the same user always gets
  the same result for a flag at a given rollout percentage, which is
  what makes rollout percentages meaningful to demo.
- **Logic/DOM split.** Keeping `flagEngine.js` free of DOM code makes
  the evaluation and storage logic easy to reason about and reuse.

## Dependencies

No external libraries. Loads the shared Cradle UI components already
used across other dev-tools mini projects (`Button.js`,
`BackToHome.js`, `escapeHtml.js`) and Google Fonts for `Space
Grotesk`.

## Future Improvements

- Flag targeting rules beyond percentage rollout (e.g. by user
  attribute)
- Per-flag change history / audit log
- Shareable read-only links via URL-encoded state

## Known Limitations

- Data is stored per-browser via `localStorage`; it is not shared
  across devices or team members.
- Rollout evaluation is a client-side simulation, not a real
  feature-flag SDK.

## Development Notes

Open `index.html` directly in a browser, or serve the repository root
with any static file server. No build step or dependencies are
required.

## References

- Modeled on the structure of the other `projects/dev-tools/` mini
  projects in this repository (e.g. Browser Storage Inspector) for UI
  and file conventions.

## License & Attribution

MIT, consistent with the rest of the repository.