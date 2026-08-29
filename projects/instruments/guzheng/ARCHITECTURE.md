# Virtual Guzheng — Architecture

## 1. Overview

The Virtual Guzheng is a standalone interactive musical instrument mini for
Cradle, following the same structure as `projects/instruments/piano`.

The project provides a playable 21-string guzheng that supports:

- Mouse interaction on desktop (click, or drag across strings to glissando)
- Touch interaction on mobile devices (tap or swipe)
- Computer keyboard interaction
- Real-time string highlighting on pluck
- Synthesized plucked-string tones using the Web Audio API
- Responsive string layout
- Accessible keyboard controls
- Reusable and testable string logic

The project does not require a frontend framework or external audio samples.

```text
projects/instruments/guzheng/
├── index.html
├── script.js
├── style.css
├── guzhengEngine.js
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
    │  guzhengEngine.js    │             │    Web Audio API     │
    │ String / Pluck Logic │             │    Audio Playback    │
    └──────────────────────┘             └──────────────────────┘
              │
              ▼
    ┌──────────────────────┐
    │    Guzheng Data      │
    │ Strings / Frequencies│
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
```

## 2. Tuning

21 strings tuned to the D major pentatonic scale (D, E, F♯, A, B), spanning
roughly 4 octaves — the standard pentatonic tuning used on a real guzheng, so
any combination of strings played together stays consonant.

## 3. Interaction model

- **Click / tap** a string to pluck it once.
- **Drag / swipe** across multiple strings (mouse held down, or touch) to
  glissando — implemented via `document.elementFromPoint` on `pointermove`,
  plucking each newly-entered string once.
- **Keyboard** keys `1234567890qwertyuiop[` map to the 21 strings low to
  high, mirroring the on-screen `<kbd>` labels.

## 4. Notes

No third-party audio samples are used — every pluck is synthesized at play
time with the Web Audio API (harmonic series + a short noise transient for
the pluck attack), so there's nothing to attribute or license.