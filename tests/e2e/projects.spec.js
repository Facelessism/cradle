// @ts-check
const { test, expect } = require("@playwright/test");
const {
  BASE_URL,
  THEMES,
  loadProjects,
  setTheme,
  waitForVisualStable,
} = require("./config");

/**
 * Parameterized test: visit every project page from data/projects.json,
 * assert it renders without console errors, and snapshot its hero region.
 *
 * Issue #265 — "Parameterized test that visits all 19+ project pages."
 * (Cradle currently has 45 projects, all covered here.)
 */
test.describe("Project pages", () => {
  test.beforeAll(async () => {
    const projects = await loadProjects();
    if (projects.length === 0) {
      throw new Error("No projects found in data/projects.json");
    }
  });

  for (const project of await loadProjectsSync()) {
    const title = project.title;
    const url = `${BASE_URL}/${project.path.replace(/^projects\//, "projects/")}`;

    test(`${title} — page loads and main is visible`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto(url);
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("main").first()).toBeVisible();
      expect(errors, "uncaught exceptions on project page").toEqual([]);
    });

    test(`${title} — document has a non-empty <title>`, async ({ page }) => {
      await page.goto(url);
      await expect(page).toHaveTitle(/.+/);
    });

    test(`${title} — no console.error on load`, async ({ page }) => {
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      // Allow but flag browser-extension noise (e.g., ResizeObserver loop).
      const filtered = consoleErrors.filter(
        (t) =>
          !t.includes("ResizeObserver loop") &&
          !t.includes("Download the React DevTools"),
      );
      expect(filtered, `console.error on ${url}`).toEqual([]);
    });

    // Hero snapshot for both themes. Skip on mobile project — too slow at 45×2.
    for (const theme of THEMES) {
      test(`${title} — hero snapshot (${theme})`, async ({ page }) => {
        await page.goto(url);
        await setTheme(page, theme);
        await waitForVisualStable(page);

        // Snapshot only the visible hero (above-the-fold region).
        // 1280×400 crop is enough to catch header + intro layout breakage
        // without paying the cost of a full-page snapshot per project.
        await expect(page).toHaveScreenshot(
          `project-${slugify(title)}-${theme}.png`,
          {
            clip: { x: 0, y: 0, width: 1280, height: 400 },
            maxDiffPixelRatio: 0.05,
          },
        );
      });
    }
  }
});

// Helpers ──────────────────────────────────────────────────────────────────

/**
 * Synchronous accessor — Playwright's `test.describe` block runs
 * synchronously, so we preload the project list at module import time
 * using a Node require (data/projects.json is a plain JSON file).
 *
 * @returns {Array<{ title: string; category: string; path: string }>}
 */
function loadProjectsSync() {
  const fs = require("fs");
  const path = require("path");
  const file = path.join(__dirname, "..", "..", "data", "projects.json");
  if (!fs.existsSync(file)) {
    // Fallback: generate on the fly so e2e works on a fresh checkout.
    require("child_process").execSync("npm run build", {
      stdio: "inherit",
      cwd: path.join(__dirname, "..", ".."),
    });
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
