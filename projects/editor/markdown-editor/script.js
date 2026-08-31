/* ================================================================
   Markdown Editor — script.js
   Live preview, toolbar actions, keyboard shortcuts, export,
   resizable panes, and status bar. No framework dependencies.
   ================================================================ */

/* ── DOM References ─────────────────────────────────────────────── */

const $editor     = document.getElementById("editor");
const $preview    = document.getElementById("preview");
const $charCount  = document.getElementById("charCount");
const $wordCount  = document.getElementById("wordCount");
const $lineInfo   = document.getElementById("lineInfo");
const $readTime   = document.getElementById("readTime");
const $paneDivider = document.getElementById("paneDivider");
const $editorContainer = document.getElementById("editorContainer");

/* ── Marked.js Configuration ────────────────────────────────────── */

marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: true,
  mangle: false,
});

/* Custom renderer for syntax-highlighted code blocks */
const renderer = new marked.Renderer();
renderer.code = function (code, language) {
  const lang = language || "text";
  return `<pre class="code-block" data-lang="${lang}"><code class="language-${lang}">${escapeHtml(code)}</code></pre>`;
};
marked.use({ renderer });

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── Default Content ────────────────────────────────────────────── */

const DEFAULT_MARKDOWN = `# Welcome to Markdown Editor

Start typing on the **left** and see the **live preview** on the right.

## Features

- **Bold**, *italic*, ~~strikethrough~~
- Unordered and ordered lists
- [Links](https://example.com) and images
- Inline \`code\` and fenced code blocks
- Blockquotes and horizontal rules
- Tables

## Code Example

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));
\`\`\`

## Table

| Feature       | Status |
|---------------|--------|
| Live Preview  | ✅ Done |
| Toolbar       | ✅ Done |
| Export        | ✅ Done |

> Markdown makes writing for the web fast and enjoyable.

---

*Built with vanilla JS — no build step required.*
`;

/* ── State ──────────────────────────────────────────────────────── */

let suppressInput = false;

/* ── Core Render ────────────────────────────────────────────────── */

function renderPreview() {
  const md = $editor.value;
  try {
    $preview.innerHTML = marked.parse(md);
  } catch (e) {
    $preview.innerHTML = `<p style="color:var(--cradle-danger,#dc2626)">Parse error: ${escapeHtml(e.message)}</p>`;
  }
}

function updateCounts() {
  const text = $editor.value;
  const chars = text.length;
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const lines = text.split("\n").length;
  const readMin = Math.max(1, Math.ceil(words / 200));

  $charCount.textContent = `${chars.toLocaleString()} chars`;
  $wordCount.textContent = `${words.toLocaleString()} words`;
  $readTime.textContent = `~${readMin} min read`;
}

function updateLineInfo() {
  const val = $editor.value;
  const pos = $editor.selectionStart;
  const before = val.substring(0, pos);
  const line = before.split("\n").length;
  const col = pos - before.lastIndexOf("\n");
  $lineInfo.textContent = `Ln ${line}, Col ${col}`;
}

function syncAll() {
  if (suppressInput) return;
  renderPreview();
  updateCounts();
  updateLineInfo();
}

/* ── Toolbar Actions ────────────────────────────────────────────── */

const actions = {
  heading() {
    wrapLines("# ", "", "Heading");
  },
  bold() {
    wrapSelection("**", "**", "bold text");
  },
  italic() {
    wrapSelection("*", "*", "italic text");
  },
  strikethrough() {
    wrapSelection("~~", "~~", "strikethrough");
  },
  ul() {
    wrapLines("- ", "", "List item");
  },
  ol() {
    const lines = getSelectedLines();
    lines.forEach((line, i) => {
      if (!line.text.match(/^\d+\.\s/)) {
        replaceLine(line, `${i + 1}. ${line.text}`);
      }
    });
    commitLines(lines);
  },
  checklist() {
    wrapLines("- [ ] ", "", "Task item");
  },
  link() {
    const sel = getSelection_();
    if (sel.text) {
      replaceSelection(`[${sel.text}](url)`);
    } else {
      replaceSelection("[link text](url)");
    }
  },
  image() {
    replaceSelection("![alt text](image-url)");
  },
  code() {
    wrapSelection("`", "`", "code");
  },
  codeblock() {
    const sel = getSelection_();
    if (sel.text) {
      replaceSelection(`\`\`\`\n${sel.text}\n\`\`\``);
    } else {
      replaceSelection("```\ncode here\n```");
    }
  },
  quote() {
    wrapLines("> ", "", "Quote text");
  },
  hr() {
    insertAtCursor("\n---\n\n");
  },
  table() {
    insertAtCursor(
      "\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n"
    );
  },
};

/* ── Selection / Cursor Helpers ─────────────────────────────────── */

function getSelection_() {
  const start = $editor.selectionStart;
  const end = $editor.selectionEnd;
  return {
    text: $editor.value.substring(start, end),
    start,
    end,
  };
}

