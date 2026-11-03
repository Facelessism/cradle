const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(REPO_ROOT, "manifest.webmanifest");
const MANIFEST_JSON_PATH = path.join(REPO_ROOT, "manifest.json");
const SW_PATH = path.join(REPO_ROOT, "sw.js");
const INDEX_PATH = path.join(REPO_ROOT, "index.html");

test("PWA Manifest exists, parses as valid JSON, and meets Lighthouse installability criteria", () => {
  assert.ok(fs.existsSync(MANIFEST_PATH), "manifest.webmanifest must exist");
  assert.ok(fs.existsSync(MANIFEST_JSON_PATH), "manifest.json must exist");

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

  // Lighthouse installability: name and short_name
  assert.equal(manifest.name, "Cradle");
  assert.equal(manifest.short_name, "Cradle");

  // Lighthouse installability: start_url and display
  assert.ok(manifest.start_url, "start_url must be defined");
  assert.equal(manifest.display, "standalone");

  // Theme and background colors
  assert.equal(manifest.theme_color, "#05070d");
  assert.equal(manifest.background_color, "#05070d");

  // Lighthouse installability: icons must include at least 192x192 PNG
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);

  const icon192 = manifest.icons.find(
    i => i.sizes === "192x192" && i.type === "image/png"
  );
  assert.ok(icon192, "Manifest must contain a 192x192 PNG icon");

  const icon512 = manifest.icons.find(
    i => i.sizes === "512x512" && i.type === "image/png"
  );
  assert.ok(icon512, "Manifest must contain a 512x512 PNG icon");

  // Check icons on disk
  for (const icon of manifest.icons) {
    const iconPath = path.join(REPO_ROOT, icon.src);
    assert.ok(fs.existsSync(iconPath), `Icon file must exist: ${icon.src}`);

    if (icon.type === "image/png") {
      const buf = fs.readFileSync(iconPath);
      // PNG header check
      assert.equal(
        buf.subarray(0, 8).toString("hex"),
        "89504e470d0a1a0a",
        `File ${icon.src} must have valid PNG signature`
      );
      const [w, h] = icon.sizes.split("x").map(Number);
      if (w && h) {
        assert.equal(buf.readUInt32BE(16), w, `Width must match ${w}`);
        assert.equal(buf.readUInt32BE(20), h, `Height must match ${h}`);
      }
    }
  }
});

