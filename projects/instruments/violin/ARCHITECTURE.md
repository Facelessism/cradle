# Project Architecture

## Overview

The Virtual Violin is a standalone, dependency-light Cradle mini located under `projects/instruments/violin/`. It provides a playable violin surface with four visible strings, open-string notes, a simplified fingerboard for higher notes, mouse/touch pointer interaction, and keyboard shortcuts. Sound is generated locally with the browser Web Audio API; no audio files or third-party runtime libraries are required.

The implementation intentionally keeps the project as a small static application so it can be opened directly from its `index.html` or served by the same lightweight local server used by Cradle.

## Purpose & Goals

* Provide a playable violin surface that works without any external audio samples or runtime dependencies.
* Demonstrate how the Web Audio API can synthesize a bowed-string-like tone using only oscillators, a gain envelope, and a low-pass filter.
* Support three input modalities — keyboard, mouse, and touch — using Pointer Events so a single code path handles all of them.
* Keep the project self-contained enough to be opened by double-clicking `index.html` or served by the repo's static dev server.

## Folder Structure

```text
projects/instruments/violin/
├── index.html          # Accessible page shell and instrument markup
├── style.css           # Mini-specific layout, violin illustration and responsive styles
├── script.js           # Audio engine, interaction controller and UI state
├── ARCHITECTURE.md     # Project architecture and design decisions
├── README.md           # Run instructions and feature overview
└── thumbnail.svg       # Showcase card thumbnail (auto-generated)

```

## System / Project Architecture Overview

The mini follows a single-file vanilla architecture: `index.html` declares the semantic structure and the CSS-rendered violin markup, `style.css` owns all presentation (the violin illustration itself, responsive layout, theme support, pointer-friendly targets), and `script.js` owns all behaviour — the Web Audio engine, keyboard and pointer handlers, and UI state.

There is no framework, no module loader, and no build step. The `AudioContext` is created lazily on the first user interaction, in line with browser autoplay policies.

```text
User opens index.html
        ↓
Browser loads style.css → script.js
        ↓
UI is rendered; selected string defaults to G
        ↓
User presses A/S/D/F, clicks a string, or drags on the fingerboard
        ↓
script.js resolves the string + semitone offset → frequency
        ↓
AudioContext is lazily created on first interaction
        ↓
Two oscillators (sawtooth + triangle) → low-pass filter → gain envelope → master gain
        ↓
Note plays; selected-string and note readouts update

```

## Component Breakdown

| File | Responsibility |
| --- | --- |
| `index.html` | Page header, Cradle navigation, CSS-rendered violin, four string hit targets, keyboard controls, string selector, volume control, status/live regions for accessible feedback |
| `style.css` | Cradle-compatible custom properties, light/dark theme support, CSS-only violin illustration, responsive layouts, pointer-friendly targets, focus-visible states, reduced-motion support |
| `script.js` | Web Audio engine (oscillators, filter, gain envelope), keyboard and pointer event handling, semitone-to-frequency conversion, UI state (selected string, volume), `localStorage` persistence of volume and theme |
| `thumbnail.svg` | Showcase card thumbnail used by the repo's project index (auto-generated, not edited by hand) |

## Data Flow / Execution Flow

```text
Open index.html
      ↓
Initialise theme, volume and selected string
      ↓
Render the CSS violin
      ↓
User interaction
  ├── Keyboard A/S/D/F
  ├── Mouse pointer
  └── Touch pointer
      ↓
Resolve string + fingerboard position
      ↓
Convert semitone offset to frequency
      ↓
Create short Web Audio tone
      ↓
Update note/status UI

```

## Key Features

* **Four Playable Strings:** G, D, A, and E with correct open-string frequencies.
* **Keyboard Shortcuts:** `A` / `S` / `D` / `F` map to the G / D / A / E strings respectively.
* **Unified Input Support:** Mouse and touch support via Pointer Events — the same code path works on desktop and mobile.
* **Simplified Fingerboard:** Vertical pointer position on a string maps to a semitone offset from the open string, allowing higher notes to be played.
* **Bowed-String Synthesis:** Lightweight tone generation using two oscillators (sawtooth + triangle) feeding a low-pass filter and an exponential gain envelope.
* **Persistent Settings:** Volume control and Light/Dark themes persist across sessions via `localStorage`.
* **Accessibility First:** Semantic headings, `aria-labels` on string targets, `aria-pressed` on selected strings, live status messaging (`aria-live`), visible `:focus-visible` states, touch-friendly control sizes, and reduced-motion support.

## Technologies Used

| Technology | Purpose |
| --- | --- |
| **HTML5** | Semantic page structure, accessible controls, live regions |
| **CSS3** (Custom Properties, `:focus-visible`, `prefers-reduced-motion`) | Violin illustration, layout, themes, accessibility states |
| **Vanilla JavaScript** (ES6+) | Web Audio engine, pointer/keyboard handlers, UI state |
| **Web Audio API** (`AudioContext`, `OscillatorNode`, `GainNode`, `BiquadFilterNode`) | Tone synthesis |
| **Pointer Events API** | Unified mouse + touch input |
| **`localStorage`** | Persisting volume and theme preferences |

