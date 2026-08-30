# Project Architecture — Virtual Percussion Set

---

## Overview

The Virtual Percussion Set is a standalone interactive musical instrument mini for Cradle. It provides a playable 8-pad drum machine that supports mouse, touch, and computer keyboard interaction, delivering real-time synthesized percussion sounds using the Web Audio API.

The project is self-contained and uses mathematical models (frequency ramps and noise bursts) to simulate drums and cymbals.

---

## Purpose & Goals

- Provide a responsive and accessible virtual percussion interface
- Implement realistic drum sounds (Kick, Snare, Hi-Hats, Toms, Clap, Crash) using the Web Audio API
- Support multi-touch polyphony for simultaneous pad hits
- Enable a seamless mapping between physical keyboard keys and percussion pads
- Ensure low-latency audio playback across modern browsers

---

## Folder Structure

```
percussion/
├── index.html      # UI shell and percussion pad layout
├── script.js       # Browser controller, event handling, and UI synchronization
├── style.css       # Pad styling, grid layout, and active states
├── percussionEngine.js  # Core audio engine, sound synthesis logic, and pad mappings
├── thumbnail.svg   # Project artwork
└── ARCHITECTURE.md # This file
```

---

## System / Project Architecture Overview

The project follows a controller-engine pattern. `index.html` and `style.css` define the 8-pad grid. `script.js` acts as the controller, capturing user inputs (pointer or keyboard) and communicating with `percussionEngine.js`. The engine handles the low-level Web Audio API calls, utilizing different synthesis techniques (sine ramps for kicks/toms, filtered noise for snares/hats) to produce the distinct sounds of each pad.

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Defines the percussion pad DOM and status display |
| `script.js` | Manages input events, UI state (active pads), and coordinates with the engine |
| `style.css` | Handles the visual appearance of the pads and their active states |
| `percussionEngine.js` | Owns the pad definitions and implements the various sound synthesis algorithms |

---

## Data Flow / Execution Flow

```
User interacts with a pad (Mouse/Touch/Keyboard)
↓
script.js captures the event and identifies the pad ID (e.g., 'kick')
↓
script.js calls PercussionEngine.playPad(padId)
↓
PercussionEngine selects the appropriate synthesis function (e.g., playKick, playSnare)
↓
Web Audio API oscillators and noise buffers are created and routed
↓
Audio is played through a gain envelope to the destination
↓
User receives auditory and visual (active class) feedback
```

---

## Key Features

- **Polyphonic Playback**: Multiple pads can be triggered simultaneously.
- **Custom Synthesis**: Each pad uses a tailored synthesis method:
  - **Kick/Toms**: Sine oscillators with rapid pitch envelopes.
  - **Snare/Hats**: High-pass filtered noise bursts.
  - **Clap**: Staggered noise bursts for a layered effect.
- **Input Flexibility**: Supports pointer events (mouse/touch) and a dedicated keyboard mapping.
- **Low Latency**: Direct use of Web Audio API for immediate sonic response.

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Pad structure and semantic UI |
| CSS3 | Grid layout, pad styling, and responsive design |
| JavaScript (ES6+) | Event management and coordination logic |
| Web Audio API | Real-time sound synthesis and audio routing |

---

## File Responsibilities

### `index.html`

- Defines the grid of 8 percussion pads.
- Provides a status bar to indicate the currently played instrument.

### `script.js`

- `hitPad()`: Coordinates the visual highlight and the audio trigger.
- Handles pointer capture to ensure hits are registered correctly.
- Maps keyboard events to pad IDs via the engine.

### `percussionEngine.js`

- `PADS`: Constants mapping pads to labels and keyboard keys.
- `playKick()` / `playSnare()` / `playHiHat()`: Individual synthesis functions for each sound type.
- `playPad()`: Public API that routes a pad ID to its specific synthesis logic.
- `createNoiseBuffer()`: Utility to generate raw white noise for percussion textures.

### `style.css`

- Styles the `.pad` elements to look like a drum machine.
- Defines the `.active` class for visual feedback during playback.

---

## Design Decisions

- **Frequency Ramping**: Used exponential frequency ramps for kicks and toms to simulate the rapid pitch drop of a drum head.
- **Noise Filtering**: Employed high-pass and band-pass filters on white noise to create the "sizzle" of hi-hats and the "snap" of a snare.
- **Staggered Noise**: For the clap sound, multiple noise bursts were slightly offset in time to mimic a group of people clapping.
- **Decoupled Engine**: The `PercussionEngine` is implemented as a standalone module to separate synthesis from DOM manipulation.

---

## Dependencies

None (uses native browser APIs).

---

## Future Improvements

- Support for custom pad mappings.
- Implementation of a step sequencer for creating simple beats.
- Addition of more percussion sounds (e.g., Bongos, Cowbell).

---

## Development Notes

- The `AudioContext` is resumed on the first user interaction to comply with browser autoplay policies.

---

## Known Limitations

- The synthesis is a simplified model and does not fully capture the acoustic complexity of real percussion instruments.
- No support for velocity-sensitive hits.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None.

---

## References

- [Web Audio API Documentation (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Additive Synthesis Guide](https://en.wikipedia.org/wiki/Additive_synthesis)