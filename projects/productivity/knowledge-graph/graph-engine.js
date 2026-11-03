import { StorageManager } from "./storage.js";
import { GraphParser } from "./parser.js";
import { placeNodes, getCenteredTransform } from "./layout.js";

/**
 * Graph Engine
 * Custom force-directed graph renderer using Canvas 2D with drag interactions.
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
    const notes = await this.storage.getAllNotes();
    const graph = GraphParser.parse(notes);
    this.nodes = placeNodes(graph.nodes, previousNodes);
    this.edges = graph.edges;
    this.updateNoteList(notes);
  }

  updateNoteList(notes) {
    if (typeof document === "undefined") return;
    const listEl = document.getElementById("note-list");
    if (!listEl) return;
    listEl.innerHTML = "";
    notes.forEach(note => {
      const div = document.createElement("div");
      div.className = "note-item";
      div.textContent = note.title;
      div.addEventListener("click", () => {
        const titleEl = document.getElementById("note-title");
        const contentEl = document.getElementById("note-content");
        if (titleEl) titleEl.value = note.title;
        if (contentEl) contentEl.value = note.content;
        document
          .querySelectorAll(".note-item")
          .forEach(i => i.classList.remove("active"));
        div.classList.add("active");
      });
      listEl.appendChild(div);
    });
  }

  setupInteractions() {
    if (!this.canvas || typeof this.canvas.addEventListener !== "function")
      return;

    this.canvas.addEventListener("mousedown", e => {
      const pos = this.screenToWorld(e.offsetX, e.offsetY);
      this.draggedNode = this.nodes.find(
        n => Math.hypot(n.x - pos.x, n.y - pos.y) < 20 / this.transform.k
      );
      if (this.draggedNode) {
        this.isDragging = true;
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
    }
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

        if (a !== this.draggedNode) {
          a.vx += fx;
          a.vy += fy;
        }
        if (b !== this.draggedNode) {
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

      if (source !== this.draggedNode) {
        source.vx += fx;
        source.vy += fy;
      }
      if (target !== this.draggedNode) {
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    // Center gravity & update positions
    for (const node of this.nodes) {
      if (node === this.draggedNode) continue;

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
    const edgeColor = styles
      ? styles.getPropertyValue("--edge-color").trim()
      : "#999";
    const nodeColor = styles
      ? styles.getPropertyValue("--node-color").trim()
      : "#6366f1";
    const textColor = styles
      ? styles.getPropertyValue("--node-text").trim()
      : "#fff";

    // Draw edges
    this.ctx.strokeStyle = edgeColor;
    this.ctx.lineWidth = 2 / this.transform.k;
    this.ctx.beginPath();
    for (const edge of this.edges) {
      const source = this.nodes.find(n => n.id === edge.source);
      const target = this.nodes.find(n => n.id === edge.target);
      if (source && target) {
        this.ctx.moveTo(source.x, source.y);
        this.ctx.lineTo(target.x, target.y);
      }
    }
    this.ctx.stroke();

    // Draw nodes
    for (const node of this.nodes) {
      this.ctx.fillStyle = nodeColor;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, 20 / this.transform.k, 0, Math.PI * 2);
      this.ctx.fill();

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
