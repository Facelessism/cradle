const test = require("node:test");
const assert = require("node:assert/strict");
const {
  encodeBase64,
  decodeBase64,
  encodeURLText,
  decodeURLText,
  encodeHTML,
  decodeHTML,
  encodeUnicode,
  decodeUnicode,
  encodeHex,
  decodeHex,
  encodeBinary,
  decodeBinary,
} = require("../projects/dev-tools/encoding-toolkit/logic");

test("Base64 round-trips plain and unicode text", () => {
  assert.equal(decodeBase64(encodeBase64("Hello, world!")), "Hello, world!");
  assert.equal(
    decodeBase64(encodeBase64("Hello, 世界! 🎉")),
    "Hello, 世界! 🎉"
  );
});

test("Base64 decode rejects malformed input", () => {
  assert.throws(() => decodeBase64("not-valid-base64!!"), /Invalid Base64/);
});

test("URL encoding round-trips reserved characters", () => {
  const input = "a b&c=d/世界";
  assert.equal(decodeURLText(encodeURLText(input)), input);
});

test("URL decode rejects malformed percent-encoding", () => {
  assert.throws(() => decodeURLText("%E0%A4%A"), /Malformed URL-encoded/);
});

test("HTML entity encoding escapes and unescapes reserved characters", () => {
  const input = `<a href="x">Tom & Jerry's</a>`;
  assert.equal(decodeHTML(encodeHTML(input)), input);
});

test("HTML decode supports numeric entities", () => {
  assert.equal(decodeHTML("&#65;&#x42;"), "AB");
});

test("HTML decode rejects unknown entities", () => {
  assert.throws(() => decodeHTML("&notarealentity;"), /Unknown HTML entity/);
});

test("Unicode escape round-trips text including astral code points", () => {
  const input = "Hi 🎉 é";
  assert.equal(decodeUnicode(encodeUnicode(input)), input);
});

test("Unicode decode rejects malformed escapes", () => {
  assert.throws(() => decodeUnicode("\\uZZZZ"), /Invalid Unicode escape/);
});

test("Hex encoding round-trips unicode text", () => {
  const input = "Hi 世";
  assert.equal(decodeHex(encodeHex(input)), input);
});

test("Hex decode rejects odd-length or non-hex input", () => {
  assert.throws(() => decodeHex("zz"), /Invalid Hex/);
  assert.throws(() => decodeHex("abc"), /Invalid Hex/);
});

test("Binary encoding round-trips text", () => {
  const input = "Hi!";
  assert.equal(decodeBinary(encodeBinary(input)), input);
});

test("Binary decode rejects malformed groups", () => {
  assert.throws(() => decodeBinary("123"), /Invalid Binary/);
});

test("empty input returns empty string for every decoder", () => {
  assert.equal(decodeBase64(""), "");
  assert.equal(decodeHex(""), "");
  assert.equal(decodeBinary(""), "");
  assert.equal(decodeUnicode(""), "");
});

/* ------------------------------------------------------------------ */
/* Unicode surrogate pairs, emoji, and supplementary plane characters */
/* ------------------------------------------------------------------ */

test("decodeUnicode correctly resolves surrogate pairs into supplementary code points", () => {
  // U+1F600 Grinning Face -> \uD83D\uDE00
  assert.equal(decodeUnicode("\\uD83D\\uDE00"), "😀");
  // U+1F389 Party Popper -> \uD83C\uDF89
  assert.equal(decodeUnicode("\\uD83C\\uDF89"), "🎉");
  // U+20BB7 Supplementary Ideograph -> \uD842\uDFB7
  assert.equal(decodeUnicode("\\uD842\\uDFB7"), "𠮷");
  // U+1D11E Musical G Clef -> \uD834\uDD1E
  assert.equal(decodeUnicode("\\uD834\\uDD1E"), "𝄞");
});

test("encodeUnicode supports surrogate pair formatting for supplementary plane characters", () => {
  const input = "😀 𠮷 𝄞";
  const encodedSurrogates = encodeUnicode(input, { surrogatePairs: true });
  assert.ok(encodedSurrogates.includes("\\ud83d\\ude00"));
  assert.ok(encodedSurrogates.includes("\\ud842\\udfb7"));
  assert.ok(encodedSurrogates.includes("\\ud834\\udd1e"));

  // Round-trip verification
  assert.equal(decodeUnicode(encodedSurrogates), input);
});

test("Unicode escape decodes mixed text containing both surrogate pairs and BMP escapes", () => {
  // "Hello 😀 World 𝄞" in Unicode escapes
  const mixed = "\\u0048\\u0065\\u006C\\u006C\\u006F\\u0020\\uD83D\\uDE00\\u0020\\u0057\\u006F\\u0072\\u006C\\u0064\\u0020\\uD834\\uDD1E";
  assert.equal(decodeUnicode(mixed), "Hello 😀 World 𝄞");
});

test("decodeUnicode rejects out-of-range code points above U+10FFFF", () => {
  assert.throws(() => decodeUnicode("\\u{110000}"), /Invalid Unicode escape/);
  assert.throws(() => decodeUnicode("\\u{FFFFFF}"), /Invalid Unicode escape/);
});

test("HTML decoding resolves numeric surrogate pair entities into supplementary characters", () => {
  // Hexadecimal surrogate pair: &#xD83D;&#xDE00; -> 😀
  assert.equal(decodeHTML("&#xD83D;&#xDE00;"), "😀");
  // Decimal surrogate pair: &#55357;&#56832; -> 😀
  assert.equal(decodeHTML("&#55357;&#56832;"), "😀");
  // Direct astral numeric entities
  assert.equal(decodeHTML("&#x1F600;"), "😀");
  assert.equal(decodeHTML("&#128512;"), "😀");
  assert.equal(decodeHTML("&#x20BB7;"), "𠮷");
});

test("HTML decode rejects malformed or out-of-bounds numeric entities", () => {
  assert.throws(() => decodeHTML("&#x110000;"), /Malformed HTML entity/);
  assert.throws(() => decodeHTML("&#1114112;"), /Malformed HTML entity/);
});

test("HTML encoding preserves emoji and supplementary-plane characters by default", () => {
  const input = "<p>Welcome to Cradle! 😀 & 🎉 𠮷</p>";
  const encoded = encodeHTML(input);
  assert.equal(encoded, "&lt;p&gt;Welcome to Cradle! 😀 &amp; 🎉 𠮷&lt;/p&gt;");
  assert.equal(decodeHTML(encoded), input);
});

test("HTML encoding can convert supplementary-plane characters to numeric entities when requested", () => {
  const input = "Hi 😀";
  const encoded = encodeHTML(input, { encodeNonAscii: true });
  assert.equal(encoded, "Hi &#x1F600;");
  assert.equal(decodeHTML(encoded), input);
});

test("Base64, Hex, and Binary round-trip complex ZWJ emoji, modifiers, and flags", () => {
  // ZWJ sequence family emoji: 👨‍👩‍👧‍👦
  // Skin tone modifier emoji: 👍🏽
  // Flag emoji: 🏳️‍🌈
  const complexEmojiText = "Family: 👨‍👩‍👧‍👦 | Modifier: 👍🏽 | Flag: 🏳️‍🌈 | Astral: 𠮷";

  assert.equal(decodeBase64(encodeBase64(complexEmojiText)), complexEmojiText);
  assert.equal(decodeHex(encodeHex(complexEmojiText)), complexEmojiText);
  assert.equal(decodeBinary(encodeBinary(complexEmojiText)), complexEmojiText);
  assert.equal(decodeURLText(encodeURLText(complexEmojiText)), complexEmojiText);
});
