# Cradle UI — Reusable Component Library

A lightweight, framework-free component library for the Cradle project.
Zero dependencies. No build step. Works in any HTML page with a single `<script>` tag.

---

## Quick Start

```html
<!-- 1. Design tokens (shared CSS variables for colour, spacing, etc.) -->
<link rel="stylesheet" href="/src/components/ui/tokens.css" />

<!-- 2. Full bundle — loads all 5 components -->
<script src="/src/components/ui/index.js" defer></script>
```

Or load only what you need:

```html
<link rel="stylesheet" href="/src/components/ui/tokens.css" />
<script src="/src/components/ui/escapeHtml.js"></script>
<script src="/src/components/ui/storage.js"></script>
<script src="/src/components/ui/ThemeToggle/ThemeToggle.js" defer></script>
<script src="/src/components/ui/Button/Button.js" defer></script>
```

---

## Utilities

| Utility | File | Global | Description |
| :--- | :--- | :--- | :--- |
| **EscapeHtml** | `escapeHtml.js` | `CradleEscape.escapeHtml` | Escapes `& < > " '` for safe dynamic HTML interpolation. |
| **Storage** | `storage.js` | `window.CradleStorage` | Safe localStorage wrapper with JSON handling, namespaces, and in-memory fallback. |
| **SanitizeHtml** | `sanitizeHtml.js` | `CradleSanitize.sanitizeHtml` | DOM-based HTML sanitizer stripping unsafe tags, attributes, and script vectors. |
| **SanitizeSvg** | `sanitizeSvg.js` | `CradleSanitize.sanitizeSvg` | Validates and sanitizes SVG markup to prevent script execution in vector graphics. |
| **SanitizeCss** | `sanitizeCss.js` | `window.CradleSanitizeCss` | Sanitizes CSS properties, declarations, values, and URLs for dynamically applied styles. |
| **LoadModelScripts** | `loadModelScripts.js` | `window.loadModelScripts` | Loads external scripts and models with SRI integrity verification and timeout fallbacks. |

## Storage

Shared localStorage helper for safe reads, writes, JSON parsing, and
consistent key handling. Replaces the per-project storage code that each
reinvented availability checks, `try/catch` blocks, and key prefixes.

Features:

- Safe availability detection (private mode / disabled storage) with an
  in-memory fallback so calls never throw in Node, SSR, or restricted browsers.
- `get` / `set` JSON round-tripping; `getRaw` / `setRaw` for plain strings.
- `namespace(prefix)` handles + `keys(prefix)` / `clear(prefix)` for
  consistent prefix-based key management.

### Usage (HTML)

```html
<script src="/src/components/ui/storage.js"></script>
<script>
  CradleStorage.set("cradle_settings", { theme: "dark", lang: "en" });
  const settings = CradleStorage.get("cradle_settings", {});

  CradleStorage.setRaw("theme", "dark");
  const theme = CradleStorage.getRaw("theme", "dark");

  const store = CradleStorage.namespace("cradle_rps_");
  store.set("stats", { wins: 1 });
  store.get("stats", {});
  store.clear(); // removes every "cradle_rps_*" key
</script>
```

### Usage (barrel)

```js
CradleUI.load("storage").then(() => {
  CradleStorage.set("key", { any: "value" });
});
```

### Usage (Node / tests)

```js
const { set, get, namespace } = require("src/components/ui/storage.js");
```

### API

| Method                  | Description                                                                |
| ----------------------- | -------------------------------------------------------------------------- |
| `isAvailable()`         | Whether a working localStorage is present.                                 |
| `get(key, fallback)`    | Read + JSON.parse a value; fallback on missing/corrupt.                    |
| `getRaw(key, fallback)` | Read a verbatim string value.                                              |
| `set(key, value)`       | JSON.serialize + write; returns success boolean.                           |
| `setRaw(key, value)`    | Write a verbatim string value.                                             |
| `remove(key)`           | Delete one key.                                                            |
| `keys(prefix)`          | List stored keys, optionally filtered by prefix.                           |
| `clear(prefix)`         | Remove keys by prefix (or all); returns count removed.                     |
| `namespace(prefix)`     | Namespaced handle (`get`/`getRaw`/`set`/`setRaw`/`remove`/`keys`/`clear`). |

## EscapeHtml

Shared HTML escaping helper, reused across the projects that render
user-controlled text via `innerHTML`. Escapes `& < > " '` and coerces
`null`/`undefined` to `""`.

### Usage (HTML)

