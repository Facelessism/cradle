# Interactive Periodic Table

An interactive, responsive Periodic Table visualization tool built for exploring elements, chemical properties, electron configurations, state changes across temperature ranges, and visual category highlighting.

---

## Overview

Interactive Periodic Table is a client-side web application for exploring element properties, electron configurations, state changes across temperature variations, and visual element categories. It allows users to search, filter by category, visualize heatmaps, and inspect Bohr electron shell models for all 118 chemical elements.

---

## Purpose & Goals

- Provide an intuitive, interactive periodic table interface with instant search and filtering capabilities.
- Demonstrate real-time state-of-matter calculation across a wide temperature slider (-273°C to 5727°C).
- Render visual representations of Bohr electron orbital configurations using the HTML5 Canvas API.
- Maintain a zero-dependency, self-contained architecture using vanilla HTML, CSS, and JavaScript.

---

## Folder Structure

```text
projects/misc/periodic-table/
├── index.html          # Main HTML entry point, layout structure, control panel, modal markup
├── style.css           # Visual styles, CSS Grid periodic layout, theme tokens, category colors
├── elements.js         # Comprehensive dataset of all 118 chemical elements
├── periodicEngine.js   # Core engine for thermal phase calculations, temperature conversion, shell parsing
├── periodicStorage.js  # Persistence handler for element bookmarks and filter settings
├── script.js           # Table grid rendering, filter handlers, modal interaction, canvas Bohr model
└── ARCHITECTURE.md     # Project architecture documentation
```

---

## System / Project Architecture Overview

The application is structured into three main layers:

1. **Data Layer (`elements.js`)**: Static array of element objects containing physical constants, atomic numbers, electron shell configurations, and summaries.
2. **Engine Layer (`periodicEngine.js`)**: Pure functions for phase state determination, temperature unit conversions, electron configuration string parsing, and search indexing.
3. **Storage Layer (`periodicStorage.js`)**: Manages element bookmarks and user settings in localStorage with in-memory fallback.
4. **Presentation Layer (`index.html`, `style.css`, `script.js`)**: Responsive 18-column grid layout with CSS custom properties for category color coding, glassmorphism styling, and HTML5 Canvas drawing.

---

## Component Breakdown

| File          | Responsibility                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `index.html`  | Page markup, search input, view mode buttons, temperature slider, table container, detail modal         |
| `style.css`   | 18-column CSS grid layout, category color variables, element tile micro-animations, modal styles        |
| `elements.js` | Full dataset of 118 elements with atomic properties, melting/boiling points, and shell arrays           |
| `periodicEngine.js` | Pure calculation engine: phase state, temperature conversion, shell parsing, filtering, stats        |
| `periodicStorage.js` | Bookmark and settings persistence backed by localStorage with an in-memory fallback                  |
| `script.js`   | Grid rendering logic, state-of-matter calculator, search & category filters, canvas Bohr model renderer |

---

## Data Flow / Execution Flow

```text
User opens index.html
        ↓
Browser loads style.css → elements.js → script.js
        ↓
Initialization: category pills rendered, temperature set to 298K
        ↓
Table Grid generated dynamically matching 18 groups and 7 periods + f-block
        ↓
User interacts (types search term, adjusts temperature slider, or clicks category pill)
        ↓
Filter logic evaluates matching elements & updates tile dimming / state indicator dots
        ↓
User clicks an element tile → Modal opens → HTML5 Canvas draws Bohr model for element shells
```

---

## Key Features

- Interactive 118-element periodic table grid layout with IUPAC groupings
- State of matter simulation based on live temperature slider (Kelvin scale)
- Canvas-based dynamic Bohr atomic model visualization inside element modal
- Real-time search and category filtering
- Keyboard shortcuts: `Escape` to close element detail modal
- **Search Elements**: Instant search filtering by element name, chemical symbol, atomic number, or element category.
- **Detailed Properties**: Click any element to view comprehensive property metadata including atomic mass, electron configuration, electronegativity, melting/boiling points, density, discovery year, and summary.
- **Visual Category Highlighting**: Interactive category filter pills highlighting Alkali Metals, Alkaline Earth Metals, Transition Metals, Metalloids, Nonmetals, Halogens, Noble Gases, Lanthanides, and Actinides.
- **Bohr Model Visualizer**: Interactive canvas rendering electron shells and electron distribution for each element.
- **Temperature Slider**: Dynamic state of matter visualization (Solid, Liquid, Gas, Synthetic) calculated in real-time as temperature changes from 0 K (-273°C) up to 6000 K (5727°C).
- **View Modes**: Switch between Standard view, Electronegativity Heatmap, and Atomic Mass Gradient views.

