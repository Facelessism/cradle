# Virtual Harp Architecture

## Overview

Virtual Harp is a standalone browser-based instrument that lets users pluck visible harp strings using a keyboard, mouse, or touch input. It uses native browser APIs to generate notes and provides visual feedback whenever a string is played. The project has no external runtime dependencies or build step.

## Purpose & Goals

- Provide a simple playable harp mini project for the Cradle instruments collection.
- Support keyboard, pointer, and touch interaction across desktop and mobile devices.
- Demonstrate browser-native audio generation without external libraries or audio assets.
- Keep the implementation small and easy for contributors to understand and modify.

## Folder Structure

```text
virtual-harp/
├── index.html          # Semantic page structure and controls
├── script.js           # String generation, interaction, and audio behaviour
├── style.css           # Harp layout, visuals, animation, and responsive styling
└── ARCHITECTURE.md     # Project architecture and development documentation
```

## System / Project Architecture Overview

The project follows a simple separation of concerns. `index.html` provides the page structure and accessibility labels, `style.css` controls the harp's appearance and responsive layout, and `script.js` creates the strings, handles keyboard/pointer interaction, updates the UI, and generates audio with the Web Audio API. The browser loads the files directly, so no framework or build process is required.

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Page shell, title, note display, controls, and containers for the harp. |
| `script.js` | String definitions, DOM generation, keyboard/pointer events, visual feedback, and Web Audio synthesis. |
| `style.css` | Layout, harp frame, string appearance, pluck animation, controls, and mobile responsiveness. |
| `ARCHITECTURE.md` | Documents the project's structure, behaviour, decisions, and limitations. |

## Data Flow / Execution Flow

```text
User opens index.html
↓
Browser loads style.css and script.js
↓
JavaScript creates the visible harp strings from the string definitions
↓
Event listeners are attached to each string and to keyboard input
↓
User clicks/touches a string or presses A–K
↓
The matching string is identified and the pluck animation starts
↓
The note display and status text are updated
↓
Web Audio API creates a short synthesized tone
```

## Key Features

- Eight visible playable harp strings mapped to notes C4 through C5.
- Keyboard controls using A, S, D, F, G, H, J, and K.
- Pointer interaction that works with mouse and touch input.
- Native Web Audio API tone generation with no audio files.
- Visual string animation and current-note feedback after each pluck.
- Sound on/off control.
- Responsive layout for smaller screens.
- Accessible button labels and live status updates.

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Semantic structure, controls, and accessibility attributes. |
| CSS3 | Responsive layout, visual styling, and pluck animation. |
| Vanilla JavaScript (ES6+) | Interaction logic, DOM updates, and event handling. |
| Web Audio API | Real-time synthesis of harp notes in the browser. |
| Pointer Events API | Unified mouse and touch interaction. |

## File Responsibilities

### `index.html`

- Defines the application shell and semantic sections.
- Provides the note display, keyboard instructions, sound toggle, and status region.
- Loads `style.css` and `script.js`.

### `script.js`

- Stores the harp string keys, note names, and frequencies.
- Dynamically creates accessible string buttons.
- Handles `pointerdown` events for mouse and touch interaction.
- Handles keyboard events for A–K controls.
- Applies and removes the pluck animation class.
- Creates oscillator and gain nodes for synthesized notes.
- Updates the current note, status message, and mute state.

### `style.css`

- Defines the harp card, frame, base, and string layout.
- Styles hover and pluck states for strings.
- Provides responsive behaviour for smaller screens.
- Styles the controls, note display, and status feedback.

## Design Decisions

- **Vanilla JavaScript:** Keeps the mini project dependency-free and easy for contributors to understand.
- **Web Audio API:** Generates notes in real time without storing or loading third-party audio files.
- **Pointer Events:** A single `pointerdown` handler supports both mouse and touch interaction.
- **Dynamic strings:** String buttons are generated from one data array so note/key mappings remain consistent and easy to extend.
- **Accessible controls:** Strings are buttons with descriptive `aria-label` values, while note and status changes use live regions for feedback.

## Dependencies

None. The project uses native HTML, CSS, JavaScript, and browser APIs only. No npm package, CDN library, external font, image, or audio asset is required at runtime.

## Future Improvements

- Add more strings and additional octaves.
- Add a more realistic plucked-string synthesis model.
- Add visual pitch labels or optional keyboard hints on each string.
- Add optional recording and playback of a short sequence.

## Known Limitations

- The synthesized tone is an approximation and is not a sampled acoustic harp recording.
- Audio playback depends on browser support for the Web Audio API and normal browser audio policies.
- Only the mapped A–K keyboard keys trigger notes.

## Development Notes

- No build step is required; the project can be opened through the Cradle project environment or a local static web server.
- The first user interaction creates/resumes the browser audio context when necessary.
- After changing HTML, CSS, or JavaScript, refresh the project in the browser to test the changes.
- Test keyboard, mouse, and touch interactions separately when making interaction changes.

## License & Attribution

- **Project License:** MIT, following the Cradle repository licensing terms.
- **Third-Party Assets:** None. No external images, audio, fonts, or code assets are included.

## References

- [MDN Web Docs — Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — browser audio synthesis reference.
- [MDN Web Docs — Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) — unified pointer input reference.
