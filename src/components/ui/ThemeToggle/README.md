# ThemeToggle

A reusable 3-way theme toggle component with automatic system preference detection and high-contrast accessibility adaptation. See `ThemeToggle.js` for full source and implementation.

## Features

- **3-Way Mode**: Light (`☀️`), Dark (`🌙`), and System Default (`💻`).
- **System Preference Auto-Detection**: Uses `window.matchMedia('(prefers-color-scheme: dark)')` to adapt dynamically to OS light/dark scheduling when in System mode.
- **High-Contrast & Forced-Colors Adaptation**: Automatically detects `(prefers-contrast: more)` and `(forced-colors: active)` (Windows High Contrast / Contrast Themes), adding `high-contrast` and `forced-colors` classes to `document.documentElement` and adjusting borders, outlines, and system colors.
- **Accessible Tri-State Switch**: `role="switch"` with `aria-checked` (`"true"` for light, `"false"` for dark, `"mixed"` for system), dynamic `aria-label`, and `data-theme-mode`.

## Events

### `cradle:themechange`

Dispatched on `document.documentElement` every time the theme or mode changes — whether triggered by clicking a toggle button, calling `applyTheme`/`setMode`/`toggleTheme`, or by an OS-level `prefers-color-scheme` change while in System mode.

```js
document.documentElement.addEventListener("cradle:themechange", e => {
  console.log(e.detail.theme); // "light" | "dark"
  console.log(e.detail.mode); // "light" | "dark" | "system"
});
```

**Payload:** `event.detail` — `{ theme: 'light' | 'dark', mode: 'light' | 'dark' | 'system' }`

### `cradle:contrastchange`

Dispatched on `document.documentElement` whenever the OS contrast preference or forced-colors mode changes.

```js
document.documentElement.addEventListener("cradle:contrastchange", e => {
  console.log("High contrast active:", e.detail.highContrast);
  console.log("Forced colors active:", e.detail.forcedColors);
});
```

**Payload:** `event.detail` — `{ highContrast: boolean, forcedColors: boolean }`

## API (`window.CradleThemeToggle`)

- `init()`: Initializes theme and high-contrast adaptation as early as possible.
- `create({ size: 'sm'|'md'|'lg', className: '' })`: Creates a new theme toggle button.
- `upgradeAll()`: Auto-mounts all `[data-cradle-theme-toggle]` elements on the page.
- `applyTheme(themeOrMode, { persist = true })`: Sets and optionally persists theme/mode.
- `toggleTheme(explicitMode = null)`: Cycles between `dark` → `light` → `system` → `dark` (or sets explicit mode).
- `setMode(mode)`: Sets mode explicitly (`"light"`, `"dark"`, `"system"`).
- `currentTheme()`: Returns the currently applied visual theme (`"light"` | `"dark"`).
- `currentMode()`: Returns the current mode setting (`"light"` | `"dark"` | `"system"`).
- `getSystemTheme()`: Queries OS color scheme preference via `matchMedia`.
- `isHighContrast()`: Returns whether increased contrast or forced colors is active.
- `isForcedColors()`: Returns whether forced colors mode is active.
- `applyHighContrastAdaptation()`: Evaluates contrast queries and synchronizes `<html>` classes.
- `THEME_MODES`: `{ LIGHT: "light", DARK: "dark", SYSTEM: "system" }`.
