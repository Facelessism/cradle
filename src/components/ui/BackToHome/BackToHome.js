/**
 * Cradle UI — BackToHome Component
 * ────────────────────────────────────
 * A reusable, accessible "Back to Home" button that can be
 * used as a drop-in replacement for the existing
 * projects/back-to-home.js, or composed inside other components.
 *
 * Improvements over the original:
 *  - Computes the home URL dynamically from window.location
 *    instead of hard-coding ../../../index.html
 *  - Supports a custom `to` route, `label`, `icon`, and `variant`
 *  - Keyboard accessible (focus ring, Enter/Space)
 *  - Hover animation on arrow icon
 *  - Respects reduced-motion preference
 *
 * Usage (create programmatically):
 *   const btn = CradleBackToHome.create({
 *     to:      '/index.html',   // default: computed from location
 *     label:   'Back to Home',  // default
 *     variant: 'pill',          // 'pill' (default) | 'minimal'
 *   });
 *   document.body.appendChild(btn);
 *
 * Usage (auto-inject — drop-in replacement for the existing script):
 *   CradleBackToHome.autoInject();
 *   — or just load this script with defer; it auto-injects.
 *
 * Usage (HTML data-attribute):
 *   <a data-cradle-back-to-home data-label="Go Back" data-to="/"></a>
 *
 * Props:
 *   to       string   URL to navigate to.  Default: computed.
 *   label    string   Button text.
 *   variant  string   'pill' | 'minimal'
 *   icon     string   SVG/emoji to prepend.  Default: left-arrow SVG.
 */

(function (global) {
  "use strict";

  const STYLE_ID = "cradle-back-home-styles";

  /* This script's own URL, captured at load time (document.currentScript is
     only valid during synchronous execution). It sits at a fixed path under
     the site root, so we can resolve the home URL from it — which is correct
     regardless of how deep the current page is or what base path the site is
     deployed under (e.g. /<repo>/ on GitHub Pages). */
  const SELF_SRC =
    (document.currentScript && document.currentScript.src) || "";
  const SELF_REL = "src/components/ui/BackToHome/BackToHome.js";

  /* ── Styles ───────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
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

        font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
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
        outline: 2px solid var(--cradle-accent-hover, #2563eb);
        outline-offset: 3px;
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
        background: rgba(255,255,255,0.05);
        color: var(--cradle-text, #f3f4f6);
        box-shadow: none;
      }

      /* Respect reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .cradle-back-home,
        .cradle-back-home__icon {
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
    const segments = window.location.pathname.split("/").filter(Boolean);
    if (segments.length && segments[segments.length - 1].includes(".")) {
      segments.pop();
    }
    if (segments.length === 0) return "./index.html";
    return "../".repeat(segments.length) + "index.html";
  }

  /* ── Is homepage check ────────────────────────────────── */
  function isHomepage() {
    const p = window.location.pathname;
    return (
      p === "/" || (p.endsWith("/index.html") && !p.includes("/projects/"))
    );
  }

  /* ── Factory ──────────────────────────────────────────── */
  const CradleBackToHome = {
    /**
     * Create a BackToHome anchor element.
     * @param {Object} options
     * @returns {HTMLAnchorElement}
     */
    create({
      to = null,
      label = "Back to Home",
      icon = DEFAULT_ICON,
      variant = "pill",
      className = "",
    } = {}) {
      injectStyles();

      const href = to || computeHomeUrl();

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
      link.tabIndex = 0;

      link.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          link.click();
        }
      });

      /* Icon wrapper */
      const iconWrapper = document.createElement("span");
      iconWrapper.className = "cradle-back-home__icon";
      iconWrapper.innerHTML = icon;

      /* Label span */
      const labelSpan = document.createElement("span");
      labelSpan.textContent = label;

      link.appendChild(iconWrapper);
      link.appendChild(labelSpan);

      return link;
    },

    /**
     * Auto-inject a fixed pill button — drop-in for back-to-home.js.
     * Skips on the homepage.
     */
    autoInject(options = {}) {
      if (isHomepage()) return;
      injectStyles();

      const btn = CradleBackToHome.create(options);

      const attach = () => document.body.appendChild(btn);
      if (document.body) {
        attach();
      } else {
        document.addEventListener("DOMContentLoaded", attach);
      }
    },

    /**
     * Upgrade elements that have [data-cradle-back-to-home] attribute.
     */
    upgradeAll() {
      injectStyles();
      document.querySelectorAll("[data-cradle-back-to-home]").forEach(el => {
        if (el.dataset.cradleUpgraded) return;
        el.dataset.cradleUpgraded = "true";

        const to = el.dataset.to || null;
        const label = el.dataset.label || "Back to Home";
        const variant = el.dataset.variant || "pill";

        const btn = CradleBackToHome.create({ to, label, variant });
        el.replaceWith(btn);
      });
    },
  };

  /* Auto-inject (same behaviour as the existing back-to-home.js) */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      CradleBackToHome.autoInject();
      CradleBackToHome.upgradeAll();
    });
  } else {
    CradleBackToHome.autoInject();
    CradleBackToHome.upgradeAll();
  }

  global.CradleBackToHome = CradleBackToHome;
})(window);
