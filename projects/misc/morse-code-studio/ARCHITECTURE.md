# Morse Code Studio Architecture Documentation

## Overview

The Morse Code Studio is a browser-based amateur radio (CW) audio and translation tool that converts plain text into Morse code and decodes Morse code back into text. It features a Web Audio synthesis engine with adjustable sidetone pitch (300 Hz – 1000 Hz), standard Paris and ARRL Farnsworth timing controls (WPM), and a real-time live audio decoder that captures microphone input via the Web Audio `AnalyserNode`, performing FFT peak frequency detection and hysteresis tone thresholding to stream decoded alphanumeric text.

## Purpose & Goals

- Provide a self-contained bidirectional encode/decode tool for learning, practicing, and analyzing Morse code.
- Demonstrate modern Web Audio API synthesis for Morse tones (oscillators and gain envelopes) without pre-recorded audio files.
- Deliver professional amateur radio (CW) training controls: adjustable sidetone pitch and ARRL Farnsworth timing (dilated character and word pauses while preserving rhythmic element speeds).
- Provide a real-time CW signal demodulator / live audio decoder using FFT spectral analysis via `AnalyserNode`, bandpass filtering, and duration-threshold classification.
- Maintain pure mathematical and decoding logic in an isolated, framework-free UMD module (`morseEngine.js`) for comprehensive unit testability in Node.js.

## Folder Structure

```text
projects/misc/morse-code-studio/
├── ARCHITECTURE.md    # Project documentation and specifications
├── index.html         # User interface, synthesis controls, and live decoder
├── morseEngine.js     # Modular translation, Farnsworth timing, and stream decoder engine
├── script.js          # UI binding, events, Web Audio synth, and live mic decoder
└── style.css          # Styling, dark mode design tokens, and spectrum visualizer
```

- **tests/morse-code-studio.test.js**: Dedicated unit tests covering encoding, decoding, WPM timing calculation, Farnsworth spacing, sidetone frequency, pulse/gap classification, stream decoder state machine, and audio teardown.

## System / Project Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                         User Input                          │
│               Text, Morse, or Microphone CW Audio           │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌───────────────────────────────┐   ┌─────────────────────────────────────────┐
│      Translation Engine       │   │           Live Audio Decoder            │
│         (morseEngine.js)      │   │          (script.js + Engine)           │
└──────────────┬────────────────┘   └────────────────────┬────────────────────┘
               │                                         │
       ┌───────┴───────┐                ┌────────────────┴────────────────┐
       ▼               ▼                ▼                                 ▼
  Encode Text    Decode Morse   MediaStreamAudioSourceNode          BiquadFilterNode
       │               │                │                           (Bandpass CW Q=6)
       └───────┬───────┘                └────────────────┬────────────────┘
               ▼                                         │
┌───────────────────────────────┐                        ▼
│        Output Display         │               AnalyserNode (FFT)
└──────────────┬────────────────┘                        │
               │                        ┌────────────────┴────────────────┐
               ▼                        ▼                                 ▼
┌───────────────────────────────┐  FFT Peak Detection              Hysteresis
│   Audio Playback Generator    │  & Spectral Display              Tone Thresholding
│   - Adjustable Sidetone Pitch │                                         │
│   - Paris / Farnsworth WPM    │                        ┌────────────────┴────────────────┐
│      (Web Audio API)          │                        ▼                                 ▼
└───────────────────────────────┘                   Pulse/Gap Math                 MorseStreamDecoder
                                                         │                                 │
                                                         └────────────────┬────────────────┘
                                                                          ▼
                                                                Live Decoded Text Feed
```

The system cleanly bifurcates pure translation and signal processing math from DOM wiring and audio graph management:
1. `morseEngine.js` provides pure, testable algorithmic components:
   - Morse lookup dictionary (`MORSE_MAP`, `REVERSE_MORSE_MAP`).
   - Standard Paris speed calculation ($t_{\text{dit}} = 1200 / \text{WPM}$).
   - ARRL Farnsworth timing calculation ($\Delta = (60000/s - 37200/c)/19$).
   - Pulse duration classification (`classifyPulse`: dit vs. dah vs. noise rejection).
   - Gap duration classification (`classifyGap`: intra-element, inter-character, inter-word).
   - FFT peak frequency estimator (`detectPeakFrequency`) with quadratic interpolation.
   - Band energy detector (`isTonePresent`).
   - Stateful stream decoder (`createMorseStreamDecoder`).
2. `script.js` coordinates the DOM, binds controls, runs the Web Audio playback synth, manages microphone streams via `getUserMedia`, processes real-time audio animation frames via `requestAnimationFrame`, renders the spectrum visualizer on an HTML5 canvas, and guarantees complete teardown on navigation.

## Component Breakdown

| File             | Responsibility                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`     | Two-pane editor layout, toolbar, audio synthesis & Farnsworth controls, live audio decoder panel, canvas visualizer, and streaming decoded feed        |
| `morseEngine.js` | Morse dictionary, text encode/decode, Paris & Farnsworth timing math, audio sequence generation, pulse/gap classification, and Morse stream decoder      |
| `script.js`      | UI binding, encode/decode handlers, Web Audio playback synth, microphone stream capture, AnalyserNode FFT processing, spectrum visualizer, and teardown |
| `style.css`      | Dark theme styling, responsive layouts, CW carrier LED indicator, visualizer styling, and status badges                                                 |

