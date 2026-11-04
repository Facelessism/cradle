# Cradle Shared UI Component Library & Versioning Policy

This document establishes the architecture, public API contract, ownership boundaries, versioning strategy, and component evolution lifecycle for **Cradle UI** (`src/components/ui/`).

---

## 1. Philosophy & Purpose

Cradle contains over 50 lightweight mini-projects, prototypes, and developer tools. **Cradle UI** is the shared, framework-free design system and component library that powers common user interface patterns across these projects.

### Core Tenets

1. **Zero-Build, Pure Web Standards**: Components are authored in vanilla JavaScript (ES6+), semantic HTML, and standard CSS. There is no Babel, Webpack, Vite, or TypeScript compilation step required to run them in the browser.
2. **Dual Consumption Model**: Minis can load the entire library via `/src/components/ui/index.js` or import only the individual components and utilities they require.
3. **Progressive Enhancement**: Every visual component supports both programmatic instantiation (`Cradle<Component>.create(...)`) and declarative HTML markup (`data-cradle-*` attributes upgraded via `Cradle<Component>.upgradeAll()`).
4. **Resilient Theming**: Visual styling is decoupled through CSS custom properties prefixed with `--cradle-*`, enabling effortless dark/light theme switching without cascading style leakage.
5. **Strict Accessibility**: Accessibility is built-in by default (WCAG 2.1 AA compliant), ensuring keyboard focus, screen reader announcements, and reduced-motion preferences work out of the box.

---

## 2. Public API Specification & Component Contract

Every component added to `src/components/ui/` MUST conform to this public API specification.

### 2.1 File & Directory Conventions

A component named `Foo` lives in `src/components/ui/Foo/`:
```text
src/components/ui/Foo/
└── Foo.js          # Component implementation, styles, and auto-upgrade logic
```

### 2.2 Global Namespacing

- Each component MUST register itself on the global `window` object as `window.Cradle<ComponentName>` (e.g. `window.CradleButton`, `window.CradleCard`, `window.CradleThemeToggle`).
- The barrel export `src/components/ui/index.js` attaches the central registry to `window.CradleUI`.
- CommonJS environments (`module.exports`) MUST be supported when `typeof module !== 'undefined'` for server-side evaluation and unit testing.

### 2.3 The Factory Method (`create`)

Every visual component MUST expose a static `.create(options)` method returning a native `HTMLElement`.

```javascript
const element = window.CradleButton.create({
  variant: 'primary', // primary | secondary | outline | ghost | success | danger | icon
  size: 'md',         // sm | md | lg
  children: 'Save',
  onClick: (e) => console.log(e),
});
```

