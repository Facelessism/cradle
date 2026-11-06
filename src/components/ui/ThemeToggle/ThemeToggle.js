/**
 * Cradle UI — ThemeToggle Component
 * ────────────────────────────────────
 * A reusable 3-way light/dark/system theme toggle with automatic adaptation
 * for OS-level preferences and accessibility high-contrast / forced-colors modes.
 *
 * Features:
 *  - 3-way mode: Light (☀️), Dark (🌙), System Default (💻)
 *  - Detects saved preference through CradleStorage (key: "theme")
 *  - Dynamic system auto-detection via matchMedia('(prefers-color-scheme: dark)')
 *  - Real-time adaptation for forced-colors and prefers-contrast: more
 *  - Toggles <html class="light-theme">, <html class="high-contrast">, <html class="forced-colors">
 *  - Tri-state accessible switch: role="switch", aria-checked ("true"|"false"|"mixed"), aria-label
 *  - Dispatches custom "cradle:themechange" and "cradle:contrastchange" events on <html>
 *  - Can be dropped anywhere; multiple instances stay in sync
 *
 * Events:
 *   cradle:themechange — dispatched on document.documentElement whenever
 *   the theme or mode changes. event.detail = { theme: 'light' | 'dark', mode: 'light' | 'dark' | 'system' }.
 *
 *   cradle:contrastchange — dispatched on document.documentElement whenever
 *   high-contrast or forced-colors state changes. event.detail = { highContrast: boolean, forcedColors: boolean }.
 *
 * Usage (create programmatically):
 *   const toggle = CradleThemeToggle.create({ size: 'md' });
 *   document.querySelector('.hero-actions').appendChild(toggle);
 *
 * Usage (HTML — auto-mounted on DOMContentLoaded):
 *   <button data-cradle-theme-toggle></button>
 *
 * Props / data attributes:
 *   size  sm | md | lg   default: md
 */

