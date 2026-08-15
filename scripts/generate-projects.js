const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const REPO_ROOT = path.join(__dirname, "..");

// Date a project was first added, taken from the commit that introduced its
// folder. This is what powers the "New" badge (isNewProject in script.js);
// without it every project's dateAdded is undefined and the badge never shows.
// Falls back to null when git history isn't available (e.g. running outside a
// checkout) so generation still succeeds — the badge just stays hidden.
function getDateAdded(absPath) {
  try {
    const rel = path.relative(REPO_ROOT, absPath);
    const out = execSync(`git log --reverse --format=%aI -- "${rel}"`, {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return out.split("\n")[0] || null;
  } catch {
    return null;
  }
}

const PROJECTS_DIR = path.join(__dirname, "..", "projects");
const OUTPUT_FILE = path.join(
  __dirname,
  "..",
  "data",
  "projects.json"
);

const CATEGORY_STYLES = {
  aiml: {
    bgStart: "#020617",
    bgEnd: "#1e1b4b",
    accent: "#a21caf",
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 9h6M9 13h6" />`,
    pattern: `<g opacity="0.15">
      <line x1="100" y1="100" x2="300" y2="200" stroke="#a21caf" stroke-width="2" />
      <line x1="300" y1="200" x2="200" y2="400" stroke="#a21caf" stroke-width="2" />
      <line x1="200" y1="400" x2="500" y2="300" stroke="#a21caf" stroke-width="2" />
      <line x1="500" y1="300" x2="700" y2="500" stroke="#a21caf" stroke-width="2" />
      <line x1="700" y1="500" x2="900" y2="200" stroke="#a21caf" stroke-width="2" />
      <line x1="900" y1="200" x2="1100" y2="450" stroke="#a21caf" stroke-width="2" />
      <circle cx="100" cy="100" r="8" fill="#a21caf" />
      <circle cx="300" cy="200" r="12" fill="#d946ef" />
      <circle cx="200" cy="400" r="10" fill="#a21caf" />
      <circle cx="500" cy="300" r="14" fill="#d946ef" />
      <circle cx="700" cy="500" r="9" fill="#a21caf" />
      <circle cx="900" cy="200" r="16" fill="#d946ef" />
      <circle cx="1100" cy="450" r="11" fill="#a21caf" />
    </g>`
  },
  games: {
    bgStart: "#0f051d",
    bgEnd: "#4c0519",
    accent: "#ea580c",
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 012-2h3a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5zm12 0a2 2 0 012-2h3a2 2 0 012 2v14a2 2 0 01-2 2h-3a2 2 0 01-2-2V5z" />`,
    pattern: `<g opacity="0.12">
      <rect x="50" y="50" width="100" height="100" fill="none" stroke="#ea580c" stroke-width="2" />
      <rect x="250" y="150" width="150" height="150" fill="none" stroke="#ea580c" stroke-width="2" />
      <rect x="600" y="80" width="200" height="200" fill="none" stroke="#ea580c" stroke-width="2" />
      <rect x="900" y="300" width="120" height="120" fill="none" stroke="#ea580c" stroke-width="2" />
      <circle cx="80" cy="450" r="40" fill="none" stroke="#ea580c" stroke-width="2" />
      <circle cx="500" cy="500" r="60" fill="none" stroke="#ea580c" stroke-width="2" />
      <path d="M 800,100 L 950,250 M 150,550 L 300,400" stroke="#ea580c" stroke-width="2" />
    </g>`
  },
  productivity: {
    bgStart: "#022c22",
    bgEnd: "#064e3b",
    accent: "#10b981",
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />`,
    pattern: `<g opacity="0.12" stroke="#10b981" stroke-width="1.5" fill="none">
      <path d="M 0,100 L 1200,100 M 0,200 L 1200,200 M 0,300 L 1200,300 M 0,400 L 1200,400 M 0,500 L 1200,500 M 0,600 L 1200,600" />
      <path d="M 150,0 L 150,675 M 300,0 L 300,675 M 450,0 L 450,675 M 600,0 L 600,675 M 750,0 L 750,675 M 900,0 L 900,675 M 1050,0 L 1050,675" />
      <rect x="330" y="230" width="80" height="40" rx="5" fill="#10b981" opacity="0.3" />
      <rect x="780" y="430" width="80" height="40" rx="5" fill="#10b981" opacity="0.3" />
    </g>`
  },
  "dev-tools": {
    bgStart: "#030712",
    bgEnd: "#115e59",
    accent: "#0d9488",
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />`,
    pattern: `<g opacity="0.1" fill="none" stroke="#0d9488" stroke-width="2">
      <path d="M -100,200 L 1300,550 M -100,250 L 1300,600 M -100,150 L 1300,500" />
      <path d="M 200,-100 L 550,800 M 250,-100 L 600,800 M 150,-100 L 500,800" />
      <path d="M 800,-100 L 1150,800 M 850,-100 L 1200,800 M 750,-100 L 1100,800" />
    </g>`
  },
  misc: {
    bgStart: "#18001e",
    bgEnd: "#581c87",
    accent: "#c084fc",
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 01-2 2h0a2 2 0 01-2-2v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />`,
    pattern: `<g opacity="0.15">
      <circle cx="600" cy="337" r="100" fill="none" stroke="#c084fc" stroke-width="1.5" />
      <circle cx="600" cy="337" r="200" fill="none" stroke="#c084fc" stroke-width="2" />
      <circle cx="600" cy="337" r="300" fill="none" stroke="#c084fc" stroke-width="1.5" stroke-dasharray="10 15" />
      <circle cx="600" cy="337" r="400" fill="none" stroke="#c084fc" stroke-width="1" />
      <line x1="600" y1="37" x2="600" y2="637" stroke="#c084fc" stroke-width="1" opacity="0.3" />
      <line x1="300" y1="337" x2="900" y2="337" stroke="#c084fc" stroke-width="1" opacity="0.3" />
    </g>`
  },
  "file-tools": {
    bgStart: "#060913",
    bgEnd: "#1e1b4b",
    accent: "#38bdf8",
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />`,
    pattern: `<g opacity="0.1" fill="none" stroke="#38bdf8" stroke-width="2">
      <path d="M 0,150 L 1200,450 M 0,250 L 1200,550 M 0,50 L 1200,350" />
      <circle cx="600" cy="337" r="150" stroke-dasharray="8 8" />
    </g>`
  }
};

const defaultStyle = {
  bgStart: "#030712",
  bgEnd: "#1f2937",
  accent: "#3b82f6",
  icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />`,
  pattern: `<g opacity="0.1" stroke="#3b82f6" stroke-width="1.5" fill="none">
    <circle cx="200" cy="200" r="150" />
    <circle cx="1000" cy="475" r="250" />
  </g>`
};

function titleCase(str) {
  let title = str
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());

  const acronyms = {
    "Ai": "AI",
    "Ascii": "ASCII",
    "Cpu": "CPU",
    "Qr": "QR",
    "Css": "CSS",
    "Json": "JSON",
    "Url": "URL",
    "Html": "HTML",
    "Csv": "CSV"
  };

  return title.replace(/\b(Ai|Ascii|Cpu|Qr|Css|Json|Url|Html|Csv)\b/g, match => acronyms[match]);
}

function wrapText(text, maxChars = 20) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";
  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxChars) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case "\"": return "&quot;";
    }
  });
}

function generateSvgThumbnail(title, categoryName, projectAbsPath) {
  const thumbnailPath = path.join(projectAbsPath, "thumbnail.svg");

  if (fs.existsSync(thumbnailPath)) {
    const thumbMtime = fs.statSync(thumbnailPath).mtimeMs;
    const projMtime = fs.statSync(projectAbsPath).mtimeMs;
    if (thumbMtime >= projMtime) {
      return;
    }
  }

  const style = CATEGORY_STYLES[categoryName] || defaultStyle;
  
  // Word wrap for title
  const lines = wrapText(title, 20);
  let textY = 280;
  if (lines.length === 1) textY = 330;
  else if (lines.length === 2) textY = 300;
  else textY = 260;

  const textMarkup = lines
    .map((line, i) => `<text x="100" y="${textY + i * 75}" font-family="'Space Grotesk', Inter, system-ui, sans-serif" font-size="64" font-weight="800" fill="#ffffff" letter-spacing="-1.5">${escapeXml(line)}</text>`)
    .join("\n");

  const badgeWidth = Math.max(120, categoryName.length * 10 + 40);

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="100%" height="100%">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${style.bgStart}" />
      <stop offset="100%" stop-color="${style.bgEnd}" />
    </linearGradient>

    <!-- Aurora Blur Filter -->
    <filter id="auroraGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="80" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    <!-- Card Shadow -->
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.45" />
    </filter>
  </defs>

  <!-- Base background -->
  <rect width="1200" height="675" rx="0" fill="url(#bgGrad)" />

  <!-- Aurora Glows -->
  <circle cx="250" cy="200" r="300" fill="${style.accent}" opacity="0.3" filter="url(#auroraGlow)" />
  <circle cx="950" cy="450" r="350" fill="${style.accent}" opacity="0.25" filter="url(#auroraGlow)" />

  <!-- Decorative Pattern -->
  ${style.pattern}

  <!-- Border Frame -->
  <rect x="25" y="25" width="1150" height="625" rx="20" fill="none" stroke="${style.accent}" stroke-opacity="0.25" stroke-width="2" />

  <!-- Accent Corner Highlights -->
  <path d="M 25 100 L 25 45 A 20 20 0 0 1 45 25 L 100 25" fill="none" stroke="${style.accent}" stroke-width="4" stroke-linecap="round" />
  <path d="M 1175 575 L 1175 630 A 20 20 0 0 1 1155 650 L 1100 650" fill="none" stroke="${style.accent}" stroke-width="4" stroke-linecap="round" />

  <!-- Glassmorphic Card Container -->
  <rect x="75" y="75" width="1050" height="525" rx="16" fill="#ffffff" fill-opacity="0.03" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1" filter="url(#cardShadow)" />

  <!-- Category Icon (Decor) -->
  <g transform="translate(1000, 100) scale(4)" stroke="${style.accent}" fill="none" opacity="0.35">
    ${style.icon}
  </g>

  <!-- Category Badge -->
  <g transform="translate(100, 130)">
    <rect width="${badgeWidth}" height="40" rx="20" fill="${style.accent}" fill-opacity="0.2" stroke="${style.accent}" stroke-opacity="0.4" stroke-width="1.5" />
    <text x="${badgeWidth / 2}" y="24" font-family="'Space Grotesk', Inter, system-ui, sans-serif" font-size="12" font-weight="800" fill="#ffffff" fill-opacity="0.9" letter-spacing="2" text-anchor="middle">${categoryName.toUpperCase()}</text>
  </g>

  <!-- Project Title -->
  ${textMarkup}

  <!-- Watermark logo -->
  <g transform="translate(1100, 560)" text-anchor="end">
    <text font-family="'Space Grotesk', Inter, system-ui, sans-serif" font-size="20" font-weight="800" fill="#ffffff" fill-opacity="0.45" letter-spacing="4">CRADLE</text>
    <text y="22" font-family="'Space Grotesk', Inter, system-ui, sans-serif" font-size="10" font-weight="600" fill="#ffffff" fill-opacity="0.25" letter-spacing="1">EXPERIMENT SHOWCASE</text>
  </g>
</svg>`;

  fs.writeFileSync(path.join(projectAbsPath, "thumbnail.svg"), svgContent);
}

function generateProjects() {
  const projects = [];
  const errors = [];

  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`❌ Error: Projects directory not found at ${PROJECTS_DIR}`);
    process.exit(1);
  }

  const categories = fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory());

  const seenPaths = new Set();
  const seenTitles = new Set();

  for (const category of categories) {
    const categoryName = category.name;
    const categoryPath = path.join(PROJECTS_DIR, categoryName);

    const projectFolders = fs
      .readdirSync(categoryPath, {
        withFileTypes: true
      })
      .filter(dirent => dirent.isDirectory());

    for (const project of projectFolders) {
      const projectName = project.name;
      const title = titleCase(projectName);
      const projectPathStr = `projects/${categoryName}/${projectName}/`;
      const fullProjectPath = path.join(__dirname, "..", projectPathStr);

      // Validation checks
      if (!title || title.trim() === "") {
        errors.push(`Project in category '${categoryName}' has a missing or empty title.`);
      }
      if (!categoryName || categoryName.trim() === "") {
        errors.push(`Project '${projectName}' has a missing or empty category.`);
      }
      if (!fs.existsSync(fullProjectPath)) {
        errors.push(`Project path does not exist on disk: ${projectPathStr}`);
      }
      if (seenPaths.has(projectPathStr)) {
        errors.push(`Duplicate project path detected: ${projectPathStr}`);
      } else {
        seenPaths.add(projectPathStr);
      }
      if (seenTitles.has(title)) {
        errors.push(`Duplicate project title detected: '${title}'`);
      } else {
        seenTitles.add(title);
      }

      projects.push({
        title: title,
        category: categoryName,
        path: projectPathStr
      });
    }
  }

  // Report validation errors and fail build if any exist
  if (errors.length > 0) {
    console.error("❌ Project Metadata Validation Failed:");
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  projects.sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  const output = JSON.stringify(projects, null, 2);
  fs.writeFileSync(OUTPUT_FILE, output);

  console.log(
    `✅ Generated and validated ${projects.length} projects successfully → data/projects.json`
  );
}

generateProjects();
