# Project Architecture — Color Palette Generator

---

## Overview

Color Palette Generator is an interactive browser-based tool for creating harmonious color palettes
from a single base color. It supports six harmony modes, WCAG contrast checking, per-swatch locking,
and palette export to CSS variables, Tailwind config, SCSS, and JSON. It runs entirely in the browser
with zero external dependencies.

---

## Purpose & Goals

- Provide designers and developers with a fast, visual way to create consistent color palettes
- Offer real-time WCAG contrast analysis to ensure accessibility compliance
- Export palettes in the most common formats used in modern front-end projects
- Keep the codebase vanilla (no frameworks) so contributors of all levels can understand it

---

## Folder Structure

```text
color-palette-generator/
├── index.html         # Page shell, semantic structure, loads scripts
├── script.js          # Color math, palette generation, contrast checks, export, UI
├── style.css          # Layout, colors, responsive design
└── ARCHITECTURE.md    # This file
```

---

## System / Project Architecture Overview

The project follows a clean separation of concerns: `index.html` provides the page
structure, `style.css` handles all visual styling and responsive layout, and `script.js`
owns all behaviour — color math, palette generation, WCAG contrast checking, export
formatting, and event handling. There is no build step; the browser loads files directly.

---

## Component Breakdown

| File            | Responsibility                                                     |
| --------------- | ------------------------------------------------------------------ |
| `index.html`    | Page shell, semantic structure, loads scripts and fonts            |
| `script.js`     | Color math utilities, palette engine, contrast checker, export, UI |
| `style.css`     | Layout, colours, animations, responsive design                     |

---

## Data Flow / Execution Flow

```
User picks base color or harmony mode
↓
Event listener triggers renderPalette()
↓
generatePalette() computes new HSL values based on mode
↓
Merge with locked colors (lockedIndices Set)
↓
DOM updated with new swatches
↓
updateExport() generates code for current format (CSS/Tailwind/JSON/SCSS)
↓
User clicks swatch for contrast check
↓
runContrastCheck() computes luminance and ratio
↓
UI updated with AA/AAA pass/fail badges
```

---

## Key Features

- Base color picker with hex input and random color button
- Six harmony modes: Complementary, Analogous, Triadic, Split-Complementary, Tetradic, Monochromatic
- Five generated swatches per palette with lock/unlock per swatch
- Click a swatch to apply its color to the WCAG contrast checker
- WCAG contrast ratio display with AA, AA-Large, and AAA pass/fail badges
- Live preview block showing selected background + foreground combination
- Export to CSS custom properties, Tailwind config, SCSS variables, or JSON
- Copy-to-clipboard button with toast confirmation
- Fully responsive layout (desktop, tablet, mobile)

---

## Technologies Used

| Technology             | Purpose                              |
| ---------------------- | ------------------------------------ |
| HTML5                  | Page structure and semantic markup   |
| CSS3 (Grid, Flexbox)   | Layout and responsive design         |
| Vanilla JavaScript     | Color math, palette logic, UI events |
| Google Fonts (Outfit)  | UI typography                        |
| Google Fonts (Fira Code) | Monospace code and hex displays    |

---

## File Responsibilities

### `index.html`

- Defines the structural layout.
- Provides input fields for base color and harmony mode selection.
- Hosts the palette grid and contrast results area.

### `script.js`

- `generatePalette()`: Core engine that calculates harmonic colors using HSL.
- `contrastRatio()`: Implements WCAG 2.x luminance-based contrast formulas.
- `renderPalette()`: Manages DOM updates and handles the locking mechanism.
- `updateExport()`: Maps the current palette to various developer-friendly formats.

### `style.css`

- Styles the swatch grid and individual swatches.
- Implements the "active" state for harmony buttons.
- Uses a responsive grid to adapt from desktop to mobile.

---

## Design Decisions

- **No external libraries** — color math is implemented from scratch using HSL conversions to keep the project self-contained and zero-dependency.
- **Lock-per-swatch model** — locking individual swatches lets users iterate on part of a palette without losing work, a common workflow in design tools.
- **Alternating contrast checker** — clicking a palette swatch alternates between setting foreground and background so users can quickly compare two palette colors.

---

## Dependencies

None (uses native browser APIs).

---

## Future Improvements

- Integration with a color-blindness simulator to preview palettes.
- Ability to save palettes to `localStorage` for persistence across sessions.
- Import from image via canvas sampling.

---

## Development Notes

- The palette generation logic relies on rotating the Hue (H) in HSL space.
- Contrast calculations follow the standard WCAG relative luminance formula.

---

## Known Limitations

- No palette save/load to localStorage (colors reset on refresh)
- No image-to-palette extraction (would require canvas analysis)
- No drag-to-reorder swatches

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None — all code is original.

---

## References

- [WCAG 2.1 Contrast (W3C)](https://www.w3.org/TR/WCAG21/#contrast-minimum)
- [MDN Web Docs — HSL Color](https://developer.mozilla.org/en-US/docs/Web/API/CSS/color_value#hsl)
