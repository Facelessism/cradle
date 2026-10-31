# Cradle UI — Reusable Component Library

A lightweight, framework-free component library for the Cradle project.
Zero dependencies. No build step. Works in any HTML page with standard `<script>` tags.

**Current Version:** `1.0.0`  
**Full Specification & Governance:** [docs/SHARED_UI_POLICY.md](../../../docs/SHARED_UI_POLICY.md)

---

## Table of Contents

- [Quick Start](#quick-start)
- [Public API Contract](#public-api-contract)
- [Utilities](#utilities)
- [Components](#components)
  - [Button](#button)
  - [Card](#card)
  - [ThemeToggle](#themetoggle)
  - [Navbar](#navbar)
  - [BackToHome](#backtohome)
- [Design Tokens](#design-tokens-tokenscss)
- [Ownership Boundaries](#ownership-boundaries)
- [Versioning Strategy](#versioning-strategy)
- [Component Evolution & Anti-Forking Guidelines](#component-evolution--anti-forking-guidelines)
- [Accessibility & Browser Support](#accessibility--browser-support)
- [Folder Structure](#folder-structure)

---

## Quick Start

### 1. Load the Entire Bundle (Recommended for Minis)

```html
<!-- 1. Design tokens (shared CSS variables for color, spacing, radius) -->
<link rel="stylesheet" href="/src/components/ui/tokens.css" />

<!-- 2. Full component bundle — auto-registers globals and upgrades DOM -->
<script src="/src/components/ui/index.js" defer></script>
```

### 2. Standalone On-Demand Loading

If your project only needs specific components or utilities, load them directly to minimize network requests:

```html
<link rel="stylesheet" href="/src/components/ui/tokens.css" />
<script src="/src/components/ui/escapeHtml.js"></script>
<script src="/src/components/ui/storage.js"></script>
<script src="/src/components/ui/ThemeToggle/ThemeToggle.js" defer></script>
<script src="/src/components/ui/Button/Button.js" defer></script>
```

---

## Public API Contract

Every shared component in Cradle UI conforms to the following standardized design pattern:

### 1. Programmatic Creation (`.create(options)`)

Every component exposes a static factory function returning a native `HTMLElement`:

```javascript
const element = window.CradleButton.create({
  variant: 'primary', // component-specific options
  children: 'Confirm',
  onClick: (e) => console.log(e)
});
document.body.appendChild(element);
```

- **Options Object**: Accepts named parameters with reliable defaults.
- **No Side-Effects**: Returns an unattached DOM node; insertion is handled explicitly by the caller.
- **Sanitized**: Any dynamic or user-controlled strings are automatically sanitized before DOM insertion.

### 2. Declarative Enhancement (`.upgradeAll()`)

Every component enhances static HTML elements annotated with `data-cradle-*` attributes:

```javascript
window.CradleButton.upgradeAll();
```

- **Idempotent**: Safe to run repeatedly; upgraded elements receive a guard flag (`data-cradle-upgraded="true"` or matching class).
- **Auto-Bootstrapped**: Components automatically trigger `upgradeAll()` on `DOMContentLoaded` (or immediately if the document has already loaded).

### 3. Global Namespacing & CommonJS Support

- Browser globals are namespaced under `window.Cradle<ComponentName>` (e.g., `window.CradleButton`, `window.CradleCard`).
- The barrel export is exposed as `window.CradleUI`.
- When loaded in a Node.js or CommonJS environment (`typeof module !== 'undefined'`), modules export their primitives for automated unit testing.

### 4. Custom Events (`cradle:*`)

Shared components communicate state changes through custom DOM events:
- Dispatched with the prefix `cradle:<event-name>` (e.g., `cradle:themechange`).
- Bubbles by default (`bubbles: true`) with payloads stored in `event.detail`.

---

## Utilities

| Utility | File | Global | Description |
| :--- | :--- | :--- | :--- |
| **Storage** | `storage.js` | `CradleStorage` | Safe, namespaced `localStorage` wrapper with JSON serialization and memory fallback. |
| **EscapeHtml** | `escapeHtml.js` | `CradleEscape` | Escapes `& < > " '` for safe text insertion into `innerHTML`. |
| **SanitizeHtml** | `sanitizeHtml.js` | `CradleSanitize` | Comprehensive allowlist sanitizer for rich HTML strings. |
| **SanitizeSvg** | `sanitizeSvg.js` | `CradleSanitize` | SVG structure and attribute sanitizer preventing embedded script vectors. |
| **SanitizeCss** | `sanitizeCss.js` | `CradleSanitizeCss` | Allowlist-based CSS property and value sanitizer. |
| **DiagramToolkit** | `diagram-toolkit.js` | `DiagramToolkit` | Generates Mermaid.js syntax for timelines, flowcharts, and architecture diagrams. |

### Storage Example

```html
<script src="/src/components/ui/storage.js"></script>
<script>
  // Safe write and read
  CradleStorage.set("cradle_settings", { theme: "dark", sound: true });
  const settings = CradleStorage.get("cradle_settings", { theme: "dark" });

  // Namespaced sub-store for mini isolation
  const gameStore = CradleStorage.namespace("cradle_chess_");
  gameStore.set("high_score", 1200);
  console.log(gameStore.get("high_score", 0));
</script>
```

### Sanitization Example

```html
<script src="/src/components/ui/sanitizeHtml.js"></script>
<script>
  // Strips unsafe tags like <script>, <iframe>, <object>, and javascript: URIs
  const safeHtml = CradleSanitize.sanitizeHtml(userProvidedMarkup);
  element.innerHTML = safeHtml;
</script>
```

---

## Components

| Component | File | Global | Description |
| :--- | :--- | :--- | :--- |
| **Button** | `Button/Button.js` | `CradleButton` | Accessible button and link with variants, sizes, icons, and loading state. |
| **Card** | `Card/Card.js` | `CradleCard` | Composable card primitive with header, content, footer, badges, and hover effects. |
| **ThemeToggle** | `ThemeToggle/ThemeToggle.js` | `CradleThemeToggle` | Light/dark mode toggle connected to `CradleStorage` and OS color preferences. |
| **Navbar** | `Navbar/Navbar.js` | `CradleNavbar` | Sticky navigation bar with responsive mobile drawer and route highlighting. |
| **BackToHome** | `BackToHome/BackToHome.js` | `CradleBackToHome` | Floating or inline navigation pill returning users to the Cradle home page. |

---

## Button

**Variants:** `primary` · `secondary` · `outline` · `ghost` · `success` · `danger` · `icon`  
**Sizes:** `sm` · `md` · `lg`

### Programmatic

```javascript
const btn = CradleButton.create({
  variant: "primary",
  size: "md",
  children: "Save Changes",
  leftIcon: "✓",
  rightIcon: "→",
  loading: false,
  disabled: false,
  fullWidth: false,
  ariaLabel: "Save your current changes",
  onClick: (e) => console.log("Clicked!"),
});
document.querySelector(".actions").appendChild(btn);
```

### HTML (Auto-Upgraded)

```html
<button
  data-cradle-btn
  data-variant="outline"
  data-size="sm"
  data-left-icon="★"
  type="button"
>
  Star Project
</button>
```

---

## Card

Composable: `CradleCard.create()` · `CradleCard.Header()` · `CradleCard.Content()` · `CradleCard.Footer()`

### Programmatic

```javascript
const card = CradleCard.create({
  title: "Neural Network Playground",
  subtitle: "Interactive deep learning simulator",
  badge: "AI/ML",
  icon: "🧠",
  children: "<p>Train a feedforward neural network directly in the browser.</p>",
  footer: openBtn,
  footerAlign: "right", // left | right | between
  clickable: true,
  onClick: () => window.open("/projects/aiml/neural-network-playground/"),
});
document.querySelector(".grid").appendChild(card);
```

### HTML (Auto-Upgraded)

```html
<div
  data-cradle-card
  data-title="Chess Game"
  data-subtitle="Play against minimax AI"
  data-badge="Games"
  data-clickable="true"
>
  <p>Standard chess with move validation and multiple AI difficulties.</p>
</div>
```

---

## ThemeToggle

Synchronizes light/dark theme across the Cradle shell and individual mini pages.

### Programmatic

```javascript
const toggle = CradleThemeToggle.create({ size: "md" });
document.querySelector(".header-controls").appendChild(toggle);
```

### Event Listener

```javascript
document.documentElement.addEventListener("cradle:themechange", (e) => {
  console.log("Active theme:", e.detail.theme); // 'light' | 'dark'
});
```

### HTML (Auto-Upgraded)

```html
<button data-cradle-theme-toggle data-size="md"></button>
```

---

## Navbar

### Programmatic

```javascript
const nav = CradleNavbar.create({
  logo: { text: "Cradle", href: "/index.html" },
  links: [
    { label: "Home", href: "/index.html" },
    { label: "Games", href: "/projects/games/" },
    { label: "AI / ML", href: "/projects/aiml/" },
    { label: "Dev Tools", href: "/projects/dev-tools/" },
  ],
  currentRoute: window.location.pathname,
  actions: [CradleThemeToggle.create({ size: "sm" })],
});

document.body.insertBefore(nav, document.body.firstChild);
nav.insertAdjacentElement("afterend", nav._drawer);
```

### HTML (Auto-Upgraded)

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

Provides standardized navigation back to the root hub from any mini.

### Auto-Inject (Drop-in script)

```html
<script src="/src/components/ui/BackToHome/BackToHome.js" defer></script>
```

### Programmatic

```javascript
const btn = CradleBackToHome.create({
  to: "/index.html",
  label: "Back to Home",
  variant: "pill", // 'pill' (fixed top-left) | 'minimal' (inline)
});
document.body.appendChild(btn);
```

### HTML (Auto-Upgraded)

```html
<a data-cradle-back-to-home data-label="Return to Hub" data-to="/index.html"></a>
```

---

## Design Tokens (`tokens.css`)

All tokens are CSS custom properties declared on `:root` (dark theme default) and overridden on `html.light-theme`.

```css
/* Color System */
--cradle-bg: #0b0f19;
--cradle-surface: #111827;
--cradle-border: #374151;
--cradle-text: #f9fafb;
--cradle-text-muted: #9ca3af;
--cradle-accent: #3b82f6;
--cradle-accent-hover: #2563eb;
--cradle-highlight: #93c5fd;
--cradle-success: #10b981;
--cradle-danger: #ef4444;

/* Sizing & Elevation */
--cradle-radius-sm: 6px;
--cradle-radius-md: 12px;
--cradle-radius-lg: 20px;
--cradle-radius-pill: 9999px;
--cradle-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
--cradle-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
```

Projects defining their own CSS custom properties are not impacted; Cradle UI exclusively uses the `--cradle-*` namespace.

---

## Ownership Boundaries

To keep the shared UI layer cohesive and maintainable, clear ownership boundaries are established:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Core Shared UI Component Library (src/components/ui/)   │
│    - Reusable UI primitives: Button, Card, Navbar, etc.     │
│    - Foundational utilities: storage, sanitize, escape      │
│    - General-purpose, domain-agnostic, zero-dependency      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Consumed by
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Mini-Specific Implementations (projects/*/*/)            │
│    - Domain-specific widgets (chess boards, synth keys)     │
│    - Canvas / WebGL game renderers and shaders              │
│    - Single-mini experiment logic and specialized state     │
└─────────────────────────────────────────────────────────────┘
```

### When to Use Shared UI
- **Always use shared UI** for buttons, cards, theme toggling, home navigation, data storage, and input sanitization.
- **Use shared design tokens** (`tokens.css`) when styling mini interfaces to ensure aesthetic coherence with the Cradle shell.

### When to Keep UI Local to a Mini
- When a widget is coupled to domain logic (e.g., piano keys generating specific Web Audio frequencies, or a syntax tree graph node).
- When prototyping an experimental interaction that has not yet proven utility in other minis.

---

## Versioning Strategy

Cradle UI adheres to **Semantic Versioning (SemVer)**: `MAJOR.MINOR.PATCH`.

The library version is available at runtime via `CradleUI.version`:
```javascript
console.log(window.CradleUI.version); // e.g. "1.0.0"
```

### Zero-Breaking-Change Guarantee for Minis

Because minis in the Cradle monorepo consume shared UI files directly via relative file paths without individual lockfiles, breaking changes to shared components will break existing projects.

1. **PATCH (`1.0.x`)**:
   - Internal bug fixes, security hardening, sanitization updates, and accessibility patches.
   - 100% backwards compatible; requires zero changes in consuming minis.
2. **MINOR (`1.x.0`)**:
   - New components, new optional parameters on `.create()`, new `data-cradle-*` attributes, or new design tokens.
   - 100% backwards compatible with all existing mini code.
3. **MAJOR (`x.0.0`)**:
   - Structural API changes or breaking removals.
   - **Deprecation Grace Period**: Slated removals MUST be marked deprecated and issue a `console.warn` for at least one minor release cycle before removal.
   - **Monorepo Migration**: Any breaking change requires an automated migration or PR updating every affected mini before merging.

---

## Component Evolution & Anti-Forking Guidelines

Copying or duplicating shared components inside a mini project creates maintenance debt, introduces visual drift, and misses critical security updates.

### The 4-Stage Promotion Lifecycle

Instead of creating ad-hoc local duplicates, follow the standardized graduation workflow:

1. **Stage 1: Local Prototype**  
   Build the interaction inside `projects/<category>/<slug>/` to test the concept and refine requirements.
2. **Stage 2: Promotion Proposal**  
   When the pattern is needed in a second mini or identified as broadly useful, open an issue/PR proposing promotion to `src/components/ui/`.
3. **Stage 3: Extraction & Hardening**  
   Extract the component into `src/components/ui/<Component>/<Component>.js`. Implement the public API contract:
   - Factory `.create(options)` and declarative `.upgradeAll()`.
   - `--cradle-*` token integration.
   - WCAG 2.1 AA keyboard and screen reader accessibility.
   - Automated tests.
4. **Stage 4: Monorepo Adoption**  
   Refactor consuming minis to use the new shared component and remove local duplicated code.

### Prefer Extension Over Forking

Before copying a component, extend it through the public API:
- **Composition**: Combine existing primitives (e.g., placing `CradleButton` instances inside `CradleCard.Footer()`).
- **Custom Classes**: Pass custom class names via the `className` option.
- **CSS Variable Overrides**: Override design tokens locally on the container element:
  ```css
  .custom-panel {
    --cradle-surface: #1e293b;
    --cradle-accent: #10b981;
  }
  ```

---

## Accessibility & Browser Support

### Accessibility Standards (WCAG 2.1 AA)

Every component:
- Uses semantic HTML (`<button>`, `<nav>`, `<a>`, `<article>`).
- Includes proper ARIA states (`aria-label`, `aria-expanded`, `aria-busy`, `role="switch"`).
- Provides high-visibility `:focus-visible` rings meeting WCAG 2.1 Success Criterion 2.4.7.
- Supports full keyboard navigation (Tab, Shift+Tab, Enter, Space, Escape).
- Honors `prefers-reduced-motion`.

### Browser Support

Works across all modern evergreen browsers (Chrome, Firefox, Safari, Edge). Zero polyfills required.

---

## Folder Structure

```text
src/
└── components/
    └── ui/
        ├── tokens.css                ← Design tokens (CSS custom properties)
        ├── escapeHtml.js             ← HTML escaping utility
        ├── sanitizeHtml.js           ← Allowlist HTML sanitizer
        ├── sanitizeSvg.js            ← SVG sanitizer
        ├── sanitizeCss.js            ← CSS property sanitizer
        ├── storage.js                ← Namespaced localStorage utility
        ├── diagram-toolkit.js        ← Mermaid diagram generator
        ├── index.js                  ← Library registry & barrel loader
        ├── README.md                 ← This documentation
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
