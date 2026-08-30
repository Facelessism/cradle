import { test } from "node:test";
import assert from "node:assert/strict";
import { createFilterWorker } from "../src/utils/filterWorker.js";

class FakeWorker {
  static instances = [];

  constructor() {
    this.terminated = false;
    this.messages = [];
    FakeWorker.instances.push(this);
  }

  postMessage(message) {
    if (this.shouldThrow) throw new Error("postMessage failed");
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }
}

function createMockLogger() {
  const logs = [];
  return {
    logs,
    logger: {
      error: (tag, entry) => logs.push({ tag, entry }),
    },
  };
}

test.beforeEach(() => {
  FakeWorker.instances = [];
});

test("falls back when worker construction throws and emits structured failure log", () => {
  const failures = [];
  const { logs, logger } = createMockLogger();
  class FailingWorker {
    constructor() {
      throw new Error("worker unavailable");
    }
  }

  const worker = createFilterWorker({
    workerFactory: () => new FailingWorker(),
    onResult: () => {},
    onFailure: error => failures.push(error),
    logger,
  });

  assert.equal(worker, null);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].message, "worker unavailable");

  assert.equal(logs.length, 1);
  assert.equal(logs[0].tag, "[WorkerFailure]");
  assert.equal(logs[0].entry.workerName, "FilterWorker");
  assert.equal(logs[0].entry.context, "instantiation");
  assert.equal(logs[0].entry.message, "worker unavailable");
  assert.ok(logs[0].entry.timestamp);
});

test("falls back when posting a search request fails and emits structured failure log", () => {
  const failures = [];
  const { logs, logger } = createMockLogger();
  const worker = createFilterWorker({
    workerFactory: () => new FakeWorker(),
    onResult: () => {},
    onFailure: error => failures.push(error),
    logger,
  });
  const instance = FakeWorker.instances[0];
  instance.shouldThrow = true;

  assert.equal(
    worker.postMessage({
      allProjects: [],
      selectedCategory: "all",
      query: "chess",
    }),
    false
  );
  assert.equal(failures.length, 1);
  assert.equal(failures[0].message, "postMessage failed");
  assert.equal(instance.terminated, true);

  assert.equal(logs.length, 1);
  assert.equal(logs[0].tag, "[WorkerFailure]");
  assert.equal(logs[0].entry.workerName, "FilterWorker");
  assert.equal(logs[0].entry.context, "postMessage");
  assert.equal(logs[0].entry.errorType, "PostMessageError");
  assert.equal(logs[0].entry.message, "postMessage failed");
});

test("refuses to send malformed requests, falls back, and emits structured failure log", () => {
  const failures = [];
  const { logs, logger } = createMockLogger();
  const worker = createFilterWorker({
    workerFactory: () => new FakeWorker(),
    onResult: () => {},
    onFailure: error => failures.push(error),
    logger,
  });
  const instance = FakeWorker.instances[0];

  assert.equal(worker.postMessage({ query: "chess" }), false);
  assert.equal(instance.messages.length, 0);
  assert.equal(failures.length, 1);
  assert.equal(
    failures[0].message,
    "Refusing to send an invalid search request"
  );
  assert.equal(instance.terminated, true);

  assert.equal(logs.length, 1);
  assert.equal(logs[0].tag, "[WorkerFailure]");
  assert.equal(logs[0].entry.workerName, "FilterWorker");
  assert.equal(logs[0].entry.context, "postMessage");
  assert.equal(logs[0].entry.errorType, "InvalidRequestError");
});

test("falls back when the worker reports an execution error and emits structured failure log", () => {
  const failures = [];
  const { logs, logger } = createMockLogger();
  createFilterWorker({
    workerFactory: () => new FakeWorker(),
    onResult: () => {},
    onFailure: error => failures.push(error),
    logger,
  });
  const instance = FakeWorker.instances[0];

  instance.onerror(new Error("worker crashed"));

  assert.equal(failures.length, 1);
  assert.equal(failures[0].message, "worker crashed");
  assert.equal(instance.terminated, true);

  assert.equal(logs.length, 1);
  assert.equal(logs[0].tag, "[WorkerFailure]");
  assert.equal(logs[0].entry.workerName, "FilterWorker");
  assert.equal(logs[0].entry.context, "onerror");
  assert.equal(logs[0].entry.errorType, "WorkerRuntimeError");
  assert.equal(logs[0].entry.message, "worker crashed");
});

test("falls back when the worker returns an invalid result and emits structured failure log", () => {
  const failures = [];
  const results = [];
  const { logs, logger } = createMockLogger();
  createFilterWorker({
    workerFactory: () => new FakeWorker(),
    onResult: result => results.push(result),
    onFailure: error => failures.push(error),
    logger,
  });
  const instance = FakeWorker.instances[0];

  instance.onmessage({ data: { projects: [] } });

  assert.deepEqual(results, []);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].message, "Worker returned an invalid search result");
  assert.equal(instance.terminated, true);

  assert.equal(logs.length, 1);
  assert.equal(logs[0].tag, "[WorkerFailure]");
  assert.equal(logs[0].entry.workerName, "FilterWorker");
  assert.equal(logs[0].entry.context, "onmessage");
  assert.equal(logs[0].entry.errorType, "InvalidResultError");
});

test("delivers valid worker results without invoking fallback or logging failures", () => {
  const failures = [];
  const results = [];
  const { logs, logger } = createMockLogger();
  createFilterWorker({
    workerFactory: () => new FakeWorker(),
    onResult: result => results.push(result),
    onFailure: error => failures.push(error),
    logger,
  });
  const instance = FakeWorker.instances[0];

  instance.onmessage({ data: [{ id: "chess" }] });

  assert.deepEqual(results, [[{ id: "chess" }]]);
  assert.deepEqual(failures, []);
  assert.equal(instance.terminated, false);
  assert.equal(logs.length, 0);
});
