#!/usr/bin/env node

/**
 * Cradle — Centralized Build and Bundling Orchestrator for Minis
 * ─────────────────────────────────────────────────────────────
 * Enforces the repository build strategy across all mini-projects:
 *   - Tier 1: Static (Zero-Build) [Default]
 *   - Tier 2: Centrally Bundled (Root-managed tooling)
 *   - Tier 3: Individually Bundled (Specialized pre-built pipelines)
 *
 * Usage:
 *   node scripts/build-minis.js --check   # Validates all minis against build strategy
 *   node scripts/build-minis.js --list    # Lists minis categorized by build tier
 *   node scripts/build-minis.js --build   # Builds registered Tier 2 minis
 *   node scripts/build-minis.js --json    # Emits JSON report
 */

const fs = require("fs");
const path = require("path");
const { discoverProjects } = require("./project-discovery");

const REPO_ROOT = path.resolve(__dirname, "..");
const PROJECTS_DIR = path.join(REPO_ROOT, "projects");

/**
 * Registry of non-static minis (Tier 2 and Tier 3).
 * Any mini not in this registry is considered Tier 1 (Static).
 */
const BUILD_REGISTRY = {
  // Tier 2: Centrally Bundled projects (managed by root tooling)
  central: [
    // Format:
    // {
    //   slug: "projects/category/slug/",
    //   entry: "src/main.js",
    //   output: "dist/bundle.js",
    //   format: "iife",
    // }
  ],

  // Tier 3: Individually Bundled projects (specialized Wasm / C++ / DSP pipelines)
  individual: [
    // Format:
    // {
    //   slug: "projects/category/slug/",
    //   artifacts: ["assets/engine.wasm", "assets/engine.js"],
    //   docSection: "## Build & Tooling",
    // }
  ],
};

const DISALLOWED_CONFIG_PATTERNS = [
  /^webpack\.config\.(js|ts|cjs|mjs)$/i,
  /^vite\.config\.(js|ts|cjs|mjs)$/i,
  /^rollup\.config\.(js|ts|cjs|mjs)$/i,
  /^parcel\.json$/i,
  /^tsconfig(\..*)?\.json$/i,
  /^esbuild\.config\.(js|mjs)$/i,
];

const UNBUILT_SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".scss",
  ".sass",
  ".less",
  ".vue",
  ".svelte",
]);

/**
 * Recursively list files in a directory relative to that directory.
 */
function getFilesInDir(dir, prefix = "") {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...getFilesInDir(path.join(dir, entry.name), rel));
    } else {
      files.push(rel);
    }
  }
  return files;
}

/**
 * Scans all discovered projects and validates them against the build strategy.
 */
