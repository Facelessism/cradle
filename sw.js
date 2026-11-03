/**
 * Cradle — Service Worker
 * ──────────────────────────────────────────────────────────
 * Provides offline capabilities and installability for Cradle.
 *
 * Features:
 *  - Caches the landing page shell and core shared assets
 *  - Dynamically caches minis that the user has already opened
 *  - Never caches camera, microphone streams, or private user data
 *  - Versioned cache with clean eviction of old deploys
 *  - Supports skipWaiting to enable instant refresh upon new deploy
 */

const CACHE_VERSION = "cradle-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.webmanifest",
  "./manifest.json",
  "./assets/favicon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-192-maskable.png",
  "./assets/icon-512-maskable.png",
  "./src/components/ui/tokens.css",
  "./src/components/ui/storage.js",
  "./src/components/ui/sanitizeHtml.js",
  "./src/components/ui/Button/Button.js",
  "./src/components/ui/Card/Card.js",
  "./src/components/ui/ThemeToggle/ThemeToggle.js",
  "./src/components/ui/utils/categoryFilter.js",
  "./src/utils/projectSearch.js",
  "./src/utils/assetUrl.js",
  "./src/utils/cradleDb.js",
  "./src/utils/filterWorker.js",
  "./src/utils/projectSanitizer.js",
  "./src/utils/messageValidation.js",
  "./src/utils/workerLogger.js",
  "./src/utils/urlValidator.js",
  "./src/utils/serviceWorkerRegistration.js",
  "./scripts/worker.js",
  "./data/projects.json",
];

// Patterns that identify camera, microphone, or media streams
const STREAM_PATTERNS =
  /(camera|microphone|mic-stream|webcam|audio-stream|mediastream|stream-feed|live-stream|webrtc|socket\.io)/i;

// Patterns that identify private user data, sessions, or telemetry
const USER_DATA_PATTERNS =
  /(user-data|userdata|\/api\/user|\/auth|\/login|\/logout|\/session|\/token|\/profile|\/account|\/credentials|\/private|\/secret|\/telemetry|\/analytics|\/upload)/i;

function hasHeader(headers, name) {
  if (!headers) return false;
  if (typeof headers.has === "function") {
    return headers.has(name) || headers.has(name.toLowerCase());
  }
  return Boolean(headers[name] || headers[name.toLowerCase()]);
}

function getHeader(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") {
    return headers.get(name) || headers.get(name.toLowerCase()) || "";
  }
  return headers[name] || headers[name.toLowerCase()] || "";
}

/**
 * Determines whether a request is safe and eligible to be cached.
 * Enforces strict restrictions against caching camera/mic streams and user data.
 *
 * @param {Request} request
 * @returns {boolean}
 */
function isCacheableRequest(request) {
  if (!request || request.method !== "GET") {
    return false;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }

  // Only http and https requests can be cached
  if (!url.protocol.startsWith("http")) {
    return false;
  }

  // Never cache camera or microphone streams
  if (
    STREAM_PATTERNS.test(url.pathname) ||
    STREAM_PATTERNS.test(url.search) ||
    STREAM_PATTERNS.test(url.hash)
  ) {
    return false;
  }

  // Never cache range requests (e.g. video/audio streaming segments)
  if (hasHeader(request.headers, "range")) {
    return false;
  }

  // Never cache user data, credentials, or sessions
  if (
    USER_DATA_PATTERNS.test(url.pathname) ||
    USER_DATA_PATTERNS.test(url.search) ||
    USER_DATA_PATTERNS.test(url.hash)
  ) {
    return false;
  }

  // Never cache sensitive query parameters
  if (
    url.searchParams.has("token") ||
    url.searchParams.has("auth") ||
    url.searchParams.has("session") ||
    url.searchParams.has("key") ||
    url.searchParams.has("password")
  ) {
    return false;
  }

  // Never cache authorized or credentialed requests
  if (
    hasHeader(request.headers, "authorization") ||
    hasHeader(request.headers, "proxy-authorization")
  ) {
    return false;
  }

  return true;
}

/**
 * Determines whether a network response is valid and safe to cache.
 *
 * @param {Response} response
 * @returns {boolean}
 */
