/* =========================================================
   API RESPONSE INSPECTOR — ENGINE MODULE
   Pure helpers: header parsing/formatting, byte-size display,
   JSON pretty-printing, and request option building.
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

    /** Human-readable byte size ("1.2 KB", "512 B"). */
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

        const bodyAllowed = !["GET", "HEAD"].includes((method || "GET").toUpperCase());
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

    return {
        parseHeadersText,
        formatResponseHeaders,
        formatBytes,
        formatDuration,
        formatResponseBody,
        statusTone,
        buildRequestOptions,
        fetchWithTimeout,
    };
});