/**
 * Markdown & Graph Parser
 * Supports Obsidian-compatible [[wikilinks]] with aliases and section anchors,
 * YAML frontmatter extraction, inline #hashtag extraction,
 * Louvain community detection cluster coloring, and PKZIP vault export.
 */

export const CLUSTER_COLORS = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#8b5cf6", // Purple
  "#f97316", // Orange
  "#3b82f6", // Blue
  "#14b8a6", // Teal
  "#84cc16", // Lime
  "#e11d48", // Rose
  "#a855f7", // Violet
];

/**
 * Parses YAML frontmatter enclosed in `---` at the start of a Markdown document.
 * Returns { frontmatter, body, rawFrontmatter, hasFrontmatter }.
 */
export function parseFrontmatter(text) {
  if (typeof text !== "string") {
    return {
      frontmatter: {},
      body: "",
      rawFrontmatter: "",
      hasFrontmatter: false,
    };
  }

  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return {
      frontmatter: {},
      body: text,
      rawFrontmatter: "",
      hasFrontmatter: false,
    };
  }

  const rawFrontmatter = match[1];
  const body = text.slice(match[0].length);
  const frontmatter = {};

  const lines = rawFrontmatter.split(/\r?\n/);
  let currentKey = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Bullet item under currentKey: "  - value" or "- value"
    const itemMatch = line.match(/^\s*-\s+(.*)$/);
    if (itemMatch && currentKey) {
      const val = itemMatch[1].trim().replace(/^['"]|['"]$/g, "");
      if (!Array.isArray(frontmatter[currentKey])) {
        frontmatter[currentKey] = [];
      }
      frontmatter[currentKey].push(val);
      continue;
    }

    // Key-value pair: "key: value"
    const kvMatch = line.match(/^([a-zA-Z0-9_\-]+)\s*:\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      currentKey = key;
      const rawVal = kvMatch[2].trim();

      if (!rawVal) {
        // Will be populated by following list items
        frontmatter[key] = [];
      } else if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
        // Inline JSON-style array: [tag1, tag2]
        const inner = rawVal.slice(1, -1).trim();
        if (inner.length === 0) {
          frontmatter[key] = [];
        } else {
          frontmatter[key] = inner
            .split(",")
            .map(s => s.trim().replace(/^['"]|['"]$/g, ""))
            .filter(Boolean);
        }
      } else {
        const cleanVal = rawVal.replace(/^['"]|['"]$/g, "");
        if (cleanVal === "true") frontmatter[key] = true;
        else if (cleanVal === "false") frontmatter[key] = false;
        else if (!isNaN(Number(cleanVal)) && cleanVal !== "")
          frontmatter[key] = Number(cleanVal);
        else frontmatter[key] = cleanVal;
      }
    }
  }

  // Normalize tags: ensure array if present
  if (typeof frontmatter.tags === "string") {
    frontmatter.tags = [frontmatter.tags];
  }
  if (typeof frontmatter.tag === "string") {
    if (!Array.isArray(frontmatter.tags)) frontmatter.tags = [];
    frontmatter.tags.push(frontmatter.tag);
  }

  return {
    frontmatter,
    body,
    rawFrontmatter,
    hasFrontmatter: true,
  };
}

/**
 * Formats frontmatter dictionary and body into standard YAML-frontmatter Markdown.
 */
export function formatFrontmatter(frontmatter, body) {
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return body;
  }

  const lines = ["---"];
  for (const [key, val] of Object.entries(frontmatter)) {
    if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of val) {
          lines.push(`  - ${item}`);
        }
      }
    } else if (typeof val === "boolean" || typeof val === "number") {
      lines.push(`${key}: ${val}`);
    } else if (typeof val === "string") {
      if (
        val.includes(":") ||
        val.includes("#") ||
        val.includes("'") ||
        val.includes('"')
      ) {
        lines.push(`${key}: "${val.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}: ${val}`);
      }
    }
  }
  lines.push("---");
  lines.push("");
  lines.push(body);
  return lines.join("\n");
}

/**
 * Extracts hashtags from Markdown text (#tag, #nested/tag).
 * Ignores hex colors and markdown headings.
 */
