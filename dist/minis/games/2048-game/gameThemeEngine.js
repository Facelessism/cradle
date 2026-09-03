/**
 * 2048 Game Theme Engine
 * Provides custom visual themes and tile color maps for 2048 grid.
 */
(function (exports) {
  const THEMES = {
    classic: {
      name: "Classic",
      bg: "#faf8ef",
      gridBg: "#bbada0",
      tileEmpty: "rgba(238, 228, 218, 0.35)",
      tile2: "#eee4da",
      tile4: "#ede0c8",
      tile8: "#f2b179",
      tile16: "#f59563",
      tile32: "#f67c5f",
      tile64: "#f65e3b",
      tile128: "#edcf72",
      tile256: "#edcc61",
      tile512: "#edc850",
      tile1024: "#edc53f",
      tile2048: "#edc22e"
    },
    darkNeon: {
      name: "Dark Neon",
      bg: "#0f172a",
      gridBg: "#1e293b",
      tileEmpty: "#334155",
      tile2: "#38bdf8",
      tile4: "#818cf8",
      tile8: "#c084fc",
      tile16: "#f472b6",
      tile32: "#fb7185",
      tile64: "#f87171",
      tile128: "#fb923c",
      tile256: "#facc15",
      tile512: "#4ade80",
      tile1024: "#2dd4bf",
      tile2048: "#a78bfa"
    },
    cyberpunk: {
      name: "Cyberpunk",
      bg: "#120e16",
      gridBg: "#281e34",
      tileEmpty: "#3e2a52",
      tile2: "#00f0ff",
      tile4: "#ff007f",
      tile8: "#ffe600",
      tile16: "#00ff66",
      tile32: "#ff3300",
      tile64: "#9900ff",
      tile128: "#ff00cc",
      tile256: "#00ffff",
      tile512: "#ffff00",
      tile1024: "#ff0055",
      tile2048: "#33ff00"
    }
  };

  function getTheme(themeKey = "classic") {
    return THEMES[themeKey] || THEMES.classic;
  }

  function getAvailableThemes() {
    return Object.keys(THEMES).map(key => ({
      key,
      name: THEMES[key].name
    }));
  }

  function getTileColor(value, themeKey = "classic") {
    const theme = getTheme(themeKey);
    if (!value || value === 0) return theme.tileEmpty;
    return theme[`tile${value}`] || theme.tile2048;
  }

  exports.THEMES = THEMES;
  exports.getTheme = getTheme;
  exports.getAvailableThemes = getAvailableThemes;
  exports.getTileColor = getTileColor;
})(typeof exports === "undefined" ? (window.GameThemeEngine = {}) : exports);
