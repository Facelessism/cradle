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
   * Comprehensive ReDoS (Regular Expression Denial of Service)
   * catastrophic backtracking complexity estimator and analyzer.
   * Analyzes nested quantifiers, overlapping alternation, and adjacent unbounded repetitions.
   */
  function analyzeReDoS(pattern) {
    if (typeof pattern !== "string" || !pattern) {
      return {
        score: 0,
        severity: "safe",
        complexity: "O(n) - Linear",
        isSafe: true,
        isUnsafe: false,
        reason: null,
        type: "clean",
        pattern: String(pattern ?? ""),
        vulnerabilities: [],
        recommendations: [
          "Pattern is empty or trivial. No backtracking risk.",
        ],
        attackPayload: null,
      };
    }

    try {
      // 1. Check for adjacent unconstrained repetitions, e.g. .*.* or \d+\d+ or \w+\w+
      const adjacentRepetitionRegex =
        /(?:\.\*|\.\+|\\[dwsp]\+|\\[dwsp]\*|[a-zA-Z0-9_]\[[a-zA-Z0-9_\-]+\]\+)(?:\.\*|\.\+|\\[dwsp]\+|\\[dwsp]\*)/;
      if (adjacentRepetitionRegex.test(pattern)) {
        return {
          score: 70,
          severity: "moderate",
          complexity: "O(n²) - Polynomial",
          isSafe: false,
          isUnsafe: true,
          reason:
            "Potentially catastrophic backtracking: adjacent unbounded quantifiers detected",
          type: "adjacent-quantifiers",
          pattern,
          vulnerabilities: [
            {
              type: "adjacent-quantifiers",
              title: "Adjacent Unbounded Quantifiers",
              severity: "moderate",
              explanation:
                "Two or more unbounded repetitions placed consecutively without non-overlapping delimiters cause polynomial O(n²) backtracking when matching fails.",
              recommendation:
                "Consolidate adjacent repetitions (e.g., change '.*.*' to '.*' or '\\d+\\d+' to '\\d{2,}').",
            },
          ],
          recommendations: [
            "Consolidate adjacent quantifiers into a single repetition (e.g. replace '.*.*' with '.*').",
            "Insert explicit non-overlapping delimiters between repeated tokens.",
            "Use bounded quantifiers {min,max} instead of open-ended wildcards.",
          ],
          attackPayload: "a".repeat(80) + "!",
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
                  score: 100,
                  severity: "critical",
                  complexity: "O(2ⁿ) - Exponential",
                  isSafe: false,
                  isUnsafe: true,
                  reason: `Potentially catastrophic backtracking: nested quantifier detected '(...)${groupQuantifier}'`,
                  type: "nested-quantifier",
                  pattern,
                  vulnerabilities: [
                    {
                      type: "nested-quantifier",
                      title: "Nested Quantifier ReDoS Risk",
                      severity: "critical",
                      explanation: `Group containing an inner quantifier is repeated with an outer quantifier '${groupQuantifier}'. This causes exponential O(2ⁿ) backtracking permutations on mismatched strings.`,
                      recommendation:
                        "Flatten nested repetition. Change '(X+)+' to 'X+' or apply repetition only at a single hierarchy level.",
                    },
                  ],
                  recommendations: [
                    "Remove redundant nested repetition: flatten '(a+)+' to 'a+'.",
                    "Use atomic grouping '(?>...)' or possessive quantifiers '++' where supported by your target runtime.",
                    "Ensure inner and outer sub-patterns match disjoint character sets.",
                  ],
                  attackPayload: "a".repeat(25) + "X",
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
                        score: 95,
                        severity: "critical",
                        complexity: "O(2ⁿ) - Exponential",
                        isSafe: false,
                        isUnsafe: true,
                        reason: `Potentially catastrophic backtracking: overlapping alternation with repetition '(${branches.join("|")})${groupQuantifier}'`,
                        type: "overlapping-alternation",
                        pattern,
                        vulnerabilities: [
                          {
                            type: "overlapping-alternation",
                            title: "Overlapping Alternation in Repeated Group",
                            severity: "critical",
                            explanation: `Alternation branches '${br1}' and '${br2}' can both match the same input inside a repeated group '${groupQuantifier}', creating exponential state explosion.`,
                            recommendation:
                              "Make alternation branches mutually exclusive so they do not share any common prefixes or matching characters.",
                          },
                        ],
                        recommendations: [
                          "Refactor alternation branches to be strictly mutually exclusive.",
                          "Extract common prefixes outside the repeated alternation group (e.g. 'a(b|c)+' instead of '(ab|ac)+').",
                          "Disallow empty or optional paths inside repeated alternation branches.",
                        ],
                        attackPayload: "a".repeat(25) + "X",
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

      // Fast check for nested quantifiers regex
      const nestedQuantifierRegex = /\((?:[^()\\]|\\.)*[+*?{][^()]*\)[+*{]/;
      if (nestedQuantifierRegex.test(pattern)) {
        return {
          score: 100,
          severity: "critical",
          complexity: "O(2ⁿ) - Exponential",
          isSafe: false,
          isUnsafe: true,
          reason:
            "Potentially catastrophic backtracking: nested quantifier detected",
          type: "nested-quantifier",
          pattern,
          vulnerabilities: [
            {
              type: "nested-quantifier",
              title: "Nested Quantifier Detected",
              severity: "critical",
              explanation:
                "Pattern contains nested repetitions that induce exponential backtracking upon trailing match failure.",
              recommendation:
                "Flatten nested repetitions into a single quantifier.",
            },
          ],
          recommendations: [
            "Flatten nested quantifiers into a single non-nested quantifier.",
            "Use possessive quantifiers or atomic groups if available.",
          ],
          attackPayload: "a".repeat(25) + "X",
        };
      }

      // Safe pattern
      return {
        score: 5,
        severity: "safe",
        complexity: "O(n) - Linear",
        isSafe: true,
        isUnsafe: false,
        reason: null,
        type: "clean",
        pattern,
        vulnerabilities: [],
        recommendations: [
          "Pattern demonstrates safe linear-time execution characteristics.",
          "No catastrophic backtracking vulnerabilities detected.",
        ],
        attackPayload: null,
      };
    } catch {
      return {
        score: 10,
        severity: "safe",
        complexity: "O(n) - Linear",
        isSafe: true,
        isUnsafe: false,
        reason: null,
        type: "clean",
        pattern,
        vulnerabilities: [],
        recommendations: ["Pattern parsed safely."],
        attackPayload: null,
      };
    }
  }

  /**
   * Helper to inspect pattern for catastrophic backtracking risks (ReDoS).
   * Backwards compatible delegate to analyzeReDoS.
   */
  function detectCatastrophicPattern(pattern) {
    return analyzeReDoS(pattern);
  }

  /** Boolean helper for catastrophic pattern check */
  function isCatastrophicPattern(pattern) {
    return detectCatastrophicPattern(pattern).isUnsafe;
  }

  /**
   * Generates production-ready, idiomatically formatted regex code snippets
   * with flag support and proper string escaping across multiple programming languages.
   *
   * Supported languages:
   * - JavaScript (RegExp)
   * - Python (re)
   * - Go (regexp)
   * - Rust (regex)
   * - Java (java.util.regex.Pattern)
   */
  function generateCodeSnippet(pattern, flags = "g", language = "javascript") {
    const safePattern =
      typeof pattern === "string" ? pattern : String(pattern ?? "");
    const cleanFlags = sanitizeFlags(flags);
    const lang = (language || "javascript").toLowerCase();

    const hasG = cleanFlags.includes("g");
    const hasI = cleanFlags.includes("i");
    const hasM = cleanFlags.includes("m");
    const hasS = cleanFlags.includes("s");
    const hasU = cleanFlags.includes("u");

    switch (lang) {
      case "javascript":
      case "js": {
        const escapedForSlash = safePattern.replace(/(?<!\\)\//g, "\\/");
        return `// JavaScript (RegExp)
const regex = /${escapedForSlash}/${cleanFlags};
const text = "sample text to test";

// Check if pattern matches
if (regex.test(text)) {
  console.log("Match found!");
}

// Extract all matches
const matches = [...text.matchAll(regex)];
for (const match of matches) {
  console.log(\`Found '\${match[0]}' at index \${match.index}\`);
}`;
      }

      case "python":
      case "py": {
        const pyFlags = [];
        if (hasI) pyFlags.push("re.IGNORECASE");
        if (hasM) pyFlags.push("re.MULTILINE");
        if (hasS) pyFlags.push("re.DOTALL");
        if (hasU) pyFlags.push("re.UNICODE");
        const flagsStr = pyFlags.length > 0 ? pyFlags.join(" | ") : "0";

        let pyPattern = safePattern;
        let quote = '"';
        if (pyPattern.includes('"') && !pyPattern.includes("'")) {
          quote = "'";
        } else if (pyPattern.includes('"')) {
          pyPattern = pyPattern.replace(/"/g, '\\"');
        }

        return `# Python (re module)
import re

pattern = r${quote}${pyPattern}${quote}
flags = ${flagsStr}
text = "sample text to test"

# Search for first match
match = re.search(pattern, text, flags)
if match:
    print(f"Match found: {match.group(0)} at span {match.span()}")

# Find all matches
for m in re.finditer(pattern, text, flags):
    print(f"Found '{m.group(0)}' at {m.span()}")`;
      }

      case "go":
      case "golang": {
        let goPattern = safePattern;
        let prefixFlags = "";
        if (hasI) prefixFlags += "i";
        if (hasM) prefixFlags += "m";
        if (hasS) prefixFlags += "s";
        if (prefixFlags) {
          goPattern = `(?${prefixFlags})${goPattern}`;
        }

        let patternLit;
        if (!goPattern.includes("`")) {
          patternLit = `\`${goPattern}\``;
        } else {
          patternLit = JSON.stringify(goPattern);
        }

        return `// Go (regexp package)
package main

import (
\t"fmt"
\t"regexp"
)

func main() {
\tpattern := ${patternLit}
\tre := regexp.MustCompile(pattern)
\ttext := "sample text to test"

\t// Check if text matches
\tif re.MatchString(text) {
\t\tfmt.Println("Match found!")
\t}

\t// Find all matching substrings with byte offsets
\tmatches := re.FindAllStringIndex(text, -1)
\tfor _, loc := range matches {
\t\tfmt.Printf("Found '%s' at [%d, %d]\\n", text[loc[0]:loc[1]], loc[0], loc[1])
\t}
}`;
      }

      case "rust": {
        let rustPattern = safePattern;
        let rustLit;
        if (!rustPattern.includes('"')) {
          rustLit = `r"${rustPattern}"`;
        } else if (!rustPattern.includes('r#"') && !rustPattern.includes('"#')) {
          rustLit = `r#"${rustPattern}"#`;
        } else {
          rustLit = `r##"${rustPattern}"##`;
        }

        const builderCalls = [];
        if (hasI) builderCalls.push("        .case_insensitive(true)");
        if (hasM) builderCalls.push("        .multi_line(true)");
        if (hasS) builderCalls.push("        .dot_matches_new_line(true)");
        if (hasU) builderCalls.push("        .unicode(true)");

        const builderChain =
          builderCalls.length > 0 ? "\n" + builderCalls.join("\n") : "";

        return `// Rust (regex crate)
use regex::RegexBuilder;

fn main() {
    let re = RegexBuilder::new(${rustLit})${builderChain}
        .build()
        .expect("Invalid regex pattern");

    let text = "sample text to test";

    // Test for a match
    if re.is_match(text) {
        println!("Match found!");
    }

    // Iterate over matches
    for mat in re.find_iter(text) {
        println!("Found '{}' at [{}..{}]", mat.as_str(), mat.start(), mat.end());
    }
}`;
      }

      case "java": {
        const javaFlags = [];
        if (hasI) javaFlags.push("Pattern.CASE_INSENSITIVE");
        if (hasM) javaFlags.push("Pattern.MULTILINE");
        if (hasS) javaFlags.push("Pattern.DOTALL");
        if (hasU) javaFlags.push("Pattern.UNICODE_CHARACTER_CLASS");
        const flagsStr = javaFlags.length > 0 ? javaFlags.join(" | ") : "0";

        // Double escape backslashes and escape quotes for Java string literals
        const javaPattern = safePattern
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"');

        return `// Java (java.util.regex)
import java.util.regex.Pattern;
import java.util.regex.Matcher;

public class RegexDemo {
    public static void main(String[] args) {
        String regex = "${javaPattern}";
        int flags = ${flagsStr};
        Pattern pattern = Pattern.compile(regex, flags);
        String text = "sample text to test";

        // Find and iterate matches
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            System.out.println("Found '" + matcher.group() + "' at [" + matcher.start() + ", " + matcher.end() + "]");
        }
    }
}`;
      }

      default:
        return generateCodeSnippet(safePattern, cleanFlags, "javascript");
    }
  }

  function generateAllCodeSnippets(pattern, flags = "g") {
    return {
      javascript: generateCodeSnippet(pattern, flags, "javascript"),
      python: generateCodeSnippet(pattern, flags, "python"),
      go: generateCodeSnippet(pattern, flags, "go"),
      rust: generateCodeSnippet(pattern, flags, "rust"),
      java: generateCodeSnippet(pattern, flags, "java"),
    };
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
    analyzeReDoS,
    generateCodeSnippet,
    generateAllCodeSnippets,
  };
});
