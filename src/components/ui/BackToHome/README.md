# Cradle UI — BackToHome & Breadcrumb Component

A lightweight, accessible, zero-dependency navigation component that standardizes returning to the root project hub from any mini-project in the Cradle workspace.

---

## Key Features

1. **Global Keyboard Shortcut (`Alt+H`)**:
   - Return home instantly from any mini-project by pressing `Alt+H`.
   - Accessible keyboard metadata via `aria-keyshortcuts="Alt+H"`.
   - Built-in guard ignoring shortcut triggers when users are typing in interactive inputs, textareas, selects, or content-editable elements.
   - Optional visual `<kbd class="cradle-back-home__kbd">Alt+H</kbd>` shortcut badge.

2. **Accessible Breadcrumb Context (`Home > [Category] > [Project Title]`)**:
   - Structured WAI-ARIA 1.2 Breadcrumb navigation pattern (`<nav aria-label="Breadcrumb">` with `<ol>` and `<li>` items).
   - Separators marked with `aria-hidden="true"`.
   - Current project item marked with `aria-current="page"`.
   - Category segment links to the homepage filtered by that category.

3. **Active Category Filter Retention (`?category=...`)**:
   - Automatically detects current project category from URL parameters, `document.referrer`, or folder paths (`/projects/<category>/<project-name>/`).
   - Category link in breadcrumb navigates to `/?category=<category>`.
   - Retains category state when navigating back via pill button or shortcut when `retainCategory: true`.

4. **Design Tokens & Theme Adaptation**:
   - Styled using Cradle UI CSS variables (`--cradle-accent`, `--cradle-text`, `--cradle-border`, etc.).
   - Full support for dark mode, light mode, and high-contrast / `forced-colors: active` environments.
   - Respects `prefers-reduced-motion: reduce`.

---

## Installation & Loading

### 1. Drop-in Script Tag (Recommended for Minis)

Include the script with `defer` inside `<head>` or before `</body>`:

```html
<script src="../../../src/components/ui/BackToHome/BackToHome.js" defer></script>
```

When loaded on any mini-project page, it automatically computes the relative path to `index.html`, detects the active category, binds the `Alt+H` shortcut, and mounts a floating pill button.

---

## JavaScript API

### `CradleBackToHome.create(options)`

Returns an anchor element (`<a>`) or breadcrumb nav (`<nav>` when `variant === 'breadcrumb'`).

```javascript
const btn = CradleBackToHome.create({
  to: '/index.html',           // Optional custom URL (default: computed relative root)
  label: 'Back to Home',       // Button text (default: 'Back to Home')
  variant: 'pill',             // 'pill' (default) | 'minimal' | 'breadcrumb'
  category: 'dev-tools',       // Category slug (auto-detected if omitted)
  projectTitle: 'Regex Tester',// Title text (auto-detected if omitted)
  retainCategory: true,        // Preserve ?category=... on return
  showShortcutBadge: true,     // Render <kbd>Alt+H</kbd> badge
  enableShortcut: true,        // Bind global Alt+H listener (default: true)
  shortcutKey: 'Alt+H',        // Shortcut key label (default: 'Alt+H')
  onNavigate: null,            // Custom navigation callback
});
document.body.appendChild(btn);
```

### `CradleBackToHome.createBreadcrumb(options)`

Creates an accessible breadcrumb navigation bar:

```javascript
const breadcrumb = CradleBackToHome.createBreadcrumb({
  category: 'dev-tools',        // Auto-detected from path if omitted
  categoryLabel: 'Dev Tools',   // Formatted label (e.g. 'Dev Tools')
  projectTitle: 'URL Parser',   // Current page title
  retainCategory: true,         // Category crumb links to /?category=dev-tools
  showShortcutBadge: false,     // Render <kbd>Alt+H</kbd> on Home crumb
  enableShortcut: true,         // Bind global Alt+H shortcut
});

// Mount at the top of your page container
document.querySelector('.container').prepend(breadcrumb);
```

### `CradleBackToHome.autoInject(options)`

Automatically creates and mounts the back button on non-home pages:

```javascript
CradleBackToHome.autoInject({
  breadcrumb: true,             // Also prepends breadcrumb navigation
  retainCategory: true,         // Preserve category filter
  showShortcutBadge: true,      // Display Alt+H badge
});
```

### `CradleBackToHome.upgradeAll()`

Scans the DOM and upgrades declarative HTML attributes. Safe to run multiple times.

---

## Declarative HTML Usage

### Floating / Inline Button
```html
<a
  data-cradle-back-to-home
  data-label="Back to Hub"
  data-retain-category="true"
  data-show-shortcut-badge="true"
></a>
```

### Breadcrumb Navigation
```html
<nav
  data-cradle-breadcrumb
  data-category="games"
  data-project-title="Chess"
  data-retain-category="true"
></nav>
```

---

## Global Shortcut Control

```javascript
// Register or update global Alt+H shortcut
CradleBackToHome.registerGlobalShortcut('/index.html?category=dev-tools');

// Remove shortcut listener (e.g., in unit tests or custom cleanup)
CradleBackToHome.unregisterGlobalShortcut();
```

---

## Accessibility (a11y) Verification

- **WAI-ARIA 1.2 Breadcrumb Pattern**: Uses `<nav aria-label="Breadcrumb">` wrapping an ordered list (`<ol>`).
- **Separators**: Decorative separators carry `aria-hidden="true"`.
- **Current Page**: The active project title carries `aria-current="page"`.
- **Keyboard Navigation**: Home and Category links are reachable via Tab. `Alt+H` triggers navigation directly.
- **Shortcuts**: Exposed to assistive tech via `aria-keyshortcuts="Alt+H"`.
- **Interactive Focus**: Clear `:focus-visible` outline rings conforming to WCAG 2.1 AA.

