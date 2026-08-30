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

## Component Breakdown

| File            | Responsibility                                          |
| --------------- | ------------------------------------------------------- |
| `index.html`    | Page shell, semantic markup, loads fonts and scripts    |
| `script.js`     | Gradient CSS generation, stop CRUD, presets, UI events  |
| `style.css`     | Layout, colors, responsive breakpoints                  |

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

## Design Decisions

- **Sorted stops for CSS output** — color stops are sorted by position before generating
  the CSS string to guarantee a valid gradient, regardless of the order the user adds them.
- **Angle card hidden for radial** — the angle/direction controls are hidden when radial
  is selected since radial gradients don't use an angle, keeping the UI clean.
- **Preset as full state replacement** — clicking a preset replaces the entire stop list
  and angle, matching the user's expectation of "starting fresh" with a curated look.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None — all code is original.
