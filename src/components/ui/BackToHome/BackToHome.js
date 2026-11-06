/**
 * Cradle UI — BackToHome & Breadcrumb Component
 * ────────────────────────────────────────────────
 * A reusable, accessible navigation component providing:
 *  - Fixed pill button or minimal inline "Back to Home" button
 *  - Semantic, accessible Breadcrumb navigation (Home > [Category] > [Project Title])
 *  - Global Alt+H keyboard shortcut to return to root from any mini-project
 *  - Automatic active category filter retention (?category=...)
 *  - Automatic path context extraction (category & project title detection)
 *  - WAI-ARIA breadcrumb pattern & aria-keyshortcuts compliance
 *  - Design token styling, theme awareness, and high-contrast support
 *
 * Usage (create programmatically — pill button):
 *   const btn = CradleBackToHome.create({
 *     to:             '/index.html',  // default: computed from location
 *     label:          'Back to Home', // default
 *     variant:        'pill',         // 'pill' (default) | 'minimal' | 'breadcrumb'
 *     retainCategory: true,           // preserve active category filter on return
 *     showShortcutBadge: true,        // display <kbd>Alt+H</kbd> badge
 *     enableShortcut: true,           // bind global Alt+H shortcut (default: true)
 *   });
 *   document.body.appendChild(btn);
 *
 * Usage (create programmatically — breadcrumb):
 *   const breadcrumb = CradleBackToHome.createBreadcrumb({
 *     category:       'dev-tools',    // auto-detected from pathname if omitted
 *     projectTitle:   'Regex Visualizer', // auto-detected from document.title if omitted
 *     retainCategory: true,           // Category link navigates to /?category=dev-tools
 *   });
 *   document.body.insertBefore(breadcrumb, document.body.firstChild);
 *
 * Usage (auto-inject — drop-in script for any mini):
 *   <script src="../../../src/components/ui/BackToHome/BackToHome.js" defer></script>
 *
 * Usage (HTML data-attributes):
 *   <a data-cradle-back-to-home data-label="Go Back" data-retain-category="true"></a>
 *   <nav data-cradle-breadcrumb></nav>
 */

