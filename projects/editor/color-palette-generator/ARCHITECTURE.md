# Project Architecture — Color Palette Generator

---

## Overview

Color Palette Generator is an interactive browser-based tool for creating harmonious color palettes
from a single base color. It features a perceptual **OKLCH Color Harmony Engine** alongside standard HSL,
an automated **$N \times N$ WCAG 2.1 Contrast Matrix**, live accessibility contrast previewing, per-swatch locking,
and multi-format export to Tailwind CSS, CSS Custom Properties (`:root`), Figma Design Tokens JSON, JSON, and SCSS.
It runs entirely in the browser with zero external dependencies.

---

## Purpose & Goals

- Provide designers and engineers with mathematically harmonious color palettes calculated in the perceptually uniform OKLCH color space.
- Eliminate perceptual brightness distortion inherent to legacy RGB/HSL models where different hues with the same "lightness" appear radically different in brightness to the human eye.
- Offer automated pairwise $N \times N$ WCAG 2.1 AA/AAA contrast analysis across all palette color combinations to guarantee accessibility compliance across UI states.
- Export production-ready design tokens and configs for Figma (W3C Design Token Community Group standard), Tailwind CSS, and modern CSS custom properties.
- Keep the codebase vanilla (no frameworks, zero dependencies) for high maintainability, performance, and portability.

---

## Folder Structure

```text
color-palette-generator/
├── index.html         # Page shell, semantic structure, control cards, matrix view
├── script.js          # OKLCH/HSL math, harmony presets, NxN contrast matrix, export, UI
├── style.css          # Layout, color engine switch, contrast matrix grid, responsive styling
└── ARCHITECTURE.md    # Architecture and mathematical specification
```

---

## System / Project Architecture Overview

The project follows a clean separation of concerns:
- `index.html` provides the accessible page structure, color engine selector, harmony controls, palette display, $N \times N$ matrix grid, and export tabs.
- `style.css` handles the design system, frosted-glass card containers, responsive matrix scrolling, WCAG compliance badges (`AAA`, `AA`, `AA Large`, `Fail`), and focus states.
- `script.js` encapsulates pure mathematical transformations (sRGB $\leftrightarrow$ linear sRGB $\leftrightarrow$ LMS $\leftrightarrow$ Oklab $\leftrightarrow$ OKLCH), harmonic preset calculations, $N \times N$ matrix evaluation, export serialization, and stale-closure-immune DOM controllers.

### Mathematical Specification: OKLCH Color Space

OKLCH is the cylindrical representation of the Oklab color space designed by Björn Ottosson (2020). Unlike HSL where yellow ($H = 60^\circ$) appears dramatically brighter than blue ($H = 240^\circ$) at identical $L$ values, OKLCH aligns with human visual perception:

1. **sRGB to Linear sRGB**:
   For normalized channel $V \in \{R, G, B\} / 255$:
   $$V_{\text{lin}} = \begin{cases} \frac{V}{12.92} & \text{if } V \le 0.04045 \\ \left(\frac{V + 0.055}{1.055}\right)^{2.4} & \text{otherwise} \end{cases}$$

2. **Linear sRGB to Approximate Cone Responses (LMS)**:
   $$\begin{bmatrix} l \\ m \\ s \end{bmatrix} = \begin{bmatrix} 0.4122214708 & 0.5363325363 & 0.0514459929 \\ 0.2119034982 & 0.6806995451 & 0.1073969566 \\ 0.0883024619 & 0.2817188376 & 0.6299787005 \end{bmatrix} \begin{bmatrix} r_{\text{lin}} \\ g_{\text{lin}} \\ b_{\text{lin}} \end{bmatrix}$$

3. **Cube Root Non-Linearity**:
   $$l' = \sqrt[3]{l}, \quad m' = \sqrt[3]{m}, \quad s' = \sqrt[3]{s}$$

