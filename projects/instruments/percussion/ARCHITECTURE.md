# Virtual Percussion Set — Architecture

## 1. Overview

The Virtual Percussion Set is a standalone interactive musical instrument mini
for Cradle, following the same structure as `projects/instruments/piano`.

The project provides a playable 8-pad percussion set that supports:

- Mouse interaction on desktop
- Touch interaction on mobile devices (multi-touch, one hit per pointer)
- Computer keyboard interaction
- Real-time pad highlighting
- Synthesized drum/cymbal sounds using the Web Audio API
- Responsive pad grid layout
- Accessible keyboard controls
- Reusable and testable percussion logic

The project does not require a frontend framework or external audio samples.

```text
projects/instruments/percussion/
├── index.html
├── script.js
├── style.css
├── percussionEngine.js
├── thumbnail.svg
└── ARCHITECTURE.md
```

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
    │ percussionEngine.js  │             │    Web Audio API     │
    │  Pad / Sound Logic   │             │    Audio Playback    │
    └──────────────────────┘             └──────────────────────┘
              │
              ▼
    ┌──────────────────────┐
    │   Percussion Data    │
    │  Pads / Key Mappings │
    └──────────────────────┘

                    ┌──────────────────────┐
                    │       style.css     │
                    │   Layout / Styling   │
                    └──────────────────────┘

                    ┌──────────────────────┐
                    │     thumbnail.svg    │
                    │    Project Artwork   │
                    └──────────────────────┘
```

## 2. Pads

| Pad | Key | Sound synthesis |
| --- | --- | --- |
| Kick | Q | Sine oscillator, pitch envelope 150→45 Hz |
| Snare | W | Filtered noise burst + triangle tone |
| Closed Hi-Hat | E | Short high-passed noise |
| Open Hi-Hat | R | Long high-passed noise |
| Low Tom | A | Sine oscillator, pitch envelope 150→70 Hz |
| High Tom | S | Sine oscillator, pitch envelope 260→120 Hz |
| Clap | D | Three staggered band-passed noise bursts |
| Crash | F | Long high-passed noise decay |

## 3. Notes

No third-party audio samples are used — every sound is synthesized at play
time with the Web Audio API, so there's nothing to attribute or license.