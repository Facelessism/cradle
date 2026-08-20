// @ts-check
const { test, expect } = require("@playwright/test");
const {
  BASE_URL,
  loadProjects,
  captureConsole,
} = require("./config");

/**
 * Issue #265 — Captures console.error / console.warn during page loads.
 *
 * Excludes known-noise patterns:
 *  - ResizeObserver loop warnings (browser-internal, not actionable)
 *  - "Download the React DevTools" (extension noise in headed mode)
 *  - Third-party CDN font CORS warnings (we self-host via Google Fonts CDN)
 */
const NOISE_PATTERNS = [
  /ResizeObserver loop/i,
  /Download the React DevTools/i,
  /Failed to load resource: net::ERR_FAILED/i, // favicon in CI
];

function isNoise(text) {
  return NOISE_PATTERNS.some((re) => re.test(text));
}

test.describe("Console output", () => {
  test("landing page logs no errors or warnings", async ({ page }) => {
    const messages = await captureConsole(page, async () => {
      await page.goto(BASE_URL);
      await page.waitForSelector('[data-testid="project-card"]');
      await page.waitForLoadState("networkidle");
    });

    const real = messages.filter((m) => !isNoise(m.text));
    expect(real, "unexpected console output on landing").toEqual([]);
  });

  for (const project of loadProjectsSync()) {
    test(`${project.title} — no console.error or console.warn`, async ({
      page,
    }) => {
      const url = `${BASE_URL}/${project.path.replace(/^projects\//, "projects/")}`;
      const messages = await captureConsole(page, async () => {
        await page.goto(url);
        await page.waitForLoadState("networkidle");
        // Give async project scripts a moment to log.
        await page.waitForTimeout(500);
      });

      const real = messages.filter((m) => !isNoise(m.text));
      expect(
        real,
        `console output on ${project.title}: ${JSON.stringify(real, null, 2)}`,
      ).toEqual([]);
    });
  }
});

function loadProjectsSync() {
  const fs = require("fs");
  const path = require("path");
  const file = path.join(__dirname, "..", "..", "data", "projects.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
