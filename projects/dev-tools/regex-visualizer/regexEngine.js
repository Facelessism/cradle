/* =========================================================
   REGEX VISUALIZER — ENGINE MODULE
   Token parser, semantic explanation builder, substitution
   engine, flag validator, catastrophic pattern detection, and
   time-limited execution runner.
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

  const VALID_FLAGS = ["g", "i", "m", "s", "u", "y"];

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
                      (br1.includes("?") || br2.includes("?"))
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
      const nestedQuantifierRegex =
        /\((?:[^()\\]|\\.)*[+*?{][^()]*\)[+*{]/;
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
    executeReplace,
    executeMatch,
    detectCatastrophicPattern,
    isCatastrophicPattern,
  };
});
