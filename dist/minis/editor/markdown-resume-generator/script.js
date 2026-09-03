const DEFAULT_MARKDOWN = `# Demo User
Pune, India | Demo@example.com | +91 98765 43210 | [LinkedIn](https://linkedin.com/in/Demo) | [GitHub](https://github.com/Demo)

## Professional Summary
Cybersecurity and full-stack development learner with hands-on experience building web projects, security labs, and automation tools. Strong interest in SOC workflows, threat intelligence, and practical problem solving.

## Skills
- Frontend: HTML, CSS, JavaScript, React, responsive UI
- Backend: Node.js, Express, REST APIs, authentication flows
- Security: Wazuh, MITRE Caldera, access control, detection engineering basics
- Tools: Git, GitHub, Supabase, Streamlit, Linux, Windows

## Experience
### Cybersecurity Intern - NxtGenSec
**June 2026 - Present**
- Explored SOC tools including Tailscale, ZeroTier, Beszel, and MITRE Caldera.
- Built guided demos and documented practical workflows for student learning.
- Created detection notes for Windows event logs, Sysmon, and Wazuh alerts.

### Open Source Contributor
**2026**
- Implemented issue-based features across frontend and backend repositories.
- Added documentation, UI improvements, tests, and project-specific utilities.
- Practiced branch, commit, push, and pull request workflows.

## Projects
### AI SOC Copilot
- Designed a full-stack SOC assistant idea with threat intelligence enrichment.
- Planned integrations for OTX, MISP, Shodan, Hybrid Analysis, and Wazuh.

### Unified Reconnaissance App
- Built a beginner-friendly project plan for combining multiple information-gathering tools.
- Focused on safe, educational recon workflows and clear UI output.

## Education
### MirAI School of Technology
Virtual Summer Internship 2026 - AI Builder Track

## Certifications & Achievements
- Completed hands-on ZeroTier and Tailscale practicals.
- Presented MITRE Caldera workflow with agent deployment and operations overview.`;

const markdownInput = document.getElementById("markdownInput");
const resumePreview = document.getElementById("resumePreview");
const templateSelect = document.getElementById("templateSelect");
const themeSelect = document.getElementById("themeSelect");
const sampleBtn = document.getElementById("sampleBtn");
const copyBtn = document.getElementById("copyBtn");
const downloadMdBtn = document.getElementById("downloadMdBtn");
const downloadHtmlBtn = document.getElementById("downloadHtmlBtn");
const printBtn = document.getElementById("printBtn");
const statusMessage = document.getElementById("statusMessage");
const wordCount = document.getElementById("wordCount");

document.addEventListener("DOMContentLoaded", initializeResumeGenerator);

function initializeResumeGenerator() {
  markdownInput.value =
    localStorage.getItem("cradle:markdown-resume") || DEFAULT_MARKDOWN;
  templateSelect.value =
    localStorage.getItem("cradle:resume-template") || "classic";
  themeSelect.value = localStorage.getItem("cradle:resume-theme") || "slate";

  markdownInput.addEventListener("input", updatePreview);
  templateSelect.addEventListener("change", updatePreview);
  themeSelect.addEventListener("change", updatePreview);
  sampleBtn.addEventListener("click", loadSampleResume);
  copyBtn.addEventListener("click", copyMarkdown);
  downloadMdBtn.addEventListener("click", downloadMarkdown);
  downloadHtmlBtn.addEventListener("click", downloadResumeHtml);
  printBtn.addEventListener("click", printResume);

  updatePreview();
}

function updatePreview() {
  const markdown = markdownInput.value;
  const template = templateSelect.value;
  const theme = themeSelect.value;

  resumePreview.className = `resume-preview template-${template} theme-${theme}`;
  resumePreview.innerHTML = parseMarkdown(markdown);

  localStorage.setItem("cradle:markdown-resume", markdown);
  localStorage.setItem("cradle:resume-template", template);
  localStorage.setItem("cradle:resume-theme", theme);

  const words = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
  wordCount.textContent = `${words} word${words === 1 ? "" : "s"}`;
  setStatus("Preview updated");
}

