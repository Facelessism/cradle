# Project Architecture

## Overview

Unit Circle Explorer is an interactive math visualizer featuring a draggable unit circle with real-time trigonometric values, reference angle visualization, and key angle presets.

Self-contained with no dependencies — vanilla HTML, CSS, and JavaScript using Canvas 2D.

---

## Purpose & Goals

- Visualize the unit circle with interactive angle control
- Display all 6 trigonometric functions in real-time
- Show reference angles and coordinate projections
- Provide quick access to common angles (30°, 45°, 60°, etc.)

---

## Folder Structure

```text
unit-circle-explorer/
├── index.html          # Canvas + values panel layout
├── script.js           # Canvas rendering, trig calculations, interaction
├── style.css           # Dark theme, trig bars, responsive
├── ARCHITECTURE.md     # This file
└── thumbnail.svg       # Preview thumbnail
```

---

## Key Features

| Feature | Description |
|---|---|
| **Interactive Canvas** | Click or drag to set angle, touch support |
| **6 Trig Functions** | sin, cos, tan, csc, sec, cot with visual bars |
| **Reference Angles** | Dashed lines showing cos/sin projections |
| **Angle Slider** | Gradient rainbow slider for precise control |
| **Key Angle Presets** | 16 common angles (0°-360°) with one-click selection |
| **Quadrant Indicator** | Shows current quadrant (I-IV) |
| **Coordinate Display** | (cos θ, sin θ) point on circle |
| **Keyboard Control** | Arrow keys for ±5°, Shift+Arrow for ±15° |
| **Toggle Options** | Degrees/radians, reference angles, key angle labels |
| **Snap to Key Angle** | Snaps to nearest common angle |

---

## Technical Decisions

- **Canvas 2D**: All rendering via canvas for smooth 60fps interaction
- **HiDPI support**: `devicePixelRatio` scaling for crisp rendering on retina
- **Inverted Y**: Canvas y-axis is inverted; math y = -canvas y
- **Infinite values**: tan/csc/cot show "∞" or "—" when undefined
- **Touch events**: Full touch support for mobile drag interaction