export function extractHashtags(text) {
  if (typeof text !== "string" || !text) return [];

  const tagRegex = /(?:^|[^\w#&])#([a-zA-Z\u00C0-\u024F][a-zA-Z0-9_\-\/]*)/g;
  const tags = new Set();
  let match;

  while ((match = tagRegex.exec(text)) !== null) {
    const tag = match[1].trim();
    if (tag) {
      tags.add(tag);
    }
  }

  return Array.from(tags);
}

/**
 * Louvain community detection algorithm.
 * Groups interconnected nodes into modularity-maximizing communities and assigns clusterId and clusterColor.
 */
export function detectCommunities(nodes, edges) {
  if (!nodes || nodes.length === 0) return { nodes: [], clusters: new Map() };

  if (nodes.length === 1) {
    nodes[0].clusterId = 0;
    nodes[0].clusterColor = CLUSTER_COLORS[0];
    const clusters = new Map([[0, [nodes[0]]]]);
    return { nodes, clusters };
  }

  const n = nodes.length;
  const nodeIndexMap = new Map();
  nodes.forEach((node, i) => nodeIndexMap.set(node.id, i));

  // Build undirected adjacency list with edge weights
  const adj = Array.from({ length: n }, () => new Map());
  let totalWeight = 0;

  for (const edge of edges) {
    const u = nodeIndexMap.get(edge.source);
    const v = nodeIndexMap.get(edge.target);
    if (u === undefined || v === undefined) continue;
    if (u === v) continue;

    const currentW = adj[u].get(v) || 0;
    adj[u].set(v, currentW + 1);
    adj[v].set(u, currentW + 1);
    totalWeight += 1;
  }

  // If no edges at all, assign each node to a round-robin cluster
  if (totalWeight === 0) {
    nodes.forEach((node, i) => {
      node.clusterId = i % CLUSTER_COLORS.length;
      node.clusterColor = CLUSTER_COLORS[node.clusterId];
    });
    const clusters = new Map();
    nodes.forEach(node => {
      if (!clusters.has(node.clusterId)) clusters.set(node.clusterId, []);
      clusters.get(node.clusterId).push(node);
    });
    return { nodes, clusters };
  }

  const m = totalWeight; // total edge count (undirected)
  const degrees = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (const w of adj[i].values()) d += w;
    degrees[i] = d;
  }

  // Initial community: each node in its own community
  const community = new Int32Array(n);
  for (let i = 0; i < n; i++) community[i] = i;

  const communityTot = new Float64Array(n);
  for (let i = 0; i < n; i++) communityTot[i] = degrees[i];

  let improved = true;
  let iterations = 0;
  const maxIterations = 25;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < n; i++) {
      const c = community[i];
      const deg_i = degrees[i];
      if (deg_i === 0) continue;

      // Remove node i from community c
      communityTot[c] -= deg_i;

      // Calculate weights to neighbor communities
      const neighborCommWeights = new Map();
      for (const [neighbor, weight] of adj[i].entries()) {
        const neighborComm = community[neighbor];
        neighborCommWeights.set(
          neighborComm,
          (neighborCommWeights.get(neighborComm) || 0) + weight
        );
      }

      let bestComm = c;
      let maxGain = 0;

      for (const [targetComm, weightInTarget] of neighborCommWeights.entries()) {
        const gain =
          weightInTarget - (communityTot[targetComm] * deg_i) / (2 * m);
        if (gain > maxGain) {
          maxGain = gain;
          bestComm = targetComm;
        }
      }

      community[i] = bestComm;
      communityTot[bestComm] += deg_i;

      if (bestComm !== c) {
        improved = true;
      }
    }
  }

  // Count community sizes and sort by size descending
  const commCounts = new Map();
  for (let i = 0; i < n; i++) {
    const c = community[i];
    commCounts.set(c, (commCounts.get(c) || 0) + 1);
  }

  const sortedComms = Array.from(commCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  const commIdMap = new Map();
  sortedComms.forEach((oldId, newId) => commIdMap.set(oldId, newId));

  const clusters = new Map();
  for (let i = 0; i < n; i++) {
    const clusterId = commIdMap.get(community[i]);
    const clusterColor = CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length];
    nodes[i].clusterId = clusterId;
    nodes[i].clusterColor = clusterColor;

    if (!clusters.has(clusterId)) clusters.set(clusterId, []);
    clusters.get(clusterId).push(nodes[i]);
  }

  return { nodes, clusters };
}

