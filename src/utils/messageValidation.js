/**
 * Validation helpers for postMessage payloads.
 *
 * Every worker channel in Cradle is a dedicated, same-origin worker created
 * from a hardcoded relative URL. Browsers refuse to fetch worker scripts from
 * any other origin, and dedicated-worker message events report an empty
 * `event.origin`, so the origin is not attacker controllable. The meaningful
 * defense-in-depth is validating the message *shape* before acting on it.
 *
 * These helpers are pure and dependency-free so they can be reused by the
 * root landing page (ES modules) and imported by the filter worker.
 */

/** Whole-number check (0 <= n and integer). */
function isWholeNumber(value) {
  return Number.isInteger(value) && value >= 0;
}

/** Own property names that can be abused for prototype pollution. */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Whether any own key anywhere in the (acyclic) value can be used to pollute
 * shared prototypes. Prototype-pollution payloads almost always carry
 * `__proto__`, `constructor`, or `prototype` as names; rejecting them at the
 * boundary blocks the attack even before any merge happens. Recursion is
 * bounded by the acyclic, structured-cloned data that arrives via postMessage.
 */
export function hasDangerousKeys(value) {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.some(hasDangerousKeys);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "string" && DANGEROUS_KEYS.has(key)) return true;
    const child = value[key];
    if (
      typeof child === "object" &&
      child !== null &&
      hasDangerousKeys(child)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Recursively strip any own `__proto__`, `constructor`, and `prototype` keys
 * from a parsed structure (worker payloads, JSON). Returns a produce-free copy
 * built with ordinary prototype objects, but assigned one key at a time so a
 * stray `__proto__` can never trigger the base prototype's setter.
 */
export function sanitizeState(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeState);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  const result = {};
  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    Object.defineProperty(result, key, {
      value: sanitizeState(value[key]),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return result;
}

/** Board squares are 0..7 on both axes. */
function isValidSquare(square) {
  return (
    square !== null &&
    typeof square === "object" &&
    isWholeNumber(square.row) &&
    square.row >= 0 &&
    square.row <= 7 &&
    isWholeNumber(square.col) &&
    square.col >= 0 &&
    square.col <= 7
  );
}

/**
 * An 8x8 chess board: every row is a length-8 array, and every square is
 * either null or a piece `{ type, color }`.
 */
export function isChessBoard(board) {
  if (!Array.isArray(board) || board.length !== 8) return false;
  if (hasDangerousKeys(board)) return false;

  return board.every(
    row =>
      Array.isArray(row) &&
      row.length === 8 &&
      row.every(
        square =>
          square === null ||
          (typeof square === "object" &&
            !hasDangerousKeys(square) &&
            typeof square.type === "string" &&
            (square.color === "white" || square.color === "black"))
      )
  );
}

/** A move the chess worker reports back: `{ from, to }` squares in 0..7. */
export function isChessMove(move) {
  if (move === null || typeof move !== "object") return false;
  if (hasDangerousKeys(move)) return false;
  if (!isValidSquare(move.from) || !isValidSquare(move.to)) return false;
  if (move.promoteTo !== undefined && typeof move.promoteTo !== "string")
    return false;
  if (move.castle !== undefined && typeof move.castle !== "boolean")
    return false;
  return true;
}

/** Message the landing page sends to the search filter worker. */
export function isFilterRequest(payload) {
  if (payload === null || typeof payload !== "object") return false;
  if (hasDangerousKeys(payload)) return false;
  return (
    Array.isArray(payload.allProjects) &&
    !payload.allProjects.some(hasDangerousKeys) &&
    typeof payload.selectedCategory === "string" &&
    typeof payload.query === "string"
  );
}

/** Filter worker results are always an array of projects. */
export function isFilterResult(data) {
  if (!Array.isArray(data)) return false;
  return !data.some(hasDangerousKeys);
}

/**
 * Restrict a worker payload to an explicit allowlist of top-level keys. Any
 * unexpected key (or a prototype-pollution key) is treated as an invalid,
 * unauthorized message.
 */
export function hasUnexpectedKeys(value, allowed) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return true;
  }
  return Object.keys(value).some(key => !allowed.has(key));
}

