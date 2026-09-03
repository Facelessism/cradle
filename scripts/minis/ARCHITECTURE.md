# Project Architecture

## Overview

Cradle is a collection of small browser-based projects, experiments, games,
tools, visualizations, productivity utilities, and interactive instruments.

The projects are organized under the `projects/` directory by category.
The mini build system provides one consistent way to discover and prepare
these projects while allowing each mini to remain appropriately simple.

The build system supports three models: static minis, individually bundled
minis, and centrally managed minis.

---

## Purpose & Goals

The mini build architecture exists to:

- Provide one consistent build entry point for all Cradle minis.
- Automatically discover minis under `projects/`.
- Avoid duplicating build configuration across small projects.
- Avoid installing unnecessary dependencies for static projects.
- Allow projects that genuinely need bundling to opt into it.
- Keep existing mini folder structures unchanged.
- Make build behaviour explicit and predictable.
- Provide a scalable foundation for future minis.

---

## Folder Structure

```text
Cradle/
├── projects/
│   ├── aiml/
│   │   ├── ai-circuit-builder/
│   │   ├── image-classifier/
│   │   └── neural-network-playground/
│   │
│   ├── dev-tools/
│   │   ├── api-response-inspector/
│   │   ├── browser-storage-inspector/
│   │   ├── color-contrast-checker/
│   │   ├── cpu-emulator/
│   │   ├── css-clamp-calculator/
│   │   ├── css-grid-generator/
│   │   ├── encoding-toolkit/
│   │   ├── feature-flag-playground/
│   │   ├── json-converter/
│   │   ├── json-tree-viewer/
│   │   ├── regex-visualizer/
│   │   ├── text-diff-checker/
│   │   ├── unit-converter/
│   │   └── url-parser/
│   │
│   ├── editor/
│   ├── file-tools/
│   ├── games/
│   ├── instruments/
│   ├── math/
│   ├── misc/
│   └── productivity/
│
├── scripts/
│   └── minis/
│       ├── discover.mjs
│       ├── build.mjs
│       ├── config.mjs
│       └── utils.mjs
│
├── minis.config.json
├── package.json
├── ARCHITECTURE.md
├── ARCHITECTURE_TEMPLATE.md
├── README.md
├── index.html
├── script.js
└── style.css