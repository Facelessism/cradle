# Project Architecture

## Overview

Fourier Series Visualizer is an interactive browser-based tool that demonstrates how periodic waveforms are constructed from harmonic sine and cosine components. Users can switch between square, sawtooth, triangle, and sine waves, adjust frequency and harmonic count, toggle individual harmonics on/off, and watch an animated build-up that progressively adds harmonics to reveal how the composite waveform emerges. It runs entirely in the browser with zero external runtime dependencies beyond the shared Cradle UI system.

---

## Purpose & Goals

- Visually demonstrate Fourier series decomposition for common periodic waveforms
- Provide interactive harmonic toggling so users can hear (conceptually) and see each component's contribution
- Offer an animated "build" mode that progressively stacks harmonics to reveal waveform construction
- Keep the codebase minimal and framework-free so it serves as a readable reference implementation

---

## Folder Structure

```
fourier-series-visualizer/
├── index.html          # Entry point, UI shell, semantic structure
├── style.css           # All visual styling (layout, controls, canvases)
├── script.js           # Application logic — canvas rendering, controls, animation
├── fourierEngine.js    # Pure math engine — Fourier coefficients, waveform sampling
├── ARCHITECTURE.md     # This file — project documentation
└── thumbnail.svg       # Social preview / project card thumbnail
```

---

## System / Project Architecture Overview

The project follows a clean separation of concerns:

- **fourierEngine.js** is a pure, DOM-free math library that computes Fourier coefficients, samples waveforms, and normalises data. It is fully unit-testable in Node.js.
- **script.js** imports the engine and handles all DOM interaction: canvas rendering, user controls, animation frames, and state management.
- **style.css** owns the entire visual presentation, using CSS custom properties from the shared Cradle tokens system.
- **index.html** provides the semantic structure and loads everything in dependency order.

```
┌─────────────────────────────────────────────────────────────┐
│                     index.html                              │
│  (Semantic shell, loads fonts / icons / scripts)            │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
    style.css   fourierEngine   script.js
    (tokens +   (pure math)    (rendering,
     visuals)                  controls, anim)
```

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Page shell, semantic HTML, loads fonts, icons, scripts |
| `style.css` | Full visual design — layout, controls, canvas areas, responsive |
| `script.js` | DOM controller — canvas drawing, user interactions, animation loop |
| `fourierEngine.js` | Pure math — Fourier coefficients, waveform computation, normalisation |

---

## Data Flow / Execution Flow

```
User opens index.html
│
▼
Browser loads tokens.css → style.css → BackToHome.js → fourierEngine.js → script.js
│
▼
script.js init():
  - Sets up theme (dark/light from localStorage)
  - Resizes canvases to container dimensions
  - Calls buildHarmonicList() to populate toggle checkboxes
  - Calls render() for first display
│
▼
render():
  - Reads state.waveType, state.frequency, state.numHarmonics
  - Calls computeWaveform() from fourierEngine.js with active harmonics
  - Calls normalise() on the composite result
  - Clears both canvases
  - Draws grid, composite waveform (with fill), and individual harmonics
│
▼
User interacts (slider / button / checkbox):
  - Event listener updates state
  - render() fires with new parameters
│
▼
Animate Build mode:
  - requestAnimationFrame loop cycles through 1..N harmonics
  - Each frame toggles which harmonics are visible
  - Effectively "builds" the waveform one harmonic at a time
```

---

## Key Features

- **4 waveform types** — Square, Sawtooth, Triangle, and Sine, each with correct Fourier coefficients
- **Adjustable frequency** — 20–500 Hz fundamental drives the displayed waves
- **Harmonic count slider** — 1 to 20 harmonics, composited in real time
- **Individual harmonic toggles** — checkboxes to mute/unmute specific harmonics, with amplitude display
- **Animate Build mode** — progressive harmonic stacking with pause/resume
- **Dark/light theme** — persisted to localStorage, integrates with the Cradle UI system
- **High-DPI canvas** — crisp rendering on Retina displays
- **Responsive layout** — side panel collapses to single-column on smaller screens

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Page structure and semantic markup |
| CSS3 (Grid, Flexbox, Custom Properties) | Layout and responsive design |
| Vanilla JavaScript (ES6+, Canvas API) | Rendering, controls, animation |
| Font Awesome 6.5.1 (CDN) | UI icons |
| Google Fonts (Space Grotesk, Inter, JetBrains Mono) | Typography |
| Cradle tokens.css | Shared design tokens (colours, spacing, typography) |

---

## File Responsibilities

### `fourierEngine.js`

