const STORAGE_KEY = "theme";

export const THEME_MODES = Object.freeze({
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
});

export function getSystemTheme() {
  if (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function currentMode() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") {
    return saved;
  }
  return "system";
}

export function currentTheme() {
  return document.documentElement.classList.contains("light-theme")
    ? "light"
    : "dark";
}

export function applyHighContrast() {
  if (typeof window === "undefined" || !window.matchMedia) return;
  const contrastMore = Boolean(
    window.matchMedia("(prefers-contrast: more)")?.matches
  );
  const forcedColors = Boolean(
    window.matchMedia("(forced-colors: active)")?.matches
  );

  document.documentElement.classList.toggle(
    "high-contrast",
    contrastMore || forcedColors
  );
  document.documentElement.classList.toggle("forced-colors", forcedColors);
}

export function applyTheme(themeOrMode, { persist = true } = {}) {
  const html = document.documentElement;
  const button = document.getElementById("themeToggle");

  let mode = themeOrMode || "system";
  let visualTheme;

  if (mode === "system") {
    visualTheme = getSystemTheme();
  } else if (mode === "light") {
    visualTheme = "light";
  } else {
    mode = "dark";
    visualTheme = "dark";
  }

  html.classList.toggle("light-theme", visualTheme === "light");

  if (persist) {
    localStorage.setItem(STORAGE_KEY, mode);
  }

  if (button) {
    const icon =
      mode === "system" ? "💻" : visualTheme === "light" ? "☀️" : "🌙";
    button.textContent = icon;

    const nextMode =
      mode === "dark" ? "light" : mode === "light" ? "system" : "dark";
    button.setAttribute("aria-label", `Switch to ${nextMode} theme`);
    button.setAttribute("aria-pressed", visualTheme === "light");
    button.setAttribute("data-theme-mode", mode);
  }

  html.dispatchEvent(
    new CustomEvent("cradle:themechange", {
      detail: { theme: visualTheme, mode },
      bubbles: false,
    })
  );
}

export function toggleTheme() {
  const mode = currentMode();
  const nextMode =
    mode === "dark" ? "light" : mode === "light" ? "system" : "dark";
  applyTheme(nextMode);
}

export function initTheme() {
  applyHighContrast();
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") {
    applyTheme(saved, { persist: true });
  } else {
    applyTheme("system", { persist: Boolean(saved) });
  }
}

if (typeof window !== "undefined" && window.matchMedia) {
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const onSchemeChange = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved || saved === "system") {
      applyTheme("system", { persist: false });
    }
  };
  darkQuery?.addEventListener?.("change", onSchemeChange);

  const contrastQuery = window.matchMedia("(prefers-contrast: more)");
  const forcedQuery = window.matchMedia("(forced-colors: active)");
  contrastQuery?.addEventListener?.("change", applyHighContrast);
  forcedQuery?.addEventListener?.("change", applyHighContrast);
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  document
    .getElementById("themeToggle")
    ?.addEventListener("click", toggleTheme);
});

window.toggleTheme = toggleTheme;
