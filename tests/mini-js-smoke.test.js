const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const REPO_ROOT = path.resolve(__dirname, "..");
const PROJECTS_JSON = path.join(REPO_ROOT, "data", "projects.json");

/**
 * Creates a mocked browser environment for evaluating scripts in Node.js VM context.
 */
function createBrowserSandbox() {
  const localStorageStore = new Map();
  const sessionStorageStore = new Map();

  const mockLocalStorage = {
    getItem: key =>
      localStorageStore.has(String(key))
        ? localStorageStore.get(String(key))
        : null,
    setItem: (key, val) => localStorageStore.set(String(key), String(val)),
    removeItem: key => localStorageStore.delete(String(key)),
    clear: () => localStorageStore.clear(),
    key: i => Array.from(localStorageStore.keys())[i] || null,
    get length() {
      return localStorageStore.size;
    },
  };

  const mockSessionStorage = {
    getItem: key =>
      sessionStorageStore.has(String(key))
        ? sessionStorageStore.get(String(key))
        : null,
    setItem: (key, val) => sessionStorageStore.set(String(key), String(val)),
    removeItem: key => sessionStorageStore.delete(String(key)),
    clear: () => sessionStorageStore.clear(),
    key: i => Array.from(sessionStorageStore.keys())[i] || null,
    get length() {
      return sessionStorageStore.size;
    },
  };

  const createDummyElement = (tagName = "div") => {
    const listeners = new Map();
    const attributes = new Map();
    const children = [];

    const styleObj = {
      setProperty: (prop, value) => {
        styleObj[prop] = String(value);
      },
      getPropertyValue: prop => styleObj[prop] || "",
      removeProperty: prop => {
        delete styleObj[prop];
      },
    };

    const elem = {
      tagName: String(tagName).toUpperCase(),
      id: "",
      className: "",
      innerHTML: "",
      textContent: "",
      innerText: "",
      value: "0",
      src: "",
      href: "",
      type: "",
      disabled: false,
      width: 800,
      height: 600,
      style: styleObj,
      dataset: {},
      children,
      childNodes: children,

      get content() {
        return {
          firstElementChild: createDummyElement("div"),
          lastElementChild: createDummyElement("div"),
          appendChild: c => c,
          cloneNode: () => createDummyElement("div"),
        };
      },

      cloneNode: () => createDummyElement(tagName),

      get firstElementChild() {
        if (children.length === 0) {
          children.push(createDummyElement("div"));
        }
        return children[0];
      },
      get lastElementChild() {
        if (children.length === 0) {
          children.push(createDummyElement("div"));
        }
        return children[children.length - 1];
      },
      get parentElement() {
        return createDummyElement("div");
      },
      get parentNode() {
        return createDummyElement("div");
      },

      classList: {
        add: (...names) => {
          const current = (elem.className || "").split(" ").filter(Boolean);
          names.forEach(n => {
            if (!current.includes(n)) current.push(n);
          });
          elem.className = current.join(" ");
        },
        remove: (...names) => {
          elem.className = (elem.className || "")
            .split(" ")
            .filter(n => Boolean(n) && !names.includes(n))
            .join(" ");
        },
        toggle: (name, force) => {
          const has = (elem.className || "").split(" ").includes(name);
          if (force === true || (!has && force === undefined)) {
            elem.classList.add(name);
            return true;
          } else {
            elem.classList.remove(name);
            return false;
          }
        },
        contains: name => (elem.className || "").split(" ").includes(name),
      },

      setAttribute: (name, val) => attributes.set(name, String(val)),
      getAttribute: name =>
        attributes.has(name) ? attributes.get(name) : null,
      removeAttribute: name => attributes.delete(name),
      hasAttribute: name => attributes.has(name),

      appendChild: child => {
        children.push(child);
        return child;
      },
      add: (child, before) => {
        if (before && children.includes(before)) {
          children.splice(children.indexOf(before), 0, child);
        } else {
          children.push(child);
        }
        return child;
      },
      removeChild: child => {
        const idx = children.indexOf(child);
        if (idx !== -1) children.splice(idx, 1);
        return child;
      },
      replaceChild: (newChild, oldChild) => {
        const idx = children.indexOf(oldChild);
        if (idx !== -1) children[idx] = newChild;
        return oldChild;
      },
      replaceWith: newChild => {
        if (elem.parentElement) {
          elem.parentElement.replaceChild(newChild, elem);
        }
      },
      remove: child => {
        if (child) {
          const idx = children.indexOf(child);
          if (idx !== -1) children.splice(idx, 1);
          return child;
        }
        if (elem.parentElement) {
          elem.parentElement.removeChild(elem);
        }
      },
      insertBefore: newChild => {
        children.unshift(newChild);
        return newChild;
      },
      insertAdjacentElement: (pos, el) => el,
      insertAdjacentHTML: () => {},
      insertAdjacentText: () => {},

      addEventListener: (evt, cb) => {
        if (!listeners.has(evt)) listeners.set(evt, []);
        listeners.get(evt).push(cb);
      },
      removeEventListener: (evt, cb) => {
        if (listeners.has(evt)) {
          const list = listeners.get(evt).filter(fn => fn !== cb);
          listeners.set(evt, list);
        }
      },
      dispatchEvent: evt => {
        const type = typeof evt === "string" ? evt : evt?.type;
        const list = listeners.get(type) || [];
        list.forEach(fn => {
          try {
            fn.call(elem, evt);
          } catch (e) {
            /* ignore handler errors */
          }
        });
        return true;
      },

      getBoundingClientRect: () => ({
        top: 0,
        left: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
      }),

      querySelector: () => createDummyElement("div"),
      querySelectorAll: () => [createDummyElement("div")],
      getElementsByTagName: () => [createDummyElement("div")],
      getElementsByClassName: () => [createDummyElement("div")],

      getContext: () => ({
        fillRect: () => {},
        clearRect: () => {},
        strokeRect: () => {},
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        fillText: () => {},
        strokeText: () => {},
        measureText: () => ({ width: 50, height: 10 }),
        drawImage: () => {},
        save: () => {},
        restore: () => {},
        scale: () => {},
        translate: () => {},
        rotate: () => {},
        transform: () => {},
        setTransform: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
        createPattern: () => ({}),
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        putImageData: () => {},
        createImageData: () => ({ data: new Uint8ClampedArray(4) }),
      }),

      click: () => {},
      focus: () => {},
      blur: () => {},
      toDataURL: () => "data:image/png;base64,",
    };

    return elem;
  };

  const documentMock = {
    body: createDummyElement("body"),
    head: createDummyElement("head"),
    documentElement: createDummyElement("html"),
    title: "Mini Project",
    activeElement: createDummyElement("body"),
    cookie: "",

    createElement: tag => createDummyElement(tag),
    createElementNS: (ns, tag) => createDummyElement(tag),
    getElementById: () => createDummyElement("div"),
    querySelector: () => createDummyElement("div"),
    querySelectorAll: () => [createDummyElement("div")],
    getElementsByClassName: () => [createDummyElement("div")],
    getElementsByTagName: () => [createDummyElement("div")],
    getElementsByName: () => [createDummyElement("div")],

    addEventListener: (evt, cb) => {
      if (evt === "DOMContentLoaded" || evt === "load") {
        try {
          cb({ type: evt });
        } catch (e) {
          throw e;
        }
      }
    },
    removeEventListener: () => {},
    dispatchEvent: () => true,
    createEvent: () => ({ initEvent: () => {} }),
    createRange: () => ({
      selectNodeContents: () => {},
      setStart: () => {},
      setEnd: () => {},
    }),
  };

  const locationMock = {
    href: "http://localhost/",
    origin: "http://localhost",
    protocol: "http:",
    host: "localhost",
    hostname: "localhost",
    port: "",
    pathname: "/",
    search: "",
    hash: "",
    reload: () => {},
    replace: () => {},
    assign: () => {},
  };

  const dummyFunc = () => {};
  const dummyObj = new Proxy(
    {},
    {
      get: (target, prop) => (prop === "prototype" ? {} : dummyFunc),
    }
  );

  const createJQueryMock = () => {
    const jq = selector => {
      if (typeof selector === "function") {
        try {
          selector();
        } catch (e) {
          throw e;
        }
      }
      const el = createDummyElement("div");
      el.ready = cb => {
        try {
          cb();
        } catch (e) {
          throw e;
        }
      };
      el.on = () => el;
      el.off = () => el;
      el.css = () => el;
      el.val = () => "0";
      el.html = () => el;
      el.text = () => el;
      el.addClass = () => el;
      el.removeClass = () => el;
      el.toggleClass = () => el;
      el.attr = () => "";
      el.prop = () => false;
      el.mousedown = () => el;
      el.mouseup = () => el;
      el.mousemove = () => el;
      el.click = () => el;
      el.change = () => el;
      el.input = () => el;
      el.keydown = () => el;
      el.keyup = () => el;
      return el;
    };
    jq.ready = cb => cb();
    jq.fn = {};
    jq.ajax = async () => ({});
    jq.get = async () => ({});
    jq.post = async () => ({});
    return jq;
  };

  const jqueryStub = createJQueryMock();

  const sandbox = {
    console,
    localStorage: mockLocalStorage,
    sessionStorage: mockSessionStorage,
    location: locationMock,
    navigator: {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NodeSmokeTest",
      clipboard: {
        writeText: async () => {},
        readText: async () => "",
      },
    },
    document: documentMock,
    addEventListener: (evt, cb) => {
      if (evt === "DOMContentLoaded" || evt === "load") {
        try {
          cb({ type: evt });
        } catch (e) {
          throw e;
        }
      }
    },
    removeEventListener: () => {},
    dispatchEvent: () => true,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    getComputedStyle: () => ({
      getPropertyValue: () => "",
      width: "800px",
      height: "600px",
    }),
    matchMedia: () => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }),
    alert: () => {},
    prompt: () => null,
    confirm: () => true,
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "",
    }),
    AudioContext: class {
      createGain() {
        return {
          gain: { value: 1, setValueAtTime: () => {} },
          connect: () => {},
        };
      }
      createOscillator() {
        return {
          type: "",
          frequency: { value: 440, setValueAtTime: () => {} },
          connect: () => {},
          start: () => {},
          stop: () => {},
        };
      }
      createAnalyser() {
        return {
          fftSize: 2048,
          frequencyBinCount: 1024,
          getByteFrequencyData: () => {},
          getByteTimeDomainData: () => {},
          connect: () => {},
        };
      }
    },
    webkitAudioContext: class {},
    Audio: class {
      play() {}
      pause() {}
      addEventListener() {}
    },
    Image: class {
      addEventListener() {}
      set src(v) {}
    },
    Worker: class {
      constructor(url) {
        this.url = url;
        this.onmessage = null;
        this.onerror = null;
      }
      postMessage() {}
      terminate() {}
      addEventListener() {}
      removeEventListener() {}
    },
    RTCPeerConnection: class {
      constructor() {
        this.localDescription = null;
        this.connectionState = "new";
        this.onicecandidate = null;
        this.ondatachannel = null;
        this.onconnectionstatechange = null;
      }
      createDataChannel() {
        return {
          readyState: "connecting",
          send: () => {},
          close: () => {},
          addEventListener: () => {},
        };
      }
      createOffer() {
        return Promise.resolve({ type: "offer", sdp: "" });
      }
      createAnswer() {
        return Promise.resolve({ type: "answer", sdp: "" });
      }
      setLocalDescription() {
        return Promise.resolve();
      }
      setRemoteDescription() {
        return Promise.resolve();
      }
    },
    Option: class {
      constructor(text = "", value = "") {
        this.text = text;
        this.value = value;
        this.selected = false;
      }
    },
    XMLSerializer: class {
      serializeToString() {
        return "<svg></svg>";
      }
    },
    DOMParser: class {
      parseFromString() {
        return documentMock;
      }
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    IntersectionObserver: class {
      observe() {}
      disconnect() {}
    },
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    Event: class {
      constructor(type) {
        this.type = type;
      }
    },
    CustomEvent: class {
      constructor(type, detail) {
        this.type = type;
        this.detail = detail;
      }
    },
    FileReader: class {
      readAsDataURL() {}
      readAsText() {}
      addEventListener() {}
    },
    Blob: class {},
    URL: { createObjectURL: () => "blob:mock", revokeObjectURL: () => {} },
    FormData: class {
      append() {}
    },
    // External CDN stub proxies
    Chart: dummyObj,
    marked: {
      parse: () => "",
      setOptions: () => {},
      use: () => {},
      Renderer: class {},
    },
    QRCodeStyling: dummyObj,
    jQuery: jqueryStub,
    $: jqueryStub,
    tf: {
      loadLayersModel: async () => ({
        predict: () => ({ dataSync: () => [] }),
      }),
      sequential: () => ({ add: () => {} }),
    },
    mobilenet: { load: async () => ({ classify: async () => [] }) },
    knnClassifier: {
      create: () => ({
        addExample: () => {},
        predictClass: async () => ({ label: "0" }),
      }),
    },
  };

  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  return vm.createContext(sandbox);
}

