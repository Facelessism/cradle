const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseJSON,
  toYaml,
  toCsv,
  toXml,
  formatJSON,
  minifyJSON,
} = require('../projects/dev-tools/json-converter/logic');

/* ------------------------------------------------------------------ */
/* parseJSON                                                          */
/* ------------------------------------------------------------------ */

test('parseJSON accepts valid JSON', () => {
  const result = parseJSON('{"a":1}');

  assert.equal(result.valid, true);
  assert.deepEqual(result.value, { a: 1 });
});

test('parseJSON returns error for invalid JSON', () => {
  const result = parseJSON('{invalid}');

  assert.equal(result.valid, false);
  assert.ok(result.error.message);
  assert.ok(typeof result.error.line === 'number');
  assert.ok(typeof result.error.column === 'number');
});

test('parseJSON reports a line number >= 1', () => {
  const result = parseJSON('{\n  "a": }');

  assert.equal(result.valid, false);
  assert.ok(result.error.line >= 1);
  assert.ok(result.error.column >= 1);
  assert.ok(result.error.message.length > 0);
});

test('parseJSON handles empty object', () => {
  const result = parseJSON('{}');

  assert.equal(result.valid, true);
  assert.deepEqual(result.value, {});
});

test('parseJSON handles array root', () => {
  const result = parseJSON('[1,2,3]');

  assert.equal(result.valid, true);
  assert.deepEqual(result.value, [1, 2, 3]);
});

/* ------------------------------------------------------------------ */
/* toYaml                                                             */
/* ------------------------------------------------------------------ */

test('toYaml serialises a simple object', () => {
  const yaml = toYaml({ name: 'Alice', age: 30 }).trimStart();

  assert.match(yaml, /name:/);
  assert.match(yaml, /Alice/);
  assert.match(yaml, /age:/);
  assert.match(yaml, /30/);
});

test('toYaml handles nested objects', () => {
  const yaml = toYaml({ a: { b: { c: 1 } } }).trimStart();

  assert.match(yaml, /a:/);
  assert.match(yaml, /  b:/);
  assert.match(yaml, /    c: 1/);
});

test('toYaml serialises arrays', () => {
  const yaml = toYaml({ items: [1, 2, 3] }).trimStart();

  assert.match(yaml, /items:/);
  assert.match(yaml, /- 1/);
  assert.match(yaml, /- 2/);
  assert.match(yaml, /- 3/);
});

test('toYaml handles empty array', () => {
  const yaml = toYaml([]);

  assert.equal(yaml.trim(), '[]');
});

test('toYaml handles empty object', () => {
  const yaml = toYaml({});

  assert.equal(yaml.trim(), '{}');
});

test('toYaml handles null and boolean', () => {
  const yaml = toYaml({
    a: null,
    b: true,
    c: false,
  }).trimStart();

  assert.match(yaml, /a: ~/);
  assert.match(yaml, /b: true/);
  assert.match(yaml, /c: false/);
});

