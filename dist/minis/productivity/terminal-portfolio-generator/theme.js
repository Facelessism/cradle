/**
 * Themes - Terminal color scheme configuration & lookup
 */
(function (exports) {
  const THEMES = {
    "classic-green": {
      id: "classic-green",
      label: "Classic Green",
      bg: "#0c0c0c",
      fg: "#33ff33",
      accent: "#00ff00",
      cursor: "#33ff33",
      dim: "#1f7a1f",
      error: "#ff5555"
    },
    blue: {
      id: "blue",
      label: "Blue",
      bg: "#0a0e1a",
      fg: "#61afef",
      accent: "#528bff",
      cursor: "#61afef",
      dim: "#2c3a55",
      error: "#e06c75"
    },
    amber: {
      id: "amber",
      label: "Amber",
      bg: "#1a1207",
      fg: "#ffb000",
      accent: "#ffcc66",
      cursor: "#ffb000",
      dim: "#7a5200",
      error: "#ff6b4a"
    },
    light: {
      id: "light",
      label: "Light",
      bg: "#f5f5f5",
      fg: "#1e1e1e",
      accent: "#0057d8",
      cursor: "#1e1e1e",
      dim: "#8a8a8a",
      error: "#c02020"
    }
  };

  const DEFAULT_THEME_ID = "classic-green";

  /**
   * Returns an array of theme ids in a stable, defined display order.
   * @returns {string[]}
   */
  function getThemeIds() {
    return ["classic-green", "blue", "amber", "light"];
  }

  /**
   * Looks up a theme by id, falling back to the default theme
   * if the id is missing or unrecognized.
   * @param {string} id
   * @returns {Object} theme object (never null/undefined)
   */
  function getTheme(id) {
    if (typeof id === "string" && THEMES[id]) {
      return THEMES[id];
    }
    return THEMES[DEFAULT_THEME_ID];
  }

  /**
   * Converts a theme object into a map of CSS custom property
   * names to values. Pure function, no DOM access — the caller
   * (script.js) is responsible for applying these to an element.
   * @param {Object} theme
   * @returns {Object} e.g. { "--term-bg": "#0c0c0c", ... }
   */
  function themeToCssVars(theme) {
    const t = theme && theme.id ? theme : getTheme(DEFAULT_THEME_ID);
    return {
      "--term-bg": t.bg,
      "--term-fg": t.fg,
      "--term-accent": t.accent,
      "--term-cursor": t.cursor,
      "--term-dim": t.dim,
      "--term-error": t.error
    };
  }

  exports.THEMES = THEMES;
  exports.DEFAULT_THEME_ID = DEFAULT_THEME_ID;
  exports.getThemeIds = getThemeIds;
  exports.getTheme = getTheme;
  exports.themeToCssVars = themeToCssVars;
})(typeof exports === "undefined" ? (window.Themes = {}) : exports);