**Requirements for `.create(options)`**:
- Accepts a single options object with sensible defaults for every parameter.
- Never throws on omitted optional parameters.
- Validates and sanitizes dynamic or untrusted strings (see [Section 2.7](#27-security--sanitization-contract)).
- Returns a standard DOM element (`HTMLButtonElement`, `HTMLDivElement`, etc.) ready for insertion via `appendChild`, `replaceWith`, etc.

### 2.4 Declarative HTML Enhancement (`upgradeAll`)

Every component MUST expose an `.upgradeAll(root = document)` method that searches the DOM for corresponding `data-cradle-*` attributes and transforms matching elements into fully interactive components.

```javascript
window.CradleButton.upgradeAll();
```

**Requirements for `.upgradeAll()`**:
- **Idempotency**: Must be safe to execute multiple times without re-attaching duplicate listeners or creating redundant wrapper nodes (use `element.dataset.cradleUpgraded = "true"` or class guards).
- **Auto-Initialization**: Component scripts MUST automatically trigger `.upgradeAll()` on `DOMContentLoaded` (or immediately if `document.readyState !== 'loading'`).
- **Progressive Enhancement**: Existing child content and inline attributes must be preserved gracefully when upgrading.

### 2.5 Styling & Token Contract

1. **Scoped CSS Injection**: Components inject their CSS stylesheets once into `document.head` using an explicit ID (e.g., `cradle-btn-styles`). If the element already exists, injection is skipped.
2. **BEM Naming Scheme**: Classes use the `cradle-<component>` namespace:
   - Block: `.cradle-card`
   - Element: `.cradle-card__header`
   - Modifier: `.cradle-card--clickable`, `.cradle-btn--primary`
3. **Design Tokens**: All colors, radiuses, shadows, transitions, and typography MUST reference `--cradle-*` tokens defined in `/src/components/ui/tokens.css` with inline fallbacks:
   ```css
   background: var(--cradle-surface, #111827);
   border-radius: var(--cradle-radius-md, 12px);
   ```

### 2.6 Event Contract

When components emit custom events, they MUST:
- Use the namespaced format: `cradle:<event-name>` (e.g. `cradle:themechange`).
- Bubble across the DOM (`bubbles: true`) unless there is a specific architectural reason to isolate.
- Place all structured payload data under `event.detail`:
  ```javascript
  const event = new CustomEvent('cradle:themechange', {
    bubbles: true,
    detail: { theme: 'dark' }
  });
  target.dispatchEvent(event);
  ```

### 2.7 Security & Sanitization Contract

To prevent Cross-Site Scripting (XSS) and DOM injection vulnerabilities:
- Any component that renders user-supplied text or rich HTML MUST use `CradleSanitize.sanitizeHtml` or `CradleEscape.escapeHtml`.
- SVG strings MUST be passed through `CradleSanitize.sanitizeSvg`.
- Dynamic CSS properties MUST be validated through `CradleSanitizeCss.sanitizeCssProperty`.
- URL attributes (`href`, `src`) MUST reject dangerous schemes (`javascript:`, `data:`, `vbscript:`).

### 2.8 Accessibility Contract (WCAG 2.1 AA)

All components MUST fulfill:
- Semantic HTML (`<button>`, `<nav>`, `<article>`, `<a>`).
- Visible focus rings for keyboard navigation (`:focus-visible`).
- Appropriate ARIA states (`aria-expanded`, `aria-busy`, `aria-checked`, `role="switch"`).
- Motion sensitivity: respect `@media (prefers-reduced-motion: reduce)`.

---

## 3. Ownership Boundaries & Responsibility Matrix

To prevent bloat and maintain architectural clarity, the codebase enforces strict boundaries:

| Layer | Location | Purpose & Criteria | Primary Consumers |
| :--- | :--- | :--- | :--- |
| **Shared UI Component Library** | `src/components/ui/<Component>/` | Generic, reusable UI primitives and navigation elements needed across $\ge 2$ minis or repo shell. | All minis (`projects/*`), landing page (`index.html`) |
| **Shared Foundational Utilities** | `src/components/ui/<utility>.js` | Non-DOM logic for security, sanitization, storage, and cross-cutting algorithms. | All minis, test suite, build scripts |
| **Mini-Local Components** | `projects/<category>/<slug>/` | Domain-specific widgets, simulation engines, game logic, or experimental single-project UI. | Exactly one mini |

### 3.1 What Belongs in `src/components/ui/`

A component belongs in the shared UI library if and only if:
1. **Multi-Project Utility**: It is used by, or immediately relevant to, at least two distinct mini-projects or the site chrome.
2. **Domain Agnostic**: It is completely free of game rules, audio frequencies, AI model configurations, or business domain logic.
3. **Standardized API**: It conforms to the `create()` / `upgradeAll()` contract and uses `--cradle-*` tokens.
4. **Zero External Dependencies**: It has zero npm or third-party CDN runtime dependencies.

### 3.2 What Remains in Mini-Specific Directories

The following MUST remain inside their respective project directories:
- Domain-specific controls (e.g. guitar fretboard, chess board, synth piano keys, camera ASCII grid).
- One-off visual toys or animations tightly coupled to a single canvas or WebGL renderer.
- Prototype components that have not yet stabilized their API or proven cross-project demand.

---

## 4. Versioning Strategy & Compatibility Guarantees

Cradle UI follows **Semantic Versioning (SemVer)**: `MAJOR.MINOR.PATCH`. The current version is exposed at `CradleUI.version`.

```javascript
console.log(window.CradleUI.version); // e.g. "1.0.0"
```

### 4.1 Zero-Build Static Monorepo Reality

In standard npm ecosystems, applications install pinned package versions via `package.json`. In Cradle, however:
- All 50+ minis load shared components directly from the monorepo source via relative paths (`../../../src/components/ui/index.js` or `../../../src/components/ui/Button/Button.js`).
- There is **no per-mini build step or lockfile**.
- A breaking change in `src/components/ui/` immediately impacts every mini in the repository simultaneously.

### 4.2 Semantic Change Definitions

| SemVer Increment | Allowed Changes | Impact on Minis |
| :--- | :--- | :--- |
| **PATCH** (`1.0.x`) | - Bug fixes<br>- Security hardening & sanitization fixes<br>- Internal performance optimizations<br>- WCAG accessibility fixes without DOM contract breakage | **Zero impact**: No consuming mini needs changes. Fully backwards compatible. |
| **MINOR** (`1.x.0`) | - New components added to `src/components/ui/`<br>- New optional parameters in `.create(options)`<br>- New `data-cradle-*` attributes supported in `.upgradeAll()`<br>- New design tokens in `tokens.css`<br>- New events emitted | **Zero impact**: Existing mini usage continues functioning without modification. Opt-in enhancements. |
| **MAJOR** (`x.0.0`) | - Removal or renaming of public methods<br>- Removal or renaming of `data-cradle-*` attributes<br>- Breaking changes in event payload signatures<br>- Removal of existing `--cradle-*` CSS tokens | **Requires coordinated migration**: Strict deprecation cycle mandatory. |

### 4.3 Deprecation & Evolution Policy

To evolve components safely without breaking existing minis:

1. **Non-Breaking Extension**: Always prefer adding new optional properties, variants, or tokens over changing existing ones.
2. **Deprecation Grace Period**:
   - If an API or attribute is slated for removal, it must be marked deprecated for at least one minor release cycle.
   - The deprecated API must log a single warning to `console.warn`:
     ```javascript
     console.warn('[CradleUI Deprecation] "data-logotext" is deprecated. Use "data-logo-text" instead.');
     ```
   - The component MUST continue to function identically for the deprecated pattern during the grace period.
3. **Repository-Wide Migration**: Before removing any deprecated API in a MAJOR release, the contributor must run an audit across all `projects/` and migrate existing consumers.

---

## 5. Component Evolution Lifecycle & Anti-Forking Workflow

A common failure mode in multi-project repositories is **ad-hoc copying (forking)**: an author needs a card or modal, finds that an existing shared component lacks one option, and copy-pastes 100 lines of CSS/JS into their local mini folder.

**Why Ad-Hoc Forking Is Prohibited**:
- Duplicated bugs and security gaps (sanitization patches don't propagate).
- Inconsistent keyboard navigation and accessibility behavior.
- Styling drift when global design tokens are updated.
- Bloated repository size and increased maintenance burden.

### 5.1 The 4-Stage Promotion Pipeline

To evolve components cleanly, contributors follow this pipeline:

```
┌─────────────────────────────────┐
│ 1. Local Mini Prototype         │  Authored in projects/<category>/<slug>/
└────────────────┬────────────────┘
                 │ Pattern needed in 2nd mini or repo chrome
                 ▼
┌─────────────────────────────────┐
│ 2. Promotion Proposal           │  Open issue / RFC to graduate to Shared UI
└────────────────┬────────────────┘
                 │ Approved by maintainers
                 ▼
┌─────────────────────────────────┐
│ 3. Shared Library Extraction    │  Implement in src/components/ui/<Component>/
│    & Hardening                  │  (create, upgradeAll, ARIA, tokens, security)
└────────────────┬────────────────┘
                 │ Unit tests verified & merged
                 ▼
┌─────────────────────────────────┐
│ 4. Monorepo Adoption            │  Update existing minis to consume shared UI;
│    & De-duplication             │  delete local duplicate copies
└─────────────────────────────────┘
```

### 5.2 Extension Over Forking

Before considering a copy or new component, use the library's built-in extension hooks:

1. **Composition**: Compose existing primitives together. A complex dialog can be built by composing `CradleCard` and `CradleButton` rather than inventing a new button style.
2. **Custom Class Names**: Pass a custom `className` to `.create({ className: 'my-custom-layout' })` to adjust layout or margins without altering component styles.
3. **CSS Variable Overrides**: Override design tokens locally on the container element:
   ```css
   .my-special-container {
     --cradle-accent: #10b981;
     --cradle-radius-md: 4px;
   }
   ```
4. **Upstream Contribution**: If a component needs a new variant (e.g. `variant: "warning"` for `CradleButton`), submit a PR to add it to `src/components/ui/Button/Button.js` so all minis benefit.

---

## 6. Contributor & Reviewer Checklist

Before opening or merging a PR touching `src/components/ui/`:

- [ ] **Contract Compliance**: Does the component provide both `create(options)` and `upgradeAll()`?
- [ ] **Global Export**: Is it exposed as `window.Cradle<ComponentName>` and registered in `src/components/ui/index.js`?
- [ ] **Tokens & Theming**: Are all colors and dimensions derived from `--cradle-*` tokens in `tokens.css` with fallbacks?
- [ ] **Security**: Are all dynamic strings passed through `CradleSanitize` or `CradleEscape`?
- [ ] **Accessibility**: Does it include visible focus rings, proper ARIA attributes, semantic tags, and reduced-motion support?
- [ ] **Zero Dependencies**: Is it 100% vanilla JavaScript without npm runtime dependencies?
- [ ] **Backwards Compatibility**: Does this change preserve full backwards compatibility for all existing minis?
- [ ] **Documentation**: Is `src/components/ui/README.md` updated with API tables and usage examples?

