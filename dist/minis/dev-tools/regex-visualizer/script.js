document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const regexInput = document.getElementById('regexInput');
  const flagsInput = document.getElementById('flagsInput');
  const flagG = document.getElementById('flagG');
  const flagI = document.getElementById('flagI');
  const flagM = document.getElementById('flagM');
  const flagU = document.getElementById('flagU');
  
  const testStringInput = document.getElementById('testStringInput');
  const highlightsOverlay = document.getElementById('highlightsOverlay');
  const regexExplanation = document.getElementById('regexExplanation');
  const regexError = document.getElementById('regexError');
  const matchCountBadge = document.getElementById('matchCountBadge');
  const matchesTableBody = document.getElementById('matchesTableBody');
  
  const templateButtons = document.querySelectorAll('.btn-template');

  // Synchronize scrolling between overlay and textarea
  testStringInput.addEventListener('scroll', () => {
    highlightsOverlay.scrollTop = testStringInput.scrollTop;
    highlightsOverlay.scrollLeft = testStringInput.scrollLeft;
  });

  // Handle flags checkboxes change
  function updateFlagsInput() {
    let flags = '';
    if (flagG.checked) flags += 'g';
    if (flagI.checked) flags += 'i';
    if (flagM.checked) flags += 'm';
    if (flagU.checked) flags += 'u';
    flagsInput.value = flags;
    runRegexProcessor();
  }

  function updateFlagsCheckboxes() {
    const flags = flagsInput.value;
    flagG.checked = flags.includes('g');
    flagI.checked = flags.includes('i');
    flagM.checked = flags.includes('m');
    flagU.checked = flags.includes('u');
    runRegexProcessor();
  }

  [flagG, flagI, flagM, flagU].forEach(cb => {
    cb.addEventListener('change', updateFlagsInput);
  });
  flagsInput.addEventListener('input', updateFlagsCheckboxes);

  // Load Templates
  templateButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      regexInput.value = btn.getAttribute('data-regex');
      flagsInput.value = btn.getAttribute('data-flags');
      testStringInput.value = btn.getAttribute('data-text');
      updateFlagsCheckboxes();
    });
  });

  // Run initial state
  runRegexProcessor();

  // Bind key inputs
  regexInput.addEventListener('input', runRegexProcessor);
  testStringInput.addEventListener('input', runRegexProcessor);

  // Main Processor
  function runRegexProcessor() {
    const pattern = regexInput.value;
    const flags = flagsInput.value;
    const testString = testStringInput.value;

    regexError.classList.add('hidden');
    
    if (!pattern) {
      highlightsOverlay.innerHTML = escapeHtml(testString);
      matchCountBadge.textContent = '0 Matches';
      matchesTableBody.innerHTML = '<tr><td colspan="4" class="table-placeholder">No pattern specified.</td></tr>';
      regexExplanation.innerHTML = '<p class="placeholder-text">Enter a valid regex to see character breakdown.</p>';
      return;
    }

    try {
  const regex = new RegExp(pattern, flags);

  // 1. Generate Explainer
  generateExplainer(pattern);

  // 2. Perform Matching & Highlighting
  processMatches(regex, testString);

} catch (e) {
  const errorDetails = getRegexErrorDetails(e, pattern);

  regexError.classList.remove('hidden');
  regexError.innerHTML = `
    <strong>Regex Error:</strong> ${escapeHtml(errorDetails.message)}
    ${
      errorDetails.position !== null
        ? `<br><span class="regex-error-position">
            Problem near position ${errorDetails.position}:
            <code>${escapeHtml(errorDetails.snippet)}</code>
          </span>`
        : ''
    }
  `;

  highlightsOverlay.innerHTML = escapeHtml(testString);
  matchCountBadge.textContent = '0 Matches';

  matchesTableBody.innerHTML = `
    <tr>
      <td colspan="4" class="table-placeholder">
        ${escapeHtml(errorDetails.message)}
      </td>
    </tr>
  `;
   }
  }
  function getRegexErrorDetails(error, pattern) {
  const message = error?.message || 'Invalid regular expression.';

  // JavaScript engines may report errors such as:
  // "Invalid regular expression: /.../: Unterminated group"
  // "Invalid regular expression: /.../: Invalid character class"
  // "... at position 5"
  const positionMatch = message.match(/(?:position|at position)\s*(\d+)/i);

  let position = positionMatch ? Number(positionMatch[1]) : null;

  // Some engines don't provide a position. Try to identify
  // an obvious problematic section from the pattern itself.
  if (position === null) {
    if (hasUnclosedCharacterClass(pattern)) {
      position = pattern.lastIndexOf('[');
    } else if (hasUnclosedGroup(pattern)) {
      position = findUnclosedGroupPosition(pattern);
    } else if (hasTrailingEscape(pattern)) {
      position = pattern.length - 1;
    }
  }

  let snippet = '';

  if (position !== null && position >= 0 && position < pattern.length) {
    const start = Math.max(0, position - 5);
    const end = Math.min(pattern.length, position + 6);

    snippet =
      pattern.substring(start, position) +
      '👉' +
      pattern.substring(position, end);
  }

  return {
    message,
    position,
    snippet
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

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '[') {
      const closingIndex = pattern.indexOf(']', i + 1);

      if (closingIndex === -1) {
        return true;
      }

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

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '[') {
      inCharacterClass = true;
      continue;
    }

    if (char === ']' && inCharacterClass) {
      inCharacterClass = false;
      continue;
    }

    if (inCharacterClass) {
      continue;
    }

    if (char === '(') {
      stack.push(i);
    } else if (char === ')') {
      if (stack.length > 0) {
        stack.pop();
      }
    }
  }

  return stack.length > 0 ? stack[stack.length - 1] : null;
}