4. **LMS to Oklab ($L, a, b$)**:
   $$\begin{bmatrix} L \\ a \\ b \end{bmatrix} = \begin{bmatrix} 0.2104542553 & 0.7936177850 & -0.0040720468 \\ 1.9779984951 & -2.4285922050 & 0.4505937099 \\ 0.0259040371 & 0.7827717662 & -0.8086757660 \end{bmatrix} \begin{bmatrix} l' \\ m' \\ s' \end{bmatrix}$$

5. **Oklab to Cylindrical OKLCH ($L, C, H$)**:
   $$C = \sqrt{a^2 + b^2}, \quad H = \left(\operatorname{atan2}(b, a) \times \frac{180}{\pi} + 360\right) \bmod 360$$

6. **Inverse Transformation (OKLCH to sRGB)**:
   Performs polar conversion ($a = C \cos H, b = C \sin H$), computes inverse $M_2^{-1}$, cubes $l', m', s'$, multiplies by $M_1^{-1}$, and applies the sRGB gamma transfer function with range clamping to $[0, 255]$.

---

## Component Breakdown

| File         | Responsibility                                                                 |
| ------------ | ------------------------------------------------------------------------------ |
| `index.html` | Page structure, semantic controls, engine toggle, matrix table, export tabs    |
| `script.js`  | OKLCH color conversions, harmony presets, pairwise contrast matrix, export, UI |
| `style.css`  | Layout, matrix styling, interactive hover/active states, responsive design     |

---

## Data Flow / Execution Flow

```
User selects base color, harmony mode, or color engine (OKLCH / HSL)
↓
Event listener triggers renderPalette()
↓
generatePalette(hex, mode, engine) converts hex to OKLCH (L, C, H)
↓
Applies mathematical harmony offsets (Analogous, Monochromatic, Triadic, Tetradic, Split-Comp)
↓
Clamps to sRGB gamut and merges with user-locked swatches
↓
DOM updated with swatches displaying HEX, OKLCH, and RGB
↓
computeContrastMatrix(palette) computes all N x N (5x5) pairwise WCAG ratios & ratings
↓
renderContrastMatrix() renders interactive table with AAA/AA/Large/Fail badges
↓
User clicks any matrix cell to instantly test that pair in the live preview
↓
updateExport() updates Tailwind, Figma DTCG Tokens, CSS, JSON, and SCSS code displays
```

---

## Key Features

- **OKLCH Perceptual Color Engine**: Mathematically uniform perceived lightness and chroma transitions across hues.
- **Harmonic Presets**: Analogous, Monochromatic, Triadic, Tetradic, Split-Complementary, and Complementary.
- **Automated $N \times N$ WCAG 2.1 Contrast Matrix**: Real-time $5 \times 5$ grid evaluating contrast ratios between every background and foreground combination.
- **WCAG Compliance Badging**: Immediate classification of AAA ($\ge 7.0:1$), AA ($\ge 4.5:1$), AA Large ($\ge 3.0:1$), and Fail ($< 3.0:1$).
- **Click-to-Preview Matrix Integration**: Selecting any cell immediately loads that color combination into the live accessibility preview.
- **Multi-Format Export Presets**:
  - CSS Custom Properties (`:root` with hex and `oklch(...)`).
  - Tailwind CSS `theme.extend.colors.palette` configuration.
  - Figma Design Tokens JSON (W3C DTCG format with `$value` and `$type: "color"`).
  - JSON color object with hex, RGB, HSL, and OKLCH.
  - SCSS variables and `$palette` map.
- **Per-Swatch Locking**: Lock specific palette slots while regenerating remaining swatches.
- **Stale-Closure Immune Event Delegation**: Swatch and matrix cell interactions resolve color values dynamically from live DOM attributes.

---

## Technologies Used

| Technology               | Purpose                                    |
| ------------------------ | ------------------------------------------ |
| HTML5                    | Semantic structure and accessible markup   |
| CSS3 (Grid, Flexbox)     | Responsive layout, matrix styling, badges  |
| Vanilla JavaScript (ES6) | OKLCH color math, matrix calculations, UI  |
| Google Fonts (Outfit)    | UI typography                              |
| Google Fonts (Fira Code) | Monospace code, hex, and OKLCH displays    |

