# Project Architecture — Unit Converter

---

## Overview

Unit Converter is an instant, browser-based tool for converting between units across six
categories: length, weight, temperature, volume, speed, and data storage. It features live
conversion as you type, a swap button, formula display, and a quick-reference table. Runs
entirely in the browser with zero external dependencies.

---

## Purpose & Goals

- Provide fast, accurate unit conversions without loading a search engine
- Cover the most commonly used units across six practical categories
- Show the conversion formula so users understand the math behind the result
- Offer a swap button for quick bidirectional conversion
- Keep the codebase vanilla and dependency-free

---

## Folder Structure

```text
unit-converter/
├── index.html         # Page shell, semantic structure, loads scripts
├── script.js          # Conversion logic, unit data, UI events
├── style.css          # Layout, responsive design, input styling
└── ARCHITECTURE.md    # This file
```

---

## Component Breakdown

| File            | Responsibility                                              |
| --------------- | ----------------------------------------------------------- |
| `index.html`    | Page shell, semantic markup, loads fonts and scripts         |
| `script.js`     | Unit data definitions, conversion engine, swap, UI events   |
| `style.css`     | Layout, input styling, responsive breakpoints               |

---

## Key Features

- Six conversion categories: Length, Weight, Temperature, Volume, Speed, Data Storage
- Live conversion as the user types — no submit button needed
- Swap button to instantly reverse from/to units
- Conversion formula displayed below the inputs
- Quick-reference table showing common conversions for the active category
- Click the result to copy it to clipboard
- Smart number formatting: scientific notation for very large/small numbers
- Fully responsive — stacked layout on mobile

---

## Technologies Used

| Technology             | Purpose                                |
| ---------------------- | -------------------------------------- |
| HTML5                  | Page structure and semantic markup     |
| CSS3 (Grid, Flexbox)   | Layout and responsive design           |
| Vanilla JavaScript     | Conversion logic, unit data, UI events |
| Google Fonts (Outfit)  | UI typography                          |
| Google Fonts (Fira Code)| Monospace number display              |

---

## Design Decisions

- **Factor-based conversion** — most categories use a base-unit factor model (each unit
  stores its factor relative to the base unit), making it trivial to add new units.
  Temperature is the exception and uses explicit conversion functions since it involves
  offsets, not just scaling.
- **No external libraries** — the converter is small enough that a library would add more
  weight than value. Keeping it vanilla makes every line auditable.
- **Smart number formatting** — results use `toFixed(8)` with trailing-zero removal for
  readability, switching to exponential notation for very large or very small values.

---

## Known Limitations

- No reverse lookup ("what unit equals X in another system?")
- No support for obscure or compound units (e.g., N·m, lb·ft)
- No currency conversion (requires live exchange rate data)

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None — all code is original.
