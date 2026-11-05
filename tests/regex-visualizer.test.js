import { test } from "node:test";
import assert from "node:assert/strict";
import RegexEngine from "../projects/dev-tools/regex-visualizer/regexEngine.js";

test("sanitizeFlags removes invalid flag characters and duplicates", () => {
  assert.equal(RegexEngine.sanitizeFlags("gimaxz"), "gim");
  assert.equal(RegexEngine.sanitizeFlags("gggg"), "g");
  assert.equal(RegexEngine.sanitizeFlags(null), "g");
  assert.equal(RegexEngine.sanitizeFlags("gdi"), "gdi");
});

test("compileRegex returns valid RegExp object for correct patterns", () => {
  const { regex, error } = RegexEngine.compileRegex("\\d+", "gi");
  assert.equal(error, null);
  assert.equal(regex instanceof RegExp, true);
  assert.equal(regex.test("123"), true);
});

test("compileRegex captures syntax error message for broken regex pattern", () => {
  const { regex, error } = RegexEngine.compileRegex("([a-z", "g");
  assert.equal(regex, null);
  assert.notEqual(error, null);
});

test("parsePatternTokens generates detailed semantic explanations", () => {
  const tokens = RegexEngine.parsePatternTokens("^\\d+$");
  assert.equal(tokens.length, 4);
  assert.equal(tokens[0].type, "anchor");
  assert.equal(tokens[1].token, "\\d");
  assert.equal(tokens[2].type, "quantifier");
  assert.equal(tokens[3].token, "$");
});

test("executeReplace performs string substitution accurately", () => {
  const { output, error } = RegexEngine.executeReplace(
    "hello",
    "i",
    "hello World",
    "hi"
  );
  assert.equal(error, null);
  assert.equal(output, "hi World");
});

test("detectCatastrophicPattern identifies nested quantifier ReDoS patterns", () => {
  const dangerousPatterns = [
    "(a+)+",
    "(a*)*",
    "([0-9]+)+",
    "(\\d+)+",
    "((a|a?)+)+",
    "^([a-zA-Z0-9]+)*$",
    "((a)+)+",
    "(a+){2,}",
  ];

  for (const pat of dangerousPatterns) {
    const check = RegexEngine.detectCatastrophicPattern(pat);
    assert.equal(
      check.isUnsafe,
      true,
      `Pattern '${pat}' should be flagged as unsafe`
    );
    assert.equal(check.isSafe, false);
    assert.ok(typeof check.reason === "string" && check.reason.length > 0);
    assert.equal(RegexEngine.isCatastrophicPattern(pat), true);
  }
});

test("detectCatastrophicPattern identifies overlapping alternation repetitions", () => {
  const overlappingPatterns = ["(a|aa)+", "(a|a)+", "(a|a?)+"];

  for (const pat of overlappingPatterns) {
    const check = RegexEngine.detectCatastrophicPattern(pat);
    assert.equal(
      check.isUnsafe,
      true,
      `Overlapping pattern '${pat}' should be flagged`
    );
    assert.equal(RegexEngine.isCatastrophicPattern(pat), true);
  }
});

test("detectCatastrophicPattern identifies adjacent unbounded repetitions", () => {
  const adjacentPatterns = [".*.*", "\\d+\\d+", "\\w+\\w+"];

  for (const pat of adjacentPatterns) {
    const check = RegexEngine.detectCatastrophicPattern(pat);
    assert.equal(
      check.isUnsafe,
      true,
      `Adjacent pattern '${pat}' should be flagged`
    );
  }
});

test("detectCatastrophicPattern permits safe expressions without false positives", () => {
  const safePatterns = [
    "\\d+",
    "[a-z0-9_-]+",
    "^([a-zA-Z0-9._%-]+)@([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6})$",
    "\\b\\d{4}-\\d{2}-\\d{2}\\b",
    "(a|b)+",
    "(hello|world)+",
    "(abc)+",
    "",
    null,
  ];

  for (const pat of safePatterns) {
    const check = RegexEngine.detectCatastrophicPattern(pat);
    assert.equal(
      check.isUnsafe,
      false,
      `Safe pattern '${pat}' should NOT be flagged`
    );
    assert.equal(check.isSafe, true);
    assert.equal(RegexEngine.isCatastrophicPattern(pat), false);
  }
});