(function (global) {
  "use strict";

  const STYLE_ID = "cradle-back-home-styles";

  /* ── HTML sanitizer ──────────────────────────────────────── */
  const _sanitize =
    (typeof window !== "undefined" &&
      window.CradleSanitize &&
      window.CradleSanitize.sanitizeHtml) ||
    (typeof require === "function" &&
      (function () {
        try {
          return require("../sanitizeHtml.js").sanitizeHtml;
        } catch {
          return null;
        }
      })()) ||
    function (html) {
      return String(html ?? "");
    };

  /* Script location resolution for base-path-safe relative URLs */
  const SELF_SRC =
    (typeof document !== "undefined" &&
      document.currentScript &&
      document.currentScript.src) ||
    "";
  const SELF_REL = "src/components/ui/BackToHome/BackToHome.js";

  /* ── Styles ───────────────────────────────────────────── */
  function injectStyles() {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* ── Pill variant (default, matches existing design) ── */
      .cradle-back-home {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: var(--cradle-z-overlay, 99999);

        display: inline-flex;
        align-items: center;
        gap: 8px;

        padding: 10px 16px;

        background: rgba(15, 23, 42, 0.75);
        color: #f8fafc;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 9999px;

        font-family: var(--cradle-font-family, 'Space Grotesk', system-ui, -apple-system, sans-serif);
        font-size: 14px;
        font-weight: 500;
        text-decoration: none;
        cursor: pointer;

        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .cradle-back-home:hover {
        background: rgba(15, 23, 42, 0.9);
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
        border-color: rgba(255, 255, 255, 0.25);
        color: #ffffff;
      }

      .cradle-back-home:active {
        transform: translateY(0);
      }

      .cradle-back-home:focus-visible {
        outline: 2px solid var(--color-accent, var(--cradle-accent-hover, #2563eb));
        outline-offset: 2px;
        border-radius: 4px;
      }
      .cradle-back-home:focus:not(:focus-visible) {
        outline: none;
      }

      /* Arrow icon animation */
      .cradle-back-home__icon {
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;
        transition: transform 0.3s ease;
      }
      .cradle-back-home:hover .cradle-back-home__icon {
        transform: translateX(-3px);
      }

      /* ── Keyboard shortcut badge ── */
      .cradle-back-home__kbd {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11px;
        font-weight: 600;
        padding: 1px 6px;
        margin-left: 4px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: rgba(255, 255, 255, 0.9);
        line-height: 1.2;
        letter-spacing: 0.5px;
        vertical-align: middle;
      }

      /* ── Minimal variant ──────────────────────────────── */
      .cradle-back-home--minimal {
        position: static;
        background: transparent;
        border-color: var(--cradle-border, #374151);
        color: var(--cradle-text-secondary, #cbd5e1);
        backdrop-filter: none;
        box-shadow: none;
        font-size: var(--cradle-font-size-sm, 0.875rem);
        padding: 7px 14px;
      }
      .cradle-back-home--minimal:hover {
        background: rgba(255, 255, 255, 0.05);
        color: var(--cradle-text, #f3f4f6);
        box-shadow: none;
      }

      /* ── Accessible Breadcrumb Navigation ──────────────── */
      .cradle-breadcrumb {
        display: flex;
        align-items: center;
        font-family: var(--cradle-font-family, 'Space Grotesk', system-ui, -apple-system, sans-serif);
        font-size: var(--cradle-font-size-sm, 14px);
        line-height: 1.5;
        color: var(--cradle-text-muted, #9ca3af);
        padding: 8px 16px;
        background: rgba(15, 23, 42, 0.65);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: var(--cradle-radius-md, 8px);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        width: fit-content;
        max-width: 100%;
        margin-bottom: 16px;
      }

      .cradle-breadcrumb__list {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        list-style: none;
        margin: 0;
        padding: 0;
        gap: 6px;
      }

      .cradle-breadcrumb__item {
        display: inline-flex;
        align-items: center;
      }

      .cradle-breadcrumb__link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--cradle-text-muted, #9ca3af);
        text-decoration: none;
        font-weight: 500;
        padding: 2px 6px;
        border-radius: var(--cradle-radius-sm, 4px);
        transition: color 0.2s ease, background 0.2s ease;
      }

      .cradle-breadcrumb__link:hover {
        color: var(--cradle-text, #ffffff);
        background: rgba(255, 255, 255, 0.08);
        text-decoration: none;
      }

      .cradle-breadcrumb__link:focus-visible {
        outline: 2px solid var(--cradle-accent, #3b82f6);
        outline-offset: 2px;
      }

      .cradle-breadcrumb__separator {
        user-select: none;
        color: var(--cradle-border, #4b5563);
        font-size: 13px;
        margin: 0 2px;
        display: inline-flex;
        align-items: center;
      }

      .cradle-breadcrumb__item--current,
      .cradle-breadcrumb__current {
        color: var(--cradle-text, #f8fafc);
        font-weight: 600;
        padding: 2px 6px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 320px;
      }

      /* ── Light theme adaptation ── */
      html.light-theme .cradle-breadcrumb,
      [data-theme="light"] .cradle-breadcrumb {
        background: rgba(248, 250, 252, 0.85);
        border-color: rgba(0, 0, 0, 0.1);
        color: #64748b;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      html.light-theme .cradle-breadcrumb__link,
      [data-theme="light"] .cradle-breadcrumb__link {
        color: #64748b;
      }

      html.light-theme .cradle-breadcrumb__link:hover,
      [data-theme="light"] .cradle-breadcrumb__link:hover {
        color: #0f172a;
        background: rgba(0, 0, 0, 0.05);
      }

      html.light-theme .cradle-breadcrumb__current,
      [data-theme="light"] .cradle-breadcrumb__current {
        color: #0f172a;
      }

      html.light-theme .cradle-breadcrumb__separator,
      [data-theme="light"] .cradle-breadcrumb__separator {
        color: #94a3b8;
      }

      html.light-theme .cradle-back-home__kbd,
      [data-theme="light"] .cradle-back-home__kbd {
        background: rgba(0, 0, 0, 0.06);
        border-color: rgba(0, 0, 0, 0.15);
        color: #334155;
      }

      /* ── High-contrast / forced-colors mode ── */
      @media (forced-colors: active) {
        .cradle-breadcrumb,
        .cradle-back-home,
        .cradle-back-home__kbd {
          forced-color-adjust: auto;
          border: 1px solid CanvasText;
        }
      }

      /* ── Reduced motion ── */
      @media (prefers-reduced-motion: reduce) {
        .cradle-back-home,
        .cradle-back-home__icon,
        .cradle-breadcrumb__link {
          transition: none;
        }
      }

      /* ── Responsive ────────────────────────────────────── */
      @media (max-width: 768px) {
        .cradle-back-home:not(.cradle-back-home--minimal) {
          bottom: 12px;
          right: 12px;
          padding: 8px 12px;
          font-size: 12px;
        }

        .cradle-breadcrumb {
          font-size: 12px;
          padding: 6px 10px;
        }

        .cradle-breadcrumb__current {
          max-width: 160px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Default arrow SVG icon ───────────────────────────── */
  const DEFAULT_ICON = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true" focusable="false">
      <line x1="19" y1="12" x2="5" y2="12"></line>
      <polyline points="12 19 5 12 12 5"></polyline>
    </svg>
  `;

  /* ── Compute home URL from current path ───────────────── */
  function computeHomeUrl() {
    /* Preferred: derive the site root from this script's own location, which
       is base-path safe. e.g. https://user.github.io/cradle/src/components/ui/
       BackToHome/BackToHome.js → https://user.github.io/cradle/index.html */
    if (SELF_SRC) {
      const i = SELF_SRC.indexOf(SELF_REL);
      if (i !== -1) return SELF_SRC.slice(0, i) + "index.html";
    }

    /* Fallback (script URL unavailable): count directory segments, but ignore
       a trailing filename like index.html so we don't over-count by one. */
    const segments =
      typeof window !== "undefined" &&
      window.location &&
      window.location.pathname
        ? window.location.pathname.split("/").filter(Boolean)
        : [];

    if (segments.length && segments[segments.length - 1].includes(".")) {
      segments.pop();
    }
    if (segments.length === 0) return "./index.html";
    return "../".repeat(segments.length) + "index.html";
  }

  /* ── Path and Category Parsing ────────────────────────── */
  function parsePathContext(pathname = "") {
    if (!pathname || typeof pathname !== "string") {
      return { category: "", projectSlug: "" };
    }
    const cleanPath = pathname.replace(/\\/g, "/");
    const segments = cleanPath.split("/").filter(Boolean);
    if (segments.length && segments[segments.length - 1].includes(".")) {
      segments.pop();
    }
    const projIndex = segments.indexOf("projects");
    if (projIndex !== -1 && projIndex + 1 < segments.length) {
      const category = segments[projIndex + 1];
      const projectSlug =
        projIndex + 2 < segments.length ? segments[projIndex + 2] : "";
      return { category, projectSlug };
    }
    if (segments.length >= 2) {
      return {
        category: segments[segments.length - 2],
        projectSlug: segments[segments.length - 1],
      };
    }
    return { category: "", projectSlug: "" };
  }

  function formatCategoryLabel(category) {
    if (!category || typeof category !== "string") return "";
    const known = {
      aiml: "AI / ML",
      "dev-tools": "Dev Tools",
      "file-tools": "File Tools",
      math: "Math",
      games: "Games",
      instruments: "Instruments",
      editor: "Editor",
      misc: "Misc",
      productivity: "Productivity",
    };
    const lower = category.toLowerCase().trim();
    if (known[lower]) return known[lower];
    return lower
      .split(/[-_]/)
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function getActiveCategory(options = {}) {
    if (options.category && typeof options.category === "string") {
      return options.category.toLowerCase().trim();
    }
    if (
      typeof window !== "undefined" &&
      window.location &&
      window.location.search
    ) {
      try {
        const params = new URLSearchParams(window.location.search);
        const cat = params.get("category");
        if (cat) return cat.toLowerCase().trim();
      } catch {}
    }
    if (typeof document !== "undefined" && document.referrer) {
      try {
        const baseHref =
          (typeof window !== "undefined" &&
            window.location &&
            window.location.href) ||
          "http://localhost";
        const ref = new URL(document.referrer, baseHref);
        const cat = ref.searchParams.get("category");
        if (cat) return cat.toLowerCase().trim();
      } catch {}
    }
    if (
      typeof window !== "undefined" &&
      window.location &&
      window.location.pathname
    ) {
      const { category } = parsePathContext(window.location.pathname);
      if (category) return category.toLowerCase().trim();
    }
    return "";
  }

  function getProjectTitle(options = {}) {
    if (options.projectTitle && typeof options.projectTitle === "string") {
      return options.projectTitle.trim();
    }
    if (typeof document !== "undefined" && document.title) {
      const raw = document.title.trim();
      const cleaned = raw.replace(/\s*[-–—|]\s*Cradle.*$/i, "").trim();
      if (cleaned) return cleaned;
    }
    if (
      typeof window !== "undefined" &&
      window.location &&
      window.location.pathname
    ) {
      const { projectSlug } = parsePathContext(window.location.pathname);
      if (projectSlug) {
        return projectSlug
          .split(/[-_]/)
          .filter(Boolean)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      }
    }
    return "Project";
  }

  function appendCategoryParam(url, category) {
    if (!category) return url;
    const cleanCat = encodeURIComponent(category.toLowerCase().trim());
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}category=${cleanCat}`;
  }

  /* ── Is homepage check ────────────────────────────────── */
  function isHomepage() {
    if (
      typeof window === "undefined" ||
      !window.location ||
      !window.location.pathname
    ) {
      return false;
    }
    const p = window.location.pathname;
    return p === "/" || (p.endsWith("/index.html") && !p.includes("/projects/"));
  }

  /* ── Global Alt+H Keyboard Shortcut ────────────────────── */
  let _activeShortcutHandler = null;

  function registerGlobalShortcut(targetUrl, options = {}) {
    if (
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function"
    ) {
      return;
    }
    unregisterGlobalShortcut();

    _activeShortcutHandler = function (e) {
      if (!e || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const key = (e.key || "").toLowerCase();
      if (key === "h" || e.code === "KeyH") {
        const target = e.target;
        if (
          target &&
          (target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
        ) {
          return;
        }
        e.preventDefault();
        if (typeof options.onNavigate === "function") {
          options.onNavigate(targetUrl);
        } else if (typeof window !== "undefined" && window.location) {
          window.location.href = targetUrl;
        }
      }
    };

    window.addEventListener("keydown", _activeShortcutHandler);
  }

  function unregisterGlobalShortcut() {
    if (
      _activeShortcutHandler &&
      typeof window !== "undefined" &&
      typeof window.removeEventListener === "function"
    ) {
      window.removeEventListener("keydown", _activeShortcutHandler);
      _activeShortcutHandler = null;
    }
  }

  /* ── Breadcrumb Factory ───────────────────────────────── */
  function createBreadcrumb(options = {}) {
    injectStyles();

    const homeUrl = options.to || computeHomeUrl();
    const category = getActiveCategory(options);
    const categoryLabel =
      options.categoryLabel || formatCategoryLabel(category);
    const projectTitle = getProjectTitle(options);
    const retainCategory = options.retainCategory !== false;
    const categoryUrl = category
      ? appendCategoryParam(homeUrl, category)
      : homeUrl;
    const enableShortcut = options.enableShortcut !== false;
    const shortcutKey = options.shortcutKey || "Alt+H";

    const nav = document.createElement("nav");
    nav.setAttribute("aria-label", "Breadcrumb");
    nav.className = ["cradle-breadcrumb", options.className]
      .filter(Boolean)
      .join(" ");

    const list = document.createElement("ol");
    list.className = "cradle-breadcrumb__list";

    /* Item 1: Home */
    const homeItem = document.createElement("li");
    homeItem.className = "cradle-breadcrumb__item";
    const homeLink = document.createElement("a");
    homeLink.className = "cradle-breadcrumb__link";
    homeLink.href = homeUrl;
    homeLink.textContent = options.homeLabel || "Home";
    homeLink.setAttribute("aria-keyshortcuts", shortcutKey);
    homeLink.title = `Return to Home (${shortcutKey})`;

    if (options.showShortcutBadge) {
      const kbd = document.createElement("kbd");
      kbd.className = "cradle-back-home__kbd";
      kbd.setAttribute("aria-hidden", "true");
      kbd.textContent = shortcutKey;
      homeLink.appendChild(kbd);
    }

    homeItem.appendChild(homeLink);
    list.appendChild(homeItem);

    /* Separator 1 */
    const sep1 = document.createElement("li");
    sep1.className = "cradle-breadcrumb__separator";
    sep1.setAttribute("aria-hidden", "true");
    sep1.textContent = "›";
    list.appendChild(sep1);

    /* Item 2: Category (if available) */
    if (category) {
      const catItem = document.createElement("li");
      catItem.className = "cradle-breadcrumb__item";
      const catLink = document.createElement("a");
      catLink.className = "cradle-breadcrumb__link";
      catLink.href = categoryUrl;
      catLink.textContent = categoryLabel;
      catLink.title = `View all ${categoryLabel} projects`;
      catItem.appendChild(catLink);
      list.appendChild(catItem);

      /* Separator 2 */
      const sep2 = document.createElement("li");
      sep2.className = "cradle-breadcrumb__separator";
      sep2.setAttribute("aria-hidden", "true");
      sep2.textContent = "›";
      list.appendChild(sep2);
    }

    /* Item 3: Current Project Title */
    const currentItem = document.createElement("li");
    currentItem.className =
      "cradle-breadcrumb__item cradle-breadcrumb__item--current";
    currentItem.setAttribute("aria-current", "page");

    const currentSpan = document.createElement("span");
    currentSpan.className = "cradle-breadcrumb__current";
    currentSpan.textContent = projectTitle;
    currentItem.appendChild(currentSpan);
    list.appendChild(currentItem);

    nav.appendChild(list);

    if (enableShortcut) {
      const navTarget = retainCategory && category ? categoryUrl : homeUrl;
      registerGlobalShortcut(navTarget, options);
    }

    return nav;
  }

  /* ── Main Factory ─────────────────────────────────────── */
  const CradleBackToHome = {
    /**
     * Create a BackToHome anchor element or Breadcrumb nav.
     * @param {Object} options
     * @returns {HTMLAnchorElement|HTMLElement}
     */
    create({
      to = null,
      label = "Back to Home",
      icon = DEFAULT_ICON,
      variant = "pill",
      className = "",
      category = null,
      projectTitle = null,
      retainCategory = false,
      showShortcutBadge = false,
      enableShortcut = true,
      shortcutKey = "Alt+H",
      onNavigate = null,
    } = {}) {
      if (variant === "breadcrumb") {
        return createBreadcrumb({
          to,
          category,
          projectTitle,
          retainCategory,
          enableShortcut,
          shortcutKey,
          onNavigate,
          className,
        });
      }

      injectStyles();

      const homeUrl = computeHomeUrl();
      const activeCat = getActiveCategory({ category });
      const href =
        to ||
        (retainCategory && activeCat
          ? appendCategoryParam(homeUrl, activeCat)
          : homeUrl);

      const link = document.createElement("a");
      link.className = [
        "cradle-back-home",
        variant !== "pill" ? `cradle-back-home--${variant}` : "",
        className,
      ]
        .filter(Boolean)
        .join(" ");

      link.href = href;
      link.title = label;
      link.setAttribute("aria-label", label);
      link.setAttribute("role", "button");
      link.setAttribute("aria-keyshortcuts", shortcutKey);
      link.tabIndex = 0;

      link.addEventListener("keydown", e => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          link.click();
        }
      });

      /* Icon wrapper */
      const iconWrapper = document.createElement("span");
      iconWrapper.className = "cradle-back-home__icon";
      iconWrapper.innerHTML = _sanitize(icon);

      /* Label span */
      const labelSpan = document.createElement("span");
      labelSpan.textContent = label;

      link.appendChild(iconWrapper);
      link.appendChild(labelSpan);

      if (showShortcutBadge) {
        const kbd = document.createElement("kbd");
        kbd.className = "cradle-back-home__kbd";
        kbd.setAttribute("aria-hidden", "true");
        kbd.textContent = shortcutKey;
        link.appendChild(kbd);
      }

      if (enableShortcut) {
        registerGlobalShortcut(href, { onNavigate });
      }

      return link;
    },

    /**
     * Create an accessible Breadcrumb nav element.
     * @param {Object} options
     * @returns {HTMLElement}
     */
    createBreadcrumb,

    /**
     * Auto-inject a fixed pill button (and optional breadcrumb).
     * Skips on the homepage.
     */
    autoInject(options = {}) {
      if (isHomepage()) return;
      injectStyles();

      const retainCategory = options.retainCategory !== false;
      const activeCat = getActiveCategory(options);
      const homeUrl = computeHomeUrl();
      const targetUrl =
        options.to ||
        (retainCategory && activeCat
          ? appendCategoryParam(homeUrl, activeCat)
          : homeUrl);

      const btn = CradleBackToHome.create({
        to: targetUrl,
        category: activeCat,
        retainCategory,
        ...options,
      });

      const attach = () => {
        document.body.appendChild(btn);
        if (options.breadcrumb || options.showBreadcrumb) {
          const breadcrumb = createBreadcrumb({
            to: homeUrl,
            category: activeCat,
            retainCategory,
            ...options,
          });
          document.body.insertBefore(breadcrumb, document.body.firstChild);
        }
      };

      if (document.body) {
        attach();
      } else {
        document.addEventListener("DOMContentLoaded", attach);
      }
    },

    /**
     * Upgrade elements that have [data-cradle-back-to-home] or [data-cradle-breadcrumb].
     */
    upgradeAll() {
      injectStyles();

      /* 1. Upgrade back-to-home button elements */
      document.querySelectorAll("[data-cradle-back-to-home]").forEach(el => {
        if (el.dataset.cradleUpgraded) return;
        el.dataset.cradleUpgraded = "true";

        const to = el.dataset.to || null;
        const label = el.dataset.label || "Back to Home";
        const variant = el.dataset.variant || "pill";
        const category = el.dataset.category || null;
        const projectTitle = el.dataset.projectTitle || null;
        const retainCategory = el.dataset.retainCategory === "true";
        const showShortcutBadge = el.dataset.showShortcutBadge === "true";
        const enableShortcut = el.dataset.enableShortcut !== "false";

        const btn = CradleBackToHome.create({
          to,
          label,
          variant,
          category,
          projectTitle,
          retainCategory,
          showShortcutBadge,
          enableShortcut,
        });
        el.replaceWith(btn);
      });

      /* 2. Upgrade breadcrumb container elements */
      document.querySelectorAll("[data-cradle-breadcrumb]").forEach(el => {
        if (el.dataset.cradleUpgraded) return;
        el.dataset.cradleUpgraded = "true";

        const to = el.dataset.to || null;
        const category = el.dataset.category || null;
        const projectTitle = el.dataset.projectTitle || null;
        const retainCategory = el.dataset.retainCategory !== "false";
        const enableShortcut = el.dataset.enableShortcut !== "false";

        const breadcrumb = CradleBackToHome.createBreadcrumb({
          to,
          category,
          projectTitle,
          retainCategory,
          enableShortcut,
        });
        el.replaceWith(breadcrumb);
      });
    },

    /* Shortcut management */
    registerGlobalShortcut,
    enableGlobalShortcut: registerGlobalShortcut,
    unregisterGlobalShortcut,
    disableGlobalShortcut: unregisterGlobalShortcut,

    /* Helper utilities */
    computeHomeUrl,
    parsePathContext,
    getActiveCategory,
    getProjectTitle,
    formatCategoryLabel,
    appendCategoryParam,
  };

  /* Auto-inject on load (same behaviour as existing script) */
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        CradleBackToHome.autoInject();
        CradleBackToHome.upgradeAll();
      });
    } else {
      CradleBackToHome.autoInject();
      CradleBackToHome.upgradeAll();
    }
  }

  if (typeof global !== "undefined") {
    global.CradleBackToHome = CradleBackToHome;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = CradleBackToHome;
  }
})(typeof window !== "undefined" ? window : globalThis);
