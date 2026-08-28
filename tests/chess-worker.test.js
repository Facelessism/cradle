const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const workerSrc = fs.readFileSync(
  path.resolve(__dirname, "../projects/games/chess/ai-worker.js"),
  "utf8"
);
const scriptSrc = fs.readFileSync(
  path.resolve(__dirname, "../projects/games/chess/script.js"),
  "utf8"
);

// ── Worker: cancellation support ──────────────────────────────

test("worker handles cancel message type", () => {
  assert.match(workerSrc, /if\s*\(\s*type\s*===\s*["']cancel["']\s*\)/);
});

test("worker resets cancelled flag on new search", () => {
  assert.match(workerSrc, /cancelled\s*=\s*false/);
});

test("worker checks isExpired during minimax", () => {
  // The minimax function should check isExpired at the top
  assert.match(
    workerSrc,
    /function\s+minimax[\s\S]*?if\s*\(\s*depth\s*===\s*0\s*\|\|\s*isExpired\(\)/
  );
});

test("worker checks isExpired before processing each move", () => {
  // Both maximizing and minimizing loops should check expiry
  const minimaxBody = workerSrc.slice(
    workerSrc.indexOf("function minimax")
  );
  const expiryChecks = minimaxBody.match(/if\s*\(\s*isExpired\(\)\s*\)\s*break/g);
  assert.ok(
    expiryChecks && expiryChecks.length >= 2,
    "isExpired should be checked in both maximizing and minimizing loops"
  );
});

test("worker checks expiry in top-level move loop", () => {
  const topLoop = workerSrc.slice(workerSrc.indexOf("onmessage"));
  assert.match(topLoop, /if\s*\(\s*isExpired\(\)\s*\)\s*break/);
});

// ── Worker: progress events ──────────────────────────────────

test("worker sends progress messages periodically", () => {
  assert.match(workerSrc, /type:\s*["']progress["']/);
  assert.match(workerSrc, /nodesSearched/);
  assert.match(workerSrc, /elapsedMs/);
});

test("worker increments nodesSearched counter", () => {
  assert.match(workerSrc, /nodesSearched\+\+/);
});

// ── Worker: result message structure ──────────────────────────

test("worker sends structured result with type field", () => {
  assert.match(workerSrc, /type:\s*["']result["']/);
});

test("worker reports timedOut in result", () => {
  assert.match(workerSrc, /timedOut/);
});

test("worker reports cancelled in result", () => {
  const resultSection = workerSrc.slice(workerSrc.indexOf("onmessage"));
  assert.match(resultSection, /cancelled/);
});

test("worker reports nodesSearched and elapsedMs in result", () => {
  const resultSection = workerSrc.slice(workerSrc.indexOf("onmessage"));
  assert.match(resultSection, /nodesSearched/);
  assert.match(resultSection, /elapsedMs/);
});

// ── Worker: timeout configuration ─────────────────────────────

test("worker has configurable timeout with default", () => {
  assert.match(workerSrc, /DEFAULT_TIMEOUT_MS\s*=\s*5000/);
  assert.match(workerSrc, /timeoutMs\s*=\s*timeout\s*\|\|\s*DEFAULT_TIMEOUT_MS/);
});

test("worker reads timeout from message data", () => {
  assert.match(workerSrc, /\{\s*type,\s*board,\s*color,\s*depth,\s*enPassantTarget,\s*timeout\s*\}/);
});

// ── Script: handles new message format ────────────────────────

test("script handles progress message type", () => {
  assert.match(scriptSrc, /msg\.type\s*===\s*["']progress["']/);
});

test("script handles result message type", () => {
  assert.match(scriptSrc, /msg\.type\s*===\s*["']result["']/);
});

test("script sends cancel message instead of immediate terminate", () => {
  assert.match(scriptSrc, /postMessage\(\s*\{\s*type:\s*["']cancel["']\s*\}\s*\)/);
});

test("script has graceful termination fallback after timeout", () => {
  // cancelAI should setTimeout then terminate if still thinking
  const cancelSection = scriptSrc.slice(
    scriptSrc.indexOf("function cancelAI")
  );
  assert.match(cancelSection, /setTimeout/);
  assert.match(cancelSection, /terminate\(\)/);
});

test("script sends type: search in postMessage to worker", () => {
  assert.match(scriptSrc, /type:\s*["']search["']/);
});

test("script displays nodes searched and elapsed time during progress", () => {
  assert.match(scriptSrc, /msg\.nodesSearched/);
  assert.match(scriptSrc, /msg\.elapsedMs/);
});

test("script displays timeout notice when AI times out", () => {
  assert.match(scriptSrc, /timedOut/);
});

test("script handles cancelled result gracefully", () => {
  assert.match(scriptSrc, /msg\.cancelled/);
});
