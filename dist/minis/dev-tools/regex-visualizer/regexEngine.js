/* =========================================================
   REGEX VISUALIZER — ENGINE MODULE
   Token parser, semantic explanation builder, substitution
   engine, and flag validator.
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
    const unique = Array.from(new Set(flags.split(""))).filter(f => VALID_FLAGS.includes(f));
    return unique.join("");
  }

  /** Safely compile RegExp instance or return error */
  function compileRegex(pattern, flags = "g") {
    try {
      const cleanFlags = sanitizeFlags(flags);
      const regex = new RegExp(pattern, cleanFlags);
      return { regex, error: null };
    } catch (err) {
      return { regex: null, error: err.message };
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
        tokens.push({ token: "^", type: "anchor", explanation: "Starts at the beginning of the string or line" });
        i++;
      } else if (char === "$") {
        tokens.push({ token: "$", type: "anchor", explanation: "Matches the end of the string or line" });
        i++;
      } else if (char === ".") {
        tokens.push({ token: ".", type: "wildcard", explanation: "Matches any single character except newline" });
        i++;
      } else if (char === "\\") {
        if (i + 1 < pattern.length) {
          const next = pattern[i + 1];
          let exp = `Escaped literal character '${next}'`;
          if (next === "d") exp = "Matches any digit character [0-9]";
          else if (next === "w") exp = "Matches any word character [a-zA-Z0-9_]";
          else if (next === "s") exp = "Matches any whitespace character";
          else if (next === "b") exp = "Matches a word boundary";

          tokens.push({ token: "\\" + next, type: "escape", explanation: exp });
          i += 2;
        } else {
          tokens.push({ token: "\\", type: "escape", explanation: "Trailing backslash" });
          i++;
        }
      } else if (char === "+" || char === "*" || char === "?") {
        const descriptions = {
          "+": "Matches 1 or more of the preceding token",
          "*": "Matches 0 or more of the preceding token",
          "?": "Matches 0 or 1 of the preceding token (optional)",
        };
        tokens.push({ token: char, type: "quantifier", explanation: descriptions[char] });
        i++;
      } else if (char === "(") {
        tokens.push({ token: "(", type: "group", explanation: "Starts a capture group" });
        i++;
      } else if (char === ")") {
        tokens.push({ token: ")", type: "group", explanation: "Ends a capture group" });
        i++;
      } else {
        tokens.push({ token: char, type: "literal", explanation: `Matches literal character '${char}'` });
        i++;
      }
    }

    return tokens;
  }

  /** Execute match substitution / replacement */
  function executeReplace(pattern, flags, inputStr, replacement) {
    const { regex, error } = compileRegex(pattern, flags);
    if (error || !regex) {
      return { output: inputStr, error: error || "Invalid Regex" };
    }
    try {
      const output = inputStr.replace(regex, replacement);
      return { output, error: null };
    } catch (err) {
      return { output: inputStr, error: err.message };
    }
  }

  return {
    sanitizeFlags,
    compileRegex,
    parsePatternTokens,
    executeReplace,
  };
});