/**
 * Extracts script tags (both inline and src) in order of appearance from HTML content.
 */
function parseScriptElements(htmlContent) {
  const scripts = [];
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(htmlContent)) !== null) {
    const attributes = match[1];
    const inlineContent = match[2];
    const srcMatch = /src=["']([^"']+)["']/i.exec(attributes);

    if (srcMatch) {
      scripts.push({ type: "src", value: srcMatch[1] });
    } else if (inlineContent.trim()) {
      scripts.push({ type: "inline", value: inlineContent });
    }
  }

  return scripts;
}

/**
 * Matches a static ES module import statement on a single line. Side-effect
 * imports, default imports, namespace imports, and named imports all include
 * a quoted module specifier, which is the only part the smoke loader needs.
 */
const MODULE_IMPORT_RE =
  /^[ \t]*import\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["'][ \t]*;?[ \t]*$/gm;

function isLocalModuleSpecifier(specifier) {
  return (
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("/")
  );
}

function resolveModulePath(specifier, baseDir) {
  if (!isLocalModuleSpecifier(specifier)) return null;
  const absPath = path.resolve(baseDir, specifier);
  if (fs.existsSync(absPath)) return absPath;
  if (!path.extname(absPath) && fs.existsSync(`${absPath}.js`)) {
    return `${absPath}.js`;
  }
  return absPath;
}

function transformModuleSource(code) {
  let executableCode = code.replace(MODULE_IMPORT_RE, "");
  if (
    /\bexport\s+(default|const|let|var|function|class|\{)/.test(executableCode)
  ) {
    executableCode = executableCode
      .replace(/\bexport\s+default\s+/g, "")
      .replace(/\bexport\s+(?=(const|let|var|function|class|\{))/g, "");
  }
  return executableCode.replace(/^(const|let)\s+/gm, "var ");
}

/**
 * Evaluates one script in the shared VM context. Local imports are resolved
 * recursively before the importer runs, so exported classes and functions are
 * available as top-level bindings in the same context. Bare and external
 * specifiers are skipped because the smoke test does not load CDN modules.
 */
function executeScriptSource({
  code,
  identifier,
  baseDir,
  context,
  loadedModules,
  errors,
}) {
  const importRegex = new RegExp(MODULE_IMPORT_RE.source, "gm");
  let dependencyFailed = false;
  let match;

  while ((match = importRegex.exec(code)) !== null) {
    const specifier = match[1];
    const modulePath = resolveModulePath(specifier, baseDir);
    if (!modulePath) continue;

    if (loadedModules.has(modulePath)) continue;

    if (!fs.existsSync(modulePath)) {
      errors.push(
        `JS Error in ${identifier}:\n  Error: Imported module not found: "${specifier}"`
      );
      dependencyFailed = true;
      continue;
    }

    loadedModules.add(modulePath);
    const dependencyCode = fs.readFileSync(modulePath, "utf-8");
    const dependencyOk = executeScriptSource({
      code: dependencyCode,
      identifier: path.relative(REPO_ROOT, modulePath),
      baseDir: path.dirname(modulePath),
      context,
      loadedModules,
      errors,
    });

    if (!dependencyOk) dependencyFailed = true;
  }

  if (dependencyFailed) return false;

  const executableCode = transformModuleSource(code);

  try {
    const script = new vm.Script(executableCode, {
      filename: identifier,
    });
    script.runInContext(context);
    return true;
  } catch (err) {
    errors.push(`JS Error in ${identifier}:\n  ${err.name}: ${err.message}`);
    return false;
  }
}

test("Smoke test: every mini project loads without JS errors", () => {
  assert.ok(fs.existsSync(PROJECTS_JSON), "data/projects.json must exist");
  const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON, "utf-8"));
  assert.ok(
    Array.isArray(projects) && projects.length > 0,
    "data/projects.json must contain projects"
  );

  const errors = [];

  for (const project of projects) {
    const projectDir = path.join(REPO_ROOT, project.path);
    const htmlPath = path.join(projectDir, "index.html");

    if (!fs.existsSync(htmlPath)) {
      errors.push(`${project.title} (${project.path}): index.html not found`);
      continue;
    }

    const htmlContent = fs.readFileSync(htmlPath, "utf-8");
    const scriptElements = parseScriptElements(htmlContent);

    if (scriptElements.length === 0) {
      const defaultScriptPath = path.join(projectDir, "script.js");
      if (fs.existsSync(defaultScriptPath)) {
        scriptElements.push({ type: "src", value: "script.js" });
      }
    }

    const context = createBrowserSandbox();
    const loadedModules = new Set();

    for (const scriptElem of scriptElements) {
      let code = "";
      let scriptIdentifier = "";
      let baseDir = projectDir;

      if (scriptElem.type === "src") {
        const srcUrl = scriptElem.value.trim();

        if (/^(https?:)?\/\//i.exec(srcUrl)) {
          continue;
        }

        const cleanSrc = srcUrl.split("#")[0].split("?")[0];
        const scriptAbsPath = path.resolve(projectDir, cleanSrc);

        if (!fs.existsSync(scriptAbsPath)) {
          errors.push(
            `${project.title}: Referenced script not found: "${srcUrl}"`
          );
          continue;
        }

        if (loadedModules.has(scriptAbsPath)) {
          continue;
        }
        loadedModules.add(scriptAbsPath);

        code = fs.readFileSync(scriptAbsPath, "utf-8");
        scriptIdentifier = path.relative(REPO_ROOT, scriptAbsPath);
        baseDir = path.dirname(scriptAbsPath);
      } else {
        code = scriptElem.value;
        scriptIdentifier = `${project.title} (inline script)`;
      }

      executeScriptSource({
        code,
        identifier: scriptIdentifier,
        baseDir,
        context,
        loadedModules,
        errors,
      });
    }
  }

  if (errors.length > 0) {
    assert.fail(
      `Encountered ${
        errors.length
      } JS load error(s) across mini projects:\n\n${errors.join("\n\n")}`
    );
  }
});
