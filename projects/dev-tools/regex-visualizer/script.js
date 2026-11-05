document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const regexInput = document.getElementById("regexInput");
  const flagsInput = document.getElementById("flagsInput");
  const flagG = document.getElementById("flagG");
  const flagI = document.getElementById("flagI");
  const flagM = document.getElementById("flagM");
  const flagU = document.getElementById("flagU");
  const flagD = document.getElementById("flagD");

  const testStringInput = document.getElementById("testStringInput");
  const highlightsOverlay = document.getElementById("highlightsOverlay");
  const regexExplanation = document.getElementById("regexExplanation");
  const regexError = document.getElementById("regexError");
  const matchCountBadge = document.getElementById("matchCountBadge");
  const matchesTableBody = document.getElementById("matchesTableBody");
  const groupsTableBody = document.getElementById("groupsTableBody");

  const viewMatchesBtn = document.getElementById("viewMatchesBtn");
  const viewGroupsBtn = document.getElementById("viewGroupsBtn");
  const matchesViewContainer = document.getElementById("matchesViewContainer");
  const groupsViewContainer = document.getElementById("groupsViewContainer");

  const templateButtons = document.querySelectorAll(".btn-template");

  // Synchronize scrolling between overlay and textarea
  testStringInput.addEventListener("scroll", () => {
    highlightsOverlay.scrollTop = testStringInput.scrollTop;
    highlightsOverlay.scrollLeft = testStringInput.scrollLeft;
  });

  // Handle flags checkboxes change
  function updateFlagsInput() {
    let flags = "";
    if (flagG && flagG.checked) flags += "g";
    if (flagI && flagI.checked) flags += "i";
    if (flagM && flagM.checked) flags += "m";
    if (flagU && flagU.checked) flags += "u";
    if (flagD && flagD.checked) flags += "d";
    flagsInput.value = flags;
    runRegexProcessor();
  }

  function updateFlagsCheckboxes() {
    const flags = flagsInput.value;
    if (flagG) flagG.checked = flags.includes("g");
    if (flagI) flagI.checked = flags.includes("i");
    if (flagM) flagM.checked = flags.includes("m");
    if (flagU) flagU.checked = flags.includes("u");
    if (flagD) flagD.checked = flags.includes("d");
    runRegexProcessor();
  }

  [flagG, flagI, flagM, flagU, flagD].forEach(cb => {
    if (cb) cb.addEventListener("change", updateFlagsInput);
  });
  flagsInput.addEventListener("input", updateFlagsCheckboxes);

  // Inspector View Toggle Switcher
  if (
    viewMatchesBtn &&
    viewGroupsBtn &&
    matchesViewContainer &&
    groupsViewContainer
  ) {
    viewMatchesBtn.addEventListener("click", () => {
      viewMatchesBtn.classList.add("active");
      viewGroupsBtn.classList.remove("active");
      matchesViewContainer.classList.remove("hidden");
      groupsViewContainer.classList.add("hidden");
    });

    viewGroupsBtn.addEventListener("click", () => {
      viewGroupsBtn.classList.add("active");
      viewMatchesBtn.classList.remove("active");
      groupsViewContainer.classList.remove("hidden");
      matchesViewContainer.classList.add("hidden");
    });
  }

  // Load Templates
  templateButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      regexInput.value = btn.getAttribute("data-regex");
      flagsInput.value = btn.getAttribute("data-flags");
      testStringInput.value = btn.getAttribute("data-text");
      updateFlagsCheckboxes();
    });
  });

  // Run initial state
  runRegexProcessor();

  // Bind key inputs
  regexInput.addEventListener("input", runRegexProcessor);
  testStringInput.addEventListener("input", runRegexProcessor);

  // Main Processor
  function runRegexProcessor() {
    const pattern = regexInput.value;
    const flags = flagsInput.value;
    const testString = testStringInput.value;

    regexError.classList.add("hidden");

    if (!pattern) {
      highlightsOverlay.innerHTML = escapeHtml(testString);
      matchCountBadge.textContent = "0 Matches";
      matchesTableBody.innerHTML =
        '<tr><td colspan="4" class="table-placeholder">No pattern specified.</td></tr>';
      if (groupsTableBody) {
        groupsTableBody.innerHTML =
          '<tr><td colspan="5" class="table-placeholder">No pattern specified.</td></tr>';
      }
      regexExplanation.innerHTML =
        '<p class="placeholder-text">Enter a valid regex to see character breakdown.</p>';
      return;
    }

    // Pre-evaluation check for catastrophic backtracking (ReDoS) patterns
    const safetyCheck =
      typeof RegexEngine !== "undefined" &&
      typeof RegexEngine.detectCatastrophicPattern === "function"
        ? RegexEngine.detectCatastrophicPattern(pattern)
        : null;

    if (safetyCheck && safetyCheck.isUnsafe) {
      regexError.classList.remove("hidden");
      regexError.innerHTML = `
    <strong>⚠️ Unsafe Regex Warning (Catastrophic Backtracking):</strong> ${escapeHtml(safetyCheck.reason)}
    <br><span class="regex-error-position">Execution blocked to prevent freezing the browser thread (ReDoS protection).</span>
  `;

      highlightsOverlay.innerHTML = escapeHtml(testString);
      matchCountBadge.textContent = "Blocked (Unsafe)";

      matchesTableBody.innerHTML = `
    <tr>
      <td colspan="4" class="table-placeholder">
        Evaluation halted: ${escapeHtml(safetyCheck.reason)}
      </td>
    </tr>
  `;
      if (groupsTableBody) {
        groupsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="table-placeholder">
          Evaluation halted: ${escapeHtml(safetyCheck.reason)}
        </td>
      </tr>
    `;
      }

      // Still render token breakdown if possible so user can inspect pattern
      generateExplainer(pattern);
      return;
    }

    try {
      const regex = new RegExp(pattern, flags);

      // 1. Generate Explainer
      generateExplainer(pattern);

      // 2. Perform Matching & Highlighting
      processMatches(regex, testString, pattern);
    } catch (e) {
      const errorDetails = getRegexErrorDetails(e, pattern);

      regexError.classList.remove("hidden");
      regexError.innerHTML = `
    <strong>Regex Error:</strong> ${escapeHtml(errorDetails.message)}
    ${
      errorDetails.position !== null
        ? `<br><span class="regex-error-position">
            Problem near position ${errorDetails.position}:
            <code>${escapeHtml(errorDetails.snippet)}</code>
          </span>`
        : ""
    }
  `;

      highlightsOverlay.innerHTML = escapeHtml(testString);
      matchCountBadge.textContent = "0 Matches";

      matchesTableBody.innerHTML = `
    <tr>
      <td colspan="4" class="table-placeholder">
        ${escapeHtml(errorDetails.message)}
      </td>
    </tr>
  `;
      if (groupsTableBody) {
        groupsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="table-placeholder">
          ${escapeHtml(errorDetails.message)}
        </td>
      </tr>
    `;
      }
    }
  }

  function getRegexErrorDetails(error, pattern) {
    const message = error?.message || "Invalid regular expression.";
    const positionMatch = message.match(/(?:position|at position)\s*(\d+)/i);
    let position = positionMatch ? Number(positionMatch[1]) : null;

    if (position === null) {
      if (hasUnclosedCharacterClass(pattern)) {
        position = pattern.lastIndexOf("[");
      } else if (hasUnclosedGroup(pattern)) {
        position = findUnclosedGroupPosition(pattern);
      } else if (hasTrailingEscape(pattern)) {
        position = pattern.length - 1;
      }
    }

    let snippet = "";
    if (position !== null && position >= 0 && position < pattern.length) {
      const start = Math.max(0, position - 5);
      const end = Math.min(pattern.length, position + 6);
      snippet =
        pattern.substring(start, position) +
        "👉" +
        pattern.substring(position, end);
    }

    return {
      message,
      position,
      snippet,
    };
  }

  function hasUnclosedCharacterClass(pattern) {
    let escaped = false;
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "[") {
        const closingIndex = pattern.indexOf("]", i + 1);
        if (closingIndex === -1) return true;
        i = closingIndex;
      }
    }
    return false;
  }

  function hasUnclosedGroup(pattern) {
    return findUnclosedGroupPosition(pattern) !== null;
  }

  function findUnclosedGroupPosition(pattern) {
    const stack = [];
    let escaped = false;
    let inCharacterClass = false;

    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "[") {
        inCharacterClass = true;
        continue;
      }
      if (char === "]" && inCharacterClass) {
        inCharacterClass = false;
        continue;
      }
      if (inCharacterClass) {
        continue;
      }
      if (char === "(") {
        stack.push(i);
      } else if (char === ")") {
        if (stack.length > 0) {
          stack.pop();
        }
      }
    }

    return stack.length > 0 ? stack[stack.length - 1] : null;
  }

  function hasTrailingEscape(pattern) {
    let backslashCount = 0;
    for (let i = pattern.length - 1; i >= 0 && pattern[i] === "\\"; i--) {
      backslashCount++;
    }
    return backslashCount % 2 === 1;
  }

  // Highlight matches and groups and construct detail tables
  function processMatches(regex, text, pattern) {
    const isGlobal = regex.global;
    const matches = [];
    let match;
    const startTime = Date.now();
    const TIMEOUT_MS = 250;
    const MAX_MATCHES = 2000;
    let timedOut = false;
    let limitReached = false;

    if (isGlobal) {
      let lastIndex = -1;
      while ((match = regex.exec(text)) !== null) {
        if (Date.now() - startTime > TIMEOUT_MS) {
          timedOut = true;
          break;
        }
        if (matches.length >= MAX_MATCHES) {
          limitReached = true;
          break;
        }
        if (regex.lastIndex === lastIndex) {
          regex.lastIndex++;
        }
        lastIndex = regex.lastIndex;
        matches.push(match);
      }
    } else {
      const execStart = Date.now();
      match = regex.exec(text);
      if (Date.now() - execStart > TIMEOUT_MS) {
        timedOut = true;
      } else if (match) {
        matches.push(match);
      }
    }

    if (timedOut) {
      regexError.classList.remove("hidden");
      regexError.innerHTML = `
    <strong>⚠️ Execution Timeout:</strong> Regex evaluation exceeded ${TIMEOUT_MS}ms and was halted to keep the interface responsive.
  `;
    } else if (limitReached) {
      regexError.classList.remove("hidden");
      regexError.innerHTML = `
    <strong>⚠️ Match Limit Reached:</strong> Processing capped at ${MAX_MATCHES} matches to prevent performance degradation.
  `;
    }

    const badgeSuffix = timedOut
      ? " (Timed Out)"
      : limitReached
        ? ` (${MAX_MATCHES} cap)`
        : "";
    matchCountBadge.textContent = `${matches.length} Match${matches.length !== 1 ? "es" : ""}${badgeSuffix}`;

    if (matches.length === 0) {
      highlightsOverlay.innerHTML = escapeHtml(text);
      matchesTableBody.innerHTML =
        '<tr><td colspan="4" class="table-placeholder">No matches detected.</td></tr>';
      if (groupsTableBody) {
        groupsTableBody.innerHTML =
          '<tr><td colspan="5" class="table-placeholder">No capture groups detected.</td></tr>';
      }
      return;
    }

    // Parse pattern capture group definitions (indexes & names)
    const patternGroups =
      typeof RegexEngine !== "undefined" &&
      typeof RegexEngine.getPatternCaptureGroups === "function"
        ? RegexEngine.getPatternCaptureGroups(pattern)
        : [];

    // Parse all groups across all matches
    const parsedMatches = matches.map((m, idx) => {
      const groups =
        typeof RegexEngine !== "undefined" &&
        typeof RegexEngine.parseMatchGroups === "function"
          ? RegexEngine.parseMatchGroups(m, patternGroups, idx + 1)
          : [];
      return {
        match: m,
        matchIndex: idx + 1,
        groups,
      };
    });

    // 1. Build Matches Overview Table HTML
    let tableHtml = "";
    parsedMatches.forEach(({ match: m, matchIndex, groups }) => {
      const matchIndexStart = m.index;
      const matchIndexEnd = m.index + m[0].length;

      let groupsHtml = "";
      if (groups.length > 0) {
        groups.forEach(g => {
          if (g.isMatched) {
            const label = g.name ? `$<${escapeHtml(g.name)}>` : `$${g.index}`;
            groupsHtml += `
              <span class="group-pill pill-${g.colorClass}"
                    data-match-num="${matchIndex}"
                    data-group-num="${g.index}"
                    data-start="${g.start}"
                    data-end="${g.end}"
                    title="Click to inspect Group ${g.index} (${g.name ? `<${escapeHtml(g.name)}>` : `$${g.index}`}) in editor">
                <strong>${label}</strong>: "${escapeHtml(g.value)}"
              </span>
            `;
          } else {
            const label = g.name ? `$<${escapeHtml(g.name)}>` : `$${g.index}`;
            groupsHtml += `
              <span class="group-pill pill-unmatched"
                    data-match-num="${matchIndex}"
                    data-group-num="${g.index}"
                    title="Group ${g.index} did not participate in match">
                <strong>${label}</strong>: <em>unmatched</em>
              </span>
            `;
          }
        });
      }

      tableHtml += `
        <tr class="match-row" data-match-num="${matchIndex}">
          <td><strong>#${matchIndex}</strong></td>
          <td>${matchIndexStart} - ${matchIndexEnd}</td>
          <td><code style="background: rgba(255,255,255,0.05); padding: 2px 4px; border-radius: 4px;">${escapeHtml(m[0])}</code></td>
          <td>${groupsHtml || '<span style="color:var(--text-muted)">None</span>'}</td>
        </tr>
      `;
    });
    matchesTableBody.innerHTML = tableHtml;

    // 2. Build Dedicated Group Inspector Table HTML
    if (groupsTableBody) {
      let allGroups = [];
      parsedMatches.forEach(({ groups }) => {
        allGroups = allGroups.concat(groups);
      });

      if (allGroups.length === 0) {
        groupsTableBody.innerHTML =
          '<tr><td colspan="5" class="table-placeholder">No capturing groups found in pattern.</td></tr>';
      } else {
        let groupsTableHtml = "";
        allGroups.forEach(g => {
          const pillLabel = `$${g.index}`;
          const idLabel = g.name
            ? `<span class="group-name-tag">&lt;${escapeHtml(g.name)}&gt;</span>`
            : `<span style="color:var(--text-muted)">&mdash; (numbered)</span>`;

          const rangeText =
            g.isMatched && g.start !== null
              ? `${g.start} &ndash; ${g.end} <span style="color:var(--text-muted);font-size:0.75rem;">(${g.length} chars)</span>`
              : `<span style="color:var(--text-muted)">&mdash;</span>`;

          const valueHtml = g.isMatched
            ? `<code style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">${escapeHtml(g.value)}</code>`
            : `<em style="color:var(--text-muted)">unmatched</em>`;

          groupsTableHtml += `
            <tr class="group-inspector-row"
                data-match-num="${g.matchNumber}"
                data-group-num="${g.index}"
                ${g.isMatched && g.start !== null ? `data-start="${g.start}" data-end="${g.end}"` : ""}>
              <td>
                <span class="group-pill ${g.isMatched ? `pill-${g.colorClass}` : "pill-unmatched"}"
                      data-match-num="${g.matchNumber}"
                      data-group-num="${g.index}"
                      ${g.isMatched && g.start !== null ? `data-start="${g.start}" data-end="${g.end}"` : ""}>
                  ${pillLabel}
                </span>
              </td>
              <td>${idLabel}</td>
              <td><strong>#${g.matchNumber}</strong></td>
              <td>${rangeText}</td>
              <td>${valueHtml}</td>
            </tr>
          `;
        });
        groupsTableBody.innerHTML = groupsTableHtml;
      }
    }

    // 3. Build Highlights Overlay HTML with Color-Coded Group Pills
    let overlayHtml = "";
    let lastCopiedIndex = 0;

    parsedMatches.forEach(({ match: m, matchIndex, groups }) => {
      const matchStart = m.index;
      const matchEnd = m.index + m[0].length;

      // Plain text before match
      overlayHtml += escapeHtml(text.substring(lastCopiedIndex, matchStart));

      // Build group tree and render nested pill overlay spans
      let innerHtml = "";
      if (
        groups.length > 0 &&
        typeof RegexEngine !== "undefined" &&
        typeof RegexEngine.buildGroupTree === "function" &&
        typeof RegexEngine.renderGroupTreeNode === "function"
      ) {
        const tree = RegexEngine.buildGroupTree(m[0].length, groups);
        innerHtml = RegexEngine.renderGroupTreeNode(tree, m[0], escapeHtml);
      } else {
        innerHtml = escapeHtml(m[0]);
      }

      // Wrap full match in match highlight span
      overlayHtml += `<span class="hl-match" data-match-num="${matchIndex}">${innerHtml}</span>`;
      lastCopiedIndex = matchEnd;
    });

    // Copy remaining plain text
    overlayHtml += escapeHtml(text.substring(lastCopiedIndex));

    // Append extra newline to match editor sizing constraints
    highlightsOverlay.innerHTML = overlayHtml + "\n";

    // 4. Attach Interactive Event Handlers
    attachInspectorInteractions();
  }

  // Interactive cross-highlighting between Inspector and Editor
  function attachInspectorInteractions() {
    function highlightInEditor(start, end) {
      if (
        typeof start === "number" &&
        typeof end === "number" &&
        !isNaN(start) &&
        !isNaN(end) &&
        start >= 0 &&
        end >= start
      ) {
        testStringInput.focus();
        testStringInput.setSelectionRange(start, end);
      }
    }

    // Pills in table
    const pills = document.querySelectorAll(".group-pill[data-start]");
    pills.forEach(pill => {
      const matchNum = pill.getAttribute("data-match-num");
      const groupNum = pill.getAttribute("data-group-num");
      const start = parseInt(pill.getAttribute("data-start"), 10);
      const end = parseInt(pill.getAttribute("data-end"), 10);

      pill.addEventListener("mouseenter", () => {
        pill.classList.add("active-pill");
        const targetOverlays = highlightsOverlay.querySelectorAll(
          `.hl-group-pill[data-match-num="${matchNum}"][data-group-num="${groupNum}"]`
        );
        targetOverlays.forEach(el => el.classList.add("active-pill"));
      });

      pill.addEventListener("mouseleave", () => {
        pill.classList.remove("active-pill");
        const targetOverlays = highlightsOverlay.querySelectorAll(
          `.hl-group-pill[data-match-num="${matchNum}"][data-group-num="${groupNum}"]`
        );
        targetOverlays.forEach(el => el.classList.remove("active-pill"));
      });

      pill.addEventListener("click", e => {
        e.stopPropagation();
        highlightInEditor(start, end);
      });
    });

    // Group inspector table rows
    const groupRows = document.querySelectorAll(
      ".group-inspector-row[data-start]"
    );
    groupRows.forEach(row => {
      const matchNum = row.getAttribute("data-match-num");
      const groupNum = row.getAttribute("data-group-num");
      const start = parseInt(row.getAttribute("data-start"), 10);
      const end = parseInt(row.getAttribute("data-end"), 10);

      row.addEventListener("mouseenter", () => {
        row.classList.add("active-row");
        const targetOverlays = highlightsOverlay.querySelectorAll(
          `.hl-group-pill[data-match-num="${matchNum}"][data-group-num="${groupNum}"]`
        );
        targetOverlays.forEach(el => el.classList.add("active-pill"));
      });

      row.addEventListener("mouseleave", () => {
        row.classList.remove("active-row");
        const targetOverlays = highlightsOverlay.querySelectorAll(
          `.hl-group-pill[data-match-num="${matchNum}"][data-group-num="${groupNum}"]`
        );
        targetOverlays.forEach(el => el.classList.remove("active-pill"));
      });

      row.addEventListener("click", () => {
        highlightInEditor(start, end);
      });
    });
  }

  // Generate explanation breakdown for the pattern
  function generateExplainer(pattern) {
    if (
      typeof RegexEngine !== "undefined" &&
      typeof RegexEngine.parsePatternTokens === "function"
    ) {
      const tokens = RegexEngine.parsePatternTokens(pattern);
      if (!tokens.length) {
        regexExplanation.innerHTML =
          '<p class="placeholder-text">Enter a valid regex to see character breakdown.</p>';
        return;
      }
      regexExplanation.innerHTML = tokens
        .map(
          t => `
        <div class="explanation-item">
          <span class="token">${escapeHtml(t.token)}</span>
          <span class="desc">${escapeHtml(t.explanation)}</span>
        </div>
      `
        )
        .join("");
      return;
    }

    const items = [];
    let i = 0;

    while (i < pattern.length) {
      const char = pattern[i];

      if (char === "^") {
        items.push({
          token: "^",
          desc: "Asserts position at the start of the string/line.",
        });
      } else if (char === "$") {
        items.push({
          token: "$",
          desc: "Asserts position at the end of the string/line.",
        });
      } else if (char === ".") {
        items.push({
          token: ".",
          desc: "Matches any single character (except line terminators).",
        });
      } else if (char === "*") {
        items.push({
          token: "*",
          desc: "Quantifier: Matches 0 or more of the preceding token.",
        });
      } else if (char === "+") {
        items.push({
          token: "+",
          desc: "Quantifier: Matches 1 or more of the preceding token.",
        });
      } else if (char === "?") {
        items.push({
          token: "?",
          desc: "Quantifier: Matches 0 or 1 of the preceding token (makes it lazy if placed after another quantifier).",
        });
      } else if (char === "\\") {
        const next = pattern[i + 1] || "";
        if (next === "d") {
          items.push({
            token: "\\d",
            desc: "Matches any digit character (0-9).",
          });
        } else if (next === "w") {
          items.push({
            token: "\\w",
            desc: "Matches any alphanumeric word character (including underscore).",
          });
        } else if (next === "s") {
          items.push({
            token: "\\s",
            desc: "Matches any whitespace character (space, tab, newline).",
          });
        } else if (next === "D") {
          items.push({
            token: "\\D",
            desc: "Matches any non-digit character.",
          });
        } else if (next === "W") {
          items.push({ token: "\\W", desc: "Matches any non-word character." });
        } else if (next === "S") {
          items.push({
            token: "\\S",
            desc: "Matches any non-whitespace character.",
          });
        } else if (next) {
          items.push({
            token: `\\${next}`,
            desc: `Escapes the character "${next}" to match it literally.`,
          });
        }
        i++;
      } else if (char === "[") {
        let set = "";
        i++;
        while (i < pattern.length && pattern[i] !== "]") {
          set += pattern[i];
          i++;
        }
        items.push({
          token: `[${set}]`,
          desc: `Character Set: Matches any single character in the set "${set}".`,
        });
      } else if (char === "(") {
        items.push({ token: "(", desc: "Starts a capturing group." });
      } else if (char === ")") {
        items.push({ token: ")", desc: "Ends a capturing group." });
      } else if (char === "|") {
        items.push({
          token: "|",
          desc: "Alternation (OR operator): Matches either the expression before or after the bar.",
        });
      } else if (char === "{") {
        let range = "";
        i++;
        while (i < pattern.length && pattern[i] !== "}") {
          range += pattern[i];
          i++;
        }
        items.push({
          token: `{${range}}`,
          desc: `Quantifier: Matches exactly the specified occurrences (${range}) of the preceding token.`,
        });
      } else if (char.trim() !== "") {
        items.push({
          token: char,
          desc: `Matches the literal character "${char}".`,
        });
      }

      i++;
    }

    if (items.length === 0) {
      regexExplanation.innerHTML =
        '<p class="placeholder-text">Enter regex to see character breakdown.</p>';
      return;
    }

    // De-duplicate explanations to keep visual list clean
    const seen = new Set();
    const uniqueItems = [];
    items.forEach(item => {
      const key = `${item.token}|${item.desc}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push(item);
      }
    });

    let html = "";
    uniqueItems.forEach(item => {
      html += `
        <div class="explanation-item">
          <div class="exp-token">${escapeHtml(item.token)}</div>
          <div class="exp-desc">${escapeHtml(item.desc)}</div>
        </div>
      `;
    });
    regexExplanation.innerHTML = html;
  }

  function escapeHtml(str) {
    if (
      typeof CradleEscape !== "undefined" &&
      typeof CradleEscape.escapeHtml === "function"
    ) {
      return CradleEscape.escapeHtml(str);
    }
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
});
