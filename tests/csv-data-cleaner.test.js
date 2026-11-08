const test = require("node:test");
const assert = require("node:assert/strict");
const CsvCleaner = require("../projects/file-tools/csv-data-cleaner/csvCleaner.js");

test("parseCsv parses headers and rows", () => {
  const parsed = CsvCleaner.parseCsv("Name,Email\nAsha,asha@example.com");
  assert.deepEqual(parsed.headers, ["Name", "Email"]);
  assert.deepEqual(parsed.rows, [["Asha", "asha@example.com"]]);
});

test("parseCsv handles quoted commas and escaped quotes", () => {
  const parsed = CsvCleaner.parseCsv(
    'Name,Note\n"Patel, Dev","Said ""hello"""'
  );
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
    rows: [
      ["Asha", "asha@example.com"],
      ["", "  "],
      ["Mira", ""],
    ],
  });

  assert.deepEqual(cleaned.rows, [
    ["Asha", "asha@example.com"],
    ["Mira", ""],
  ]);
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
    rows: [
      ["Asha", ""],
      ["", "mira@example.com"],
    ],
  });

  assert.deepEqual(missing, [
    { rowIndex: 0, columnIndex: 1, header: "Email" },
    { rowIndex: 1, columnIndex: 0, header: "Name" },
  ]);
});

test("cleanDataset returns summary counts", () => {
  const result = CsvCleaner.analyzeCsv(
    "Name,Email\n Asha , a@example.com \n,\n Asha , a@example.com \nMira,"
  );

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
  assert.throws(
    () => CsvCleaner.parseCsv('Name,Email\n"Asha,asha@example.com'),
    /The CSV contains malformed quoting\./
  );
  assert.throws(
    () => CsvCleaner.parseCsv('Name,Email\nAsha,"asha@example.com'),
    /The CSV contains malformed quoting\./
  );
});

test("parseCsv throws on malformed quote inside field", () => {
  assert.throws(
    () => CsvCleaner.parseCsv('Name,Email\nAsha "Dev" Rao,asha@example.com'),
    /The CSV contains malformed quoting\./
  );
  assert.throws(
    () => CsvCleaner.parseCsv('Name,Email\n"Asha" Rao,asha@example.com'),
    /The CSV contains malformed quoting\./
  );
});

test("parseCsv detects column count mismatch warnings", () => {
  const result = CsvCleaner.analyzeCsv(
    "Name,Email\nAsha,asha@example.com,Developer\nMira,mira@example.com\nPatel"
  );

  assert.deepEqual(result.dataset.rows, [
    ["Asha", "asha@example.com"],
    ["Mira", "mira@example.com"],
    ["Patel", ""],
  ]);
  assert.equal(result.summary.warnings.length, 2);
  assert.match(
    result.summary.warnings[0],
    /Row 2 has an unexpected number of columns/
  );
  assert.match(
    result.summary.warnings[1],
    /Row 4 has an unexpected number of columns/
  );
});

test("fuzz testing: parseCsv survives randomized, malformed, and adversarial inputs", () => {
  const malformedInputs = [
    'a,b,c\n"unclosed quote,1,2',
    '"""triple quotes""","unmatched"',
    ",".repeat(200),
    "\r\r\n\n\r",
    'a,b\n"quote\nwith\nnewline",c',
    ' "spaced" , "quote" \n "1" , "2" ',
    "\0\x01\x02\t\n\r",
    'header1\n""\n"""',
  ];

  for (const input of malformedInputs) {
    try {
      const parsed = CsvCleaner.parseCsv(input);
      assert.ok(Array.isArray(parsed.headers));
      assert.ok(Array.isArray(parsed.rows));
    } catch (err) {
      assert.ok(err instanceof Error);
      assert.ok(typeof err.message === "string");
    }
  }

  // Non-string inputs throw descriptive error instead of crashing
  const nonStringInputs = [null, undefined, 123, {}, [], () => {}];
  for (const input of nonStringInputs) {
    assert.throws(() => CsvCleaner.parseCsv(input), /CSV input must be a string/);
  }
});

