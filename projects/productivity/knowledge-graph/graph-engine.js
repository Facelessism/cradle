import { StorageManager } from "./storage.js";
import {
  GraphParser,
  createVaultZip,
  exportNoteMarkdown,
  parseFrontmatter,
  CLUSTER_COLORS,
} from "./parser.js";
import {
  placeNodes,
  getCenteredTransform,
  computeArrowhead,
} from "./layout.js";

/**
 * Graph Engine
 * Custom force-directed graph renderer using Canvas 2D with:
 * - Obsidian-compatible [[wikilinks]], #hashtags, and YAML frontmatter
 * - Bidirectional backlink indexing and interactive link inspection
 * - Louvain community-detection cluster coloring
 * - Full-text search with query highlighting and smooth camera focal centering
 * - Local vault drag-and-drop import and PKZIP vault export
 * - Directed edge arrowheads and persistent node pinning
 */
export class GraphEngine {
  constructor(canvasId, storage) {
    this.canvas =
      typeof canvasId === "string"
        ? typeof document !== "undefined"
          ? document.getElementById(canvasId)
          : null
        : canvasId;
    this.ctx =
      this.canvas && typeof this.canvas.getContext === "function"
        ? this.canvas.getContext("2d")
        : null;
    this.storage = storage;

    this.nodes = [];
    this.edges = [];
    this.rawNotes = [];
    this.activeNote = null;

    // Feature states
    this.useClusterColors = true;
    this.searchQuery = "";
    this.searchResults = new Set();
    this.focusedNodeId = null;
    this.cameraAnimId = null;

    this.hasInitializedSize = false;
    this.transform = { x: 0, y: 0, k: 1 }; // Pan and zoom
    this.isDragging = false;
    this.isPanning = false;
    this.draggedNode = null;
    this.lastMouse = { x: 0, y: 0 };

    this.resizeCanvas();
    this.transform = getCenteredTransform(
      this.canvas ? this.canvas.width : 0,
      this.canvas ? this.canvas.height : 0,
      1
    );

    if (
      typeof window !== "undefined" &&
      typeof window.addEventListener === "function"
    ) {
      this.boundResize = () => this.resizeCanvas();
      window.addEventListener("resize", this.boundResize);
    }
    this.setupInteractions();

    // Animation loop
    this.animate = this.animate.bind(this);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(this.animate);
    }
  }

  resizeCanvas() {
    if (!this.canvas) return;
    let newWidth = this.canvas.width || 800;
    let newHeight = this.canvas.height || 600;

    if (
      this.canvas.parentElement &&
      typeof this.canvas.parentElement.getBoundingClientRect === "function"
    ) {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      if (
        rect &&
        typeof rect.width === "number" &&
        typeof rect.height === "number"
      ) {
        newWidth = rect.width;
        newHeight = rect.height;
      }
    }

    if (this.hasInitializedSize) {
      const deltaW = newWidth - this.canvas.width;
      const deltaH = newHeight - this.canvas.height;
      this.transform.x += deltaW / 2;
      this.transform.y += deltaH / 2;
    }

    this.canvas.width = newWidth;
    this.canvas.height = newHeight;
    this.centerX = newWidth / 2;
    this.centerY = newHeight / 2;
    this.hasInitializedSize = true;
  }

  async loadData() {
    const previousNodes = this.nodes;
    let notes = (await this.storage.getAllNotes()) || [];

    // Seed default knowledge graph vault if completely empty in browser
    if (
      typeof window !== "undefined" &&
      typeof document !== "undefined" &&
      notes.length === 0
    ) {
      const defaultNotes = [
        {
          id: "Knowledge Graph",
          title: "Knowledge Graph",
          content:
            "---\ntitle: Knowledge Graph\ntags: [pkm, graph, obsidian]\n---\nWelcome to your local-first knowledge graph!\nExplore bidirectional connections with [[Obsidian Links]] and #pkm workflows.\nDiscover automatic community clusters via [[Louvain Modularity]].",
        },
        {
          id: "Obsidian Links",
          title: "Obsidian Links",
          content:
            "---\ntitle: Obsidian Links\ntags: [obsidian, syntax]\n---\nObsidian wikilinks support custom aliases like [[Louvain Modularity|Community Detection]] and section anchors.\nLinks are bi-directional: this note links back to [[Knowledge Graph]].",
        },
        {
          id: "Louvain Modularity",
          title: "Louvain Modularity",
          content:
            "---\ntitle: Louvain Modularity\ntags: [algorithms, math]\n---\nThe Louvain algorithm optimizes modularity Q to discover natural clusters in interconnected networks.\nUsed here to group related notes in [[Knowledge Graph]] and [[Second Brain]].",
        },
        {
          id: "Second Brain",
          title: "Second Brain",
          content:
            "---\ntitle: Second Brain\ntags: [pkm, productivity]\n---\nA digital repository for ideas, inspired by Tiago Forte's PARA method and [[Zettelkasten Method]].\nConnected to [[Knowledge Graph]].",
        },
        {
          id: "Zettelkasten Method",
          title: "Zettelkasten Method",
          content:
            "---\ntitle: Zettelkasten Method\ntags: [pkm, writing]\n---\nNiklas Luhmann's slip-box note-taking technique using interconnected atomic notes.\nPowers modern [[Second Brain]] practices.",
        },
      ];
      for (const dn of defaultNotes) {
        await this.storage.saveNote(dn);
      }
      notes = (await this.storage.getAllNotes()) || [];
    }

    this.rawNotes = notes;
    const graph = GraphParser.parse(notes);
    this.nodes = placeNodes(graph.nodes, previousNodes);
    this.edges = graph.edges;

    if (this.searchQuery) {
      this.searchNotes(this.searchQuery);
    }

    this.updateNoteList(notes);

    // Refresh active note inspector if one is selected
    if (this.activeNote) {
      const current = notes.find(n => n.id === this.activeNote.id);
      if (current) {
        this.selectNote(current, false);
      }
    }
  }

  /**
   * Searches notes by title, markdown body, #tags, and frontmatter.
   * Updates matching results set for visual canvas dimming and highlighting.
   */
  searchNotes(query) {
    this.searchQuery = (query || "").trim();
    this.searchResults.clear();

    if (!this.searchQuery) {
      this.updateSearchCounter(0, true);
      return [];
    }

    const q = this.searchQuery.toLowerCase();
    const isTagSearch = q.startsWith("#");
    const tagTerm = isTagSearch ? q.slice(1) : q;

    const matches = [];
    for (const node of this.nodes) {
      let isMatch = false;

      if (isTagSearch) {
        isMatch = (node.tags || []).some(t =>
          t.toLowerCase().includes(tagTerm)
        );
      } else {
        const titleMatch = (node.label || "").toLowerCase().includes(q);
        const bodyMatch = (node.body || "").toLowerCase().includes(q);
        const tagMatch = (node.tags || []).some(t =>
          t.toLowerCase().includes(q)
        );
        isMatch = titleMatch || bodyMatch || tagMatch;
      }

      if (isMatch) {
        this.searchResults.add(node.id);
        matches.push(node.id);
      }
    }

    this.updateSearchCounter(matches.length, false);
    return matches;
  }

  updateSearchCounter(count, isEmpty) {
    if (typeof document === "undefined") return;
    const countEl = document.getElementById("search-count");
    if (!countEl) return;

    if (isEmpty) {
      countEl.textContent = "";
    } else {
      countEl.textContent = `${count} of ${this.nodes.length} notes`;
    }
  }

  /**
   * Smoothly animates the canvas camera to center on a target node.
   */
  focusNode(nodeId, targetZoom = 1.25, duration = 400) {
    const targetNode = this.nodes.find(n => n.id === nodeId);
    if (!targetNode || !this.canvas) return;

    this.focusedNodeId = nodeId;

    const canvasW = this.canvas.width || 800;
    const canvasH = this.canvas.height || 600;
    const targetK = Math.max(0.4, Math.min(3, targetZoom));
    const targetX = canvasW / 2 - targetNode.x * targetK;
    const targetY = canvasH / 2 - targetNode.y * targetK;

    if (
      typeof requestAnimationFrame !== "function" ||
      typeof performance === "undefined"
    ) {
      this.transform = { x: targetX, y: targetY, k: targetK };
      return;
    }

    if (this.cameraAnimId) {
      cancelAnimationFrame(this.cameraAnimId);
      this.cameraAnimId = null;
    }

    const startX = this.transform.x;
    const startY = this.transform.y;
    const startK = this.transform.k;
    const startTime = performance.now();

    const step = now => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // EaseInOutCubic
      const ease =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.transform.x = startX + (targetX - startX) * ease;
      this.transform.y = startY + (targetY - startY) * ease;
      this.transform.k = startK + (targetK - startK) * ease;

      if (progress < 1) {
        this.cameraAnimId = requestAnimationFrame(step);
      } else {
        this.cameraAnimId = null;
      }
    };

    this.cameraAnimId = requestAnimationFrame(step);
  }

  /**
   * Toggles Louvain community cluster coloring on/off.
   */
  toggleClusterColors() {
    this.useClusterColors = !this.useClusterColors;
    if (typeof document !== "undefined") {
      const btn = document.getElementById("btn-cluster-toggle");
      if (btn) {
        btn.textContent = `Clusters: ${this.useClusterColors ? "ON" : "OFF"}`;
        btn.classList.toggle("active", this.useClusterColors);
      }
    }
    return this.useClusterColors;
  }

  /**
   * Selects a note into the editor and inspects its backlinks and tags.
   */
  selectNote(noteOrId, shouldFocusCamera = true) {
    let note = null;
    if (typeof noteOrId === "string") {
      note = this.rawNotes.find(n => n.id === noteOrId || n.title === noteOrId);
      if (!note) {
        // Create placeholder note if clicked from a link to an unwritten note
        note = {
          id: noteOrId,
          title: noteOrId,
          content: `# ${noteOrId}\n\nWrite your note content here.`,
        };
      }
    } else {
      note = noteOrId;
    }

    this.activeNote = note;

    if (typeof document !== "undefined") {
      const titleEl = document.getElementById("note-title");
      const contentEl = document.getElementById("note-content");
      if (titleEl) titleEl.value = note.title || "";
      if (contentEl) contentEl.value = note.content || "";

      // Highlight active item in note list
      document.querySelectorAll(".note-item").forEach(item => {
        if (item.getAttribute("data-id") === note.id) {
          item.classList.add("active");
        } else {
          item.classList.remove("active");
        }
      });

      // Update inspector details
      const node = this.nodes.find(n => n.id === note.id);
      this.updateInspector(node, note);
    }

    if (shouldFocusCamera) {
      this.focusNode(note.id);
    }
  }

  /**
   * Updates the inspector panel with bidirectional backlinks, outgoing links, and tags.
   */
  updateInspector(node, note) {
    if (typeof document === "undefined") return;

    const backlinksCountEl = document.getElementById("backlinks-count");
    const backlinksListEl = document.getElementById("backlinks-list");
    const outlinksCountEl = document.getElementById("outlinks-count");
    const outlinksListEl = document.getElementById("outlinks-list");
    const tagsListEl = document.getElementById("tags-list");
    const clusterBadgeEl = document.getElementById("cluster-badge");

    const backlinks = node && Array.isArray(node.backlinks) ? node.backlinks : [];
    const outlinks = node && Array.isArray(node.outlinks) ? node.outlinks : [];
    const tags = node && Array.isArray(node.tags) ? node.tags : [];

    // Backlinks (Linked References)
    if (backlinksCountEl) backlinksCountEl.textContent = String(backlinks.length);
    if (backlinksListEl) {
      backlinksListEl.innerHTML = "";
      if (backlinks.length === 0) {
        const hint = document.createElement("span");
        hint.className = "empty-hint";
        hint.textContent = "No incoming backlinks";
        backlinksListEl.appendChild(hint);
      } else {
        backlinks.forEach(sourceId => {
          const btn = document.createElement("button");
          btn.className = "chip";
          btn.textContent = sourceId;
          btn.setAttribute("aria-label", `Open backlink ${sourceId}`);
          btn.addEventListener("click", () => this.selectNote(sourceId, true));
          backlinksListEl.appendChild(btn);
        });
      }
    }

    // Outgoing Links
    if (outlinksCountEl) outlinksCountEl.textContent = String(outlinks.length);
    if (outlinksListEl) {
      outlinksListEl.innerHTML = "";
      if (outlinks.length === 0) {
        const hint = document.createElement("span");
        hint.className = "empty-hint";
        hint.textContent = "No outgoing links";
        outlinksListEl.appendChild(hint);
      } else {
        outlinks.forEach(targetId => {
          const btn = document.createElement("button");
          btn.className = "chip";
          btn.textContent = targetId;
          btn.setAttribute("aria-label", `Open outgoing link ${targetId}`);
          btn.addEventListener("click", () => this.selectNote(targetId, true));
          outlinksListEl.appendChild(btn);
        });
      }
    }

    // Tags & Community
    if (tagsListEl) {
      tagsListEl.innerHTML = "";
      if (tags.length === 0) {
        const hint = document.createElement("span");
        hint.className = "empty-hint";
        hint.textContent = "No tags";
        tagsListEl.appendChild(hint);
      } else {
        tags.forEach(tag => {
          const btn = document.createElement("button");
          btn.className = "chip chip-tag";
          btn.textContent = `#${tag}`;
          btn.setAttribute("aria-label", `Search tag ${tag}`);
          btn.addEventListener("click", () => {
            const searchInput = document.getElementById("graph-search");
            if (searchInput) {
              searchInput.value = `#${tag}`;
            }
            this.searchNotes(`#${tag}`);
          });
          tagsListEl.appendChild(btn);
        });
      }
    }

    // Cluster Badge
    if (clusterBadgeEl) {
      if (node && node.clusterId !== undefined) {
        clusterBadgeEl.style.display = "inline-flex";
        clusterBadgeEl.innerHTML = `<span class="cluster-dot" style="background:${node.clusterColor || "#6366f1"}"></span> Cluster ${node.clusterId + 1}`;
      } else {
        clusterBadgeEl.style.display = "none";
      }
    }
  }

  updateNoteList(notes) {
    if (typeof document === "undefined") return;
    const listEl = document.getElementById("note-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    (notes || []).forEach(note => {
      const node = this.nodes.find(n => n.id === note.id);
      const div = document.createElement("div");
      div.className = "note-item";
      div.setAttribute("data-id", note.id);

      if (this.activeNote && this.activeNote.id === note.id) {
        div.classList.add("active");
      }

      const left = document.createElement("div");
      left.className = "note-item-left";

      const dot = document.createElement("span");
      dot.className = "cluster-dot";
      dot.style.background =
        node && node.clusterColor ? node.clusterColor : "#6366f1";
      left.appendChild(dot);

      const titleSpan = document.createElement("span");
      titleSpan.textContent = note.title;
      left.appendChild(titleSpan);

      div.appendChild(left);

      const badges = document.createElement("div");
      badges.className = "note-item-badges";

      const backlinksCount =
        node && Array.isArray(node.backlinks) ? node.backlinks.length : 0;
      if (backlinksCount > 0) {
        const blBadge = document.createElement("span");
        blBadge.className = "badge";
        blBadge.textContent = `${backlinksCount} bl`;
        badges.appendChild(blBadge);
      }

      div.appendChild(badges);

      div.addEventListener("click", () => {
        this.selectNote(note, true);
      });

      listEl.appendChild(div);
    });
  }

  getNodeAt(worldX, worldY) {
    const radius = 20 / this.transform.k;
    return (
      this.nodes.find(n => Math.hypot(n.x - worldX, n.y - worldY) <= radius) ||
      null
    );
  }

  isNodePinned(node) {
    return Boolean(
      node &&
        (node.pinned ||
          (node.fx !== undefined &&
            node.fx !== null &&
            node.fy !== undefined &&
            node.fy !== null))
    );
  }

  toggleNodePin(node) {
    if (!node) return false;
    const isPinned = this.isNodePinned(node);
    if (isPinned) {
      node.pinned = false;
      node.fx = null;
      node.fy = null;
    } else {
      node.pinned = true;
      node.fx = node.x;
      node.fy = node.y;
      node.vx = 0;
      node.vy = 0;
    }
    return node.pinned;
  }

  setupInteractions() {
    if (!this.canvas || typeof this.canvas.addEventListener !== "function")
      return;

    this.canvas.addEventListener("mousedown", e => {
      const pos = this.screenToWorld(e.offsetX, e.offsetY);
      this.draggedNode = this.getNodeAt(pos.x, pos.y);
      if (this.draggedNode) {
        this.isDragging = true;
        this.selectNote(this.draggedNode.id, false);
      } else {
        this.isPanning = true;
        this.lastMouse = { x: e.offsetX, y: e.offsetY };
      }
    });

    this.canvas.addEventListener("mousemove", e => {
      if (this.isDragging && this.draggedNode) {
        const pos = this.screenToWorld(e.offsetX, e.offsetY);
        this.draggedNode.x = pos.x;
        this.draggedNode.y = pos.y;
        this.draggedNode.vx = 0;
        this.draggedNode.vy = 0;
        if (this.isNodePinned(this.draggedNode)) {
          this.draggedNode.fx = pos.x;
          this.draggedNode.fy = pos.y;
        }
      } else if (this.isPanning) {
        const dx = e.offsetX - this.lastMouse.x;
        const dy = e.offsetY - this.lastMouse.y;
        this.transform.x += dx;
        this.transform.y += dy;
        this.lastMouse = { x: e.offsetX, y: e.offsetY };
      }
    });

    this.canvas.addEventListener("mouseup", () => {
      this.isDragging = false;
      this.isPanning = false;
      this.draggedNode = null;
    });

    this.canvas.addEventListener("dblclick", e => {
      const pos = this.screenToWorld(e.offsetX, e.offsetY);
      const clicked = this.getNodeAt(pos.x, pos.y);
      if (clicked) {
        this.toggleNodePin(clicked);
      }
    });

    this.canvas.addEventListener("contextmenu", e => {
      const pos = this.screenToWorld(e.offsetX, e.offsetY);
      const clicked = this.getNodeAt(pos.x, pos.y);
      if (clicked) {
        e.preventDefault();
        this.toggleNodePin(clicked);
      }
    });

    this.canvas.addEventListener(
      "wheel",
      e => {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const delta = e.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;
        this.transform.k = Math.max(0.1, Math.min(5, this.transform.k * delta));
      },
      { passive: false }
    );

    if (typeof document !== "undefined") {
      const resetBtn = document.getElementById("btn-reset-zoom");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          this.transform = getCenteredTransform(
            this.canvas.width,
            this.canvas.height,
            1
          );
        });
      }

      const clusterBtn = document.getElementById("btn-cluster-toggle");
      if (clusterBtn) {
        clusterBtn.addEventListener("click", () => {
          this.toggleClusterColors();
        });
      }

      const searchInput = document.getElementById("graph-search");
      if (searchInput) {
        searchInput.addEventListener("input", e => {
          const matches = this.searchNotes(e.target.value);
          if (matches.length > 0 && e.target.value.trim().length > 2) {
            // Focus on first match
            this.focusNode(matches[0]);
          }
        });
        searchInput.addEventListener("keydown", e => {
          if (e.key === "Enter") {
            const matches = this.searchNotes(searchInput.value);
            if (matches.length > 0) {
              this.selectNote(matches[0], true);
            }
          }
        });
      }

      this.setupVaultImportExport();
    }
  }

  /**
   * Sets up drag-and-drop vault import, native file picker, and ZIP/MD export.
   */
  setupVaultImportExport() {
    if (typeof document === "undefined") return;

    const workspace = document.getElementById("workspace");
    const canvasWrapper = document.getElementById("canvas-wrapper");
    const dropOverlay = document.getElementById("drop-overlay");
    const fileInput = document.getElementById("vault-file-input");
    const btnImportVault = document.getElementById("btn-import-vault");
    const btnExportVault = document.getElementById("btn-export-vault");
    const btnExportNote = document.getElementById("btn-export-note");

    // File input trigger
    if (btnImportVault && fileInput) {
      btnImportVault.addEventListener("click", () => {
        fileInput.click();
      });
      fileInput.addEventListener("change", async e => {
        if (e.target.files && e.target.files.length > 0) {
          await this.importMarkdownFiles(Array.from(e.target.files));
          fileInput.value = "";
        }
      });
    }

    // Drag-and-drop on workspace / canvas
    if (workspace && dropOverlay) {
      let dragCounter = 0;

      workspace.addEventListener("dragenter", e => {
        e.preventDefault();
        dragCounter++;
        dropOverlay.style.display = "flex";
      });

      workspace.addEventListener("dragleave", e => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          dropOverlay.style.display = "none";
        }
      });

      workspace.addEventListener("dragover", e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      });

      workspace.addEventListener("drop", async e => {
        e.preventDefault();
        dragCounter = 0;
        dropOverlay.style.display = "none";

        if (e.dataTransfer && e.dataTransfer.files) {
          const files = Array.from(e.dataTransfer.files);
          const mdFiles = files.filter(f =>
            /\.(md|markdown)$/i.test(f.name)
          );
          if (mdFiles.length > 0) {
            await this.importMarkdownFiles(mdFiles);
          }
        }
      });
    }

    // Export Vault as ZIP
    if (btnExportVault) {
      btnExportVault.addEventListener("click", async () => {
        const notes = await this.storage.getAllNotes();
        if (!notes || notes.length === 0) {
          alert("No notes available in vault to export.");
          return;
        }
        const zipBytes = createVaultZip(notes);
        const blob = new Blob([zipBytes], { type: "application/zip" });
        this.downloadBlob(blob, "knowledge-graph-vault.zip");
      });
    }

    // Export Current Note as .md
    if (btnExportNote) {
      btnExportNote.addEventListener("click", () => {
        const titleInput = document.getElementById("note-title");
        const contentInput = document.getElementById("note-content");
        const title = (titleInput && titleInput.value.trim()) || "Untitled";
        const content = (contentInput && contentInput.value) || "";

        const formatted = exportNoteMarkdown({ title, content });
        const blob = new Blob([formatted], { type: "text/markdown;charset=utf-8" });
        const safeTitle = title.replace(/[/\\?%*:|"<>]/g, "-");
        this.downloadBlob(blob, `${safeTitle}.md`);
      });
    }
  }

  /**
   * Imports multiple markdown files into the vault, preserving YAML frontmatter.
   */
  async importMarkdownFiles(files) {
    let importedCount = 0;

    for (const file of files) {
      try {
        const content = await this.readFileAsText(file);
        const defaultTitle = file.name.replace(/\.(md|markdown)$/i, "");
        const parsed = parseFrontmatter(content);
        const title =
          parsed.frontmatter && parsed.frontmatter.title
            ? String(parsed.frontmatter.title).trim()
            : defaultTitle;

        await this.storage.saveNote({
          id: title,
          title,
          content,
        });
        importedCount++;
      } catch (err) {
        console.error("Failed to import markdown file:", file.name, err);
      }
    }

    if (importedCount > 0) {
      await this.loadData();
    }
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  downloadBlob(blob, filename) {
    if (typeof document === "undefined" || typeof URL === "undefined") return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.transform.x) / this.transform.k,
      y: (sy - this.transform.y) / this.transform.k,
    };
  }

  applyForces() {
    const repulsion = 5000;
    const springLength = 100;
    const springStrength = 0.05;
    const damping = 0.85;
    const centerStrength = 0.01;

    // Repulsion (node vs node)
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i];
        const b = this.nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy) || 1;
        const force = repulsion / (dist * dist);

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (a !== this.draggedNode && !this.isNodePinned(a)) {
          a.vx += fx;
          a.vy += fy;
        }
        if (b !== this.draggedNode && !this.isNodePinned(b)) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }
    }

    // Spring (edges)
    for (const edge of this.edges) {
      const source = this.nodes.find(n => n.id === edge.source);
      const target = this.nodes.find(n => n.id === edge.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.hypot(dx, dy) || 1;
      const force = (dist - springLength) * springStrength;

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (source !== this.draggedNode && !this.isNodePinned(source)) {
        source.vx += fx;
        source.vy += fy;
      }
      if (target !== this.draggedNode && !this.isNodePinned(target)) {
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    // Center gravity & update positions
    for (const node of this.nodes) {
      if (node === this.draggedNode) continue;

      if (this.isNodePinned(node)) {
        if (node.fx !== undefined && node.fx !== null) node.x = node.fx;
        if (node.fy !== undefined && node.fy !== null) node.y = node.fy;
        node.vx = 0;
        node.vy = 0;
        continue;
      }

      node.vx += (0 - node.x) * centerStrength;
      node.vy += (0 - node.y) * centerStrength;

      node.vx *= damping;
      node.vy *= damping;

      node.x += node.vx;
      node.y += node.vy;
    }
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.translate(this.transform.x, this.transform.y);
    this.ctx.scale(this.transform.k, this.transform.k);

    const styles =
      typeof document !== "undefined"
        ? getComputedStyle(document.documentElement)
        : null;
    const defaultEdgeColor = styles
      ? styles.getPropertyValue("--edge-color").trim() || "#999"
      : "#999";
    const defaultNodeColor = styles
      ? styles.getPropertyValue("--node-color").trim() || "#6366f1"
      : "#6366f1";
    const textColor = styles
      ? styles.getPropertyValue("--node-text").trim() || "#fff"
      : "#fff";
    const pinColor = styles
      ? styles.getPropertyValue("--pin-color").trim() || "#f59e0b"
      : "#f59e0b";
    const focusColor = styles
      ? styles.getPropertyValue("--focus-ring").trim() || "#38bdf8"
      : "#38bdf8";

    const nodeRadius = 20 / this.transform.k;
    const arrowLength = 9 / this.transform.k;
    const arrowAngle = Math.PI / 6;

    const isSearchActive = Boolean(
      this.searchQuery && this.searchResults.size > 0
    );

    // Draw directed edges with arrowheads
    this.ctx.lineWidth = 2 / this.transform.k;

    for (const edge of this.edges) {
      const source = this.nodes.find(n => n.id === edge.source);
      const target = this.nodes.find(n => n.id === edge.target);
      if (!source || !target) continue;

      const isEdgeDimmed =
        isSearchActive &&
        (!this.searchResults.has(edge.source) ||
          !this.searchResults.has(edge.target));

      if (isEdgeDimmed) {
        this.ctx.globalAlpha = 0.15;
        this.ctx.strokeStyle = defaultEdgeColor;
        this.ctx.fillStyle = defaultEdgeColor;
      } else {
        this.ctx.globalAlpha = 1.0;
        this.ctx.strokeStyle = defaultEdgeColor;
        this.ctx.fillStyle = defaultEdgeColor;
      }

      const arrow = computeArrowhead(
        source,
        target,
        nodeRadius,
        arrowLength,
        arrowAngle
      );

      this.ctx.beginPath();
      this.ctx.moveTo(source.x, source.y);
      if (arrow) {
        this.ctx.lineTo(arrow.tip.x, arrow.tip.y);
      } else {
        this.ctx.lineTo(target.x, target.y);
      }
      this.ctx.stroke();

      if (arrow) {
        this.ctx.beginPath();
        this.ctx.moveTo(arrow.tip.x, arrow.tip.y);
        this.ctx.lineTo(arrow.left.x, arrow.left.y);
        this.ctx.lineTo(arrow.right.x, arrow.right.y);
        this.ctx.closePath();
        this.ctx.fill();
      }
    }

    this.ctx.globalAlpha = 1.0;

    // Draw nodes
    for (const node of this.nodes) {
      const isPinned = this.isNodePinned(node);
      const isMatched = isSearchActive && this.searchResults.has(node.id);
      const isDimmed = isSearchActive && !isMatched;
      const isFocused = this.focusedNodeId === node.id;

      if (isDimmed) {
        this.ctx.globalAlpha = 0.2;
      } else {
        this.ctx.globalAlpha = 1.0;
      }

      // Determine node fill color (Louvain community cluster or default)
      let nodeFill = defaultNodeColor;
      if (this.useClusterColors && node.clusterColor) {
        nodeFill = node.clusterColor;
      }

      // Focused camera pulse or search match halo ring
      if (isFocused || isMatched) {
        this.ctx.strokeStyle = focusColor;
        this.ctx.lineWidth = 4 / this.transform.k;
        this.ctx.beginPath();
        this.ctx.arc(
          node.x,
          node.y,
          (20 + 6) / this.transform.k,
          0,
          Math.PI * 2
        );
        this.ctx.stroke();
      }

      // Pinned halo accent ring
      if (isPinned) {
        this.ctx.strokeStyle = pinColor;
        this.ctx.lineWidth = 3 / this.transform.k;
        this.ctx.beginPath();
        this.ctx.arc(
          node.x,
          node.y,
          (20 + 4) / this.transform.k,
          0,
          Math.PI * 2
        );
        this.ctx.stroke();
      }

      // Node body
      this.ctx.fillStyle = nodeFill;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
      this.ctx.fill();

      // Placeholder node border indicator
      if (node.isPlaceholder) {
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.lineWidth = 1.5 / this.transform.k;
        this.ctx.stroke();
      }

      // Label text
      this.ctx.fillStyle = textColor;
      this.ctx.font = `${12 / this.transform.k}px system-ui`;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(node.label, node.x, node.y);
    }

    this.ctx.restore();
  }

  animate() {
    this.applyForces();
    this.render();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(this.animate);
    }
  }
}

