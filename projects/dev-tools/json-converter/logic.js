/**
 * JSON Converter — Core Logic
 *
 * Pure functions for JSON parsing, validation, and conversion
 * to YAML, CSV, and XML formats. Zero external dependencies.
 */

/* ------------------------------------------------------------------ */
/* JSON Parsing & Validation                                          */
/* ------------------------------------------------------------------ */

/**
 * Parse JSON text and return a result object.
 *
 * On success:
 *   { valid: true, value: <parsed> }
 *
 * On error:
 *   { valid: false, error: { message, line, column } }
 */
function parseJSON(text) {
  try {
    const value = JSON.parse(text);

    return {
      valid: true,
      value
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    let line = 1;
    let column = 1;

    // Modern Node.js format:
    // "... at position N (line M column K)"
    const modernMatch = message.match(
      /\(line\s+(\d+)\s+column\s+(\d+)\)/
    );

    if (modernMatch) {
      line = Number.parseInt(modernMatch[1], 10);
      column = Number.parseInt(modernMatch[2], 10);
    } else {
      // Older Node.js format:
      // "... at position N"
      const positionMatch = message.match(/position\s+(\d+)/);

      if (positionMatch) {
        const position = Number.parseInt(positionMatch[1], 10);
        const beforeError = text.slice(0, position);
        const lines = beforeError.split('\n');

        line = lines.length;
        column = lines[lines.length - 1].length + 1;
      }
    }

    // Remove engine-specific information from the error message.
    let cleanMessage = message
      .replace(/^JSON\.parse:\s*/i, '')
      .replace(/,\s*".*"\s+is not valid JSON\s*$/, '')
      .replace(/\s*\(line\s+\d+\s+column\s+\d+\)\s*$/, '')
      .replace(/\s+position\s+\d+.*$/, '')
      .trim();

    if (!cleanMessage || cleanMessage === 'is not valid JSON') {
      cleanMessage = 'Invalid JSON';
    }

    return {
      valid: false,
      error: {
        message: cleanMessage,
        line,
        column
      }
    };
  }
}

/* ------------------------------------------------------------------ */
/* JSON → YAML                                                        */
/* ------------------------------------------------------------------ */

function needsYamlQuote(str) {
  return (
    str === '' ||
    str === '~' ||
    str === 'null' ||
    str === 'true' ||
    str === 'false' ||
    str === 'yes' ||
    str === 'no' ||
    str === 'on' ||
    str === 'off' ||
    /^(0|[1-9][0-9]*)(\.\d+)?$/.test(str) ||
    /[:\-#\[\]{},"'!&*?|>%@`\n\r]/.test(str) ||
    /^\s|\s$/.test(str) ||
    /^[ \t]/.test(str)
  );
}

function quoteYaml(str) {
  if (!needsYamlQuote(str)) {
    return str;
  }

  // Use single quotes when possible.
  if (!str.includes("'")) {
    return `'${str}'`;
  }

  // Fall back to JSON-style double quotes.
  return JSON.stringify(str);
}

/**
 * Serialize a JavaScript value to YAML.
 */
function toYaml(obj, indent) {
  if (indent === undefined) {
    indent = 0;
  }

  const pad = '  '.repeat(indent);

  if (obj === null || obj === undefined) {
    return '~';
  }

  if (typeof obj === 'boolean') {
    return obj ? 'true' : 'false';
  }

  if (typeof obj === 'number') {
    return Number.isFinite(obj) ? String(obj) : '~';
  }

  if (typeof obj === 'string') {
    return obj === '' ? "''" : quoteYaml(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '[]';
    }

    return (
      '\n' +
      obj
        .map(item => {
          const value = toYaml(item, indent + 1);

          if (typeof item === 'object' && item !== null) {
            const lines = value.split('\n');
            const firstLine = lines.shift();

            const rest = lines
              .map(line => pad + '  ' + line)
              .join('\n');

            return (
              pad +
              '- ' +
              firstLine.trimStart() +
              (rest ? '\n' + rest : '')
            );
          }

          return pad + '- ' + value;
        })
        .join('\n')
    );
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj);

    if (keys.length === 0) {
      return '{}';
    }

    return (
      '\n' +
      keys
        .map(key => {
          const value = toYaml(obj[key], indent + 1);

          const needsKeyQuote =
            /[:\-#\[\]{},"'!&*?|>%@`\n\r\s]/.test(key);

          const formattedKey = needsKeyQuote
            ? quoteYaml(key)
            : key;

          const valueIsObject =
            typeof obj[key] === 'object' &&
            obj[key] !== null &&
            !Array.isArray(obj[key]) &&
            Object.keys(obj[key]).length > 0;

          const valueIsArray =
            Array.isArray(obj[key]) && obj[key].length > 0;

          if (valueIsObject || valueIsArray) {
            return `${pad}${formattedKey}:${value}`;
          }

          return `${pad}${formattedKey}: ${value}`;
        })
        .join('\n')
    );
  }

  return String(obj);
}

/* ------------------------------------------------------------------ */
/* JSON → CSV                                                         */
/* ------------------------------------------------------------------ */

function escapeCsv(value) {
  const stringValue = String(value);

  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Flatten a nested object to dot-notation keys.
 *
 * Example:
 * { a: { b: 1 } }
 * becomes:
 * { "a.b": 1 }
 */
function flattenObj(obj, prefix, result) {
  if (prefix === undefined) {
    prefix = '';
  }

  if (result === undefined) {
    result = {};
  }

  if (obj === null || obj === undefined) {
    result[prefix || 'value'] = '';
    return result;
  }

  if (typeof obj !== 'object' || Array.isArray(obj)) {
    result[prefix || 'value'] = String(obj);
    return result;
  }

  const keys = Object.keys(obj);

  if (keys.length === 0) {
    result[prefix || 'value'] = '';
    return result;
  }

  for (const key of keys) {
    const newPrefix = prefix
      ? `${prefix}.${key}`
      : key;

    flattenObj(obj[key], newPrefix, result);
  }

  return result;
}

/**
 * Serialize a JavaScript value to CSV.
 *
 * Best suited for arrays of objects.
 * Other shapes are converted into a single row.
 */
function toCsv(obj) {
  if (obj === null || obj === undefined) {
    return '';
  }

  if (Array.isArray(obj) && obj.length === 0) {
    return '';
  }

  if (!Array.isArray(obj)) {
    const flattened = flattenObj(obj);
    const headers = Object.keys(flattened);
    const values = Object.values(flattened);

    return (
      headers.join(',') +
      '\n' +
      values.map(escapeCsv).join(',')
    );
  }

  const allKeys = new Set();

  const rows = obj.map(item => flattenObj(item));

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      allKeys.add(key);
    }
  }

  const headers = Array.from(allKeys);
  const lines = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map(header =>
      escapeCsv(
        row[header] !== undefined
          ? row[header]
          : ''
      )
    );

    lines.push(values.join(','));
  }

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* JSON → XML                                                         */
/* ------------------------------------------------------------------ */

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isValidXmlName(name) {
  return /^[a-zA-Z_][\w.-]*$/.test(name);
}

function sanitizeXmlName(name) {
  let sanitized = name.replace(
    /[^a-zA-Z0-9_.-]/g,
    '_'
  );

  if (!/^[a-zA-Z_]/.test(sanitized)) {
    sanitized = '_' + sanitized;
  }

  return sanitized || 'item';
}

/**
 * Serialize a JavaScript value to XML.
 *
 * @param {*} obj
 * @param {string} rootName
 * @param {number} indent
 */
function toXml(obj, rootName, indent) {
  if (rootName === undefined) {
    rootName = 'root';
  }

  if (indent === undefined) {
    indent = 0;
  }

  const pad = '  '.repeat(indent);

  const name = isValidXmlName(rootName)
    ? rootName
    : sanitizeXmlName(rootName);

  if (obj === null || obj === undefined) {
    return `${pad}<${name}/>`;
  }

  if (
    typeof obj === 'string' ||
    typeof obj === 'number' ||
    typeof obj === 'boolean'
  ) {
    return (
      `${pad}<${name}>` +
      escapeXml(String(obj)) +
      `</${name}>`
    );
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return `${pad}<${name}/>`;
    }

    const itemName =
      name.replace(/s$/, '') || 'item';

    const items = obj
      .map(item =>
        toXml(item, itemName, indent + 1)
      )
      .join('\n');

    return (
      `${pad}<${name}>\n` +
      `${items}\n` +
      `${pad}</${name}>`
    );
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj);

    if (keys.length === 0) {
      return `${pad}<${name}/>`;
    }

    const children = keys
      .map(key => {
        const childName = isValidXmlName(key)
          ? key
          : sanitizeXmlName(key);

        return toXml(
          obj[key],
          childName,
          indent + 1
        );
      })
      .join('\n');

    return (
      `${pad}<${name}>\n` +
      `${children}\n` +
      `${pad}</${name}>`
    );
  }

  return (
    `${pad}<${name}>` +
    escapeXml(String(obj)) +
    `</${name}>`
  );
}

