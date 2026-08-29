# Project Architecture

## Overview

Cyberpunk Pixel Art Generator is a canvas-based pixel art editor with a neon cyberpunk aesthetic. It features 6 drawing tools, 48-color cyberpunk palette, layers, effects (neon glow, scanlines, glitch, mirror), undo/redo history, and PNG/JSON export.

Self-contained with no dependencies — vanilla HTML, CSS, and JavaScript.

---

## Purpose & Goals

- Create pixel art with a cyberpunk neon theme
- Provide professional tools (brush, eraser, fill, eyedropper, line, rectangle)
- Support layers for non-destructive editing
- Apply cyberpunk-specific effects (glow, scanlines, glitch, mirror)
- Export as PNG or JSON for sharing and re-importing

---

## Folder Structure

```text
cyberpunk-pixel-art-generator/
├── index.html              # App shell with sidebar, canvas, tools
├── script.js               # Drawing logic, tools, layers, effects, export
├── style.css               # Cyberpunk neon theme, responsive layout
├── ARCHITECTURE.md         # This file
└── thumbnail.svg           # Preview thumbnail
```

---

## Key Features

| Feature | Description |
|---|---|
| **6 Drawing Tools** | Brush, Eraser, Fill Bucket, Eyedropper, Line, Rectangle |
| **Cyberpunk Palette** | 48 neon colors (cyan, magenta, pink, green, yellow, grays) |
| **Custom Color Picker** | Full RGB spectrum via native color input |
| **4 Grid Sizes** | 8×8, 16×16, 32×32, 64×64 |
| **Layer System** | Add/remove/merge layers, visibility toggle |
| **4 Effects** | Neon Glow, Scanlines, Glitch, Mirror X |
| **Undo/Redo** | 50-step history with Ctrl+Z / Ctrl+Y |
| **Export** | PNG (scaled) and JSON (full state) |
| **Import** | Load previously saved JSON files |
| **Keyboard Shortcuts** | B/E/F/I/L/R for tools, Ctrl+Z/Y for history |

---

## Technical Decisions

- **Three canvases**: pixel (data), grid (overlay), preview (line/rect preview)
- **Layer compositing**: bottom-to-top rendering, last visible color wins
- **Flood fill**: iterative stack-based approach (no recursion limits)
- **Bresenham line**: pixel-perfect line drawing algorithm
- **Checker background**: alternating dark pixels for transparency indication
