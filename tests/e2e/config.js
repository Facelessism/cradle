/**
 * Shared constants and helpers for the Cradle e2e test suite.
 * Issue #265.
 */

const BASE_URL = "http://localhost:4173";

/** Both themes must be snapshotted for every page. */
const THEMES = /** @type {const} */ (["dark", "light"]);

/** Both desktop + mobile widths for landing-page snapshots. */
const VIEWPORTS = /** @type {const} */ ([
  { name: "desktop", width: 1280, height: 720 },
  { name: "mobile", width: 375, height: 667 },
]);

/**
 * Read the project list from data/projects.json. Falls back to a fetch
 * at runtime if the file isn't on disk (it always is in CI after
 * `npm run build`).
 *
 * @returns {Promise<Array<{ title: string; category: string; path: string }>>}
 */
async function loadProjects() {
  // Try the local copy first. In CI, `npm run build` regenerates this.
  try {
    const fs = require("fs");
    const path = require("path");
    const file = path.join(__dirname, "..", "..", "data", "projects.json");
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw);
  } catch {
    // Fall back to runtime fetch — used when tests run against a server
    // whose disk we can't see (rare; mainly for local dev against `live-server`).
    const res = await fetch(`${BASE_URL}/data/projects.json`);
    if (!res.ok) {
      throw new Error(`Failed to load projects.json: ${res.status}`);
    }
    return res.json();
  }
}

/**
 * Apply a theme to the page by setting localStorage and reloading.
 * We use localStorage directly (not clicking the toggle) because the
 * toggle button has a 350ms spin animation that introduces flakiness.
 *
 * Also sets `document.documentElement.dataset.theme` so snapshots have
 * a deterministic marker for which theme they were taken in.
 *
 * @param {import("@playwright/test").Page} page
 * @param {"dark"|"light"} theme
 */
async function setTheme(page, theme) {
  await page.addInitScript(([t]) => {
    try {
      window.localStorage.setItem("theme", t);
    } catch {
      /* sandboxed localStorage */
    }
    // The ThemeToggle component checks for `light-theme` class on <html>.
    // We mirror it here so the initial paint matches.
    if (t === "light") {
      document.documentElement.classList.add("light-theme");
    } else {
      document.documentElement.classList.remove("light-theme");
    }
    // Expose for screenshot naming / axe reports.
    document.documentElement.dataset.theme = t;
  }, [theme]);

  await page.reload({ waitUntil: "networkidle" });

  // Wait for the main grid to mount so the snapshot is consistent.
  await page.waitForSelector('[data-testid="project-grid"]', {
    state: "visible",
    timeout: 10_000,
  });
}

/**
 * Collect every console message of severity warn+ during a callback.
 * Returns the list; useful for the console.spec.js audit.
 *
 * @param {import("@playwright/test").Page} page
 * @param {() => Promise<void>} fn
 * @returns {Promise<Array<{ type: string; text: string }>>}
 */
async function captureConsole(page, fn) {
  const messages = [];
  const handler = (msg) => {
    const type = msg.type();
    if (type === "warning" || type === "error") {
      messages.push({ type, text: msg.text() });
    }
  };
  page.on("console", handler);
  try {
    await fn();
  } finally {
    page.off("console", handler);
  }
  return messages;
}

/**
 * Wait for the page to be fully ready for a screenshot:
 *  - All fonts loaded (Google Fonts can cause 1px layout shifts)
 *  - All <img> loaded (thumbnails)
 *  - No pending network requests
 *
 * @param {import("@playwright/test").Page} page
 */
async function waitForVisualStable(page) {
  await page.waitForLoadState("networkidle");
  // Wait for document.fonts.ready — critical for consistent text rendering.
  await page.evaluate(() => document.fonts.ready);
  // Wait for all images to settle.
  await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"));
    return Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((res) => {
              img.addEventListener("load", res, { once: true });
              img.addEventListener("error", res, { once: true });
            }),
      ),
    );
  });
}

module.exports = {
  BASE_URL,
  THEMES,
  VIEWPORTS,
  loadProjects,
  setTheme,
  captureConsole,
  waitForVisualStable,
};
