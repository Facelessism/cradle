# Project Architecture — CSS Gradient Generator

---

## Overview

CSS Gradient Generator is an interactive browser tool for building linear, radial, and conic
CSS gradients visually. Users add, remove, and reposition color stops, adjust the angle or
direction, pick from preset gradients, and copy the generated CSS to their clipboard. It runs
entirely in the browser with zero external dependencies.

---

## Purpose & Goals

- Remove guesswork from CSS gradient creation with a live visual preview
- Support all three CSS gradient types (linear, radial, conic)
- Provide one-click copy of production-ready CSS code
- Offer curated presets for common gradient styles
- Remain vanilla (no frameworks) for fast iteration and easy contribution

---

## Folder Structure

```text
css-gradient-generator/
├── index.html         # Page shell, UI structure, loads scripts
├── script.js          # Gradient logic, stop management, presets, UI events
├── style.css          # Layout, visual styling, responsive design
└── ARCHITECTURE.md    # This file
```

---

## System / Project Architecture Overview

The project uses a reactive state-driven approach. The state consists of the `gradientType` (linear, radial, or conic), the `angle` of the gradient, and an array of `stops` containing color and position. `script.js` listens for input changes and immediately regenerates the CSS string using `buildGradientCSS()`, which is then applied to the preview box and the code output block.

---

## Component Breakdown

| File            | Responsibility                                          |
| --------------- | ------------------------------------------------------- |
| `index.html`    | Page shell, semantic markup, loads fonts and scripts    |
| `script.js`     | Gradient CSS generation, stop CRUD, presets, UI events  |
| `style.css`     | Layout, colors, responsive breakpoints                  |

---

## Data Flow / Execution Flow

```
User modifies angle, type, or color stop
↓
Event listener calls update()
↓
buildGradientCSS() sorts stops by position
↓
CSS string constructed based on gradientType (linear/radial/conic)
↓
previewBox.style.background is updated
↓
buildCSSOutput() wraps the gradient in a .gradient CSS class
↓
codeBlock.textContent is updated for the user to copy
```

---

## Key Features

- Three gradient types: linear, radial, conic
- Add / remove / reorder color stops with inline hex picker and position input
- Angle slider with numeric input and directional preset buttons
- 12 curated gradient presets applied with one click
- Randomize button for instant inspiration
- Live preview box with smooth CSS transitions
- Generated CSS block with one-click copy
- Fully responsive — works on desktop, tablet, and mobile

---

## Technologies Used

| Technology             | Purpose                                |
| ---------------------- | -------------------------------------- |
| HTML5                  | Page structure and semantic markup     |
| CSS3 (Grid, Flexbox)   | Layout and responsive design           |
| Vanilla JavaScript     | Gradient logic, stop management, UI   |
| Google Fonts (Outfit)  | UI typography                          |
| Google Fonts (Fira Code)| Monospace code display                |

---

## File Responsibilities

### `index.html`

- Defines the layout and the three-pane structure (controls, preview, output).
- Provides input hooks for angle, type, and stop management.

### `script.js`

- `buildGradientCSS()`: The core engine that converts state (type, angle, stops) into a valid CSS string.
- `renderStops()`: Dynamically builds the UI for the color stops list.
- `update()`: Synchronizes the current state with the preview and code block.
- `renderPresets()`: Implements the one-click preset application logic.

### `style.css`

- Handles the styling of the stop rows and the angle card.
- Implements the "active" state for gradient type buttons.
- Ensures the preview box is centered and responsive.

---

## Design Decisions

- **Sorted stops for CSS output** — color stops are sorted by position before generating
  the CSS string to guarantee a valid gradient, regardless of the order the user adds them.
- **Angle card hidden for radial** — the angle/direction controls are hidden when radial
  is selected since radial gradients don't use an angle, keeping the UI clean.
- **Preset as full state replacement** — clicking a preset replaces the entire stop list
  and angle, matching the user's expectation of "starting fresh" with a curated look.

---

## Dependencies

None (uses native browser APIs).

---

## Future Improvements

- Add support for multi-stop linear gradients with complex angles.
- Implement a visual "color stop" slider for repositioning colors.
- Add export options for other formats (e.g., SVG, Canvas).

---

## Development Notes

- Stop positions are clamped between 0 and 100.
- Conic gradients use the `from {angle}deg` syntax for rotation.

---

## Known Limitations

- Radial gradients are limited to a center circle without offset support.
- No support for complex CSS gradient functions like `repeating-linear-gradient`.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None — all code is original.

---

## References

- [MDN Web Docs — CSS Gradients](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS-gradients)