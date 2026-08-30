/**
 * Cradle UI — Card Component
 * ───────────────────────────
 * Composable card primitives: Card, CardHeader, CardContent, CardFooter.
 *
 * Usage (imperative):
 *
 *   const card = CradleCard.create({
 *     title:    'My Card',
 *     subtitle: 'A short description',
 *     image:    'https://...jpg',   // optional hero image src
 *     icon:     '🎮',               // optional icon (string / HTML)
 *     badge:    'New',              // optional badge label
 *     isNew:    true,                // optional "New" ribbon badge
 *     children: '<p>Body content</p>',
 *     footer:   '<button>Open</button>',
 *     clickable: true,              // adds hover-lift + cursor pointer
 *     onClick:  (e) => {},
 *     className: '',
 *   });
 *   document.body.appendChild(card);
 *
 * Usage (HTML — auto-enhanced on DOMContentLoaded):
 *   <div data-cradle-card data-title="Title" data-badge="New">
 *     <p>Content goes here</p>
 *   </div>
 *
 * Composable sub-components also available on CradleCard:
 *   CradleCard.Header({ title, subtitle, icon, badge })
 *   CradleCard.Content({ children })          // accepts string or Element
 *   CradleCard.Footer({ children, align })    // align: 'left'|'right'|'between'
 */

