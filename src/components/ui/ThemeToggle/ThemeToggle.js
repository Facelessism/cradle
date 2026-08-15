/**
 * Cradle UI — ThemeToggle Component
 * ────────────────────────────────────
 * A reusable light/dark theme toggle.
 *
 * Features:
 *  - Detects saved preference from localStorage (key: "theme")
 *  - Falls back to OS-level prefers-color-scheme
 *  - Toggles <html class="light-theme"> — same convention as the homepage
 *  - Animated icon transition (moon ↔ sun)
 *  - Accessible: role="switch", aria-checked, aria-label
*  - Dispatches a custom "cradle:themechange" event on <html>
 *  - Can be dropped anywhere; multiple instances stay in sync
 *
 * Events:
 *   cradle:themechange — dispatched on document.documentElement whenever
 *   the theme changes (toggle click or OS preference change, if the user
 *   hasn't set a manual preference). event.detail = { theme: 'light' | 'dark' }.
 *   This component listens to it internally to keep all toggle instances
 *   on the page in sync. It is also a public hook other projects/pages can
 *   use to react to theme changes without polling <html> class list, e.g.:
 *
 *     document.documentElement.addEventListener('cradle:themechange', (e) => {
 *       console.log('theme is now', e.detail.theme);
 *     });
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
        outline: 2px solid var(--cradle-accent-hover, #2563eb);
        outline-offset: 3px;
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
    `;
    document.head.appendChild(style);
  }

  /* ── Theme helpers ────────────────────────────────────── */
  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }

  function getSystemTheme() {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  function resolveTheme() {
    return getStoredTheme() || getSystemTheme();
  }

  function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === "light") {
      html.classList.add(LIGHT_CLASS);
    } else {
      html.classList.remove(LIGHT_CLASS);
    }
    storeTheme(theme);

    /* Notify all registered toggle instances */
    html.dispatchEvent(
      new CustomEvent("cradle:themechange", {
        detail: { theme },
        bubbles: false,
      })
    );
  }

  function currentTheme() {
    return document.documentElement.classList.contains(LIGHT_CLASS)
      ? "light"
      : "dark";
  }

  function toggleTheme() {
    applyTheme(currentTheme() === "light" ? "dark" : "light");
  }

  /* ── Icon mapper ──────────────────────────────────────── */
  function iconFor(theme) {
    return theme === "light" ? "☀️" : "🌙";
  }

  function labelFor(theme) {
    return theme === "light" ? "Switch to dark theme" : "Switch to light theme";
  }

  /* ── Sync all toggle instances ────────────────────────── */
  function syncAll(theme) {
    document.querySelectorAll(".cradle-theme-toggle").forEach(btn => {
      btn.setAttribute("aria-checked", theme === "light" ? "true" : "false");
      btn.setAttribute("aria-label", labelFor(theme));
      const icon = btn.querySelector(".cradle-theme-toggle__icon");
      if (icon) icon.textContent = iconFor(theme);
    });
  }

  /* Listen for theme changes from any source */
  document.documentElement.addEventListener("cradle:themechange", e => {
    syncAll(e.detail.theme);
  });

  /* Also listen for OS preference changes */
  if (window.matchMedia) {
    window
      .matchMedia("(prefers-color-scheme: light)")
      .addEventListener("change", e => {
        /* Only follow OS change if user hasn't set a manual preference */
        if (!getStoredTheme()) {
          applyTheme(e.matches ? "light" : "dark");
        }
      });
  }

  /* ── Factory ──────────────────────────────────────────── */
  const CradleThemeToggle = {
    /**
     * Initialise the theme on the page.
     * Should be called as early as possible (ideally in <head>)
     * to avoid flash of wrong theme.
     */
    init() {
      applyTheme(resolveTheme());
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
      btn.setAttribute("aria-checked", theme === "light" ? "true" : "false");
      btn.setAttribute("aria-label", labelFor(theme));

      const icon = document.createElement("span");
      icon.className = "cradle-theme-toggle__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = iconFor(theme);
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

        el.classList.add("cradle-theme-toggle", `cradle-theme-toggle--${size}`);
        el.setAttribute("role", "switch");
        el.setAttribute("aria-checked", theme === "light" ? "true" : "false");
        el.setAttribute("aria-label", labelFor(theme));
        el.type = "button";

        /* Replace inner content with icon span */
        el.innerHTML = "";
        const icon = document.createElement("span");
        icon.className = "cradle-theme-toggle__icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = iconFor(theme);
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
