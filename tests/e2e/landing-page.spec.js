// @ts-check
const { test, expect } = require("@playwright/test");
const {
  BASE_URL,
  THEMES,
  loadProjects,
  setTheme,
  waitForVisualStable,
} = require("./config");

test.describe("Landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test("renders hero heading and project grid", async ({ page }) => {
    await expect(page.locator("h1")).toHaveText("Cradle");
    await expect(page.locator('[data-testid="project-grid"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="theme-toggle"]')).toBeVisible();
  });

  test("renders every project from data/projects.json", async ({ page }) => {
    const projects = await loadProjects();
    await page.waitForSelector('[data-testid="project-card"]');

    const cards = page.locator('[data-testid="project-card"]');
    await expect(cards).toHaveCount(projects.length);
  });

  test("project count label reflects grid size", async ({ page }) => {
    const projects = await loadProjects();
    await page.waitForSelector('[data-testid="project-card"]');
    await expect(page.locator('[data-testid="project-count"]')).toContainText(
      String(projects.length),
    );
  });

  test("search input filters the grid", async ({ page }) => {
    const projects = await loadProjects();
    await page.waitForSelector('[data-testid="project-card"]');
    expect(await page.locator('[data-testid="project-card"]').count()).toBe(
      projects.length,
    );

    await page.locator('[data-testid="search-input"]').fill("2048");
    // Worker filter is async; wait for the count to drop.
    await expect(
      page.locator('[data-testid="project-card"]'),
    ).toHaveCount(1);
  });

  test("clear-search button resets the grid", async ({ page }) => {
    const projects = await loadProjects();
    await page.waitForSelector('[data-testid="project-card"]');

    await page.locator('[data-testid="search-input"]').fill("chess");
    await expect(
      page.locator('[data-testid="project-card"]'),
    ).toHaveCount(1);

    // Click the in-input × clear button.
    await page.locator('[data-testid="search-clear"]').click();
    await expect(
      page.locator('[data-testid="project-card"]'),
    ).toHaveCount(projects.length);
  });

  test("category filter chip narrows the grid", async ({ page }) => {
    const projects = await loadProjects();
    const gamesCount = projects.filter((p) => p.category === "games").length;

    await page.waitForSelector('[data-testid="project-card"]');
    await page
      .locator('[data-testid="filter-chip"]', { hasText: /GAMES/i })
      .first()
      .click();

    await expect(
      page.locator('[data-testid="project-card"]'),
    ).toHaveCount(gamesCount);
  });

  for (const theme of THEMES) {
    test(`visual snapshot — desktop, ${theme} theme`, async ({ page }) => {
      await setTheme(page, theme);
      await waitForVisualStable(page);
      await expect(page).toHaveScreenshot(
        `landing-desktop-${theme}.png`,
        { fullPage: true, maxDiffPixelRatio: 0.02 },
      );
    });
  }
});
