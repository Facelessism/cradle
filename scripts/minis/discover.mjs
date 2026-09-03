import path from "node:path";

import {
  PROJECTS_DIR,
  DEFAULT_BUILD_MODE,
  SUPPORTED_BUILD_MODES,
  CONFIG_FILE,
} from "./config.mjs";

import {
  isDirectory,
  isFile,
  readDirectory,
  readJson,
  relativePath,
  getProjectEntryCandidates,
  findFirstExistingFile,
} from "./utils.mjs";

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".vite",
  "coverage",
]);

const CATEGORY_METADATA = Object.freeze({
  aiml: "AI and machine learning projects",
  "dev-tools": "Developer tools and utilities",
  editor: "Creative and document editing tools",
  "file-tools": "File processing and metadata tools",
  games: "Interactive games",
  instruments: "Virtual instruments",
  math: "Mathematical tools and visualizations",
  misc: "Miscellaneous experiments and utilities",
  productivity: "Productivity tools",
});

async function loadBuildConfig() {
  if (!(await isFile(CONFIG_FILE))) {
    return {
      defaultMode: DEFAULT_BUILD_MODE,
      overrides: {},
    };
  }

  const config = await readJson(CONFIG_FILE);

  return {
    defaultMode:
      config.defaultMode ?? DEFAULT_BUILD_MODE,

    overrides:
      config.overrides ?? {},
  };
}

function getOverride(config, projectPath) {
  const override = config.overrides?.[projectPath];

  if (!override) {
    return {};
  }

  if (typeof override === "string") {
    return {
      mode: override,
    };
  }

  return override;
}

function inferProjectMetadata(category, name) {
  return {
    category,
    name,
    description:
      CATEGORY_METADATA[category] ??
      "Cradle mini project",
  };
}

async function inspectProject(projectDir) {
  const entry = await findFirstExistingFile(
    getProjectEntryCandidates(projectDir),
  );

  const hasPackageJson = await isFile(
    path.join(projectDir, "package.json"),
  );

  const hasReadme = await isFile(
    path.join(projectDir, "README.md"),
  );

  const hasArchitecture = await isFile(
    path.join(projectDir, "ARCHITECTURE.md"),
  );

  return {
    entry,
    hasPackageJson,
    hasReadme,
    hasArchitecture,
  };
}

async function discoverCategory(category) {
  const categoryDir = path.join(
    PROJECTS_DIR,
    category,
  );

  if (!(await isDirectory(categoryDir))) {
    return [];
  }

  const entries = await readDirectory(categoryDir);

  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const projectDir = path.join(
      categoryDir,
      entry.name,
    );

    const projectPath = relativePath(
      PROJECTS_DIR,
      projectDir,
    );

    const metadata = inferProjectMetadata(
      category,
      entry.name,
    );

    const inspection = await inspectProject(
      projectDir,
    );

    projects.push({
      id: projectPath.replaceAll("/", ":"),
      path: projectPath,
      category,
      name: entry.name,
      absolutePath: projectDir,

      ...metadata,
      ...inspection,
    });
  }

  return projects;
}

export async function discoverMinis() {
  const config = await loadBuildConfig();

  const categories = await readDirectory(
    PROJECTS_DIR,
  );

  const minis = [];

  for (const categoryEntry of categories) {
    if (!categoryEntry.isDirectory()) {
      continue;
    }

    if (IGNORED_DIRECTORIES.has(categoryEntry.name)) {
      continue;
    }

    const categoryMinis = await discoverCategory(
      categoryEntry.name,
    );

    minis.push(...categoryMinis);
  }

  const resolved = minis.map((mini) => {
    const override = getOverride(
      config,
      mini.path,
    );

    const mode =
      override.mode ??
      config.defaultMode ??
      DEFAULT_BUILD_MODE;

    if (!SUPPORTED_BUILD_MODES.includes(mode)) {
      throw new Error(
        `Invalid build mode "${mode}" for ${mini.path}`,
      );
    }

    return {
      ...mini,
      mode,
    };
  });

  resolved.sort((a, b) =>
    a.path.localeCompare(b.path),
  );

  return resolved;
}

export async function findMini(projectPath) {
  const minis = await discoverMinis();

  const normalized = projectPath
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  return (
    minis.find(
      (mini) =>
        mini.path === normalized ||
        mini.name === normalized,
    ) ?? null
  );
}

export function summarizeMinis(minis) {
  const summary = {
    total: minis.length,
    static: 0,
    individual: 0,
    central: 0,
    categories: {},
  };

  for (const mini of minis) {
    summary[mini.mode] += 1;

    summary.categories[mini.category] ??= 0;
    summary.categories[mini.category] += 1;
  }

  return summary;
}

export async function main() {
  const minis = await discoverMinis();

  console.log(
    JSON.stringify(
      {
        minis: minis.map(
          ({
            absolutePath,
            ...mini
          }) => mini,
        ),
        summary: summarizeMinis(minis),
      },
      null,
      2,
    ),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(
      new URL(import.meta.url).pathname,
    )
) {
  await main();
}