```html
<script src="/src/components/ui/escapeHtml.js"></script>
<script>
  el.innerHTML = `<p>${CradleEscape.escapeHtml(userInput)}</p>`;
</script>
```

### Usage (barrel)

```js
CradleUI.load("escapeHtml").then(() => {
  el.innerHTML = CradleEscape.escapeHtml(userInput);
});
```

### Usage (Node / tests)

```js
const { escapeHtml } = require("src/components/ui/escapeHtml.js");
```

---

## Components

| Component   | File                         | Global              |
| ----------- | ---------------------------- | ------------------- |
| Button      | `Button/Button.js`           | `CradleButton`      |
| Card        | `Card/Card.js`               | `CradleCard`        |
| ThemeToggle | `ThemeToggle/ThemeToggle.js` | `CradleThemeToggle` |
| Navbar      | `Navbar/Navbar.js`           | `CradleNavbar`      |
| BackToHome  | `BackToHome/BackToHome.js`   | `CradleBackToHome`  |

---

## Button

**Variants:** `primary` · `secondary` · `outline` · `ghost` · `success` · `danger` · `icon`  
**Sizes:** `sm` · `md` · `lg`

### Programmatic

```js
const btn = CradleButton.create({
  variant: "primary", // required
  size: "md", // sm | md | lg
  children: "Save changes",
  leftIcon: "✓",
  rightIcon: "→",
  loading: false,
  disabled: false,
  fullWidth: false,
  ariaLabel: "Save your changes",
  onClick: e => console.log("clicked"),
});
document.querySelector(".actions").appendChild(btn);
```

### HTML (auto-upgraded)

```html
<button
  data-cradle-btn
  data-variant="outline"
  data-size="sm"
  data-left-icon="★"
  type="button"
>
  Star this
</button>
```

---

## Card

Composable: `CradleCard.create()` · `CradleCard.Header()` · `CradleCard.Content()` · `CradleCard.Footer()`

### Programmatic

```js
const card = CradleCard.create({
  title: "2048 Game",
  subtitle: "A classic tile-merging puzzle",
  badge: "Games",
  icon: "🎮",
  children: "<p>Slide tiles, merge numbers, reach 2048.</p>",
  footer: openBtn, // Element or HTML string
  footerAlign: "right", // left | right | between
  clickable: true,
  onClick: () => window.open("/projects/games/2048-game/"),
});
document.querySelector(".grid").appendChild(card);
```

### Composition

```js
const card = document.createElement("article");
card.className = "cradle-card";

card.appendChild(
  CradleCard.Header({ title: "Chess", icon: "♟️", badge: "Strategy" })
);
card.appendChild(
  CradleCard.Content({ children: "<p>A full chess engine with AI.</p>" })
);
card.appendChild(
  CradleCard.Footer({
    children: [openBtn, shareBtn],
    align: "between",
  })
);
```

### HTML (auto-upgraded)

```html
<div
  data-cradle-card
  data-title="Memory Game"
  data-subtitle="Find every pair"
  data-badge="Games"
  data-clickable="true"
>
  <p>Sixty-four tiles, thirty-two pairs.</p>
</div>
```

---

## ThemeToggle

Replaces the existing homepage toggle and can be added to any project page.

### Programmatic

```js
const toggle = CradleThemeToggle.create({ size: "md" });
document.querySelector(".hero-actions").appendChild(toggle);
```

### React to theme changes

```js
document.documentElement.addEventListener("cradle:themechange", e => {
  console.log("Theme changed to:", e.detail.theme); // 'light' | 'dark'
});
```

### HTML (auto-upgraded)

```html
<button data-cradle-theme-toggle data-size="md"></button>
```

### Init without a button (e.g. in `<head>`)

```html
<script>
  // Prevents flash of wrong theme
  (function () {
    var t =
      localStorage.getItem("theme") ||
      (window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark");
    if (t === "light") document.documentElement.classList.add("light-theme");
  })();
</script>
```

---

## Navbar

### Programmatic

```js
const toggle = CradleThemeToggle.create({ size: "sm" });

const nav = CradleNavbar.create({
  logo: { text: "Cradle", href: "/index.html" },
  links: [
    { label: "Home", href: "/index.html" },
    { label: "Games", href: "/projects/games/" },
    { label: "AI / ML", href: "/projects/aiml/" },
    { label: "Dev Tools", href: "/projects/dev-tools/" },
    { label: "Misc", href: "/projects/misc/" },
  ],
  currentRoute: window.location.pathname,
  actions: [toggle],
});

// Insert nav + its mobile drawer
document.body.insertBefore(nav, document.body.firstChild);
nav.insertAdjacentElement("afterend", nav._drawer);
```

