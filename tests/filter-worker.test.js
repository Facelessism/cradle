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

test.beforeEach(() => {
  FakeWorker.instances = [];
});

test("falls back when worker construction throws", () => {
  const failures = [];
  class FailingWorker {
    constructor() {
      throw new Error("worker unavailable");
    }
  }

  const worker = createFilterWorker({
    WorkerCtor: FailingWorker,
    onResult: () => {},
    onFailure: error => failures.push(error),
  });

  assert.equal(worker, null);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].message, "worker unavailable");
});

test("falls back when posting a search request fails", () => {
  const failures = [];
  const worker = createFilterWorker({
    WorkerCtor: FakeWorker,
    onResult: () => {},
    onFailure: error => failures.push(error),
  });
  const instance = FakeWorker.instances[0];
  instance.shouldThrow = true;

  assert.equal(worker.postMessage({ query: "chess" }), false);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].message, "postMessage failed");
  assert.equal(instance.terminated, true);
});

test("falls back when the worker reports an execution error", () => {
  const failures = [];
  const worker = createFilterWorker({
    WorkerCtor: FakeWorker,
    onResult: () => {},
    onFailure: error => failures.push(error),
  });
  const instance = FakeWorker.instances[0];

  instance.onerror(new Error("worker crashed"));

  assert.equal(failures.length, 1);
  assert.equal(failures[0].message, "worker crashed");
  assert.equal(instance.terminated, true);
});

test("falls back when the worker returns an invalid result", () => {
  const failures = [];
  const results = [];
  createFilterWorker({
    WorkerCtor: FakeWorker,
    onResult: result => results.push(result),
    onFailure: error => failures.push(error),
  });
  const instance = FakeWorker.instances[0];

  instance.onmessage({ data: { projects: [] } });

  assert.deepEqual(results, []);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].message, "Worker returned an invalid search result");
  assert.equal(instance.terminated, true);
});

test("delivers valid worker results without invoking fallback", () => {
  const failures = [];
  const results = [];
  createFilterWorker({
    WorkerCtor: FakeWorker,
    onResult: result => results.push(result),
    onFailure: error => failures.push(error),
  });
  const instance = FakeWorker.instances[0];

  instance.onmessage({ data: [{ id: "chess" }] });

  assert.deepEqual(results, [[{ id: "chess" }]]);
  assert.deepEqual(failures, []);
  assert.equal(instance.terminated, false);
});
