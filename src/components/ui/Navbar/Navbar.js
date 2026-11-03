/**
 * Cradle UI — Navbar Component
 * ──────────────────────────────
 * A responsive, accessible sticky navigation bar.
 *
 * Features:
 *  - Logo / brand slot
 *  - Navigation links with active-page indicator
 *  - Optional action slot (e.g. ThemeToggle)
 *  - Hamburger menu + animated mobile drawer
 *  - Keyboard navigation (Escape closes drawer)
 *  - Sticky with backdrop blur
 *  - Smooth animations
 *
 * Usage (create programmatically):
 *   const nav = CradleNavbar.create({
 *     logo:         { text: 'Cradle', href: '/' },
 *     links: [
 *       { label: 'Home',    href: '/' },
 *       { label: 'Games',   href: '/projects/games/' },
 *       { label: 'AI/ML',   href: '/projects/aiml/' },
 *     ],
 *     currentRoute: window.location.pathname,  // highlights active link
 *     actions:      [themeToggleElement],       // array of elements appended to right slot
 *     className:    '',
 *   });
 *   document.body.insertBefore(nav, document.body.firstChild);
 *
 * Usage (HTML — auto-mounted on DOMContentLoaded):
 *   <nav
 *     data-cradle-navbar
 *     data-logo-text="Cradle"
 *     data-logo-href="/"
 *     data-links='[{"label":"Home","href":"/"},{"label":"Games","href":"/projects/games/"}]'
 *     data-current-route="/projects/games/"
 *   ></nav>
 */

