import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isChessBoard,
  isChessMove,
  isChessSearchRequest,
  isChessCancelRequest,
  isChessWorkerReport,
  isFilterRequest,
  isFilterResult,
  isTrustedMessageEvent,
} from "../src/utils/messageValidation.js";

const emptyBoard = Array.from({ length: 8 }, () => Array(8).fill(null));

const validSearchRequest = {
  type: "search",
  searchId: 1,
  board: emptyBoard,
  color: "white",
  depth: 3,
  enPassantTarget: null,
  timeLimit: 5000,
};

test("isFilterRequest accepts a valid landing-page search request", () => {
  assert.equal(
    isFilterRequest({ allProjects: [], selectedCategory: "all", query: "" }),
    true
  );
});

test("isFilterRequest rejects malformed requests", () => {
  assert.equal(isFilterRequest(null), false);
  assert.equal(isFilterRequest(undefined), false);
  assert.equal(
    isFilterRequest({ allProjects: [], selectedCategory: "all" }),
    false
  );
  assert.equal(
    isFilterRequest({ allProjects: {}, selectedCategory: "all", query: "" }),
    false
  );
  assert.equal(
    isFilterRequest({ allProjects: [], selectedCategory: 5, query: "" }),
    false
  );
  assert.equal(
    isFilterRequest({ allProjects: [], selectedCategory: "all", query: 7 }),
    false
  );
});

test("isFilterResult accepts arrays and rejects everything else", () => {
  assert.equal(isFilterResult([]), true);
  assert.equal(isFilterResult([{ id: "chess" }]), true);
  assert.equal(isFilterResult(null), false);
  assert.equal(isFilterResult({ projects: [] }), false);
  assert.equal(isFilterResult("projects"), false);
});

test("isChessBoard requires an 8x8 board of pieces or empty squares", () => {
  assert.equal(isChessBoard(emptyBoard), true);
  assert.equal(isChessBoard(null), false);
  assert.equal(isChessBoard([]), false);
  assert.equal(isChessBoard(Array(8).fill(Array(7).fill(null))), false);
  assert.equal(isChessBoard(Array(8).fill("row")), false);

  const boardWithPiece = Array.from({ length: 8 }, () => Array(8).fill(null));
  boardWithPiece[0][0] = { type: "pawn", color: "white" };
  assert.equal(isChessBoard(boardWithPiece), true);

  boardWithPiece[0][1] = { type: "pawn", color: "grey" };
  assert.equal(isChessBoard(boardWithPiece), false);
});

test("isChessMove validates move square bounds and optional fields", () => {
  assert.equal(isChessMove(null), false);
  assert.equal(isChessMove({}), false);
  assert.equal(
    isChessMove({ from: { row: 0, col: 0 }, to: { row: 1, col: 1 } }),
    true
  );
  assert.equal(
    isChessMove({
      from: { row: 0, col: 0 },
      to: { row: 1, col: 1 },
      promoteTo: "queen",
      castle: false,
    }),
    true
  );
  assert.equal(
    isChessMove({ from: { row: 8, col: 0 }, to: { row: 1, col: 1 } }),
    false
  );
  assert.equal(
    isChessMove({ from: { row: 0, col: 1.5 }, to: { row: 1, col: 1 } }),
    false
  );
  assert.equal(
    isChessMove({
      from: { row: 0, col: 0 },
      to: { row: 1, col: 1 },
      promoteTo: 42,
    }),
    false
  );
});

test("isChessSearchRequest accepts the documented search payload", () => {
  assert.equal(isChessSearchRequest(validSearchRequest), true);
  assert.equal(
    isChessSearchRequest({
      ...validSearchRequest,
      color: "black",
      enPassantTarget: { row: 5, col: 3 },
    }),
    true
  );
});

test("isChessSearchRequest rejects malformed search payloads", () => {
  assert.equal(isChessSearchRequest(null), false);
  assert.equal(isChessSearchRequest({ type: "cancel" }), false);
  assert.equal(
    isChessSearchRequest({ ...validSearchRequest, searchId: 1.5 }),
    false
  );
  assert.equal(
    isChessSearchRequest({ ...validSearchRequest, color: "grey" }),
    false
  );
  assert.equal(
    isChessSearchRequest({ ...validSearchRequest, depth: 0 }),
    false
  );
  assert.equal(
    isChessSearchRequest({ ...validSearchRequest, depth: "3" }),
    false
  );
  assert.equal(
    isChessSearchRequest({ ...validSearchRequest, board: [] }),
    false
  );
  assert.equal(
    isChessSearchRequest({
      ...validSearchRequest,
      enPassantTarget: { row: 9, col: 0 },
    }),
    false
  );
  assert.equal(
    isChessSearchRequest({ ...validSearchRequest, timeLimit: 0 }),
    false
  );
});

test("isChessCancelRequest only accepts the cancel message", () => {
  assert.equal(isChessCancelRequest({ type: "cancel" }), true);
  assert.equal(isChessCancelRequest({ type: "search" }), false);
  assert.equal(isChessCancelRequest(null), false);
});

test("isChessWorkerReport accepts every documented report shape", () => {
  const move = { from: { row: 0, col: 0 }, to: { row: 1, col: 1 } };

  assert.equal(
    isChessWorkerReport({
      type: "progress",
      depth: 1,
      maxDepth: 3,
      completed: 5,
      total: 20,
    }),
    true
  );
  assert.equal(
    isChessWorkerReport({ type: "depthComplete", depth: 2, maxDepth: 3 }),
    true
  );
  assert.equal(
    isChessWorkerReport({ type: "complete", move, depth: 3, nodes: 120 }),
    true
  );
  assert.equal(
    isChessWorkerReport({ type: "timeout", move: null, depth: 2, nodes: 40 }),
    true
  );
  assert.equal(
    isChessWorkerReport({
      type: "cancelled",
      move: undefined,
      depth: 0,
      nodes: 0,
    }),
    true
  );
  assert.equal(
    isChessWorkerReport({ type: "error", message: "Invalid board data." }),
    true
  );
});

test("isChessWorkerReport rejects unknown or malformed reports", () => {
  assert.equal(isChessWorkerReport(null), false);
  assert.equal(isChessWorkerReport({ type: "mystery" }), false);
  assert.equal(isChessWorkerReport({ type: "progress", depth: 1 }), false);
  assert.equal(
    isChessWorkerReport({
      type: "complete",
      move: { from: { row: 0, col: 0 }, to: { row: 9, col: 9 } },
      depth: 3,
      nodes: 120,
    }),
    false
  );
  assert.equal(
    isChessWorkerReport({ type: "complete", move: null, depth: "x", nodes: 0 }),
    false
  );
  assert.equal(isChessWorkerReport({ type: "error" }), false);
});

test("isTrustedMessageEvent accepts worker and own-origin messages only", () => {
  assert.equal(isTrustedMessageEvent(null), false);
  assert.equal(isTrustedMessageEvent({ origin: "" }), true);
  assert.equal(isTrustedMessageEvent({}), true);
  // With no `location` global (e.g. in a worker), a cross-origin origin is
  // not provably trusted and must be rejected.
  assert.equal(
    isTrustedMessageEvent({ origin: "https://evil.example" }),
    false
  );
});
