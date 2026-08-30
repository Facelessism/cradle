# Project Architecture — Virtual Guzheng

---

## Overview

The Virtual Guzheng is a standalone interactive musical instrument mini for Cradle. It provides a playable 21-string Chinese zither (guzheng) that supports mouse, touch, and computer keyboard interaction, delivering real-time synthesized plucked-string tones using the Web Audio API.

The project is self-contained and uses a pentatonic tuning system to ensure consonance across all played notes.

---

## Purpose & Goals

- Provide a responsive and culturally authentic virtual guzheng interface
- Implement realistic plucked-string synthesis using additive harmonics and noise transients
- Support "glissando" effects (sliding across strings) via pointer-move detection
- Enable a wide range of note playback through a 21-string layout
- Ensure low-latency audio response across modern browsers

---

## Folder Structure

```
guzheng/
├── index.html      # UI shell and string layout
├── script.js       # Browser controller, event handling, and interaction logic
├── style.css       # String styling and responsive layout
├── guzhengEngine.js  # Core audio engine, frequency data, and synthesis logic
├── thumbnail.svg   # Project artwork
└── ARCHITECTURE.md # This file
```

---

## System / Project Architecture Overview

The project follows a decoupled architecture where the UI and audio logic are separated. `index.html` and `style.css` define the visual string layout. `script.js` acts as the controller, capturing user inputs—including complex interactions like glissando (implemented via `document.elementFromPoint`)—and communicating with `guzhengEngine.js`. The engine handles the Web Audio API calls, managing the harmonic series and noise bursts to produce a zither-like timbre.

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Defines the 21-string DOM and status display |
| `script.js` | Manages input events (click, drag, keyboard) and coordinates with the engine |
| `style.css` | Handles the visual appearance of the strings and active states |
| `guzhengEngine.js` | Owns the D-major pentatonic frequency data and implements the additive synthesis engine |

---

## Data Flow / Execution Flow

```
User interacts with the guzheng (Click / Drag / Keyboard)
↓
script.js captures the event and identifies the note
↓
If dragging: script.js continuously checks for new strings under the pointer
↓
script.js calls GuzhengEngine.pluckString(note)
↓
GuzhengEngine creates an AudioContext and layers multiple oscillators (Harmonics 1-6)
↓
A "pluck" noise buffer is added with a bandpass filter to simulate the attack
↓
Audio is routed through a gain node with an exponential decay envelope
↓
The sound is played through the browser's audio output
```

---

## Key Features

- **Glissando Support**: Allows users to "slide" across strings, triggering notes sequentially as the pointer moves.
- **Pentatonic Tuning**: Pre-configured for D major pentatonic (D, E, F#), ensuring any combination of strings is consonant.
- **Additive Synthesis**: Uses a combination of triangle and sine waves to approximate the metallic timbre of a zither.
- **Attack Simulation**: Implements a short noise transient at the start of each note for realism.
- **Keyboard Mapping**: Maps the top row of the keyboard to the 21 strings for rapid play.

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | String layout and semantic UI |
| CSS3 | Visual styling and responsive layout |
| JavaScript (ES6+) | Event management and coordination logic |
| Web Audio API | Real-time sound synthesis and audio routing |

---

## File Responsibilities

### `index.html`

- Defines the 21 string elements with corresponding `data-note` attributes.
- Provides a status area to show the currently played note.

### `script.js`

- `pluck()`: Coordinates the visual highlight and the audio trigger.
- `pluckAtPoint()`: Implements glissando by detecting strings under the pointer during a drag.
- Handles `pointerdown`, `pointermove`, and `keydown` events.

### `guzhengEngine.js`

- `STRINGS`: Constant defining the notes and frequencies for the 21-string layout.
- `pluckString()`: Implements the synthesis chain (Harmonics + Noise -> Gain Envelope).
- `createPluckNoise()`: Generates a short burst of bandpass-filtered noise for the attack.
- `getNoteFromKey()`: Maps keyboard input to the pentatonic scale.

### `style.css`

- Styles the `.string` elements to look like a zither.
- Defines the `.active` class for visual feedback during plucking.

---

## Design Decisions

- **Pentatonic Scale**: Chose D major pentatonic to mirror the standard tuning of a real guzheng, simplifying the user experience by avoiding dissonant notes.
- **Additive Synthesis**: Used 6 harmonic layers (1 fundamental + 5 overtones) to create a bright, metallic sound.
- **Pointer-Based Glissando**: Used `document.elementFromPoint` instead of `mouseenter` to allow for more fluid, continuous sliding across strings.
- **UMD Pattern**: Wrapped the engine in a UMD-style module to ensure it works in various environments.

---

## Dependencies

None (uses native browser APIs).

---

## Future Improvements

- Support for pitch-bending (pressing the string behind the bridge).
- Implementation of different guzheng-style plucking techniques.
- Addition of a visual "bridge" and "tuning pins" for more realism.

---

## Development Notes

- The `AudioContext` is resumed on the first user interaction to comply with browser autoplay policies.
- Notes are mapped using a standard frequency table.

---

## Known Limitations

- The synthesis is a simplified model and does not capture the full complex resonance of a wooden soundboard.
- No support for velocity-sensitive plucking.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None.

---

## References

- [Web Audio API Documentation (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Chinese Guzheng Tuning Guide](https://en.wikipedia.org/wiki/Guzheng)