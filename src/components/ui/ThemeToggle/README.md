# ThemeToggle

A reusable light/dark theme toggle component. See `ThemeToggle.js` for full usage and API.

## Events

### `cradle:themechange`

Dispatched on `document.documentElement` every time the theme changes — whether triggered by clicking a toggle button or by an OS-level `prefers-color-scheme` change (only when the user hasn't manually set a preference).

```js
document.documentElement.addEventListener("cradle:themechange", (e) => {
  console.log(e.detail.theme); // "light" | "dark"
});
```

**Payload:** `event.detail.theme` — `"light"` or `"dark"`

**Why it exists:** `ThemeToggle.js` listens to this event internally so that if a page has multiple toggle instances, they all stay visually in sync when any one of them is clicked. It is also exposed as a public hook so other projects in this repo (or pages embedding this component) can react to theme changes — for example, to swap a canvas background color, re-render a chart with theme-aware colors, or update a `<meta name="theme-color">` tag — without polling `document.documentElement.classList`.

No project currently consumes this event externally; it is documented here so future contributors have a supported way to hook into theme changes instead of re-implementing their own detection.