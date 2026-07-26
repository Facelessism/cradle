const { test, expect } = require("@playwright/test");

const PROJECT_PATHS = [
  "projects/games/2048-game/",
  "projects/games/chess/",
  "projects/games/memory-flip-game/",
  "projects/games/stone-paper-scissors-game/",
  "projects/games/cannon-shooting/",
  "projects/games/dot-game/",
  "projects/games/ludo-game/",
  "projects/misc/meme-generator/",
  "projects/misc/morse-code-studio/",
  "projects/misc/periodic-table/",
  "projects/misc/sound-wave-visualizer/",
  "projects/aiml/neural-network-playground/",
  "projects/aiml/image-classifier/",
  "projects/aiml/ai-circuit-builder/",
  "projects/dev-tools/cpu-emulator/",
  "projects/dev-tools/url-parser/",
  "projects/dev-tools/browser-storage-inspector/",
  "projects/dev-tools/encoding-toolkit/",
  "projects/productivity/attendance-tracker/",
  "projects/productivity/reading-progress-tracker/",
  "projects/productivity/time-blocking-planner/",
  "projects/productivity/brain-dump-collector/",
  "projects/editor/css-shape-designer/",
  "projects/editor/markdown-resume-generator/",
  "projects/math/matrix-playground/",
];

for (const projectPath of PROJECT_PATHS) {
  test.describe(`Project: ${projectPath}`, () => {
    test("loads without crash", async ({ page }) => {
      page.on("pageerror", err => {
        throw new Error(`Page error on ${projectPath}: ${err.message}`);
      });
      await page.goto(projectPath, { waitUntil: "domcontentloaded" });
      const title = await page.title();
      expect(title).toBeTruthy();
    });

    test("no console errors", async ({ page }) => {
      const errors = [];
      page.on("console", msg => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      await page.goto(projectPath, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);
      expect(errors.length).toBe(0);
    });
  });
}