test("compileRegex with checkSafety option rejects catastrophic patterns", () => {
  const dangerous = "(a+)+$";
  const safeRes = RegexEngine.compileRegex(dangerous, "g", {
    checkSafety: true,
  });
  assert.equal(safeRes.regex, null);
  assert.equal(safeRes.isUnsafe, true);
  assert.ok(safeRes.error.includes("catastrophic"));

  // Without checkSafety, returns compiled regex with warning metadata
  const standardRes = RegexEngine.compileRegex(dangerous, "g");
  assert.ok(standardRes.regex instanceof RegExp);
  assert.equal(standardRes.isUnsafe, true);
});

test("executeMatch enforces execution time-limits and match limits", () => {
  // Safe matching
  const matchRes = RegexEngine.executeMatch("\\w+", "g", "one two three");
  assert.equal(matchRes.error, null);
  assert.equal(matchRes.count, 3);
  assert.equal(matchRes.timedOut, false);
  assert.equal(matchRes.limitReached, false);

  // Catastrophic pattern blocked by default
  const unsafeMatch = RegexEngine.executeMatch(
    "(a+)+$",
    "g",
    "aaaaaaaaaaaaaaaa!"
  );
  assert.equal(unsafeMatch.isUnsafe, true);
  assert.ok(unsafeMatch.error.includes("catastrophic"));
  assert.equal(unsafeMatch.matches.length, 0);

  // Match limit enforcement
  const limited = RegexEngine.executeMatch("\\d", "g", "0123456789", {
    maxMatches: 5,
  });
  assert.equal(limited.matches.length, 5);
  assert.equal(limited.limitReached, true);
  assert.ok(limited.error.includes("limit reached"));
});

test("executeReplace respects checkSafety option", () => {
  const unsafeRep = RegexEngine.executeReplace(
    "(a+)+$",
    "g",
    "aaaaaaaaaaaa!",
    "b",
    { checkSafety: true }
  );
  assert.equal(unsafeRep.isUnsafe, true);
  assert.ok(unsafeRep.error.includes("catastrophic"));
});

test("fuzz testing: compileRegex handles malformed, adversarial, and mutated patterns", () => {
  const malformedPatterns = [
    "(abc",
    "[a-z",
    "([0-9",
    "*abc",
    "+abc",
    "?abc",
    "a++",
    "a***",
    "a{5,2}",
    "abc\\",
    "\\",
    "\\\\\\",
    "\\c",
    "\\k",
    "(?",
    "(?=",
    "(a+)+$",
    "((a|a?)+)+",
  ];

  const malformedFlags = [
    "",
    "g",
    "gi",
    "gimmick",
    "1234",
    "g!@#$%",
    "gggg",
    null,
    undefined,
    {},
  ];

  for (const pattern of malformedPatterns) {
    for (const flags of malformedFlags) {
      const res = RegexEngine.compileRegex(pattern, flags);
      assert.ok(res && typeof res === "object");
      assert.ok("regex" in res);
      assert.ok("error" in res);
    }
  }

  // Non-string patterns
  const nonStringPatterns = [null, undefined, 12345, {}, []];
  for (const pat of nonStringPatterns) {
    const res = RegexEngine.compileRegex(pat, "g");
    assert.ok(res && typeof res === "object");
  }
});

test("fuzz testing: parsePatternTokens and executeReplace survive adversarial inputs", () => {
  const adversarialPatterns = [
    "",
    "   ",
    null,
    undefined,
    12345,
    "\\",
    "\\\\",
    "^$.*+?()[]{}|\\",
    "((((((((((",
    "))))))))))",
  ];

  for (const pat of adversarialPatterns) {
    const tokens = RegexEngine.parsePatternTokens(pat);
    assert.ok(Array.isArray(tokens));
    for (const tok of tokens) {
      assert.ok(typeof tok.token === "string");
      assert.ok(typeof tok.type === "string");
      assert.ok(typeof tok.explanation === "string");
    }
  }

  // Replacement fuzzing
  const replacements = [
    "$$",
    "$&",
    "$`",
    "$'",
    "$1",
    "$99",
    "$<name>",
    null,
    undefined,
    123,
  ];
  for (const rep of replacements) {
    const res = RegexEngine.executeReplace("(\\w+)", "g", "hello world", rep);
    assert.ok(res && typeof res === "object");
    assert.ok(typeof res.output === "string");
  }
});