---

## File Responsibilities

### `index.html`

- Structural layout, navigation, and semantic HTML5 hierarchy.
- Input controls for base color (native color picker + hex text input), harmony mode selectors, and color space engine switch.
- Swatch grid container, $N \times N$ contrast matrix table, live preview area, and export tab buttons.

### `script.js`

- `srgbToLinear()`, `linearToSrgb()`, `rgbToOklch()`, `oklchToRgb()`, `hexToOklch()`, `oklchToHex()`: Exact color space conversion pipeline.
- `generateOklchPalette()`: OKLCH perceptual harmony preset generation.
- `generateHslPalette()`: Legacy HSL harmony calculation.
- `computeContrastMatrix()`: Evaluates pairwise WCAG 2.1 contrast ratios and compliance ratings for all combinations.
- `formatExport()`: Formats active palette into CSS Custom Properties, Tailwind, Figma Design Tokens, JSON, and SCSS.
- Browser DOM event listeners, matrix click handlers, and clipboard operations.

### `style.css`

- Modern dark theme typography and responsive card grid.
- Engine toggle button styling and active glow highlights.
- Contrast matrix table formatting, sticky header alignment, cell hover rings, and active pair highlight.
- Accessible badge styles (`.badge-aaa`, `.badge-aa`, `.badge-large`, `.badge-fail`).

---

## Design Decisions

- **Perceptually Uniform Transitions**: Utilizing OKLCH ensures that shifting hue does not create unintentional lightness spikes or drops (common with HSL).
- **Gamut Clamping with Chroma Scaling**: When shifting lightness in monochromatic palettes, chroma is smoothly attenuated near pure white ($L=1$) and pure black ($L=0$) to prevent out-of-gamut clipping artifacts.
- **Pairwise Matrix Symmetry**: The matrix displays both $(i, j)$ and $(j, i)$ since background vs foreground text readability depends on which color is applied to text vs background.
- **Zero Third-Party Dependencies**: No external libraries are needed; all matrix and color math algorithms are native and lightweight.

---

## Dependencies

None (uses standard web APIs: `HTMLCanvasElement`, `CSSStyleDeclaration`, `Clipboard API`, and native ES6 math).

---

## Future Improvements

- Gamut mapping visualizer indicating which OKLCH coordinates fall outside sRGB vs P3 gamut.
- Color blindness simulation filters (Protanopia, Deuteranopia, Tritanopia) applied across the matrix.
- Export to Adobe Swatch Exchange (.ase) format.

---

## Known Limitations

- Palettes are held in session memory; browser reload resets to defaults (can be augmented with localStorage in future iterations).
- High-chroma colors are clamped to standard sRGB monitors.

---

## Development Notes

- OKLCH conversions use the D65 standard illuminant and 2.4 gamma power curve for sRGB transfer.
- Contrast calculations strictly adhere to WCAG 2.1 relative luminance:
  $$L_{\text{rel}} = 0.2126 R + 0.7152 G + 0.0722 B$$
  $$\text{Ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}$$

---

## License & Attribution

- **Project License:** MIT
- **Color Space Model:** Oklab color space by Björn Ottosson (2020)
- **Accessibility Standard:** W3C WCAG 2.1 Success Criteria 1.4.3 & 1.4.6

---

## References

- [WCAG 2.1 Contrast (W3C)](https://www.w3.org/TR/WCAG21/#contrast-minimum)
- [A perceptual color space for image processing — Björn Ottosson](https://bottosson.github.io/posts/oklab/)
- [CSS Color Module Level 4 — OKLCH](https://www.w3.org/TR/css-color-4/#specifying-oklab-oklch)
- [W3C Design Tokens Community Group Specification](https://design-tokens.github.io/community-group/format/)
