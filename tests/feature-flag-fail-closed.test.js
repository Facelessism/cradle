import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const flagEnginePath = path.resolve('projects/dev-tools/feature-flag-playground/flagEngine.js');
const flagEngineCode = fs.readFileSync(flagEnginePath, 'utf8');

function createSandbox(storageMock) {
  const sandbox = {
    console: {
      log: () => {},
      error: () => {},
      warn: () => {},
    },
    Date,
    Math,
    Array,
    Object,
    Number,
    String,
    Boolean,
    JSON,
    isNaN,
    localStorage: storageMock,
  };
  return vm.runInNewContext(flagEngineCode + ';\nFlagEngine;', sandbox);
}

describe('Issue #850 — Feature Flag Fail-Closed Behavior', () => {
  it('1. Valid enabled flag still evaluates as enabled', () => {
    const validFlag = {
      id: '1',
      key: 'valid-enabled',
      name: 'Valid Enabled',
      environments: {
        development: { enabled: true, rollout: 100 },
      },
    };
    const storageMock = {
      getItem: (key) => (key === 'cradle-feature-flags' ? JSON.stringify([validFlag]) : null),
      setItem: () => {},
    };
    const FlagEngine = createSandbox(storageMock);
    const flags = FlagEngine.getFlags();
    assert.strictEqual(flags.length, 1);
    const result = FlagEngine.evaluate(flags[0], 'development', 'user-123');
    assert.strictEqual(result.on, true);
    assert.notStrictEqual(result.bucket, null);
  });

  it('2. Valid disabled flag still evaluates as disabled', () => {
    const validDisabledFlag = {
      id: '2',
      key: 'valid-disabled',
      name: 'Valid Disabled',
      environments: {
        development: { enabled: false, rollout: 0 },
      },
    };
    const storageMock = {
      getItem: (key) => (key === 'cradle-feature-flags' ? JSON.stringify([validDisabledFlag]) : null),
      setItem: () => {},
    };
    const FlagEngine = createSandbox(storageMock);
    const flags = FlagEngine.getFlags();
    assert.strictEqual(flags.length, 1);
    const result = FlagEngine.evaluate(flags[0], 'development', 'user-123');
    assert.strictEqual(result.on, false);
    assert.strictEqual(result.bucket, null);
  });

  it('3. Missing flag state in clean storage preserves existing initial demo defaults', () => {
    const storageMock = {
      getItem: () => null,
      setItem: () => {},
    };
    const FlagEngine = createSandbox(storageMock);
    const flags = FlagEngine.getFlags();
    assert.strictEqual(Array.isArray(flags), true);
    assert.strictEqual(flags.length > 0, true);
  });

  it('4. localStorage/storage read failure results in disabled/false (empty flags list)', () => {
    const storageMock = {
      getItem: () => {
        throw new Error('SecurityError: localStorage access is denied.');
      },
      setItem: () => {},
    };
    const FlagEngine = createSandbox(storageMock);
    const flags = FlagEngine.getFlags();
    assert.strictEqual(flags.length, 0);
  });

  it('5. Malformed persisted feature-flag JSON results in disabled/false (empty flags list)', () => {
    const storageMock = {
      getItem: () => '{ corrupted_json: [ unclosed ',
      setItem: () => {},
    };
    const FlagEngine = createSandbox(storageMock);
    const flags = FlagEngine.getFlags();
    assert.strictEqual(flags.length, 0);
  });

  it('6. Invalid feature-flag structure/value results in disabled/false', () => {
    const storageMock = {
      getItem: () => JSON.stringify({ notAnArray: true }),
      setItem: () => {},
    };
    const FlagEngine = createSandbox(storageMock);
    const flags = FlagEngine.getFlags();
    assert.strictEqual(flags.length, 0);

    // Also verify evaluation on malformed flag objects
    const malformedFlagNoEnvs = { id: '3', key: 'bad-flag' };
    const evalResult = FlagEngine.evaluate(malformedFlagNoEnvs, 'development', 'user-123');
    assert.strictEqual(evalResult.on, false);
    assert.strictEqual(evalResult.bucket, null);
  });

  it('7. Feature-flag evaluation error results in disabled/false', () => {
    const storageMock = {
      getItem: () => null,
      setItem: () => {},
    };
    const FlagEngine = createSandbox(storageMock);

    // Pass invalid types or objects with throwing getters
    const throwingFlag = {
      key: 'throwing-flag',
      get environments() {
        throw new Error('Evaluation explosion');
      },
    };

    const evalResult1 = FlagEngine.evaluate(throwingFlag, 'development', 'user-123');
    assert.strictEqual(evalResult1.on, false);
    assert.strictEqual(evalResult1.bucket, null);

    const evalResult2 = FlagEngine.evaluate(null, 'development', 'user-123');
    assert.strictEqual(evalResult2.on, false);

    const evalResult3 = FlagEngine.evaluate(undefined, 'development', 'user-123');
    assert.strictEqual(evalResult3.on, false);

    const evalResult4 = FlagEngine.evaluate({}, 'invalid-env', 'user-123');
    assert.strictEqual(evalResult4.on, false);
  });

  it('8. No failure path accidentally enables a feature', () => {
    const errorStorageMocks = [
      { getItem: () => { throw new TypeError('Blocked'); } },
      { getItem: () => '{"bad": "syntax"' },
      { getItem: () => '12345' },
      { getItem: () => 'true' },
    ];

    for (const mock of errorStorageMocks) {
      const FlagEngine = createSandbox(mock);
      const flags = FlagEngine.getFlags();
      // On storage errors, getFlags() must return empty array or all flags evaluate to false
      assert.strictEqual(flags.length, 0);
      flags.forEach((flag) => {
        const devEval = FlagEngine.evaluate(flag, 'development', 'user-1');
        const stgEval = FlagEngine.evaluate(flag, 'staging', 'user-1');
        const prodEval = FlagEngine.evaluate(flag, 'production', 'user-1');
        assert.strictEqual(devEval.on, false);
        assert.strictEqual(stgEval.on, false);
        assert.strictEqual(prodEval.on, false);
      });
    }
  });
});
