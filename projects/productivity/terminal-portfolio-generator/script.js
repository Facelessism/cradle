(function () {
  "use strict";

  let currentThemeId = Themes.DEFAULT_THEME_ID;
  let currentCommandOutput = null;

  const commandHistory = [];
  let historyIndex = 0;

  const terminalEl = document.getElementById("terminalOutput");
  const themeRowEl = document.getElementById("themeRow");
  const validationErrorsEl = document.getElementById("validationErrors");
  const terminalInputEl = document.getElementById("terminalInput");

  const groups = {
    projects: { container: document.getElementById("projectsGroup"), template: document.getElementById("projectTemplate"), fields: ["name", "description", "tech", "link"] },
    experience: { container: document.getElementById("experienceGroup"), template: document.getElementById("experienceTemplate"), fields: ["role", "company", "period", "description"] },
    education: { container: document.getElementById("educationGroup"), template: document.getElementById("educationTemplate"), fields: ["degree", "institution", "period"] }
  };

  function addEntry(groupKey) {
    const g = groups[groupKey];
    if (!g || !g.template || !g.template.content || !g.template.content.firstElementChild) return;
    const node = g.template.content.firstElementChild.cloneNode(true);
    node.querySelector(".remove-entry")?.addEventListener("click", () => {
      node.remove();
      rebuildAndRender();
    });
    g.fields.forEach((f) => {
      node.querySelector(`[data-field="${f}"]`)?.addEventListener("input", rebuildAndRender);
    });
    if (g.container) g.container.appendChild(node);
  }

  function readEntries(groupKey) {
    const g = groups[groupKey];
    if (!g || !g.container) return [];
    return Array.from(g.container.querySelectorAll("[data-entry]")).map((node) => {
      const entry = {};
      g.fields.forEach((f) => {
        const val = (node.querySelector(`[data-field="${f}"]`)?.value || "").trim();
        entry[f] = f === "tech" ? val.split(",").map((s) => s.trim()).filter(Boolean) : val;
      });
      return entry;
    });
  }

  const getVal = (id) => document.getElementById(id)?.value || "";
  function readPortfolio() {
    const skillsRaw = getVal("skillsInput");
    return {
      name: getVal("nameInput").trim(),
      role: getVal("roleInput").trim(),
      about: getVal("aboutInput"),
      skills: skillsRaw.split(",").map((s) => s.trim()).filter(Boolean),
      projects: readEntries("projects"),
      experience: readEntries("experience"),
      education: readEntries("education"),
      contact: {
        email: getVal("emailInput").trim(),
        github: getVal("githubInput").trim(),
        linkedin: getVal("linkedinInput").trim(),
        website: getVal("websiteInput").trim()
      }
    };
  }

  function renderThemeRow() {
    if (!themeRowEl) return;
    themeRowEl.innerHTML = "";
    Themes.getThemeIds().forEach((id) => {
      const theme = Themes.getTheme(id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "theme-btn" + (id === currentThemeId ? " active" : "");
      btn.textContent = theme.label;
      btn.addEventListener("click", () => {
        currentThemeId = id;
        applyTheme();
        renderThemeRow();
      });
      themeRowEl.appendChild(btn);
    });
  }

  function applyTheme() {
    const vars = Themes.themeToCssVars(Themes.getTheme(currentThemeId));
    Object.entries(vars).forEach(([k, v]) => terminalEl.style.setProperty(k, v));
    document.documentElement.style.setProperty("--term-accent", vars["--term-accent"]);
  }

  function appendBlock(commandLabel, lines, isError) {
    const block = document.createElement("div");
    block.className = "block";

    const prompt = document.createElement("div");
    prompt.className = "prompt";
    prompt.textContent = `guest@portfolio:~$ ${commandLabel}`;
    block.appendChild(prompt);

    lines.forEach((line) => {
      const lineEl = document.createElement("div");
      lineEl.className = "line" + (isError ? " error-line" : "");
      lineEl.textContent = line;
      block.appendChild(lineEl);
    });

    terminalEl.appendChild(block);
    terminalEl.scrollTop = terminalEl.scrollHeight;
  }

  function rebuildAndRender() {
    const portfolio = readPortfolio();
    const { valid, errors } = PortfolioEngine.validatePortfolio(portfolio);
    if (validationErrorsEl) validationErrorsEl.textContent = valid ? "" : (Array.isArray(errors) ? errors.join(" ") : String(errors || ""));

    currentCommandOutput = PortfolioEngine.buildCommandOutput(portfolio);

    if (terminalEl) terminalEl.innerHTML = "";
    if (currentCommandOutput?.autoRunOrder) {
      currentCommandOutput.autoRunOrder.forEach((cmdName) => {
        const cmdObj = currentCommandOutput.commands ? currentCommandOutput.commands[cmdName] : null;
        if (cmdObj) appendBlock(cmdName, cmdObj.lines, false);
      });
    }
  }

  function handleTerminalCommand(rawInput) {
    if (!currentCommandOutput) return;

    const result = PortfolioEngine.runCommand(currentCommandOutput, rawInput);

    if (result.clientAction === "clear") {
      if (terminalEl) terminalEl.innerHTML = "";
      return;
    }

    if (!result.found && result.suggestion) {
      appendBlock(rawInput.trim(), [`command not found: ${result.command}`, `did you mean '${result.suggestion}'?`], true);
      return;
    }

    appendBlock(rawInput.trim() || "(empty)", result.lines, !result.found);
  }

  function handleTabComplete() {
    if (!currentCommandOutput) return;
    const partial = terminalInputEl.value.trim().toLowerCase();
    if (!partial) return;

    const matches = PortfolioEngine.findMatchingCommands(partial, Object.keys(currentCommandOutput.commands));

    if (matches.length === 1) {
      terminalInputEl.value = matches[0];
    } else if (matches.length > 1) {
      appendBlock(terminalInputEl.value, matches, false);
    }
  }

  function handleExport() {
    const portfolio = readPortfolio();
    const commandOutput = PortfolioEngine.buildCommandOutput(portfolio);
    const theme = Themes.getTheme(currentThemeId);
    const html = ExportHtml.generateStandaloneHtml(portfolio, commandOutput, theme);

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const filenameBase = (portfolio.name || "portfolio").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    a.href = url;
    a.download = `${filenameBase || "portfolio"}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  document.getElementById("addProjectBtn")?.addEventListener("click", () => { addEntry("projects"); rebuildAndRender(); });
  document.getElementById("addExperienceBtn")?.addEventListener("click", () => { addEntry("experience"); rebuildAndRender(); });
  document.getElementById("addEducationBtn")?.addEventListener("click", () => { addEntry("education"); rebuildAndRender(); });
  document.getElementById("exportBtn")?.addEventListener("click", handleExport);

  ["nameInput", "roleInput", "aboutInput", "skillsInput", "emailInput", "githubInput", "linkedinInput", "websiteInput"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", rebuildAndRender);
  });

  terminalInputEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const value = terminalInputEl.value;
      if (value.trim()) {
        commandHistory.push(value);
        historyIndex = commandHistory.length;
        handleTerminalCommand(value);
      }
      terminalInputEl.value = "";
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      handleTabComplete();
      return;
    }

    if (e.key === "ArrowUp") {
      if (historyIndex > 0) {
        historyIndex -= 1;
        terminalInputEl.value = commandHistory[historyIndex];
      }
      e.preventDefault();
      return;
    }

    if (e.key === "ArrowDown") {
      if (historyIndex < commandHistory.length - 1) {
        historyIndex += 1;
        terminalInputEl.value = commandHistory[historyIndex];
      } else {
        historyIndex = commandHistory.length;
        terminalInputEl.value = "";
      }
      e.preventDefault();
    }
  });

  renderThemeRow();
  applyTheme();
  rebuildAndRender();
})();