function parseMarkdown(markdown) {
  if (typeof ResumeEngine !== "undefined" && ResumeEngine.parseMarkdownToHTML) {
    return ResumeEngine.parseMarkdownToHTML(markdown);
  }
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let listOpen = false;

  lines.forEach(line => {
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      return;
    }

    if (trimmed.startsWith("### ")) {
      closeList();
      html.push(`<h3>${formatInline(trimmed.slice(4))}</h3>`);
      return;
    }

    if (trimmed.startsWith("## ")) {
      closeList();
      html.push(`<h2>${formatInline(trimmed.slice(3))}</h2>`);
      return;
    }

    if (trimmed.startsWith("# ")) {
      closeList();
      html.push(`<h1>${formatInline(trimmed.slice(2))}</h1>`);
      return;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${formatInline(trimmed.replace(/^[-*]\s+/, ""))}</li>`);
      return;
    }

    closeList();
    html.push(`<p>${formatInline(trimmed)}</p>`);
  });

  closeList();
  return html.join("");

  function closeList() {
    if (!listOpen) return;
    html.push("</ul>");
    listOpen = false;
  }
}

function formatInline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
}

function loadSampleResume() {
  markdownInput.value = DEFAULT_MARKDOWN;
  updatePreview();
  markdownInput.focus();
  setStatus("Sample resume loaded");
}

async function copyMarkdown() {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: "Resume Markdown",
        text: markdownInput.value
      });
      setStatus("Markdown shared");
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
      // Fall through to clipboard copy
    }
  }

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(markdownInput.value);
      setStatus("Markdown copied");
    } else {
      setStatus("Copy unsupported");
    }
  } catch (error) {
    setStatus("Copy failed");
  }
}

function downloadMarkdown() {
  downloadFile("resume.md", markdownInput.value, "text/markdown");
  setStatus("Markdown downloaded");
}

function downloadResumeHtml() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resume</title>
  <style>${getExportStyles()}</style>
</head>
<body>
  <article class="${resumePreview.className}">${resumePreview.innerHTML}</article>
</body>
</html>`;

  downloadFile("resume.html", html, "text/html");
  setStatus("HTML exported");
}

function printResume() {
  setStatus("Opening print dialog");
  window.print();
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function getExportStyles() {
  return `
    body { margin: 0; background: #f3f4f6; color: #111827; font-family: Inter, Arial, sans-serif; }
    .resume-preview { width: min(840px, calc(100% - 32px)); margin: 24px auto; padding: 44px; background: #fff; color: #111827; box-shadow: 0 20px 60px rgba(0,0,0,.12); }
    .resume-preview h1 { margin: 0 0 6px; color: var(--resume-accent, #2563eb); font-size: 2.2rem; line-height: 1.1; }
    .resume-preview h2 { margin: 26px 0 10px; padding-bottom: 5px; border-bottom: 2px solid var(--resume-rule, #d1d5db); color: var(--resume-accent, #2563eb); font-size: 1rem; letter-spacing: .12em; text-transform: uppercase; }
    .resume-preview h3 { margin: 16px 0 4px; font-size: 1rem; }
    .resume-preview p { margin: 0 0 8px; color: #4b5563; line-height: 1.55; }
    .resume-preview ul { margin: 6px 0 12px 20px; padding: 0; }
    .resume-preview li { margin-bottom: 5px; color: #4b5563; line-height: 1.45; }
    .resume-preview a { color: var(--resume-accent, #2563eb); text-decoration: none; }
    .theme-slate { --resume-accent: #1f2937; --resume-rule: #d1d5db; }
    .theme-indigo { --resume-accent: #4338ca; --resume-rule: #c7d2fe; }
    .theme-emerald { --resume-accent: #047857; --resume-rule: #a7f3d0; }
    .theme-rose { --resume-accent: #be123c; --resume-rule: #fecdd3; }
    .template-compact { font-size: .9rem; }
    @media print { body { background: #fff; } .resume-preview { width: 100%; margin: 0; padding: .5in; box-shadow: none; } }
  `;
}

function setStatus(message) {
  statusMessage.textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    statusMessage.textContent = "Ready";
  }, 1800);
}

function escapeHtml(str) {
  return CradleEscape.escapeHtml(str);
}
