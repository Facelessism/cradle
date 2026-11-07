/**
 * Unit tests for CSS Grid Generator — gridEngine.js
 *
 * Tests the pure logic of the CSS Grid Engine:
 * - Column and row template resolution
 * - Explicit named grid line formatting
 * - Named grid areas building
 * - Drag-to-merge cell normalization
 * - Responsive media query CSS generation
 * - HTML markup generation and code export
 */

const GridEngine = require("../projects/dev-tools/css-grid-generator/gridEngine.js");

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

function assertEqual(actual, expected, msg) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg} — expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)}`);
  }
}

function heading(title) {
  console.log(`\n  ${title}`);
}

/* ──── Tests ──────────────────────────────────────────────────────── */

// ── Column and Row Template Resolution ──
heading("Template Resolution");

assertEqual(
  GridEngine.resolveColumnTemplate(3, "1fr 2fr 1fr"),
  "1fr 2fr 1fr",
  "resolves exact column count tokens"
);

assertEqual(
  GridEngine.resolveColumnTemplate(4, "1fr 1fr"),
  "repeat(4, 1fr)",
  "falls back to repeat when count exceeds tokens"
);

assertEqual(
  GridEngine.resolveRowTemplate(3, "auto 1fr auto"),
  "auto 1fr auto",
  "resolves exact row count tokens"
);

assertEqual(
  GridEngine.resolveRowTemplate(3, ""),
  "repeat(3, auto)",
  "falls back to repeat auto for empty row string"
);

// ── Explicit Named Grid Lines ──
heading("Named Grid Lines");

assertEqual(
  GridEngine.formatLineName("main-start"),
  "[main-start]",
  "formats single line name with brackets"
);

assertEqual(
  GridEngine.formatLineName("[header-end main-start]"),
  "[header-end main-start]",
  "formats multiple line names without double brackets"
);

assertEqual(
  GridEngine.formatLineName(["col-1", "sidebar-start"]),
  "[col-1 sidebar-start]",
  "formats array of line names"
);

assertEqual(
  GridEngine.formatLineName(""),
  "",
  "empty line name returns empty string"
);

const colNamedLines = ["full-start", "", "main-start", "full-end"];
const namedColTemplate = GridEngine.resolveColumnTemplateWithNames(
  3,
  "250px 1fr 300px",
  colNamedLines
);
assertEqual(
  namedColTemplate,
  "[full-start] 250px 1fr [main-start] 300px [full-end]",
  "resolves column template with explicit line names interleaved"
);

const rowNamedLines = ["header-start", "header-end content-start", "content-end"];
const namedRowTemplate = GridEngine.resolveRowTemplateWithNames(
  2,
  "80px 1fr",
  rowNamedLines
);
assertEqual(
  namedRowTemplate,
  "[header-start] 80px [header-end content-start] 1fr [content-end]",
  "resolves row template with explicit line names interleaved"
);

// ── Automatic Named Lines Inference from Areas ──
heading("Infer Named Lines From Areas");

const testItems = [
  { colStart: 1, colEnd: 4, rowStart: 1, rowEnd: 2, areaName: "header" },
  { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3, areaName: "sidebar" },
  { colStart: 2, colEnd: 4, rowStart: 2, rowEnd: 3, areaName: "main" },
  { colStart: 1, colEnd: 4, rowStart: 3, rowEnd: 4, areaName: "footer" },
];

const inferredLines = GridEngine.inferNamedLinesFromAreas(3, 3, testItems);
assert(
  inferredLines.colLines[0].includes("header-start") &&
    inferredLines.colLines[0].includes("sidebar-start") &&
    inferredLines.colLines[0].includes("footer-start"),
  "col line 0 receives start names for left-aligned areas"
);
assert(
  inferredLines.colLines[1].includes("sidebar-end") &&
    inferredLines.colLines[1].includes("main-start"),
  "col line 1 receives boundary names"
);
assert(
  inferredLines.rowLines[0].includes("header-start"),
  "row line 0 receives header-start"
);
assert(
  inferredLines.rowLines[3].includes("footer-end"),
  "row line 3 receives footer-end"
);

// ── Drag-to-Merge Cell Normalization ──
heading("mergeCellsToItem");

const mergedForward = GridEngine.mergeCellsToItem(1, 1, 2, 3, "hero", "#3b82f6");
assertEqual(mergedForward.rowStart, 1, "forward drag rowStart");
assertEqual(mergedForward.rowEnd, 3, "forward drag rowEnd");
assertEqual(mergedForward.colStart, 1, "forward drag colStart");
assertEqual(mergedForward.colEnd, 4, "forward drag colEnd");
assertEqual(mergedForward.areaName, "hero", "forward drag areaName");

const mergedBackward = GridEngine.mergeCellsToItem(3, 3, 1, 2, "main", "#10b981");
assertEqual(mergedBackward.rowStart, 1, "backward drag normalizes rowStart to min");
assertEqual(mergedBackward.rowEnd, 4, "backward drag normalizes rowEnd to max + 1");
assertEqual(mergedBackward.colStart, 2, "backward drag normalizes colStart to min");
assertEqual(mergedBackward.colEnd, 4, "backward drag normalizes colEnd to max + 1");

// ── Grid Template Areas ──
heading("buildTemplateAreas");

const areasString = GridEngine.buildTemplateAreas(3, 3, testItems);
const expectedAreas = `"header header header"\n    "sidebar main main"\n    "footer footer footer"`;
assertEqual(areasString, expectedAreas, "builds 2D grid-template-areas matrix string");

// Empty or unassigned cells
const partialItems = [
  { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2, areaName: "header" },
];
const partialAreas = GridEngine.buildTemplateAreas(2, 2, partialItems);
assert(partialAreas.includes("."), "unassigned cells are rendered as '.' dots");

// ── Responsive Media Queries in CSS Generation ──
heading("generateCSS with Named Lines & Responsive Queries");

const config = {
  columns: 3,
  rows: 3,
  colSize: "1fr 2fr 1fr",
  rowSize: "auto 1fr auto",
  colGap: "16px",
  rowGap: "16px",
  showAreas: true,
  enableNamedLines: true,
  namedColLines: inferredLines.colLines,
  namedRowLines: inferredLines.rowLines,
  includeResponsiveCSS: true,
};

const generatedCss = GridEngine.generateCSS(config, testItems);

assert(generatedCss.includes("display: grid;"), "CSS output includes display: grid");
assert(
  generatedCss.includes("grid-template-areas:"),
  "CSS output includes grid-template-areas"
);
assert(
  generatedCss.includes("[header-start"),
  "CSS output includes bracketed explicit line names"
);
assert(
  generatedCss.includes("@media (max-width: 768px)"),
  "CSS output includes responsive media query"
);
assert(
  generatedCss.includes("grid-template-columns: 1fr;"),
  "Responsive media query includes mobile single-column override"
);

// ── HTML and Code Generation ──
heading("generateHTML & generateCode");

const htmlOutput = GridEngine.generateHTML(testItems, true);
assert(htmlOutput.includes('<div class="grid-container">'), "HTML contains grid-container");
assert(htmlOutput.includes('<div class="header">header</div>'), "HTML contains semantic area classes");

const bothCode = GridEngine.generateCode("both", config, testItems);
assert(bothCode.includes("<!-- HTML -->") && bothCode.includes("/* CSS */"), "exports both tabs");

// ── Preset Layouts ──
heading("PRESETS");

assert(Boolean(GridEngine.PRESETS["holy-grail"]), "holy-grail preset exists");
assert(Boolean(GridEngine.PRESETS["sidebar"]), "sidebar preset exists");
assert(Boolean(GridEngine.PRESETS["dashboard"]), "dashboard preset exists");
assert(Boolean(GridEngine.PRESETS["cards"]), "cards preset exists");

/* ──── Summary ────────────────────────────────────────────────────── */
console.log(`\n────────────────────────────────────────`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`────────────────────────────────────────\n`);
process.exit(failed > 0 ? 1 : 0);

