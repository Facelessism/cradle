const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const PROJECTS_DIR = path.join(REPO_ROOT, "projects");
const PROJECTS_JSON = path.join(REPO_ROOT, "data", "projects.json");
const SHARED_BACK_TO_HOME_PATH = path.join(
  REPO_ROOT,
  "src",
  "components",
  "ui",
  "BackToHome",
  "BackToHome.js"
);

function getProjectDirectories() {
  const projectDirs = [];
  const categories = fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const cat of categories) {
    const catPath = path.join(PROJECTS_DIR, cat.name);
    const projects = fs
      .readdirSync(catPath, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const proj of projects) {
      projectDirs.push(path.join(catPath, proj.name));
    }
  }

  return projectDirs.sort();
}

test("shared BackToHome.js component file exists in src/components/ui/BackToHome", () => {
  assert.ok(
    fs.existsSync(SHARED_BACK_TO_HOME_PATH),
    "Expected BackToHome.js to exist at src/components/ui/BackToHome/BackToHome.js"
  );
});

test("every registered mini project includes the shared BackToHome navigation component", () => {
  const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON, "utf-8"));
  const missing = [];

  for (const project of projects) {
    const htmlPath = path.join(REPO_ROOT, project.path, "index.html");
    assert.ok(
      fs.existsSync(htmlPath),
      `Project "${project.title}" (${project.path}) is missing index.html`
    );

    const html = fs.readFileSync(htmlPath, "utf-8");
    const hasBackToHomeScript = /src=["'][^"']*BackToHome\.js["']/i.test(html);
    const hasUIBundle = /src=["'][^"']*components\/ui\/index\.js["']/i.test(
      html
    );
    const hasDataAttr = /data-cradle-back-to-home/i.test(html);

    if (!hasBackToHomeScript && !hasUIBundle && !hasDataAttr) {
      missing.push(project.path);
    }
  }

  assert.deepEqual(
    missing,
    [],
    `The following projects are missing the shared BackToHome navigation component:\n  ${missing.join(
      "\n  "
    )}`
  );
});

test("every mini project directory on disk includes the shared BackToHome navigation component", () => {
  const projectDirs = getProjectDirectories();
  const missing = [];

  for (const dir of projectDirs) {
    const htmlPath = path.join(dir, "index.html");
    if (!fs.existsSync(htmlPath)) {
      continue;
    }

    const html = fs.readFileSync(htmlPath, "utf-8");
    const hasBackToHomeScript = /src=["'][^"']*BackToHome\.js["']/i.test(html);
    const hasUIBundle = /src=["'][^"']*components\/ui\/index\.js["']/i.test(
      html
    );
    const hasDataAttr = /data-cradle-back-to-home/i.test(html);

    if (!hasBackToHomeScript && !hasUIBundle && !hasDataAttr) {
      const relPath = path.relative(REPO_ROOT, dir).replace(/\\/g, "/");
      missing.push(relPath);
    }
  }

  assert.deepEqual(
    missing,
    [],
    `The following disk projects are missing the shared BackToHome navigation component:\n  ${missing.join(
      "\n  "
    )}`
  );
});

test("BackToHome script src attributes in mini projects resolve to the actual component file", () => {
  const projectDirs = getProjectDirectories();
  const brokenLinks = [];

  for (const dir of projectDirs) {
    const htmlPath = path.join(dir, "index.html");
    if (!fs.existsSync(htmlPath)) continue;

    const html = fs.readFileSync(htmlPath, "utf-8");
    const match = html.match(/src=["']([^"']*BackToHome\.js)["']/i);
    if (match) {
      const scriptSrc = match[1];
      const resolved = scriptSrc.startsWith("/")
        ? path.join(REPO_ROOT, scriptSrc)
        : path.resolve(dir, scriptSrc);

      if (!fs.existsSync(resolved)) {
        const relPath = path.relative(REPO_ROOT, dir).replace(/\\/g, "/");
        brokenLinks.push(`${relPath}: unresolved src="${scriptSrc}"`);
      }
    }
  }

  assert.deepEqual(
    brokenLinks,
    [],
    `Broken BackToHome script references detected:\n  ${brokenLinks.join("\n  ")}`
  );
});
