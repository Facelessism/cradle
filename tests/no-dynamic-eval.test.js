const test = require("node:test");
const assert = require("node:assert/strict");
const {
  maskComments,
  scanSource,
  scanRepo,
  SELF_FILENAME,
  TEST_FILENAME,
} = require("../scripts/validate-no-dynamic-eval.js");

function namesOf(source) {
  return scanSource(source).map(f => f.name);
}

test("scanSource flags eval()", () => {
  assert.ok(namesOf("function run() { eval(userInput); }").includes("eval()"));
});

test("scanSource flags new Function()", () => {
  const names = namesOf('const fn = new Function("return " + userInput);');
  assert.ok(names.includes("new Function()"));
});

test("scanSource flags bare Function() call", () => {
  assert.ok(namesOf("const fn = Function(code);").includes("Function() call"));
});

test("scanSource flags document.write and document.writeln", () => {
  assert.ok(namesOf("document.write(html);").includes("document.write()"));
  assert.ok(namesOf("document.writeln(html);").includes("document.write()"));
});

test("scanSource allows function-argument timers", () => {
  assert.equal(namesOf("setTimeout(() => go(), 100);").length, 0);
  assert.equal(namesOf("setInterval(tick, 1000);").length, 0);
});

test("scanSource flags string-argument timers", () => {
  assert.ok(
    namesOf('setTimeout("go()", 100);').includes("setTimeout string arg")
  );
  assert.ok(
    namesOf('setInterval("go()", 1000);').includes("setInterval string arg")
  );
});

test("scanSource allows literal importScripts", () => {
  assert.equal(namesOf('importScripts("worker-lib.js");').length, 0);
});

test("scanSource flags non-literal importScripts", () => {
  assert.ok(
    namesOf("importScripts(workerUrl);").includes("dynamic importScripts()")
  );
});

test("scanSource ignores mentions inside comments", () => {
  assert.equal(
    namesOf(
      "/* this docs eval() usage */\n// never call eval( here\nconst x = 1;"
    ).length,
    0
  );
});

test("scanSource flags javascript: URLs and data:text/html sources", () => {
  assert.ok(
    namesOf('<a href="javascript:alert(1)">x</a>').includes("javascript: URL")
  );
  assert.ok(
    namesOf(
      '<script src="data:text/html;base64,PHNjcmlwdD4="></script>'
    ).includes("data:text/html source")
  );
});

test("scanSource flags inline event handlers", () => {
  assert.ok(
    namesOf('<button onclick="doThing()">Go</button>').includes(
      "inline event handler"
    )
  );
});

test("scanSource does not treat // inside URLs as a comment", () => {
  assert.equal(namesOf('const url = "https://example.com/a";').length, 0);
});

test("maskComments masks comments while preserving newlines", () => {
  const masked = maskComments("a // c\nb\n/* multi\nline */ c");
  assert.equal(masked.split("\n").length, 4);
  assert.ok(!masked.includes("// c"));
  assert.ok(!masked.includes("multi"));
});

test("collectFiles skips the scanner and its own test file", () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const { collectFiles } = require("../scripts/validate-no-dynamic-eval.js");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eval-scan-"));
  try {
    fs.writeFileSync(path.join(tmp, "real.js"), "const a = 1;");
    fs.writeFileSync(path.join(tmp, "real.html"), "<p>hi</p>");
    fs.writeFileSync(path.join(tmp, SELF_FILENAME), "x");
    fs.writeFileSync(path.join(tmp, TEST_FILENAME), "y");
    const found = collectFiles(tmp, tmp).map(p => path.basename(p));
    assert.deepEqual(found.sort(), ["real.html", "real.js"]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("scanRepo finds no dynamic code execution in the repository", () => {
  const findings = scanRepo();
  assert.deepEqual(findings, []);
});