test("profileColumns infers types and computes statistical distributions", () => {
  const dataset = {
    headers: ["BirthDate", "Score", "Active", "Tier", "Description"],
    rows: [
      ["1990-05-12", "85", "true", "Gold", "Top performer"],
      ["1988-11-23", "92", "false", "Silver", "Solid worker"],
      ["1995-02-14", "78", "yes", "Gold", "New recruit"],
      ["1992-08-30", "96", "no", "Bronze", "Contributor"],
      ["", "88", "true", "Silver", "Senior lead"],
    ],
  };

  const profiles = CsvCleaner.profileColumns(dataset);
  assert.equal(profiles.length, 5);

  assert.equal(profiles[0].header, "BirthDate");
  assert.equal(profiles[0].inferredType, "DateTime");
  assert.equal(profiles[0].missingCount, 1);
  assert.equal(profiles[0].missingPct, 20);

  assert.equal(profiles[1].header, "Score");
  assert.equal(profiles[1].inferredType, "Numeric");
  assert.equal(profiles[1].stats.min, 78);
  assert.equal(profiles[1].stats.max, 96);
  assert.equal(profiles[1].stats.mean, 87.8);
  assert.equal(profiles[1].stats.median, 88);

  assert.equal(profiles[2].header, "Active");
  assert.equal(profiles[2].inferredType, "Boolean");

  assert.equal(profiles[3].header, "Tier");
  assert.equal(profiles[3].inferredType, "Categorical");
  assert.equal(profiles[3].uniqueCount, 3);

  assert.equal(profiles[4].header, "Description");
  assert.equal(profiles[4].inferredType, "String");
});

test("detectAnomalies flags outliers, unexpected whitespace, and mixed formats", () => {
  const dataset = {
    headers: ["Salary", "Joined", "Status"],
    rows: [
      ["50000", "2022-01-01", "Active"],
      ["52000", "2022-02-01", "Active"],
      ["48000", "2022-03-01", "Pending"],
      ["51000", "2022-04-01", "Active"],
      ["53000", "2022-05-01", "Pending"],
      ["500000", "2022-06-01", "Active"], // Outlier
      ["50500", "not-a-date", "Active"],   // Mixed format in DateTime
      ["51500", "2022-07-01", " Active "], // Whitespace
    ],
  };

  const anomalies = CsvCleaner.detectAnomalies(dataset);
  const outlierAnomalies = anomalies.filter(a => a.type === "outlier");
  const whitespaceAnomalies = anomalies.filter(a => a.type === "whitespace");
  const mixedAnomalies = anomalies.filter(a => a.type === "mixed_format");

  assert.ok(outlierAnomalies.length >= 1, "Should detect salary outlier");
  assert.equal(outlierAnomalies[0].value, "500000");

  assert.ok(whitespaceAnomalies.length >= 1, "Should detect unexpected whitespace");
  assert.equal(whitespaceAnomalies[0].value, " Active ");

  assert.ok(mixedAnomalies.length >= 1, "Should detect non-date value in DateTime column");
  assert.equal(mixedAnomalies[0].value, "not-a-date");
});

test("imputeMissingValues fills missing cells using mean, median, and mode", () => {
  const dataset = {
    headers: ["Score", "Role"],
    rows: [
      ["10", "Dev"],
      ["20", "Dev"],
      ["30", "Manager"],
      ["", ""],
    ],
  };

  // Mean imputation
  const imputedMean = CsvCleaner.imputeMissingValues(dataset, { strategy: "mean" });
  assert.equal(imputedMean.dataset.rows[3][0], "20");
  assert.equal(imputedMean.imputedCount, 1);

  // Auto imputation (mean/median for numeric, mode for categorical)
  const imputedAuto = CsvCleaner.imputeMissingValues(dataset, { strategy: "auto" });
  assert.equal(imputedAuto.dataset.rows[3][0], "20");
  assert.equal(imputedAuto.dataset.rows[3][1], "Dev");
  assert.equal(imputedAuto.imputedCount, 2);
});

test("normalizeTextCells trims, collapses whitespace, and strips control characters", () => {
  const dataset = {
    headers: ["Name", "Title"],
    rows: [
      ["  Alice   Smith  ", "Lead\tEngineer"],
      ["Bob\u00A0Jones", "Software\u0000Developer"],
    ],
  };

  const result = CsvCleaner.normalizeTextCells(dataset);
  assert.equal(result.dataset.rows[0][0], "Alice Smith");
  assert.equal(result.dataset.rows[0][1], "Lead Engineer");
  assert.equal(result.dataset.rows[1][0], "Bob Jones");
  assert.equal(result.dataset.rows[1][1], "Software Developer");
  assert.equal(result.modifiedCount, 4);
});

test("exportJson serializes dataset with typed values and nulls", () => {
  const dataset = {
    headers: ["Name", "Age", "Employed", "Notes"],
    rows: [
      ["Asha", "30", "true", "Top recruit"],
      ["Vikram", "42", "false", ""],
    ],
  };

  const jsonStr = CsvCleaner.exportJson(dataset, { typed: true });
  const parsed = JSON.parse(jsonStr);

  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0], {
    Name: "Asha",
    Age: 30,
    Employed: true,
    Notes: "Top recruit",
  });
  assert.deepEqual(parsed[1], {
    Name: "Vikram",
    Age: 42,
    Employed: false,
    Notes: null,
  });
});
