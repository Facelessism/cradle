# Project Architecture

---

## Overview

AI Circuit Builder is an AI based project to help user build circuit as per their needs. It provides various customizable parameters which can be used to create a circuit.

---

## Purpose & Goals

- Allow user to create custom circuit builder as per their need
- Provide area to compare previous designs
- Automatic creation of circuit from user need

---

## Folder Structure

```text
ai-circuit-builder/
├── index.html          # Entry point and UI shell
├── script.js           # Core logic and event handling
├── style.css           # All visual styling
└── Architecture.md     # Description of whole project
```

---

## System / Project Architecture Overview

User decides on the various design parameters available via the UI. The circuit builder builds circuit as per the requirements and displays it on the webpage

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | UI of the project and loads scripts |
| `script.js` | Handles logic of the project and loading of the model |
| `style.css` | Layout, colours, animations, responsive design |

---

## Data Flow / Execution Flow

```

User opens index.html

        ↓

User decides on the parameters of their circuit

        ↓

PPA computed and circuit displayed

        ↓

User can compare it with their previous designs

```

---

## Key Features

- Customizable design parameters
- Comparision of previously designed circuits
- Provides storage for chip storage

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Page structure and semantic markup |
| CSS3 | Layout and responsive design |
| JavaScript | Circuit metrics calculation and canvasing  |

---

## File Responsibilities

### `index.html`

- User interface for image classification
- Displays prediction

### `script.js`

- Handles PPA calculation
- Design generation
- Storing of Circuit
- Structural comparision of circuit

### `style.css`

- Adding style to the webpage

---

## Design Decisions

- **Client-side PPA estimation** — `calculatePPA()` approximates power, die area, and TOPS throughput from the selected process node, core count, frequency, architecture, and design goal using simplified semiconductor scaling formulas, so results are computed entirely in the browser with no backend.
- **Procedural floorplan rendering** — `drawCircuitDiagram()` draws the chip layout (core grid, L3 cache, interconnect bus) on a canvas based on the current configuration rather than using pre-made images.
- **LocalStorage vault and comparison** — designs are persisted under `neuralforge_projects` and the comparison matrix under `neuralforge_comparison` so users can reload, restore, and compare previous designs.
- **No runtime AI model** — despite the "AI-powered" branding, PPA metrics and diagrams are generated procedurally in JavaScript, keeping the app dependency-light.

---

## Dependencies

| Dependency | Version | How loaded | Purpose |
|---|---|---|---|
| Outfit (font) | - | Google Fonts CDN | UI typography |

---

## Future Improvements

- User friendly guide on how to use this project and its various parameters

## Known Limitations

- PPA estimates are approximations from simplified scaling formulas, not results from real semiconductor EDA tools.
- The floorplan canvas draws at most 32 core modules even when more cores are configured.
- Saving a design with an existing project name overwrites the earlier entry.
- No actual AI model performs design synthesis; generation is rule-based.

---

## Development Notes

- Open index.html through a local server (e.g. `python3 -m http.server 8000`), not by double-clicking the file. The file:// protocol blocks Web Workers and some fetch calls.
- Visit (`http://localhost:8000`)

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:**
  - Tailwind CSS (CDN `<script>` tag) — utility-first CSS framework
  - Font Awesome 6.6.0 (CDN via cdnjs) — UI icons

---

## References

- [Tailwind CSS](https://tailwindcss.com) — utility-first CSS framework used for the interface
- [Font Awesome](https://fontawesome.com) — icon set used across the UI
- [MDN Web Docs — Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) — procedural floorplan rendering