(function (global) {
  "use strict";

  const STYLE_ID = "cradle-card-styles";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* ── Base Card ────────────────────────────────────── */
      .cradle-card {
        background: var(--cradle-surface, #111827);
        border: 1px solid var(--cradle-border, #374151);
        border-radius: var(--cradle-radius-lg, 20px);
        box-shadow: var(--cradle-shadow, 0 10px 30px rgba(0,0,0,0.35));
        overflow: hidden;
        position: relative;
        display: flex;
        flex-direction: column;
        transition:
          transform var(--cradle-transition, 0.35s cubic-bezier(0.22,1,0.36,1)),
          border-color var(--cradle-transition, 0.35s cubic-bezier(0.22,1,0.36,1)),
          box-shadow var(--cradle-transition, 0.35s cubic-bezier(0.22,1,0.36,1));
      }

      .cradle-card:focus-visible {
        outline: 2px solid var(--cradle-accent-hover, #2563eb);
        outline-offset: 2px;
      }

      /* Hover elevation — only when .cradle-card--clickable */
      .cradle-card--clickable {
        cursor: pointer;
      }
      .cradle-card--clickable:hover {
        transform: translateY(-6px);
        border-color: var(--cradle-accent-hover, #2563eb);
        box-shadow: var(--cradle-shadow-lg, 0 24px 60px rgba(0,0,0,0.45));
      }
      .cradle-card--clickable:active {
        transform: translateY(-2px);
      }

      .cradle-card__new-ribbon {
        position: absolute;
        top: var(--cradle-space-3, 12px);
        right: var(--cradle-space-3, 12px);
        padding: 3px 10px;
        border-radius: var(--cradle-radius-pill, 999px);
        background: var(--cradle-warning-bg, rgba(245,158,11,0.15));
        color: var(--cradle-warning, #f59e0b);
        border: 1px solid var(--cradle-warning, #f59e0b);
        font-size: var(--cradle-font-size-xs, 0.75rem);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        z-index: 1;
      }

      /* ── Hero image ─────────────────────────────────── */
      .cradle-card__image {
        width: 100%;
        aspect-ratio: 16 / 9;
        object-fit: cover;
        display: block;
        flex-shrink: 0;
      }

      /* Shown when a thumbnail is missing or fails to load, instead of the
         browser's broken-image icon. */
      .cradle-card__image--fallback {
        display: flex;
        align-items: center;
        justify-content: center;
        object-fit: unset;
        background: var(--cradle-color-surface-2, #1a1a1a);
        color: var(--cradle-color-text-muted, #888);
        font-size: 2.5rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      /* ── Header ─────────────────────────────────────── */
      .cradle-card__header {
        display: flex;
        align-items: flex-start;
        gap: var(--cradle-space-3, 12px);
        padding: var(--cradle-space-5, 20px) var(--cradle-space-5, 20px) 0;
        flex:1;
      }

      .cradle-card__icon {
        font-size: 1.6rem;
        line-height: 1;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .cradle-card__header-text {
        flex: 1;
        min-width: 0;
        display:flex;
        flex-direction:column;
        height:100%
      }

      .cradle-card__title-row {
        display: flex;
        align-items: center;
        gap: var(--cradle-space-2, 8px);
        flex-wrap: wrap;
      }

      .cradle-card__title {
        margin: 0;
        font-size: var(--cradle-font-size-lg, 1.125rem);
        font-weight: 700;
        color: var(--cradle-text, #f3f4f6);
        font-family: var(--cradle-font-body, 'Space Grotesk', system-ui, sans-serif);
        line-height: 1.3;
        overflow-wrap: break-word;
      }

      .cradle-card__badge {
        display: inline-block;
        padding: 3px 10px;
        border-radius: var(--cradle-radius-pill, 999px);
        background: var(--cradle-accent-light, rgba(37,99,235,0.15));
        color: var(--cradle-highlight, #93c5fd);
        font-size: var(--cradle-font-size-xs, 0.75rem);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        flex-shrink: 0;
      }

      .cradle-card__subtitle {
        margin: auto 0 0;
        padding-top: var(--cradle-space-2, 8px);
        font-size: var(--cradle-font-size-sm, 0.875rem);
        color: var(--cradle-text-secondary, #cbd5e1);
        line-height: 1.5;
        overflow-wrap: break-word;
        word-break: break-word;
      }

      /* ── Content ─────────────────────────────────────── */
      .cradle-card__content {
        padding: var(--cradle-space-4, 16px) var(--cradle-space-5, 20px);
        flex: 1;
        color: var(--cradle-text-secondary, #cbd5e1);
        font-size: var(--cradle-font-size-sm, 0.875rem);
        line-height: 1.65;
      }

      /* When card has header, reduce top padding of content */
      .cradle-card__header + .cradle-card__content {
        padding-top: var(--cradle-space-3, 12px);
      }

       .cradle-card__header + .cradle-card__footer {
        padding-top: var(--cradle-space-4, 16px);
      }
      /* ── Footer ─────────────────────────────────────── */
      .cradle-card__footer {
        display: flex;
        align-items: center;
        gap: var(--cradle-space-3, 12px);
        padding: 0 var(--cradle-space-5, 20px) var(--cradle-space-5, 20px);
        flex-wrap: wrap;
        margin-top: auto;
        flex-shrink: 0;
      }

      .cradle-card__footer--left    { justify-content: flex-start; }
      .cradle-card__footer--right   { justify-content: flex-end; }
      .cradle-card__footer--between { justify-content: space-between; }

      /* ── Responsive ──────────────────────────────────── */
      @media (max-width: 480px) {
        .cradle-card__header,
        .cradle-card__content,
        .cradle-card__footer {
          padding-left: var(--cradle-space-4, 16px);
          padding-right: var(--cradle-space-4, 16px);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createFallbackImage(title) {
    const fallback = document.createElement("div");
    fallback.className = "cradle-card__image cradle-card__image--fallback";
    fallback.setAttribute("role", "img");
    fallback.setAttribute("aria-label", title || "Thumbnail fallback");
    const firstChar = (title || "?").trim().charAt(0) || "?";
    fallback.textContent = firstChar.toUpperCase();
    return fallback;
  }

  function isValidImageUrl(url) {
    if (typeof url !== "string") return false;
    const trimmed = url.trim();
    if (!trimmed) return false;
    if (
      trimmed === "undefined" ||
      trimmed === "null" ||
      trimmed === "data:," ||
      trimmed === "data:image/svg+xml;base64," ||
      trimmed.startsWith("javascript:")
    ) {
      return false;
    }
    if (trimmed === "http://" || trimmed === "https://" || trimmed === "//") {
      return false;
    }
    return true;
  }

  /* ── Sub-component builders ───────────────────────────── */

  /** Build a CardHeader element */
  function buildHeader({ title, subtitle, icon, badge } = {}) {
    const header = document.createElement("div");
    header.className = "cradle-card__header";

    if (icon) {
      const iconEl = document.createElement("div");
      iconEl.className = "cradle-card__icon";
      iconEl.setAttribute("aria-hidden", "true");
      iconEl.innerHTML = icon;
      header.appendChild(iconEl);
    }

    const textWrapper = document.createElement("div");
    textWrapper.className = "cradle-card__header-text";

    if (title) {
      const titleRow = document.createElement("div");
      titleRow.className = "cradle-card__title-row";

      const h = document.createElement("h3");
      h.className = "cradle-card__title";
      h.textContent = title;
      titleRow.appendChild(h);

      if (badge) {
        const b = document.createElement("span");
        b.className = "cradle-card__badge";
        b.textContent = badge;
        titleRow.appendChild(b);
      }

      textWrapper.appendChild(titleRow);
    }

    if (subtitle) {
      const sub = document.createElement("p");
      sub.className = "cradle-card__subtitle";
      sub.textContent = subtitle;
      textWrapper.appendChild(sub);
    }

    header.appendChild(textWrapper);
    return header;
  }

  /** Build a CardContent element */
  function buildContent({ children } = {}) {
    const content = document.createElement("div");
    content.className = "cradle-card__content";
    if (typeof children === "string") {
      content.innerHTML = children;
    } else if (children instanceof Element) {
      content.appendChild(children);
    }
    return content;
  }

  /** Build a CardFooter element */
  function buildFooter({ children, align = "left" } = {}) {
    const footer = document.createElement("div");
    footer.className = `cradle-card__footer cradle-card__footer--${align}`;
    if (typeof children === "string") {
      footer.innerHTML = children;
    } else if (children instanceof Element) {
      footer.appendChild(children);
    } else if (Array.isArray(children)) {
      children.forEach(child => {
        if (child instanceof Element) footer.appendChild(child);
      });
    }
    return footer;
  }

  /* ── Main factory ─────────────────────────────────────── */
  const CradleCard = {
    /**
     * Create a fully composed Card element.
     * @param {Object} options
     * @returns {HTMLElement}
     */
    create(options = {}) {
      injectStyles();

      const {
        title = null,
        subtitle = null,
        image = null,
        icon = null,
        badge = null,
        isNew = false,
        children = null,
        footer = null,
        clickable = false,
        onClick = null,
        className = "",
        ariaLabel = null,
      } = options;

      const card = document.createElement("article");
      card.className = [
        "cradle-card",
        clickable ? "cradle-card--clickable" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ");

      if (ariaLabel) card.setAttribute("aria-label", ariaLabel);
      if (clickable) {
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        if (onClick) {
          card.addEventListener("click", onClick);
          card.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick(e);
            }
          });
        }
      }

      if (isNew) {
        const ribbon = document.createElement("span");
        ribbon.className = "cradle-card__new-ribbon";
        ribbon.textContent = "New";
        card.appendChild(ribbon);
      }

      /* Hero image */
      if ("image" in options && options.image !== undefined) {
        if (isValidImageUrl(image)) {
          const img = document.createElement("img");
          img.className = "cradle-card__image";
          img.src = image.trim();
          img.alt = title || "";
          img.loading = "lazy";
          let failed = false;
          img.addEventListener("error", () => {
            if (!failed) {
              failed = true;
              img.replaceWith(createFallbackImage(title));
            }
          });
          card.appendChild(img);
        } else {
          card.appendChild(createFallbackImage(title));
        }
      }

      /* Header */
      if (title || icon || badge) {
        card.appendChild(buildHeader({ title, subtitle, icon, badge }));
      }

      /* Content */
      if (children) {
        const contentEl = buildContent({ children });
        /* If no header, add subtitle inside content as a fallback */
        if (!title && subtitle) {
          const sub = document.createElement("p");
          sub.className = "cradle-card__subtitle";
          sub.textContent = subtitle;
          contentEl.insertBefore(sub, contentEl.firstChild);
        }
        card.appendChild(contentEl);
      }

      /* Footer */
      if (footer) {
        card.appendChild(
          buildFooter({
            children: footer,
            align: options.footerAlign || "left",
          })
        );
      }

      return card;
    },

    /* Expose sub-builders for direct composition */
    Header: buildHeader,
    Content: buildContent,
    Footer: buildFooter,

    /**
     * Upgrade elements that have [data-cradle-card] attribute.
     */
    upgradeAll() {
      injectStyles();
      document.querySelectorAll("[data-cradle-card]").forEach(el => {
        el.classList.add("cradle-card");
        if (el.dataset.clickable === "true") {
          el.classList.add("cradle-card--clickable");
          el.setAttribute("tabindex", "0");
        }

        /* Wrap existing content in card__content if not already structured */
        const hasStructure = el.querySelector(
          ".cradle-card__header, .cradle-card__content, .cradle-card__footer"
        );
        if (!hasStructure && el.innerHTML.trim()) {
          const wrapper = document.createElement("div");
          wrapper.className = "cradle-card__content";
          while (el.firstChild) wrapper.appendChild(el.firstChild);
          el.appendChild(wrapper);
        }

        /* Inject header from data attributes */
        if (el.dataset.title) {
          const header = buildHeader({
            title: el.dataset.title,
            subtitle: el.dataset.subtitle || null,
            icon: el.dataset.icon || null,
            badge: el.dataset.badge || null,
          });
          el.insertBefore(header, el.firstChild);
        }
      });
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () =>
      CradleCard.upgradeAll()
    );
  } else {
    CradleCard.upgradeAll();
  }

  global.CradleCard = CradleCard;
})(window);