function hasTrailingEscape(pattern) {
  let backslashCount = 0;

  for (let i = pattern.length - 1; i >= 0 && pattern[i] === '\\'; i--) {
    backslashCount++;
  }

  return backslashCount % 2 === 1;
}

  // Highlight matches and groups and construct detail tables
  function processMatches(regex, text) {
    const isGlobal = regex.global;
    const matches = [];
    let match;

    if (isGlobal) {
      // Prevent infinite loop if regex matches empty string
      let lastIndex = -1;
      while ((match = regex.exec(text)) !== null) {
        if (regex.lastIndex === lastIndex) {
          regex.lastIndex++;
        }
        lastIndex = regex.lastIndex;
        matches.push(match);
      }
    } else {
      match = regex.exec(text);
      if (match) {
        matches.push(match);
      }
    }

    matchCountBadge.textContent = `${matches.length} Match${matches.length !== 1 ? 'es' : ''}`;

    if (matches.length === 0) {
      highlightsOverlay.innerHTML = escapeHtml(text);
      matchesTableBody.innerHTML = '<tr><td colspan="4" class="table-placeholder">No matches detected.</td></tr>';
      return;
    }

    // 1. Build table details
    let tableHtml = '';
    matches.forEach((m, idx) => {
      const matchIndexStart = m.index;
      const matchIndexEnd = m.index + m[0].length;
      
      let groupsHtml = '';
      for (let g = 1; g < m.length; g++) {
        if (m[g] !== undefined) {
          const classNum = (g % 3) || 3;
          groupsHtml += `<span class="group-tag tag-g${classNum}">Group ${g}: "${escapeHtml(m[g])}"</span> `;
        }
      }

      tableHtml += `
        <tr>
          <td><strong>#${idx + 1}</strong></td>
          <td>${matchIndexStart} - ${matchIndexEnd}</td>
          <td><code style="background: rgba(255,255,255,0.05); padding: 2px 4px; border-radius: 4px;">${escapeHtml(m[0])}</code></td>
          <td>${groupsHtml || '<span style="color:var(--text-muted)">None</span>'}</td>
        </tr>
      `;
    });
    matchesTableBody.innerHTML = tableHtml;

    // 2. Build Highlights Overlay HTML
    let overlayHtml = '';
    let lastCopiedIndex = 0;

    matches.forEach((m) => {
      const matchStart = m.index;
      const matchEnd = m.index + m[0].length;

      // Copy plain text before match
      overlayHtml += escapeHtml(text.substring(lastCopiedIndex, matchStart));

      // Build matched content with capture groups highlighted inside
      let matchedContent = m[0];
      let innerHtml = '';
      
      // Determine capture group sub-ranges relative to the match
      const subGroups = [];
      for (let g = 1; g < m.length; g++) {
        if (m[g] !== undefined && m[g] !== '') {
          // Find start index of this capture group string within the matched string
          const gStart = m[0].indexOf(m[g]);
          if (gStart !== -1) {
            subGroups.push({
              groupIndex: g,
              start: gStart,
              end: gStart + m[g].length,
              text: m[g]
            });
          }
        }
      }

      // Sort subgroups by start position
      subGroups.sort((a, b) => a.start - b.start);

      // Align subgroups inside the match
      let subLastIndex = 0;
      subGroups.forEach((sub) => {
        if (sub.start >= subLastIndex) {
          // Plain match content before group
          innerHtml += escapeHtml(matchedContent.substring(subLastIndex, sub.start));
          
          // Wrapped group content
          const classNum = (sub.groupIndex % 3) || 3;
          innerHtml += `<span class="hl-group-${classNum}">${escapeHtml(sub.text)}</span>`;
          
          subLastIndex = sub.end;
        }
      });
      innerHtml += escapeHtml(matchedContent.substring(subLastIndex));

      // Wrap full match in match highlight span
      overlayHtml += `<span class="hl-match">${innerHtml}</span>`;

      lastCopiedIndex = matchEnd;
    });

    // Copy remaining plain text
    overlayHtml += escapeHtml(text.substring(lastCopiedIndex));

    // Append extra space or newline to match editor sizing constraints
    highlightsOverlay.innerHTML = overlayHtml + '\n';
  }

  // Generate explanation breakdown for the pattern
  function generateExplainer(pattern) {
    if (typeof RegexEngine !== "undefined" && typeof RegexEngine.parsePatternTokens === "function") {
      const tokens = RegexEngine.parsePatternTokens(pattern);
      if (!tokens.length) {
        regexExplanation.innerHTML = '<p class="placeholder-text">Enter a valid regex to see character breakdown.</p>';
        return;
      }
      regexExplanation.innerHTML = tokens.map(t => `
        <div class="explanation-item">
          <span class="token">${escapeHtml(t.token)}</span>
          <span class="desc">${escapeHtml(t.explanation)}</span>
        </div>
      `).join('');
      return;
    }
    const items = [];
    let i = 0;

    while (i < pattern.length) {
      const char = pattern[i];

      if (char === '^') {
        items.push({ token: '^', desc: 'Asserts position at the start of the string/line.' });
      } else if (char === '$') {
        items.push({ token: '$', desc: 'Asserts position at the end of the string/line.' });
      } else if (char === '.') {
        items.push({ token: '.', desc: 'Matches any single character (except line terminators).' });
      } else if (char === '*') {
        items.push({ token: '*', desc: 'Quantifier: Matches 0 or more of the preceding token.' });
      } else if (char === '+') {
        items.push({ token: '+', desc: 'Quantifier: Matches 1 or more of the preceding token.' });
      } else if (char === '?') {
        items.push({ token: '?', desc: 'Quantifier: Matches 0 or 1 of the preceding token (makes it lazy if placed after another quantifier).' });
      } else if (char === '\\') {
        const next = pattern[i + 1] || '';
        if (next === 'd') {
          items.push({ token: '\\d', desc: 'Matches any digit character (0-9).' });
        } else if (next === 'w') {
          items.push({ token: '\\w', desc: 'Matches any alphanumeric word character (including underscore).' });
        } else if (next === 's') {
          items.push({ token: '\\s', desc: 'Matches any whitespace character (space, tab, newline).' });
        } else if (next === 'D') {
          items.push({ token: '\\D', desc: 'Matches any non-digit character.' });
        } else if (next === 'W') {
          items.push({ token: '\\W', desc: 'Matches any non-word character.' });
        } else if (next === 'S') {
          items.push({ token: '\\S', desc: 'Matches any non-whitespace character.' });
        } else if (next) {
          items.push({ token: `\\${next}`, desc: `Escapes the character "${next}" to match it literally.` });
        }
        i++;
      } else if (char === '[') {
        let set = '';
        i++;
        while (i < pattern.length && pattern[i] !== ']') {
          set += pattern[i];
          i++;
        }
        items.push({ token: `[${set}]`, desc: `Character Set: Matches any single character in the set "${set}".` });
      } else if (char === '(') {
        items.push({ token: '(', desc: 'Starts a capturing group.' });
      } else if (char === ')') {
        items.push({ token: ')', desc: 'Ends a capturing group.' });
      } else if (char === '|') {
        items.push({ token: '|', desc: 'Alternation (OR operator): Matches either the expression before or after the bar.' });
      } else if (char === '{') {
        let range = '';
        i++;
        while (i < pattern.length && pattern[i] !== '}') {
          range += pattern[i];
          i++;
        }
        items.push({ token: `{${range}}`, desc: `Quantifier: Matches exactly the specified occurrences (${range}) of the preceding token.` });
      } else if (char.trim() !== '') {
        // Normal literal characters
        items.push({ token: char, desc: `Matches the literal character "${char}".` });
      }

      i++;
    }

    if (items.length === 0) {
      regexExplanation.innerHTML = '<p class="placeholder-text">Enter regex to see character breakdown.</p>';
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

    let html = '';
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
    return CradleEscape.escapeHtml(str);
  }
});
