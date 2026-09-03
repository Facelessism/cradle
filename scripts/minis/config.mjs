/**
 * Central configuration for Cradle mini projects.
 *
 * The configuration is intentionally small and data-driven.
 * Mini projects remain inside:
 *
 *   projects/<category>/<mini>/
 *
 * By default, minis use the static build model.
 *
 * Build modes:
 *
 * - static:
 *   Copy the mini as-is. No bundling or dependency installation.
 *
 * - individual:
 *   Build the mini independently using its own entry point.
 *
 * - central:
 *   Reserved for minis that should participate in a shared
 *   repository-level dependency/bundle strategy.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, "../..");

export const PROJECTS_DIR = path.join(ROOT_DIR, "projects");

export const DIST_DIR = path.join(ROOT_DIR, "dist", "minis");

export const CONFIG_FILE = path.join(ROOT_DIR, "minis.config.json");

export const DEFAULT_BUILD_MODE = "static";

export const BUILD_MODES = Object.freeze({
  STATIC: "static",
  INDIVIDUAL: "individual",
  CENTRAL: "central",
});

export const SUPPORTED_BUILD_MODES = Object.freeze(
  Object.values(BUILD_MODES),
);

export const DEFAULT_CONFIG = Object.freeze({
  root: "projects",
  output: "dist/minis",
  defaultMode: DEFAULT_BUILD_MODE,
  clean: true,

  modes: {
    static: {
      description: "Copy mini files without bundling.",
    },

    individual: {
      description: "Build each mini independently.",
    },

    central: {
      description: "Build minis using the centralized repository strategy.",
    },
  },

  overrides: {},
});

export default {
  ROOT_DIR,
  PROJECTS_DIR,
  DIST_DIR,
  CONFIG_FILE,
  DEFAULT_BUILD_MODE,
  BUILD_MODES,
  SUPPORTED_BUILD_MODES,
  DEFAULT_CONFIG,
};