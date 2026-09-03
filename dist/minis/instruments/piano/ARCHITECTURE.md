# Project Architecture — Virtual Piano

---

## Overview

The Virtual Piano is a standalone interactive musical instrument mini for Cradle. It provides a playable piano keyboard that supports mouse, touch, and computer keyboard interaction, delivering real-time synthesized piano notes using the Web Audio API.

The project is self-contained with no frontend frameworks or external audio libraries.

---

## Purpose & Goals

- Provide a responsive and accessible virtual piano interface
- Implement realistic note synthesis using a combination of oscillators and noise buffers
- Support multi-note polyphony through an active voice management system
- Enable easy mapping between physical computer keys and musical notes
- Ensure low-latency audio playback across modern browsers

---

## Folder Structure

```
piano/
├── index.html      # UI shell and piano keyboard layout
├── script.js       # Browser controller, event handling, and UI synchronization
├── style.css       # Keyboard styling, key states, and responsive layout
├── pianoEngine.js  # Core audio engine, note frequencies, and synthesis logic
├── thumbnail.svg   # Project artwork
└── ARCHITECTURE.md # This file
```

---

## System / Project Architecture Overview

The project follows a decoupled architecture where the UI and audio logic are separated. `index.html` and `style.css` define the visual representation. `script.js` acts as the controller, capturing user inputs (pointer or keyboard) and communicating with `pianoEngine.js`. The engine handles the low-level Web Audio API calls, managing the creation and destruction of oscillators to produce sound.

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Defines the piano keyboard DOM and status display |
| `script.js` | Manages input events, UI state (active keys), and coordinates with the engine |
| `style.css` | Handles the visual appearance of white/black keys and active states |
| `pianoEngine.js` | Owns the note frequency data and implements the additive synthesis engine |

---

## Data Flow / Execution Flow

```
User presses a key (Mouse/Touch/Keyboard)
↓
script.js captures the event and identifies the musical note
↓
script.js calls PianoEngine.startNote(note)
↓
PianoEngine creates an AudioContext and a set of oscillators (Fundamental + Harmonics)
↓
A "Hammer Attack" noise buffer is played to simulate the physical strike
↓
Audio is routed through a gain node (Envelope) to the destination
↓
User releases the key
↓
script.js calls PianoEngine.stopNote(note)
↓
Engine triggers an exponential decay ramp to silence the note smoothly
```

---

## Key Features

- **Polyphonic Playback**: Multiple notes can be played simultaneously without cutting each other off.
- **Hybrid Synthesis**: Combines triangle and sine oscillators with a noise-based attack for a more natural piano sound.
- **Comprehensive Mapping**: Supports a wide range of notes from C3 to E6.
- **Input Flexibility**: Works with pointer events (mouse/touch) and a dedicated keyboard mapping.
- **Low Latency**: Direct use of Web Audio API for immediate sonic response.

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Keyboard structure and semantic UI |
| CSS3 | Piano layout, key positioning, and responsive design |
| JavaScript (ES6+) | Event management and coordination logic |
| Web Audio API | Real-time sound synthesis and audio routing |

---

## File Responsibilities

### `index.html`

- Defines the layout of the piano keys.
- Provides a status bar to indicate the currently played note.

### `script.js`

- `playNote()`: Coordinates the visual highlight and the audio trigger.
- `stopNote()`: Coordinates the visual reset and the audio release.
- Handles pointer capture to ensure notes don't "stick" when dragging off a key.

### `pianoEngine.js`

- `NOTE_FREQUENCIES`: Constants mapping notes (e.g., "A4") to Hz.
- `createVoice()`: Implements additive synthesis by layering harmonics.
- `createHammerAttack()`: Generates a short burst of filtered noise for realism.
- `startNote()` / `stopNote()`: Public API for controlling the audio lifecycle.

### `style.css`

- Styles the `.key` elements to look like a piano.
- Uses absolute positioning for black keys to overlap white keys.
- Defines the `.active` class for visual feedback during playback.

---

## Design Decisions

- **Additive Synthesis**: Used a combination of a fundamental triangle wave and several sine harmonics to approximate the timbre of a piano.
- **Noise-based Attack**: Added a high-pass filtered noise burst at the start of each note to simulate the hammer hitting the string.
- **Exponential Decay**: Implemented exponential gain ramps for a natural-sounding fade-out.
- **Decoupled Engine**: Wrapped the audio logic in a UMD-style `PianoEngine` to make it potentially reusable in other projects.

---

## Dependencies

None (uses native browser APIs).

---

## Future Improvements

- Support for different piano tones (e.g., Grand Piano, Electric Piano).
- Implementation of a sustain pedal functionality.
- Ability to record and playback sequences of notes.

---

## Development Notes

- The `AudioContext` is resumed on the first user interaction to comply with browser autoplay policies.

**Note:-** frequencies are based on A4 = 440Hz.

---

## Known Limitations

- The synthesis is a simplified model and does not fully capture the complex harmonics of a real piano.
- No support for velocity (volume depends on the synthesis settings, not how hard the key is pressed).

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None.

---

## References

- [Web Audio API Documentation (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Piano Frequency Table](https://www.musicca.com/piano-notes-frequencies)