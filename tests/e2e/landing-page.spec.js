const { test, expect } = require("@playwright/test");

test.describe("Landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads and displays the project grid", async ({ page }) => {
    const grid = page.locator('[data-testid="project-grid"]');
    await expect(grid).toBeVisible({ timeout: 10000 });
    const cards = grid.locator('[data-testid="project-card"]");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test("search input filters projects", async ({ page }) => {
    const search = page.locator('[data-testid="search-input"]');
    await expect(search).toBeVisible();
    await search.fill("chess");
    const cards = page.locator('[data-testid="project-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });
    const titles = await cards.allTextContents();
    const match = titles.some(t => t.toLowerCase().includes("chess"));
    expect(match).toBe(true);
  });

  test("category filter buttons work", async ({ page }) => {
    const gamesBtn = page.locator('[data-testid="category-btn"]', {
      hasText: "GAMES",
    });
    await expect(gamesBtn).toBeVisible();
    await gamesBtn.click();
    const cards = page.locator('[data-testid="project-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });
    const titles = await cards.allTextContents();
    expect(titles.length).toBeGreaterThan(0);
  });

  test("no console errors on load", async ({ page }) => {
    const errors = [];
    page.on("console", msg => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await page.waitForSelector('[data-testid="project-card"]', { timeout: 10000 });
    expect(errors.length).toBe(0);
  });
});
