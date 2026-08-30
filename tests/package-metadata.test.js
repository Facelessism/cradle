const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, "package.json");
const NVMRC_PATH = path.join(ROOT_DIR, ".nvmrc");
const NODE_VERSION_PATH = path.join(ROOT_DIR, ".node-version");

test("package.json declares supported Node.js and npm runtime versions in engines", () => {
  assert.ok(fs.existsSync(PACKAGE_JSON_PATH), "package.json must exist");
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));

  assert.ok(pkg.engines, "package.json must have an engines field");
  assert.ok(pkg.engines.node, "package.json must declare engines.node");
  assert.match(
    pkg.engines.node,
    />=\s*20/,
    "engines.node must support Node.js >=20"
  );
  assert.ok(pkg.engines.npm, "package.json must declare engines.npm");
});

test(".nvmrc and .node-version files declare supported Node version", () => {
  assert.ok(fs.existsSync(NVMRC_PATH), ".nvmrc file must exist");
  const nvmrcContent = fs.readFileSync(NVMRC_PATH, "utf8").trim();
  assert.equal(nvmrcContent, "24", ".nvmrc must specify Node.js version 24");

  assert.ok(fs.existsSync(NODE_VERSION_PATH), ".node-version file must exist");
  const nodeVersionContent = fs.readFileSync(NODE_VERSION_PATH, "utf8").trim();
  assert.equal(
    nodeVersionContent,
    "24",
    ".node-version must specify Node.js version 24"
  );
});

test("package.json provides check-format script and includes it in healthcheck", () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
  assert.ok(pkg.scripts, "package.json must contain scripts");
  assert.equal(
    pkg.scripts["check-format"],
    "prettier --check .",
    "check-format script must run prettier check"
  );
  assert.ok(
    pkg.scripts.healthcheck.includes("npm run check-format"),
    "healthcheck script must include check-format"
  );
});

test("CI workflows include Prettier format verification", () => {
  const testWorkflowPath = path.join(
    ROOT_DIR,
    ".github",
    "workflows",
    "test.yml"
  );
  assert.ok(fs.existsSync(testWorkflowPath), "test.yml workflow must exist");
  const testWorkflowContent = fs.readFileSync(testWorkflowPath, "utf8");
  assert.match(
    testWorkflowContent,
    /npm run check-format/,
    "test.yml workflow must run Prettier verification"
  );
});
