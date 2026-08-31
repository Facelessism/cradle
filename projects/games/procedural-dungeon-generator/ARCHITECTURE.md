# Procedural Dungeon Generator

## Overview
A tool that generates randomized, tile-based dungeon layouts using the Binary Space Partitioning (BSP) algorithm, rendered visually on an HTML5 Canvas.

## Purpose & Goals
- Demonstrate procedural content generation (PCG) techniques.
- Provide adjustable parameters (size, room size, seed) for experimentation.
- Ensure the generator is deterministic when a seed is provided.

## Folder Structure
```text
procedural-dungeon-generator/
├── index.html          # Entry point with parameter controls and canvas
├── style.css           # Responsive styling with light/dark mode tile colors
├── generator.js        # BSP logic, room creation, and corridor carving
├── renderer.js         # Canvas 2D drawing logic with CSS variable color mapping
├── controller.js       # UI event binding and application orchestration
└── ARCHITECTURE.md     # This documentation file
```

## Component Breakdown
| File | Responsibility |
|------|----------------|
| `generator.js` | Contains the `BSPNode` class and `DungeonGenerator`. Handles recursive splitting, room placement, L-shaped corridor connection, and seeded RNG. |
| `renderer.js` | Reads the 2D array map and draws colored rectangles on the canvas. Dynamically fetches colors from CSS variables to support dark/light mode. |
| `controller.js` | Gathers input values, instantiates the generator and renderer, and triggers the generation pipeline. |

## Data Flow
1. User clicks "Generate" or loads page → `controller.js` reads input values.
2. `controller.js` instantiates `DungeonGenerator` with parameters.
3. `generator.js` initializes a wall-filled 2D array, recursively splits the space via BSP, carves rooms, and connects them.
4. The resulting 2D array (0=Floor, 1=Wall, 2=Start, 3=End) is passed to `renderer.js`.
5. `renderer.js` iterates the array, determines tile colors (including dynamic door detection), and draws to the Canvas.

## Technologies Used
- HTML5 Canvas 2D API
- Vanilla ES6+ JavaScript (Classes, Modules)
- CSS Custom Properties for theming

## Design Decisions
- **Seeded RNG**: Implemented a simple Linear Congruential Generator (LCG) to ensure that providing the same seed produces the exact same dungeon, which is crucial for debugging and sharing layouts.
- **Door Detection**: Instead of explicitly placing door tiles during generation, the renderer infers doors by checking if a floor tile has specific wall adjacencies, keeping the generator logic cleaner.

## Licensing
MIT License.
