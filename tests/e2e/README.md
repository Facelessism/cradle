# Cradle E2E Test Suite

Automated visual regression, accessibility, and console-error detection for the Cradle project catalog. See issue #265.

## Quick start

```bash
# One-time: install Playwright browsers
npx playwright install --with-deps chromium firefox

# Run the full e2e suite (visual + a11y + console + projects)
npm run test:e2e

# Update visual baselines after an intentional UI change
npm run test:update-baselines

# Run only accessibility audits
npm run test:accessibility

# Run only visual regression snapshots
npm run test:visual

# Run only console-error detection
npm run test:console

# Run only the parameterized project-page sweep
npm run test:projects

```

## Directory layout

```text
tests/e2e/
├── config.js                      # Shared helpers (themes, projects, console capture)
├── landing-page.spec.js           # Landing page visual + interaction tests
├── projects.spec.js               # Parameterized sweep over all 45 project pages
├── themes.spec.js                 # Dark/light theme visual + dataset.theme tests
├── accessibility.spec.js          # axe-core WCAG 2.1 AA audits
├── console.spec.js                # console.error / console.warn detection
├── __snapshots__/                 # Committed visual baselines (PNG)
├── __diff_output__/               # Generated on snapshot mismatch (gitignored)
└── report/                        # HTML + JSON test reports (gitignored)

```

## Visual baselines

Baselines live in `tests/e2e/**/*.spec.js-snapshots/` and are committed. They are keyed by browser + viewport + theme, so a single landing page generates 4 baselines (`chrome-desktop-dark`, `chrome-desktop-light`, `firefox-desktop-dark`, `firefox-desktop-light`, `mobile-chrome-dark`, etc.).

When you intentionally change the UI:

1. Run `npm run test:update-baselines`
2. Inspect the diff in `tests/e2e/__diff_output__/`
3. Commit the updated baselines alongside your UI change

## Accessibility rules

We audit against WCAG 2.1 AA (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`).

**Disabled rules (intentional patterns):**

* `aria-allowed-role` — project cards use `role="link"` on `<article>` for roving-tabindex keyboard navigation. Tested across screen readers.

If a new project page fails the a11y audit, the failure JSON is written to `tests/e2e/report/results.json` and attached as a CI artifact.

## CI

The `.github/workflows/test-e2e.yml` workflow runs on every PR to `main`:

* Installs deps + Playwright browsers
* Runs `npm run build` to regenerate `data/projects.json`
* Runs `npm test` (unit tests)
* Runs `npm run test:e2e` (full Playwright suite)
* Runs `npm run test:accessibility` (fast-path a11y only)
* Uploads snapshot diffs, HTML report, and Playwright traces as artifacts
* Writes a summary table to the PR's GitHub Step Summary

## Edge cases handled

* **Headless CI** — Playwright runs headless by default; no `xvfb` needed.
* **Font rendering** — `expect.toHaveScreenshot` uses `maxDiffPixelRatio: 0.01` to tolerate font hinting differences across Ubuntu runners.
* **Animations** — `reducedMotion: "reduce"` in config + `animations: "disabled"` in expect options prevents theme-toggle spin from leaking into screenshots.
* **Theme-toggle timing** — `setTheme()` writes to `localStorage` + reloads instead of clicking the toggle, avoiding the 350ms spin animation.
* **Mobile vs desktop** — landing page snapshotted at 1280×720 and 375×667; project pages only at desktop (45 projects × 2 themes is already 90 snapshots, mobile would double it).
* **New project added** — `projects.spec.js` reads `data/projects.json` at module load, so a new project automatically gets a test. If no baseline exists, the test fails with a clear "snapshot not found" message prompting `npm run test:update-baselines`.
* **CI timeout** — projects run in 2 workers (CI) / full parallel (local); 45 projects × 2 themes × 1 viewport ≈ 90 snapshots, ~3 minutes total.
