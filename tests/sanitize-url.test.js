const test = require("node:test");
const assert = require("node:assert/strict");
const {
  sanitizeUrl,
} = require("../projects/productivity/terminal-portfolio-generator/exportHtml.js");
const engine = require("../projects/productivity/terminal-portfolio-generator/portfolioEngine.js");

// --- sanitizeUrl unit tests ---

test("sanitizeUrl allows https URLs", () => {
  assert.equal(sanitizeUrl("https://example.com"), "https://example.com");
  assert.equal(
    sanitizeUrl("https://github.com/user/repo"),
    "https://github.com/user/repo"
  );
});

test("sanitizeUrl allows http URLs", () => {
  assert.equal(sanitizeUrl("http://example.com"), "http://example.com");
});

test("sanitizeUrl allows mailto URIs", () => {
  assert.equal(
    sanitizeUrl("mailto:user@example.com"),
    "mailto:user@example.com"
  );
});

test("sanitizeUrl allows tel URIs", () => {
  assert.equal(sanitizeUrl("tel:+15551234567"), "tel:+15551234567");
});

test("sanitizeUrl returns empty string for data: URIs", () => {
  assert.equal(sanitizeUrl("data:text/html,<script>alert(1)</script>"), "");
  assert.equal(sanitizeUrl("data:image/png;base64,abc123"), "");
  assert.equal(sanitizeUrl("DATA:text/html,evil"), "");
});

test("sanitizeUrl returns empty string for javascript: URIs", () => {
  assert.equal(sanitizeUrl("javascript:alert(1)"), "");
  assert.equal(sanitizeUrl("JAVASCRIPT:alert(1)"), "");
  assert.equal(sanitizeUrl("javascript:void(0)"), "");
});

test("sanitizeUrl returns empty string for vbscript: URIs", () => {
  assert.equal(sanitizeUrl("vbscript:MsgBox(1)"), "");
  assert.equal(sanitizeUrl("VBSCRIPT:MsgBox(1)"), "");
});

test("sanitizeUrl returns empty string for blob: URIs", () => {
  assert.equal(sanitizeUrl("blob:https://example.com/abc-123"), "");
});

test("sanitizeUrl returns empty string for file: URIs", () => {
  assert.equal(sanitizeUrl("file:///etc/passwd"), "");
});

test("sanitizeUrl returns empty string for unknown schemes", () => {
  assert.equal(sanitizeUrl("ftp://evil.example.com/payload"), "");
  assert.equal(sanitizeUrl("chrome-extension://abc/background.js"), "");
  assert.equal(sanitizeUrl("about:blank"), "");
});

test("sanitizeUrl passes through scheme-less values unchanged", () => {
  assert.equal(sanitizeUrl("example.com"), "example.com");
  assert.equal(sanitizeUrl("github.com/user"), "github.com/user");
});

test("sanitizeUrl returns empty string for empty and blank input", () => {
  assert.equal(sanitizeUrl(""), "");
  assert.equal(sanitizeUrl("   "), "");
});

test("sanitizeUrl returns empty string for non-string values", () => {
  assert.equal(sanitizeUrl(null), "");
  assert.equal(sanitizeUrl(undefined), "");
  assert.equal(sanitizeUrl(42), "");
  assert.equal(sanitizeUrl({}), "");
});

test("sanitizeUrl trims surrounding whitespace before evaluating", () => {
  assert.equal(sanitizeUrl("  https://example.com  "), "https://example.com");
  assert.equal(sanitizeUrl("  javascript:alert(1)  "), "");
  assert.equal(sanitizeUrl("  data:text/html,bad  "), "");
});

// --- Integration: formatProjects drops dangerous project links ---

test("formatProjects omits a data: URI project link", () => {
  const portfolio = {
    name: "Dev",
    role: "Engineer",
    projects: [
      { name: "Evil App", link: "data:text/html,<script>alert(1)</script>" },
    ],
  };
  const { commands } = engine.buildCommandOutput(portfolio);
  const lines = commands.projects.lines;
  assert.ok(
    lines.some(l => l.includes("Evil App")),
    "project name should appear"
  );
  assert.ok(
    !lines.some(l => l.includes("data:")),
    "data: URI must not appear in output"
  );
  assert.ok(
    !lines.some(l => l.includes("link:")),
    "link line must be omitted entirely"
  );
});

