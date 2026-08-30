# Sound Wave Visualizer

A real-time audio visualization tool that records microphone input and displays a live waveform, frequency spectrum (FFT) and scrolling spectrogram — all built with the Web Audio API and Canvas 2D.

---

## Overview

Sound Wave Visualizer records microphone input and renders three real-time visualisations: a waveform, a frequency spectrum (FFT), and a scrolling spectrogram. It is built entirely with native browser APIs — Web Audio, MediaRecorder, and Canvas 2D — and needs no server infrastructure. Recordings can be replayed and downloaded directly in the browser.

---

## Purpose & Goals

- Demonstrate real-time audio processing using the Web Audio API's `AnalyserNode`
- Provide three complementary visualisation modes (waveform, spectrum, spectrogram) in one interface
- Allow users to record, replay and download microphone audio without any server infrastructure
- Keep the codebase self-contained so contributors can understand it in a single session

---

## How to Use

1. Open the page in a browser and click **Record** — allow microphone access when prompted
2. Speak, play music, or make any sound — all three visualisations update in real time
3. Click **Stop** (or the Record button again) to end the recording
4. Use **Play** to replay the recording or **Download** to save it
5. Adjust **FFT Size**, **Smoothing**, **Gain**, and **Color Scheme** at any time

---

## Folder Structure

```
sound-wave-visualizer/
├── index.html            # App shell, canvas elements, controls, recordings list
├── style.css             # Full dark-theme styling and responsive layout
├── visualizerEngine.js   # Canvas frequency spectrum calculations and peak detection
├── audioPresetsEngine.js # Synth audio presets and frequency calculations
├── script.js             # All logic: audio graph, canvas rendering, recording, playback
└── ARCHITECTURE.md       # This file
```

---

## System / Project Architecture Overview

The project has a single-file JavaScript architecture centred on the Web Audio API graph:

```mermaid
graph TD
    MIC[Microphone getUserMedia] --> SRC[MediaStreamSource]
    SRC --> GAIN[GainNode]
    GAIN --> AN[AnalyserNode]
    AN --> DEST[AudioContext Destination]
    AN -->|getByteTimeDomainData| WV[Waveform Canvas]
    AN -->|getByteFrequencyData| SP[Spectrum Canvas]
    AN -->|getByteFrequencyData| SG[Spectrogram Canvas]
    MIC --> MR[MediaRecorder]
    MR --> BLOB[Blob / ObjectURL]
    BLOB --> PB[Audio Playback]
    BLOB --> DL[Download]
```

- **Audio graph** is assembled once on first record; `GainNode` and `AnalyserNode` settings are updated live from the UI controls.
- **Animation loop** (`requestAnimationFrame`) reads `Uint8Array` buffers from the `AnalyserNode` and repaints all three canvases 60 fps.
- **MediaRecorder** runs in parallel, collecting audio chunks into a `Blob` for download or in-browser playback.
- **Helper modules** (`visualizerEngine.js`, `audioPresetsEngine.js`) are UMD-style engines with Node.js-compatible exports for calculation utilities and synth presets.

---

## Component Breakdown

| File         | Responsibility                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| `index.html` | App structure: header, control bar, settings row, three canvas panels, recordings list                      |
| `style.css`  | Design tokens, button styles, visualiser grid (2-col), recording rows, status pill animations               |
| `script.js`  | Audio graph, waveform / spectrum / spectrogram draw functions, MediaRecorder, playback, timer, event wiring |
| `visualizerEngine.js` | Peak-level detection, log frequency-band grouping, radial bar math                                |
| `audioPresetsEngine.js` | Synth tone presets (sine/square/sawtooth/triangle) and note-to-frequency math                     |

---

## Data Flow / Execution Flow

```
User opens index.html
        ↓
Browser loads style.css → script.js
        ↓
init() — canvases sized, idle placeholder drawn, status = "Ready"
        ↓
User clicks Record
        ↓
getUserMedia() → MediaStreamSource → GainNode → AnalyserNode
MediaRecorder.start() begins collecting audio chunks
        ↓
requestAnimationFrame loop fires every frame (~16ms)
        ↓
getByteTimeDomainData → drawWaveform()
getByteFrequencyData  → drawSpectrum()
getByteFrequencyData  → drawSpectrogram() (scrolling left by 1px each frame)
        ↓
User clicks Stop
        ↓
MediaRecorder.stop() → ondataavailable → Blob → ObjectURL
Recording entry pushed to `recordings` array → renderRecordings()
        ↓
User clicks Play / Download on a recording row
```

---

## Key Features

- **Live Waveform** — Oscilloscope-style amplitude-over-time display with RMS dB readout
- **Frequency Spectrum** — Real-time FFT bar chart with peak-frequency detection
- **Spectrogram** — Scrolling time-frequency heatmap showing how sound evolves
- **Recording & Playback** — Record sessions via the microphone and replay them in the browser
- **Download** — Save recordings as WebM/OGG audio files
- **Adjustable FFT Size** — 512 / 1024 / 2048 / 4096 bins for resolution vs. performance trade-off
- **Smoothing & Gain controls** — Fine-tune the analyser's temporal smoothing and input gain
- **5 Color Themes** — Cyan, Violet, Amber, Green and Rainbow

---

## Technologies Used

