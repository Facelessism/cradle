# Real-time Audio Spectrogram Analyzer

## Overview
A web utility that captures audio input (microphone or file), processes it in real-time using the Web Audio API, and renders a scrolling time-frequency heatmap (spectrogram) while offering local recording capabilities.

## Purpose & Goals
- Demonstrate real-time audio processing and visualization in the browser.
- Provide a visually appealing, high-performance canvas rendering of frequency data.
- Ensure graceful degradation if microphone permissions are denied.

## Folder Structure
```text
audio-spectrogram-analyzer/
├── index.html          # Entry point with controls, canvas, and error banner
├── style.css           # Responsive styling with dark/light mode and colormap legend
├── audio-processor.js  # Web Audio API setup, AnalyserNode, and stream routing
├── visualizer.js       # Canvas 2D scrolling heatmap renderer with custom colormap
├── recorder.js         # MediaRecorder integration and main application controller
└── ARCHITECTURE.md     # This documentation file
```

## Component Breakdown
| File | Responsibility |
|------|----------------|
| `audio-processor.js` | Manages the `AudioContext`, handles `getUserMedia` or file loading, and routes the audio signal to both the speakers and a `MediaStreamDestination` for recording. |
| `visualizer.js` | Runs a `requestAnimationFrame` loop. Shifts the existing canvas image left and draws a new vertical slice of color-mapped frequency data on the right edge. |
| `recorder.js` | Binds UI events, initializes the `MediaRecorder` with the processor's destination stream, and handles the blob download on stop. |

## Data Flow
1. User clicks "Start Microphone" → `audio-processor.js` requests permissions and creates an `AnalyserNode`.
2. `visualizer.js` starts its animation loop, calling `analyser.getByteFrequencyData()` every frame.
3. The frequency array (0-255) is mapped to a custom "Magma" colormap (generated in JS) and drawn as a 2px wide vertical strip on the canvas.
4. If "Start Recording" is clicked, `recorder.js` attaches a `MediaRecorder` to the `audio-processor`'s destination stream, capturing the exact audio being visualized.
5. On "Stop", the recorded chunks are combined into a Blob and downloaded as a `.webm` file.

## Technologies Used
- Web Audio API (`AudioContext`, `AnalyserNode`, `MediaStreamAudioSourceNode`)
- MediaRecorder API
- HTML5 Canvas 2D API (Image manipulation for scrolling effect)
- Vanilla ES6+ JavaScript

## Design Decisions
- **Custom Colormap**: Instead of relying on CSS gradients (which are hard to map to 1D frequency arrays), a precomputed `Uint8ClampedArray` colormap is used for O(1) color lookup during the high-frequency render loop.
- **Scrolling via Canvas Shift**: The visualizer draws the previous frame shifted by 2px, then draws the new column. This is more performant than redrawing the entire history buffer every frame.

## Licensing
MIT License.