## Data Flow / Execution Flow

### Audio Synthesis & Transmission
```text
User enters text/Morse → Sets Character WPM, Pitch (300-1000 Hz), and Farnsworth WPM
        ↓
User clicks "▶ Play" (or "🔊 Test Sidetone")
        ↓
script.js requests MorseEngine.generateAudioSequence(morse, wpm, frequency, farnsworthWpm)
        ↓
Web Audio API plays sine tones (oscillator + gain node with exponential anti-click ramp)
with exact Paris/Farnsworth inter-symbol, inter-character, and inter-word pauses
        ↓
Audio automatically suspends or closes on navigation, pagehide, or tab visibility change
```

### Live Audio Demodulation & Decoding
```text
User clicks "🎤 Start Listening"
        ↓
script.js requests microphone stream via navigator.mediaDevices.getUserMedia()
        ↓
Audio stream routed through BiquadFilterNode (Bandpass Q=6 tuned to target frequency)
        ↓
AnalyserNode computes real-time FFT frequency spectrum (fftSize = 1024)
        ↓
requestAnimationFrame loop samples frequency bins:
  - MorseEngine.isTonePresent detects carrier power vs. threshold
  - MorseEngine.detectPeakFrequency tracks dominant spectral peak
  - Visualizer canvas draws spectrum bars, target carrier line, and threshold line
  - CW carrier LED indicator lights up green during key-down tones
        ↓
State transitions fed into MorseEngine.createMorseStreamDecoder():
  - ON durations classified as dits ('.') or dahs ('-')
  - OFF gaps classified as character breaks (triggering buffer translation) or word spaces
        ↓
Decoded plain text streams into the live output textarea in real time
```

## Key Features

- **Encode text into Morse code** with standard international Morse formatting (`/` for word boundaries).
- **Decode Morse code into plain text** with whitespace normalization and character validation.
- **Synthesize Morse code audio** with adjustable playback speed (5 – 60 WPM).
- **Adjustable CW Sidetone Pitch** spanning 300 Hz to 1000 Hz (default 650 Hz standard sidetone) with a one-click "Test Sidetone" preview.
- **Standard Paris & ARRL Farnsworth Timing Controls** allowing users to practice receiving high-speed characters with elongated spacing between letters and words.
- **Live Microphone / Audio Decoder** capturing ambient CW audio and demodulating it back into plain text in real time.
- **Web Audio AnalyserNode FFT Spectrum Visualizer** displaying live frequency response, detected peak frequency, and threshold level.
- **Carrier Activity Indicator (CW Signal LED)** providing visual key-down status synchronized with incoming signals.
- **Complete Audio Teardown** halting oscillators, cancelling scheduled gain ramps, closing MediaStream tracks, and releasing AudioContext on `pagehide`, `beforeunload`, `unload`, `popstate`, `visibilitychange`, and in-app navigation.

## Technologies Used

