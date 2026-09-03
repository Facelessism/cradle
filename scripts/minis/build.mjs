import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  DIST_DIR,
  PROJECTS_DIR,
  SUPPORTED_BUILD_MODES,
} from "./config.mjs";

import {
  copyDirectory,
  ensureDirectory,
  removeDirectory,
  getMiniOutputPath,
  createLogger,
  getDirectorySize,
  formatBytes,
  pathExists,
} from "./utils.mjs";

import {
  discoverMinis,
  findMini,
  summarizeMinis,
} from "./discover.mjs";

const __filename = fileURLToPath(import.meta.url);

const logger = createLogger({
  verbose: process.argv.includes("--verbose"),
});

function parseArguments(argv) {
  const args = argv.slice(2);

  const options = {
    target: null,
    mode: null,
    clean: true,
    verbose: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--verbose") {
      options.verbose = true;
      continue;
    }

    if (argument === "--no-clean") {
      options.clean = false;
      continue;
    }

    if (argument === "--mode") {
      options.mode = args[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith("--mode=")) {
      options.mode = argument.slice("--mode=".length);
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    if (!argument.startsWith("--") && !options.target) {
      options.target = argument;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Cradle Mini Build

Usage:
  npm run minis:build
  npm run minis:build -- games/chess
  npm run minis:build -- instruments/violin
  npm run minis:build -- --mode static
  npm run minis:build -- --mode individual
  npm run minis:build -- --mode central

Options:
  <path>             Build one mini
  --mode <mode>      Build only minis using this mode
  --no-clean         Keep the existing dist/minis directory
  --verbose           Print additional build information
  --help              Show this help message

Build modes:
  static              Copy project files without bundling
  individual          Run an individual package build
  central             Use centralized build handling
`);
}

async function runCommand(
  command,
  args,
  options = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        ...options.env,
      },
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} exited with code ${code}`,
        ),
      );
    });
  });
}

async function buildStatic(mini) {
  const outputDir = getMiniOutputPath(
    mini,
    DIST_DIR,
  );

  await copyDirectory(
    mini.absolutePath,
    outputDir,
  );

  return {
    mode: "static",
    outputDir,
  };
}

async function buildIndividual(mini) {
  const packageJson = path.join(
    mini.absolutePath,
    "package.json",
  );

  if (!(await pathExists(packageJson))) {
    logger.warn(
      `${mini.path} is configured as individual but has no package.json. Falling back to static copy.`,
    );

    return buildStatic(mini);
  }

  logger.info(
    `Running individual build for ${mini.path}`,
  );

  await runCommand(
    "npm",
    ["run", "build"],
    {
      cwd: mini.absolutePath,
    },
  );

  const candidates = [
    path.join(mini.absolutePath, "dist"),
    path.join(mini.absolutePath, "build"),
  ];

  let sourceDir = null;

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      sourceDir = candidate;
      break;
    }
  }

  if (!sourceDir) {
    throw new Error(
      `Individual build completed but no dist/ or build/ directory was produced by ${mini.path}`,
    );
  }

  const outputDir = getMiniOutputPath(
    mini,
    DIST_DIR,
  );

  await copyDirectory(
    sourceDir,
    outputDir,
  );

  return {
    mode: "individual",
    outputDir,
  };
}

async function buildCentral(mini) {
  /*
   * Central mode deliberately starts with the same safe output
   * contract as static minis.
   *
   * This allows the repository to introduce shared bundling
   * incrementally without requiring every existing mini to
   * become a package.
   *
   * Central bundling can later be enabled for minis that have
   * explicit centralized entry-point configuration.
   */

  logger.debug(
    `Central build selected for ${mini.path}`,
  );

  return buildStatic(mini);
}

async function buildMini(mini) {
  logger.info(
    `Building ${mini.path} (${mini.mode})`,
  );

  switch (mini.mode) {
    case "static":
      return buildStatic(mini);

    case "individual":
      return buildIndividual(mini);

    case "central":
      return buildCentral(mini);

    default:
      throw new Error(
        `Unsupported build mode: ${mini.mode}`,
      );
  }
}

async function selectMinis(options) {
  const minis = await discoverMinis();

  if (options.target) {
    const mini = await findMini(options.target);

    if (!mini) {
      throw new Error(
        `Mini not found: ${options.target}`,
      );
    }

    return [mini];
  }

  if (options.mode) {
    if (
      !SUPPORTED_BUILD_MODES.includes(
        options.mode,
      )
    ) {
      throw new Error(
        `Unsupported mode "${options.mode}". ` +
          `Expected: ${SUPPORTED_BUILD_MODES.join(", ")}`,
      );
    }

    return minis.filter(
      (mini) => mini.mode === options.mode,
    );
  }

  return minis;
}

async function buildAll(options) {
  const minis = await selectMinis(options);

  if (minis.length === 0) {
    logger.warn("No minis matched the build request.");
    return;
  }

  if (options.clean) {
    logger.info(
      "Cleaning dist/minis before build...",
    );

    await removeDirectory(DIST_DIR);
  }

  await ensureDirectory(DIST_DIR);

  logger.info(
    `Building ${minis.length} mini project(s)...`,
  );

  const results = [];

  for (const mini of minis) {
    const startedAt = Date.now();

    try {
      const result = await buildMini(mini);

      const size = await getDirectorySize(
        result.outputDir,
      );

      const duration = Date.now() - startedAt;

      results.push({
        mini,
        ...result,
        size,
        duration,
      });

      logger.success(
        `${mini.path} → ${formatBytes(size)} (${duration}ms)`,
      );
    } catch (error) {
      logger.error(
        `Failed to build ${mini.path}: ${error.message}`,
      );

      throw error;
    }
  }

  return results;
}

async function main() {
  const options = parseArguments(
    process.argv,
  );

  if (options.help) {
    printHelp();
    return;
  }

  const allMinis = await discoverMinis();

  logger.info(
    `Discovered ${allMinis.length} minis across ${Object.keys(
      summarizeMinis(allMinis).categories,
    ).length} categories.`,
  );

  const results = await buildAll(options);

  if (!results) {
    return;
  }

  const totalSize = results.reduce(
    (total, result) =>
      total + result.size,
    0,
  );

  const totalDuration = results.reduce(
    (total, result) =>
      total + result.duration,
    0,
  );

  console.log("");
  logger.success(
    `Build complete: ${results.length} mini(s), ${formatBytes(
      totalSize,
    )}, ${totalDuration}ms.`,
  );
}

if (
  path.resolve(process.argv[1] ?? "") ===
  path.resolve(__filename)
) {
  try {
    await main();
  } catch (error) {
    logger.error(error.message);
    process.exitCode = 1;
  }
}