- `fourierCoeff(waveType, n)` — returns `{a, b}` coefficients for harmonic n of any wave type
- `computeWaveform(waveType, numHarmonics, frequency, sampleRate, duration, activeFilter)` — samples the full Fourier sum across time
- `sampleAt(waveType, numHarmonics, frequency, time, activeFilter)` — single-point waveform sample for per-harmonic rendering
- `buildProgressiveFrames(waveType, maxHarmonics, frequency, sampleRate, duration)` — pre-computed frames for build-up animation
- `normalise(samples)` — scales samples to the [-1, 1] range

### `script.js`

- `state` — central state object (waveType, frequency, numHarmonics, speed, animate, activeHarmonics)
- `resizeCanvas()` / `resizeAllCanvases()` — handles Retina DPR and container resizing
- `render()` — the main draw loop: calls engine, clears, draws grids/waveforms/legend on both canvases
- `drawGrid()`, `drawWaveform()`, `drawCompositeFill()` — Canvas rendering helpers
- `buildHarmonicList()` — populates the harmonic toggle checkboxes with color swatches and amplitudes
- `startAnimation()` / `stopAnimation()` — rAF-based progressive harmonic build
- `init()` — bootstraps theme, canvas sizing, and initial render

### `style.css`

- CSS custom properties under `:root` — palette of harmonic colors, canvas background
- `.card` / `.panel` / `controls-panel` — layout system
- `wave-btn` / `active` — wave selection button states
- `harmonic-item` / `harmonic-control` — slider and checkbox styling
- Responsive breakpoints at 900px and 600px
- Dark/light theme via `data-theme` attribute

---

## Design Decisions

- **Pure math engine separate from DOM** — `fourierEngine.js` has zero DOM dependency and uses a UMD wrapper so it can be `require()`-d in Node.js for unit tests. This makes the math independently verifiable.
- **Canvas API instead of SVG** — Canvas offers simpler per-frame rendering for animated waveforms without DOM overhead. The drawing surface is redrawn completely each frame, which is the natural pattern for real-time visualisation.
- **Float64Array for sample data** — Using typed arrays ensures consistent precision and better performance when computing hundreds of samples per frame.
- **Active harmonic set** — Uses a `Set<number>` to track which harmonics are visible. An empty set means "all active", which simplifies the common case.
- **No external math libraries** — All Fourier coefficient formulas are hand-written based on textbook definitions, keeping the project self-contained and auditable.

---

## Dependencies

| Dependency | Version | How loaded | Purpose |
|---|---|---|---|
| Font Awesome | 6.5.1 | CDN (`<link>`) | UI icons |
| Space Grotesk / Inter / JetBrains Mono | — | Google Fonts CDN | Typography |
| Cradle tokens.css | — | Local stylesheet | Shared design tokens |
| Cradle BackToHome.js | — | Local script | Home navigation button |

All runtime dependencies are loaded via CDN or local reference. There is no build step, package manager, or npm dependency.

---

## Future Improvements

- Add audio synthesis so users can hear the waveform at the selected frequency and harmonics
- Add a spectrogram or frequency-domain view alongside the time-domain waveform
- Allow users to draw/customise their own waveform and see its Fourier decomposition
- Support adjustable phase offsets per harmonic

---

## Known Limitations

- The animation build mode cycles through harmonics mathematically but does not currently animate smoothly — it snaps between harmonic counts. A future improvement could interpolate.
- Performance degrades slightly above 15 harmonics on low-end devices (the canvas is redrawn per frame with all harmonic lines).
- Only time-domain visualisation is shown — no frequency-domain (spectrum) view is provided yet.

---

## Development Notes

- Open `index.html` through a local server (e.g. `python3 -m http.server 8000`), not by double-clicking. The `file://` protocol may block some CDN font and icon resources.
- Run unit tests with Node.js: `node tests/fourier-series-visualizer.test.js`
- `fourierEngine.js` is designed as a standalone module: `const { fourierCoeff } = require('./fourierEngine.js')`
- No build step is required. Edit any file and refresh the browser.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:**
  - 'Space Grotesk', 'Inter', and 'JetBrains Mono' fonts by [Google Fonts](https://fonts.google.com) (OFL License)
  - Font Awesome 6.5.1 icons by [Fonticons, Inc.](https://fontawesome.com) (CC BY 4.0)

---

## References

- [Fourier Series — Wikipedia](https://en.wikipedia.org/wiki/Fourier_series) — coefficient formulas for square, sawtooth, and triangle waves
- [3Blue1Brown — Fourier Series](https://www.youtube.com/watch?v=r6sGWTCMz2k) — visual intuition for the underlying math
- [MDN Web Docs — Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
