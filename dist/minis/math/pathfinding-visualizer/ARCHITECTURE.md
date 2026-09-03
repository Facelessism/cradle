# Pathfinding Algorithm Visualizer

## Overview
An interactive web-based tool to visualize and compare classic pathfinding algorithms (A*, Dijkstra, BFS) on a customizable 2D grid.

## Purpose & Goals
- Demonstrate how different algorithms explore a graph.
- Provide an intuitive, interactive UI for drawing walls and observing step-by-step traversal.
- Maintain high performance and accessibility using vanilla JS and CSS animations.

## Folder Structure
```text
pathfinding-visualizer/
├── index.html          # Entry point with control UI and grid container
├── style.css           # Responsive styling with light/dark mode support
├── app.js              # Main controller, event listeners, and animation loop
├── grid.js             # Grid state management and DOM rendering logic
├── algorithms.js       # Pure functions for BFS, Dijkstra, and A* logic
└── ARCHITECTURE.md     # This documentation file
```

## Component Breakdown
| File | Responsibility |
|------|----------------|
| `app.js` | Orchestrates user input, triggers algorithms, and manages `setTimeout`-based animation sequencing. |
| `grid.js` | Maintains the 2D array of node objects, handles mouse drag events for wall placement, and resets state. |
| `algorithms.js` | Contains stateless algorithmic implementations that return ordered arrays of visited nodes and the final shortest path. |

## Data Flow
1. User interacts with the grid (mousedown/mouseover) → `grid.js` updates node `isWall` state and CSS classes.
2. User clicks "Visualize" → `app.js` calls the selected algorithm from `algorithms.js`.
3. Algorithm returns `{ visitedNodesInOrder, shortestPathNodes }`.
4. `app.js` iterates through `visitedNodesInOrder`, applying the `.visited` CSS class with a delay based on the speed selector.
5. Finally, `shortestPathNodes` are animated with the `.path` class.

## Technologies Used
- HTML5, CSS3 (Custom Properties for theming, CSS Grid, Keyframe animations)
- Vanilla ES6+ JavaScript (Modules, Async/Await for animation control)

## Design Decisions
- **DOM over Canvas**: Used CSS Grid and DOM nodes for cells to leverage native CSS transitions (`animation: pop`) for a smoother, more accessible visual feedback without complex canvas redraw logic.
- **Stateless Algorithms**: Algorithm functions do not mutate the grid directly beyond setting `previousNode` and `isVisited`, making them easy to test and swap.

## Licensing
MIT License. No third-party assets used.
