const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("src/components/ui/index.js", "utf8");

const ALL_COMPONENT_PATHS = [
    "Button/Button.js",
    "Card/Card.js",
    "ThemeToggle/ThemeToggle.js",
    "Navbar/Navbar.js",
    "BackToHome/BackToHome.js",
];

const ALL_UTILITY_PATHS = ["escapeHtml.js", "storage.js"];

class MockScriptElement {
    constructor() {
        this.src = "";
        this.async = true;
        this.onload = null;
        this.onerror = null;
    }
}

/**
 * Builds a minimal mock `document`/`window` sufficient for index.js's
 * actual DOM surface: meta lookup, script[src] scanning, currentScript,
 * and appending <script> tags to <head>.
 *
 * @param {object} options
 * @param {string} [options.metaBaseUrl]      Value for <meta name="cradle-ui-base">
 * @param {string} [options.existingScriptSrc] A script[src] already on the page
 * @param {string} [options.currentScriptSrc]  document.currentScript.src
 * @param {string} [options.origin]            window.location.origin fallback
 * @param {string[]} [options.failUrls]        URLs whose script should call onerror
 */
function createHarness(options = {}) {
    const {
        metaBaseUrl,
        existingScriptSrc,
        currentScriptSrc,
        origin = "https://example.com",
        failUrls = [],
    } = options;

    const appendedScripts = [];

    const head = {
        appendChild(script) {
            appendedScripts.push(script);
            queueMicrotask(() => {
                if (failUrls.includes(script.src)) {
                    script.onerror && script.onerror(new Error("network failure"));
                } else {
                    script.onload && script.onload();
                }
            });
            return script;
        },
    };

    const document = {
        currentScript: currentScriptSrc ? { src: currentScriptSrc } : null,
        head,
        createElement(tagName) {
            assert.equal(tagName, "script");
            return new MockScriptElement();
        },
        querySelector(selector) {
            if (selector === 'meta[name="cradle-ui-base"]') {
                return metaBaseUrl
                    ? { getAttribute: () => metaBaseUrl }
                    : null;
            }

            const scriptMatch = selector.match(/^script\[src="(.+)"\]$/);
            if (scriptMatch) {
                const url = scriptMatch[1];
                if (existingScriptSrc === url) {
                    return { src: url };
                }
                return (
                    appendedScripts.find(s => s.src === url) || null
                );
            }

            return null;
        },
        querySelectorAll(selector) {
            if (selector === "script[src]" && existingScriptSrc) {
                return [{ src: existingScriptSrc }];
            }
            return [];
        },
    };

    const window = {
        document,
        location: { origin },
    };

    const context = vm.createContext({
        window,
        document,
        console,
    });

    vm.runInContext(source, context, { filename: "index.js" });

    return { api: window.CradleUI, document, appendedScripts };
}

/* -----------------------------
   resolveBase() strategies
----------------------------- */

test("uses the cradle-ui-base meta tag when present", () => {
    const { api } = createHarness({
        metaBaseUrl: "/custom/ui/base/",
    });

    assert.equal(api._baseUrl, "/custom/ui/base/");
});

test("appends a trailing slash to a meta base URL that lacks one", () => {
    const { api } = createHarness({
        metaBaseUrl: "/custom/ui/base",
    });

    assert.equal(api._baseUrl, "/custom/ui/base/");
});

test("falls back to scanning script[src] tags when there is no meta tag", () => {
    const { api } = createHarness({
        existingScriptSrc:
            "https://cdn.example.com/app/components/ui/index.js",
    });

    assert.equal(
        api._baseUrl,
        "https://cdn.example.com/app/components/ui/"
    );
});

test("falls back to document.currentScript when nothing else matches", () => {
    const { api } = createHarness({
        currentScriptSrc:
            "https://cdn.example.com/app/components/ui/index.js",
    });

    assert.equal(
        api._baseUrl,
        "https://cdn.example.com/app/components/ui/"
    );
});

test("falls back to window.location.origin as a last resort", () => {
    const { api } = createHarness({
        origin: "https://fallback.example.com",
    });

    assert.equal(
        api._baseUrl,
        "https://fallback.example.com/src/components/ui/"
    );
});

/* -----------------------------
   Loading behavior
----------------------------- */

test("loading the bundle auto-loads every component and utility exactly once", async () => {
    const { api, appendedScripts } = createHarness({
        metaBaseUrl: "/src/components/ui/",
    });

    await api.loadAll();

    const expectedUrls = [...ALL_COMPONENT_PATHS, ...ALL_UTILITY_PATHS].map(
        p => "/src/components/ui/" + p
    );

    const appendedUrls = appendedScripts.map(s => s.src);

    expectedUrls.forEach(url => {
        assert.equal(
            appendedUrls.filter(u => u === url).length,
            1,
            `expected exactly one <script> for ${url}`
        );
    });

    ["Button", "Card", "ThemeToggle", "Navbar", "BackToHome", "escapeHtml", "storage"].forEach(
        name => {
            assert.equal(api._loaded[name], true);
        }
    );
});

test("load() does not append a duplicate script for an already-cached component", async () => {
    const { api, appendedScripts } = createHarness({
        metaBaseUrl: "/src/components/ui/",
    });

    await api.load("Button");
    const countAfterFirstLoad = appendedScripts.length;

    await api.load("Button");

    assert.equal(appendedScripts.length, countAfterFirstLoad);
});

test("load() skips appending a script if one with the same URL already exists in the document", async () => {
    const { api, appendedScripts } = createHarness({
        metaBaseUrl: "/src/components/ui/",
        existingScriptSrc: "/src/components/ui/Card/Card.js",
    });

    await api.load("Card");

    assert.equal(
        appendedScripts.filter(s => s.src === "/src/components/ui/Card/Card.js")
            .length,
        0
    );
    assert.equal(api._loaded.Card, true);
});

test("load() warns and resolves for an unknown component name without touching the DOM", async () => {
    const { api, appendedScripts } = createHarness({
        metaBaseUrl: "/src/components/ui/",
    });

    const originalWarn = console.warn;
    let warned = null;
    console.warn = msg => {
        warned = msg;
    };

    await api.load("NotAComponent");

    console.warn = originalWarn;

    assert.match(warned, /Unknown component or utility/);
    assert.equal(
        appendedScripts.some(s => s.src.includes("NotAComponent")),
        false
    );
});

test("a script load failure during the automatic loadAll() is surfaced via console.error", async () => {
    const originalError = console.error;
    let capturedError = null;
    console.error = err => {
        capturedError = err;
    };

    createHarness({
        metaBaseUrl: "/src/components/ui/",
        failUrls: ["/src/components/ui/Navbar/Navbar.js"],
    });

    /* loadAll() runs fire-and-forget at module load; flush microtasks. */
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));

    console.error = originalError;

    /* capturedError was constructed inside the vm sandbox's own realm,
       so it isn't `instanceof` this file's Error — compare by message. */
    assert.ok(capturedError && typeof capturedError.message === "string");
    assert.match(capturedError.message, /Failed to load Navbar\/Navbar\.js/);
});