// Initialize App in browser
if (typeof document !== "undefined" && typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", async () => {
    const canvasEl = document.getElementById("graph-canvas");
    if (!canvasEl) return;

    const storage = new StorageManager();
    await storage.init();
    const engine = new GraphEngine("graph-canvas", storage);
    await engine.loadData();

    const titleInput = document.getElementById("note-title");
    const contentInput = document.getElementById("note-content");
    const btnSave = document.getElementById("btn-save");
    const btnDelete = document.getElementById("btn-delete");

    if (btnSave && titleInput && contentInput) {
      btnSave.addEventListener("click", async () => {
        const title = titleInput.value.trim() || "Untitled";
        const content = contentInput.value;
        await storage.saveNote({ id: title, title, content });
        await engine.loadData();
      });
    }

    if (btnDelete && titleInput && contentInput) {
      btnDelete.addEventListener("click", async () => {
        const title = titleInput.value.trim();
        if (title && confirm(`Delete "${title}"?`)) {
          await storage.deleteNote(title);
          titleInput.value = "";
          contentInput.value = "";
          engine.activeNote = null;
          await engine.loadData();
        }
      });
    }

    // Auto-save on input debounce
    if (contentInput && titleInput) {
      let timeout;
      contentInput.addEventListener("input", () => {
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
          const title = titleInput.value.trim() || "Untitled";
          await storage.saveNote({
            id: title,
            title,
            content: contentInput.value,
          });
          await engine.loadData();
        }, 1000);
      });
    }
  });
}