- HTML5
- CSS3 (Custom properties, grid, flexbox, keyframe animations)
- Vanilla JavaScript (ES6+ / UMD modular pattern)
- Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`, `BiquadFilterNode`, `AnalyserNode`, `MediaStreamAudioSourceNode`)
- MediaDevices API (`navigator.mediaDevices.getUserMedia`)
- HTML5 Canvas API (2D spectral rendering)
- Clipboard API

## File Responsibilities

### `morseEngine.js`

- `getDitDurationMs(wpm)` — converts words-per-minute to dit duration in milliseconds (clamped 5–60 WPM).
- `calculateTiming(charWpm, farnsworthWpm, frequency)` — computes Paris and ARRL Farnsworth timing parameters (`ditMs`, `dahMs`, `symbolPauseMs`, `charPauseMs`, `wordPauseMs`).
- `textToMorse(text)` — uppercases input and maps each supported character to its Morse symbol.
- `morseToText(morse)` — reverse-maps Morse tokens to characters, treating `/` as a word space.
- `generateAudioSequence(morseStr, wpm, frequency, farnsworthWpm)` — builds an ordered list of tone/pause events using dit, dah, symbol, letter, and word pause timings.
- `classifyPulse(durationMs, ditDurationMs)` — classifies active tone duration as dit (`.`), dah (`-`), or noise glitch (`null`).
- `classifyGap(gapMs, ditDurationMs)` — categorizes silence duration into element pause, character break, or word break.
- `detectPeakFrequency(freqData, sampleRate, minFreq, maxFreq)` — finds dominant frequency with parabolic interpolation.
- `isTonePresent(freqData, sampleRate, targetFreq, bandwidth, threshold)` — detects whether carrier tone exceeds magnitude threshold in the target band.
- `createMorseStreamDecoder(options)` — stateful stream processor converting time-series tone on/off states into streaming text.

### `script.js`

- `encodeText()` — reads plain text and displays encoded Morse code.
- `decodeText()` — reads Morse code tokens and displays plain text.
- `playMorse()` — synthesizes dit/dah beeps with Farnsworth timing and selected pitch via the Web Audio API.
- `testPitch()` — previews a short sidetone beep at current pitch.
- `startListening()` & `stopListening()` — acquires and releases microphone media streams, constructs audio processing graphs, and drives the demodulation loop.
- `processDecoderFrame()` — samples FFT data, updates carrier LED, feeds stream decoder, and renders canvas spectrum.
- `stopAudio(options)` — halts active playback and live decoder, disconnects and stops running nodes, cancels scheduled audio ramps, clears pending timeouts, and closes/suspends `AudioContext`.

### `style.css`

- Dark theme design tokens and responsive grid layouts.
- Synthesis and Farnsworth timing slider cards.
- Live audio decoder panel, status pills, and pulsing microphone listening buttons.
- Real-time CW signal LED with glowing halo effects on active tone detection.
- Audio spectrum visualizer container and responsive layout.

## Design Decisions

- **Engine/UI separation** — all translation, timing, and DSP logic lives in `morseEngine.js` (UMD-wrapped for Node.js tests) while `script.js` manages DOM and Web Audio graphs.
- **Web Audio API synthesis & analysis** — tones are generated with an oscillator rather than pre-recorded audio files; decoding uses native `AnalyserNode` and `BiquadFilterNode` for high efficiency with zero external libraries.
- **Paris Calibration & ARRL Farnsworth Timing** — uses the standard 50-unit "PARIS " calibration word ($1200 / \text{WPM}$) and the ARRL Farnsworth expansion formula $\Delta = (60000/s - 37200/c) / 19$, ensuring authentic amateur radio standards.
- **Hysteresis & Noise Rejection in Audio Decoder** — short pulses under $0.3 \times t_{\text{dit}}$ are rejected as clicks/pops, and narrow bandpass filtering ($Q = 6$) suppresses environmental room noise.
- **Audio lifecycle management & navigation teardown** — audio playback and microphone capture hook into `pagehide`, `beforeunload`, `unload`, `popstate`, `visibilitychange`, and navigation links to immediately stop media stream tracks, oscillators, and close or suspend `AudioContext`.

## Dependencies

None. The project uses only native browser APIs (Web Audio API, MediaDevices API, Canvas API, Clipboard API) and has no external libraries or CDN dependencies.

## Future Improvements

- Download synthesized Morse audio as a WAV file.
- Automatic frequency tracking (AFC) to automatically lock onto drifting CW audio carriers.
- Audio file upload decoder (drag-and-drop CW audio recording to decode).
- Support for Prosigns (e.g., `<AR>`, `<SK>`, `<BT>`).

## Known Limitations

- Live audio decoding requires microphone permissions and works best in moderate acoustic noise environments or with direct line-in audio.
- Audio playback and microphone capture require user interaction to initialize the browser's `AudioContext`.

## Development Notes

- Open `index.html` directly in a browser or via a local server (e.g. `python -m http.server 8000`). No build step is required.
- Unit tests are located in `tests/morse-code-studio.test.js`.
- `morseEngine.js` uses a UMD wrapper so the same file loads via a script tag and via `import`/`require` in Node.js.

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None.

## References

- [MDN Web Docs — Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MDN Web Docs — AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode)
- [MDN Web Docs — BiquadFilterNode](https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode)
- [ARRL — Morse Code Timing and Farnsworth Spacing](https://www.arrl.org/)
- [Morse code — Wikipedia](https://en.wikipedia.org/wiki/Morse_code)
