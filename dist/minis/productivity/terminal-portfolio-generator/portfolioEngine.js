/**
 * Portfolio Engine - Data model, validation, and terminal command output
 */
(function (exports) {
  const sanitizeUrl =
    typeof window !== "undefined" && window.ExportHtml
      ? window.ExportHtml.sanitizeUrl
      : require("./exportHtml.js").sanitizeUrl;

  /**
   * Returns a fresh, empty portfolio with sensible default shape.
   * Every optional section defaults to an empty array/object so
   * consumers never have to null-check before iterating.
   * @returns {Object}
   */
  function createEmptyPortfolio() {
    return {
      name: "",
      role: "",
      about: "",
      skills: [],
      projects: [],
      experience: [],
      education: [],
      contact: {},
    };
  }

  /**
   * Validates a portfolio object. Only `name` and `role` are
   * required — everything else is optional but must be the
   * correct type if present.
   * @param {Object} data
   * @returns {{valid: boolean, errors: string[]}}
   */
  function validatePortfolio(data) {
    const errors = [];

    if (!data || typeof data !== "object") {
      return { valid: false, errors: ["Portfolio data must be an object."] };
    }

    if (!data.name || typeof data.name !== "string" || !data.name.trim()) {
      errors.push("Name is required.");
    }

    if (!data.role || typeof data.role !== "string" || !data.role.trim()) {
      errors.push("Role/title is required.");
    }

    if (data.about !== undefined && typeof data.about !== "string") {
      errors.push("About must be a string.");
    }

    ["skills", "projects", "experience", "education"].forEach(key => {
      if (data[key] !== undefined && !Array.isArray(data[key])) {
        errors.push(`${key} must be an array.`);
      }
    });

    if (
      data.contact !== undefined &&
      (typeof data.contact !== "object" || Array.isArray(data.contact))
    ) {
      errors.push("Contact must be an object.");
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Extracts and lowercases the command word from raw terminal input.
   * Ignores any arguments after the first word.
   * @param {string} rawInput
   * @returns {string}
   */
  function parseCommandName(rawInput) {
    if (typeof rawInput !== "string") return "";
    return rawInput.trim().split(/\s+/)[0].toLowerCase();
  }

  function formatWhoami(p) {
    return [`${p.name || "Unnamed"} — ${p.role || "Role not set"}`];
  }

  function formatAbout(p) {
    return p.about && p.about.trim()
      ? p.about.trim().split("\n")
      : ["No about info provided yet."];
  }

  function formatSkills(p) {
    if (!p.skills || p.skills.length === 0) return ["No skills listed yet."];
    return p.skills.map(s => `  - ${s}`);
  }

  function formatProjects(p) {
    if (!p.projects || p.projects.length === 0)
      return ["No projects listed yet."];
    const lines = [];
    p.projects.forEach(proj => {
      lines.push(`${proj.name || "Untitled project"}`);
      if (proj.description) lines.push(`  ${proj.description}`);
      if (proj.tech && proj.tech.length)
        lines.push(`  tech: ${proj.tech.join(", ")}`);
      const safeLink = sanitizeUrl(proj.link);
      if (safeLink) lines.push(`  link: ${safeLink}`);
    });
    return lines;
  }

  function formatExperience(p) {
    if (!p.experience || p.experience.length === 0)
      return ["No experience listed yet."];
    const lines = [];
    p.experience.forEach(exp => {
      const header = `${exp.role || "Role"} @ ${exp.company || "Company"}${exp.period ? ` (${exp.period})` : ""}`;
      lines.push(header);
      if (exp.description) lines.push(`  ${exp.description}`);
    });
    return lines;
  }

  function formatEducation(p) {
    if (!p.education || p.education.length === 0)
      return ["No education listed yet."];
    return p.education.map(ed => {
      const period = ed.period ? ` (${ed.period})` : "";
      return `${ed.degree || "Degree"}, ${ed.institution || "Institution"}${period}`;
    });
  }

  function formatContact(p) {
    const entries = p.contact
      ? Object.entries(p.contact).filter(([, v]) => v)
      : [];
    if (entries.length === 0) return ["No contact info provided yet."];
    const lines = [];
    entries.forEach(([k, v]) => {
      const safeValue = sanitizeUrl(v);
      if (safeValue) lines.push(`  ${k}: ${safeValue}`);
    });
    return lines.length > 0 ? lines : ["No contact info provided yet."];
  }

  function formatBanner(p) {
    const greeting =
      p.name && p.name.trim()
        ? `Welcome to ${p.name.trim()}'s terminal portfolio!`
        : "Welcome to my terminal portfolio!";
    return [greeting, "Type 'help' to see available commands."];
  }

  /**
   * Builds the full command registry for a portfolio: every
   * available command's description + rendered output lines,
   * plus the order commands should auto-run in on load.
   * Sections with no meaningful data are skipped in autoRunOrder
   * (but remain callable directly, e.g. typing "skills" still works).
   * @param {Object} portfolio
   * @returns {{commands: Object, autoRunOrder: string[]}}
   */
  function buildCommandOutput(portfolio) {
    const p = portfolio || createEmptyPortfolio();

    const commands = {
      banner: {
        description: "Show the welcome banner",
        lines: formatBanner(p),
      },
      whoami: { description: "Show name and role", lines: formatWhoami(p) },
      about: { description: "Show the about section", lines: formatAbout(p) },
      skills: { description: "List skills", lines: formatSkills(p) },
      projects: { description: "List projects", lines: formatProjects(p) },
      experience: {
        description: "List work experience",
        lines: formatExperience(p),
      },
      education: { description: "List education", lines: formatEducation(p) },
      contact: {
        description: "Show contact / social links",
        lines: formatContact(p),
      },
      clear: {
        description: "Clear the terminal screen",
        lines: [],
        clientAction: "clear",
      },
    };

    commands.help = {
      description: "List available commands",
      lines: Object.keys(commands)
        .concat("help")
        .filter((name, i, arr) => arr.indexOf(name) === i)
        .sort()
        .map(
          name =>
            `  ${name.padEnd(12)} ${commands[name] ? commands[name].description : "List available commands"}`
        ),
    };

    const sectionHasContent = {
      whoami: true,
      about: Boolean(p.about && p.about.trim()),
      skills: Boolean(p.skills && p.skills.length),
      projects: Boolean(p.projects && p.projects.length),
      experience: Boolean(p.experience && p.experience.length),
      education: Boolean(p.education && p.education.length),
      contact: Boolean(p.contact && Object.values(p.contact).some(v => v)),
    };

    const autoRunOrder = [
      "banner",
      "whoami",
      "about",
      "skills",
      "projects",
      "experience",
      "education",
      "contact",
    ].filter(name => name === "banner" || sectionHasContent[name]);

    return { commands, autoRunOrder };
  }

  /**
   * Computes the Levenshtein (edit) distance between two strings.
   * Pure, no dependencies — used to power "did you mean...?" typo
   * suggestions for the terminal.
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  function levenshtein(a, b) {
    const strA = String(a || "");
    const strB = String(b || "");
    const matrix = Array.from({ length: strA.length + 1 }, () =>
      new Array(strB.length + 1).fill(0)
    );

    for (let i = 0; i <= strA.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= strB.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= strA.length; i++) {
      for (let j = 1; j <= strB.length; j++) {
        const cost = strA[i - 1] === strB[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[strA.length][strB.length];
  }

  /**
   * Finds the closest matching command name to a mistyped input,
   * within an edit-distance threshold. Returns null if nothing is
   * close enough, so callers can fall back to a plain "not found".
   * @param {string} input
   * @param {string[]} candidateNames
   * @param {number} [threshold=3]
   * @returns {string|null}
   */
  function findClosestCommand(input, candidateNames, threshold = 3) {
    if (!input || !Array.isArray(candidateNames)) return null;

    let closest = null;
    let minDist = Infinity;

    candidateNames.forEach(name => {
      const dist = levenshtein(input, name);
      if (dist < minDist && dist <= threshold) {
        minDist = dist;
        closest = name;
      }
    });

    return closest;
  }

  /**
   * Returns all candidate command names that start with the given
   * partial input, sorted alphabetically. Powers tab-completion.
   * @param {string} partial
   * @param {string[]} candidateNames
   * @returns {string[]}
   */
  function findMatchingCommands(partial, candidateNames) {
    if (typeof partial !== "string" || !Array.isArray(candidateNames))
      return [];
    const p = partial.toLowerCase();
    return candidateNames.filter(name => name.startsWith(p)).sort();
  }

  /**
   * Resolves raw typed terminal input against a pre-built command
   * registry (from buildCommandOutput). Pure — does not rebuild
   * the registry, so callers should rebuild it whenever the
   * underlying portfolio data changes, not on every keystroke.
   * When a command isn't found, includes a `suggestion` (closest
   * matching command name, or null) so the caller can decide
   * whether to offer a "did you mean...?" confirmation.
   * @param {{commands: Object}} commandOutput
   * @param {string} rawInput
   * @returns {{found: boolean, command: string, lines: string[], suggestion: (string|null)}}
   */
  function runCommand(commandOutput, rawInput) {
    const name = parseCommandName(rawInput);

    if (!name) {
      return { found: false, command: "", lines: [], suggestion: null };
    }

    const registry =
      commandOutput && commandOutput.commands ? commandOutput.commands : {};

    if (registry[name]) {
      return {
        found: true,
        command: name,
        lines: registry[name].lines,
        suggestion: null,
        clientAction: registry[name].clientAction || null,
      };
    }

    const suggestion = findClosestCommand(name, Object.keys(registry));

    return {
      found: false,
      command: name,
      lines: [
        `command not found: ${name}`,
        "type 'help' to see available commands",
      ],
      suggestion,
    };
  }

  exports.createEmptyPortfolio = createEmptyPortfolio;
  exports.validatePortfolio = validatePortfolio;
  exports.parseCommandName = parseCommandName;
  exports.buildCommandOutput = buildCommandOutput;
  exports.levenshtein = levenshtein;
  exports.findClosestCommand = findClosestCommand;
  exports.findMatchingCommands = findMatchingCommands;
  exports.runCommand = runCommand;
})(typeof exports === "undefined" ? (window.PortfolioEngine = {}) : exports);
