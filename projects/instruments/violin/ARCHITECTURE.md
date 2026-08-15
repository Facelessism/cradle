# Virtual Violin Architecture

## Overview

The Virtual Violin is a standalone, dependency-light Cradle mini located at `projects/instruments/`.

It provides a playable violin surface with four visible strings, open-string notes, a simplified fingerboard for higher notes, mouse/touch pointer interaction, and keyboard shortcuts. Sound is generated locally with the browser Web Audio API; no audio files or third-party runtime libraries are required.

The implementation intentionally keeps the project as a small static application so it can be opened directly from its `index.html` or served by the same lightweight local server used by Cradle.

## Folder Structure

```text
projects/instruments/
├── index.html          # Accessible page shell and instrument markup
├── style.css           # Mini-specific layout, violin illustration and responsive styles
├── script.js           # Audio engine, interaction controller and UI state
├── ARCHITECTURE.md     # Project architecture and design decisions
└── README.md           # Run instructions and feature overview
```

## Application Flow

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

## Core Modules

### `index.html`

Owns the semantic application structure:

- Page header and Cradle navigation.
- CSS-rendered violin structure.
- Four string hit targets.
- Keyboard controls.
- String selector.
- Volume control.
- Status/live regions for accessible feedback.

The page has no framework dependency and loads only the mini's local JavaScript.

### `style.css`

Contains presentation only:

- Cradle-compatible CSS custom properties.
- Dark/light theme support using the same `light-theme` convention.
- CSS-only violin illustration.
- Responsive layouts for desktop, tablet and mobile.
- Pointer-friendly string targets.
- Focus-visible states.
- Reduced-motion support.

The violin does not depend on an image or SVG asset, which keeps the mini portable and avoids additional network requests.

### `script.js`

Contains the interaction and audio controller.

Responsibilities:

- Defines the four violin strings and their frequencies.
- Maps keyboard keys to strings.
- Lazily creates the `AudioContext`.
- Generates short bowed-string-like tones using oscillators, gain envelopes and a low-pass filter.
- Maps fingerboard pointer position to semitone offsets.
- Handles mouse and touch through Pointer Events.
- Updates selected-string and note readouts.
- Persists volume and theme preferences when browser storage is available.

## State Model

The mini deliberately keeps state small:

| State | Purpose |
| --- | --- |
| `selectedString` | Current string selected in the control panel |
| `audioContext` | Lazily-created browser audio context |
| `masterGain` | Shared output volume node |
| `activePointerId` | Current touch/mouse gesture |
| `lastPointerNote` | Prevents duplicate notes during a drag |
| `volume` | User-controlled output level |
| Theme | Stored through the Cradle `theme` convention |

The string catalogue is immutable and can be extended by adding string metadata rather than changing the audio engine.

## Audio Design

The Web Audio implementation uses two oscillators:

1. A sawtooth oscillator provides the bright bowed-string harmonic content.
2. A triangle oscillator reinforces the fundamental/body resonance.

Both feed a low-pass filter and an exponential gain envelope before reaching the shared master gain.

This is intentionally a lightweight approximation rather than a physical violin model. It avoids shipping large audio samples while keeping the mini immediately playable.

## Interaction Design

### Keyboard

- `A` → G string
- `S` → D string
- `D` → A string
- `F` → E string

Keyboard interaction plays the corresponding open string.

### Mouse and Touch

Each visible string has an enlarged invisible pointer target for easier interaction.

The vertical pointer position on the fingerboard maps to a semitone offset from the selected open string. Moving the pointer while pressed creates a simple playable pitch progression.

Pointer Events are used instead of separate mouse/touch handlers so the same implementation works across desktop and mobile browsers.

## Accessibility

The mini includes:

- Semantic headings and controls.
- `aria-label` values for instrument targets.
- `aria-pressed` state for selected strings.
- Live status messaging.
- Keyboard operation.
- Visible `:focus-visible` states.
- Touch-friendly control sizes.
- Reduced-motion support.

Audio is started lazily in response to user interaction to comply with browser autoplay policies.

## Responsive Strategy

Desktop uses a two-column instrument/control layout.

At smaller widths:

- The workspace becomes a single column.
- Controls move below the instrument.
- The violin scales with viewport width.
- Horizontal overflow is explicitly prevented.
- Pointer targets remain large enough for touch interaction.

## Scalability

The implementation is intentionally data-driven around the `STRINGS` catalogue. Future enhancements can be added without replacing the interaction model:

- Additional finger positions or scales.
- Bow direction and pressure simulation.
- More realistic envelope/filter modelling.
- Note labels or pitch indicators.
- Recording/playback.
- Alternate tunings.
- MIDI input/output.
- A reusable `Instrument` abstraction for future Cradle instrument minis.

No framework or dependency is required for these extensions.

## Testing Checklist

Manual verification should cover:

- Open `projects/instruments/index.html`.
- Click each visible string.
- Drag on each string/fingerboard on desktop.
- Tap each string on a touch device.
- Press `A`, `S`, `D`, `F`.
- Confirm volume changes affect playback.
- Confirm theme changes persist after refresh.
- Confirm no horizontal scrolling at mobile widths.
- Confirm keyboard focus is visible.
- Confirm the page remains usable when Web Audio is unavailable.

## Repository Integration

The mini should be registered in `data/projects.json` using the repository's existing project metadata format. The project path should be:

```text
projects/instruments/
```

If the repository's current category vocabulary contains `instruments`, use that category; otherwise use the closest existing category defined by `data/projects.json` rather than introducing an unregistered category.
