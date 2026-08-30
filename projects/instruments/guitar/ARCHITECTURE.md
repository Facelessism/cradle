# Project Architecture — Virtual Guitar

## Overview

The Virtual Guitar is a browser-based guitar simulator built using HTML, CSS, and vanilla JavaScript. It allows users to pluck individual strings, strum multiple strings, and select frets to change the pitch, providing a tactile and auditory simulation of a guitar.

The project is self-contained and uses the Web Audio API for real-time sound synthesis.

---

## Purpose & Goals

- Provide an interactive guitar interface with visual and auditory feedback
- Implement realistic string plucking sounds using additive synthesis and noise bursts
- Support multiple input methods including mouse, touch, and computer keyboard
- Allow dynamic pitch shifting via fret selection
- Ensure responsive behavior across different screen sizes

---

## Folder Structure

```
guitar/
├── index.html      # UI shell and guitar fretboard layout
├── script.js       # Controller, event handling, and UI synchronization
├── style.css       # Guitar appearance, fretboard styling, and active states
├── guitarEngine.js  # Core audio engine, frequency logic, and synthesis
├── stringOverlay.js # SVG layer for rendering guitar strings
├── thumbnail.svg   # Project artwork
└── ARCHITECTURE.md # This file
```

---

## System / Project Architecture Overview

The project uses a controller-engine pattern. `index.html` and `style.css` define the visual fretboard. `script.js` acts as the controller, managing user interactions (pointer events for strings/frets and keyboard events for shortcuts). It coordinates with `guitarEngine.js`, which handles the low-level Web Audio API operations to synthesize sounds based on the selected string and fret. `stringOverlay.js` provides a visual layer to ensure strings are rendered correctly across the instrument.

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Defines the fretboard DOM, fret buttons, and control interface |
| `script.js` | Manages input events, fret selection, and triggers audio via the engine |
| `style.css` | Handles the visual layout of the guitar neck and active state animations |
| `guitarEngine.js` | Implements the sound synthesis logic, note frequency calculations, and audio routing |
| `stringOverlay.js` | Renders the SVG strings connecting the neck to the bridge |

---

## Data Flow / Execution Flow

```
User interacts with the guitar (Plucks string / Selects fret / Presses key)
↓
script.js captures the interaction and determines the string and fret
↓
script.js calls GuitarEngine.playString(stringIndex, fret)
↓
GuitarEngine calculates the frequency based on standard tuning and fret offset
↓
A voice is created using a triangle oscillator (fundamental) and a sine oscillator (harmonic)
↓
A "pluck" noise buffer is added to simulate the physical attack of the string
↓
Audio is routed through a low-pass filter and a master gain node
↓
The sound is played through the browser's audio output
```

---

## Key Features

- **Additive Synthesis**: Combines fundamental and harmonic oscillators for a richer guitar-like timbre.
- **Pluck Noise**: Uses a generated noise buffer to simulate the initial attack of a string being plucked.
- **Fret Selection**: Allows users to change the pitch of strings by selecting different frets.
- **Strumming**: Implements a delayed sequence of string plucks to simulate an up-stroke or down-stroke strum.
- **Keyboard Mapping**: Provides quick-access keys to play specific strings and frets.

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Instrument structure and control UI |
| CSS3 | Guitar neck layout and visual feedback |
| JavaScript (ES6+) | Event handling and coordination |
| Web Audio API | Real-time audio synthesis and signal routing |
| SVG | Visual rendering of the guitar strings |

---

## File Responsibilities

### `index.html`

- Sets up the guitar neck and string elements.
- Provides the UI for fret selection and volume control.

### `script.js`

- `playString()`: Coordinates the UI highlight and the audio trigger.
- `strum()`: Triggers a series of notes with a slight delay for a strumming effect.
- Handles pointer and keyboard events to map user input to guitar actions.

### `guitarEngine.js`

- `STANDARD_TUNING`: Constants defining the base frequencies for the 6 strings.
- `getFrequency()`: Calculates the frequency based on `baseFrequency * 2^(fret/12)`.
- `playString()`: Implements the synthesis chain (Oscillators -> Filter -> Master Gain).
- `createPluckNoise()`: Generates the attack noise for realism.

### `stringOverlay.js`

- Manages the SVG elements that visually represent the guitar strings.
- Ensures the strings are correctly positioned relative to the fretboard.

### `style.css`

- Styles the fretboard and strings to resemble a real guitar.
- Manages the `.active` and `.selected` classes for visual feedback.

---

## Design Decisions

- **Logarithmic Frequency Scaling**: Used the formula `f = f0 * 2^(n/12)` to accurately model the chromatic scale of a guitar.
- **Hybrid Sound Model**: Combined a triangle wave with a sine harmonic and a noise burst to approximate the complex timbre of a plucked string.
- **Asynchronous Playback**: Used `async/await` for audio initialization to ensure the `AudioContext` is resumed before playback.
- **Decoupled Audio Logic**: The `GuitarEngine` is implemented as a standalone module to separate synthesis from DOM manipulation.

---

## Dependencies

None (uses native browser APIs).

---


## Future Improvements

- Support for different guitar tunings (e.g., Drop D, Open G).
- Implementation of a slide effect between frets.
- Addition of a variety of guitar-like sounds (e.g., Acoustic vs Electric).

---

## Development Notes

- The `AudioContext` is resumed on the first user interaction to comply with browser autoplay policies.
- All frequencies are based on the standard EADGBE tuning.

---

## Known Limitations

- The synthesis is a simplified additive model and does not fully capture the resonance and harmonics of a real guitar body.
- No support for varying pluck intensity (velocity).

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None.

---

## References

- [Web Audio API Documentation (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Guitar Frequency Table](https://www.musicca.com/piano-notes-frequencies)