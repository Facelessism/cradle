# Project Architecture — Unit Circle Explorer

---

## Overview

The Unit Circle Explorer is an interactive mathematical visualization tool designed to help users explore the relationship between angles and trigonometric functions. It features a draggable unit circle that provides real-time calculations for the six primary trigonometric functions.

The project is built using vanilla HTML, CSS, and JavaScript, utilizing the Canvas 2D API for smooth, high-performance rendering.

---

## Purpose & Goals

- Provide a visual and intuitive way to understand the unit circle
- Calculate and display real-time values for sin, cos, tan, csc, sec, and cot
- Visualize reference angles and their projections on the x and y axes
- Offer a set of common angle presets for quick reference (e.g., 30°, 45°, 60°)
- Enable precise angle control via both direct canvas interaction and an input slider

---

## Folder Structure

```text
unit-circle-explorer/
├── index.html          # Main layout, canvas element, and value panels
├── script.js           # Rendering logic, trig calculations, and event handling
├── style.css           # Visual styling, dark theme, and responsive layout
├── thumbnail.svg       # Project preview artwork
└── ARCHITECTURE.md     # This file
```

---

## System / Project Architecture Overview

The project follows a unidirectional data flow centered around the `angleDeg` state. User interactions (dragging the canvas, using the slider, or clicking preset buttons) update the `angleDeg` value. This state change triggers two primary processes: `render()`, which updates the visual representation on the canvas, and `updateValues()`, which calculates the trigonometric results and updates the DOM elements.

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Defines the canvas surface and the panels for displaying trig values and controls |
| `script.js` | Manages the state, handles canvas drawing, calculates trig values, and manages user events |
| `style.css` | Handles the layout, including the side panels and the "trig bars" visualization |

---

## Data Flow / Execution Flow

```
User interacts (Drag Canvas / Slider / Preset Button)
↓
update angleDeg state
↓
call render()
    ↳ Clear canvas
    ↳ Draw axes and unit circle
    ↳ Calculate (x, y) coordinates using cos/sin
    ↳ Draw radius line and reference angle projections
    ↳ Render angle arc and point
↓
call updateValues()
    ↳ Calculate 6 trig functions based on angleDeg
    ↳ Update text content of value displays
    ↳ Adjust widths of visual "trig bars"
    ↳ Determine and highlight the current quadrant (I-IV)
```

---

## Key Features

- **Interactive Canvas**: High-performance 60fps rendering with support for mouse and touch dragging.
- **Comprehensive Trig Suite**: Real-time calculation of all six trigonometric functions, including handling of undefined values (∞).
- **Visual Projections**: Dashed lines that automatically show the reference angle and its projections on the axes.
- **Precision Controls**: A combination of a rainbow-gradient slider and a numeric input for exact angle setting.
- **Key Angle Presets**: One-click access to the most common angles used in trigonometry.
- **Quadrant Tracking**: Visual indication of which quadrant the current angle resides in.

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | UI structure and canvas element |
| CSS3 | Styling, layouts, and responsive design |
| JavaScript (ES6+) | State management, math calculations, and canvas rendering |
| Canvas 2D API | High-performance 2D graphics rendering |

---

## File Responsibilities

### `index.html`

- Provides the structure for the canvas-panel and the values-panel.
- Contains the controls for toggling degrees/radians and reference angles.

### `script.js`

- `render()`: Handles all drawing operations on the canvas, including HiDPI scaling.
- `updateValues()`: Computes trig functions and updates the DOM.
- `getAngleFromEvent()`: Converts mouse/touch coordinates into an angle in degrees.
- `getRefAngle()`: Calculates the reference angle for the current position.

### `style.css`

- Implements a professional dark theme.
- Defines the layout for the "trig bars," which visually represent the magnitude of sin and cos.

---

## Design Decisions

- **Canvas 2D over SVG**: Chosen for better performance when redrawing the entire scene every frame during drags.
- **HiDPI Scaling**: Implemented `devicePixelRatio` scaling to ensure the circle and lines look crisp on retina displays.
- **Coordinate Transformation**: Adjusted the canvas Y-axis (which is inverted) to match standard mathematical coordinates.
- **State-Driven Rendering**: Used a simple `setAngle()` function as the single entry point for all state changes to ensure the UI is always in sync.

---

## Dependencies

None (uses native browser APIs).

---

## Future Improvements

- Support for plotting multiple angles for comparison.
- Implementation of a "trace" mode to show the path of a point over time.
- Addition of a detailed explanation for each trig function.

---

## Development Notes

- The canvas size is dynamically calculated based on the available panel space to ensure it remains centered and visible.
- All calculations use radians internally, as required by `Math.sin` and `Math.cos`.

---

## Known Limitations

- The "infinite" values for tangent, secant, and cotangent are handled via a small epsilon check (`1e-10`) rather than exact zero.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None.

---

## References

- [MDN Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)
- [Trigonometry Fundamentals](https://en.wikipedia.org/wiki/Trigonometry)
