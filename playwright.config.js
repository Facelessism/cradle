// @ts-check
const { defineConfig, devices } = require("@playwright/test");

// Playwright configuration for Cradle.
// Issue #265 — Automated visual regression and accessibility testing pipeline.
//
// Visual baselines live in tests/e2e/ (one snapshots folder per spec file)
// and are committed to the repo. Run `npm run test:e2e -- --update-snapshots`
// after intentionally changing UI to refresh them.
//
// The webServer hook starts `npx serve` on port 4173 so the suite works
// the same on dev laptops and CI runners without manual setup.
module.exports = defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.js$/,

  // Fail fast on CI; be patient locally.
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,

  // Snapshot directories — committed to repo.
  snapshotDir: "./tests/e2e/__snapshots__",
  outputDir: "./tests/e2e/__diff_output__",

  // axe-core reports go here.
  reporter: [
    ["list"],
    ["html", { outputFolder: "tests/e2e/report", open: "never" }],
    ["json", { outputFile: "tests/e2e/report/results.json" }],
  ],

  // Shared expectations for visual diffs — tuned to tolerate font hinting
  // differences across CI runners but still catch real layout regressions.
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
      animations: "disabled",
      caret: "hide",
    },
    timeout: 10_000,
  },

  use: {
    baseURL: "http://localhost:4173",

    // Collect console + pageerror for the dedicated console.spec.js
    // and to surface failures in other specs.
    collectConsole: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",

    // Reduced motion + consistent theme baseline prevents
    // theme-toggle spin animation from leaking into screenshots.
    reducedMotion: "reduce",
  },

  projects: [
    // ── Desktop Chrome (primary) ────────────────────────────────────────
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },

    // ── Desktop Firefox ────────────────────────────────────────────────
    {
      name: "desktop-firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1280, height: 720 },
      },
    },

    // ── Mobile Chrome (375×667) — only landing page + 1 sample project ─
    {
      name: "mobile-chrome",
      testMatch: /.*(landing-page|themes)\.spec\.js$/,
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 667 },
      },
    },
  ],

  webServer: {
    command: "npx serve . -l 4173 --no-clipboard",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
