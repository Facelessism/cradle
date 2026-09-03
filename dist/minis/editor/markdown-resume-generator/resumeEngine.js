/**
 * Markdown Resume Generator Engine (resumeEngine.js)
 * Parses Markdown resume syntax into semantic HTML, computes ATS completeness scores, and exports standalone HTML.
 * UMD compliant for Node.js test suites and browser execution.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ResumeEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  /**
   * Parse inline Markdown styles (links, bold, italic).
   */
  function parseInlineMarkdown(text) {
    return text
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  /**
   * Parse Markdown resume text into structured semantic HTML string.
   */
  function parseMarkdownToHTML(markdown) {
    if (!markdown) return '<div class="resume-empty">No markdown content entered</div>';

    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let listOpen = false;

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (trimmed.startsWith("- ")) {
        if (!listOpen) {
          html.push("<ul>");
          listOpen = true;
        }
        const itemContent = parseInlineMarkdown(trimmed.slice(2));
        html.push(`<li>${itemContent}</li>`);
        return;
      }

      if (listOpen) {
        html.push("</ul>");
        listOpen = false;
      }

      if (!trimmed) {
        return;
      }

      if (trimmed.startsWith("# ")) {
        html.push(`<h1 class="resume-title">${parseInlineMarkdown(trimmed.slice(2))}</h1>`);
      } else if (trimmed.startsWith("## ")) {
        html.push(`<h2 class="section-title">${parseInlineMarkdown(trimmed.slice(3))}</h2>`);
      } else if (trimmed.startsWith("### ")) {
        html.push(`<h3 class="entry-title">${parseInlineMarkdown(trimmed.slice(4))}</h3>`);
      } else {
        html.push(`<p>${parseInlineMarkdown(trimmed)}</p>`);
      }
    });

    if (listOpen) {
      html.push("</ul>");
    }

    return html.join("\n");
  }

  /**
   * Calculate text statistics.
   */
  function calculateWordCount(markdown) {
    if (!markdown || !markdown.trim()) {
      return { words: 0, characters: 0, readTimeMinutes: 0 };
    }

    const words = markdown.trim().split(/\s+/).length;
    const characters = markdown.length;
    const readTimeMinutes = Math.ceil(words / 200);

    return { words, characters, readTimeMinutes };
  }

  /**
   * Evaluate ATS resume completeness score (0-100%).
   */
  function calculateATSScore(markdown) {
    if (!markdown) return 0;
    const lower = markdown.toLowerCase();

    let score = 0;
    const checks = {
      name: /^#\s+[^\n]+/m.test(markdown) ? 15 : 0,
      contact: /@|phone|email|\+?\d{10,}/i.test(markdown) ? 15 : 0,
      summary: /##\s*(summary|profile|about)/i.test(markdown) ? 15 : 0,
      experience: /##\s*(experience|work|employment)/i.test(markdown) ? 20 : 0,
      skills: /##\s*(skills|competencies)/i.test(markdown) ? 15 : 0,
      education: /##\s*(education|academic)/i.test(markdown) ? 10 : 0,
      projects: /##\s*(projects|portfolio)/i.test(markdown) ? 10 : 0,
    };

    score = Object.values(checks).reduce((a, b) => a + b, 0);
    return { score, breakdown: checks };
  }

  /**
   * Export complete standalone HTML document for printing/downloading.
   */
  function generateStandaloneHTML(markdown, template = "classic", theme = "slate") {
    const parsedBody = parseMarkdownToHTML(markdown);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Resume Export</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1e293b; padding: 2rem; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 2rem; color: #0f172a; border-bottom: 2px solid #cbd5e1; padding-bottom: 0.5rem; }
    h2 { font-size: 1.25rem; color: #334155; margin-top: 1.5rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; }
    h3 { font-size: 1rem; color: #475569; margin-top: 1rem; }
    ul { padding-left: 1.25rem; }
    li { margin-bottom: 0.25rem; }
    a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body class="template-${template} theme-${theme}">
  <main class="resume-content">
    ${parsedBody}
  </main>
</body>
</html>`;
  }

  return {
    parseInlineMarkdown,
    parseMarkdownToHTML,
    calculateWordCount,
    calculateATSScore,
    generateStandaloneHTML,
  };
});
