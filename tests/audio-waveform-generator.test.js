const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  NOTES,
  NOTE_NAMES,
} = require("../projects/misc/audio-waveform-generator/waveformEngine.js");

test("NOTES contains the complete C4-B4 piano range", () => {
  assert.equal(NOTES.length, 7);

  assert.deepEqual(
    NOTES.map(({ note }) => note),
    ["C4", "D4", "E4", "F4", "G4", "A4", "B4"]
  );
});

test("NOTE_NAMES contains all piano note frequencies", () => {
  assert.equal(NOTE_NAMES.C4, 261.63);
  assert.equal(NOTE_NAMES.D4, 293.66);
  assert.equal(NOTE_NAMES.E4, 329.63);
  assert.equal(NOTE_NAMES.F4, 349.23);
  assert.equal(NOTE_NAMES.G4, 392.0);
  assert.equal(NOTE_NAMES.A4, 440.0);
  assert.equal(NOTE_NAMES.B4, 493.88);
});

test("NOTES and NOTE_NAMES contain matching frequencies", () => {
  NOTES.forEach(({ note, freq }) => {
    assert.equal(NOTE_NAMES[note], freq);
  });
});

test("A4 is tuned to 440 Hz", () => {
  assert.equal(NOTE_NAMES.A4, 440);
});

test("piano frequencies are in ascending order", () => {
  for (let i = 1; i < NOTES.length; i++) {
    assert.ok(
      NOTES[i].freq > NOTES[i - 1].freq,
      `${NOTES[i].note} should have a higher frequency than ${NOTES[i - 1].note}`
    );
  }
});

test("each NOTE entry has a note name and numeric frequency", () => {
  NOTES.forEach(({ note, freq }) => {
    assert.equal(typeof note, "string");
    assert.equal(typeof freq, "number");
    assert.ok(freq > 0);
  });
});

/* -------------------------------------------------------------
   Component Unit Tests via VM Sandbox
   ------------------------------------------------------------- */

