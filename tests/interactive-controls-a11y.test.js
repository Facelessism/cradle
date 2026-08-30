const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  getFiles,
  parseInteractiveElements,
} = require("../scripts/validate-accessible-labels");

const REPO_ROOT = path.resolve(__dirname, "..");

test("interactive range sliders expose accessible names, values, and tooltips", () => {
  const htmlFiles = getFiles(path.join(REPO_ROOT, "projects"));
  const sliders = [];

  for (const filePath of htmlFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const elements = parseInteractiveElements(content);
    for (const el of elements) {
      if (
        el.tagName === "input" &&
        (el.attributes.type || "").toLowerCase() === "range"
      ) {
        sliders.push({
          file: path.relative(REPO_ROOT, filePath).replace(/\\/g, "/"),
          line: el.lineNumber,
          id: el.attributes.id || "",
          label: el.attributes["aria-label"] || "",
          title: el.attributes.title || "",
          valuemin: el.attributes["aria-valuemin"] || el.attributes.min,
          valuemax: el.attributes["aria-valuemax"] || el.attributes.max,
          valuenow: el.attributes["aria-valuenow"] || el.attributes.value,
          valuetext: el.attributes["aria-valuetext"] || "",
        });
      }
    }
  }

  assert.ok(sliders.length > 0, "Found interactive range sliders across projects");

  for (const slider of sliders) {
    assert.ok(
      slider.label.length > 0,
      `Slider #${slider.id || slider.line} in ${slider.file} should have an aria-label`
    );
    assert.ok(
      slider.title.length > 0,
      `Slider #${slider.id || slider.line} in ${slider.file} should have a tooltip title`
    );
    assert.ok(
      slider.valuenow !== undefined && slider.valuenow !== "",
      `Slider #${slider.id || slider.line} in ${slider.file} should expose a current value`
    );
    assert.ok(
      slider.valuetext.length > 0,
      `Slider #${slider.id || slider.line} in ${slider.file} should have an aria-valuetext description`
    );
  }
});
