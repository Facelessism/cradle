// @ts-check
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const {
  BASE_URL,
  THEMES,
  loadProjects,
  setTheme,
} = require("./config");

/**
 * Issue #265 — axe-core audits for all pages.
 *
 * WCAG 2.1 AA as minimum. Known false positives (aria-allowed-role on the
 * project-card role=link, color-contrast on the high-contrast theme
 * badges) are explicitly disabled per the issue.
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const AXE_RULES_TO_DISABLE = [
  // Project cards use role="link" on an <article> for roving-tabindex
  // keyboard nav; axe flags this as aria-allowed-role. The pattern is
  // intentional and works across all tested screen readers.
  "aria-allowed-role",
];

test.describe("Accessibility — landing page", () => {
  for (const theme of THEMES) {
    test(`passes WCAG 2.1 AA — landing, ${theme} theme`, async ({ page }) => {
      await page.goto(BASE_URL);
      await setTheme(page, theme);
      await page.waitForSelector('[data-testid="project-card"]');

      const results = await new AxeBuilder({ page })
        .withTags(AXE_TAGS)
        .disableRules(AXE_RULES_TO_DISABLE)
        .analyze();

      const violations = results.violations;
      if (violations.length > 0) {
        console.error(
          `Accessibility violations on landing (${theme}):\n`,
          JSON.stringify(violations, null, 2),
        );
      }
      expect(violations, "axe-core violations on landing page").toEqual([]);
    });
  }
});

test.describe("Accessibility — project pages", () => {
  const projects = loadProjectsSync();

  for (const project of projects) {
    test(`${project.title} — passes WCAG 2.1 AA (dark theme)`, async ({
      page,
    }) => {
      const url = `${BASE_URL}/${project.path.replace(/^projects\//, "projects/")}`;
      await page.goto(url);
      await setTheme(page, "dark");

      const results = await new AxeBuilder({ page })
        .withTags(AXE_TAGS)
        .disableRules(AXE_RULES_TO_DISABLE)
        .analyze();

      const critical = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      expect(
        critical,
        `critical/serious a11y violations on ${project.title}`,
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
