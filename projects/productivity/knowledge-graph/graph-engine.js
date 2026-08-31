import { StorageManager } from './storage.js';
import { GraphParser } from './parser.js';

/**
 * Graph Engine
 * Custom force-directed graph renderer using Canvas 2D with drag interactions.
 */
class GraphEngine {
    constructor(canvasId, storage) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.storage = storage;

        this.nodes = [];
        this.edges = [];

        this.transform = { x: 0, y: 0, k: 1 }; // Pan and zoom
        this.isDragging = false;
        this.draggedNode = null;
        this.lastMouse = { x: 0, y: 0 };

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.setupInteractions();

        // Animation loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.centerX = rect.width / 2;
        this.centerY = rect.height / 2;
    }

    async loadData() {
        const notes = await this.storage.getAllNotes();
        const graph = GraphParser.parse(notes);
        this.nodes = graph.nodes;
        this.edges = graph.edges;

        // Initialize random positions if new
        for (const node of this.nodes) {
            if (node.x === 0 && node.y === 0) {
                node.x = (Math.random() - 0.5) * 200;
                node.y = (Math.random() - 0.5) * 200;
            }
        }
        this.updateNoteList(notes);
    }

    updateNoteList(notes) {
        const listEl = document.getElementById('note-list');
        listEl.innerHTML = '';
        notes.forEach(note => {
            const div = document.createElement('div');
            div.className = 'note-item';
            div.textContent = note.title;
            div.addEventListener('click', () => {
                document.getElementById('note-title').value = note.title;
                document.getElementById('note-content').value = note.content;
                document.querySelectorAll('.note-item').forEach(i => i.classList.remove('active'));
                div.classList.add('active');
            });
            listEl.appendChild(div);
        });
    }

    setupInteractions() {
        this.canvas.addEventListener('mousedown', (e) => {
            const pos = this.screenToWorld(e.offsetX, e.offsetY);
            this.draggedNode = this.nodes.find(n => Math.hypot(n.x - pos.x, n.y - pos.y) < 20 / this.transform.k);
            if (this.draggedNode) {
                this.isDragging = true;
            } else {
                this.isPanning = true;
                this.lastMouse = { x: e.offsetX, y: e.offsetY };
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
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

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.isPanning = false;
            this.draggedNode = null;
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomIntensity = 0.1;
            const delta = e.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;
            this.transform.k = Math.max(0.1, Math.min(5, this.transform.k * delta));
        }, { passive: false });

        document.getElementById('btn-reset-zoom').addEventListener('click', () => {
            this.transform = { x: this.centerX, y: this.centerY, k: 1 };
        });
    }

    screenToWorld(sx, sy) {
        return {
            x: (sx - this.transform.x) / this.transform.k,
            y: (sy - this.transform.y) / this.transform.k
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

                if (a !== this.draggedNode) { a.vx += fx; a.vy += fy; }
                if (b !== this.draggedNode) { b.vx -= fx; b.vy -= fy; }
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

            if (source !== this.draggedNode) { source.vx += fx; source.vy += fy; }
            if (target !== this.draggedNode) { target.vx -= fx; target.vy -= fy; }
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
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(this.transform.x, this.transform.y);
        this.ctx.scale(this.transform.k, this.transform.k);

        const styles = getComputedStyle(document.documentElement);
        const edgeColor = styles.getPropertyValue('--edge-color').trim();
        const nodeColor = styles.getPropertyValue('--node-color').trim();
        const textColor = styles.getPropertyValue('--node-text').trim();

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
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(node.label, node.x, node.y);
        }

        this.ctx.restore();
    }

    animate() {
        this.applyForces();
        this.render();
        requestAnimationFrame(this.animate);
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    const storage = new StorageManager();
    await storage.init();
    const engine = new GraphEngine('graph-canvas', storage);
    await engine.loadData();

    const titleInput = document.getElementById('note-title');
    const contentInput = document.getElementById('note-content');
    const btnSave = document.getElementById('btn-save');
    const btnDelete = document.getElementById('btn-delete');

    btnSave.addEventListener('click', async () => {
        const title = titleInput.value.trim() || 'Untitled';
        const content = contentInput.value;
        await storage.saveNote({ id: title, title, content });
        await engine.loadData();
    });

    btnDelete.addEventListener('click', async () => {
        const title = titleInput.value.trim();
        if (title && confirm(`Delete "${title}"?`)) {
            await storage.deleteNote(title);
            titleInput.value = '';
            contentInput.value = '';
            await engine.loadData();
        }
    });

    // Auto-save on input debounce
    let timeout;
    contentInput.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
            const title = titleInput.value.trim() || 'Untitled';
            await storage.saveNote({ id: title, title, content: contentInput.value });
            await engine.loadData();
        }, 1000);
    });
});
