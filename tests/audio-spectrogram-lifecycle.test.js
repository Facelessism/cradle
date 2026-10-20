const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const PROJECT_DIR = path.resolve(
  __dirname,
  "..",
  "projects",
  "misc",
  "audio-spectrogram-analyzer"
);

const AUDIO_SOURCE = fs
  .readFileSync(path.join(PROJECT_DIR, "audio-processor.js"), "utf-8")
  .replace(/\bexport\s+default\s+/g, "")
  .replace(/\bexport\s+/g, "");

const VISUALIZER_SOURCE = fs
  .readFileSync(path.join(PROJECT_DIR, "visualizer.js"), "utf-8")
  .replace(/\bexport\s+default\s+/g, "")
  .replace(/\bexport\s+/g, "");

function createNode(kind, target = null) {
  return {
    kind,
    target,
    connections: [],
    disconnected: false,
    connect(node) {
      this.connections.push(node);
    },
    disconnect() {
      this.disconnected = true;
      this.connections = [];
    },
  };
}

function createStream(label) {
  const track = {
    label,
    stopped: false,
    stop() {
      this.stopped = true;
    },
  };

  return {
    label,
    tracks: [track],
    getTracks() {
      return this.tracks;
    },
  };
}

function createCanvas() {
  const context = {
    clearRect() {},
    drawImage() {},
    fillRect() {},
    fillStyle: "",
  };

  return {
    width: 0,
    height: 0,
    parentElement: {
      getBoundingClientRect() {
        return { width: 320, height: 200 };
      },
    },
    getContext() {
      return context;
    },
  };
}

class MockAnalyser {
  constructor() {
    this._fftSize = 2048;
    this.frequencyBinCount = 1024;
    this.smoothingTimeConstant = 0;
    this.connections = [];
    this.disconnected = false;
  }

  get fftSize() {
    return this._fftSize;
  }

  set fftSize(value) {
    this._fftSize = value;
    this.frequencyBinCount = value / 2;
  }

  connect(node) {
    this.connections.push(node);
  }

  disconnect() {
    this.disconnected = true;
    this.connections = [];
  }

  getByteFrequencyData(array) {
    array.fill(7);
  }
}

function createApi() {
  const state = {
    createdCanvases: 0,
    createdUrls: [],
    revokedUrls: [],
    rafId: 0,
    rafCallbacks: new Map(),
    resizeHandlers: [],
    errorBanner: { hidden: true },
    audioContexts: [],
    audioElements: [],
    streams: [],
  };

  const URL = {
    createObjectURL(file) {
      const url = `blob:test-${state.createdUrls.length + 1}`;
      state.createdUrls.push({ url, file });
      return url;
    },
    revokeObjectURL(url) {
      state.revokedUrls.push(url);
    },
  };

  class MockAudio {
    constructor() {
      this.src = "";
      this.loop = false;
      this.paused = false;
      this.played = false;
      this.loaded = false;
      this.srcRemoved = false;
      state.audioElements.push(this);
    }

    play() {
      this.played = true;
      return Promise.resolve();
    }

    pause() {
      this.paused = true;
    }

    removeAttribute(name) {
      if (name === "src") {
        this.src = "";
        this.srcRemoved = true;
      }
    }

    load() {
      this.loaded = true;
    }
  }

  class MockAudioContext {
    constructor() {
      this.state = "running";
      this.closed = false;
      this.destination = createNode("speakers");
      state.audioContexts.push(this);
    }

    createMediaStreamDestination() {
      const destination = createNode("recording-destination");
      destination.stream = { id: "recording" };
      return destination;
    }

    createMediaStreamSource(stream) {
      return createNode("microphone-source", stream);
    }

    createMediaElementSource(element) {
      return createNode("element-source", element);
    }

    createAnalyser() {
      return new MockAnalyser();
    }

    async resume() {
      this.state = "running";
    }

    async close() {
      this.closed = true;
      this.state = "closed";
    }
  }

  const mainCanvas = createCanvas();
  const document = {
    getElementById(id) {
      if (id === "spectrogram-canvas") return mainCanvas;
      if (id === "error-banner") return state.errorBanner;
      return null;
    },
    createElement(tag) {
      if (tag === "canvas") {
        state.createdCanvases += 1;
        return createCanvas();
      }
      return {};
    },
  };

  const mediaDevices = {
    async getUserMedia() {
      const stream = createStream(`stream-${state.streams.length + 1}`);
      state.streams.push(stream);
      return stream;
    },
  };

  const window = {
    addEventListener(type, handler) {
      if (type === "resize") state.resizeHandlers.push(handler);
    },
    removeEventListener(type, handler) {
      if (type === "resize") {
        const index = state.resizeHandlers.indexOf(handler);
        if (index !== -1) state.resizeHandlers.splice(index, 1);
      }
    },
  };

  window.AudioContext = MockAudioContext;
  window.URL = URL;

  const sandbox = {
    window,
    document,
    navigator: { mediaDevices },
    URL,
    Audio: MockAudio,
    console,
    requestAnimationFrame(callback) {
      state.rafId += 1;
      state.rafCallbacks.set(state.rafId, callback);
      return state.rafId;
    },
    cancelAnimationFrame(id) {
      state.rafCallbacks.delete(id);
    },
  };

  const context = vm.createContext(sandbox);
  const source = `${AUDIO_SOURCE}\n${VISUALIZER_SOURCE}\n({ AudioProcessor, SpectrogramVisualizer });`;
  const api = vm.runInContext(source, context, {
    filename: "audio-spectrogram.js",
  });

  return { ...api, state, mainCanvas };
}

