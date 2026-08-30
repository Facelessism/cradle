const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { validateAccessibleLabelsInContent } = require("../scripts/validate-accessible-labels");

const COMPONENT_PATH = path.join(__dirname, "../src/components/ProjectThumbnail.jsx");

test("ProjectThumbnail source exists and has valid JSX structure", () => {
  assert.ok(fs.existsSync(COMPONENT_PATH), "ProjectThumbnail.jsx must exist");
  const content = fs.readFileSync(COMPONENT_PATH, "utf8");

  assert.match(content, /export const ProjectThumbnail/, "Exports ProjectThumbnail component");
  assert.match(content, /<button[\s\S]*?<\/button>/, "Wraps interactive SVG inside a button tag");
  assert.match(content, /aria-label=\{`Open interactive project blueprint for \${projectTitle}`\}/, "Exposes descriptive aria-label on interactive trigger");
  assert.match(content, /role="img"/, "Exposes role='img' on SVG element");
  assert.match(content, /<title>\{`Interactive diagram preview of \${projectTitle}`\}<\/title>/, "Includes accessible title inside SVG element");
  assert.match(content, /aria-hidden="true"/, "Hides SVG vector path from screen reader text streams");
});

test("Interactive SVG thumbnail structures pass accessible label validation", () => {
  const sampleMarkup = `
    <div class="thumbnail-card">
      <button type="button" class="interactive-svg-trigger" aria-label="Open interactive project blueprint for Quantum Physics">
        <svg viewBox="0 0 100 100" role="img">
          <title>Interactive diagram preview of Quantum Physics</title>
          <path d="M10 10 H 90 V 90 H 10 Z" aria-hidden="true" />
        </svg>
      </button>
      <h3>Quantum Physics</h3>
    </div>
  `;

  const issues = validateAccessibleLabelsInContent(sampleMarkup, "ProjectThumbnail.jsx");
  assert.deepEqual(issues, [], "Interactive SVG thumbnail markup must have no accessibility label issues");
});
