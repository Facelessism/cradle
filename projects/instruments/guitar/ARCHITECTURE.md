# Architecture — Virtual Guitar

## 1. Overview

The Virtual Guitar is a browser-based guitar simulator built using **HTML, CSS, and vanilla JavaScript**.

Users can:

- Play guitar strings
- Select different frets
- Play notes using the keyboard, mouse, or touch
- Strum multiple strings
- Change the volume
- See which strings are currently active
- View the guitar strings extending from the neck to the bridge

The project is divided into four simple parts:

1. **HTML** — Creates the guitar and controls.
2. **CSS** — Controls the guitar's appearance and responsive layout.
3. **JavaScript** — Handles user interaction and connects the UI to the audio engine.
4. **Audio Engine** — Generates guitar sounds using the Web Audio API.
5. **SVG String Overlay** — Draws the strings between the neck and bridge.

---

## 2. Project Structure

```text
virtual-guitar/
│
├── index.html
├── style.css
├── script.js
├── guitarEngine.js
└── stringOverlay.js