function validateBuildStrategy(projects) {
  const issues = [];
  const centralMap = new Map(BUILD_REGISTRY.central.map(p => [p.slug, p]));
  const individualMap = new Map(BUILD_REGISTRY.individual.map(p => [p.slug, p]));

  for (const project of projects) {
    const relPath = project.relPath;
    const absPath = project.absPath;
    const isCentral = centralMap.has(relPath);
    const isIndividual = individualMap.has(relPath);

    // 1. Check for local package.json
    const packageJsonPath = path.join(absPath, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      issues.push({
        severity: "error",
        project: relPath,
        code: "LOCAL_PACKAGE_JSON",
        message: `Found local "package.json" in mini. Per-mini package trees are forbidden; manage dependencies at the repository root.`,
      });
    }

    // 2. Check for local node_modules
    const nodeModulesPath = path.join(absPath, "node_modules");
    if (fs.existsSync(nodeModulesPath)) {
      issues.push({
        severity: "error",
        project: relPath,
        code: "COMMITTED_NODE_MODULES",
        message: `Found "node_modules" directory in mini. Local dependencies must never be committed.`,
      });
    }

    // 3. Scan directory files for rogue bundler configs and unbuilt source
    const files = getFilesInDir(absPath);

    for (const file of files) {
      const fileName = path.basename(file);
      const ext = path.extname(file).toLowerCase();

      // Check for disallowed bundler configs
      for (const pattern of DISALLOWED_CONFIG_PATTERNS) {
        if (pattern.test(fileName)) {
          issues.push({
            severity: "error",
            project: relPath,
            code: "ROGUE_BUNDLER_CONFIG",
            message: `Found unapproved bundler config "${file}". Ad-hoc tooling is prohibited; use root tooling or register in scripts/build-minis.js.`,
          });
        }
      }

      // Check for unbuilt source in Tier 1 projects
      if (!isCentral && !isIndividual && UNBUILT_SOURCE_EXTENSIONS.has(ext)) {
        issues.push({
          severity: "warning",
          project: relPath,
          code: "UNREGISTERED_SOURCE_EXTENSION",
          message: `Found unbuilt source file "${file}" (${ext}) in static Tier 1 mini. If compilation is required, register the mini as Tier 2 or Tier 3.`,
        });
      }
    }

    // 4. Validate Tier 2 registrations
    if (isCentral) {
      const config = centralMap.get(relPath);
      const entryPath = path.join(absPath, config.entry);
      const outputPath = path.join(absPath, config.output);

      if (!fs.existsSync(entryPath)) {
        issues.push({
          severity: "error",
          project: relPath,
          code: "MISSING_CENTRAL_ENTRY",
          message: `Centrally bundled mini is missing declared entrypoint: "${config.entry}".`,
        });
      }
      if (!fs.existsSync(outputPath)) {
        issues.push({
          severity: "error",
          project: relPath,
          code: "MISSING_CENTRAL_OUTPUT",
          message: `Centrally bundled mini is missing committed output bundle: "${config.output}". Built artifacts must be committed.`,
        });
      }
    }

    // 5. Validate Tier 3 registrations
    if (isIndividual) {
      const config = individualMap.get(relPath);
      if (Array.isArray(config.artifacts)) {
        for (const artifact of config.artifacts) {
          const artifactPath = path.join(absPath, artifact);
          if (!fs.existsSync(artifactPath)) {
            issues.push({
              severity: "error",
              project: relPath,
              code: "MISSING_INDIVIDUAL_ARTIFACT",
              message: `Individually bundled mini is missing committed artifact: "${artifact}".`,
            });
          }
        }
      }

      const archPath = path.join(absPath, "ARCHITECTURE.md");
      if (fs.existsSync(archPath)) {
        const archContent = fs.readFileSync(archPath, "utf8");
        if (!archContent.includes("Build & Tooling") && !archContent.includes("build")) {
          issues.push({
            severity: "warning",
            project: relPath,
            code: "MISSING_BUILD_DOCUMENTATION",
            message: `Tier 3 mini should document its build recipe and prerequisites in ARCHITECTURE.md.`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Builds all registered Tier 2 centrally bundled minis.
 */
function buildCentralMinis() {
  console.log("[build-minis] Executing centralized build pipeline...");
  if (BUILD_REGISTRY.central.length === 0) {
    console.log("[build-minis] No Tier 2 centrally bundled minis currently registered.");
    console.log("[build-minis] All minis are running on Tier 1 (Static) or Tier 3 (Pre-built).");
    return 0;
  }

  // When Tier 2 projects are registered, the central bundler executes here.
  for (const config of BUILD_REGISTRY.central) {
    console.log(`[build-minis] Building ${config.slug} (${config.entry} -> ${config.output})...`);
    // Example: call central esbuild/rollup or custom build step
  }
  return 0;
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check") || args.includes("validate");
  const isList = args.includes("--list");
  const isBuild = args.includes("--build");
  const isJson = args.includes("--json");

  const projects = discoverProjects(PROJECTS_DIR, REPO_ROOT);

  if (isList) {
    const centralSet = new Set(BUILD_REGISTRY.central.map(p => p.slug));
    const individualSet = new Set(BUILD_REGISTRY.individual.map(p => p.slug));

    const tiers = { tier1: [], tier2: [], tier3: [] };

    for (const p of projects) {
      if (centralSet.has(p.relPath)) tiers.tier2.push(p.relPath);
      else if (individualSet.has(p.relPath)) tiers.tier3.push(p.relPath);
      else tiers.tier1.push(p.relPath);
    }

    if (isJson) {
      console.log(JSON.stringify(tiers, null, 2));
      return 0;
    }

    console.log(`\nCradle Mini Build Model Distribution (${projects.length} total projects):\n`);
    console.log(`  Tier 1: Static (Zero-Build)       : ${tiers.tier1.length} projects`);
    console.log(`  Tier 2: Centrally Bundled         : ${tiers.tier2.length} projects`);
    console.log(`  Tier 3: Individually Bundled      : ${tiers.tier3.length} projects\n`);
    return 0;
  }

  if (isBuild) {
    return buildCentralMinis();
  }

  // Default mode or --check mode
  const issues = validateBuildStrategy(projects);
  const errors = issues.filter(i => i.severity === "error");
  const warnings = issues.filter(i => i.severity === "warning");

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          totalProjects: projects.length,
          errorsCount: errors.length,
          warningsCount: warnings.length,
          issues,
        },
        null,
        2
      )
    );
    return errors.length > 0 ? 1 : 0;
  }

  console.log(`\nValidating mini projects against Centralized Build Strategy (${projects.length} minis scanned)...`);

  if (issues.length === 0) {
    console.log(`✓ All minis comply with the Centralized Build Strategy (zero rogue tooling detected).\n`);
    return 0;
  }

  for (const issue of issues) {
    const tag = issue.severity === "error" ? "ERROR" : "WARN ";
    console.log(`  [${tag}] ${issue.project} : ${issue.message}`);
  }

  console.log(
    `\nScan complete: ${errors.length} error(s), ${warnings.length} warning(s).\n`
  );

  if (errors.length > 0) {
    console.error(`Build strategy validation failed. Please address errors above.\nSee docs/BUILD_STRATEGY.md for guidelines.`);
    return 1;
  }

  return 0;
}

if (require.main === module) {
  const exitCode = main();
  process.exit(exitCode);
}

module.exports = {
  BUILD_REGISTRY,
  validateBuildStrategy,
};