(function (global) {
  "use strict";

  const STYLE_ID = "cradle-navbar-styles";

  /* ── Styles ───────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* ── Navbar shell ──────────────────────────────────── */
      .cradle-navbar {
        position: sticky;
        top: 0;
        z-index: var(--cradle-z-navbar, 1000);

        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--cradle-space-4, 16px);

        padding: 0 clamp(16px, 4vw, 48px);
        height: 64px;

        background: rgba(5, 7, 13, 0.82);
        border-bottom: 1px solid var(--cradle-border, #374151);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);

        font-family: var(--cradle-font-body, 'Space Grotesk', system-ui, sans-serif);
        color: var(--cradle-text, #f3f4f6);

        transition:
          background-color var(--cradle-transition, 0.35s cubic-bezier(0.22,1,0.36,1)),
          border-color var(--cradle-transition, 0.35s cubic-bezier(0.22,1,0.36,1));
      }

      html.light-theme .cradle-navbar {
        background: rgba(245, 247, 251, 0.88);
      }

      /* ── Brand ─────────────────────────────────────────── */
      .cradle-navbar__brand {
        display: flex;
        align-items: center;
        gap: var(--cradle-space-2, 8px);
        text-decoration: none;
        color: inherit;
        flex-shrink: 0;
      }

      .cradle-navbar__logo-text {
        font-size: 1.2rem;
        font-weight: 800;
        letter-spacing: 0.01em;
        background: linear-gradient(to right, #ffffff, #cbd5e1, #93c5fd);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        line-height: 1;
      }

      html.light-theme .cradle-navbar__logo-text {
        background: linear-gradient(to right, #0f172a, #334155, #2563eb);
        -webkit-background-clip: text;
        background-clip: text;
      }

      .cradle-navbar__logo-img {
        height: 30px;
        width: auto;
        object-fit: contain;
        display: block;
      }

      /* ── Desktop links ─────────────────────────────────── */
      .cradle-navbar__links {
        display: flex;
        align-items: center;
        gap: var(--cradle-space-1, 4px);
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .cradle-navbar__link {
        display: inline-flex;
        align-items: center;
        padding: 6px 14px;
        border-radius: var(--cradle-radius-pill, 999px);
        text-decoration: none;
        font-size: var(--cradle-font-size-sm, 0.875rem);
        font-weight: 500;
        color: var(--cradle-text-secondary, #cbd5e1);
        transition:
          color var(--cradle-transition-fast, 0.15s ease),
          background-color var(--cradle-transition-fast, 0.15s ease);
        white-space: nowrap;
      }

      .cradle-navbar__link:hover {
        color: var(--cradle-text, #f3f4f6);
        background: rgba(255, 255, 255, 0.07);
      }

      .cradle-navbar__link--active {
        color: var(--cradle-highlight, #93c5fd);
        background: var(--cradle-accent-light, rgba(37, 99, 235, 0.15));
        font-weight: 700;
      }

      html.light-theme .cradle-navbar__link--active {
        color: var(--cradle-highlight, #1d4ed8);
        background: var(--cradle-accent-light, rgba(37, 99, 235, 0.1));
      }

      .cradle-navbar__link:focus-visible,
      .cradle-navbar__brand:focus-visible {
        outline: 2px solid var(--color-accent, var(--cradle-accent-hover, #2563eb));
        outline-offset: 2px;
        border-radius: 4px;
      }
      .cradle-navbar__link:focus:not(:focus-visible),
      .cradle-navbar__brand:focus:not(:focus-visible) {
        outline: none;
      }

      /* ── Actions slot ──────────────────────────────────── */
      .cradle-navbar__actions {
        display: flex;
        align-items: center;
        gap: var(--cradle-space-2, 8px);
        flex-shrink: 0;
      }

      /* ── Hamburger ─────────────────────────────────────── */
      .cradle-navbar__hamburger {
        display: none;
        flex-direction: column;
        justify-content: space-between;
        width: 24px;
        height: 18px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        flex-shrink: 0;
      }

      .cradle-navbar__hamburger:focus-visible {
        outline: 2px solid var(--color-accent, var(--cradle-accent-hover, #2563eb));
        outline-offset: 2px;
        border-radius: 4px;
      }
      .cradle-navbar__hamburger:focus:not(:focus-visible) {
        outline: none;
      }

      .cradle-navbar__hamburger-line {
        display: block;
        height: 2px;
        width: 100%;
        background: var(--cradle-text, #f3f4f6);
        border-radius: 2px;
        transition: transform 0.3s ease, opacity 0.3s ease;
        transform-origin: center;
      }

      /* Hamburger → X animation */
      .cradle-navbar--open .cradle-navbar__hamburger-line:nth-child(1) {
        transform: translateY(8px) rotate(45deg);
      }
      .cradle-navbar--open .cradle-navbar__hamburger-line:nth-child(2) {
        opacity: 0;
        transform: scaleX(0);
      }
      .cradle-navbar--open .cradle-navbar__hamburger-line:nth-child(3) {
        transform: translateY(-8px) rotate(-45deg);
      }

      /* ── Mobile drawer ─────────────────────────────────── */
      .cradle-navbar__drawer {
        position: fixed;
        top: 64px;
        left: 0;
        right: 0;
        z-index: calc(var(--cradle-z-navbar, 1000) - 1);

        background: var(--cradle-surface, #111827);
        border-bottom: 1px solid var(--cradle-border, #374151);
        backdrop-filter: blur(12px);

        padding: var(--cradle-space-4, 16px) clamp(16px, 5vw, 32px);
        display: flex;
        flex-direction: column;
        gap: var(--cradle-space-1, 4px);

        transform: translateY(-10px);
        opacity: 0;
        pointer-events: none;
        transition:
          transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
          opacity 0.25s ease;
      }

      .cradle-navbar__drawer--open {
        transform: translateY(0);
        opacity: 1;
        pointer-events: auto;
      }

      .cradle-navbar__drawer-link {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        border-radius: var(--cradle-radius, 14px);
        text-decoration: none;
        font-size: var(--cradle-font-size-md, 1rem);
        font-weight: 500;
        color: var(--cradle-text-secondary, #cbd5e1);
        transition:
          background-color var(--cradle-transition-fast, 0.15s ease),
          color var(--cradle-transition-fast, 0.15s ease);
      }

      .cradle-navbar__drawer-link:hover {
        background: rgba(255, 255, 255, 0.06);
        color: var(--cradle-text, #f3f4f6);
      }

      .cradle-navbar__drawer-link--active {
        background: var(--cradle-accent-light, rgba(37,99,235,0.15));
        color: var(--cradle-highlight, #93c5fd);
        font-weight: 700;
      }

      .cradle-navbar__drawer-link:focus-visible {
        outline: 2px solid var(--color-accent, var(--cradle-accent-hover, #2563eb));
        outline-offset: 2px;
        border-radius: 4px;
      }
      .cradle-navbar__drawer-link:focus:not(:focus-visible) {
        outline: none;
      }

      /* ── Responsive breakpoint ─────────────────────────── */
      @media (max-width: 768px) {
        .cradle-navbar__links {
          display: none;
        }
        .cradle-navbar__hamburger {
          display: flex;
        }
      }

      @media (min-width: 769px) {
        .cradle-navbar__drawer {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Helpers ──────────────────────────────────────────── */
  function isActive(href, currentRoute) {
    if (!currentRoute || !href) return false;
    if (href === "/" || href === "/index.html") {
      return currentRoute === "/" || currentRoute === "/index.html";
    }
    return currentRoute.startsWith(href);
  }

  /* ── Factory ──────────────────────────────────────────── */
  const CradleNavbar = {
    /**
     * Create a Navbar element.
     * @param {Object} options
     * @returns {HTMLElement}  <nav> element + accompanying drawer
     */
    create(options = {}) {
      injectStyles();

      const {
        logo = { text: "Cradle", href: "/" },
        links = [],
        currentRoute = window.location.pathname,
        actions = [],
        className = "",
      } = options;

      /* ── Nav element ── */
      const nav = document.createElement("nav");
      nav.className = ["cradle-navbar", className].filter(Boolean).join(" ");
      nav.setAttribute("role", "navigation");
      nav.setAttribute("aria-label", "Main navigation");

      /* Brand */
      const brand = document.createElement("a");
      brand.className = "cradle-navbar__brand";
      brand.href = logo.href || "/";
      brand.setAttribute("aria-label", logo.text || "Home");

      if (logo.imgSrc) {
        const img = document.createElement("img");
        img.src = logo.imgSrc;
        img.alt = logo.text || "";
        img.className = "cradle-navbar__logo-img";
        brand.appendChild(img);
      }
      if (logo.text) {
        const text = document.createElement("span");
        text.className = "cradle-navbar__logo-text";
        text.textContent = logo.text;
        brand.appendChild(text);
      }
      nav.appendChild(brand);

      /* Desktop links */
      if (links.length) {
        const ul = document.createElement("ul");
        ul.className = "cradle-navbar__links";
        ul.setAttribute("role", "list");

        links.forEach(link => {
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.className = [
            "cradle-navbar__link",
            isActive(link.href, currentRoute)
              ? "cradle-navbar__link--active"
              : "",
          ]
            .filter(Boolean)
            .join(" ");
          a.href = link.href;
          a.textContent = link.label;
          if (isActive(link.href, currentRoute)) {
            a.setAttribute("aria-current", "page");
          }
          li.appendChild(a);
          ul.appendChild(li);
        });

        nav.appendChild(ul);
      }

      /* Actions + hamburger */
      const actionsSlot = document.createElement("div");
      actionsSlot.className = "cradle-navbar__actions";

      actions.forEach(el => actionsSlot.appendChild(el));

      /* Hamburger button */
      const burger = document.createElement("button");
      burger.className = "cradle-navbar__hamburger";
      burger.type = "button";
      burger.setAttribute("aria-label", "Open menu");
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-controls", "cradle-navbar-drawer");
      burger.innerHTML = `
        <span class="cradle-navbar__hamburger-line" aria-hidden="true"></span>
        <span class="cradle-navbar__hamburger-line" aria-hidden="true"></span>
        <span class="cradle-navbar__hamburger-line" aria-hidden="true"></span>
      `;
      actionsSlot.appendChild(burger);
      nav.appendChild(actionsSlot);

      /* ── Mobile drawer ── */
      const drawer = document.createElement("div");
      drawer.className = "cradle-navbar__drawer";
      drawer.id = "cradle-navbar-drawer";
      drawer.setAttribute("aria-hidden", "true");
      drawer.setAttribute("role", "menu");

      links.forEach(link => {
        const a = document.createElement("a");
        a.className = [
          "cradle-navbar__drawer-link",
          isActive(link.href, currentRoute)
            ? "cradle-navbar__drawer-link--active"
            : "",
        ]
          .filter(Boolean)
          .join(" ");
        a.href = link.href;
        a.textContent = link.label;
        a.setAttribute("role", "menuitem");
        if (isActive(link.href, currentRoute)) {
          a.setAttribute("aria-current", "page");
        }
        /* Close drawer on link click */
        a.addEventListener("click", () => closeDrawer());
        drawer.appendChild(a);
      });

      /* ── State helpers ── */
      let isOpen = false;

      function openDrawer() {
        isOpen = true;
        nav.classList.add("cradle-navbar--open");
        drawer.classList.add("cradle-navbar__drawer--open");
        burger.setAttribute("aria-expanded", "true");
        burger.setAttribute("aria-label", "Close menu");
        drawer.setAttribute("aria-hidden", "false");
        /* Focus first drawer link */
        const firstLink = drawer.querySelector(".cradle-navbar__drawer-link");
        if (firstLink) firstLink.focus();
      }

      function closeDrawer() {
        isOpen = false;
        nav.classList.remove("cradle-navbar--open");
        drawer.classList.remove("cradle-navbar__drawer--open");
        burger.setAttribute("aria-expanded", "false");
        burger.setAttribute("aria-label", "Open menu");
        drawer.setAttribute("aria-hidden", "true");
      }

      burger.addEventListener("click", () =>
        isOpen ? closeDrawer() : openDrawer()
      );

      /* Escape key closes drawer */
      document.addEventListener("keydown", e => {
        if (e.key === "Escape" && isOpen) {
          closeDrawer();
          burger.focus();
        }
      });

      /* Click outside closes drawer */
      document.addEventListener("click", e => {
        if (isOpen && !nav.contains(e.target) && !drawer.contains(e.target)) {
          closeDrawer();
        }
      });

      /*
       * Return a fragment with both nav and drawer so the caller
       * can insert them together. Alternatively, the nav has a
       * .drawer property for separate insertion.
       */
      nav._drawer = drawer;

      return nav;
    },

    /**
     * Mount on all [data-cradle-navbar] elements.
     */
    upgradeAll() {
      injectStyles();
      document.querySelectorAll("[data-cradle-navbar]").forEach(el => {
        if (el.dataset.cradleUpgraded) return;
        el.dataset.cradleUpgraded = "true";

        let links = [];
        try {
          links = JSON.parse(el.dataset.links || "[]");
        } catch {
          links = [];
        }

        const logoText = el.dataset.logoText || el.dataset.logotext || "";
        const logoHref = el.dataset.logoHref || el.dataset.logohref || "/";
        const logoImg = el.dataset.logoImg || el.dataset.logoimg || "";
        const current =
          el.dataset.currentRoute ||
          el.dataset.currentroute ||
          window.location.pathname;

        const nav = CradleNavbar.create({
          logo: { text: logoText, href: logoHref, imgSrc: logoImg },
          links,
          currentRoute: current,
        });

        el.replaceWith(nav);
        nav.insertAdjacentElement("afterend", nav._drawer);
      });
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () =>
      CradleNavbar.upgradeAll()
    );
  } else {
    CradleNavbar.upgradeAll();
  }

  global.CradleNavbar = CradleNavbar;
})(window);