---

## Technologies Used

| Technology         | Purpose                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| HTML5              | Semantic layout, range slider, modal structures, and `<canvas>` element |
| CSS3               | 18-column CSS Grid, Flexbox, custom property design tokens              |
| Vanilla JavaScript | Dynamic DOM manipulation, array filtering, canvas rendering             |

---

## File Responsibilities

### `elements.js`

- Exports `ELEMENTS` array containing 118 element records.
- Exports `CATEGORY_NAMES` mapping category keys to human-readable strings.

### `periodicEngine.js`

- `convertTemperature(value, fromUnit, toUnit)` — converts between Kelvin, Celsius, and Fahrenheit.
- `calculatePhaseState(melt, boil, tempK, phaseAtSTP)` — returns `Solid`, `Liquid`, `Gas`, or `Synthetic` for a given temperature.
- `parseShellElectrons(configStr)` — parses electron configuration strings into per-shell electron counts.
- `filterElements(elements, options)` — filters by search, category, block, and phase.
- `calculateElementStats(elements, tempK)` — tallies solid/liquid/gas/synthetic counts and category distribution.

### `periodicStorage.js`

- `getBookmarkedElements()` / `toggleBookmark(atomicNumber)` / `isBookmarked(atomicNumber)` — bookmark management in localStorage.
- `getSettings()` / `saveSettings(newSettings)` — persist and restore user preferences with defaults.

### `script.js`

- `renderTable()`: Generates tile elements and positions them into grid cells.
- `getElementState(elem, tempK)`: Determines element state at given Kelvin temperature.
- `applyFilters()`: Toggles `.dimmed` and `.highlighted` CSS classes based on active search and category filters.
- `drawBohrModel(shells, symbol)`: Clears canvas and draws atomic nucleus and orbital shells with electron dots.
- `openModal(elem)` / `closeModal()`: Populate and dismiss the element detail modal.

---

## Design Decisions

- **CSS Grid for 18 Groups**: Used `grid-column` and `grid-row` matching standard IUPAC group numbers to place elements without needing empty placeholder elements.
- **HTML5 Canvas for Bohr Models**: Rendered dynamically via canvas rather than inline SVGs to maintain performance and smooth rendering.
- **Zero Build Step**: Ensured full compatibility with standard browser execution via simple script tags.
- **Engine/UI separation**: Pure logic (phase math, parsing, stats) lives in `periodicEngine.js` (UMD-style wrapper, Node.js compatible) while `script.js` handles DOM work.

---

## Dependencies

None. Uses native browser APIs exclusively.

---

## Future Improvements

- Add 3D crystal structure viewer using Three.js.
- Add element isotope breakdown and radioisotope decay chain viewer.
- Add compound builder / reaction calculator.

---

## Known Limitations

- F-block elements (Lanthanides and Actinides) are rendered below the main grid to maintain desktop grid legibility.

---

## Development Notes

- Open `index.html` directly in any web browser, or serve via local web server:
   ```bash
   python -m http.server 8000
   ```
- Navigate to `http://localhost:8000/projects/misc/periodic-table/` in your browser.
- `periodicEngine.js` and `periodicStorage.js` are UMD-style modules that work in both the browser and Node.js for testing.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:**
  - 'Outfit' font by Google Fonts (OFL License)
  - 'JetBrains Mono' font by Google Fonts (OFL License)

---

## References

- [MDN Web Docs — Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [IUPAC Periodic Table](https://iupac.org/what-we-do/periodic-table-of-elements/)
- [Google Fonts](https://fonts.google.com)
