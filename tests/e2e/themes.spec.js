// @ts-check
const { test, expect } = require("@playwright/test");
const {
  BASE_URL,
  THEMES,
  setTheme,
  waitForVisualStable,
} = require("./config");

/**
 * Issue #265 — Dark/light theme visual snapshots for all pages.
 *
 * Specifically covers:
 *   - Landing page in both themes × both viewports
 *   - Theme toggle UI in both states
 *   - `document.documentElement.dataset.theme` is set (test hook)
 */
test.describe("Theme switching", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  for (const theme of THEMES) {
    test(`sets document.documentElement.dataset.theme = "${theme}"`, async ({
      page,
    }) => {
      await setTheme(page, theme);
      const datasetTheme = await page.evaluate(
        () => document.documentElement.dataset.theme,
      );
      expect(datasetTheme).toBe(theme);
    });

    test(`toggles <html> class for ${theme} theme`, async ({ page }) => {
      await setTheme(page, theme);
      const hasLightClass = await page.evaluate(() =>
        document.documentElement.classList.contains("light-theme"),
      );
      expect(hasLightClass).toBe(theme === "light");
    });

    test(`theme-toggle aria-checked reflects ${theme}`, async ({ page }) => {
      await setTheme(page, theme);
      const toggle = page.locator('[data-testid="theme-toggle"]');
      await expect(toggle).toHaveAttribute(
        "aria-checked",
        theme === "light" ? "true" : "false",
      );
    });

    test(`visual snapshot — landing, ${theme} theme`, async ({ page }) => {
      await setTheme(page, theme);
      await waitForVisualStable(page);
      await expect(page).toHaveScreenshot(`theme-landing-${theme}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });

    test(`visual snapshot — hero region, ${theme} theme`, async ({ page }) => {
      await setTheme(page, theme);
      await waitForVisualStable(page);
      const hero = page.locator("header.hero");
      await expect(hero).toHaveScreenshot(`theme-hero-${theme}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });
  }

  test("clicking theme-toggle flips the theme", async ({ page }) => {
    await setTheme(page, "dark");
    const initial = await page.evaluate(
      () => document.documentElement.dataset.theme,
    );
    expect(initial).toBe("dark");

    await page.locator('[data-testid="theme-toggle"]').click();

    // The toggle has a 350ms spin animation; wait for it to settle.
    await page.waitForFunction(
      () => document.documentElement.dataset.theme !== "dark",
      { timeout: 5_000 },
    );
    const after = await page.evaluate(
      () => document.documentElement.dataset.theme,
    );
    expect(after).toBe("light");
  });

  test("theme persists across reloads", async ({ page }) => {
    await setTheme(page, "light");
    await page.reload({ waitUntil: "networkidle" });
    const theme = await page.evaluate(
      () => document.documentElement.dataset.theme,
    );
    expect(theme).toBe("light");
  });
});
