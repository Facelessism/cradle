/**
 * Grid Manager for Pathfinding Visualizer
 * Handles grid state, DOM rendering, and user interactions.
 */
export class Grid {
    constructor(rows, cols, containerId) {
        this.rows = rows;
        this.cols = cols;
        this.container = document.getElementById(containerId);
        this.grid = [];
        this.isMouseDown = false;
        this.mouseMode = 'wall'; // 'wall', 'start', 'end'
        this.startNode = { r: Math.floor(rows / 2), c: Math.floor(cols / 4) };
        this.endNode = { r: Math.floor(rows / 2), c: Math.floor(cols * 0.75) };

        this.initGrid();
        this.setupEventListeners();
    }

    initGrid() {
        this.container.style.gridTemplateColumns = `repeat(${this.cols}, var(--cell-size))`;
        this.container.innerHTML = '';
        this.grid = [];

        for (let r = 0; r < this.rows; r++) {
            const row = [];
            for (let c = 0; c < this.cols; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.r = r;
                cell.dataset.c = c;

                if (r === this.startNode.r && c === this.startNode.c) cell.classList.add('start');
                if (r === this.endNode.r && c === this.endNode.c) cell.classList.add('end');

                this.container.appendChild(cell);
                row.push({
                    r, c,
                    isWall: false,
                    isStart: (r === this.startNode.r && c === this.startNode.c),
                    isEnd: (r === this.endNode.r && c === this.endNode.c),
                    element: cell,
                    distance: Infinity,
                    totalDistance: Infinity,
                    heuristic: 0,
                    previousNode: null,
                    isVisited: false
                });
            }
            this.grid.push(row);
        }
    }

    setupEventListeners() {
        this.container.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('cell')) {
                this.isMouseDown = true;
                this.handleCellInteraction(e.target);
            }
        });

        this.container.addEventListener('mouseover', (e) => {
            if (this.isMouseDown && e.target.classList.contains('cell')) {
                this.handleCellInteraction(e.target);
            }
        });

        document.addEventListener('mouseup', () => {
            this.isMouseDown = false;
        });
    }

    handleCellInteraction(cellElement) {
        const r = parseInt(cellElement.dataset.r);
        const c = parseInt(cellElement.dataset.c);
        const node = this.grid[r][c];

        if (node.isStart || node.isEnd) return;

        if (this.mouseMode === 'wall') {
            node.isWall = !node.isWall;
            cellElement.classList.toggle('wall', node.isWall);
        }
    }

    clearPath() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const node = this.grid[r][c];
                node.isVisited = false;
                node.previousNode = null;
                node.distance = Infinity;
                node.totalDistance = Infinity;
                node.heuristic = 0;
                node.element.classList.remove('visited', 'path');
            }
        }
    }

    clearGrid() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const node = this.grid[r][c];
                node.isWall = false;
                node.element.classList.remove('wall', 'visited', 'path');
            }
        }
        this.clearPath();
    }

    generateRandomMaze() {
        this.clearGrid();
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const node = this.grid[r][c];
                if (!node.isStart && !node.isEnd && Math.random() < 0.3) {
                    node.isWall = true;
                    node.element.classList.add('wall');
                }
            }
        }
    }

    getNode(r, c) {
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null;
        return this.grid[r][c];
    }

    getStartNode() { return this.grid[this.startNode.r][this.startNode.c]; }
    getEndNode() { return this.grid[this.endNode.r][this.endNode.c]; }
}