function replaceSelection(text) {
  const sel = getSelection_();
  suppressInput = true;
  $editor.setRangeText(text, sel.start, sel.end, "select");
  suppressInput = false;
  $editor.focus();
  syncAll();
}

function insertAtCursor(text) {
  const pos = $editor.selectionStart;
  suppressInput = true;
  $editor.setRangeText(text, pos, pos, "end");
  suppressInput = false;
  $editor.focus();
  syncAll();
}

function wrapSelection(before, after, placeholder) {
  const sel = getSelection_();
  const text = sel.text || placeholder;
  const replacement = `${before}${text}${after}`;
  suppressInput = true;
  $editor.setRangeText(replacement, sel.start, sel.end, "select");
  if (!sel.text) {
    /* Select the placeholder so user can type over it */
    $editor.selectionStart = sel.start + before.length;
    $editor.selectionEnd   = sel.start + before.length + placeholder.length;
  }
  suppressInput = false;
  $editor.focus();
  syncAll();
}

function getSelectedLines() {
  const sel = getSelection_();
  const before = $editor.value.substring(0, sel.start);
  const lineStart = before.lastIndexOf("\n") + 1;
  const after = $editor.value.substring(sel.end);
  const lineEnd = sel.end + after.indexOf("\n");
  const block = $editor.value.substring(lineStart, lineEnd === sel.end - 1 ? $editor.value.length : lineEnd);
  const lines = block.split("\n");
  return lines.map((text, i) => ({
    text,
    start: lineStart + block.indexOf(text),
    end: lineStart + block.indexOf(text) + text.length,
    index: i,
    totalLines: lines.length,
  }));
}

function replaceLine(line, newText) {
  suppressInput = true;
  $editor.setRangeText(newText, line.start, line.end, "end");
  suppressInput = false;
}

function commitLines(lines) {
  suppressInput = false;
  $editor.focus();
  syncAll();
}

/* ── Export Functions ────────────────────────────────────────────── */

function exportMarkdown() {
  const content = $editor.value;
  if (!content.trim()) return;
  downloadFile("document.md", content, "text/markdown");
}

function exportHTML() {
  const content = $editor.value;
  if (!content.trim()) return;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Exported Document</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6;
           color: #1f2937; background: #fff; }
    pre { background: #f3f4f6; padding: 1rem; border-radius: 8px; overflow-x: auto; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #2563eb; margin: 0; padding: 0.5rem 1rem;
                 background: #eff6ff; color: #1e3a8a; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
    th { background: #f9fafb; }
    img { max-width: 100%; }
    a { color: #2563eb; }
  </style>
</head>
<body>
${marked.parse(content)}
</body>
</html>`;
  downloadFile("document.html", html, "text/html");
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Resizable Panes ────────────────────────────────────────────── */

let isDragging = false;

$paneDivider.addEventListener("mousedown", (e) => {
  isDragging = true;
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const rect = $editorContainer.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const pct = Math.min(Math.max((x / rect.width) * 100, 20), 80);
  const editorPane = $editorContainer.querySelector(".editor-pane");
  const previewPane = $editorContainer.querySelector(".preview-pane");
  editorPane.style.flex = `0 0 ${pct}%`;
  previewPane.style.flex = `0 0 ${100 - pct}%`;
});

document.addEventListener("mouseup", () => {
  if (isDragging) {
    isDragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }
});

/* ── Keyboard Shortcuts ─────────────────────────────────────────── */

document.addEventListener("keydown", (e) => {
  if (!e.ctrlKey && !e.metaKey) return;

  const key = e.key.toLowerCase();
  const map = {
    b: "bold",
    i: "italic",
    d: "strikethrough",
    k: "link",
    q: "quote",
    h: "heading",
    "`": "code",
  };

  if (map[key]) {
    e.preventDefault();
    actions[map[key]]();
  }

  /* Ctrl+S = export MD */
  if (key === "s") {
    e.preventDefault();
    exportMarkdown();
  }
});

/* ── Event Listeners ────────────────────────────────────────────── */

$editor.addEventListener("input", syncAll);
$editor.addEventListener("keyup", updateLineInfo);
$editor.addEventListener("click", updateLineInfo);

document.getElementById("toolbar").addEventListener("click", (e) => {
  const btn = e.target.closest(".tool-btn");
  if (btn && btn.dataset.action && actions[btn.dataset.action]) {
    actions[btn.dataset.action]();
  }
});

document.getElementById("btn-export-md").addEventListener("click", exportMarkdown);
document.getElementById("btn-export-html").addEventListener("click", exportHTML);

/* Tab key inserts spaces instead of moving focus */
$editor.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    insertAtCursor("  ");
  }
});

/* ── Initialise ─────────────────────────────────────────────────── */

(function init() {
  const saved = localStorage.getItem("md_editor_content");
  $editor.value = saved !== null ? saved : DEFAULT_MARKDOWN;
  syncAll();

  /* Auto-save every 2 seconds */
  setInterval(() => {
    localStorage.setItem("md_editor_content", $editor.value);
  }, 2000);
})();
