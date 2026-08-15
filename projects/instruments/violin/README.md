# Virtual Violin

A standalone playable virtual violin mini for Cradle.

## Features

- Four visible violin strings: G, D, A and E.
- Keyboard play with `A`, `S`, `D`, `F`.
- Mouse and touch interaction.
- Fingerboard movement produces higher notes.
- Browser-native Web Audio API sound generation.
- Volume control with local persistence.
- Cradle-compatible light/dark theme.
- Responsive layout with no horizontal scrolling.
- No build step and no runtime dependencies.

## Run

Open `index.html` directly, or serve the repository with a local static server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/projects/instruments/
```

## Controls

| Input | Action |
| --- | --- |
| `A` | G string |
| `S` | D string |
| `D` | A string |
| `F` | E string |
| Pointer/touch | Play and move along a string |
| Volume slider | Adjust output volume |

## Implementation

The mini uses CSS for the violin illustration and the Web Audio API for lightweight procedural sound. See `ARCHITECTURE.md` for the design and extension points.