(function (global) {
  "use strict";

  const STYLE_ID = "cradle-theme-toggle-styles";
  const STORAGE_KEY = "theme";
  const LIGHT_CLASS = "light-theme";
  const HIGH_CONTRAST_CLASS = "high-contrast";
  const FORCED_COLORS_CLASS = "forced-colors";

  const THEME_MODES = Object.freeze({
    LIGHT: "light",
    DARK: "dark",
    SYSTEM: "system",
  });

  /* ── Styles ───────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .cradle-theme-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--cradle-border, #374151);
        border-radius: var(--cradle-radius-pill, 999px);
        background: var(--cradle-surface, #111827);
        color: var(--cradle-text, #f3f4f6);
        cursor: pointer;
        transition:
          background-color var(--cradle-transition, 0.35s cubic-bezier(0.22,1,0.36,1)),
          border-color var(--cradle-transition, 0.35s cubic-bezier(0.22,1,0.36,1)),
          transform var(--cradle-transition-fast, 0.15s ease),
          box-shadow var(--cradle-transition, 0.35s cubic-bezier(0.22,1,0.36,1));
      }

      .cradle-theme-toggle:focus-visible {
        outline: 2px solid var(--color-accent, var(--cradle-accent-hover, #2563eb));
        outline-offset: 2px;
        border-radius: 4px;
      }
      .cradle-theme-toggle:focus:not(:focus-visible) {
        outline: none;
      }

      .cradle-theme-toggle:hover {
        transform: translateY(-2px);
        border-color: var(--cradle-accent-hover, #2563eb);
        box-shadow: 0 8px 20px rgba(37, 99, 235, 0.15);
      }

      .cradle-theme-toggle:active {
        transform: scale(0.94);
      }

      /* Sizes */
      .cradle-theme-toggle--sm { width: 36px; height: 36px; font-size: 1rem; }
      .cradle-theme-toggle--md { width: 48px; height: 48px; font-size: 1.1rem; }
      .cradle-theme-toggle--lg { width: 58px; height: 58px; font-size: 1.3rem; }

      /* Icon animation */
      .cradle-theme-toggle__icon {
        display: inline-block;
        transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
                    opacity 0.2s ease;
        line-height: 1;
        user-select: none;
      }

      .cradle-theme-toggle--spinning .cradle-theme-toggle__icon {
        transform: rotate(30deg) scale(0.8);
        opacity: 0;
      }

      /* ── Accessibility: High Contrast & Forced Colors Adaptation ── */
      @media (prefers-contrast: more) {
        .cradle-theme-toggle {
          border-width: 2px !important;
          border-color: currentColor !important;
        }
        .cradle-theme-toggle:focus-visible {
          outline: 3px solid currentColor !important;
          outline-offset: 3px !important;
        }
      }

      @media (forced-colors: active) {
        .cradle-theme-toggle {
          forced-color-adjust: none;
          border: 2px solid ButtonText !important;
          background: ButtonFace !important;
          color: ButtonText !important;
        }
        .cradle-theme-toggle:focus-visible {
          outline: 3px solid Highlight !important;
          outline-offset: 2px !important;
        }
        .cradle-theme-toggle:hover {
          border-color: Highlight !important;
          box-shadow: none !important;
        }
      }

      html.high-contrast .cradle-theme-toggle {
        border-width: 2px;
        border-color: currentColor;
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Theme helpers ────────────────────────────────────── */
  function getStoredTheme() {
    const storage = global.CradleStorage;
    if (!storage || typeof storage.getRaw !== "function") return null;
    return storage.getRaw(STORAGE_KEY);
  }

  function storeTheme(theme) {
    const storage = global.CradleStorage;
    if (!storage || typeof storage.setRaw !== "function") return false;
    return storage.setRaw(STORAGE_KEY, theme);
  }

  function getSystemTheme() {
    if (typeof window !== "undefined" && window.matchMedia) {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
      if (window.matchMedia("(prefers-color-scheme: light)").matches) {
        return "light";
      }
    }
    return "dark";
  }

  function currentMode() {
    const stored = getStoredTheme();
    if (
      stored === THEME_MODES.LIGHT ||
      stored === THEME_MODES.DARK ||
      stored === THEME_MODES.SYSTEM
    ) {
      return stored;
    }
    return THEME_MODES.SYSTEM;
  }

  function currentTheme() {
    return document.documentElement.classList.contains(LIGHT_CLASS)
      ? "light"
      : "dark";
  }

  function resolveTheme(mode = null) {
    const activeMode = mode || currentMode();
    if (activeMode === THEME_MODES.LIGHT) return "light";
    if (activeMode === THEME_MODES.DARK) return "dark";
    return getSystemTheme();
  }

  function applyTheme(themeOrMode, { persist = true } = {}) {
    let mode;
    let visualTheme;

    if (themeOrMode === THEME_MODES.SYSTEM) {
      mode = THEME_MODES.SYSTEM;
      visualTheme = getSystemTheme();
    } else if (themeOrMode === THEME_MODES.LIGHT) {
      mode = THEME_MODES.LIGHT;
      visualTheme = "light";
    } else if (themeOrMode === THEME_MODES.DARK) {
      mode = THEME_MODES.DARK;
      visualTheme = "dark";
    } else {
      mode = THEME_MODES.SYSTEM;
      visualTheme = getSystemTheme();
    }

    const html = document.documentElement;
    if (visualTheme === "light") {
      html.classList.add(LIGHT_CLASS);
    } else {
      html.classList.remove(LIGHT_CLASS);
    }

    if (persist) {
      storeTheme(mode);
    }

    /* Update meta theme-color if present to match the active theme */
    if (
      typeof document !== "undefined" &&
      typeof document.querySelector === "function"
    ) {
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme && typeof metaTheme.setAttribute === "function") {
        metaTheme.setAttribute(
          "content",
          visualTheme === "light" ? "#f5f7fb" : "#05070d"
        );
      }
    }

    /* Notify all registered toggle instances and external listeners */
    html.dispatchEvent(
      new CustomEvent("cradle:themechange", {
        detail: {
          theme: visualTheme,
          mode: mode,
        },
        bubbles: false,
      })
    );
  }

  /* 3-way toggle sequence: dark -> light -> system -> dark */
  function getNextMode(mode) {
    if (mode === THEME_MODES.DARK) return THEME_MODES.LIGHT;
    if (mode === THEME_MODES.LIGHT) return THEME_MODES.SYSTEM;
    return THEME_MODES.DARK;
  }

  function toggleTheme(explicitMode = null) {
    if (
      explicitMode &&
      (explicitMode === THEME_MODES.LIGHT ||
        explicitMode === THEME_MODES.DARK ||
        explicitMode === THEME_MODES.SYSTEM)
    ) {
      applyTheme(explicitMode, { persist: true });
      return;
    }
    const nextMode = getNextMode(currentMode());
    applyTheme(nextMode, { persist: true });
  }

  /* ── Icon & Accessibility Mappers ─────────────────────── */
  function iconFor(theme, mode = null) {
    const activeMode = mode || currentMode();
    if (activeMode === THEME_MODES.SYSTEM) return "💻";
    if (activeMode === THEME_MODES.LIGHT || theme === "light") return "☀️";
    return "🌙";
  }

  function labelFor(theme, mode = null) {
    const activeMode = mode || currentMode();
    const next = getNextMode(activeMode);
    if (next === THEME_MODES.LIGHT) return "Switch to light theme";
    if (next === THEME_MODES.DARK) return "Switch to dark theme";
    return "Switch to system theme";
  }

  function titleFor(theme, mode = null) {
    const activeMode = mode || currentMode();
    const next = getNextMode(activeMode);
    return `Theme mode: ${activeMode} (active: ${theme}). Switch to ${next} theme.`;
  }

  function ariaCheckedFor(theme, mode = null) {
    const activeMode = mode || currentMode();
    if (activeMode === THEME_MODES.SYSTEM) return "mixed";
    return theme === "light" ? "true" : "false";
  }

  /* ── Sync all toggle instances ────────────────────────── */
  function syncAll(theme, mode = null) {
    const activeMode = mode || currentMode();
    document.querySelectorAll(".cradle-theme-toggle").forEach(btn => {
      btn.setAttribute("aria-checked", ariaCheckedFor(theme, activeMode));
      btn.setAttribute("aria-label", labelFor(theme, activeMode));
      btn.setAttribute("data-theme-mode", activeMode);
      btn.title = titleFor(theme, activeMode);
      const icon = btn.querySelector(".cradle-theme-toggle__icon");
      if (icon) icon.textContent = iconFor(theme, activeMode);
    });
  }

  /* Listen for theme changes from any source */
  document.documentElement.addEventListener("cradle:themechange", e => {
    syncAll(e.detail.theme, e.detail.mode);
  });

  /* ── OS Preference Listeners ──────────────────────────── */
  if (typeof window !== "undefined" && window.matchMedia) {
    const darkMedia = window.matchMedia("(prefers-color-scheme: dark)");
    const lightMedia = window.matchMedia("(prefers-color-scheme: light)");

    const onSchemeChange = () => {
      /* Only follow OS change if user hasn't set an explicit manual preference (i.e. is in system mode) */
      const stored = getStoredTheme();
      if (!stored || stored === THEME_MODES.SYSTEM) {
        applyTheme(THEME_MODES.SYSTEM, { persist: false });
      }
    };

    if (darkMedia) {
      if (typeof darkMedia.addEventListener === "function") {
        darkMedia.addEventListener("change", onSchemeChange);
      } else if (typeof darkMedia.addListener === "function") {
        darkMedia.addListener(onSchemeChange);
      }
    }

    if (lightMedia) {
      if (typeof lightMedia.addEventListener === "function") {
        lightMedia.addEventListener("change", onSchemeChange);
      } else if (typeof lightMedia.addListener === "function") {
        lightMedia.addListener(onSchemeChange);
      }
    }
  }

  /* ── High Contrast & Forced Colors Detection ──────────── */
  function isHighContrast() {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    try {
      const moreContrast = Boolean(
        window.matchMedia("(prefers-contrast: more)")?.matches
      );
      const forced = Boolean(
        window.matchMedia("(forced-colors: active)")?.matches
      );
      return moreContrast || forced;
    } catch {
      return false;
    }
  }

  function isForcedColors() {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    try {
      return Boolean(window.matchMedia("(forced-colors: active)")?.matches);
    } catch {
      return false;
    }
  }

  function applyHighContrastAdaptation() {
    if (typeof document === "undefined" || !document.documentElement) return;
    const html = document.documentElement;
    const highContrast = isHighContrast();
    const forcedColors = isForcedColors();

    if (highContrast) {
      html.classList.add(HIGH_CONTRAST_CLASS);
    } else {
      html.classList.remove(HIGH_CONTRAST_CLASS);
    }

    if (forcedColors) {
      html.classList.add(FORCED_COLORS_CLASS);
    } else {
      html.classList.remove(FORCED_COLORS_CLASS);
    }

    html.dispatchEvent(
      new CustomEvent("cradle:contrastchange", {
        detail: {
          highContrast,
          forcedColors,
        },
        bubbles: false,
      })
    );
  }

  if (typeof window !== "undefined" && window.matchMedia) {
    const contrastMedia = window.matchMedia("(prefers-contrast: more)");
    const forcedColorsMedia = window.matchMedia("(forced-colors: active)");

    const onContrastChange = () => {
      applyHighContrastAdaptation();
    };

    if (contrastMedia) {
      if (typeof contrastMedia.addEventListener === "function") {
        contrastMedia.addEventListener("change", onContrastChange);
      } else if (typeof contrastMedia.addListener === "function") {
        contrastMedia.addListener(onContrastChange);
      }
    }

    if (forcedColorsMedia) {
      if (typeof forcedColorsMedia.addEventListener === "function") {
        forcedColorsMedia.addEventListener("change", onContrastChange);
      } else if (typeof forcedColorsMedia.addListener === "function") {
        forcedColorsMedia.addListener(onContrastChange);
      }
    }
  }

  /* ── Factory ──────────────────────────────────────────── */
  const CradleThemeToggle = {
    /**
     * Initialise the theme on the page.
     * Should be called as early as possible to avoid flash of wrong theme.
     */
    init() {
      applyHighContrastAdaptation();
      const storedTheme = getStoredTheme();
      if (!storedTheme || storedTheme === THEME_MODES.SYSTEM) {
        applyTheme(THEME_MODES.SYSTEM, {
          persist: Boolean(storedTheme),
        });
      } else {
        applyTheme(storedTheme, {
          persist: true,
        });
      }
    },

    /**
     * Create a ThemeToggle button element.
     * @param {Object} options
     * @param {'sm'|'md'|'lg'} [options.size='md']
     * @param {string} [options.className='']
     * @returns {HTMLButtonElement}
     */
    create({ size = "md", className = "" } = {}) {
      injectStyles();
      const theme = currentTheme();
      const mode = currentMode();

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = [
        "cradle-theme-toggle",
        `cradle-theme-toggle--${size}`,
        className,
      ]
        .filter(Boolean)
        .join(" ");

      btn.setAttribute("role", "switch");
      btn.setAttribute("aria-checked", ariaCheckedFor(theme, mode));
      btn.setAttribute("aria-label", labelFor(theme, mode));
      btn.setAttribute("data-theme-mode", mode);
      btn.title = titleFor(theme, mode);

      const icon = document.createElement("span");
      icon.className = "cradle-theme-toggle__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = iconFor(theme, mode);
      btn.appendChild(icon);

      btn.addEventListener("click", () => {
        /* Spin animation */
        btn.classList.add("cradle-theme-toggle--spinning");
        setTimeout(
          () => btn.classList.remove("cradle-theme-toggle--spinning"),
          200
        );

        toggleTheme();
      });

      return btn;
    },

    /**
     * Mount on all [data-cradle-theme-toggle] elements.
     */
    upgradeAll() {
      injectStyles();
      document.querySelectorAll("[data-cradle-theme-toggle]").forEach(el => {
        if (el.dataset.cradleUpgraded) return;
        el.dataset.cradleUpgraded = "true";

        const size = el.dataset.size || "md";
        const theme = currentTheme();
        const mode = currentMode();

        el.classList.add("cradle-theme-toggle", `cradle-theme-toggle--${size}`);
        el.setAttribute("role", "switch");
        el.setAttribute("aria-checked", ariaCheckedFor(theme, mode));
        el.setAttribute("aria-label", labelFor(theme, mode));
        el.setAttribute("data-theme-mode", mode);
        el.title = titleFor(theme, mode);
        el.type = "button";

        /* Replace inner content with icon span */
        el.innerHTML = "";
        const icon = document.createElement("span");
        icon.className = "cradle-theme-toggle__icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = iconFor(theme, mode);
        el.appendChild(icon);

        el.addEventListener("click", () => {
          el.classList.add("cradle-theme-toggle--spinning");
          setTimeout(
            () => el.classList.remove("cradle-theme-toggle--spinning"),
            200
          );
          toggleTheme();
        });
      });
    },

    /* Expose helpers */
    applyTheme,
    toggleTheme,
    currentTheme,
    currentMode,
    setMode(mode) {
      applyTheme(mode, { persist: true });
    },
    getSystemTheme,
    isHighContrast,
    isForcedColors,
    applyHighContrastAdaptation,
    THEME_MODES,
  };

  /* Init theme immediately (prevents FOIT) */
  CradleThemeToggle.init();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () =>
      CradleThemeToggle.upgradeAll()
    );
  } else {
    CradleThemeToggle.upgradeAll();
  }

  global.CradleThemeToggle = CradleThemeToggle;
})(window);
