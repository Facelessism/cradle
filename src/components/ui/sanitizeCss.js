/**
 * Cradle UI — CSS Sanitization Utility
 * ─────────────────────────────────
 * Prevents arbitrary style injection by restricting user-supplied CSS
 * to an explicit allowlist of safe properties and validating values.
 *
 * Any feature that accepts or constructs CSS from user-controlled values
 * should use this module to reject unsupported declarations.
 *
 *   Browser:  window.CradleSanitizeCss.sanitizeCssProperty(...)
 *   Node:     require("src/components/ui/sanitizeCss.js").sanitizeCssProperty(...)
 *
 * Usage:
 *   const prop = sanitizeCssProperty(userProperty);
 *   if (!prop) throw new Error("Unsupported CSS property");
 *   element.style.setProperty(prop, safeValue);
 */

(function (exports) {
  "use strict";

  /**
   * Explicit allowlist of CSS properties that are safe to set from
   * user-controlled input. Covers clamp-able sizing/spacing properties
   * plus variables used by shape designer and other visual tools.
   *
   * Any property not in this set is rejected. Additions must be
   * reviewed for injection risk (e.g. `behavior`, ` -moz-binding`,
   * `expression` are intentionally excluded).
   */
  const ALLOWED_CSS_PROPERTIES = new Set([
    // clamp-calculator: fluid type / spacing / layout
    "font-size",
    "width",
    "height",
    "max-width",
    "min-width",
    "max-height",
    "min-height",
    "padding",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "padding-block",
    "padding-inline",
    "padding-block-start",
    "padding-block-end",
    "padding-inline-start",
    "padding-inline-end",
    "margin",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "margin-block",
    "margin-inline",
    "margin-block-start",
    "margin-block-end",
    "margin-inline-start",
    "margin-inline-end",
    "gap",
    "row-gap",
    "column-gap",
    "inset",
    "top",
    "right",
    "bottom",
    "left",
    "flex-basis",
    "line-height",
    "letter-spacing",
    "border-radius",
    "border-width",
    "grid-template-columns",
    "grid-template-rows",
    // shape designer / general safe visual properties
    "clip-path",
    "background",
    "background-image",
    "filter",
    "border",
  ]);

  /**
   * Pattern for a syntactically valid CSS property name (kebab-case).
   * Rejects strings containing `;`, `}`, `:`, whitespace, or other
   * characters that could break out of a declaration.
   */
  const CSS_PROPERTY_PATTERN = /^[a-z][a-z0-9-]*$/;

  /**
   * Dangerous CSS value patterns that indicate injection attempts.
   * Includes legacy IE `expression()`, `behavior`, ` -moz-binding`,
   * `javascript:` / `vbscript:` / `data:` with executable content,
   * and attempts to close a declaration with `;` or `}`.
   */
  const DANGEROUS_VALUE_PATTERNS = [
    /expression\s*\(/i,
    /behavior\s*:/i,
    /-moz-binding\s*:/i,
    /javascript\s*:/i,
    /vbscript\s*:/i,
    /@import/i,
  ];

  /**
   * Validates and normalizes a CSS property name against the allowlist.
   *
   * @param {string} property - raw property name from user input
   * @param {string|null} [fallback=null] - value to return if rejected
   * @returns {string|null} normalized property if allowed, otherwise fallback
   */
  function sanitizeCssProperty(property, fallback) {
    if (fallback === undefined) fallback = null;
    if (typeof property !== "string") return fallback;
    const normalized = property.trim().toLowerCase();
    if (normalized.length === 0 || normalized.length > 50) return fallback;
    if (!CSS_PROPERTY_PATTERN.test(normalized)) return fallback;
    if (!ALLOWED_CSS_PROPERTIES.has(normalized)) return fallback;
    return normalized;
  }

  /**
   * Checks whether a property is in the allowlist without sanitizing.
   *
   * @param {string} property
   * @returns {boolean}
   */
  function isAllowedCssProperty(property) {
    if (typeof property !== "string") return false;
    const normalized = property.trim().toLowerCase();
    if (!CSS_PROPERTY_PATTERN.test(normalized)) return false;
    return ALLOWED_CSS_PROPERTIES.has(normalized);
  }

  /**
   * Validates a CSS value string for injection patterns.
   * Returns the trimmed value if safe, otherwise fallback.
   *
   * @param {string} value
   * @param {string|null} [fallback=null]
   * @returns {string|null}
   */
  function sanitizeCssValue(value, fallback) {
    if (fallback === undefined) fallback = null;
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    if (trimmed.length === 0) return fallback;
    if (trimmed.length > 2000) return fallback;

    // Reject values that attempt to break out of a declaration
    if (trimmed.includes(";") && /;\s*[a-z-]+\s*:/i.test(trimmed)) {
      return fallback;
    }
    if (trimmed.includes("}")) return fallback;

    for (const pattern of DANGEROUS_VALUE_PATTERNS) {
      if (pattern.test(trimmed)) return fallback;
    }

    // Block url() with executable schemes
    const urlMatch = trimmed.match(/url\s*\(\s*["']?\s*([^"')\s]+)/i);
    if (urlMatch) {
      const urlContent = urlMatch[1].trim();
      // Allow relative URLs and safe schemes; block javascript:, vbscript:, data: (except image data)
      if (/^\s*javascript:/i.test(urlContent)) return fallback;
      if (/^\s*vbscript:/i.test(urlContent)) return fallback;
      if (/^\s*data:/i.test(urlContent)) {
        // Only allow data:image/* (for thumbnails), block text/html etc.
        if (
          !/^\s*data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);/i.test(urlContent)
        ) {
          return fallback;
        }
      }
      // Block if url content contains quotes that could break out
      if (/["']/.test(urlContent)) return fallback;
    }

    return trimmed;
  }

  /**
   * Validates a full CSS declaration `property: value`.
   * Returns `{ property, value }` if both are safe, otherwise null.
   *
   * @param {string} property
   * @param {string} value
   * @returns {{property: string, value: string}|null}
   */
  function sanitizeCssDeclaration(property, value) {
    const safeProp = sanitizeCssProperty(property, null);
    if (safeProp === null) return null;
    const safeVal = sanitizeCssValue(value, null);
    if (safeVal === null) return null;
    return { property: safeProp, value: safeVal };
  }

  /**
   * Parses a CSS style string like "prop: value; prop2: value2" and
   * returns only the allowlisted, safe declarations joined with `; `.
   * Unsupported or dangerous declarations are silently dropped.
   *
   * @param {string} cssText
   * @returns {string}
   */
  function sanitizeInlineStyle(cssText) {
    if (typeof cssText !== "string") return "";
    const declarations = cssText.split(";");
    const safe = [];
    for (const decl of declarations) {
      const trimmed = decl.trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;
      const prop = trimmed.slice(0, colonIdx).trim();
      const val = trimmed.slice(colonIdx + 1).trim();
      const sanitized = sanitizeCssDeclaration(prop, val);
      if (sanitized) {
        safe.push(`${sanitized.property}: ${sanitized.value}`);
      }
    }
    return safe.join("; ");
  }

  /**
   * Sanitizes a URL for use inside a CSS `url()` context.
   * Reuses the same scheme allowlist as sanitizeUrl (https, http)
   * but also allows relative URLs. Rejects javascript:, data: (non-image),
   * and URLs containing characters that could break out of url("...").
   *
   * @param {string} url
   * @param {string} [fallback=""]
   * @returns {string}
   */
  function sanitizeCssUrl(url, fallback) {
    if (fallback === undefined) fallback = "";
    if (typeof url !== "string") return fallback;
    const trimmed = url.trim();
    if (trimmed === "") return fallback;
    if (trimmed.length > 2000) return fallback;
    // Breakout characters — always reject quotes, parens, braces, newlines
    if (/["'\)]/.test(trimmed)) return fallback;
    if (/[\n\r{}]/.test(trimmed)) return fallback;

    // Data URLs: validate before rejecting `;` (they legitimately contain `;base64,`)
    if (/^data:/i.test(trimmed)) {
      if (
        !/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i.test(trimmed)
      ) {
        // Also allow non-base64 data image URIs like data:image/svg+xml,...
        if (!/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml),/i.test(trimmed)) {
          return fallback;
        }
      }
      // Data image URLs should not contain `;` beyond the expected `;base64,` prefix
      // but we already validated the prefix, so allow
      if (/["'\)\n\r{}]/.test(trimmed)) return fallback;
      return trimmed;
    }

    // For non-data URLs, reject semicolons that could break out of url()
    if (trimmed.includes(";")) return fallback;
    if (trimmed.includes(":")) {
      const scheme = trimmed.slice(0, trimmed.indexOf(":")).toLowerCase();
      const ALLOWED = new Set(["https", "http"]);
      if (!ALLOWED.has(scheme)) return fallback;
    }
    return trimmed;
  }

  /**
   * Validates a hex color string (#RGB, #RRGGBB, #RRGGBBAA).
   *
   * @param {string} value
   * @param {string} fallback
   * @returns {string}
   */
  function sanitizeHexColor(value, fallback) {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
    return fallback;
  }

  exports.ALLOWED_CSS_PROPERTIES = ALLOWED_CSS_PROPERTIES;
  exports.sanitizeCssProperty = sanitizeCssProperty;
  exports.isAllowedCssProperty = isAllowedCssProperty;
  exports.sanitizeCssValue = sanitizeCssValue;
  exports.sanitizeCssDeclaration = sanitizeCssDeclaration;
  exports.sanitizeInlineStyle = sanitizeInlineStyle;
  exports.sanitizeCssUrl = sanitizeCssUrl;
  exports.sanitizeHexColor = sanitizeHexColor;
})(typeof exports === "undefined" ? (window.CradleSanitizeCss = {}) : exports);
