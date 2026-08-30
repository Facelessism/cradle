# Virtual Piano — Architecture

## 1. Overview

The Virtual Piano is a standalone interactive musical instrument mini for Cradle.

The project provides a playable piano keyboard that supports:

- Mouse interaction on desktop
- Touch interaction on mobile devices
- Computer keyboard interaction
- Real-time note highlighting
- Synthesized piano notes using the Web Audio API
- Responsive piano layout
- Accessible keyboard controls
- Reusable and testable piano logic

The project does not require a frontend framework or external audio library.

projects/instruments/piano/
├── index.html
├── script.js
├── style.css
├── pianoEngine.js
├── thumbnail.svg
└── ARCHITECTURE.md

The implementation is divided into separate responsibilities:

```text
                    ┌──────────────────────┐
                    │       index.html      │
                    │   Semantic UI / DOM   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │       script.js      │
                    │   Browser Controller  │
                    └───────┬───────┬──────┘
                            │       │
              ┌─────────────┘       └──────────────┐
              ▼                                    ▼
    ┌──────────────────────┐             ┌──────────────────────┐
    │    pianoEngine.js    │             │    Web Audio API     │
    │ Piano / Note Logic   │             │    Audio Playback    │
    └──────────────────────┘             └──────────────────────┘
              │
              ▼
    ┌──────────────────────┐
    │    Piano Data        │
    │ Notes / Frequencies  │
    │ Keyboard Mappings    │
    └──────────────────────┘

                    ┌──────────────────────┐
                    │       style.css     │
                    │   Layout / Styling   │
                    └──────────────────────┘

                    ┌──────────────────────┐
                    │     thumbnail.svg    │
                    │    Project Artwork   │
                    └──────────────────────┘


