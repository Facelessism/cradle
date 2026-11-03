/**
 * Lighthouse CI Configuration for Cradle Landing Page
 *
 * Current main baselines:
 * - Performance: ~0.96  (Threshold: 0.85 — tolerance for CI CPU/runner variance)
 * - Accessibility: ~0.96 (Threshold: 0.90)
 * - Best Practices: 1.00 (Threshold: 0.90)
 * - SEO: 1.00 (Threshold: 0.90)
 *
 * Run locally:
 *   npm run lhci
 *   or: npx @lhci/cli autorun
 */

module.exports = {
  ci: {
    collect: {
      staticDistDir: ".",
      url: ["http://localhost/index.html"],
      numberOfRuns: 3,
      settings: {
        chromeFlags: "--no-sandbox --headless",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.85 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
