/**
 * Cradle UI — Barrel Export
 * ──────────────────────────
 * Load this single file to get access to all Cradle UI components
 * as globals (window.CradleButton, window.CradleCard, etc.).
 *
 * Usage in HTML:
 *   <!-- 1. Load design tokens (optional but recommended) -->
 *   <link rel="stylesheet" href="/src/components/ui/tokens.css">
 *
 *   <!-- 2. Load the component bundle -->
 *   <script src="/src/components/ui/index.js" defer></script>
 *
 * After loading, use components anywhere:
 *   const btn = CradleButton.create({ variant: 'primary', children: 'Click me' });
 *   const card = CradleCard.create({ title: 'My Card', children: '<p>Hello</p>' });
 *   const toggle = CradleThemeToggle.create({ size: 'md' });
 *   const nav = CradleNavbar.create({ logo: { text: 'Cradle' }, links: [...] });
 *   CradleBackToHome.autoInject();
 *
 * Available globals after load:
 *   - CradleButton       Button with variants, sizes, icons, loading state
 *   - CradleCard         Card / CardHeader / CardContent / CardFooter
 *   - CradleThemeToggle  Light/dark theme toggle with localStorage + OS preference
 *   - CradleNavbar       Sticky navbar with mobile drawer
 *   - CradleBackToHome   Fixed "Back to Home" pill button
 *   - CradleEscape       HTML escaping utility (CradleEscape.escapeHtml)
 *   - CradleStorage      localStorage helper (CradleStorage.get/set/...)
 *
 * Individual component files:
 *   /src/components/ui/Button/Button.js
 *   /src/components/ui/Card/Card.js
 *   /src/components/ui/ThemeToggle/ThemeToggle.js
 *   /src/components/ui/Navbar/Navbar.js
 *   /src/components/ui/BackToHome/BackToHome.js
 *
 * Utility files:
 *   /src/components/ui/escapeHtml.js
 *   /src/components/ui/storage.js
 *
 * Design tokens:
 *   /src/components/ui/tokens.css
 */

/* ─── Load order matters: tokens are injected by each component ─── */
/* ─── Loading them individually is also supported                ─── */

(function () {
  "use strict";

  /**
   * Dynamically load a script relative to this file's location.
   * Each component file is self-contained and safe to load individually.
   *
   * Since this is a vanilla-JS project with no bundler, we expose
   * a helper that projects can call to load only what they need.
   */
  function resolveBase() {
    /*
     * Strategy 1: <meta name="cradle-ui-base" content="..."> tag.
     * Explicit and works regardless of hosting setup.
     * Add to any page: <meta name="cradle-ui-base" content="/src/components/ui/">
     */
    const meta = document.querySelector('meta[name="cradle-ui-base"]');
    if (meta) {
      const content = meta.getAttribute("content");
      return content.endsWith("/") ? content : content + "/";
    }

    /*
     * Strategy 2: scan all <script src> tags for our file name.
     * Works whether the script was loaded with defer, async, or inline.
     */
    const scripts = document.querySelectorAll("script[src]");
    for (const s of scripts) {
      if (s.src && s.src.includes("components/ui/index.js")) {
        return s.src.replace("index.js", "");
      }
    }

    /*
     * Strategy 3: document.currentScript — only defined during initial
     * synchronous execution, so only works without defer/async.
     */
    if (document.currentScript && document.currentScript.src) {
      return document.currentScript.src.replace("index.js", "");
    }

    /* Fallback: assume the repo root */
    return window.location.origin + "/src/components/ui/";
  }

  const BASE_URL = resolveBase();

  const COMPONENTS = [
    "Button/Button.js",
    "Card/Card.js",
    "ThemeToggle/ThemeToggle.js",
    "Navbar/Navbar.js",
    "BackToHome/BackToHome.js",
  ];

  /* Non-DOM utilities that follow the same load-on-demand pattern. */
  const UTILITIES = ["escapeHtml.js", "storage.js"];

  /**
   * Load a single component script.
   * @param {string} relativePath  e.g. 'Button/Button.js'
   * @returns {Promise<void>}
   */
  function loadComponent(relativePath) {
    return new Promise((resolve, reject) => {
      /* Skip if already loaded */
      const fullUrl = BASE_URL + relativePath;
      if (document.querySelector(`script[src="${fullUrl}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = fullUrl;
      script.async = false; /* Preserve load order */
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error(`[CradleUI] Failed to load ${relativePath}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Exposed API — available as window.CradleUI
   *
   * CradleUI.loadAll()           — load all 5 components + utilities
   * CradleUI.load('Button')      — load a single component by name
   * CradleUI.load('escapeHtml')  — load a utility by name
   */
  const CradleUI = {
    _baseUrl: BASE_URL,
    _loaded: {},

    /** Load every component and utility */
    loadAll() {
      return Promise.all(
        [
          ...COMPONENTS.map(p => p.split("/")[0]),
          ...UTILITIES.map(u => u.replace(/\.js$/, "")),
        ].map(name => this.load(name))
      );
    },

    /**
     * Load a single component or utility by name.
     * @param {'Button'|'Card'|'ThemeToggle'|'Navbar'|'BackToHome'|'escapeHtml'|'storage'} name
     * @returns {Promise<void>}
     */
    load(name) {
      if (this._loaded[name]) return Promise.resolve();

      const found =
        COMPONENTS.find(p => p.startsWith(name + "/")) ||
        UTILITIES.find(u => u === name + ".js");

      if (!found) {
        console.warn(`[CradleUI] Unknown component or utility: "${name}"`);
        return Promise.resolve();
      }

      return loadComponent(found).then(() => {
        this._loaded[name] = true;
      });
    },
  };

  window.CradleUI = CradleUI;

  /* Auto-load all components when the bundle file itself is loaded */
  CradleUI.loadAll().catch(err => console.error(err));
})();
