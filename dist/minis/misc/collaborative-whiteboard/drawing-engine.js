/**
 * Drawing Engine
 * Handles Canvas 2D rendering, brush properties, and local undo/redo stack.
 */
export class DrawingEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;

        this.color = '#3b82f6';
        this.lineWidth = 3;

        this.history = [];
        this.historyStep = -1;
        this.maxHistory = 20;

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.setupCanvasEvents();
        this.saveState(); // Initial blank state
    }

    resizeCanvas() {
        // Save current content
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        tempCanvas.getContext('2d').drawImage(this.canvas, 0, 0);

        // Resize
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        // Restore content
        this.ctx.drawImage(tempCanvas, 0, 0);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }

    setupCanvasEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrawing(e.touches[0]);
        }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(e.touches[0]);
        }, { passive: false });
        this.canvas.addEventListener('touchend', () => this.stopDrawing());
    }

    getCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    startDrawing(e) {
        this.isDrawing = true;
        const coords = this.getCoordinates(e);
        this.lastX = coords.x;
        this.lastY = coords.y;
    }

    draw(e) {
        if (!this.isDrawing) return;
        const coords = this.getCoordinates(e);

        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(coords.x, coords.y);
        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.stroke();

        this.lastX = coords.x;
        this.lastY = coords.y;
    }

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.saveState();
        }
    }

    saveState() {
        this.historyStep++;
        if (this.historyStep < this.history.length) {
            this.history.length = this.historyStep; // Truncate redo history
        }
        this.history.push(this.canvas.toDataURL());
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.historyStep--;
        }
    }

    undo() {
        if (this.historyStep > 0) {
            this.historyStep--;
            this.restoreState();
            return true; // Indicates local undo
        }
        return false;
    }

    redo() {
        if (this.historyStep < this.history.length - 1) {
            this.historyStep++;
            this.restoreState();
            return true;
        }
        return false;
    }

    restoreState() {
        const img = new Image();
        img.src = this.history[this.historyStep];
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
        };
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveState();
    }

    setBrush(color, width) {
        this.color = color;
        this.lineWidth = width;
    }

    // Called when receiving remote draw commands
    drawRemote(x1, y1, x2, y2, color, width) {
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.stroke();
    }

    // Called when receiving remote clear
    clearRemote() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveState();
    }
}