function isCacheableResponse(response) {
  if (!response) return false;

  // Never cache responses with no-store or private cache-control directives
  const cacheControl = getHeader(response.headers, "cache-control");
  if (cacheControl.includes("no-store") || cacheControl.includes("private")) {
    return false;
  }

  // Never cache live streaming responses
  const contentType = getHeader(response.headers, "content-type");
  if (
    contentType.includes("multipart/x-mixed-replace") ||
    contentType.includes("text/event-stream")
  ) {
    return false;
  }

  // Accept standard 200 OK responses or opaque cross-origin assets (e.g. CDN fonts/scripts)
  if (response.status === 200 || response.type === "opaque") {
    return true;
  }

  return false;
}

/**
 * Computes equivalent URL variations (with/without trailing slash, with/without index.html)
 * to ensure previously cached minis load cleanly regardless of how the user accesses them offline.
 *
 * @param {string} urlString
 * @returns {string[]}
 */
function getUrlVariants(urlString) {
  try {
    const url = new URL(urlString);
    const variants = [];
    if (url.pathname.endsWith("/")) {
      variants.push(new URL(url.pathname + "index.html", url.origin).href);
      if (url.pathname.length > 1) {
        variants.push(new URL(url.pathname.slice(0, -1), url.origin).href);
      }
    } else if (url.pathname.endsWith("/index.html")) {
      variants.push(new URL(url.pathname.slice(0, -10), url.origin).href);
      if (url.pathname.slice(0, -11).length > 0) {
        variants.push(new URL(url.pathname.slice(0, -11), url.origin).href);
      }
    } else {
      variants.push(new URL(url.pathname + "/", url.origin).href);
      variants.push(new URL(url.pathname + "/index.html", url.origin).href);
    }
    return variants;
  } catch {
    return [];
  }
}

/* ── Service Worker Lifecycle ──────────────────────────── */

const swScope = typeof self !== "undefined" ? self : globalThis;

if (typeof swScope.addEventListener === "function") {
  swScope.addEventListener("install", event => {
    event.waitUntil(
      caches.open(SHELL_CACHE).then(async cache => {
        // Cache assets individually so that an unavailable optional asset does not abort install
        await Promise.all(
          SHELL_ASSETS.map(assetUrl =>
            cache.add(assetUrl).catch(err => {
              // Log warning but continue precaching remaining assets
              console.warn(
                "[SW] Precache skipped for:",
                assetUrl,
                err?.message || err
              );
            })
          )
        );
      })
    );
  });

  swScope.addEventListener("activate", event => {
    event.waitUntil(
      caches
        .keys()
        .then(cacheNames =>
          Promise.all(
            cacheNames.map(name => {
              // Evict old cache versions belonging to Cradle
              if (
                name.startsWith("cradle-") &&
                name !== SHELL_CACHE &&
                name !== RUNTIME_CACHE
              ) {
                return caches.delete(name);
              }
            })
          )
        )
        .then(() => swScope.clients?.claim?.())
    );
  });

  swScope.addEventListener("message", event => {
    if (event.data && event.data.type === "SKIP_WAITING") {
      swScope.skipWaiting?.();
    }
  });

  swScope.addEventListener("fetch", event => {
    const request = event.request;

    if (!isCacheableRequest(request)) {
      return;
    }

    event.respondWith(
      (async () => {
        // 1. Try network first to keep content fresh when online
        try {
          const networkResponse = await fetch(request);

          // Dynamically cache opened minis, shared assets, and navigation pages
          if (isCacheableResponse(networkResponse)) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, networkResponse.clone());
          }

          return networkResponse;
        } catch (networkError) {
          // 2. Network unavailable (offline) -> Serve from cache
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // Handle directory vs index.html URL variants
          const variants = getUrlVariants(request.url);
          for (const variant of variants) {
            const match = await caches.match(variant);
            if (match) return match;
          }

          // If navigation request fails completely, fallback to cached landing page shell
          if (request.mode === "navigate") {
            const shellMatch =
              (await caches.match("./index.html")) ||
              (await caches.match("./")) ||
              (await caches.match("/index.html")) ||
              (await caches.match("/"));
            if (shellMatch) {
              return shellMatch;
            }
          }

          throw networkError;
        }
      })()
    );
  });
}

// Export helper functions for automated testing in Node/test environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CACHE_VERSION,
    SHELL_CACHE,
    RUNTIME_CACHE,
    SHELL_ASSETS,
    isCacheableRequest,
    isCacheableResponse,
    getUrlVariants,
  };
}