test("getPatternCaptureGroups identifies numbered and named capture groups", () => {
  // Pure numbered groups
  const numbered = RegexEngine.getPatternCaptureGroups("([a-z]+)@([a-z.]+)");
  assert.equal(numbered.length, 2);
  assert.equal(numbered[0].index, 1);
  assert.equal(numbered[0].name, null);
  assert.equal(numbered[1].index, 2);
  assert.equal(numbered[1].name, null);

  // Named capture groups (?<name>...)
  const named = RegexEngine.getPatternCaptureGroups(
    "(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})"
  );
  assert.equal(named.length, 3);
  assert.equal(named[0].index, 1);
  assert.equal(named[0].name, "year");
  assert.equal(named[1].index, 2);
  assert.equal(named[1].name, "month");
  assert.equal(named[2].index, 3);
  assert.equal(named[2].name, "day");

  // Mixed named, numbered, non-capturing (?:...), and lookaround assertions (?=...)
  const mixed = RegexEngine.getPatternCaptureGroups(
    "(?:https?://)?(?<domain>[a-z0-9.-]+)(?::(\\d+))?(?=/api)"
  );
  assert.equal(mixed.length, 2);
  assert.equal(mixed[0].index, 1);
  assert.equal(mixed[0].name, "domain");
  assert.equal(mixed[1].index, 2);
  assert.equal(mixed[1].name, null);

  // Escaped parentheses and character classes must not count as capture groups
  const escaped = RegexEngine.getPatternCaptureGroups(
    "\\(notAGroup\\)[(alsoNot)]"
  );
  assert.equal(escaped.length, 0);
});

test("parseMatchGroups structures capture groups with names, ranges, and color classes", () => {
  const pattern = "(?<user>[a-z]+)@([a-z.]+)";
  const defs = RegexEngine.getPatternCaptureGroups(pattern);
  const regex = new RegExp(pattern, "gd");
  const match = regex.exec("contact alice@cradle.dev today");

  assert.ok(match);
  const groups = RegexEngine.parseMatchGroups(match, defs, 1);
  assert.equal(groups.length, 2);

  // Group 1 (Named 'user')
  assert.equal(groups[0].index, 1);
  assert.equal(groups[0].name, "user");
  assert.equal(groups[0].value, "alice");
  assert.equal(groups[0].isMatched, true);
  assert.equal(groups[0].colorClass, "g1");
  assert.equal(groups[0].start, 8);
  assert.equal(groups[0].end, 13);
  assert.equal(groups[0].length, 5);

  // Group 2 (Numbered)
  assert.equal(groups[1].index, 2);
  assert.equal(groups[1].name, null);
  assert.equal(groups[1].value, "cradle.dev");
  assert.equal(groups[1].isMatched, true);
  assert.equal(groups[1].colorClass, "g2");
  assert.equal(groups[1].start, 14);
  assert.equal(groups[1].end, 24);
  assert.equal(groups[1].length, 10);
});

test("buildGroupTree and renderGroupTreeNode generate nested color-coded pill overlays", () => {
  // Nested groups ((a)(b))
  const pattern = "((foo)(bar))";
  const defs = RegexEngine.getPatternCaptureGroups(pattern);
  const regex = new RegExp(pattern, "gd");
  const match = regex.exec("foobar");

  const groups = RegexEngine.parseMatchGroups(match, defs, 1);
  const tree = RegexEngine.buildGroupTree(match[0].length, groups);

  assert.equal(tree.children.length, 1); // Group 1 encloses Group 2 & 3
  assert.equal(tree.children[0].group.index, 1);
  assert.equal(tree.children[0].children.length, 2); // Group 2 and Group 3 are nested inside
  assert.equal(tree.children[0].children[0].group.index, 2);
  assert.equal(tree.children[0].children[1].group.index, 3);

  const rendered = RegexEngine.renderGroupTreeNode(tree, match[0]);
  assert.ok(rendered.includes('class="hl-group-pill hl-group-g1"'));
  assert.ok(rendered.includes('class="hl-group-pill hl-group-g2"'));
  assert.ok(rendered.includes('class="hl-group-pill hl-group-g3"'));
  assert.ok(rendered.includes("foo"));
  assert.ok(rendered.includes("bar"));
});

test("named capture groups generate data-group-name attributes in pill overlays", () => {
  const pattern = "(?<id>\\d+)";
  const defs = RegexEngine.getPatternCaptureGroups(pattern);
  const regex = new RegExp(pattern, "gd");
  const match = regex.exec("ID 42");

  const groups = RegexEngine.parseMatchGroups(match, defs, 1);
  const tree = RegexEngine.buildGroupTree(match[0].length, groups);
  const rendered = RegexEngine.renderGroupTreeNode(tree, match[0]);

  assert.ok(rendered.includes('data-group-name="id"'));
  assert.ok(rendered.includes('data-group-num="1"'));
  assert.ok(rendered.includes("42"));
});
