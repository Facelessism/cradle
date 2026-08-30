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

| Utility    | File                | Global         |
| ---------- | ------------------- | -------------- |
| EscapeHtml | `escapeHtml.js`     | `CradleEscape` |
| Storage    | `storage.js`        | `CradleStorage` |

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

| Method                          | Description                                              |
| ------------------------------- | -------------------------------------------------------- |
| `isAvailable()`                 | Whether a working localStorage is present.               |
| `get(key, fallback)`            | Read + JSON.parse a value; fallback on missing/corrupt.  |
| `getRaw(key, fallback)`         | Read a verbatim string value.                            |
| `set(key, value)`               | JSON.serialize + write; returns success boolean.         |
| `setRaw(key, value)`            | Write a verbatim string value.                           |
| `remove(key)`                   | Delete one key.                                          |
| `keys(prefix)`                  | List stored keys, optionally filtered by prefix.         |
| `clear(prefix)`                 | Remove keys by prefix (or all); returns count removed.   |
| `namespace(prefix)`             | Namespaced handle (`get`/`getRaw`/`set`/`setRaw`/`remove`/`keys`/`clear`). |

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
- Provides visible `:focus-visible` rings
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
        ├── tokens.css                ← Design tokens (CSS variables)
        ├── escapeHtml.js             ← Shared HTML escaping utility
        ├── storage.js                ← Shared localStorage utility
        ├── index.js                  ← Barrel: loads all components
        ├── README.md                 ← This file
        ├── Button/
        │   └── Button.js
        ├── Card/
        │   └── Card.js
        ├── ThemeToggle/
        │   └── ThemeToggle.js
        ├── Navbar/
        │   └── Navbar.js
        └── BackToHome/
            └── BackToHome.js
```

---

## Shared UI Usage Policy

Mini-projects should use the shared components in `src/components/ui/` when an existing component provides the UI pattern they need. This keeps common interactions and styling consistent across projects.

### When to use shared UI components

- **Use an existing component** when it matches the required UI pattern, such as buttons, cards, navigation, theme toggles, or the back-to-home control.
- **Use the shared design tokens** from `tokens.css` when styling shared UI so projects remain visually consistent.
- **Load only the components you need** when a project does not require the full UI bundle.
- **Prefer extending or improving a shared component** when the same UI requirement is likely to be useful across multiple projects.

### When a project-specific component is appropriate

A mini-project may keep its own UI implementation when:

- No existing shared component matches the required behaviour or design.
- The UI is specific to the project's functionality and is unlikely to be reused.
- Adopting a shared component would add unnecessary complexity.

When introducing a reusable UI pattern that could benefit multiple projects, consider adding it to `src/components/ui/` instead of duplicating the implementation.

### Contributor guideline

Before adding a new shared-style component to a mini-project, check `src/components/ui/` first. Reuse an existing component when practical, and keep project-specific UI local when there is no suitable shared component.