### HTML (auto-upgraded)

```html
<nav
  data-cradle-navbar
  data-logo-text="Cradle"
  data-logo-href="/index.html"
  data-links='[
    {"label":"Home","href":"/index.html"},
    {"label":"Games","href":"/projects/games/"}
  ]'
  data-current-route="/projects/games/"
></nav>
```

---

## BackToHome

Drop-in replacement for `projects/back-to-home.js`.

### Auto-inject (mimics existing behaviour)

```html
<!-- Replace the old back-to-home.js reference with this -->
<script src="/src/components/ui/BackToHome/BackToHome.js" defer></script>
```

It automatically detects whether the page is inside `/projects/` and injects the fixed pill button. No other changes needed.

### Programmatic

```js
const btn = CradleBackToHome.create({
  to: "/index.html", // custom route (default: computed)
  label: "Back to Home",
  variant: "pill", // pill (default) | minimal
});
document.querySelector(".controls").appendChild(btn);
```

### Minimal variant (inline, not fixed)

```js
const btn = CradleBackToHome.create({ variant: "minimal" });
```

### HTML (auto-upgraded)

```html
<a data-cradle-back-to-home data-label="Go Back" data-to="/index.html"></a>
```

---

## Design Tokens (`tokens.css`)

All tokens are CSS custom properties on `:root` (dark theme default).  
Light theme overrides are on `html.light-theme`.

```css
/* Key tokens — full list in tokens.css */
--cradle-bg
--cradle-surface
--cradle-border
--cradle-text
--cradle-accent
--cradle-accent-hover
--cradle-highlight        /* #93c5fd — the blue link/badge colour */
--cradle-success
--cradle-danger
--cradle-shadow
--cradle-radius
--cradle-radius-pill
--cradle-transition
--cradle-font-body
```

Projects that define their own tokens are not affected — Cradle UI uses
`--cradle-*` prefixed variables to avoid conflicts.

---

## Accessibility

Every component:

- Uses semantic HTML (`<button>`, `<nav>`, `<a>`, `<article>`)
- Has `aria-label` / `aria-labelledby` where needed
- Provides visible `:focus-visible` rings (`outline: 2px solid var(--color-accent); outline-offset: 2px; border-radius: 4px;`) meeting WCAG 2.1 Success Criterion 2.4.7
- Supports keyboard navigation (Tab, Enter, Space, Escape)
- Works with screen readers (`aria-expanded`, `aria-current`, `aria-busy`, etc.)
- Respects `prefers-reduced-motion`

---

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge).  
No polyfills required for ES6+, CSS custom properties, or `backdrop-filter`.

---

## Folder Structure

```
src/
└── components/
    └── ui/
        ├── tokens.css                ← Shared design tokens (CSS custom properties)
        ├── escapeHtml.js             ← Safe HTML escaping utility
        ├── storage.js                ← Safe localStorage wrapper with namespace support
        ├── sanitizeHtml.js           ← HTML markup sanitizer against XSS
        ├── sanitizeSvg.js            ← SVG sanitizer & integrity validator
        ├── sanitizeCss.js            ← Dynamic CSS property, value, and URL sanitizer
        ├── loadModelScripts.js       ← Remote model/script loader with integrity & timeouts
        ├── index.js                  ← Barrel bundle: loads all components and utilities
        ├── demo.html                 ← Component showcase and manual verification harness
        ├── README.md                 ← This documentation file
        ├── Button/
        │   └── Button.js             ← Button primitive with variants, sizes & loading states
        ├── Card/
        │   └── Card.js               ← Modular card container (Header, Content, Footer)
        ├── ThemeToggle/
        │   ├── README.md
        │   └── ThemeToggle.js        ← Dark/light theme toggle with OS sync
        ├── Navbar/
        │   └── Navbar.js             ← Responsive header navbar with mobile drawer
        ├── BackToHome/
        │   └── BackToHome.js         ← Standardized back-to-home navigation pill
        └── utils/
            └── categoryFilter.js     ← Category mapping and search filtering utility
```

---

## Shared UI Usage Policy & Contributor Decision Guide

To ensure consistency, accessibility compliance, and visual cohesion across all Cradle mini-projects, contributors must follow this usage policy when creating new projects or updating existing ones.

