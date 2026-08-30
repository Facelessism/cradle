const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const storageSource = fs.readFileSync("src/components/ui/storage.js", "utf8");
const bootstrapMatch = html.match(
  /<script>\s*\(function \(\) \{[\s\S]*?\}\)\(\);\s*<\/script>/
);

assert.ok(bootstrapMatch, "index.html must contain the early theme bootstrap");

function runBootstrap({ storedTheme = null, systemLight = false, defineLocalStorage = true } = {}) {
  const documentElement = {
    classList: {
      added: [],
      add(name) { this.added.push(name); },
    },
  };
  const contextObject = {
    window: {},
    document: { documentElement },
  };

  if (defineLocalStorage) {
    const values = new Map(storedTheme ? [["theme", storedTheme]] : []);
    contextObject.window.localStorage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key),
    };
  }

  contextObject.window.matchMedia = () => ({ matches: systemLight });
  if (defineLocalStorage) contextObject.localStorage = contextObject.window.localStorage;
  const context = vm.createContext(contextObject);

  vm.runInContext(storageSource, context, { filename: "storage.js" });
  vm.runInContext(bootstrapMatch[0].replace(/<script>|<\/script>/g, ""), context);
  return { documentElement };
}

test("landing theme bootstrap reads theme through CradleStorage", () => {
  const { documentElement } = runBootstrap({ storedTheme: "light", systemLight: false });
  assert.deepEqual(documentElement.classList.added, ["light-theme"]);
});

test("landing theme bootstrap falls back to system preference", () => {
  const { documentElement } = runBootstrap({ storedTheme: null, systemLight: true });
  assert.deepEqual(documentElement.classList.added, ["light-theme"]);
});

test("landing theme bootstrap does not throw when browser storage is unavailable", () => {
  const { documentElement } = runBootstrap({ systemLight: true, defineLocalStorage: false });
  assert.deepEqual(documentElement.classList.added, ["light-theme"]);
});
