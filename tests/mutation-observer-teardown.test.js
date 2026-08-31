import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const stringOverlayPath = path.resolve('projects/instruments/guitar/stringOverlay.js');
const stringOverlayCode = fs.readFileSync(stringOverlayPath, 'utf8');

function createDOMEnvironment() {
  const elements = new Map();
  const windowListeners = new Map();
  let disconnectCount = 0;
  let observeCount = 0;
  let observedElements = [];

  class MockMutationObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe(target, options) {
      observeCount++;
      observedElements.push({ target, options });
    }
    disconnect() {
      disconnectCount++;
      observedElements = [];
    }
  }

  function createElementMock(id, tag = 'div') {
    const el = {
      id,
      tagName: tag.toUpperCase(),
      classList: {
        contains: (c) => false,
        add: () => {},
        remove: () => {},
        toggle: () => {},
      },
      getAttribute: () => null,
      setAttribute: () => {},
      getBoundingClientRect: () => ({ top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100 }),
      dataset: {},
      appendChild: () => {},
      innerHTML: '',
      querySelectorAll: (sel) => {
        if (sel === 'span') return [createElementMock('pin0'), createElementMock('pin1')];
        return [];
      },
      querySelector: () => null,
    };
    return el;
  }

  const guitarEl = createElementMock('guitar');
  const neckEl = createElementMock('guitarNeck');
  const svgEl = createElementMock('stringOverlay', 'svg');
  const bridgePinsEl = createElementMock('bridgePins');
  const stringBtn0 = createElementMock('str0', 'button');
  const stringBtn1 = createElementMock('str1', 'button');

  const documentMock = {
    readyState: 'complete',
    getElementById: (id) => {
      if (id === 'guitar') return guitarEl;
      if (id === 'guitarNeck') return neckEl;
      if (id === 'stringOverlay') return svgEl;
      if (id === 'bridgePins') return bridgePinsEl;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === '#strings .string') return [stringBtn0, stringBtn1];
      return [];
    },
    querySelector: () => null,
    createElementNS: (ns, tag) => createElementMock(tag, tag),
    addEventListener: () => {},
    removeEventListener: () => {},
    fonts: { ready: Promise.resolve() },
  };

  const windowMock = {
    addEventListener: (type, handler) => {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(handler);
    },
    removeEventListener: (type, handler) => {
      if (windowListeners.has(type)) {
        const list = windowListeners.get(type).filter((h) => h !== handler);
        windowListeners.set(type, list);
      }
    },
    getComputedStyle: () => ({
      getPropertyValue: () => '3px',
    }),
    setTimeout: (fn) => fn(),
  };

  const sandbox = {
    document: documentMock,
    window: windowMock,
    MutationObserver: MockMutationObserver,
    getComputedStyle: windowMock.getComputedStyle,
    setTimeout: windowMock.setTimeout,
    Array,
    String,
    Promise,
    console,
  };

  windowMock.window = windowMock;
  sandbox.globalThis = sandbox;

  vm.runInNewContext(stringOverlayCode, sandbox);

  return {
    window: windowMock,
    sandbox,
    getObserveCount: () => observeCount,
    getDisconnectCount: () => disconnectCount,
    getObservedElements: () => observedElements,
    getListenerCount: (type) => (windowListeners.get(type) || []).length,
  };
}

describe('Issue #845 — MutationObserver Lifecycle & Teardown Cleanup', () => {
  it('1. MutationObserver is created and observes element attribute changes on init', () => {
    const env = createDOMEnvironment();
    assert.strictEqual(env.getObserveCount(), 2);
  });

  it('2. Disconnect is called when cleanup() is executed', () => {
    const env = createDOMEnvironment();
    const disconnectsBefore = env.getDisconnectCount();

    // Call exposed cleanup method
    env.window.GuitarStringOverlayCleanup();

    const disconnectsAfter = env.getDisconnectCount();
    assert.strictEqual(disconnectsAfter, disconnectsBefore + 1);
  });

  it('3. Re-initialization disconnects existing MutationObserver before creating a new one', () => {
    const env = createDOMEnvironment();
    const disconnectsBefore = env.getDisconnectCount();

    // Re-init
    env.window.GuitarStringOverlay.init();

    const disconnectsAfter = env.getDisconnectCount();
    assert.strictEqual(disconnectsAfter > disconnectsBefore, true);
  });

  it('4. Cleanup removes window event listeners on component teardown', () => {
    const env = createDOMEnvironment();
    assert.strictEqual(env.getListenerCount('resize'), 1);

    env.window.GuitarStringOverlay.cleanup();

    assert.strictEqual(env.getListenerCount('resize'), 0);
    assert.strictEqual(env.getListenerCount('orientationchange'), 0);
  });
});