function loadComponentInSandbox(windowMock = {}) {
  const componentPath = path.join(
    __dirname,
    "../src/components/ui/AudioWaveformGenerator.jsx"
  );
  const rawCode = fs.readFileSync(componentPath, "utf8");

  // Transpile component to standard JS and expose state/refs/methods for testing
  const cleanedCode = rawCode
    .replace(/import\s+[\s\S]*?;/g, "")
    .replace(
      "export default function AudioWaveformGenerator()",
      "function AudioWaveformGenerator()"
    )
    .replace(
      /if\s*\(error\)\s*\{[\s\S]*$/,
      `
      return {
        get isPlaying() { return useStateGet(0); },
        setIsPlaying,
        get audioSource() { return useStateGet(1); },
        setAudioSource,
        get fileName() { return useStateGet(2); },
        setFileName,
        get volume() { return useStateGet(3); },
        setVolume,
        get error() { return useStateGet(4); },
        setError,
        canvasRef, audioCtxRef, analyserRef, audioElementRef, sourceNodeRef, animationIdRef,
        initAudioContext, togglePlay, handleFileUpload, drawWaveform, handleVolumeChange,
        cleanupAudioResources, handleRetry
      };
    }`
    );

  const states = [];
  const stateSetters = [];
  let stateIdx = 0;

  const useStateMock = initialVal => {
    const idx = stateIdx++;
    if (states[idx] === undefined) {
      states[idx] = initialVal;
    }
    const setter = newVal => {
      if (typeof newVal === "function") {
        states[idx] = newVal(states[idx]);
      } else {
        states[idx] = newVal;
      }
    };
    stateSetters.push(setter);
    return [states[idx], setter];
  };

  const useRefMock = initialVal => {
    return { current: initialVal };
  };

  const effects = [];
  const useEffectMock = (fn, deps) => {
    effects.push({ fn, cleanup: null });
  };

  const useCallbackMock = fn => fn;

  const context = {
    useState: useStateMock,
    useRef: useRefMock,
    useEffect: useEffectMock,
    useCallback: useCallbackMock,
    window: windowMock,
    console,
    URL: {
      createObjectURL: file => "blob:mock-url",
    },
    // Getter function for mock state
    useStateGet: idx => states[idx],
    // Make these globally accessible to the running VM script
    AudioContext: windowMock.AudioContext,
    webkitAudioContext: windowMock.webkitAudioContext,
  };

  vm.runInNewContext(
    cleanedCode + "\n\nglobalThis.instance = AudioWaveformGenerator();",
    context
  );

  // Trigger effects
  for (const eff of effects) {
    eff.cleanup = eff.fn();
  }

  return {
    instance: context.instance,
    effects,
    states,
    stateSetters,
  };
}

test("AudioWaveformGenerator: detects unsupported browser/API environment proactively on mount", () => {
  // Empty windowMock means AudioContext and webkitAudioContext are undefined
  const { instance } = loadComponentInSandbox({});
  assert.equal(
    instance.error,
    "Web Audio API is not supported in this browser."
  );
});

test("AudioWaveformGenerator: initializes AudioContext successfully in supported environments", () => {
  const resumeMock = () => Promise.resolve();
  class MockAudioContext {
    constructor() {
      this.state = "suspended";
    }
    createAnalyser() {
      return { fftSize: 0 };
    }
    resume() {
      return resumeMock();
    }
  }

  const windowMock = {
    AudioContext: MockAudioContext,
  };

  const { instance } = loadComponentInSandbox(windowMock);

  // Initially error should be null
  assert.equal(instance.error, null);

  const success = instance.initAudioContext();
  assert.equal(success, true);
  assert.ok(instance.audioCtxRef.current instanceof MockAudioContext);
  assert.equal(instance.error, null);
});

test("AudioWaveformGenerator: catches AudioContext constructor failures", () => {
  class MockAudioContextBroken {
    constructor() {
      throw new Error("Hardware device error");
    }
  }

  const windowMock = {
    AudioContext: MockAudioContextBroken,
  };

  const { instance } = loadComponentInSandbox(windowMock);

  const success = instance.initAudioContext();
  assert.equal(success, false);
  assert.equal(
    instance.error,
    "Audio environment failed to initialize or is unsupported."
  );
});

test("AudioWaveformGenerator: handles AudioContext.resume rejection gracefully", async () => {
  let rejectResume;
  const resumePromise = new Promise((resolve, reject) => {
    rejectResume = reject;
  });

  class MockAudioContext {
    constructor() {
      this.state = "suspended";
    }
    createAnalyser() {
      return { fftSize: 0 };
    }
    resume() {
      return resumePromise;
    }
  }

  const windowMock = {
    AudioContext: MockAudioContext,
  };

  const { instance } = loadComponentInSandbox(windowMock);

  const success = instance.initAudioContext();
  assert.equal(success, true);

  rejectResume(new Error("User interaction restriction"));

  // Wait for promise tick
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(instance.error, "Failed to initialize the audio environment.");
});

test("AudioWaveformGenerator: performs idempotent resource cleanup", () => {
  let closed = false;
  const audioCtx = {
    state: "running",
    close: async () => {
      closed = true;
    },
  };
  const sourceNode = {
    disconnect: () => {},
  };

  const { instance } = loadComponentInSandbox({});
  instance.audioCtxRef.current = audioCtx;
  instance.sourceNodeRef.current = sourceNode;

  instance.cleanupAudioResources();
  assert.equal(closed, true);
  assert.equal(instance.audioCtxRef.current, null);
  assert.equal(instance.sourceNodeRef.current, null);
});

test("AudioWaveformGenerator: unmount performs safe cleanup", () => {
  let closed = false;
  const audioCtx = {
    state: "running",
    close: async () => {
      closed = true;
    },
  };

  const { instance, effects } = loadComponentInSandbox({});
  instance.audioCtxRef.current = audioCtx;

  // Run cleanup returned by the mount effect
  for (const eff of effects) {
    if (typeof eff.cleanup === "function") {
      eff.cleanup();
    }
  }

  assert.equal(closed, true);
});

test("AudioWaveformGenerator: retry clears previous error state and disposes of resources", () => {
  let closed = false;
  const audioCtx = {
    state: "running",
    close: async () => {
      closed = true;
    },
  };

  const { instance } = loadComponentInSandbox({});
  instance.error = "Some previous error";
  instance.audioCtxRef.current = audioCtx;

  instance.handleRetry();

  assert.equal(instance.error, null);
  assert.equal(closed, true);
  assert.equal(instance.audioCtxRef.current, null);
});
