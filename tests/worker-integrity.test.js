import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  findWorkerUsages,
  isExternal,
  normalizedSha256,
  validateIntegrity,
  walkSourceFiles,
} from "../scripts/validate-worker-integrity.js";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

test("findWorkerUsages resolves same-origin literal worker references", () => {
  const landing = `
    filterWorker = new Worker("./scripts/worker.js");
  `;
  const chess = `
    aiWorker = new Worker("ai-worker.js");
    importScripts("chessLogic.js");
  `;

  const landingRef = findWorkerUsages(landing, "script.js");
  const chessRef = findWorkerUsages(chess, "projects/games/chess/script.js");
  const urlsFromChess = findWorkerUsages(
    chess,
    "projects/games/chess/ai-worker.js"
  );

  assert.deepEqual(landingRef.urls, ["scripts/worker.js"]);
  assert.deepEqual(chessRef.urls, [
    "projects/games/chess/ai-worker.js",
    "projects/games/chess/chessLogic.js",
  ]);
  assert.deepEqual(urlsFromChess.issues, []);
  assert.deepEqual(landingRef.issues, []);
  assert.deepEqual(chessRef.issues, []);
});

test("findWorkerUsages flags dynamic and remote worker URLs", () => {
  const source = `
    new Worker(WORKER_URL);
    new Worker("https://cdn.example.com/worker.js");
    importScripts("helper.js", otherVar);
  `;

  const { urls, issues } = findWorkerUsages(source, "page.js");

  assert.deepEqual(urls, ["helper.js"]);
  assert.equal(issues.length, 3);
  assert.ok(issues.some(i => i.type === "DYNAMIC_WORKER_URL"));
  assert.ok(issues.some(i => i.type === "REMOTE_WORKER"));
});

test("findWorkerUsages ignores the Worker options object as a URL", () => {
  const { urls, issues } = findWorkerUsages(
    `new Worker("./scripts/worker.js", { type: "module" })`,
    "script.js"
  );

  assert.deepEqual(urls, ["scripts/worker.js"]);
  assert.deepEqual(issues, []);
});

test("findWorkerUsages flags protocol-relative and data URLs as remote", () => {
  const { issues } = findWorkerUsages(
    `importScripts("//cdn.example.com/helper.js", "data:text/javascript,x")`,
    "worker.js"
  );

  assert.equal(issues.length, 2);
  assert.ok(issues.every(i => i.type === "REMOTE_WORKER"));
});

test("isExternal identifies remote URL schemes", () => {
  assert.equal(isExternal("https://example.com/w.js"), true);
  assert.equal(isExternal("//cdn.example.com/w.js"), true);
  assert.equal(isExternal("blob:abc"), true);
  assert.equal(isExternal("data:text/javascript,..."), true);
  assert.equal(isExternal("./scripts/worker.js"), false);
  assert.equal(isExternal("helper.js"), false);
});

test("normalizedSha256 produces a stable 64-char hex digest", () => {
  const workerPath = path.join(REPO_ROOT, "scripts", "worker.js");
  const hash = normalizedSha256(workerPath);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(normalizedSha256(workerPath), hash);
});

test("live repository worker references match the integrity registry", () => {
  const issues = validateIntegrity(REPO_ROOT);
  assert.deepEqual(issues, []);
});

test("every registered worker is present and hashed on disk", () => {
  const raw = fs.readFileSync(
    path.join(REPO_ROOT, "data", "worker-integrity.json"),
    "utf-8"
  );
  const data = JSON.parse(raw);

  assert.equal(data.remoteAllowed.length, 0);
  assert.ok(data.workers.length >= 2);
  for (const entry of data.workers) {
    assert.equal(typeof entry.url, "string");
    assert.match(entry.sha256, /^[0-9a-f]{64}$/);
    assert.equal(
      normalizedSha256(path.join(REPO_ROOT, entry.url)),
      entry.sha256
    );
  }
});

test("walkSourceFiles ignores the validator itself and vendored dirs", () => {
  const files = walkSourceFiles(REPO_ROOT).map(f =>
    path.relative(REPO_ROOT, f).split(path.sep).join("/")
  );

  assert.ok(files.includes("scripts/worker.js"));
  assert.ok(files.includes("script.js"));
  assert.ok(!files.includes("scripts/validate-worker-integrity.js"));
  assert.ok(files.every(f => !f.startsWith("node_modules/")));
});
