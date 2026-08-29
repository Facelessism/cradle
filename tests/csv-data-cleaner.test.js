const test = require("node:test");
const assert = require("node:assert/strict");
const CsvCleaner = require("../projects/file-tools/csv-data-cleaner/csvCleaner.js");

test("parseCsv parses headers and rows", () => {
  const parsed = CsvCleaner.parseCsv("Name,Email\nAsha,asha@example.com");
  assert.deepEqual(parsed.headers, ["Name", "Email"]);
  assert.deepEqual(parsed.rows, [["Asha", "asha@example.com"]]);
});

test("parseCsv handles quoted commas and escaped quotes", () => {
  const parsed = CsvCleaner.parseCsv('Name,Note\n"Patel, Dev","Said ""hello"""');
  assert.deepEqual(parsed.rows[0], ["Patel, Dev", 'Said "hello"']);
});

test("trimCells trims headers and row values", () => {
  const trimmed = CsvCleaner.trimCells({
    headers: [" Name ", " Email "],
    rows: [[" Asha ", " asha@example.com "]],
  });

  assert.deepEqual(trimmed.headers, ["Name", "Email"]);
  assert.deepEqual(trimmed.rows, [["Asha", "asha@example.com"]]);
});

test("removeEmptyRows removes rows with only blank cells", () => {
  const cleaned = CsvCleaner.removeEmptyRows({
    headers: ["Name", "Email"],
    rows: [["Asha", "asha@example.com"], ["", "  "], ["Mira", ""]],
  });

  assert.deepEqual(cleaned.rows, [["Asha", "asha@example.com"], ["Mira", ""]]);
});

test("removeDuplicateRows removes repeated rows", () => {
  const cleaned = CsvCleaner.removeDuplicateRows({
    headers: ["Name", "Email"],
    rows: [
      ["Asha", "asha@example.com"],
      ["Asha", "asha@example.com"],
      ["Mira", "mira@example.com"],
    ],
  });

  assert.deepEqual(cleaned.rows, [
    ["Asha", "asha@example.com"],
    ["Mira", "mira@example.com"],
  ]);
});

test("detectMissingValues reports blank cells", () => {
  const missing = CsvCleaner.detectMissingValues({
    headers: ["Name", "Email"],
    rows: [["Asha", ""], ["", "mira@example.com"]],
  });

  assert.deepEqual(missing, [
    { rowIndex: 0, columnIndex: 1, header: "Email" },
    { rowIndex: 1, columnIndex: 0, header: "Name" },
  ]);
});

test("cleanDataset returns summary counts", () => {
  const result = CsvCleaner.analyzeCsv("Name,Email\n Asha , a@example.com \n,\n Asha , a@example.com \nMira,");

  assert.deepEqual(result.dataset.rows, [
    ["Asha", "a@example.com"],
    ["Mira", ""],
  ]);
  assert.equal(result.summary.beforeRows, 4);
  assert.equal(result.summary.afterRows, 2);
  assert.equal(result.summary.emptyRowsRemoved, 1);
  assert.equal(result.summary.duplicateRowsRemoved, 1);
  assert.equal(result.summary.missingValueCount, 1);
});

test("exportCsv escapes commas, quotes, and newlines", () => {
  const exported = CsvCleaner.exportCsv({
    headers: ["Name", "Note"],
    rows: [["Patel, Dev", 'Line "one"\nLine two']],
  });

  assert.equal(exported, 'Name,Note\n"Patel, Dev","Line ""one""\nLine two"');
});

test("exportCsv pads short rows to header length", () => {
  const exported = CsvCleaner.exportCsv({
    headers: ["Name", "Email", "Role"],
    rows: [["Asha", "asha@example.com"]],
  });

  assert.equal(exported, "Name,Email,Role\nAsha,asha@example.com,");
});

test("parseCsv throws on empty or whitespace-only CSV input", () => {
  assert.throws(() => CsvCleaner.parseCsv(""), /CSV input is empty\./);
  assert.throws(() => CsvCleaner.parseCsv("   \n  \n"), /CSV input is empty\./);
});

test("parseCsv throws on unclosed quote", () => {
  assert.throws(() => CsvCleaner.parseCsv('Name,Email\n"Asha,asha@example.com'), /The CSV contains malformed quoting\./);
  assert.throws(() => CsvCleaner.parseCsv('Name,Email\nAsha,"asha@example.com'), /The CSV contains malformed quoting\./);
});

test("parseCsv throws on malformed quote inside field", () => {
  assert.throws(() => CsvCleaner.parseCsv('Name,Email\nAsha "Dev" Rao,asha@example.com'), /The CSV contains malformed quoting\./);
  assert.throws(() => CsvCleaner.parseCsv('Name,Email\n"Asha" Rao,asha@example.com'), /The CSV contains malformed quoting\./);
});

test("parseCsv detects column count mismatch warnings", () => {
  const result = CsvCleaner.analyzeCsv("Name,Email\nAsha,asha@example.com,Developer\nMira,mira@example.com\nPatel");
  
  assert.deepEqual(result.dataset.rows, [
    ["Asha", "asha@example.com"],
    ["Mira", "mira@example.com"],
    ["Patel", ""],
  ]);
  assert.equal(result.summary.warnings.length, 2);
  assert.match(result.summary.warnings[0], /Row 2 has an unexpected number of columns/);
  assert.match(result.summary.warnings[1], /Row 4 has an unexpected number of columns/);
});
