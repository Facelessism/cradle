/* =========================================================
   API RESPONSE INSPECTOR — ENGINE MODULE
   Pure helpers: header parsing/formatting, byte-size display,
   JSON pretty-printing, request option building, cURL command
   parsing/importing, code snippet generators (cURL, fetch, Python),
   and high-resolution network timing breakdown.
   Kept dependency-free so it can be unit-tested in Node.
   ========================================================= */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.APIEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /** Turn "Key: Value" per-line textarea input into a headers object. */
  function parseHeadersText(text = "") {
    const headers = {};
    const errors = [];

    String(text)
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .forEach(line => {
        const idx = line.indexOf(":");
        if (idx === -1) {
          errors.push(`Ignored invalid header line: "${line}"`);
          return;
        }
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (key) headers[key] = value;
      });

    return { headers, errors };
  }

  /** Convert a fetch Response.headers iterator into a sorted array. */
  function formatResponseHeaders(headersIterable) {
    const list = [];
    if (headersIterable && typeof headersIterable.forEach === "function") {
      headersIterable.forEach((value, key) => list.push({ key, value }));
    }
    return list.sort((a, b) => a.key.localeCompare(b.key));
  }

  /** Human-readable byte size ("1.20 KB", "512 B"). */
  function formatBytes(bytes) {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return "Unknown";
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );
    const value = bytes / Math.pow(1024, i);
    return `${i === 0 ? value : value.toFixed(2)} ${units[i]}`;
  }

  /** Human-readable duration ("342 ms", "1.34 s"). */
  function formatDuration(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return "Unknown";
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  /** Try to pretty-print a response body as JSON; fall back to raw text. */
  function formatResponseBody(text) {
    if (!text) return { formatted: "", isJson: false };
    try {
      const parsed = JSON.parse(text);
      return { formatted: JSON.stringify(parsed, null, 2), isJson: true };
    } catch (err) {
      return { formatted: text, isJson: false };
    }
  }

  /** Map an HTTP status code to a semantic tone for styling. */
  function statusTone(status) {
    if (status >= 200 && status < 300) return "success";
    if (status >= 300 && status < 400) return "info";
    if (status >= 400 && status < 500) return "warning";
    if (status >= 500) return "danger";
    return "neutral";
  }

  /** Build fetch() options from method / headers text / body text. */
  function buildRequestOptions(method, headersText, bodyText) {
    const { headers, errors } = parseHeadersText(headersText);
    const options = { method: method || "GET", headers };

    const bodyAllowed = !["GET", "HEAD"].includes(
      (method || "GET").toUpperCase()
    );
    if (bodyAllowed && bodyText && bodyText.trim()) {
      options.body = bodyText;
      if (!Object.keys(headers).some(h => h.toLowerCase() === "content-type")) {
        options.headers["Content-Type"] = "application/json";
      }
    }

    return { options, errors };
  }

  /** Fetch with timeout support using AbortController. */
  async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error(`Request timed out (limit: ${timeoutMs}ms)`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /* ─── cURL Command Parser ────────────────────────────────────────── */

  /**
   * Tokenize raw cURL string respecting quotes, backslashes, and line wraps.
   */
  function tokenizeCurl(text) {
    const cleaned = String(text)
      .replace(/\\\r?\n/g, " ")
      .replace(/\^\r?\n/g, " ")
      .trim();

    const tokens = [];
    let current = "";
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escapeNext = false;

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];

      if (escapeNext) {
        current += char;
        escapeNext = false;
        continue;
      }

      if (char === "\\") {
        escapeNext = true;
        continue;
      }

      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        continue;
      }

      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }

      if (/\s/.test(char) && !inSingleQuote && !inDoubleQuote) {
        if (current.length > 0) {
          tokens.push(current);
          current = "";
        }
        continue;
      }

      current += char;
    }

    if (current.length > 0) {
      tokens.push(current);
    }

    return tokens;
  }

  /**
   * Parse a cURL command line string into method, url, headers, and body.
   */
  function parseCurlCommand(curlText) {
    if (!curlText || typeof curlText !== "string") {
      return {
        method: "GET",
        url: "",
        headers: {},
        headersText: "",
        body: "",
        errors: ["Empty cURL command."],
      };
    }

    const tokens = tokenizeCurl(curlText);
    if (!tokens.length) {
      return {
        method: "GET",
        url: "",
        headers: {},
        headersText: "",
        body: "",
        errors: ["No tokens found in cURL command."],
      };
    }

    let startIdx = 0;
    if (
      tokens[0].toLowerCase() === "curl" ||
      tokens[0].toLowerCase() === "curl.exe"
    ) {
      startIdx = 1;
    }

    let method = null;
    let url = "";
    const headers = {};
    const dataParts = [];
    const errors = [];

    for (let i = startIdx; i < tokens.length; i++) {
      const token = tokens[i];

      // Method flag: -X, --request
      if (token === "-X" || token === "--request") {
        if (i + 1 < tokens.length) {
          method = tokens[++i].toUpperCase();
        }
        continue;
      }
      if (token.startsWith("-X") && token.length > 2) {
        method = token.slice(2).toUpperCase();
        continue;
      }
      if (token.startsWith("--request=")) {
        method = token.slice(10).toUpperCase();
        continue;
      }

      // Head-only flag: -I, --head
      if (token === "-I" || token === "--head") {
        method = "HEAD";
        continue;
      }

      // Header flag: -H, --header
      if (token === "-H" || token === "--header") {
        if (i + 1 < tokens.length) {
          const headerStr = tokens[++i];
          const colonIdx = headerStr.indexOf(":");
          if (colonIdx !== -1) {
            const hKey = headerStr.slice(0, colonIdx).trim();
            const hVal = headerStr.slice(colonIdx + 1).trim();
            if (hKey) headers[hKey] = hVal;
          } else {
            errors.push(`Invalid header format: "${headerStr}"`);
          }
        }
        continue;
      }
      if (token.startsWith("-H") && token.length > 2) {
        const headerStr = token.slice(2);
        const colonIdx = headerStr.indexOf(":");
        if (colonIdx !== -1) {
          const hKey = headerStr.slice(0, colonIdx).trim();
          const hVal = headerStr.slice(colonIdx + 1).trim();
          if (hKey) headers[hKey] = hVal;
        }
        continue;
      }
      if (token.startsWith("--header=")) {
        const headerStr = token.slice(9);
        const colonIdx = headerStr.indexOf(":");
        if (colonIdx !== -1) {
          const hKey = headerStr.slice(0, colonIdx).trim();
          const hVal = headerStr.slice(colonIdx + 1).trim();
          if (hKey) headers[hKey] = hVal;
        }
        continue;
      }

      // Basic Auth: -u, --user
      if (token === "-u" || token === "--user") {
        if (i + 1 < tokens.length) {
          const creds = tokens[++i];
          try {
            const encoded =
              typeof btoa === "function"
                ? btoa(creds)
                : Buffer.from(creds).toString("base64");
            headers["Authorization"] = `Basic ${encoded}`;
          } catch {
            errors.push(`Failed to encode auth credentials: "${creds}"`);
          }
        }
        continue;
      }
      if (token.startsWith("-u") && token.length > 2) {
        const creds = token.slice(2);
        try {
          const encoded =
            typeof btoa === "function"
              ? btoa(creds)
              : Buffer.from(creds).toString("base64");
          headers["Authorization"] = `Basic ${encoded}`;
        } catch {}
        continue;
      }
      if (token.startsWith("--user=")) {
        const creds = token.slice(7);
        try {
          const encoded =
            typeof btoa === "function"
              ? btoa(creds)
              : Buffer.from(creds).toString("base64");
          headers["Authorization"] = `Basic ${encoded}`;
        } catch {}
        continue;
      }

      // Body data flags: -d, --data, --data-raw, --data-binary, --data-ascii, --data-urlencode
      if (
        token === "-d" ||
        token === "--data" ||
        token === "--data-raw" ||
        token === "--data-binary" ||
        token === "--data-ascii" ||
        token === "--data-urlencode"
      ) {
        if (i + 1 < tokens.length) {
          dataParts.push(tokens[++i]);
        }
        continue;
      }
      if (token.startsWith("-d") && token.length > 2) {
        dataParts.push(token.slice(2));
        continue;
      }
      if (token.startsWith("--data=")) {
        dataParts.push(token.slice(7));
        continue;
      }
      if (token.startsWith("--data-raw=")) {
        dataParts.push(token.slice(11));
        continue;
      }
      if (token.startsWith("--data-binary=")) {
        dataParts.push(token.slice(14));
        continue;
      }

      // URL flag: --url
      if (token === "--url") {
        if (i + 1 < tokens.length) {
          url = tokens[++i];
        }
        continue;
      }
      if (token.startsWith("--url=")) {
        url = token.slice(6);
        continue;
      }

      // Flags taking an argument we can safely skip or map
      if (
        [
          "-A",
          "--user-agent",
          "-m",
          "--max-time",
          "--connect-timeout",
          "-o",
          "--output",
          "-e",
          "--referer",
        ].includes(token)
      ) {
        if (token === "-A" || token === "--user-agent") {
          if (i + 1 < tokens.length) headers["User-Agent"] = tokens[++i];
        } else if (token === "-e" || token === "--referer") {
          if (i + 1 < tokens.length) headers["Referer"] = tokens[++i];
        } else {
          i++; // skip parameter
        }
        continue;
      }

      // Flags without argument
      if (token.startsWith("-")) {
        continue;
      }

      // Unflagged argument -> Target URL
      if (!url) {
        url = token;
      }
    }

    const body = dataParts.join("&");
    if (!method) {
      method = body.length > 0 ? "POST" : "GET";
    }

    // Default Content-Type to JSON if body looks like JSON and header missing
    if (
      body &&
      (body.trim().startsWith("{") || body.trim().startsWith("[")) &&
      !Object.keys(headers).some(h => h.toLowerCase() === "content-type")
    ) {
      headers["Content-Type"] = "application/json";
    }

    const headersText = Object.entries(headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    return {
      method,
      url,
      headers,
      headersText,
      body,
      errors,
    };
  }

  /* ─── Code Snippet Generators ────────────────────────────────────── */

  /**
   * Generate copyable cURL command line snippet.
   */
  function generateCurlSnippet({
    method = "GET",
    url = "",
    headers = {},
    body = "",
  } = {}) {
    const parts = ["curl"];
    const m = (method || "GET").toUpperCase();
    if (m !== "GET") {
      parts.push(`-X ${m}`);
    }

    parts.push(`"${url || "https://api.example.com"}"`);

    const headerMap =
      typeof headers === "string"
        ? parseHeadersText(headers).headers
        : headers || {};

    Object.entries(headerMap).forEach(([k, v]) => {
      parts.push(`-H "${k}: ${String(v).replace(/"/g, '\\"')}"`);
    });

    if (body && !["GET", "HEAD"].includes(m)) {
      const escapedBody = String(body).replace(/'/g, "'\\''");
      parts.push(`-d '${escapedBody}'`);
    }

    return parts.join(" \\\n  ");
  }

  /**
   * Generate copyable JavaScript fetch snippet.
   */
  function generateFetchSnippet({
    method = "GET",
    url = "",
    headers = {},
    body = "",
  } = {}) {
    const m = (method || "GET").toUpperCase();
    const headerMap =
      typeof headers === "string"
        ? parseHeadersText(headers).headers
        : headers || {};

    const options = { method: m };
    if (Object.keys(headerMap).length > 0) {
      options.headers = headerMap;
    }

    let isJson = false;
    if (body && !["GET", "HEAD"].includes(m)) {
      try {
        options.body = JSON.parse(body);
        isJson = true;
      } catch {
        options.body = body;
      }
    }

    let optionsStr = "";
    if (
      m !== "GET" ||
      Object.keys(headerMap).length > 0 ||
      (body && !["GET", "HEAD"].includes(m))
    ) {
      let rawJson = JSON.stringify(options, null, 2).replace(
        /"([^"]+)":/g,
        "$1:"
      );
      if (isJson) {
        const bodyStr = JSON.stringify(options.body, null, 4);
        rawJson = rawJson.replace(
          /body:\s*\{[\s\S]*\}/,
          `body: JSON.stringify(${bodyStr.trim()})`
        );
      }
      optionsStr = ", " + rawJson;
    }

    return `fetch("${url || "https://api.example.com"}"${optionsStr})
  .then(response => {
    if (!response.ok) throw new Error(\`HTTP error! status: \${response.status}\`);
    return response.json();
  })
  .then(data => console.log(data))
  .catch(error => console.error("Request failed:", error));`;
  }

  /**
   * Generate copyable Python requests snippet.
   */
  function generatePythonSnippet({
    method = "GET",
    url = "",
    headers = {},
    body = "",
  } = {}) {
    const m = (method || "GET").toLowerCase();
    const headerMap =
      typeof headers === "string"
        ? parseHeadersText(headers).headers
        : headers || {};

    let pyHeaders = "None";
    if (Object.keys(headerMap).length > 0) {
      pyHeaders =
        "{\n" +
        Object.entries(headerMap)
          .map(([k, v]) => `    "${k}": "${String(v).replace(/"/g, '\\"')}",`)
          .join("\n") +
        "\n}";
    }

    let bodyArg = "";
    if (body && !["get", "head"].includes(m)) {
      try {
        JSON.parse(body);
        bodyArg = `, json=${body.trim()}`;
      } catch {
        bodyArg = `, data=${JSON.stringify(body)}`;
      }
    }

    const headersArg = pyHeaders !== "None" ? `, headers=${pyHeaders}` : "";

    return `import requests

url = "${url || "https://api.example.com"}"
response = requests.${m}(url${headersArg}${bodyArg})

print(f"Status: {response.status_code}")
print(response.text)`;
  }

  /* ─── Network Timing Breakdown ───────────────────────────────────── */

  /**
   * Compute detailed request timing breakdowns (DNS, TCP, TTFB, Download).
   * Takes performance measurement elapsed time and optional PerformanceResourceTiming entry.
   */
  function computeTimingBreakdown(totalElapsed, resourceEntry = null) {
    const total = Math.max(0, Number(totalElapsed) || 0);

    if (
      resourceEntry &&
      typeof resourceEntry === "object" &&
      resourceEntry.responseEnd > 0
    ) {
      const dns = Math.max(
        0,
        resourceEntry.domainLookupEnd - resourceEntry.domainLookupStart
      );
      const tcp = Math.max(
        0,
        resourceEntry.connectEnd - resourceEntry.connectStart
      );
      const tls =
        resourceEntry.secureConnectionStart > 0
          ? Math.max(
              0,
              resourceEntry.connectEnd - resourceEntry.secureConnectionStart
            )
          : 0;
      const ttfb = Math.max(
        0,
        resourceEntry.responseStart - resourceEntry.requestStart
      );
      const download = Math.max(
        0,
        resourceEntry.responseEnd - resourceEntry.responseStart
      );

      return {
        total: Math.round(total),
        dns: Math.round(dns),
        tcp: Math.round(tcp),
        tls: Math.round(tls),
        ttfb: Math.round(ttfb),
        download: Math.round(download),
        isResourceTiming: dns > 0 || tcp > 0 || ttfb > 0,
        formatted: {
          total: formatDuration(total),
          dns: formatDuration(dns),
          tcp: formatDuration(tcp),
          tls: formatDuration(tls),
          ttfb: formatDuration(ttfb),
          download: formatDuration(download),
        },
      };
    }

    // Graceful fallback for cross-origin or masked Resource Timing
    const estimatedTtfb = Math.round(total * 0.7);
    const estimatedDownload = Math.max(0, Math.round(total - estimatedTtfb));

    return {
      total: Math.round(total),
      dns: 0,
      tcp: 0,
      tls: 0,
      ttfb: estimatedTtfb,
      download: estimatedDownload,
      isResourceTiming: false,
      formatted: {
        total: formatDuration(total),
        dns: "—",
        tcp: "—",
        tls: "—",
        ttfb: formatDuration(estimatedTtfb),
        download: formatDuration(estimatedDownload),
      },
    };
  }

  return {
    parseHeadersText,
    formatResponseHeaders,
    formatBytes,
    formatDuration,
    formatResponseBody,
    statusTone,
    buildRequestOptions,
    fetchWithTimeout,
    parseCurlCommand,
    generateCurlSnippet,
    generateFetchSnippet,
    generatePythonSnippet,
    computeTimingBreakdown,
  };
});
