/* =========================================================
   URL PARSER — ENGINE MODULE

   URL decomposition, protocol scheme resolution, query string
   parameter extraction, validation, and component sanitization.
   ========================================================= */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.URLEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /**
   * Supported URI schemes.
   */
  const SUPPORTED_PROTOCOLS = [
    "http:",
    "https:",
    "ftp:",
    "mailto:",
  ];

  /**
   * Normalize a URL input before parsing.
   *
   * Scheme-less web addresses are treated as HTTPS URLs.
   * Existing URI schemes are preserved.
   */
  function normalizeURLInput(urlStr) {
    const input = urlStr.trim();

    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input)) {
      return input;
    }

    return `https://${input}`;
  }

  /**
   * Validate the raw URL structure before passing it to URL().
   *
   * This prevents the native URL parser from accepting unusual
   * inputs such as:
   *
   *   https:///path
   *   https://
   *   https://.
   *   https://..
   */
  function isValidRawURL(input) {
    if (!input || /[\u0000-\u001F\u007F]/.test(input)) {
      return false;
    }

    const schemeMatch = input.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);

    if (!schemeMatch) {
      return false;
    }

    const protocol = `${schemeMatch[1].toLowerCase()}:`;

    if (!SUPPORTED_PROTOCOLS.includes(protocol)) {
      return false;
    }

    /*
     * mailto: is a special URL format and does not use
     * //hostname syntax.
     */
    if (protocol === "mailto:") {
      const address = input.slice(schemeMatch[0].length);

      if (!address || address.includes("//")) {
        return false;
      }

      if (!address.includes("@")) {
        return false;
      }

      return true;
    }

    /*
     * HTTP, HTTPS and FTP must contain // followed by a host.
     */
    const authorityMatch = input.match(
      /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]*)/
    );

    if (!authorityMatch) {
      return false;
    }

    const authority = authorityMatch[1];

    // Host cannot be empty.
    if (!authority) {
      return false;
    }

    /*
     * Reject obvious malformed authorities.
     *
     * Examples:
     *   https:///
     *   https://./
     *   https://..
     *   https://:8080
     */
    if (
      authority === "." ||
      authority === ".." ||
      authority.startsWith(".") ||
      authority.endsWith(".") ||
      authority.startsWith(":")
    ) {
      return false;
    }

    return true;
  }

  /**
   * Validate a hostname after WHATWG URL normalization.
   *
   * Unicode domain names are supported because URL() converts
   * valid internationalized domain names to ASCII/punycode.
   */
  function isValidHostname(hostname) {
    if (!hostname) {
      return false;
    }

    // Reject whitespace and control characters.
    if (/[\s\u0000-\u001F\u007F]/.test(hostname)) {
      return false;
    }

    // Reject malformed hostname boundaries.
    if (
      hostname === "." ||
      hostname === ".." ||
      hostname.startsWith(".") ||
      hostname.endsWith(".") ||
      hostname.includes("..")
    ) {
      return false;
    }

    /*
     * IPv6 addresses are validated by the URL constructor.
     */
    if (hostname.includes(":")) {
      return true;
    }

    /*
     * Validate IPv4 addresses.
     */
    if (/^\d+(?:\.\d+){3}$/.test(hostname)) {
      const parts = hostname.split(".");

      return parts.every((part) => {
        if (part.length > 1 && part.startsWith("0")) {
          return false;
        }

        const value = Number(part);

        return value >= 0 && value <= 255;
      });
    }

    /*
     * Validate DNS / punycode labels.
     */
    const labels = hostname.split(".");

    for (const label of labels) {
      if (!label) {
        return false;
      }

      // DNS labels cannot begin or end with a hyphen.
      if (label.startsWith("-") || label.endsWith("-")) {
        return false;
      }

      // URL() converts valid internationalized labels to ASCII.
      if (!/^[a-zA-Z0-9-]+$/.test(label)) {
        return false;
      }

      // DNS labels have a maximum length of 63 characters.
      if (label.length > 63) {
        return false;
      }
    }

    // Maximum DNS hostname length.
    if (hostname.length > 253) {
      return false;
    }

    return true;
  }

  /**
   * Validate the complete parsed URL.
   */
  function isValidParsedURL(parsed) {
    const protocol = parsed.protocol;

    /*
     * Reject unsupported schemes.
     */
    if (!SUPPORTED_PROTOCOLS.includes(protocol)) {
      return false;
    }

    /*
     * mailto: URLs do not have a normal hostname.
     */
    if (protocol === "mailto:") {
      const address = parsed.pathname;

      if (!address || !address.trim()) {
        return false;
      }

      if (!address.includes("@")) {
        return false;
      }

      return true;
    }

    /*
     * HTTP, HTTPS and FTP require a hostname.
     */
    if (!isValidHostname(parsed.hostname)) {
      return false;
    }

    /*
     * Reject malformed explicit ports.
     *
     * URL() normally catches most invalid ports, but keeping
     * the validation explicit makes the application safer.
     */
    if (parsed.port && !/^\d+$/.test(parsed.port)) {
      return false;
    }

    /*
     * Valid TCP port range.
     */
    if (parsed.port) {
      const port = Number(parsed.port);

      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return false;
      }
    }

    return true;
  }

  /**
   * Parse URL string into structured component metadata.
   */
  function parseURLComponents(urlStr = "") {
    /*
     * Reject empty, whitespace-only and non-string input.
     */
    if (typeof urlStr !== "string" || !urlStr.trim()) {
      return {
        components: null,
        error: "Please enter a valid URL.",
      };
    }

    const input = normalizeURLInput(urlStr);

    /*
     * Validate the structure before URL() gets a chance
     * to normalize unusual input.
     */
    if (!isValidRawURL(input)) {
      return {
        components: null,
        error: "Please enter a valid URL.",
      };
    }

    try {
      const parsed = new URL(input);

      if (!isValidParsedURL(parsed)) {
        return {
          components: null,
          error: "Please enter a valid URL.",
        };
      }

      const queryParams = [];

      parsed.searchParams.forEach((value, key) => {
        queryParams.push({
          key,
          value,
        });
      });

      const components = {
        href: parsed.href,
        protocol: parsed.protocol.replace(":", ""),
        hostname: parsed.hostname,
        port:
          parsed.port ||
          (parsed.protocol === "https:"
            ? "443"
            : parsed.protocol === "http:"
              ? "80"
              : ""),
        pathname: parsed.pathname,
        search: parsed.search,
        hash: parsed.hash,
        origin: parsed.origin,
        queryParams,
      };

      return {
        components,
        error: null,
      };
    } catch {
      return {
        components: null,
        error: "Please enter a valid URL.",
      };
    }
  }

  /**
   * Build search string from query parameters array.
   */
  function buildQueryString(paramArray = []) {
    if (!Array.isArray(paramArray) || !paramArray.length) {
      return "";
    }

    const params = new URLSearchParams();

    paramArray.forEach(({ key, value }) => {
      if (key) {
        params.append(key, value ?? "");
      }
    });

    const str = params.toString();

    return str ? `?${str}` : "";
  }

  /**
   * Safe percent encoding helper.
   */
  function encodeURLComponentSafe(str = "") {
    try {
      return encodeURIComponent(str);
    } catch {
      return str;
    }
  }

  /**
   * Safe percent decoding helper.
   */
  function decodeURLComponentSafe(str = "") {
    try {
      return decodeURIComponent(str);
    } catch {
      return str;
    }
  }

  /**
   * Classify a file extension into a broad media type.
   */
  function detectFileType(extension) {
    const normalizedExtension =
      typeof extension === "string"
        ? extension.toLowerCase().replace(/^\./, "")
        : "";

    const images = [
      "png",
      "jpg",
      "jpeg",
      "gif",
      "webp",
      "svg",
      "avif",
    ];

    const videos = [
      "mp4",
      "webm",
      "mov",
      "mkv",
    ];

    const documents = [
      "pdf",
      "doc",
      "docx",
      "txt",
    ];

    if (images.includes(normalizedExtension)) {
      return "Image ";
    }

    if (videos.includes(normalizedExtension)) {
      return "Video ";
    }

    if (documents.includes(normalizedExtension)) {
      return "Document ";
    }

    return "Unknown";
  }

  /**
   * Classify a URL into a human-readable type.
   */
  function detectURLType(url, extension) {
    const normalizedExtension =
      typeof extension === "string"
        ? extension.toLowerCase().replace(/^\./, "")
        : "";

    if (
      ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(
        normalizedExtension
      )
    ) {
      return "Image URL";
    }

    if (
      ["mp4", "webm", "mov"].includes(normalizedExtension)
    ) {
      return "Video URL";
    }

    if (url.hostname.includes("api")) {
      return "API Endpoint";
    }

    if (url.hostname.includes("github.com")) {
      return "GitHub URL";
    }

    if (
      url.hostname.includes("youtube.com") ||
      url.hostname.includes("youtu.be")
    ) {
      return "YouTube URL";
    }

    if (url.protocol === "ftp:") {
      return "FTP URL";
    }

    if (url.protocol === "mailto:") {
      return "Email URL";
    }

    return "Website URL";
  }

  /**
   * Escape a value for safe interpolation into innerHTML.
   */
  const escapeHTML =
    typeof window !== "undefined" && window.CradleEscape
      ? window.CradleEscape.escapeHtml
      : require("../../../src/components/ui/escapeHtml.js").escapeHtml;

  return {
    parseURLComponents,
    buildQueryString,
    encodeURLComponentSafe,
    decodeURLComponentSafe,
    detectFileType,
    detectURLType,
    escapeHTML,
  };
});