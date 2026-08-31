# Local-First Markdown Knowledge Graph

## Overview
A local-first note-taking application that parses `[[wikilinks]]` from markdown content and renders an interactive, force-directed graph visualization of the connections.

## Purpose & Goals
- Provide a frictionless, serverless way to map interconnected ideas.
- Demonstrate robust IndexedDB usage with graceful in-memory fallbacks.
- Implement a custom, dependency-free force-directed physics engine.

## Folder Structure
```text
knowledge-graph/
├── index.html          # Split-pane UI with markdown editor and graph canvas
├── style.css           # Responsive flexbox layout with dark/light mode support
├── storage.js          # IndexedDB wrapper with Map-based in-memory fallback
├── parser.js           # Regex-based extraction of [[wikilinks]] into node/edge arrays
├── graph-engine.js     # Custom force-directed physics simulation and Canvas 2D renderer
└── ARCHITECTURE.md     # This documentation file
```

## Component Breakdown
| File | Responsibility |
|------|----------------|
| `storage.js` | Manages CRUD operations for notes. Attempts IndexedDB first; if blocked (e.g., private browsing), seamlessly falls back to an in-memory `Map`. |
| `parser.js` | Stateless utility that iterates notes, extracts `[[link]]` patterns, and constructs a unified graph data structure. |
| `graph-engine.js` | Runs a `requestAnimationFrame` loop applying repulsion, spring, and centering forces to nodes. Handles canvas pan/zoom and drag interactions. |

## Data Flow
1. User types in the editor → Debounced input triggers `storage.saveNote()`.
2. `storage` persists the note → `graph-engine.loadData()` fetches all notes.
3. `parser.js` processes notes into `{ nodes, edges }`.
4. `graph-engine` assigns random initial positions to new nodes and begins the physics simulation loop.
5. Canvas renders the transformed (panned/zoomed) graph with colors fetched from CSS variables.

## Technologies Used
- IndexedDB API (with `try/catch` fallback)
- HTML5 Canvas 2D API
- Vanilla ES6+ JavaScript (Async/Await, Classes, Modules)

## Design Decisions
- **Custom Physics Engine**: Avoided heavy libraries like D3.js to keep the prototype lightweight and demonstrate core algorithmic understanding (Verlet-like integration with damping).
- **Debounced Auto-Save**: Prevents excessive IndexedDB writes while typing, triggering a save 1 second after the user stops typing.

## Licensing
MIT License.
