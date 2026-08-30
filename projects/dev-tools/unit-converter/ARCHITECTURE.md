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

## System / Project Architecture Overview

The project follows a simple reactive data model. The `index.html` provides the UI structure and input fields. `script.js` manages the `CATEGORIES` data object, which stores unit factors relative to a base unit for each category. When an input changes, the converter calculates the value by normalizing the input to the base unit and then scaling it to the target unit. Temperature is handled separately via dedicated conversion functions.

---

## Component Breakdown

| File            | Responsibility                                              |
| --------------- | ----------------------------------------------------------- |
| `index.html`    | Page shell, semantic markup, loads fonts and scripts         |
| `script.js`     | Unit data definitions, conversion engine, swap, UI events   |
| `style.css`     | Layout, input styling, responsive breakpoints               |

---

## Data Flow / Execution Flow

```
User selects category or enters value
↓
'input' or 'change' event fires
↓
convert() is called
↓
Value normalized to base unit (Value * Factor_from)
↓
Value scaled to target unit (BaseValue / Factor_to)
↓
Result formatted (exponential or fixed) and displayed in toValue
↓
Formula text updated based on category
↓
renderReference() updates the quick-reference grid
```

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

## File Responsibilities

### `index.html`

- Defines the overall layout and semantic structure.
- Hosts the unit selectors and value inputs.
- Provides containers for the result and formula display.

### `script.js`

- `CATEGORIES`: Stores the mapping of units and their factors.
- `convert()`: The core logic for scaling values between units.
- `convertTemperature()`: Implements offset-based math for temperature.
- `populateUnits()`: Dynamically fills the dropdowns based on the active category.
- `renderReference()`: Generates the a common-conversions table for the user.

### `style.css`

- Implements a responsive grid layout.
- Styles the "active" category tab.
- Uses monospace fonts for numeric results to prevent layout shift.

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

## Dependencies

None (uses native browser APIs).

---

## Future Improvements

- Add more categories (e.g., Pressure, Energy, Torque).
- Implement a search bar for units within a category.
- Add a "history" log of recent conversions.

---

## Development Notes

- The base units are: meter (Length), kilogram (Weight), liter (Volume), m/s (Speed), byte (Data).
- Temperature does not use factors due to the offset between Celsius, Fahrenheit, and Kelvin.

---

## Known Limitations

- No reverse lookup ("what unit equals X in another system?")
- No support for obscure or compound units (e.g., N·m, lb·ft)
- No currency conversion (requires live exchange rate data)

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None — all code is original.

---

## References

- [NIST Guide for the Use of the International System of Units (SI)](https://www.nist.gov/pml/owm/metric-si/guide-si)