## File Responsibilities

### `index.html`

* Page header and Cradle navigation.
* CSS-rendered violin structure (neck, body, four strings).
* Four string hit targets, each with an enlarged invisible pointer overlay for easier interaction.
* Keyboard controls hint (`A` / `S` / `D` / `F`).
* String selector control.
* Volume control slider.
* Status / live regions for accessible feedback (`aria-live`).

### `script.js`

* Defines the immutable `STRINGS` catalogue (open-string frequencies for G, D, A, E).
* Maps keyboard keys to strings.
* Lazily creates the `AudioContext` on the first user interaction.
* Generates short bowed-string-like tones using two oscillators (sawtooth + triangle), a low-pass filter, and an exponential gain envelope, all routed through a shared master gain node.
* Maps fingerboard pointer position to semitone offsets from the selected open string.
* Handles mouse and touch through Pointer Events (single handler for both).
* Updates selected-string and note readouts.
* Persists volume and theme preferences when browser storage is available.

### `style.css`

* Cradle-compatible CSS custom properties (inherits from the shared `tokens.css`).
* Dark/light theme support using the repo-wide light-theme convention.
* CSS-only violin illustration (no image asset).
* Responsive layouts for desktop, tablet, and mobile.
* Pointer-friendly string targets with enlarged hit areas.
* `:focus-visible` states for keyboard users.
* `@media (prefers-reduced-motion: reduce)` support.

## Design Decisions

* **CSS-only violin illustration:** The violin is rendered entirely with CSS rather than an image or SVG. This keeps the mini portable (no asset to ship) and avoids an additional network request.
* **Web Audio synthesis instead of audio samples:** Generating tones on the fly with oscillators + filter + envelope avoids bundling audio files while still producing a recognizable bowed-string timbre. This is intentionally a lightweight approximation, not a physical model.
* **Pointer Events instead of separate mouse/touch handlers:** Using the unified Pointer Events API means a single code path handles desktop mice, touchpads, and touchscreens — no duplicate `mousedown` / `touchstart` handlers to keep in sync.
* **Lazy `AudioContext` creation:** The `AudioContext` is created on the first user interaction, not at page load, to comply with browser autoplay policies.
* **Data-driven string catalogue:** The `STRINGS` catalogue is an immutable array; adding a new string (e.g. a fifth string for a viola tuning) would be a one-line change rather than touching the audio engine.
* **Shared master gain:** All notes route through one `masterGain` node so the volume control affects every voice without per-note gain arithmetic.

## Dependencies

| Dependency | Version | How loaded | Purpose |
| --- | --- | --- | --- |
| **Cradle shared tokens.css** | — | `<link>` from `../../../src/components/ui/tokens.css` | Design tokens (colours, spacing, typography) |
| **Web Audio API** | — | Native | Tone synthesis |
| **Pointer Events API** | — | Native | Unified mouse + touch input |
| **`localStorage`** | — | Native | Persisting volume and theme preferences |

*No external libraries, CDNs, fonts, or runtime packages are required.*

## Future Improvements

* Additional finger positions or scales (e.g. first-position, third-position fingering guides).
* Bow direction and pressure simulation.
* More realistic envelope/filter modelling (e.g. a physical-modeling bowed-string source).
* Note labels or pitch indicators on the fingerboard.
* Recording and playback of short performances.
* Alternate tunings (e.g. viola, cello).
* MIDI input/output for hardware controllers.
* A reusable Instrument abstraction for future Cradle instrument minis.

## Known Limitations

* **Simplified Sound Model:** The bowed-string sound is a lightweight approximation — it does not model bow direction, bow pressure, or body resonance in detail.
* **No Recording:** No recording or playback capability.
* **Fixed Key Mapping:** Keyboard layout is fixed to `A` / `S` / `D` / `F`; it is not user-configurable.
* **Linear Fingerboard Mapping:** The simplified fingerboard uses a single linear semitone mapping rather than modelling actual hand positions.
* **First-Note Latency:** Audio is started lazily in response to user interaction to comply with browser autoplay policies, so the very first note may have a tiny startup latency.

## Development Notes

* Open `projects/instruments/violin/index.html` directly in a browser, or serve the repository root with any static file server. No build step is required.
* The shared `tokens.css` is loaded via a relative path; if you move the project folder, update the `<link href>` in `index.html`.
* Because the `AudioContext` is created on first user interaction, audio will not play until the user clicks a string or presses a key — this is intentional and required by browser autoplay policies.
* Theme changes persist via `localStorage` under the repo-wide Cradle theme convention key.

## License & Attribution

* **Project License:** MIT, consistent with the rest of the Cradle repository.
* **Third-Party Assets:** None. All visuals are CSS; all audio is synthesized at runtime. No images, fonts, or audio files are bundled.
* **References:**
* [MDN Web Docs — Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
* [MDN Web Docs — Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
* [MDN Web Docs — prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
* [Violin family tunings — Wikipedia](https://en.wikipedia.org/wiki/Violin_tuning)
* Other Cradle `projects/instruments/` mini-projects — file-convention reference
