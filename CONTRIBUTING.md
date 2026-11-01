# Contributing

First of all, thank you for your interest in contributing to **Cradle**! 🎉

Cradle is a collection of small ideas, experiments, lightweight prototypes, and geeky projects built for learning, exploration, and sharing. Whether you're fixing a bug, improving documentation, adding a new project, or enhancing an existing one, every contribution is appreciated.

Please take a few minutes to read these guidelines before getting started.

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Before You Start](#before-you-start)
- [Adding a New Project](#adding-a-new-project)
- [Shared UI Components & Library](#shared-ui-components--library)
- [Coding Guidelines](#coding-guidelines)
- [Documentation Guidelines](#documentation-guidelines)
- [Architecture Documentation](#architecture-documentation)
- [Branch Naming Guidelines](#branch-naming-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Testing](#testing)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Need Help?](#need-help)
- [Thank You](#thank-you)

## Ways to Contribute

You can contribute in many ways, including:

- 🐞 Fixing bugs
- ✨ Adding new projects or experiments
- 📖 Improving documentation
- 🎨 Enhancing UI/UX
- ⚡ Performance improvements
- 🛠️ Refactoring existing code
- 💡 Suggesting new ideas and features

Every contribution, no matter how small, is valuable.

---

## Before You Start

Before working on an issue:

- Ensure you are running a supported Node.js version (`>=20.0.0`, `v24.x` recommended / declared in `.nvmrc` and `package.json`).
- Search existing issues to avoid duplicate work.
- Read the project documentation before starting.
- Wait until an issue has been assigned to you (if required by the maintainers).
- Work on only **one issue per Pull Request**.
- Keep your Pull Request focused on a **single feature or bug fix**.
- For major features or architectural changes, open an issue first to discuss your proposal.

---

## Adding a New Project

If you're contributing a new project, follow the repository's existing structure and keep the addition focused and self-contained.

### Where to place it

Create a new folder under the appropriate category in the `projects/` directory. Categories already include:

- `projects/aiml/`
- `projects/dev-tools/`
- `projects/games/`
- `projects/misc/`
- `projects/productivity/`

Each new project should live in its own subfolder under one of those categories.

Example:

```text
projects/games/your-project-name/
```

Every mini must follow the [Mini-Project Module Contract](docs/MINI_CONTRACT.md). Run `npm run validate:mini-contract` to check yours (add `-- --strict` to fail on errors).

### Recommended project structure

A new project should usually live in its own folder with only the files it needs. A simple structure might look like this:

```text
project-name/
├── index.html
├── style.css
├── script.js
├── ARCHITECTURE.md
├── preview.png
└── assets/
    ├── images/
    ├── icons/
    └── other-assets/
```

Use this as a guideline rather than a strict requirement:

- `index.html` — the entry point for browser-based projects (should include a meaningful descriptive `<title>`, the shared `<link rel="icon" type="image/svg+xml" href="../../../assets/favicon.svg" />` favicon tag, and `<script src="../../../src/components/ui/BackToHome/BackToHome.js" defer></script>` component for standardized navigation).
- `style.css` — project-specific styling where applicable.
- `script.js` — project behavior and logic where applicable.
- `ARCHITECTURE.md` — project architecture documentation covering what the project does, its structure, and how to use or run it.
- `preview.png` — a preview image when it helps the project feel complete and easier to recognize.
- `assets/` — project-specific images, icons, fonts, or other supporting resources.

Keep the project self-contained whenever possible. Avoid adding unrelated global files unless the change truly belongs to the project.

### Naming conventions

- Use lowercase folder names with hyphens when possible.
- Use descriptive, readable names that match the project purpose.
- Prefer names that are easy to understand when browsing the repository.

### Documentation requirements

Every new project should include an `ARCHITECTURE.md` inside its own folder based on `ARCHITECTURE_TEMPLATE.md`.

A useful architecture document usually includes:

- A short overview and purpose of the project
- Key features or gameplay
- Folder structure and component breakdown
- How to open or run it locally
- Controls or interaction details if relevant
- Licensing details and attribution for external assets/libraries

### Licensing and Asset Attribution

- Every project must clearly specify its licensing (e.g., MIT) inside its `ARCHITECTURE.md` file.
- If you use any third-party assets (images, icons, fonts, audio, code snippets), you must provide explicit attribution in the same section, including links to the source and stating the asset's license.
- Avoid using copyrighted assets without a clear open-source or permissive license.

### New Project Checklist

Before opening a Pull Request, review the following checklist:

- [ ] The project is placed in the correct category directory.
- [ ] The project folder has a clear and descriptive name.
- [ ] Project-specific files are organized within the project folder.
- [ ] Assets are stored in an appropriate location.
- [ ] `index.html` includes the shared `BackToHome.js` navigation component.
- [ ] Any external third-party scripts or models strictly follow the [Third-Party Script Loading Policy](THIRD_PARTY_POLICY.md) (e.g., proper SRI hashes, trusted CDNs).
- [ ] All persistent data storage uses the `CradleStorage` abstraction as defined in the [Storage Policy](STORAGE_POLICY.md).
- [ ] The project explicitly specifies its licensing and includes attribution for any third-party assets.
- [ ] `ARCHITECTURE.md` has been added following the [standardized template](ARCHITECTURE_TEMPLATE.md).
- [ ] The project works correctly locally.
- [ ] Existing projects and unrelated files were not unnecessarily modified.
- [ ] The project follows the repository's contribution guidelines.

---

## Shared UI Components & Library

Cradle provides a lightweight, zero-dependency shared UI component library under `src/components/ui/`. It offers standardized UI controls, styling tokens, and security/storage utilities that minis can adopt directly via static `<script>` and `<link>` tags.

### Supported Components and Utilities

| Component / Utility | Location | Type | Global Object | Description |
| :------------------ | :------- | :--- | :------------ | :---------- |
| **`BackToHome`** | `src/components/ui/BackToHome/BackToHome.js` | Component | `window.CradleBackToHome` | Standardized back-to-home navigation pill. Mandatory for all minis. |
| **`Button`** | `src/components/ui/Button/Button.js` | Component | `window.CradleButton` | Accessible button with variants (`primary`, `secondary`, `outline`, `ghost`, `danger`), sizes (`sm`, `md`, `lg`), icons, and loading states. |
| **`Card`** | `src/components/ui/Card/Card.js` | Component | `window.CradleCard` | Modular container with `Card`, `CardHeader`, `CardContent`, and `CardFooter`. |
| **`Navbar`** | `src/components/ui/Navbar/Navbar.js` | Component | `window.CradleNavbar` | Responsive header with brand logo, nav links, and mobile drawer. |
| **`ThemeToggle`** | `src/components/ui/ThemeToggle/ThemeToggle.js` | Component | `window.CradleThemeToggle` | Dark/light theme switch with OS sync and localStorage persistence. |
| **`tokens.css`** | `src/components/ui/tokens.css` | Styling | CSS Custom Properties | Standardized colors, borders, shadows, spacing, and typography variables. |
| **`escapeHtml`** | `src/components/ui/escapeHtml.js` | Utility | `CradleEscape.escapeHtml` | Safe HTML escaping for user strings interpolated into `innerHTML`. |
| **`storage`** | `src/components/ui/storage.js` | Utility | `window.CradleStorage` | Robust `localStorage` wrapper with JSON serialization, prefixes, and memory fallback. |
| **`sanitizeHtml`** | `src/components/ui/sanitizeHtml.js` | Utility | `CradleSanitize.sanitizeHtml` | DOM-based HTML sanitizer stripping unsafe tags and scripts. |
| **`sanitizeSvg`** | `src/components/ui/sanitizeSvg.js` | Utility | `CradleSanitize.sanitizeSvg` | SVG sanitizer and validator neutralizing embedded script vectors. |
| **`sanitizeCss`** | `src/components/ui/sanitizeCss.js` | Utility | `window.CradleSanitizeCss` | Dynamic CSS property, value, declaration, and URL sanitizer. |
| **`loadModelScripts`**| `src/components/ui/loadModelScripts.js` | Utility | `window.loadModelScripts` | Third-party script loader with SRI verification, timeouts, and fallbacks. |

### When Minis Should Use Shared UI vs Custom UI

To keep Cradle projects visually harmonious while preserving flexibility for creative experiments, contributors should apply the following criteria:

- **Mandatory (MUST):**
  - **`BackToHome.js`**: Every mini MUST include the Back-to-Home button so users can navigate back to the Cradle directory.
  - **`CradleStorage`**: Every mini persisting user data, preferences, or high scores MUST use `CradleStorage` instead of raw `localStorage` calls (see [Storage Policy](STORAGE_POLICY.md)).
  - **`escapeHtml` / `sanitizeHtml`**: Any dynamic or user-generated text inserted into the DOM MUST be escaped or sanitized to prevent XSS.

- **Recommended (SHOULD):**
  - **`tokens.css`**: Minis SHOULD link `tokens.css` to adopt Cradle's unified color scheme and typography.
  - **`Button` / `Card`**: Minis SHOULD use the shared `Button` and `Card` components for standard form actions, controls, modal dialogs, and settings panels rather than writing duplicate CSS.
  - **`ThemeToggle`**: Minis that support theme switching SHOULD reuse `ThemeToggle.js` to stay in sync with the root application theme.

- **When Project-Specific Custom UI is Appropriate (MAY):**
  - **Interactive canvases & visual games**: Fast real-time canvas games (e.g. `cannon-shooting`, `dot-game`) and visualizer simulations (`fourier-series-visualizer`, `pathfinding-visualizer`).
  - **Bespoke musical and audio instruments**: Physical instrument layouts like piano keys (`piano`), guitar frets (`guitar`), and drum pads (`percussion`).
  - **Custom game boards & domain editors**: Chess boards, ludo grids, circuit builder nodes, or terminal emulators that require specialized mechanics not covered by standard buttons or cards.

### How to Consume Shared UI in Minis

Minis reside at `projects/<category>/<slug>/`. Always link shared UI components and design tokens using relative paths:

```html
<!-- Design tokens -->
<link rel="stylesheet" href="../../../src/components/ui/tokens.css" />

<!-- Required back-to-home navigation -->
<script src="../../../src/components/ui/BackToHome/BackToHome.js" defer></script>

<!-- Granular components and utilities as needed -->
<script src="../../../src/components/ui/Button/Button.js" defer></script>
<script src="../../../src/components/ui/storage.js"></script>
```

For full API specifications, interactive examples, and token lists, see the [Cradle UI Documentation](src/components/ui/README.md).

---

## Coding Guidelines

Please follow the existing coding style throughout the repository. Code formatting is enforced using **Prettier**.

- Write clean, readable, and maintainable code.
- Use meaningful variable and file names.
- Keep code modular whenever possible.
- Avoid unrelated changes in the same Pull Request.
- Remove unused code before submitting.
- Update documentation whenever your changes affect functionality.

### Code Formatting

We use Prettier to maintain a consistent style across the codebase. Before submitting a pull request, please ensure your changes are formatted:

- **Format Code**: Run `npm run format` to auto-format your changes.
- **Check Formatting**: Run `npm run check-format` to verify all files are formatted correctly.

---

## Documentation Guidelines

Documentation is just as important as code.

You can contribute by:

- Improving explanations
- Fixing grammar or spelling
- Updating outdated information
- Adding missing documentation
- Providing examples where helpful

---

## Architecture Documentation

Every project in Cradle should include an `ARCHITECTURE.md` file inside its own folder. This helps contributors understand how a project is structured before reading any source code.

A standardized template is provided at the repository root:

```text
ARCHITECTURE_TEMPLATE.md
```

### How to use the template

1. Copy `ARCHITECTURE_TEMPLATE.md` from the repository root into your project folder.
2. Rename the copy to `ARCHITECTURE.md`.
3. Replace every placeholder with details specific to your project.
4. Delete any section that does not apply to your project.
5. Remove the notice block at the top of the template before submitting.

### What to document

A good `ARCHITECTURE.md` covers:

- **Overview** — what the project does, in 2–4 sentences
- **Purpose & Goals** — what problem it solves or what it demonstrates
- **Folder Structure** — a tree view of all important files with inline descriptions
- **System / Project Architecture Overview** — how the major parts fit together
- **Component Breakdown** — the role of each file or module
- **Data Flow / Execution Flow** — what happens from page load to user interaction
- **Key Features** — notable features a contributor would notice
- **Technologies Used** — languages, libraries, and APIs
- **File Responsibilities** — key functions and variables per file
- **Design Decisions** — non-obvious choices and the reasoning behind them
- **Dependencies** — external libraries and how they are loaded
- **Future Improvements** — ideas without commitments
- **Known Limitations** — honest current shortcomings
- **Development Notes** — practical notes for running and modifying the project
- **References** — external resources that shaped the implementation

### Tips

- Only document what actually exists — do not invent architecture.
- Keep explanations beginner-friendly. Assume the reader is seeing the project for the first time.
- Use the arrow-step format for flow diagrams (see existing examples in `projects/games/`).
- Use tables for component breakdowns and dependency lists.

---

## Branch Naming Guidelines

Create a new branch for every contribution.

Use descriptive branch names following this format:

```text
feature/short-description
fix/short-description
docs/short-description
refactor/short-description
style/short-description
chore/short-description
```

Examples:

```text
feature/add-weather-widget
feature/new-project-showcase
fix/project-card-alignment
docs/update-contributing-guide
refactor/simplify-project-filter
```

Avoid generic branch names such as:

```text
update
changes
test
branch1
new
```

---

## Commit Message Guidelines

Clear and descriptive commit messages make it easier to review changes and understand project history.

Following the Conventional Commits format is recommended.

Examples:

```text
feat: add portfolio project card
fix: resolve mobile navigation issue
docs: update contributing guidelines
style: improve landing page spacing
refactor: simplify project filtering logic
```

Avoid commit messages like:

```text
update
changes
fix
misc
```

---

## Testing

Before submitting your Pull Request, review the [Testing Architecture & CI Strategy](TESTING.md) to understand the required tests and validation scripts.

- Verify that your changes work as expected.
- Ensure existing functionality is not broken.
- Test responsive layouts if you modified the UI.
- Check that documentation and links render correctly.

---

## Pull Request Guidelines

Before opening a Pull Request, make sure:

- Your branch is up to date.
- Your Pull Request addresses only one issue or feature.
- Documentation has been updated when necessary.
- The project runs successfully after your changes.
- Link the related issue using:

```text
Fixes #<issue_number>
```

If your Pull Request includes UI changes, please attach screenshots.

---

## Reporting Bugs

When reporting a bug, please include:

- A clear description of the issue.
- Steps to reproduce.
- Expected behavior.
- Actual behavior.
- Browser and operating system.
- Screenshots or console logs, if applicable.

Providing detailed information helps maintainers reproduce and resolve issues efficiently.

---

## Suggesting Features

Feature suggestions are always welcome.

Please include:

- The problem your feature solves.
- Your proposed solution.
- Possible alternatives.
- Additional context or examples.

---

## Need Help?

If you have any questions before contributing, feel free to open an issue or start a discussion.

The maintainers and community are happy to help.

---

## Thank You

Thank you for taking the time to contribute to **Cradle**.

Your contributions help make this repository a better place for learning, experimentation, and collaboration.

Happy Coding! 🚀