/**
 * Message the chess page sends to the AI worker when a search is requested.
 * `enPassantTarget` and `timeLimit` are optional (worker applies defaults).
 */
export function isChessSearchRequest(payload) {
  if (payload === null || typeof payload !== "object") return false;
  if (hasDangerousKeys(payload)) return false;
  if (
    hasUnexpectedKeys(
      payload,
      new Set([
        "type",
        "searchId",
        "board",
        "color",
        "depth",
        "enPassantTarget",
        "timeLimit",
      ])
    )
  )
    return false;
  if (payload.type !== "search") return false;
  if (!isWholeNumber(payload.searchId)) return false;
  if (!isChessBoard(payload.board)) return false;
  if (payload.color !== "white" && payload.color !== "black") return false;
  if (!isWholeNumber(payload.depth) || payload.depth < 1) return false;
  if (
    payload.enPassantTarget !== null &&
    payload.enPassantTarget !== undefined &&
    !isValidSquare(payload.enPassantTarget)
  )
    return false;
  if (
    payload.timeLimit !== undefined &&
    (!isWholeNumber(payload.timeLimit) || payload.timeLimit < 1)
  )
    return false;
  return true;
}

/** Message the chess page sends to cancel an in-flight AI search. */
export function isChessCancelRequest(payload) {
  if (payload === null || typeof payload !== "object") return false;
  if (hasDangerousKeys(payload)) return false;
  if (hasUnexpectedKeys(payload, new Set(["type"]))) return false;
  return payload.type === "cancel";
}

const CHESS_REPORT_TYPES = new Set([
  "progress",
  "depthComplete",
  "complete",
  "timeout",
  "cancelled",
  "error",
]);

/**
 * Message the chess worker sends back to the page. Only these six report
 * types are accepted, and fields the page acts on are shape-checked.
 */
export function isChessWorkerReport(report) {
  if (report === null || typeof report !== "object") return false;
  if (hasDangerousKeys(report)) return false;
  if (!CHESS_REPORT_TYPES.has(report.type)) return false;

  const allowedKeys = {
    progress: new Set([
      "type",
      "depth",
      "maxDepth",
      "completed",
      "total",
      "nodes",
    ]),
    depthComplete: new Set([
      "type",
      "depth",
      "maxDepth",
      "move",
      "score",
      "nodes",
    ]),
    complete: new Set(["type", "move", "depth", "nodes"]),
    timeout: new Set(["type", "move", "depth", "nodes"]),
    cancelled: new Set(["type", "move", "depth", "nodes"]),
    error: new Set(["type", "message"]),
  }[report.type];

  switch (report.type) {
    case "progress":
      return (
        !hasUnexpectedKeys(report, allowedKeys) &&
        isWholeNumber(report.depth) &&
        isWholeNumber(report.maxDepth) &&
        isWholeNumber(report.completed) &&
        isWholeNumber(report.total)
      );
    case "depthComplete":
      return (
        !hasUnexpectedKeys(report, allowedKeys) &&
        isWholeNumber(report.depth) &&
        isWholeNumber(report.maxDepth)
      );
    case "complete":
    case "timeout":
    case "cancelled":
      return (
        !hasUnexpectedKeys(report, allowedKeys) &&
        (report.move === null ||
          report.move === undefined ||
          isChessMove(report.move)) &&
        isWholeNumber(report.depth) &&
        isWholeNumber(report.nodes)
      );
    case "error":
      return (
        !hasUnexpectedKeys(report, allowedKeys) &&
        typeof report.message === "string"
      );
    default:
      return false;
  }
}

/**
 * Dedicated same-origin workers report an empty `event.origin`; cross-window
 * messages must come from the document's own origin. Every handler in Cradle
 * uses a hardcoded same-origin worker URL, so this guard is defense-in-depth
 * for any future window-level channel.
 */
export function isTrustedMessageEvent(event) {
  if (event === null || typeof event !== "object") return false;
  const origin = typeof event.origin === "string" ? event.origin : "";
  if (origin === "") return true;
  const ownOrigin =
    typeof location !== "undefined" && location.origin ? location.origin : "";
  return ownOrigin !== "" && origin === ownOrigin;
}
