/* =========================================================
   REGEX VISUALIZER — ENGINE MODULE
   Token parser, semantic explanation builder, substitution
   engine, flag validator, catastrophic pattern detection,
   capture group inspector, and time-limited execution runner.
   ========================================================= */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.RegexEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const VALID_FLAGS = ["g", "i", "m", "s", "u", "y", "d"];

  /** Validate and sanitize regex flags string */
  function sanitizeFlags(flags = "") {
    if (typeof flags !== "string") return "g";
    const unique = Array.from(new Set(flags.split(""))).filter(f =>
      VALID_FLAGS.includes(f)
    );
    return unique.join("");
  }

  /**
   * Helper to inspect pattern for catastrophic backtracking risks (ReDoS).
   * Identifies:
   * 1. Nested quantifiers: e.g. (a+)+, (a*)*, ([0-9]+)+, (\d+)+, ((a|a?)+)+
   * 2. Overlapping alternation with repetition: e.g. (a|aa)+, (a|a)+, (a|a?)+
   * 3. Adjacent unconstrained repetitions: e.g. .*.*, \d+\d+, \w+\w+
   */
  function detectCatastrophicPattern(pattern) {
    if (typeof pattern !== "string" || !pattern) {
      return {
        isSafe: true,
        isUnsafe: false,
        reason: null,
        pattern: String(pattern ?? ""),
      };
    }

    try {
      // 1. Check for adjacent unconstrained repetitions, e.g. .*.* or \d+\d+ or \w+\w+
      const adjacentRepetitionRegex =
        /(?:\.\*|\.\+|\\[dwsp]\+|\\[dwsp]\*|[a-zA-Z0-9_]\[[a-zA-Z0-9_\-]+\]\+)(?:\.\*|\.\+|\\[dwsp]\+|\\[dwsp]\*)/;
      if (adjacentRepetitionRegex.test(pattern)) {
        return {
          isSafe: false,
          isUnsafe: true,
          reason:
            "Potentially catastrophic backtracking: adjacent unbounded quantifiers detected",
          type: "adjacent-quantifiers",
          pattern,
        };
      }

      // 2. Token-level group and quantifier scanner using a stack
      const stack = [];
      let inCharClass = false;
      let escaped = false;

      let i = 0;
      while (i < pattern.length) {
        const char = pattern[i];

        if (escaped) {
          escaped = false;
          if (stack.length > 0 && !inCharClass) {
            stack[stack.length - 1].currentBranch += "\\" + char;
          }
          i++;
          continue;
        }

        if (char === "\\") {
          escaped = true;
          i++;
          continue;
        }

        if (inCharClass) {
          if (char === "]") {
            inCharClass = false;
          }
          i++;
          continue;
        }

        if (char === "[") {
          inCharClass = true;
          if (stack.length > 0) {
            stack[stack.length - 1].currentBranch += char;
          }
          i++;
          continue;
        }

        if (char === "(") {
          let isLookaround = false;
          if (pattern[i + 1] === "?") {
            const next2 = pattern.slice(i + 1, i + 3);
            if (
              next2 === "?=" ||
              next2 === "?!" ||
              pattern.slice(i + 1, i + 4) === "?<=" ||
              pattern.slice(i + 1, i + 4) === "?<!"
            ) {
              isLookaround = true;
            }
          }

          stack.push({
            startIndex: i,
            hasQuantifier: false,
            hasSubgroupWithQuantifier: false,
            branches: [],
            currentBranch: "",
            isLookaround,
          });
          i++;
          continue;
        }

        if (char === ")") {
          if (stack.length > 0) {
            const group = stack.pop();
            group.branches.push(group.currentBranch);

            // Check if this group is followed by a quantifier
            let j = i + 1;
            let groupQuantifier = null;
            if (j < pattern.length) {
              const nextChar = pattern[j];
              if (nextChar === "+" || nextChar === "*") {
                groupQuantifier = nextChar;
                j++;
              } else if (nextChar === "{") {
                const closeBrace = pattern.indexOf("}", j);
                if (closeBrace !== -1) {
                  const range = pattern.slice(j + 1, closeBrace);
                  const parts = range.split(",").map(s => s.trim());
                  const min = parseInt(parts[0], 10);
                  const max =
                    parts.length > 1
                      ? parts[1] === ""
                        ? Infinity
                        : parseInt(parts[1], 10)
                      : min;
                  if (!isNaN(min) && (max > 1 || max === Infinity)) {
                    groupQuantifier = range;
                  }
                  j = closeBrace + 1;
                }
              }
            }

            if (groupQuantifier) {
              // Group is repeated. Check for nested repetition:
              if (group.hasQuantifier || group.hasSubgroupWithQuantifier) {
                return {
                  isSafe: false,
                  isUnsafe: true,
                  reason: `Potentially catastrophic backtracking: nested quantifier detected '(...)${groupQuantifier}'`,
                  type: "nested-quantifier",
                  pattern,
                };
              }

              // Check for overlapping alternation in repeated group, e.g. (a|aa)+ or (a|a)+
              if (group.branches.length > 1) {
                const branches = group.branches.map(b => b.trim());
                for (let b1 = 0; b1 < branches.length; b1++) {
                  for (let b2 = b1 + 1; b2 < branches.length; b2++) {
                    const br1 = branches[b1];
                    const br2 = branches[b2];
                    if (
                      br1 === br2 ||
                      (br1.length > 0 && br2.startsWith(br1)) ||
                      (br2.length > 0 && br1.startsWith(br2)) ||
                      br1.includes("?") ||
                      br2.includes("?")
                    ) {
                      return {
                        isSafe: false,
                        isUnsafe: true,
                        reason: `Potentially catastrophic backtracking: overlapping alternation with repetition '(${branches.join("|")})${groupQuantifier}'`,
                        type: "overlapping-alternation",
                        pattern,
                      };
                    }
                  }
                }
              }

              if (stack.length > 0) {
                stack[stack.length - 1].hasSubgroupWithQuantifier = true;
              }

              i = j;
              continue;
            } else {
              if (
                stack.length > 0 &&
                (group.hasQuantifier || group.hasSubgroupWithQuantifier)
              ) {
                stack[stack.length - 1].hasSubgroupWithQuantifier = true;
              }
            }
          }
          i++;
          continue;
        }

        if (char === "|") {
          if (stack.length > 0) {
            stack[stack.length - 1].branches.push(
              stack[stack.length - 1].currentBranch
            );
            stack[stack.length - 1].currentBranch = "";
          }
          i++;
          continue;
        }

        if (char === "+" || char === "*" || char === "?") {
          if (stack.length > 0) {
            stack[stack.length - 1].hasQuantifier = true;
            stack[stack.length - 1].currentBranch += char;
          }
          i++;
          continue;
        }

        if (char === "{") {
          const closeBrace = pattern.indexOf("}", i);
          if (closeBrace !== -1 && /^{\d+(?:,\d*)?}/.test(pattern.slice(i))) {
            if (stack.length > 0) {
              stack[stack.length - 1].hasQuantifier = true;
              stack[stack.length - 1].currentBranch += pattern.slice(
                i,
                closeBrace + 1
              );
            }
            i = closeBrace + 1;
            continue;
          }
        }

        if (stack.length > 0) {
          stack[stack.length - 1].currentBranch += char;
        }

        i++;
      }

      // Additional regex checks for fast nested-quantifier detection:
      const nestedQuantifierRegex = /\((?:[^()\\]|\\.)*[+*?{][^()]*\)[+*{]/;
      if (nestedQuantifierRegex.test(pattern)) {
        return {
          isSafe: false,
          isUnsafe: true,
          reason:
            "Potentially catastrophic backtracking: nested quantifier detected",
          type: "nested-quantifier",
          pattern,
        };
      }

      return {
        isSafe: true,
        isUnsafe: false,
        reason: null,
        pattern,
      };
    } catch {
      return {
        isSafe: true,
        isUnsafe: false,
        reason: null,
        pattern,
      };
    }
  }

  /** Boolean helper for catastrophic pattern check */
  function isCatastrophicPattern(pattern) {
    return detectCatastrophicPattern(pattern).isUnsafe;
  }

  /** Safely compile RegExp instance or return error */
  function compileRegex(pattern, flags = "g", options = {}) {
    try {
      const safePattern =
        typeof pattern === "string" ? pattern : String(pattern ?? "");
      const cleanFlags = sanitizeFlags(flags);

      const danger = detectCatastrophicPattern(safePattern);
      if (options && options.checkSafety && danger.isUnsafe) {
        return {
          regex: null,
          error: danger.reason || "Potentially catastrophic regular expression",
          isUnsafe: true,
          reason: danger.reason,
        };
      }

      const regex = new RegExp(safePattern, cleanFlags);
      return {
        regex,
        error: null,
        isUnsafe: danger.isUnsafe,
        reason: danger.reason,
      };
    } catch (err) {
      return {
        regex: null,
        error: err.message,
        isUnsafe: false,
        reason: null,
      };
    }
  }

  /** Parse pattern into token explanations */
  function parsePatternTokens(pattern) {
    if (!pattern || typeof pattern !== "string") return [];
    const tokens = [];
    let i = 0;

    while (i < pattern.length) {
      const char = pattern[i];

      if (char === "^") {
        tokens.push({
          token: "^",
          type: "anchor",
          explanation: "Starts at the beginning of the string or line",
        });
        i++;
      } else if (char === "$") {
        tokens.push({
          token: "$",
          type: "anchor",
          explanation: "Matches the end of the string or line",
        });
        i++;
      } else if (char === ".") {
        tokens.push({
          token: ".",
          type: "wildcard",
          explanation: "Matches any single character except newline",
        });
        i++;
      } else if (char === "\\") {
        if (i + 1 < pattern.length) {
          const next = pattern[i + 1];
          let exp = `Escaped literal character '${next}'`;
          if (next === "d") exp = "Matches any digit character [0-9]";
          else if (next === "w")
            exp = "Matches any word character [a-zA-Z0-9_]";
          else if (next === "s") exp = "Matches any whitespace character";
          else if (next === "b") exp = "Matches a word boundary";

          tokens.push({ token: "\\" + next, type: "escape", explanation: exp });
          i += 2;
        } else {
          tokens.push({
            token: "\\",
            type: "escape",
            explanation: "Trailing backslash",
          });
          i++;
        }
      } else if (char === "+" || char === "*" || char === "?") {
        const descriptions = {
          "+": "Matches 1 or more of the preceding token",
          "*": "Matches 0 or more of the preceding token",
          "?": "Matches 0 or 1 of the preceding token (optional)",
        };
        tokens.push({
          token: char,
          type: "quantifier",
          explanation: descriptions[char],
        });
        i++;
      } else if (char === "(") {
        if (pattern.startsWith("(?:", i)) {
          tokens.push({
            token: "(?:",
            type: "group",
            explanation: "Starts a non-capturing group",
          });
          i += 3;
          continue;
        }
        const namedMatch = pattern
          .slice(i)
          .match(/^\(\?<([a-zA-Z_$][a-zA-Z0-9_$]*)>/);
        if (namedMatch) {
          tokens.push({
            token: namedMatch[0],
            type: "group",
            explanation: `Starts a named capture group '<${namedMatch[1]}>'`,
          });
          i += namedMatch[0].length;
          continue;
        }
        tokens.push({
          token: "(",
          type: "group",
          explanation: "Starts a capture group",
        });
        i++;
      } else if (char === ")") {
        tokens.push({
          token: ")",
          type: "group",
          explanation: "Ends a capture group",
        });
        i++;
      } else {
        tokens.push({
          token: char,
          type: "literal",
          explanation: `Matches literal character '${char}'`,
        });
        i++;
      }
    }

    return tokens;
  }

  /**
   * Scans a regex pattern to discover all capturing group definitions,
   * their group index (1-based), and their name (if defined via (?<name>...)).
   *
   * @param {string} pattern - Raw regex pattern string.
   * @returns {Array<{ index: number, name: string | null }>} Array of group definitions.
   */
  function getPatternCaptureGroups(pattern) {
    if (typeof pattern !== "string" || !pattern) return [];

    const groups = [];
    let groupIndex = 1;
    let inCharClass = false;
    let escaped = false;

    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (inCharClass) {
        if (char === "]") inCharClass = false;
        continue;
      }

      if (char === "[") {
        inCharClass = true;
        continue;
      }

      if (char === "(") {
        // Non-capturing or assertion: (?:, (?=, (?!, (?<=, (?<!
        if (
          pattern.startsWith("(?:", i) ||
          pattern.startsWith("(?=", i) ||
          pattern.startsWith("(?!", i) ||
          pattern.startsWith("(?<=", i) ||
          pattern.startsWith("(?<!", i)
        ) {
          continue;
        }

        // Named capture: (?<name>
        const namedMatch = pattern
          .slice(i)
          .match(/^\(\?<([a-zA-Z_$][a-zA-Z0-9_$]*)>/);
        if (namedMatch) {
          groups.push({
            index: groupIndex,
            name: namedMatch[1],
          });
          groupIndex++;
          i += namedMatch[0].length - 1;
          continue;
        }

        // If it starts with (? but not named or non-capturing (other regex extension)
        if (pattern.startsWith("(?", i)) {
          continue;
        }

        // Standard numbered capturing group
        groups.push({
          index: groupIndex,
          name: null,
        });
        groupIndex++;
      }
    }

    return groups;
  }

  /**
   * Extracts [start, end] ranges for the full match and each group.
   * Uses native match.indices if available (flag 'd'), with a fallback locator.
   */
  function extractGroupIndices(match, fullMatchStr) {
    if (!match) return [];
    const matchIndex = typeof match.index === "number" ? match.index : 0;
    const matchLength =
      typeof fullMatchStr === "string"
        ? fullMatchStr.length
        : match[0]
          ? match[0].length
          : 0;

    if (match.indices && Array.isArray(match.indices)) {
      return match.indices.map(ind => {
        if (!ind) return null;
        return {
          start: ind[0],
          end: ind[1],
          relativeStart: ind[0] - matchIndex,
          relativeEnd: ind[1] - matchIndex,
        };
      });
    }

    const result = [
      {
        start: matchIndex,
        end: matchIndex + matchLength,
        relativeStart: 0,
        relativeEnd: matchLength,
      },
    ];

    let searchCursor = 0;
    for (let g = 1; g < match.length; g++) {
      const val = match[g];
      if (val === undefined) {
        result.push(null);
        continue;
      }
      let idx = fullMatchStr.indexOf(val, searchCursor);
      if (idx === -1) {
        idx = fullMatchStr.indexOf(val);
      }
      if (idx !== -1) {
        result.push({
          start: matchIndex + idx,
          end: matchIndex + idx + val.length,
          relativeStart: idx,
          relativeEnd: idx + val.length,
        });
        if (val.length > 0) {
          searchCursor = idx;
        }
      } else {
        result.push(null);
      }
    }

    return result;
  }

  /**
   * Maps an exec match to a structured list of capture groups with names,
   * ranges, values, and color classes.
   */
  function parseMatchGroups(match, patternCaptureGroups = [], matchNumber = 1) {
    if (!match) return [];
    const fullMatchStr = match[0] || "";
    const indices = extractGroupIndices(match, fullMatchStr);
    const groups = [];

    const defsMap = new Map();
    for (const def of patternCaptureGroups) {
      defsMap.set(def.index, def.name);
    }

    for (let g = 1; g < match.length; g++) {
      const val = match[g];
      const isMatched = val !== undefined;
      const ind = indices[g] || null;
      const name = defsMap.get(g) || null;
      const colorNum = ((g - 1) % 6) + 1;

      groups.push({
        matchNumber,
        index: g,
        name,
        value: isMatched ? val : null,
        isMatched,
        start: ind ? ind.start : null,
        end: ind ? ind.end : null,
        relativeStart: ind ? ind.relativeStart : null,
        relativeEnd: ind ? ind.relativeEnd : null,
        length: isMatched && typeof val === "string" ? val.length : 0,
        colorClass: `g${colorNum}`,
      });
    }

    return groups;
  }

  /**
   * Builds a nested group tree for rendering pill overlays without overlapping tags.
   */
  function buildGroupTree(matchLength, groups = []) {
    const root = {
      start: 0,
      end: matchLength,
      isRoot: true,
      children: [],
    };

    const validGroups = groups.filter(
      g =>
        g.isMatched &&
        typeof g.relativeStart === "number" &&
        typeof g.relativeEnd === "number" &&
        g.relativeStart >= 0 &&
        g.relativeEnd <= matchLength &&
        g.relativeStart <= g.relativeEnd
    );

    // Sort outer enclosing groups before inner groups
    validGroups.sort((a, b) => {
      if (a.relativeStart !== b.relativeStart) {
        return a.relativeStart - b.relativeStart;
      }
      return (
        b.relativeEnd - b.relativeStart - (a.relativeEnd - a.relativeStart)
      );
    });

    function insertNode(parent, node) {
      for (const child of parent.children) {
        if (node.start >= child.start && node.end <= child.end) {
          insertNode(child, node);
          return;
        }
      }
      const newChildren = [];
      const childrenToAdopt = [];
      for (const child of parent.children) {
        if (child.start >= node.start && child.end <= node.end) {
          childrenToAdopt.push(child);
        } else {
          newChildren.push(child);
        }
      }
      node.children = childrenToAdopt;
      newChildren.push(node);
      newChildren.sort((a, b) => a.start - b.start);
      parent.children = newChildren;
    }

    for (const group of validGroups) {
      const node = {
        start: group.relativeStart,
        end: group.relativeEnd,
        group,
        children: [],
      };
      insertNode(root, node);
    }

    return root;
  }

  /**
   * Recursively renders a group tree to an HTML string with color-coded pill spans.
   */
  function renderGroupTreeNode(
    node,
    text,
    escapeFn = str => String(str ?? "")
  ) {
    let result = "";
    let lastIndex = node.start;

    for (const child of node.children) {
      if (child.start > lastIndex) {
        result += escapeFn(text.substring(lastIndex, child.start));
      }
      const innerHtml = renderGroupTreeNode(child, text, escapeFn);
      const g = child.group;
      const groupNameAttr = g.name
        ? ` data-group-name="${escapeFn(g.name)}"`
        : "";
      const groupNumAttr = ` data-group-num="${g.index}"`;
      const matchNumAttr = ` data-match-num="${g.matchNumber || 1}"`;
      const titleText = g.name
        ? `Group ${g.index} (<${g.name}>): "${g.value}" [${g.start}:${g.end}]`
        : `Group ${g.index}: "${g.value}" [${g.start}:${g.end}]`;

      result += `<span class="hl-group-pill hl-group-${g.colorClass}"${matchNumAttr}${groupNumAttr}${groupNameAttr} title="${escapeFn(titleText)}">${innerHtml}</span>`;
      lastIndex = child.end;
    }

    if (lastIndex < node.end) {
      result += escapeFn(text.substring(lastIndex, node.end));
    }

    return result;
  }

  /** Execute match substitution / replacement with safety and error handling */
  function executeReplace(
    pattern,
    flags,
    inputStr = "",
    replacement = "",
    options = {}
  ) {
    const safeInput =
      typeof inputStr === "string" ? inputStr : String(inputStr ?? "");
    const safeReplacement =
      typeof replacement === "string" ? replacement : String(replacement ?? "");

    if (options && options.checkSafety) {
      const danger = detectCatastrophicPattern(pattern);
      if (danger.isUnsafe) {
        return {
          output: safeInput,
          error:
            danger.reason ||
            "Execution blocked: potentially catastrophic regex pattern",
          isUnsafe: true,
        };
      }
    }

    const { regex, error } = compileRegex(pattern, flags);
    if (error || !regex) {
      return { output: safeInput, error: error || "Invalid Regex" };
    }
    try {
      const output = safeInput.replace(regex, safeReplacement);
      return { output, error: null };
    } catch (err) {
      return { output: safeInput, error: err.message };
    }
  }

  /** Safely execute regex matching with execution timeout and match limits */
  function executeMatch(pattern, flags = "g", inputStr = "", options = {}) {
    const timeoutMs =
      typeof options.timeoutMs === "number" ? options.timeoutMs : 250;
    const maxMatches =
      typeof options.maxMatches === "number" ? options.maxMatches : 2000;
    const checkSafety = options.checkSafety !== false;

    const safeInput =
      typeof inputStr === "string" ? inputStr : String(inputStr ?? "");

    if (checkSafety) {
      const danger = detectCatastrophicPattern(pattern);
      if (danger.isUnsafe) {
        return {
          matches: [],
          count: 0,
          error:
            danger.reason ||
            "Execution blocked: potentially catastrophic regex pattern",
          isUnsafe: true,
          timedOut: false,
          limitReached: false,
        };
      }
    }

    const { regex, error } = compileRegex(pattern, flags);
    if (error || !regex) {
      return {
        matches: [],
        count: 0,
        error: error || "Invalid Regex",
        isUnsafe: false,
        timedOut: false,
        limitReached: false,
      };
    }

    const matches = [];
    const startTime = Date.now();
    let timedOut = false;
    let limitReached = false;

    try {
      if (regex.global) {
        let lastIndex = -1;
        let match;
        while ((match = regex.exec(safeInput)) !== null) {
          if (Date.now() - startTime > timeoutMs) {
            timedOut = true;
            break;
          }
          if (matches.length >= maxMatches) {
            limitReached = true;
            break;
          }
          if (regex.lastIndex === lastIndex) {
            regex.lastIndex++;
          }
          lastIndex = regex.lastIndex;
          matches.push(match);
        }
      } else {
        const match = regex.exec(safeInput);
        if (Date.now() - startTime > timeoutMs) {
          timedOut = true;
        } else if (match) {
          matches.push(match);
        }
      }

      let err = null;
      if (timedOut) {
        err = `Execution timed out after ${timeoutMs}ms`;
      } else if (limitReached) {
        err = `Execution halted: match limit reached (${maxMatches})`;
      }

      return {
        matches,
        count: matches.length,
        error: err,
        isUnsafe: false,
        timedOut,
        limitReached,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (execErr) {
      return {
        matches,
        count: matches.length,
        error: execErr.message,
        isUnsafe: false,
        timedOut,
        limitReached,
      };
    }
  }

  return {
    VALID_FLAGS,
    sanitizeFlags,
    compileRegex,
    parsePatternTokens,
    getPatternCaptureGroups,
    extractGroupIndices,
    parseMatchGroups,
    buildGroupTree,
    renderGroupTreeNode,
    executeReplace,
    executeMatch,
    detectCatastrophicPattern,
    isCatastrophicPattern,
  };
});
