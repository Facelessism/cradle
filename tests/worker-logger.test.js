import { test } from "node:test";
import assert from "node:assert/strict";
import { logWorkerFailure } from "../src/utils/workerLogger.js";

test("logWorkerFailure returns structured log entry with all diagnostic fields", () => {
  const mockLogs = [];
  const mockLogger = {
    error: (tag, entry) => mockLogs.push({ tag, entry }),
  };

  const entry = logWorkerFailure({
    workerName: "FilterWorker",
    errorType: "InvalidResultError",
    message: "Worker returned an invalid search result",
    context: "onmessage",
    logger: mockLogger,
  });

  assert.equal(entry.workerName, "FilterWorker");
  assert.equal(entry.errorType, "InvalidResultError");
  assert.equal(entry.message, "Worker returned an invalid search result");
  assert.equal(entry.context, "onmessage");
  assert.ok(typeof entry.timestamp === "string");
  assert.ok(!isNaN(Date.parse(entry.timestamp)));

  assert.equal(mockLogs.length, 1);
  assert.equal(mockLogs[0].tag, "[WorkerFailure]");
  assert.deepEqual(mockLogs[0].entry, entry);
});

test("logWorkerFailure handles Error instances for message extraction", () => {
  const mockLogs = [];
  const mockLogger = {
    error: (tag, entry) => mockLogs.push({ tag, entry }),
  };

  const errorObj = new Error("Custom runtime crash");
  const entry = logWorkerFailure({
    workerName: "TestWorker",
    errorType: "RuntimeError",
    message: errorObj,
    context: "onerror",
    logger: mockLogger,
  });

  assert.equal(entry.message, "Custom runtime crash");
  assert.equal(entry.errorType, "RuntimeError");
  assert.equal(entry.context, "onerror");
});

test("logWorkerFailure uses safe defaults when parameters are omitted", () => {
  const entry = logWorkerFailure({ logger: null });

  assert.equal(entry.workerName, "Worker");
  assert.equal(entry.errorType, "WorkerError");
  assert.equal(entry.message, "Unknown worker failure");
  assert.equal(entry.context, "unknown");
  assert.ok(typeof entry.timestamp === "string");
});

test("logWorkerFailure excludes sensitive fields and request/response objects", () => {
  const entry = logWorkerFailure({
    workerName: "FilterWorker",
    errorType: "AuthError",
    message: "Failed to process request",
    context: "postMessage",
    logger: null,
  });

  const keys = Object.keys(entry);
  assert.deepEqual(keys.sort(), [
    "context",
    "errorType",
    "message",
    "timestamp",
    "workerName",
  ]);

  assert.equal("token" in entry, false);
  assert.equal("password" in entry, false);
  assert.equal("apiKey" in entry, false);
  assert.equal("cookie" in entry, false);
  assert.equal("authorization" in entry, false);
});
