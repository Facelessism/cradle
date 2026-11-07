/* =========================================================
   JSON TREE VIEWER — JSONPATH ENGINE MODULE
   Pure helpers: JSONPath query tokenizer, syntax parser,
   query evaluator, code path formatter, and subtree extractor.
   Kept dependency-free and side-effect-free for unit testing.
   ========================================================= */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.JsonPathEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MAX_RECURSION_DEPTH = 100;

  /**
   * Tokenize / parse a single bracket content:
   * e.g. "0", "'prop'", '"prop"', "*", "0,1", "1:3", "?(@.price < 10)"
   */
  function parseBracketContent(content) {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new SyntaxError("Empty bracket expression in JSONPath");
    }

    if (trimmed === "*") {
      return { type: "wildcard" };
    }

    // Filter expression: ?(...) or ? ...
    if (trimmed.startsWith("?")) {
      let expr = trimmed.slice(1).trim();
      if (expr.startsWith("(") && expr.endsWith(")")) {
        expr = expr.slice(1, -1).trim();
      }
      return parseFilterExpression(expr);
    }

    // Slice expression: [start:end]
    if (trimmed.includes(":") && !trimmed.startsWith("'") && !trimmed.startsWith('"')) {
      const parts = trimmed.split(":");
      const start = parts[0].trim() === "" ? 0 : parseInt(parts[0].trim(), 10);
      const end = parts[1].trim() === "" ? null : parseInt(parts[1].trim(), 10);
      if (isNaN(start) || (end !== null && isNaN(end))) {
        throw new SyntaxError(`Invalid slice expression: [${trimmed}]`);
      }
      return { type: "slice", start, end };
    }

    // Union expression: [0, 1] or ['a', 'b']
    if (trimmed.includes(",") && !trimmed.startsWith("'") && !trimmed.startsWith('"')) {
      const rawItems = trimmed.split(",").map(s => s.trim()).filter(Boolean);
      const items = rawItems.map(item => {
        if (/^-?\d+$/.test(item)) return parseInt(item, 10);
        if ((item.startsWith("'") && item.endsWith("'")) || (item.startsWith('"') && item.endsWith('"'))) {
          return item.slice(1, -1);
        }
        return item;
      });
      return { type: "union", items };
    }

    // Single quoted property: ['key'] or ["key"]
    if (
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      return { type: "property", name: trimmed.slice(1, -1) };
    }

    // Numeric index: [0], [-1]
    if (/^-?\d+$/.test(trimmed)) {
      return { type: "index", index: parseInt(trimmed, 10) };
    }

    // Identifier inside brackets: [author]
    if (/^[a-zA-Z0-9_$]+$/.test(trimmed)) {
      return { type: "property", name: trimmed };
    }

    throw new SyntaxError(`Unsupported bracket expression: [${trimmed}]`);
  }

  /**
   * Parse a filter expression like:
   * "@.category == 'dev-tools'"
   * "@.price < 10"
   * "@.enabled == true"
   * "@.name"
   */
  function parseFilterExpression(expr) {
    const trimmed = expr.trim();
    if (!trimmed) {
      throw new SyntaxError("Empty filter expression inside ?()");
    }

    // Match @.prop or @['prop'] or @ op value
    const match = trimmed.match(
      /^\s*@(?:\.([a-zA-Z0-9_$]+)|\[(?:'([^']+)'|"([^"]+)"|([0-9]+))\])?\s*(==|===|!=|!==|<=|>=|<|>|=~)?\s*(.*)$/
    );

    if (!match) {
      throw new SyntaxError(`Invalid filter expression: "${trimmed}"`);
    }

    const key = match[1] || match[2] || match[3] || match[4] || null;
    const operator = match[5] || null;
    const rawValue = match[6] ? match[6].trim() : "";

    let targetValue = undefined;
    if (operator) {
      if (!rawValue) {
        throw new SyntaxError(`Incomplete filter expression: missing value after operator "${operator}"`);
      }
      if (
        (rawValue.startsWith("'") && rawValue.endsWith("'")) ||
        (rawValue.startsWith('"') && rawValue.endsWith('"'))
      ) {
        targetValue = rawValue.slice(1, -1);
      } else if (rawValue === "true") {
        targetValue = true;
      } else if (rawValue === "false") {
        targetValue = false;
      } else if (rawValue === "null") {
        targetValue = null;
      } else if (!isNaN(Number(rawValue))) {
        targetValue = Number(rawValue);
      } else {
        targetValue = rawValue;
      }
    }

    return {
      type: "filter",
      key,
      operator,
      targetValue,
    };
  }

  /**
   * Evaluate a filter condition against a single item.
   */
  function evaluateFilter(filter, item) {
    if (item === null || typeof item !== "object") return false;

    const actualVal = filter.key ? item[filter.key] : item;

    // Truthiness test if no operator
    if (!filter.operator) {
      return actualVal !== undefined && actualVal !== null && actualVal !== false && actualVal !== "";
    }

    switch (filter.operator) {
      case "==":
      case "===":
        return actualVal === filter.targetValue;
      case "!=":
      case "!==":
        return actualVal !== filter.targetValue;
      case "<":
        return Number(actualVal) < Number(filter.targetValue);
      case "<=":
        return Number(actualVal) <= Number(filter.targetValue);
      case ">":
        return Number(actualVal) > Number(filter.targetValue);
      case ">=":
        return Number(actualVal) >= Number(filter.targetValue);
      case "=~": {
        try {
          const regex = new RegExp(String(filter.targetValue));
          return regex.test(String(actualVal));
        } catch (_) {
          return false;
        }
      }
      default:
        return false;
    }
  }

  /**
   * Parse a full JSONPath string into an AST / segment list.
   * Throws SyntaxError on malformed expressions.
   */
  function parseJsonPath(query = "") {
    const raw = String(query).trim();
    if (!raw) {
      return { isValid: true, error: null, segments: [], isBlank: true };
    }

    let rest = raw;
    // Strip root identifier
    if (rest.startsWith("$")) {
      rest = rest.slice(1);
    } else if (!rest.startsWith("..") && !rest.startsWith(".") && !rest.startsWith("[")) {
      rest = "." + rest;
    }

    const segments = [];
    let i = 0;
    const len = rest.length;

    while (i < len) {
      // 1. Recursive descent ..
      if (rest.startsWith("..", i)) {
        i += 2;
        if (i >= len) {
          throw new SyntaxError("Unexpected end of expression after '..'");
        }

        if (rest[i] === "*") {
          segments.push({ type: "recursive", target: { type: "wildcard" } });
          i++;
        } else if (rest[i] === "[") {
          const closeIdx = rest.indexOf("]", i);
          if (closeIdx === -1) {
            throw new SyntaxError("Unclosed bracket in JSONPath expression");
          }
          const bracketContent = rest.slice(i + 1, closeIdx);
          const target = parseBracketContent(bracketContent);
          segments.push({ type: "recursive", target });
          i = closeIdx + 1;
        } else {
          // Read identifier
          const match = rest.slice(i).match(/^[a-zA-Z0-9_$-]+/);
          if (!match) {
            throw new SyntaxError(`Invalid recursive target near "${rest.slice(i, i + 10)}"`);
          }
          const id = match[0];
          segments.push({ type: "recursive", target: { type: "property", name: id } });
          i += id.length;
        }
        continue;
      }

      // 2. Dot operator .
      if (rest[i] === ".") {
        i++;
        if (i >= len) {
          throw new SyntaxError("Unexpected trailing '.' in expression");
        }
        if (rest[i] === "*") {
          segments.push({ type: "wildcard" });
          i++;
        } else {
          const match = rest.slice(i).match(/^[a-zA-Z0-9_$-]+/);
          if (!match) {
            throw new SyntaxError(`Expected property name after '.' near "${rest.slice(i, i + 10)}"`);
          }
          const id = match[0];
          segments.push({ type: "property", name: id });
          i += id.length;
        }
        continue;
      }

      // 3. Bracket expression [...]
      if (rest[i] === "[") {
        const closeIdx = rest.indexOf("]", i);
        if (closeIdx === -1) {
          throw new SyntaxError("Unclosed bracket in JSONPath expression");
        }
        const bracketContent = rest.slice(i + 1, closeIdx);
        const segment = parseBracketContent(bracketContent);
        segments.push(segment);
        i = closeIdx + 1;
        continue;
      }

      // If unexpected character
      throw new SyntaxError(`Unexpected token "${rest[i]}" at position ${i} in "${query}"`);
    }

    return { isValid: true, error: null, segments, isBlank: false };
  }

  /**
   * Helper to recursively walk all descendants of an object/array.
   */
  function walkAllDescendants(data, path, callback, seen = new Set(), depth = 0) {
    if (depth >= MAX_RECURSION_DEPTH) return;
    if (data === null || typeof data !== "object") return;
    if (seen.has(data)) return;
    seen.add(data);

    if (Array.isArray(data)) {
      for (let idx = 0; idx < data.length; idx++) {
        const item = data[idx];
        const childPath = `${path}[${idx}]`;
        callback(childPath, item, idx);
        walkAllDescendants(item, childPath, callback, seen, depth + 1);
      }
    } else {
      for (const [key, val] of Object.entries(data)) {
        const childPath = /^[a-zA-Z0-9_$]+$/.test(key)
          ? `${path}.${key}`
          : `${path}['${key}']`;
        callback(childPath, val, key);
        walkAllDescendants(val, childPath, callback, seen, depth + 1);
      }
    }
  }

  /**
   * Evaluate a parsed JSONPath against JavaScript data.
   * Returns: { isValid: boolean, error: string | null, matches: [{ path, value }], count: number }
   */
  function evaluateJsonPath(data, query = "") {
    if (data === undefined || data === null) {
      return { isValid: true, error: null, matches: [], count: 0 };
    }

    let parsed;
    try {
      parsed = parseJsonPath(query);
    } catch (err) {
      return { isValid: false, error: err.message, matches: [], count: 0 };
    }

    if (parsed.isBlank) {
      return { isValid: true, error: null, matches: [], count: 0, isBlank: true };
    }

    let currentNodes = [{ path: "$", value: data }];

    for (const seg of parsed.segments) {
      const nextNodes = [];

      if (seg.type === "property") {
        for (const node of currentNodes) {
          const val = node.value;
          if (val && typeof val === "object" && Object.prototype.hasOwnProperty.call(val, seg.name)) {
            const childPath = /^[a-zA-Z0-9_$]+$/.test(seg.name)
              ? `${node.path}.${seg.name}`
              : `${node.path}['${seg.name}']`;
            nextNodes.push({ path: childPath, value: val[seg.name] });
          }
        }
      } else if (seg.type === "index") {
        for (const node of currentNodes) {
          const val = node.value;
          if (Array.isArray(val)) {
            const actualIdx = seg.index < 0 ? val.length + seg.index : seg.index;
            if (actualIdx >= 0 && actualIdx < val.length) {
              nextNodes.push({ path: `${node.path}[${actualIdx}]`, value: val[actualIdx] });
            }
          }
        }
      } else if (seg.type === "wildcard") {
        for (const node of currentNodes) {
          const val = node.value;
          if (Array.isArray(val)) {
            for (let i = 0; i < val.length; i++) {
              nextNodes.push({ path: `${node.path}[${i}]`, value: val[i] });
            }
          } else if (val && typeof val === "object") {
            for (const [k, v] of Object.entries(val)) {
              const childPath = /^[a-zA-Z0-9_$]+$/.test(k)
                ? `${node.path}.${k}`
                : `${node.path}['${k}']`;
              nextNodes.push({ path: childPath, value: v });
            }
          }
        }
      } else if (seg.type === "slice") {
        for (const node of currentNodes) {
          const val = node.value;
          if (Array.isArray(val)) {
            const start = seg.start < 0 ? Math.max(0, val.length + seg.start) : seg.start;
            const end = seg.end === null ? val.length : (seg.end < 0 ? Math.max(0, val.length + seg.end) : seg.end);
            for (let i = start; i < Math.min(end, val.length); i++) {
              nextNodes.push({ path: `${node.path}[${i}]`, value: val[i] });
            }
          }
        }
      } else if (seg.type === "union") {
        for (const node of currentNodes) {
          const val = node.value;
          if (Array.isArray(val)) {
            for (const item of seg.items) {
              if (typeof item === "number") {
                const actualIdx = item < 0 ? val.length + item : item;
                if (actualIdx >= 0 && actualIdx < val.length) {
                  nextNodes.push({ path: `${node.path}[${actualIdx}]`, value: val[actualIdx] });
                }
              }
            }
          } else if (val && typeof val === "object") {
            for (const item of seg.items) {
              const key = String(item);
              if (Object.prototype.hasOwnProperty.call(val, key)) {
                const childPath = /^[a-zA-Z0-9_$]+$/.test(key)
                  ? `${node.path}.${key}`
                  : `${node.path}['${key}']`;
                nextNodes.push({ path: childPath, value: val[key] });
              }
            }
          }
        }
      } else if (seg.type === "filter") {
        for (const node of currentNodes) {
          const val = node.value;
          if (Array.isArray(val)) {
            for (let i = 0; i < val.length; i++) {
              if (evaluateFilter(seg, val[i])) {
                nextNodes.push({ path: `${node.path}[${i}]`, value: val[i] });
              }
            }
          } else if (val && typeof val === "object") {
            for (const [k, v] of Object.entries(val)) {
              if (evaluateFilter(seg, v)) {
                const childPath = /^[a-zA-Z0-9_$]+$/.test(k)
                  ? `${node.path}.${k}`
                  : `${node.path}['${k}']`;
                nextNodes.push({ path: childPath, value: v });
              }
            }
          }
        }
      } else if (seg.type === "recursive") {
        const target = seg.target;
        for (const node of currentNodes) {
          walkAllDescendants(node.value, node.path, (childPath, childVal, key) => {
            if (target.type === "property") {
              if (String(key) === target.name) {
                nextNodes.push({ path: childPath, value: childVal });
              }
            } else if (target.type === "wildcard") {
              nextNodes.push({ path: childPath, value: childVal });
            } else if (target.type === "filter") {
              if (evaluateFilter(target, childVal)) {
                nextNodes.push({ path: childPath, value: childVal });
              }
            } else if (target.type === "index" && typeof key === "number" && key === target.index) {
              nextNodes.push({ path: childPath, value: childVal });
            }
          });
        }
      }

      currentNodes = nextNodes;
    }

    return {
      isValid: true,
      error: null,
      matches: currentNodes,
      count: currentNodes.length,
      isBlank: false,
    };
  }

  /**
   * Convert JSONPath (e.g. $.users[0].address.city) to dot/bracket code path (e.g. data.users[0].address.city).
   */
  function formatPathForCode(path = "", prefix = "data") {
    if (!path) return prefix;
    if (path === "$") return prefix;

    if (path.startsWith("$.")) {
      return `${prefix}.${path.slice(2)}`;
    }
    if (path.startsWith("$[")) {
      return `${prefix}${path.slice(1)}`;
    }
    if (path.startsWith("$")) {
      return `${prefix}${path.slice(1)}`;
    }
    if (path.startsWith("data.")) {
      if (prefix === "data") return path;
      return `$${path.slice(4)}`;
    }
    return `${prefix}.${path}`;
  }

  /**
   * Retrieve the exact value or subtree at a given JSONPath or code path.
   */
  function getValueByPath(data, path = "") {
    if (data === null || data === undefined) return undefined;
    if (!path || path === "$" || path === "data") return data;

    // Normalize: strip leading $ or data, replace [key] or [0] with .key or .0
    const normalized = path
      .replace(/^(?:\$|data)/, "")
      .replace(/\[['"]?([^'"\]]+)['"]?\]/g, ".$1");

    const segments = normalized.split(".").filter(Boolean);
    let curr = data;
    for (const seg of segments) {
      if (curr === null || curr === undefined || typeof curr !== "object") {
        return undefined;
      }
      curr = curr[seg];
    }
    return curr;
  }

  /**
   * Extract all ancestor paths for a given JSONPath to expand them in the tree.
   * e.g. "$.features[0].name" -> ["$", "$.features", "$.features[0]"]
   */
  function getAncestorPaths(path = "") {
    if (!path || path === "$") return ["$"];

    const ancestors = ["$"];
    let curr = "$";
    const rest = path.startsWith("$") ? path.slice(1) : path;

    // Match tokens: .prop, ['prop'], ["prop"], [0]
    const regex = /\.([a-zA-Z0-9_$-]+)|\[(?:'([^']+)'|"([^"]+)"|(-?\d+))\]/g;
    let match;
    const tokens = [];

    while ((match = regex.exec(rest)) !== null) {
      if (match[1] !== undefined) {
        tokens.push({ type: "prop", raw: `.${match[1]}` });
      } else if (match[2] !== undefined) {
        tokens.push({ type: "quoted", raw: `['${match[2]}']` });
      } else if (match[3] !== undefined) {
        tokens.push({ type: "quoted", raw: `["${match[3]}"]` });
      } else if (match[4] !== undefined) {
        tokens.push({ type: "index", raw: `[${match[4]}]` });
      }
    }

    // Omit the final leaf itself so we only return ancestors
    for (let i = 0; i < tokens.length - 1; i++) {
      curr += tokens[i].raw;
      ancestors.push(curr);
    }

    return ancestors;
  }

  return {
    parseBracketContent,
    parseFilterExpression,
    parseJsonPath,
    evaluateJsonPath,
    formatPathForCode,
    getValueByPath,
    getAncestorPaths,
  };
});