/* ------------------------------------------------------------------ */
/* Formatting & Minification                                          */
/* ------------------------------------------------------------------ */

function formatJSON(text, indent) {
  if (indent === undefined) {
    indent = 2;
  }

  try {
    const obj = JSON.parse(text);
    return JSON.stringify(obj, null, indent);
  } catch {
    return text;
  }
}

function minifyJSON(text) {
  try {
    const obj = JSON.parse(text);
    return JSON.stringify(obj);
  } catch {
    return text;
  }
}

/* ------------------------------------------------------------------ */
/* Syntax Highlighting                                                */
/* ------------------------------------------------------------------ */

/**
 * Return HTML with <span> tags for JSON syntax highlighting.
 */
function highlightJSON(text) {
  let html = '';
  let index = 0;

  while (index < text.length) {
    // Whitespace
    if (
      text[index] === ' ' ||
      text[index] === '\n' ||
      text[index] === '\r' ||
      text[index] === '\t'
    ) {
      html += text[index];
      index++;
      continue;
    }

    // String
    if (text[index] === '"') {
      const start = index;
      index++;

      while (index < text.length) {
        if (text[index] === '\\') {
          index += 2;
        } else if (text[index] === '"') {
          index++;
          break;
        } else {
          index++;
        }
      }

      const token = text.slice(start, index);

      html += `<span class="hl-string">${escapeHtml(token)}</span>`;
      continue;
    }

    // Number
    if (
      text[index] === '-' ||
      (text[index] >= '0' && text[index] <= '9')
    ) {
      const start = index;

      if (text[index] === '-') {
        index++;
      }

      while (
        index < text.length &&
        /[0-9eE.+-]/.test(text[index])
      ) {
        if (
          (text[index] === '+' || text[index] === '-') &&
          index > start &&
          text[index - 1] !== 'e' &&
          text[index - 1] !== 'E'
        ) {
          break;
        }

        index++;
      }

      const token = text.slice(start, index);

      html += `<span class="hl-number">${escapeHtml(token)}</span>`;
      continue;
    }

    // true
    if (text.slice(index, index + 4) === 'true') {
      html += '<span class="hl-boolean">true</span>';
      index += 4;
      continue;
    }

    // false
    if (text.slice(index, index + 5) === 'false') {
      html += '<span class="hl-boolean">false</span>';
      index += 5;
      continue;
    }

    // null
    if (text.slice(index, index + 4) === 'null') {
      html += '<span class="hl-null">null</span>';
      index += 4;
      continue;
    }

    // Punctuation
    const character = text[index];

    if ('{}[],:'.includes(character)) {
      html += `<span class="hl-punct">${escapeHtml(character)}</span>`;
    } else {
      html += escapeHtml(character);
    }

    index++;
  }

  return html;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const escapeHtml =
  typeof window !== 'undefined' && window.CradleEscape
    ? window.CradleEscape.escapeHtml
    : require('../../../src/components/ui/escapeHtml.js').escapeHtml;

/* ------------------------------------------------------------------ */
/* Module Exports                                                     */
/* ------------------------------------------------------------------ */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseJSON,
    toYaml,
    toCsv,
    toXml,
    formatJSON,
    minifyJSON,
    highlightJSON
  };
}