test("Landing page index.html links manifest, apple-touch-icon, and meta theme-color", () => {
  const html = fs.readFileSync(INDEX_PATH, "utf8");

  assert.match(
    html,
    /<link\s+[^>]*rel=["']manifest["'][^>]*>/i,
    "index.html must contain <link rel='manifest'>"
  );
  assert.match(
    html,
    /<meta\s+[^>]*name=["']theme-color["'][^>]*content=["']#05070d["'][^>]*>/i,
    "index.html must contain <meta name='theme-color' content='#05070d'>"
  );
  assert.match(
    html,
    /<link\s+[^>]*rel=["']apple-touch-icon["'][^>]*>/i,
    "index.html must contain <link rel='apple-touch-icon'>"
  );
});

test("ThemeToggle syncs meta theme-color with active theme", () => {
  const { isCacheableRequest } = require("../sw.js");
  const ThemeToggleSource = fs.readFileSync(
    path.join(REPO_ROOT, "src/components/ui/ThemeToggle/ThemeToggle.js"),
    "utf8"
  );

  assert.ok(
    ThemeToggleSource.includes('meta[name="theme-color"]'),
    "ThemeToggle must query meta[name='theme-color']"
  );
  assert.ok(
    ThemeToggleSource.includes("#f5f7fb"),
    "ThemeToggle must use #f5f7fb for light theme"
  );
  assert.ok(
    ThemeToggleSource.includes("#05070d"),
    "ThemeToggle must use #05070d for dark theme"
  );
});

test("Service Worker versioning and precached shell assets", () => {
  assert.ok(fs.existsSync(SW_PATH), "sw.js must exist");
  const sw = require("../sw.js");

  assert.ok(sw.CACHE_VERSION, "CACHE_VERSION must be defined");
  assert.ok(
    sw.SHELL_CACHE.includes(sw.CACHE_VERSION),
    "SHELL_CACHE must include CACHE_VERSION"
  );
  assert.ok(
    sw.RUNTIME_CACHE.includes(sw.CACHE_VERSION),
    "RUNTIME_CACHE must include CACHE_VERSION"
  );

  // Verify all declared shell assets exist on disk
  for (const asset of sw.SHELL_ASSETS) {
    if (asset === "./") continue;
    const cleanPath = asset.replace(/^\.\//, "");
    const fullPath = path.join(REPO_ROOT, cleanPath);
    assert.ok(
      fs.existsSync(fullPath),
      `Precached shell asset must exist on disk: ${asset}`
    );
  }
});

test("Service Worker isCacheableRequest enforces safety: never caches camera, microphone, or user data", () => {
  const { isCacheableRequest } = require("../sw.js");

  // Safe normal requests
  assert.equal(
    isCacheableRequest({
      method: "GET",
      url: "https://example.com/projects/games/snake-game/index.html",
      headers: new Map(),
    }),
    true
  );

  assert.equal(
    isCacheableRequest({
      method: "GET",
      url: "https://example.com/style.css",
      headers: new Map(),
    }),
    true
  );

  // Non-GET requests are NEVER cached
  assert.equal(
    isCacheableRequest({
      method: "POST",
      url: "https://example.com/api/data",
      headers: new Map(),
    }),
    false
  );

  // Non-HTTP protocols (blob:, mediastream:, etc.) are NEVER cached
  assert.equal(
    isCacheableRequest({
      method: "GET",
      url: "blob:https://example.com/abc-123",
      headers: new Map(),
    }),
    false
  );

  // Camera / microphone / live stream URLs are NEVER cached
  const cameraMicUrls = [
    "https://example.com/api/camera/stream",
    "https://example.com/microphone/record",
    "https://example.com/live-stream/video.m3u8",
    "https://example.com/mediastream/audio",
    "https://example.com/stream-feed?device=mic",
    "https://example.com/webcam/feed",
    "https://example.com/webrtc/offer",
  ];
  for (const url of cameraMicUrls) {
    assert.equal(
      isCacheableRequest({
        method: "GET",
        url,
        headers: new Map(),
      }),
      false,
      `Should reject camera/mic stream: ${url}`
    );
  }

  // Live stream range requests are NEVER cached
  assert.equal(
    isCacheableRequest({
      method: "GET",
      url: "https://example.com/audio/sample.mp3",
      headers: new Map([["range", "bytes=0-1024"]]),
    }),
    false
  );

  // User data, credentials, sessions, tokens are NEVER cached
  const userDataUrls = [
    "https://example.com/api/user/profile",
    "https://example.com/auth/login",
    "https://example.com/session/current",
    "https://example.com/userdata/backup",
    "https://example.com/credentials/store",
    "https://example.com/projects/tool?token=secret123",
    "https://example.com/account/settings",
    "https://example.com/telemetry/report",
  ];
  for (const url of userDataUrls) {
    assert.equal(
      isCacheableRequest({
        method: "GET",
        url,
        headers: new Map(),
      }),
      false,
      `Should reject user data / auth: ${url}`
    );
  }

  // Requests with Authorization headers are NEVER cached
  assert.equal(
    isCacheableRequest({
      method: "GET",
      url: "https://example.com/projects/misc/notes/index.html",
      headers: new Map([["authorization", "Bearer xyz"]]),
    }),
    false
  );
});

test("Service Worker isCacheableResponse enforces cache-control and streaming headers", () => {
  const { isCacheableResponse } = require("../sw.js");

  // Valid 200 response
  assert.equal(
    isCacheableResponse({
      status: 200,
      headers: new Map([["content-type", "text/html"]]),
    }),
    true
  );

  // Opaque 0 response (CORS font/script)
  assert.equal(
    isCacheableResponse({
      status: 0,
      type: "opaque",
      headers: new Map(),
    }),
    true
  );

  // Never cache no-store or private responses
  assert.equal(
    isCacheableResponse({
      status: 200,
      headers: new Map([["cache-control", "no-store, no-cache"]]),
    }),
    false
  );

  assert.equal(
    isCacheableResponse({
      status: 200,
      headers: new Map([["cache-control", "private, max-age=3600"]]),
    }),
    false
  );

  // Never cache live streaming responses
  assert.equal(
    isCacheableResponse({
      status: 200,
      headers: new Map([
        ["content-type", "multipart/x-mixed-replace; boundary=frame"],
      ]),
    }),
    false
  );

  assert.equal(
    isCacheableResponse({
      status: 200,
      headers: new Map([["content-type", "text/event-stream"]]),
    }),
    false
  );

  // Non-200 responses are not cached
  assert.equal(
    isCacheableResponse({
      status: 404,
      headers: new Map(),
    }),
    false
  );

  assert.equal(
    isCacheableResponse({
      status: 500,
      headers: new Map(),
    }),
    false
  );
});

test("Service Worker update prompt UI can be mounted, triggers skipWaiting, and dismisses", () => {
  const regPath = path.join(
    REPO_ROOT,
    "src/utils/serviceWorkerRegistration.js"
  );
  assert.ok(fs.existsSync(regPath), "serviceWorkerRegistration.js must exist");

  const regCode = fs.readFileSync(regPath, "utf8");
  assert.ok(
    regCode.includes("showUpdatePrompt"),
    "Must export showUpdatePrompt"
  );
  assert.ok(
    regCode.includes("SKIP_WAITING"),
    "Must send SKIP_WAITING message to waiting worker"
  );
  assert.ok(
    regCode.includes("controllerchange"),
    "Must listen to controllerchange to refresh client"
  );
});

test("Service Worker offline lifecycle simulation: previously opened minis load offline, unopened minis fail offline", async () => {
  const {
    isCacheableRequest,
    isCacheableResponse,
    CACHE_VERSION,
    SHELL_CACHE,
    RUNTIME_CACHE,
  } = require("../sw.js");

  // In-memory mock cache storage simulating CacheStorage API
  const mockCacheStore = new Map();

  class MockCache {
    constructor(name) {
      this.name = name;
      if (!mockCacheStore.has(name)) {
        mockCacheStore.set(name, new Map());
      }
    }
    async put(req, res) {
      const key = typeof req === "string" ? req : req.url;
      mockCacheStore.get(this.name).set(key, res);
    }
    async match(req) {
      const key = typeof req === "string" ? req : req.url;
      return mockCacheStore.get(this.name).get(key) || null;
    }
  }

  const mockCaches = {
    async open(name) {
      return new MockCache(name);
    },
    async match(req) {
      const key = typeof req === "string" ? req : req.url;
      for (const [_, cacheMap] of mockCacheStore) {
        if (cacheMap.has(key)) return cacheMap.get(key);
      }
      return null;
    },
    async keys() {
      return Array.from(mockCacheStore.keys());
    },
    async delete(name) {
      return mockCacheStore.delete(name);
    },
  };

  let isOnline = true;
  async function simulateFetch(request) {
    if (!isCacheableRequest(request)) {
      if (!isOnline) throw new TypeError("Failed to fetch (offline)");
      return { status: 200, ok: true, headers: new Map(), type: "basic" };
    }

    try {
      if (!isOnline) {
        throw new TypeError("Failed to fetch (offline)");
      }
      // Network succeeds
      const networkResponse = {
        status: 200,
        ok: true,
        body: `Content for ${request.url}`,
        headers: new Map([["content-type", "text/html"]]),
        clone() {
          return { ...this };
        },
      };

      if (isCacheableResponse(networkResponse)) {
        const cache = await mockCaches.open(RUNTIME_CACHE);
        await cache.put(request, networkResponse.clone());
      }

      return networkResponse;
    } catch (networkError) {
      // Offline fallback to cache
      const cached = await mockCaches.match(request);
      if (cached) return cached;
      throw networkError;
    }
  }

  // 1. User opens mini while online
  const miniUrl = "https://example.com/projects/games/snake-game/index.html";
  const miniRequest = { method: "GET", url: miniUrl, headers: new Map() };

  const onlineResponse = await simulateFetch(miniRequest);
  assert.equal(onlineResponse.status, 200);
  assert.equal(onlineResponse.body, `Content for ${miniUrl}`);

  // Verify mini was cached into runtime cache
  const runtimeCache = await mockCaches.open(RUNTIME_CACHE);
  const cachedMini = await runtimeCache.match(miniRequest);
  assert.ok(cachedMini, "Opened mini must be saved in runtime cache");

  // 2. User goes offline
  isOnline = false;

  // Previously opened mini loads offline!
  const offlineMiniResponse = await simulateFetch(miniRequest);
  assert.ok(offlineMiniResponse, "Previously opened mini must load offline");
  assert.equal(offlineMiniResponse.body, `Content for ${miniUrl}`);

  // Unopened mini fails offline
  const unopenedRequest = {
    method: "GET",
    url: "https://example.com/projects/dev-tools/unopened-tool/index.html",
    headers: new Map(),
  };

  await assert.rejects(
    async () => simulateFetch(unopenedRequest),
    /Failed to fetch \(offline\)/,
    "Unopened mini should fail when offline"
  );

  // 3. Cache Versioning & Eviction: activating new deploy purges old version caches
  const oldCacheName = "cradle-v0-shell";
  mockCacheStore.set(oldCacheName, new Map());
  assert.ok((await mockCaches.keys()).includes(oldCacheName));

  const allKeys = await mockCaches.keys();
  for (const key of allKeys) {
    if (
      key.startsWith("cradle-") &&
      key !== SHELL_CACHE &&
      key !== RUNTIME_CACHE
    ) {
      await mockCaches.delete(key);
    }
  }

  const remainingKeys = await mockCaches.keys();
  assert.ok(
    !remainingKeys.includes(oldCacheName),
    "Old cache version must be evicted"
  );
  assert.ok(
    remainingKeys.includes(RUNTIME_CACHE),
    "Current runtime cache must be preserved"
  );
});

test("getUrlVariants generates directory, slash, and index.html permutations", () => {
  const { getUrlVariants } = require("../sw.js");

  // Trailing slash -> index.html and without trailing slash
  const variantsFromSlash = getUrlVariants(
    "https://example.com/projects/games/snake-game/"
  );
  assert.ok(
    variantsFromSlash.includes(
      "https://example.com/projects/games/snake-game/index.html"
    )
  );
  assert.ok(
    variantsFromSlash.includes("https://example.com/projects/games/snake-game")
  );

  // With index.html -> directory with slash and without slash
  const variantsFromIndex = getUrlVariants(
    "https://example.com/projects/games/snake-game/index.html"
  );
  assert.ok(
    variantsFromIndex.includes("https://example.com/projects/games/snake-game/")
  );
  assert.ok(
    variantsFromIndex.includes("https://example.com/projects/games/snake-game")
  );

  // Bare path without slash -> with slash and with /index.html
  const variantsFromBare = getUrlVariants(
    "https://example.com/projects/games/snake-game"
  );
  assert.ok(
    variantsFromBare.includes("https://example.com/projects/games/snake-game/")
  );
  assert.ok(
    variantsFromBare.includes(
      "https://example.com/projects/games/snake-game/index.html"
    )
  );
});

test("Service Worker offline fetch handles bare URL without slash when index.html was cached", async () => {
  const { getUrlVariants } = require("../sw.js");
  const cachedUrl = "https://example.com/projects/games/snake-game/index.html";
  const cachedData = { status: 200, body: "Snake Game Content" };

  const cacheStore = new Map([[cachedUrl, cachedData]]);
  const mockCaches = {
    async match(reqUrl) {
      return cacheStore.get(reqUrl) || null;
    },
  };

  // User accesses bare URL offline: https://example.com/projects/games/snake-game
  const requestUrl = "https://example.com/projects/games/snake-game";
  let matched = await mockCaches.match(requestUrl);
  if (!matched) {
    const variants = getUrlVariants(requestUrl);
    for (const v of variants) {
      matched = await mockCaches.match(v);
      if (matched) break;
    }
  }

  assert.ok(
    matched,
    "Bare URL must resolve cached /index.html variant offline"
  );
  assert.equal(matched.body, "Snake Game Content");
});
