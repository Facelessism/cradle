# Morse Code Studio Architecture Documentation

## Overview

The Morse Code Studio is a browser-based tool that converts plain text into Morse code and decodes Morse code back into text. It also plays Morse code as audio signals with an adjustable playback speed.

## Purpose & Goals

- Provide a self-contained encode/decode tool for learning and working with Morse code.
- Demonstrate the Web Audio API for synthesizing Morse tones without any audio files.
- Keep translation logic pure and framework-free so it can be unit-tested in Node.js.
- Offer an adjustable playback speed so users can practice at their own pace.

## Folder Structure

```text
projects/misc/morse-code-studio/
├── ARCHITECTURE.md    # Project documentation
├── index.html         # User interface
├── morseEngine.js     # Modular translation, timing, and audio sequence engine
├── script.js          # UI binding, events, and audio player
└── style.css          # Styling
```

- **tests/morse-code-studio.test.js**: Dedicated unit tests covering encoding, decoding, WPM timing calculation, and audio sequence generation.

## System / Project Architecture Overview

```text
┌───────────────────────────────┐
│        User Input             │
│  Text or Morse Code           │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│      Translation Engine       │
│         (script.js)           │
└──────────────┬────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
 Encode Text      Decode Morse
      │                 │
      └────────┬────────┘
               ▼
┌───────────────────────────────┐
│        Output Display         │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│   Audio Playback Generator    │
│      (Web Audio API)          │
└───────────────────────────────┘
```

The project splits pure logic from DOM wiring. `morseEngine.js` is UMD-wrapped: it exposes a `MorseEngine` namespace in the browser and CommonJS exports in Node.js, so encoding, decoding, and WPM timing calculations can be unit-tested without a browser. `script.js` binds the UI controls, performs encode/decode, and plays tones directly through the Web Audio API.

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Two-pane editor layout, toolbar, and playback speed slider |
| `morseEngine.js` | Morse dictionary, text encode/decode, WPM timing math, audio sequence generation |
| `script.js` | UI binding, encode/decode handlers, copy/clear, Web Audio playback |
| `style.css` | Dark theme styling and responsive layout |

## Data Flow / Execution Flow

```text
User opens index.html
        ↓
Browser loads morseEngine.js → script.js → style.css
        ↓
User types plain text or Morse code into the input textarea
        ↓
User clicks Encode or Decode
        ↓
script.js calls MorseEngine.textToMorse / morseToText
        ↓
Result written to the output textarea
        ↓
User clicks Play → script.js synthesizes beeps (dit = 1 unit, dah = 3 units)
with proportional pauses at the selected speed via the Web Audio API
```

## Key Features

- Encode text into Morse code
- Decode Morse code into text
- Play Morse code as audio
- Adjustable playback speed
- Copy output
- Clear and swap input/output

## Technologies Used

- HTML
- CSS
- JavaScript
- Web Audio API

## File Responsibilities

### `morseEngine.js`

- `getDitDurationMs(wpm)` — converts words-per-minute to dit duration in milliseconds, clamped to 5-60 WPM.
- `textToMorse(text)` — uppercases input and maps each supported character to its Morse symbol.
- `morseToText(morse)` — reverse-maps Morse tokens to characters, treating `/` as a word space.
- `generateAudioSequence(morseStr, wpm, frequency)` — builds an ordered list of tone/pause events using dit, dah, symbol, letter, and word pause timings.
- UMD wrapper exposes these on the global `MorseEngine` and via `module.exports`.

### `script.js`

- `encodeText()` — uses `MorseEngine.textToMorse` (falling back to a local `MORSE` map) and writes the result to the output.
- `decodeText()` — uses `MorseEngine.morseToText` (with a local `REVERSE` map fallback) and writes decoded text.
- `playMorse()` — iterates over the output symbols and plays dit/dah beeps with proportional pauses.
- `beep(ctx, duration)` — plays a 650 Hz sine tone via an oscillator and gain node.
- `clearFields()` and `copyOutput()` — clear both editors and copy the output via the Clipboard API with "Copied!" feedback.
- The speed slider updates the displayed millisecond value live.

### `style.css`

- Dark theme design tokens and card-based two-pane `.editor-grid`.
- Responsive layout: the editor grid collapses to one column below 850px.

## Design Decisions

- **Engine/UI separation** — all translation and timing logic lives in `morseEngine.js` (UMD-wrapped for Node.js tests) while `script.js` only binds the DOM.
- **Web Audio API synthesis** — tones are generated with an oscillator rather than pre-recorded audio files, keeping the project dependency-free.
- **Proportional timing** — dit = 1 unit, dah = 3 units, symbol pause = 1, letter pause = 3, word pause = 7, giving a standard Morse rhythm.
- **Fallback maps in script.js** — a local `MORSE`/`REVERSE` map keeps the UI functional even if the engine module fails to load.

## Dependencies

None. The project uses only native browser APIs (Web Audio API, Clipboard API) and has no external libraries, fonts, or CDN assets.

## Future Improvements

- Download Morse audio as WAV
- Flash visual signals while playing
- Support additional symbols
- Export translations as text files

## Known Limitations

- The playback speed slider exposes a millisecond unit value rather than standard words-per-minute, even though WPM timing math exists in the engine.
- Encoding silently ignores characters not present in the Morse dictionary instead of reporting an error.
- Audio playback always uses a 650 Hz sine tone; there are no volume or frequency controls.

## Development Notes

- Open `index.html` directly in a browser or via a local server (e.g. `python -m http.server 8000`). No build step is required.
- Run the unit tests with `node --test tests/morse-code-studio.test.js` (or `npm test` from the repo root).
- `morseEngine.js` uses a UMD wrapper so the same file loads via a script tag and via `import`/`require` in Node.js.

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None.

## References

- [MDN Web Docs — Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MDN Web Docs — OscillatorNode](https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode)
- [Morse code — Wikipedia](https://en.wikipedia.org/wiki/Morse_code)
