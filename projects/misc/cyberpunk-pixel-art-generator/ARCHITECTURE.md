# Project Architecture — Cyberpunk Pixel Art Generator

---

## Overview

The Cyberpunk Pixel Art Generator is a specialized canvas-based pixel art editor designed with a neon cyberpunk aesthetic. It provides a suite of professional drawing tools, a curated neon palette, and layer-based editing, allowing users to create themed pixel art and export it as PNG or JSON.

The project is built using vanilla HTML, CSS, and JavaScript, focusing on a high-performance canvas rendering pipeline.

---

## Purpose & Goals

- Enable the creation of pixel art within a themed cyberpunk environment
- Provide essential drawing tools (brush, eraser, flood fill, line, rectangle)
- Implement a non-destructive layer system for complex compositions
- Offer thematic effects (glow, scanlines, glitch) to enhance the "cyberpunk" feel
- Ensure data persistence through JSON import/export and high-quality PNG output

---

## Folder Structure

```text
├── index.html              # App shell with sidebar, canvas, and tool panels
├── script.js               # Core editor logic, drawing tools, layers, and effects
├── style.css               # Cyberpunk neon theme and responsive UI layout
├── thumbnail.svg           # Project preview artwork
└── ARCHITECTURE.md         # This file
```

---

## System / Project Architecture Overview

The application uses a triple-canvas architecture to separate concerns and optimize rendering. The `pixelCanvas` stores the actual pixel data and handles the final composite. The `gridOverlay` provides a static visual guide for the user. The `previewCanvas` allows for real-time visualization of shapes (lines/rectangles) before they are committed to a layer. The state is managed centrally in `script.js`, tracking the active tool, color, and a stack of layers containing 2D arrays of color values.

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Defines the layout including the toolbars, layer list, and the three-canvas stack |
| `script.js` | Implements drawing algorithms (Bresenham, Flood Fill), layer management, and effects |
| `style.css` | Implements the "neon" aesthetic using CSS variables, glow effects, and a dark theme |

---

## Data Flow / Execution Flow

```
User interacts with the canvas (MouseDown -> MouseMove -> MouseUp)
↓
getGridPos() converts screen coordinates to pixel grid coordinates
↓
Depending on the currentTool:
    ↳ Brush/Eraser: setPixel() updates the active layer's 2D array
    ↳ Line/Rect: previewCanvas renders the shape in real-time
    ↳ Fill: floodFill() iteratively updates matching neighboring pixels
↓
renderCanvas() is called
    ↳ Clears the canvas
    ↳ Draws the checkerboard transparency background
    ↳ Composites all visible layers from bottom to top
↓
saveState() pushes the current layer data to the undoStack
```

---

## Key Features

- **Layer-Based Editing**: Supports multiple layers with visibility toggles and merging capabilities.
- **Specialized Drawing Tools**: Includes an iterative flood-fill algorithm and a Bresenham-based line tool.
- **Thematic Effects**: 
  - **Neon Glow**: Spreads color to neighboring pixels with adjusted brightness.
  - **Scanlines**: Darkens every second row to simulate a CRT monitor.
  - **Glitch**: Randomly offsets horizontal segments of the image.
  - **Mirror X**: Symmetrically copies the left half of the canvas to the right.
- **State Management**: A 50-step undo/redo history allows for non-destructive experimentation.
- **Flexible Export**: Exports can be scaled PNGs or full-state JSON files for re-importing.

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Layout and canvas elements |
| CSS3 | Neon theme, grid layout, and responsive design |
| JavaScript (ES6+) | Editor logic, algorithmic drawing, and state management |
| Canvas 2D API | Pixel-level rendering and compositing |

---

## File Responsibilities

### `index.html`

- Houses the tool selection buttons and the layer management list.
- Integrates the custom color picker and grid size selectors.

### `script.js`

- `setPixel()`: Updates a specific coordinate in the active layer's data.
- `floodFill()`: Implements a stack-based fill algorithm to avoid recursion limits.
- `drawLine()` / `drawRect()`: Implements shape drawing algorithms.
- `applyNeonGlow()` / `applyGlitch()`: Implements pixel-manipulation effects.
- `renderCanvas()`: Handles the composite rendering of the layer stack.

### `style.css`

- Uses CSS filters and box-shadows to create the neon glow effect for the UI.
- Defines the layout for the toolbars and the responsive canvas wrapper.

---

## Design Decisions

- **2D Array State**: Stored as `layers[i].data[y][x]` for direct, fast access to pixel colors.
- **Triple Canvas**: Used to avoid redrawing the grid or calculating previews on the main data canvas, improving performance.
- **Iterative Flood Fill**: Used a stack-based approach instead of recursion to prevent "Maximum call stack size exceeded" errors on larger grid sizes.
- **Bresenham's Algorithm**: Chosen for the line tool to ensure pixel-perfect lines without gaps.

---

## Dependencies

None (uses native browser APIs).

---

## Future Improvements

- Support for variable brush shapes.
- Implementation of a "bucket" tool for selective color replacement.
- Addition of a custom palette manager.

---

## Development Notes

- The canvas size is dynamically adjusted based on the `getCanvasSize()` function to fit the available screen area.
- The checkerboard background is rendered every frame to indicate transparency.

---

## Known Limitations

- Large grid sizes (e.g., 64x64) may increase the memory footprint of the undo stack.
- Effects are applied destructively to the current layer's data.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None.

---

## References

- [Bresenham's Line Algorithm](https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm)
- [MDN Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)
