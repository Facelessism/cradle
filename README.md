# Cradle ⟵⁠(⁠o⁠_⁠O⁠)

[![Tests](https://github.com/Facelessism/cradle/actions/workflows/test.yml/badge.svg)](https://github.com/Facelessism/cradle/actions/workflows/test.yml)

A personal collection of small ideas, experiments, and geeky projects I'm exploring and building.

## What this repository contains

Cradle is a repository for my small ideas, experiments and lightweight prototypes. It contains runnable demos, maybe eventually some short technical notes and utility scripts intended for rapid iteration and learning.

## Each project folder includes

- an `ARCHITECTURE.md` describing the goal, architecture, and how to run or test it,
- minimal dependency manifest (`requirements.txt`, `package.json` etc.)
- example usage or quick demo scripts if possible.

## Project Structure

```bash
Cradle/
│
├── data/
│   └── projects.json
│
├── projects/
│   ├── aiml/                  # AI & Machine Learning prototypes
│   ├── dev-tools/             # Developer utilities & code formatters
│   ├── editor/                # Creative design & document generation tools
│   ├── file-tools/            # File processing & metadata analyzers
│   ├── games/                 # Interactive browser & arcade games
│   ├── math/                  # Mathematical visualizations & algorithms
│   ├── misc/                  # Audio, camera & hardware utilities
│   └── productivity/          # Personal trackers & planning tools
│
├── scripts/                   # Generators & project validation scripts
├── src/                       # Shared UI components & design tokens
├── tests/                     # Automated test suites & validation checks
│
├── ARCHITECTURE.md            # Overall repository architecture overview
├── ARCHITECTURE_TEMPLATE.md   # Standardized template for mini projects
├── CONTRIBUTING.md            # Guidelines for repository contributors
├── README.md                  # Project overview documentation
├── index.html                 # Main landing page entry point
├── script.js                  # Global landing page logic & search engine
└── style.css                  # Core CSS design system
```

## Getting started

### Prerequisites

- **Node.js**: `v20.0.0` or higher (CI and recommended runtime is `v24.x` / see [.nvmrc](.nvmrc))
- **npm**: `v9.0.0` or higher
- **Python**: `3.x` (optional, for local HTTP static file serving)

### Setup

1. Clone the repo after forking

```bash
git clone https://github.com/<yourusername>/cradle.git
```

1. Open the local repository

```bash
cd cradle
```

1. Open the Landing page

- Simply just open the `index.html` on your browser... OR
- Use a local server using Python(recomended by me)

```bash
python -m http.server 8000
```

Then visit

```bash
http://localhost:8000
```

### Run Individual Projects

Projects that do not use browser-restricted features can be opened directly from their `index.html`.

Projects that use JavaScript modules, Web Workers, or other browser features restricted under `file://` should be run through a local HTTP server.

```bash
python -m http.server 8000
```

Then visit:

```text
http://localhost:8000/projects/<category>/<project>/
```

For example:

```text
http://localhost:8000/projects/aiml/image-classifier/
```

## ⌨️ Keyboard Shortcuts

The Cradle landing page supports intuitive keyboard navigation:

- `<kbd>/</kbd>` or `<kbd>Ctrl</kbd>+<kbd>K</kbd>` / `<kbd>Cmd</kbd>+<kbd>K</kbd>` — Focus the project search bar
- `<kbd>Esc</kbd>` — Clear active search query and reset category filters / close modal dialogs
- `<kbd>T</kbd>` — Toggle light / dark color theme
- `<kbd>?</kbd>` — Open / close the keyboard shortcuts help dialog

## 🗂️ Architecture Documentation

Every project in Cradle includes an `ARCHITECTURE.md` file that explains its folder structure, components, data flow, and design decisions. If you are adding a new project, use the standardized template at the repository root:

```text
ARCHITECTURE_TEMPLATE.md
```

See [CONTRIBUTING.md](CONTRIBUTING.md#architecture-documentation) for full instructions on how to fill it in.

## 🔧 Troubleshooting

Running into issues? Check the [Troubleshooting Guide](TROUBLESHOOT.md) for solutions to common setup, development, and Git problems before opening a new issue.

## 🤝 Contributing

Contributions are welcome! Whether you're fixing bugs, improving documentation, or adding new ideas and experiments, your help is greatly appreciated.

Before getting started, please read our [Contributing Guide](CONTRIBUTING.md) for information about the development workflow, coding standards, and pull request process.

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

## Very Important Note

Don't forget to leave a star behind for the repo if you're visiting this