// Precomputed CRC32 table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

/**
 * Computes standard 32-bit CRC checksum.
 */
export function crc32(data) {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Pure JavaScript PKZIP 2.0 archive generator (Stored / method 0).
 * Creates a valid .zip file byte array with zero dependencies.
 */
export function generateZipArchive(files) {
  const encoder = new TextEncoder();
  const entries = [];
  let offset = 0;

  for (const file of files) {
    const filenameBytes = encoder.encode(file.name);
    const contentBytes =
      typeof file.content === "string"
        ? encoder.encode(file.content)
        : file.content;
    const fileCrc = crc32(contentBytes);
    const size = contentBytes.length;

    // Local file header: 30 bytes + filename length
    const localHeader = new Uint8Array(30 + filenameBytes.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true); // signature PK\x03\x04
    view.setUint16(4, 20, true); // version needed: 2.0
    view.setUint16(6, 0, true); // bit flags
    view.setUint16(8, 0, true); // compression: 0 (stored)
    view.setUint16(10, 0, true); // mod time
    view.setUint16(12, 0x0021, true); // mod date
    view.setUint32(14, fileCrc, true); // crc32
    view.setUint32(18, size, true); // compressed size
    view.setUint32(22, size, true); // uncompressed size
    view.setUint16(26, filenameBytes.length, true);
    view.setUint16(28, 0, true); // extra field length

    localHeader.set(filenameBytes, 30);

    entries.push({
      file,
      filenameBytes,
      contentBytes,
      fileCrc,
      size,
      offset,
      localHeader,
    });

    offset += localHeader.length + size;
  }

  // Central directory
  let centralDirSize = 0;
  const centralHeaders = [];

  for (const entry of entries) {
    const ch = new Uint8Array(46 + entry.filenameBytes.length);
    const view = new DataView(ch.buffer);

    view.setUint32(0, 0x02014b50, true); // signature PK\x01\x02
    view.setUint16(4, 20, true); // version made by
    view.setUint16(6, 20, true); // version needed
    view.setUint16(8, 0, true); // bit flags
    view.setUint16(10, 0, true); // compression: 0
    view.setUint16(12, 0, true); // mod time
    view.setUint16(14, 0x0021, true); // mod date
    view.setUint32(16, entry.fileCrc, true);
    view.setUint32(20, entry.size, true);
    view.setUint32(24, entry.size, true);
    view.setUint16(28, entry.filenameBytes.length, true);
    view.setUint16(30, 0, true); // extra field length
    view.setUint16(32, 0, true); // comment length
    view.setUint16(34, 0, true); // disk start
    view.setUint16(36, 0, true); // internal attrs
    view.setUint32(38, 0, true); // external attrs
    view.setUint32(42, entry.offset, true); // relative offset of local header

    ch.set(entry.filenameBytes, 46);
    centralHeaders.push(ch);
    centralDirSize += ch.length;
  }

  // End of Central Directory (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // signature PK\x05\x06
  eocdView.setUint16(4, 0, true); // disk number
  eocdView.setUint16(6, 0, true); // start disk
  eocdView.setUint16(8, entries.length, true); // entries on disk
  eocdView.setUint16(10, entries.length, true); // total entries
  eocdView.setUint32(12, centralDirSize, true); // central dir size
  eocdView.setUint32(16, offset, true); // offset of central dir
  eocdView.setUint16(20, 0, true); // comment length

  // Assemble the archive
  const totalLength = offset + centralDirSize + 22;
  const result = new Uint8Array(totalLength);
  let pos = 0;

  for (const entry of entries) {
    result.set(entry.localHeader, pos);
    pos += entry.localHeader.length;
    result.set(entry.contentBytes, pos);
    pos += entry.contentBytes.length;
  }

  for (const ch of centralHeaders) {
    result.set(ch, pos);
    pos += ch.length;
  }

  result.set(eocd, pos);
  return result;
}

/**
 * Formats a note for export preserving or generating YAML frontmatter.
 */
export function exportNoteMarkdown(note) {
  if (!note) return "";
  const parsed = parseFrontmatter(note.content || "");
  if (parsed.hasFrontmatter) {
    return note.content;
  }
  const fm = {
    title: note.title || "Untitled",
  };
  if (Array.isArray(note.tags) && note.tags.length > 0) {
    fm.tags = note.tags;
  }
  return formatFrontmatter(fm, note.content || "");
}

/**
 * Creates a ZIP archive of all notes in Obsidian vault format.
 */
export function createVaultZip(notes) {
  const files = (notes || []).map(note => {
    const safeTitle = (note.title || "Untitled").replace(/[/\\?%*:|"<>]/g, "-");
    const filename = `${safeTitle}.md`;
    const content = exportNoteMarkdown(note);
    return { name: filename, content };
  });
  return generateZipArchive(files);
}

/**
 * Graph Parser
 * Extracts Obsidian-compatible [[wikilinks]], builds bidirectional outlinks/backlinks,
 * extracts hashtags and YAML frontmatter, and detects Louvain communities.
 */
export class GraphParser {
  static parse(notes) {
    const nodes = new Map();
    const edges = [];

    // Initialize nodes from note titles
    for (const note of notes || []) {
      const parsedFm = parseFrontmatter(note.content || "");
      const inlineTags = extractHashtags(parsedFm.body || "");
      const fmTags = Array.isArray(parsedFm.frontmatter.tags)
        ? parsedFm.frontmatter.tags.map(t => String(t).replace(/^#/, ""))
        : [];
      const allTags = Array.from(new Set([...fmTags, ...inlineTags]));

      const words = parsedFm.body.trim().split(/\s+/).filter(Boolean);
      const wordCount = words.length;
      const title = (note.title || "Untitled").trim();

      nodes.set(title, {
        id: title,
        label: title,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        frontmatter: parsedFm.frontmatter,
        rawFrontmatter: parsedFm.rawFrontmatter,
        hasFrontmatter: parsedFm.hasFrontmatter,
        body: parsedFm.body,
        tags: allTags,
        wordCount,
        outlinks: [],
        backlinks: [],
        isPlaceholder: false,
      });
    }

    // Obsidian-compatible link regex: [[Target]], [[Target|Alias]], [[Target#Section]], [[Target#Section|Alias]]
    const linkRegex =
      /\[\[([^[\]|#\r\n]+)(?:#[^[\]|\r\n]+)?(?:\|([^[\]\r\n]+))?\]\]/g;

    for (const note of notes || []) {
      const sourceId = (note.title || "Untitled").trim();
      const content = note.content || "";
      let match;
      linkRegex.lastIndex = 0;

      while ((match = linkRegex.exec(content)) !== null) {
        const targetLabel = match[1].trim();
        const alias = match[2] ? match[2].trim() : null;
        if (!targetLabel) continue;

        // Ensure target node exists (as placeholder if not authored)
        if (!nodes.has(targetLabel)) {
          nodes.set(targetLabel, {
            id: targetLabel,
            label: targetLabel,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            frontmatter: {},
            rawFrontmatter: "",
            hasFrontmatter: false,
            body: "",
            tags: [],
            wordCount: 0,
            outlinks: [],
            backlinks: [],
            isPlaceholder: true,
          });
        }

        const sourceNode = nodes.get(sourceId);
        const targetNode = nodes.get(targetLabel);

        // Maintain bidirectional outlinks & backlinks
        if (sourceNode && !sourceNode.outlinks.includes(targetLabel)) {
          sourceNode.outlinks.push(targetLabel);
        }
        if (targetNode && !targetNode.backlinks.includes(sourceId)) {
          targetNode.backlinks.push(sourceId);
        }

        // Add directed edge (avoid duplicates)
        const edgeExists = edges.some(
          e => e.source === sourceId && e.target === targetLabel
        );
        if (!edgeExists) {
          edges.push({
            source: sourceId,
            target: targetLabel,
            alias: alias,
          });
        }
      }
    }

    const nodeArray = Array.from(nodes.values());

    // Community detection
    detectCommunities(nodeArray, edges);

    return { nodes: nodeArray, edges };
  }
}
