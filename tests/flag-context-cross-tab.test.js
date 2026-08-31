import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const flagContextPath = path.resolve('projects/dev-tools/feature-flag-playground/src/context/FlagContext.js');
const rawCode = fs.readFileSync(flagContextPath, 'utf8');

// Strip ES module imports/exports and JSX for vm context execution
const executableCode = rawCode
  .replace(/import\s+React,\s*\{\s*createContext,\s*useState,\s*useEffect\s*\}\s+from\s+['"]react['"];?/g, '')
  .replace(/import\s+flagStorage\s+from\s+['"][^'"]+['"];?/g, '')
  .replace(/export\s+const\s+/g, 'const ')
  .replace(/export\s+function\s+/g, 'function ')
  .replace(/<FlagContext\.Provider[\s\S]*?<\/FlagContext\.Provider>/g, 'React.createElement(FlagContext.Provider, { value: { flags, updateFlag } }, children)');

function createFlagContextHarness(initialStorage = {}) {
  const storageStore = { ...initialStorage };
  const storageSetItemCalls = [];
  const windowListeners = new Map();

  const flagStorageMock = {
    getItem: (key) => storageStore[key] ?? null,
    setItem: (key, val) => {
      storageStore[key] = String(val);
      storageSetItemCalls.push({ key, value: String(val) });
    },
    removeItem: (key) => {
      delete storageStore[key];
    },
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
  };

  let currentState = null;
  let effectCleanup = null;

  const ReactMock = {
    createElement: (type, props, children) => ({ type, props, children }),
    createContext: () => ({ Provider: ({ value }) => value }),
    useState: (initial) => {
      if (currentState === null) {
        currentState = typeof initial === 'function' ? initial() : initial;
      }
      const setState = (updater) => {
        currentState = typeof updater === 'function' ? updater(currentState) : updater;
      };
      return [currentState, setState];
    },
    useEffect: (effect) => {
      effectCleanup = effect();
    },
  };

  const sandbox = {
    React: ReactMock,
    createContext: ReactMock.createContext,
    useState: ReactMock.useState,
    useEffect: ReactMock.useEffect,
    flagStorage: flagStorageMock,
    window: windowMock,
    console,
    Date,
    JSON,
    Boolean,
  };

  const exportsObj = vm.runInNewContext(executableCode + ';\n;({ FlagProvider, DEFAULT_FLAGS, FAIL_CLOSED_FLAGS });', sandbox);

  // Instantiate provider component
  const providerResult = sandbox.FlagProvider({ children: null });

  return {
    getFlags: () => currentState,
    updateFlag: providerResult.props.value.updateFlag,
    dispatchStorageEvent: (eventObj) => {
      const handlers = windowListeners.get('storage') || [];
      handlers.forEach((fn) => fn(eventObj));
    },
    getStorageSetItemCalls: () => storageSetItemCalls,
    getListenerCount: () => (windowListeners.get('storage') || []).length,
    cleanup: () => {
      if (typeof effectCleanup === 'function') {
        effectCleanup();
      }
    },
    DEFAULT_FLAGS: exportsObj.DEFAULT_FLAGS,
  };
}

describe('Issue #849 — Cross-Tab localStorage Conflict Resolution', () => {
  it('1. Valid cross-tab storage event updates in-memory flags state', () => {
    const harness = createFlagContextHarness();
    assert.strictEqual(harness.getFlags().enableBetaScanner, false);

    const incomingUpdate = {
      enableBetaScanner: true,
      enableAdvancedMetrics: true,
      enableDarkThemePreview: true,
      _updatedAt: 1000,
    };

    harness.dispatchStorageEvent({
      key: 'openprep_flags_playground',
      newValue: JSON.stringify(incomingUpdate),
    });

    const updatedFlags = harness.getFlags();
    assert.strictEqual(updatedFlags.enableBetaScanner, true);
    assert.strictEqual(updatedFlags.enableDarkThemePreview, true);
    assert.strictEqual(updatedFlags._updatedAt, 1000);
  });

  it('2. Invalid or malformed cross-tab storage event is safely ignored', () => {
    const harness = createFlagContextHarness();
    const originalFlags = harness.getFlags();

    // Malformed JSON string
    harness.dispatchStorageEvent({
      key: 'openprep_flags_playground',
      newValue: '{ corrupted JSON payload: [',
    });

    assert.deepStrictEqual(harness.getFlags(), originalFlags);

    // Invalid non-object shape (array or primitive)
    harness.dispatchStorageEvent({
      key: 'openprep_flags_playground',
      newValue: JSON.stringify(['invalid', 'array']),
    });

    assert.deepStrictEqual(harness.getFlags(), originalFlags);
  });

  it('3. Stale cross-tab update (older timestamp) is rejected', () => {
    const harness = createFlagContextHarness();

    // Tab A performs a local update at timestamp t=2000
    harness.updateFlag('enableBetaScanner', true);
    const flagsAfterUpdate = harness.getFlags();
    const localTimestamp = flagsAfterUpdate._updatedAt;
    assert.strictEqual(flagsAfterUpdate.enableBetaScanner, true);
    assert.strictEqual(localTimestamp > 0, true);

    // Incoming event from Tab B with an older timestamp t = localTimestamp - 500
    const staleUpdate = {
      enableBetaScanner: false,
      enableAdvancedMetrics: false,
      enableDarkThemePreview: false,
      _updatedAt: localTimestamp - 500,
    };

    harness.dispatchStorageEvent({
      key: 'openprep_flags_playground',
      newValue: JSON.stringify(staleUpdate),
    });

    // Stale update must be rejected; local state remains enabled
    assert.strictEqual(harness.getFlags().enableBetaScanner, true);
    assert.strictEqual(harness.getFlags()._updatedAt, localTimestamp);
  });

  it('4. Winning external update (newer timestamp) overwrites local state', () => {
    const harness = createFlagContextHarness();
    harness.updateFlag('enableBetaScanner', true);
    const localTimestamp = harness.getFlags()._updatedAt;

    const winningUpdate = {
      enableBetaScanner: false,
      enableAdvancedMetrics: false,
      enableDarkThemePreview: true,
      _updatedAt: localTimestamp + 5000,
    };

    harness.dispatchStorageEvent({
      key: 'openprep_flags_playground',
      newValue: JSON.stringify(winningUpdate),
    });

    const flags = harness.getFlags();
    assert.strictEqual(flags.enableBetaScanner, false);
    assert.strictEqual(flags.enableDarkThemePreview, true);
    assert.strictEqual(flags._updatedAt, localTimestamp + 5000);
  });

  it('5. Processing a storage event does not invoke write-back (setItem) loop', () => {
    const harness = createFlagContextHarness();
    const callsBefore = harness.getStorageSetItemCalls().length;

    harness.dispatchStorageEvent({
      key: 'openprep_flags_playground',
      newValue: JSON.stringify({
        enableBetaScanner: true,
        enableAdvancedMetrics: true,
        enableDarkThemePreview: false,
        _updatedAt: 5000,
      }),
    });

    const callsAfter = harness.getStorageSetItemCalls().length;
    assert.strictEqual(callsAfter, callsBefore);
  });

  it('6. Cleared storage key (newValue === null) resets flags to default safely', () => {
    const harness = createFlagContextHarness();
    harness.updateFlag('enableBetaScanner', true);

    harness.dispatchStorageEvent({
      key: 'openprep_flags_playground',
      newValue: null,
    });

    assert.strictEqual(harness.getFlags().enableBetaScanner, false);
    assert.strictEqual(harness.getFlags().enableAdvancedMetrics, true);
  });

  it('7. Storage event listener is cleaned up when unmounted', () => {
    const harness = createFlagContextHarness();
    assert.strictEqual(harness.getListenerCount(), 1);

    harness.cleanup();
    assert.strictEqual(harness.getListenerCount(), 0);
  });
});
