/**
 * Cradle UI — Button Component
 * ─────────────────────────────
 * Creates a fully accessible, styled <button> or <a> element.
 *
 * Usage (imperative):
 *   const btn = CradleButton.create({
 *     variant: 'primary',   // primary | secondary | outline | ghost | success | danger | icon
 *     size: 'md',           // sm | md | lg
 *     children: 'Click me',
 *     leftIcon: '★',        // string / HTML string
 *     rightIcon: '→',
 *     loading: false,
 *     disabled: false,
 *     fullWidth: false,
 *     className: '',
 *     onClick: (e) => {},
 *     href: '',             // renders as <a> when provided
 *     ariaLabel: '',
 *   });
 *   document.body.appendChild(btn);
 *
 * Usage (HTML — auto-initialised on DOMContentLoaded):
 *   <button
 *     data-cradle-btn
 *     data-variant="primary"
 *     data-size="md"
 *     data-left-icon="★"
 *   >Click me</button>
 */

(function (global) {
  "use strict";

  /* ── HTML sanitizer ──────────────────────────────────────── */
  const _sanitize =
    (typeof window !== "undefined" && window.CradleSanitize && window.CradleSanitize.sanitizeHtml) ||
    (typeof require === "function" && (function () { try { return require("../sanitizeHtml.js").sanitizeHtml; } catch { return null; } })()) ||
    function (html) { return String(html ?? ""); };

  /* ── Inject styles once ───────────────────────────────── */
  const STYLE_ID = "cradle-btn-styles";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* Base */
      .cradle-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--cradle-space-2, 8px);

        font-family: var(--cradle-font-body, 'Space Grotesk', system-ui, sans-serif);
        font-weight: 600;
        line-height: 1;
        text-decoration: none;
        white-space: nowrap;

        border: 1px solid transparent;
        border-radius: var(--cradle-radius-pill, 999px);
        cursor: pointer;
        position: relative;
        overflow: hidden;

        transition:
          background-color var(--cradle-transition-fast, 0.15s ease),
          border-color var(--cradle-transition-fast, 0.15s ease),
          color var(--cradle-transition-fast, 0.15s ease),
          box-shadow var(--cradle-transition-fast, 0.15s ease),
          transform var(--cradle-transition-fast, 0.15s ease),
          opacity var(--cradle-transition-fast, 0.15s ease);
      }

      /* Focus ring — keyboard only */
      .cradle-btn:focus-visible {
        outline: 2px solid var(--cradle-accent-hover, #2563eb);
        outline-offset: 3px;
      }
      .cradle-btn:focus:not(:focus-visible) {
        outline: none;
      }

      /* Hover lift */
      .cradle-btn:not(:disabled):not(.cradle-btn--loading):hover {
        transform: translateY(-2px);
      }

      /* Active press */
      .cradle-btn:not(:disabled):not(.cradle-btn--loading):active {
        transform: translateY(0) scale(0.97);
      }

      /* ── Sizes ──────────────────────────────────────────── */
      .cradle-btn--sm {
        padding: 7px 16px;
        font-size: var(--cradle-font-size-xs, 0.75rem);
      }
      .cradle-btn--md {
        padding: 11px 22px;
        font-size: var(--cradle-font-size-sm, 0.875rem);
      }
      .cradle-btn--lg {
        padding: 15px 30px;
        font-size: var(--cradle-font-size-md, 1rem);
      }

      /* ── Variants ───────────────────────────────────────── */

      /* Primary */
      .cradle-btn--primary {
        background: linear-gradient(135deg, var(--cradle-accent, #1e3a8a), var(--cradle-accent-hover, #2563eb));
        color: #ffffff;
        border-color: transparent;
        box-shadow: 0 8px 20px var(--cradle-accent-light, rgba(37,99,235,0.25));
      }
      .cradle-btn--primary:not(:disabled):not(.cradle-btn--loading):hover {
        box-shadow: 0 12px 28px var(--cradle-accent-light, rgba(37,99,235,0.35));
        filter: brightness(1.08);
      }

      /* Secondary */
      .cradle-btn--secondary {
        background: var(--cradle-surface-2, #172033);
        color: var(--cradle-text, #f3f4f6);
        border-color: var(--cradle-border, #374151);
      }
      .cradle-btn--secondary:not(:disabled):not(.cradle-btn--loading):hover {
        background: var(--cradle-surface, #111827);
        border-color: var(--cradle-accent-hover, #2563eb);
      }

      /* Outline */
      .cradle-btn--outline {
        background: transparent;
        color: var(--cradle-accent-hover, #2563eb);
        border-color: var(--cradle-accent-hover, #2563eb);
      }
      .cradle-btn--outline:not(:disabled):not(.cradle-btn--loading):hover {
        background: var(--cradle-accent-light, rgba(37,99,235,0.1));
      }

      /* Ghost */
      .cradle-btn--ghost {
        background: transparent;
        color: var(--cradle-text, #f3f4f6);
        border-color: var(--cradle-border, #374151);
      }
      .cradle-btn--ghost:not(:disabled):not(.cradle-btn--loading):hover {
        background: rgba(255, 255, 255, 0.06);
        border-color: var(--cradle-border-hover, #4b5563);
      }

      /* Success */
      .cradle-btn--success {
        background: var(--cradle-success, #16a34a);
        color: #ffffff;
        border-color: transparent;
        box-shadow: 0 6px 16px var(--cradle-success-bg, rgba(22,163,74,0.2));
      }
      .cradle-btn--success:not(:disabled):not(.cradle-btn--loading):hover {
        filter: brightness(1.1);
      }

      /* Danger */
      .cradle-btn--danger {
        background: var(--cradle-danger, #dc2626);
        color: #ffffff;
        border-color: transparent;
        box-shadow: 0 6px 16px var(--cradle-danger-bg, rgba(220,38,38,0.2));
      }
      .cradle-btn--danger:not(:disabled):not(.cradle-btn--loading):hover {
        filter: brightness(1.1);
      }

      /* Icon */
      .cradle-btn--icon {
        width: 40px;
        height: 40px;
        padding: 0;
        background: var(--cradle-surface, #111827);
        color: var(--cradle-text, #f3f4f6);
        border-color: var(--cradle-border, #374151);
        border-radius: var(--cradle-radius-pill, 999px);
      }
      .cradle-btn--icon.cradle-btn--sm { width: 32px; height: 32px; }
      .cradle-btn--icon.cradle-btn--lg { width: 52px; height: 52px; }
      .cradle-btn--icon:not(:disabled):hover {
        border-color: var(--cradle-accent-hover, #2563eb);
        color: var(--cradle-highlight, #93c5fd);
      }

      /* Full width */
      .cradle-btn--full-width {
        width: 100%;
      }

      /* ── Disabled state ──────────────────────────────────── */
      .cradle-btn:disabled,
      .cradle-btn--loading {
        opacity: 0.45;
        cursor: not-allowed;
        pointer-events: none;
      }

      /* ── Loading spinner ─────────────────────────────────── */
      .cradle-btn__spinner {
        display: inline-block;
        width: 1em;
        height: 1em;
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 50%;
        animation: cradle-spin 0.65s linear infinite;
        flex-shrink: 0;
      }

      @keyframes cradle-spin {
        to { transform: rotate(360deg); }
      }

      /* ── Icon wrappers ───────────────────────────────────── */
      .cradle-btn__icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Factory ──────────────────────────────────────────── */
  const CradleButton = {
    /**
     * Create a Button element.
     * @param {Object} options
     * @returns {HTMLButtonElement|HTMLAnchorElement}
     */
    create(options = {}) {
      injectStyles();

      const {
        variant = "primary",
        size = "md",
        disabled = false,
        loading = false,
        fullWidth = false,
        leftIcon = null,
        rightIcon = null,
        className = "",
        children = "",
        onClick = null,
        href = null,
        target = null,
        rel = null,
        ariaLabel = null,
        type = "button",
      } = options;

      const tag = href ? "a" : "button";
      const el = document.createElement(tag);

      /* Classes */
      const classes = [
        "cradle-btn",
        `cradle-btn--${variant}`,
        `cradle-btn--${size}`,
        fullWidth ? "cradle-btn--full-width" : "",
        loading ? "cradle-btn--loading" : "",
        className,
      ].filter(Boolean);
      el.className = classes.join(" ");

      /* Attributes */
      if (tag === "button") {
        el.type = type;
        if (disabled || loading) el.disabled = true;
      } else {
        el.href = href;
        if (target) el.target = target;
        if (rel) el.rel = rel;
        if (disabled) el.setAttribute("aria-disabled", "true");
      }
      if (ariaLabel) el.setAttribute("aria-label", ariaLabel);
      if (loading) el.setAttribute("aria-busy", "true");

      /* Content */
      el.innerHTML = "";

      if (loading) {
        const spinner = document.createElement("span");
        spinner.className = "cradle-btn__spinner";
        spinner.setAttribute("aria-hidden", "true");
        el.appendChild(spinner);
      }

      if (leftIcon && !loading) {
        const icon = document.createElement("span");
        icon.className = "cradle-btn__icon cradle-btn__icon--left";
        icon.setAttribute("aria-hidden", "true");
        icon.innerHTML = _sanitize(leftIcon);
        el.appendChild(icon);
      }

      if (children && variant !== "icon") {
        const label = document.createElement("span");
        label.textContent = children;
        el.appendChild(label);
      }

      if (rightIcon && !loading) {
        const icon = document.createElement("span");
        icon.className = "cradle-btn__icon cradle-btn__icon--right";
        icon.setAttribute("aria-hidden", "true");
        icon.innerHTML = _sanitize(rightIcon);
        el.appendChild(icon);
      }

      /* Event listener */
      if (onClick && !disabled && !loading) {
        el.addEventListener("click", onClick);
      }

      return el;
    },

    /**
     * Upgrade elements that have [data-cradle-btn] attribute.
     * Call after DOMContentLoaded.
     */
    upgradeAll() {
      injectStyles();
      document.querySelectorAll("[data-cradle-btn]").forEach(el => {
        const variant = el.dataset.variant || "primary";
        const size = el.dataset.size || "md";
        const leftIcon = el.dataset.leftIcon || null;
        const rightIcon = el.dataset.rightIcon || null;
        const fullWidth = el.dataset.fullWidth === "true";

        const classes = [
          "cradle-btn",
          `cradle-btn--${variant}`,
          `cradle-btn--${size}`,
          fullWidth ? "cradle-btn--full-width" : "",
        ].filter(Boolean);

        el.classList.add(...classes);

        /* Wrap existing text in a span to sit between icons */
        if ((leftIcon || rightIcon) && el.childNodes.length) {
          const textNodes = [...el.childNodes].filter(
            n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()
          );
          textNodes.forEach(node => {
            const span = document.createElement("span");
            span.textContent = node.textContent;
            el.replaceChild(span, node);
          });
        }

        if (leftIcon) {
          const icon = document.createElement("span");
          icon.className = "cradle-btn__icon cradle-btn__icon--left";
          icon.setAttribute("aria-hidden", "true");
          icon.innerHTML = _sanitize(leftIcon);
          el.insertBefore(icon, el.firstChild);
        }

        if (rightIcon) {
          const icon = document.createElement("span");
          icon.className = "cradle-btn__icon cradle-btn__icon--right";
          icon.setAttribute("aria-hidden", "true");
          icon.innerHTML = _sanitize(rightIcon);
          el.appendChild(icon);
        }
      });
    },
  };

  /* Auto-upgrade on ready */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () =>
      CradleButton.upgradeAll()
    );
  } else {
    CradleButton.upgradeAll();
  }

  /* Expose globally */
  global.CradleButton = CradleButton;
})(window);
