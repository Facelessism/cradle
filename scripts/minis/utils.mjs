import fs from "node:fs/promises";
import path from "node:path";

export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(targetPath) {
  try {
    const stats = await fs.stat(targetPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export async function isFile(targetPath) {
  try {
    const stats = await fs.stat(targetPath);
    return stats.isFile();
  } catch {
    return false;
  }
}

export async function readJson(filePath) {
  const content = await fs.readFile(filePath, "utf8");

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${filePath}: ${error.message}`,
    );
  }
}

export async function writeJson(filePath, value) {
  await ensureDirectory(path.dirname(filePath));

  await fs.writeFile(
    filePath,
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

export async function ensureDirectory(directory) {
  await fs.mkdir(directory, {
    recursive: true,
  });
}

export async function removeDirectory(directory) {
  await fs.rm(directory, {
    recursive: true,
    force: true,
  });
}

export async function copyDirectory(source, destination) {
  await ensureDirectory(destination);

  await fs.cp(source, destination, {
    recursive: true,
    force: true,
  });
}

export async function copyFile(source, destination) {
  await ensureDirectory(path.dirname(destination));

  await fs.copyFile(source, destination);
}

export async function readDirectory(directory) {
  return fs.readdir(directory, {
    withFileTypes: true,
  });
}

export function normalizePath(value) {
  return value.split(path.sep).join("/");
}

export function relativePath(from, target) {
  return normalizePath(path.relative(from, target));
}

export function resolveProjectPath(projectPath, projectsDir) {
  const normalized = projectPath
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  const absolute = path.resolve(projectsDir, normalized);

  const relative = path.relative(projectsDir, absolute);

  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `Project path escapes the projects directory: ${projectPath}`,
    );
  }

  return absolute;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createLogger(options = {}) {
  const verbose = Boolean(options.verbose);

  return {
    info(message) {
      console.log(`[minis] ${message}`);
    },

    success(message) {
      console.log(`[minis] ✓ ${message}`);
    },

    warn(message) {
      console.warn(`[minis] ⚠ ${message}`);
    },

    error(message) {
      console.error(`[minis] ✗ ${message}`);
    },

    debug(message) {
      if (verbose) {
        console.log(`[minis] ${message}`);
      }
    },
  };
}

export function getMiniOutputPath(mini, distDir) {
  return path.join(
    distDir,
    mini.category,
    mini.name,
  );
}

export function assertSupportedMode(mode, supportedModes) {
  if (!supportedModes.includes(mode)) {
    throw new Error(
      `Unsupported mini build mode "${mode}". ` +
        `Expected one of: ${supportedModes.join(", ")}`,
    );
  }
}

export function getProjectEntryCandidates(projectDir) {
  return [
    "index.html",
    "src/index.html",
    "index.js",
    "main.js",
    "src/index.js",
    "src/main.js",
    "script.js",
  ].map((entry) => path.join(projectDir, entry));
}

export async function findFirstExistingFile(candidates) {
  for (const candidate of candidates) {
    if (await isFile(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function getDirectorySize(directory) {
  let total = 0;

  async function walk(currentDirectory) {
    const entries = await readDirectory(currentDirectory);

    for (const entry of entries) {
      const entryPath = path.join(
        currentDirectory,
        entry.name,
      );

      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (entry.isFile()) {
        const stats = await fs.stat(entryPath);
        total += stats.size;
      }
    }
  }

  await walk(directory);

  return total;
}