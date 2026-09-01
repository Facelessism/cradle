/**
 * Cradle UI — HTML Sanitization Utility
 * ──────────────────────────────────────
 * Strips dangerous HTML patterns while preserving safe markup.
 * Use before inserting user-supplied strings into innerHTML.
 *
 * Browser:  window.CradleSanitize.sanitizeHtml(value)
 * Node:     require("src/components/ui/sanitizeHtml.js").sanitizeHtml(value)
 *
 * Allowed:  standard text-level and structural elements,
 *           SVG elements and attributes, safe attributes.
 * Blocked:  <script>, <iframe>, <object>, <embed>, <form>,
 *           event handlers (on*), javascript: URLs, data: URLs,
 *           style attributes (for XSS via CSS expressions).
 */
(function (exports) {
  "use strict";

  /**
   * Elements that are always stripped because they can execute code
   * or load remote resources without user interaction.
   */
  const BLOCKED_TAGS =
    /<(\/)?\s*(script|iframe|object|embed|form|input|textarea|select|link|meta|base|applet)\b[^>]*>/gi;

  /**
   * Event-handler attributes (on*).  Matched case-insensitively
   * against attribute names at the start of a tag.
   */
  const EVENT_HANDLER =
    /\s+on[a-z][a-z0-9]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

  /**
   * Dangerous attribute values: javascript:, data: (non-image),
   * vbscript:, and expression() CSS.
   */
  const DANGEROUS_URL =
    /\b(?:href|src|action|formaction|poster|background|dynsrc)\s*=\s*(?:"\s*(?:javascript|vbscript|data)\s*:"|'\s*(?:javascript|vbscript|data)\s*:'|(?:javascript|vbscript|data)\s*:)/gi;

  /**
   * Inline style attribute — can contain CSS expressions,
   * url() with javascript:, etc.  Stripped entirely.
   */
  const STYLE_ATTR = /\s+style\s*=\s*(?:"[^"]*"|'[^']*')/gi;

  /**
   * <a> tags with dangerous protocols.
   */
  const DANGEROUS_ANCHOR =
    /<a\b[^>]*\s+href\s*=\s*(?:"\s*(?:javascript|vbscript|data)\s*:"|'\s*(?:javascript|vbscript|data)\s*:'|(?:javascript|vbscript|data)\s*:)[^>]*>/gi;

  /**
   * Sanitize an HTML string by removing dangerous elements and attributes.
   *
   * @param {string} html - Raw HTML string
   * @returns {string} Sanitized HTML safe for innerHTML
   */
  function sanitizeHtml(html) {
    if (typeof html !== "string") return "";
    if (!html) return "";

    let safe = html;

    /* Strip blocked elements entirely (opening + content + closing) */
    safe = safe.replace(
      /<(\/)?\s*(script|iframe|object|embed|form|input|textarea|select|link|meta|base|applet)\b[^>]*>[\s\S]*?<(\/)\s*\2\s*>/gi,
      ""
    );
    /* Also remove self-closing or unclosed blocked tags */
    safe = safe.replace(BLOCKED_TAGS, "");

    /* Remove event handlers from all tags */
    safe = safe.replace(EVENT_HANDLER, "");

    /* Remove dangerous protocol URLs in href/src/action/etc */
    safe = safe.replace(DANGEROUS_URL, "");

    /* Remove inline style attributes */
    safe = safe.replace(STYLE_ATTR, "");

    /* Remove dangerous <a> protocols */
    safe = safe.replace(DANGEROUS_ANCHOR, "");

    return safe;
  }

  exports.sanitizeHtml = sanitizeHtml;
})(
  typeof exports === "undefined"
    ? (window.CradleSanitize = {})
    : exports
);