test("formatProjects omits a javascript: URI project link", () => {
  const portfolio = {
    name: "Dev",
    role: "Engineer",
    projects: [{ name: "XSS Demo", link: "javascript:alert(document.cookie)" }],
  };
  const { commands } = engine.buildCommandOutput(portfolio);
  const lines = commands.projects.lines;
  assert.ok(
    !lines.some(l => l.includes("javascript:")),
    "javascript: URI must not appear"
  );
  assert.ok(
    !lines.some(l => l.includes("link:")),
    "link line must be omitted entirely"
  );
});

test("formatProjects includes a safe https project link", () => {
  const portfolio = {
    name: "Dev",
    role: "Engineer",
    projects: [{ name: "Safe App", link: "https://github.com/dev/safe-app" }],
  };
  const { commands } = engine.buildCommandOutput(portfolio);
  const lines = commands.projects.lines;
  assert.ok(
    lines.some(l => l.includes("link: https://github.com/dev/safe-app")),
    "safe link must appear"
  );
});

test("formatProjects handles a project with no link without error", () => {
  const portfolio = {
    name: "Dev",
    role: "Engineer",
    projects: [{ name: "No Link Project" }],
  };
  const { commands } = engine.buildCommandOutput(portfolio);
  const lines = commands.projects.lines;
  assert.ok(lines.some(l => l.includes("No Link Project")));
  assert.ok(!lines.some(l => l.includes("link:")));
});

// --- Integration: formatContact drops dangerous contact values ---

test("formatContact omits a data: URI contact value", () => {
  const portfolio = {
    name: "Dev",
    role: "Engineer",
    contact: { website: "data:text/html,<b>evil</b>" },
  };
  const { commands } = engine.buildCommandOutput(portfolio);
  const lines = commands.contact.lines;
  assert.ok(
    !lines.some(l => l.includes("data:")),
    "data: URI must not appear in contact"
  );
  assert.deepEqual(lines, ["No contact info provided yet."]);
});

test("formatContact omits a javascript: URI contact value", () => {
  const portfolio = {
    name: "Dev",
    role: "Engineer",
    contact: { github: "javascript:void(0)" },
  };
  const { commands } = engine.buildCommandOutput(portfolio);
  const lines = commands.contact.lines;
  assert.ok(
    !lines.some(l => l.includes("javascript:")),
    "javascript: URI must not appear"
  );
});

test("formatContact passes through safe mailto and https contact values", () => {
  const portfolio = {
    name: "Dev",
    role: "Engineer",
    contact: {
      email: "mailto:dev@example.com",
      github: "https://github.com/dev",
    },
  };
  const { commands } = engine.buildCommandOutput(portfolio);
  const lines = commands.contact.lines;
  assert.ok(lines.some(l => l.includes("email: mailto:dev@example.com")));
  assert.ok(lines.some(l => l.includes("github: https://github.com/dev")));
});

test("formatContact falls back to no contact info when all values are blocked", () => {
  const portfolio = {
    name: "Dev",
    role: "Engineer",
    contact: {
      website: "data:text/html,evil",
      github: "javascript:alert(1)",
    },
  };
  const { commands } = engine.buildCommandOutput(portfolio);
  const lines = commands.contact.lines;
  assert.deepEqual(lines, ["No contact info provided yet."]);
});

// --- generateStandaloneHtml does not embed blocked URIs ---

test("generateStandaloneHtml output does not embed a data: URI from a project link", () => {
  const {
    generateStandaloneHtml,
  } = require("../projects/productivity/terminal-portfolio-generator/exportHtml.js");
  const portfolio = {
    name: "Dev",
    role: "Engineer",
    projects: [
      { name: "Evil", link: "data:text/html,<script>alert(1)</script>" },
    ],
  };
  const { commands, autoRunOrder } = engine.buildCommandOutput(portfolio);
  const html = generateStandaloneHtml(
    portfolio,
    { commands, autoRunOrder },
    null
  );
  assert.ok(
    !html.includes("data:text/html"),
    "data: URI must not appear anywhere in exported HTML"
  );
  assert.ok(
    !html.includes("<script>alert"),
    "script payload must not appear in exported HTML"
  );
});

test("generateStandaloneHtml output does not embed a javascript: URI from a contact field", () => {
  const {
    generateStandaloneHtml,
  } = require("../projects/productivity/terminal-portfolio-generator/exportHtml.js");
  const portfolio = {
    name: "Dev",
    role: "Engineer",
    contact: { github: "javascript:alert(document.cookie)" },
  };
  const { commands, autoRunOrder } = engine.buildCommandOutput(portfolio);
  const html = generateStandaloneHtml(
    portfolio,
    { commands, autoRunOrder },
    null
  );
  assert.ok(
    !html.includes("javascript:"),
    "javascript: URI must not appear in exported HTML"
  );
});