### 1. Component & Utility Support Matrix

The table below defines every supported shared UI primitive and its adoption expectation for mini-projects:

| Component / Utility | Type | Adoption Tier | Supported Use Cases |
| :--- | :--- | :--- | :--- |
| **`BackToHome`** | Component | **MUST** | **Mandatory on all minis.** Ensures users can return to the Cradle directory. Include via `<script src="../../../src/components/ui/BackToHome/BackToHome.js" defer></script>` or `data-cradle-back-to-home`. |
| **`CradleStorage`** | Utility | **MUST** | **Mandatory for all local persistence.** Any mini that reads or writes saved data, high scores, or options must use `CradleStorage` instead of direct `localStorage` calls (per [STORAGE_POLICY.md](../../../STORAGE_POLICY.md)). |
| **`escapeHtml`** / **`sanitizeHtml`** | Utility | **MUST** | **Mandatory for dynamic DOM insertions.** Whenever untrusted, user-supplied, or external content is inserted into `innerHTML`, you must escape or sanitize it. |
| **`tokens.css`** | Design Tokens | **SHOULD** | **Recommended for styling.** Provides standardized colors, surfaces, borders, radii, fonts, and transitions that automatically adapt to light/dark themes. |
| **`Button`** | Component | **SHOULD** | **Recommended for standard controls.** Use for primary actions, secondary triggers, modal buttons, and reset options (`primary`, `secondary`, `outline`, `ghost`, `danger`). |
| **`Card`** | Component | **SHOULD** | **Recommended for grouped content.** Use for control panels, score boards, tool settings, and modal containers. |
| **`ThemeToggle`** | Component | **SHOULD** | **Recommended when offering theme switches.** Syncs theme changes cleanly across Cradle with zero extra boilerplate. |
| **`Navbar`** | Component | **SHOULD** | **Recommended for multi-view minis.** Use when a project contains several sub-tools, tabs, or views requiring header navigation. |
| **`sanitizeSvg`** | Utility | **SHOULD** | **Recommended for vector uploads.** Use whenever parsing or previewing user-uploaded SVGs to ensure script tags and event handlers are neutralized. |
| **`sanitizeCss`** | Utility | **SHOULD** | **Recommended for CSS generators & dev tools.** Use when evaluating or applying user-generated CSS properties, values, or URLs. |
| **`loadModelScripts`** | Utility | **SHOULD** | **Recommended for remote AI/ML libraries.** Use when fetching allowed third-party model scripts with SRI checks and progressive fallback handling. |

### 2. When to Use Shared UI vs. Project-Specific UI

- **Use Shared UI Components When:**
  - Standard interactive patterns (buttons, cards, headers, toggles, navigation) are needed.
  - Consistent styling with Cradle design tokens and theme integration is desirable.
  - Accessibility (WCAG 2.1 focus rings, ARIA roles, keyboard navigation) is required without writing custom boilerplate.
  - Safe data storage, HTML escaping, or input sanitization is needed.

- **Project-Specific Custom UI is Appropriate When:**
  - **Canvas & WebGL surfaces**: Creative coding, real-time particle simulations, games, and graphical visualizations (e.g. `cannon-shooting`, `pathfinding-visualizer`, `fourier-series-visualizer`).
  - **Specialized domain instruments**: Tactile piano keys, guitar frets, drum pads, synthesizer knobs, audio meters, or custom sliders (e.g. `piano`, `guitar`, `percussion`).
  - **Bespoke game controls & boards**: Interactive chess boards, ludo grids, monopoly tiles, and custom gamepad overlays where generic buttons/cards do not fit.
  - **Specialized editors**: Syntax-highlighted code editors, terminal screens, or graphical circuit nodes.

### 3. How Minis Should Include Shared UI

Since minis live in `projects/<category>/<slug>/`, always use relative paths pointing to `../../../src/components/ui/`:

```html
<!-- 1. Shared design tokens (optional but strongly recommended) -->
<link rel="stylesheet" href="../../../src/components/ui/tokens.css" />

<!-- 2. Standardized Back to Home navigation (Required) -->
<script src="../../../src/components/ui/BackToHome/BackToHome.js" defer></script>

<!-- 3. Granular components and utilities as needed -->
<script src="../../../src/components/ui/Button/Button.js" defer></script>
<script src="../../../src/components/ui/storage.js"></script>
```

Minis should load only the specific components and utilities they consume rather than loading the full bundle, ensuring optimal page load performance.