test('toYaml quotes strings with special characters', () => {
  const yaml = toYaml({
    msg: 'hello: world',
  }).trimStart();

  assert.match(yaml, /'/);
});

test('toYaml round-trips expected structure', () => {
  const obj = {
    name: 'Bob',
    scores: [9, 8, 7],
    active: true,
  };

  const yaml = toYaml(obj).trimStart();

  assert.ok(yaml.includes('name:'));
  assert.ok(yaml.includes('Bob'));
  assert.ok(yaml.includes('scores:'));
  assert.ok(yaml.includes('active: true'));
});

/* ------------------------------------------------------------------ */
/* toCsv                                                              */
/* ------------------------------------------------------------------ */

test('toCsv serialises an array of simple objects', () => {
  const csv = toCsv([
    { a: 1, b: 2 },
    { a: 3, b: 4 },
  ]);

  const lines = csv.split('\n');

  assert.equal(lines[0], 'a,b');
  assert.equal(lines[1], '1,2');
  assert.equal(lines[2], '3,4');
});

test('toCsv handles nested keys with dot notation', () => {
  const csv = toCsv([
    {
      user: {
        name: 'Alice',
      },
    },
  ]);

  assert.match(csv, /user\.name/);
  assert.match(csv, /Alice/);
});

test('toCsv escapes commas and quotes', () => {
  const csv = toCsv([
    {
      text: 'hello, world',
    },
  ]);

  assert.match(csv, /"hello, world"/);
});

test('toCsv handles single object input', () => {
  const csv = toCsv({
    name: 'Alice',
    age: 30,
  });

  assert.match(csv, /name,age/);
  assert.match(csv, /Alice,30/);
});

test('toCsv handles empty array', () => {
  const csv = toCsv([]);

  assert.equal(csv, '');
});

test('toCsv handles null/undefined', () => {
  assert.equal(toCsv(null), '');
  assert.equal(toCsv(undefined), '');
});

/* ------------------------------------------------------------------ */
/* toXml                                                              */
/* ------------------------------------------------------------------ */

test('toXml wraps content in root element', () => {
  const xml = toXml({
    name: 'Alice',
  });

  assert.match(xml, /<root>/);
  assert.match(xml, /<\/root>/);
  assert.match(xml, /<name>/);
  assert.match(xml, /Alice/);
});

test('toXml handles nested objects', () => {
  const xml = toXml({
    a: {
      b: 1,
    },
  });

  assert.match(xml, /<a>/);
  assert.match(xml, /<b>1<\/b>/);
  assert.match(xml, /<\/a>/);
});

test('toXml serialises arrays as repeated elements', () => {
  const xml = toXml({
    items: [1, 2, 3],
  });

  // Plural "items" becomes singular "item" for children.
  const matches = xml.match(/<item>/g);

  assert.equal(matches ? matches.length : 0, 3);
});

test('toXml escapes special characters', () => {
  const xml = toXml({
    text: 'a < b & c > d',
  });

  assert.match(xml, /a &lt; b &amp; c &gt; d/);
});

test('toXml handles empty values', () => {
  const xml = toXml({
    x: null,
    y: [],
  });

  assert.match(xml, /<x\/>/);
  assert.match(xml, /<y\/>/);
});

test('toXml accepts custom root name', () => {
  const xml = toXml(
    {
      a: 1,
    },
    'custom'
  );

  assert.match(xml, /<custom>/);
  assert.match(xml, /<\/custom>/);
});

/* ------------------------------------------------------------------ */
/* formatJSON / minifyJSON                                             */
/* ------------------------------------------------------------------ */

test('formatJSON pretty-prints valid JSON', () => {
  const formatted = formatJSON('{"a":1,"b":2}');

  assert.ok(formatted.includes('\n'));
  assert.ok(formatted.includes('  '));
});

test('formatJSON returns input unchanged on invalid JSON', () => {
  const input = '{bad}';

  assert.equal(formatJSON(input), input);
});

test('minifyJSON removes whitespace', () => {
  const minified = minifyJSON('{  "a" : 1  }');

  assert.equal(minified, '{"a":1}');
});

test('minifyJSON returns input unchanged on invalid JSON', () => {
  const input = '{bad}';

  assert.equal(minifyJSON(input), input);
});

/* ------------------------------------------------------------------ */
/* Round-trip / edge cases                                             */
/* ------------------------------------------------------------------ */

test('array of mixed objects collects all keys for CSV', () => {
  const csv = toCsv([
    { a: 1 },
    { b: 2 },
  ]);

  assert.match(csv, /a,b/);
  assert.match(csv, /1,/);
  assert.match(csv, /,2/);
});

test('deep nesting in YAML produces correct indentation', () => {
  const yaml = toYaml({
    lvl1: {
      lvl2: {
        lvl3: 'deep',
      },
    },
  }).trimStart();

  assert.match(yaml, /lvl1:/);
  assert.match(yaml, /  lvl2:/);
  assert.match(yaml, /    lvl3: deep/);
});

test('array of numbers in YAML', () => {
  const yaml = toYaml({
    nums: [10, 20, 30],
  }).trimStart();

  assert.match(yaml, /- 10/);
  assert.match(yaml, /- 20/);
  assert.match(yaml, /- 30/);
});

test('special characters in XML element names are sanitized', () => {
  const xml = toXml({
    'my element': 1,
  });

  assert.match(xml, /<my_element>/);
});