test("starting the microphone twice stops the previous stream and graph", async () => {
  const { AudioProcessor, state } = createApi();
  const processor = new AudioProcessor();

  assert.equal(await processor.startMicrophone(), true);

  const firstStream = state.streams[0];
  const firstSource = processor.source;
  const firstAnalyser = processor.analyser;

  assert.equal(await processor.startMicrophone(), true);

  assert.equal(firstStream.tracks[0].stopped, true);
  assert.equal(firstSource.disconnected, true);
  assert.equal(firstAnalyser.disconnected, true);
  assert.notEqual(processor.source, firstSource);
  assert.equal(processor.mediaStream, state.streams[1]);
  assert.equal(state.streams[1].tracks[0].stopped, false);
});

test("stopping a loaded audio file revokes its URL and clears the element", async () => {
  const { AudioProcessor, state } = createApi();
  const processor = new AudioProcessor();

  assert.equal(await processor.loadAudioFile({ name: "clip.mp3" }), true);

  const { url } = state.createdUrls[0];
  const audio = processor.audioElement;
  const source = processor.source;
  const analyser = processor.analyser;

  processor.stop();

  assert.equal(state.revokedUrls.includes(url), true);
  assert.equal(audio.paused, true);
  assert.equal(audio.srcRemoved, true);
  assert.equal(audio.loaded, true);
  assert.equal(source.disconnected, true);
  assert.equal(analyser.disconnected, true);
  assert.equal(processor.audioElement, null);
  assert.equal(processor.objectUrl, null);
  assert.equal(processor.source, null);
  assert.equal(processor.analyser, null);
});

test("frequency data is cached until the FFT size changes", async () => {
  const { AudioProcessor } = createApi();
  const processor = new AudioProcessor();

  await processor.startMicrophone();

  const first = processor.getFrequencyData();
  const second = processor.getFrequencyData();

  assert.equal(first, second);
  assert.equal(first.length, 1024);

  processor.setFFTSize(1024);
  const third = processor.getFrequencyData();

  assert.notEqual(third, first);
  assert.equal(third.length, 512);
});

test("visualizer cancels old frames and reuses one offscreen canvas", () => {
  const { SpectrogramVisualizer, state } = createApi();
  const visualizer = new SpectrogramVisualizer("spectrogram-canvas");

  assert.equal(state.createdCanvases, 1);

  const processor = {
    getFrequencyData: () => new Uint8Array([1, 2, 3, 4]),
  };

  visualizer.start(processor);
  const firstFrame = visualizer.animationId;

  assert.ok(firstFrame);
  assert.equal(state.rafCallbacks.size, 1);

  visualizer.start(processor);

  assert.equal(state.rafCallbacks.has(firstFrame), false);
  assert.notEqual(visualizer.animationId, firstFrame);
  assert.equal(state.rafCallbacks.size, 1);

  const pending = visualizer.animationId;
  const callback = state.rafCallbacks.get(pending);
  state.rafCallbacks.delete(pending);
  callback();

  assert.equal(state.createdCanvases, 1);
  const next = visualizer.animationId;
  assert.notEqual(next, pending);

  visualizer.stop();

  assert.equal(state.rafCallbacks.has(next), false);
  assert.equal(visualizer.animationId, null);
});

test("destroy removes the resize listener and stops the frame", () => {
  const { SpectrogramVisualizer, state } = createApi();
  const visualizer = new SpectrogramVisualizer("spectrogram-canvas");

  assert.equal(state.resizeHandlers.length, 1);

  visualizer.destroy();

  assert.equal(state.resizeHandlers.length, 0);
  assert.equal(visualizer.isRunning, false);
  assert.equal(visualizer.animationId, null);
});

test("destroy closes the audio context and stops the stream", async () => {
  const { AudioProcessor, state } = createApi();
  const processor = new AudioProcessor();

  await processor.startMicrophone();

  const context = processor.audioContext;
  const stream = state.streams[0];

  await processor.destroy();

  assert.equal(context.closed, true);
  assert.equal(stream.tracks[0].stopped, true);
  assert.equal(processor.audioContext, null);
  assert.equal(processor.destination, null);
  assert.equal(processor.mediaStream, null);
});