- **Web Audio API** (`AudioContext`, `AnalyserNode`, `GainNode`, `MediaStreamSource`)
- **MediaDevices API** (`getUserMedia`)
- **MediaRecorder API** (recording + download)
- **Canvas 2D API** (all visualisations)
- **CSS3** (Grid, Custom Properties, Animations)
- **Vanilla JavaScript (ES6+)** (All logic; no dependencies)
- **Google Fonts** (Outfit, JetBrains Mono)

---

## File Responsibilities

#### `script.js`

- `initAudio()` — Creates `AudioContext`, `AnalyserNode`, `GainNode`, wires graph
- `startRecording()` / `stopRecording()` — `getUserMedia` + `MediaRecorder` lifecycle
- `finalizeRecording()` — Assembles `Blob` from chunks, creates `ObjectURL`, pushes to `recordings`
- `drawWaveform(data)` — Oscilloscope with RMS dB using `getByteTimeDomainData`
- `drawSpectrum(data, bufferLength)` — FFT bar chart with magnitude-to-colour gradient
- `drawSpectrogram(data, bufferLength)` — Shifts canvas image left by 1 px, draws new column
- `playRecording(id)` / `stopPlayback()` / `togglePlayback(id)` — `Audio` element playback
- `renderRecordings()` — Generates HTML list of recording rows with event listeners
- `resizeCanvases()` — Responsive canvas sizing via `ResizeObserver`
- `hslToRgb()`, `blendColors()`, `lerp()` — Colour math utilities
- `getPeakLevel(dataArray)` — delegates to `VisualizerEngine.calculatePeakLevel` when available

#### `visualizerEngine.js`

- `calculatePeakLevel(dataArray)` — returns the peak amplitude normalized to 0-1
- `calculateFrequencyBands(freqData, numBands)` — groups FFT bins into log-spaced bands
- `calculateRadialBar(index, total, radius, amplitude, cx, cy)` — computes radial bar coordinates

#### `audioPresetsEngine.js`

- `getPresets()` — returns synth tone presets (A4 sine, A3 square, A5 sawtooth, E4 triangle)
- `calculateFrequencyFromNote(noteNumber)` — MIDI note number to frequency (A4 = 440 Hz)

#### `style.css`

- `.status-dot.recording` — CSS `pulse-red` animation for live recording indicator
- `.vis-panel.wide` — spans full two-column grid width (spectrogram)
- `.bar-column` — FFT bars; coloured by JS via `fillStyle` per-draw
- `@keyframes pulse-red` / `pulse-green` — status dot glow animations

---

## Design Decisions

- **Shared `AnalyserNode` for all three visualisations** — A single `getByteTimeDomainData` and `getByteFrequencyData` call per frame feeds all canvases, avoiding redundant reads.
- **Spectrogram as image-shift** — Using `getImageData` / `putImageData` to shift the spectrogram canvas left by 1 pixel is the canonical, efficient approach for scrolling spectrograms without clearing the whole canvas each frame.
- **`MediaRecorder` runs alongside the audio graph** — Decoupled from `AnalyserNode`; the `MediaStream` is split into two branches: one for analysis, one for recording.
- **No external visualisation library** — Raw Canvas 2D keeps the project dependency-free and makes the rendering logic fully transparent to contributors.
- **`ResizeObserver` instead of `window.resize`** — More accurate for responsive canvas sizing when the parent container changes width due to layout shifts.

---

## Dependencies

None. The project uses only native browser APIs:

- **Web Audio API** (`AudioContext`, `AnalyserNode`, `GainNode`, `MediaStreamSource`)
- **MediaDevices API** (`getUserMedia`)
- **MediaRecorder API** (recording + download)
- **Canvas 2D API** (all visualisations)

External fonts (Outfit, JetBrains Mono) are loaded from Google Fonts for styling only and are not runtime logic dependencies.

---

## Future Improvements

- Beat / BPM detection using onset detection on the frequency data
- Note detection overlay using pitch detection (autocorrelation or YIN algorithm)
- Save spectrogram as a PNG screenshot
- Custom frequency-band highlighting (e.g. bass, mid, treble zones)
- Noise gate / threshold-triggered recording to skip silence

---

## Known Limitations

- Requires HTTPS or `localhost` — `getUserMedia` is blocked on insecure origins
- Recording format depends on browser support; typically WebM/Opus in Chromium, OGG in Firefox
- All recordings are in-memory only — refreshing the page clears them
- Spectrogram resolution is tied to canvas pixel width; very narrow viewports reduce time fidelity
- No audio processing (noise reduction, echo cancellation) is applied beyond the browser's default

---

## Development Notes

This project uses `getUserMedia` which requires a secure context (HTTPS or localhost).

```bash
# Using Python's built-in server
python3 -m http.server 8000
# Then open: http://localhost:8000/projects/misc/sound-wave-visualizer/
```

> ⚠️ Do **not** open `index.html` by double-clicking — the `file://` protocol blocks microphone access.

- No build step required. Edit files and refresh the browser.
- On Chromium, inspect the audio graph in `chrome://webrtc-internals` or DevTools → Media panel.
- `visualizerEngine.js` and `audioPresetsEngine.js` are UMD-style modules that also load in Node.js for testing.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:**
  - 'Outfit' font by Google Fonts (OFL License)
  - 'JetBrains Mono' font by Google Fonts (OFL License)

---

## References

- [MDN Web Docs — Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MDN Web Docs — AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode)
- [MDN Web Docs — MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [MDN Web Docs — getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
