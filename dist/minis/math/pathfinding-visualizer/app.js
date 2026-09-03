import { Grid } from './grid.js';
import { bfs, dijkstra, astar } from './algorithms.js';

document.addEventListener('DOMContentLoaded', () => {
    const ROWS = 20;
    const COLS = 40;
    const grid = new Grid(ROWS, COLS, 'grid-container');

    const btnVisualize = document.getElementById('btn-visualize');
    const btnClearGrid = document.getElementById('btn-clear-grid');
    const btnClearPath = document.getElementById('btn-clear-path');
    const btnGenerateMaze = document.getElementById('btn-generate-maze');
    const algorithmSelect = document.getElementById('algorithm-select');
    const speedSelect = document.getElementById('speed-select');
    const statusMessage = document.getElementById('status-message');

    let isVisualizing = false;

    btnClearGrid.addEventListener('click', () => {
        if (isVisualizing) return;
        grid.clearGrid();
        statusMessage.textContent = 'Grid cleared.';
    });

    btnClearPath.addEventListener('click', () => {
        if (isVisualizing) return;
        grid.clearPath();
        statusMessage.textContent = 'Path cleared.';
    });

    btnGenerateMaze.addEventListener('click', () => {
        if (isVisualizing) return;
        grid.generateRandomMaze();
        statusMessage.textContent = 'Random maze generated.';
    });

    btnVisualize.addEventListener('click', async () => {
        if (isVisualizing) return;
        isVisualizing = true;
        grid.clearPath();
        statusMessage.textContent = 'Visualizing...';

        const algorithm = algorithmSelect.value;
        const speed = parseInt(speedSelect.value, 10);
        const startNode = grid.getStartNode();
        const endNode = grid.getEndNode();

        let result;
        switch (algorithm) {
            case 'bfs':
                result = bfs(grid.grid, startNode, endNode);
                break;
            case 'dijkstra':
                result = dijkstra(grid.grid, startNode, endNode);
                break;
            case 'astar':
                result = astar(grid.grid, startNode, endNode);
                break;
        }

        await animateAlgorithm(result.visitedNodesInOrder, result.shortestPathNodes, speed);
        isVisualizing = false;

        if (result.shortestPathNodes.length > 0) {
            statusMessage.textContent = `Path found! Length: ${result.shortestPathNodes.length} nodes.`;
        } else {
            statusMessage.textContent = 'No path found.';
        }
    });

    async function animateAlgorithm(visitedNodesInOrder, shortestPathNodes, speed) {
        for (let i = 0; i <= visitedNodesInOrder.length; i++) {
            if (i === visitedNodesInOrder.length) {
                await sleep(10 * speed);
                animateShortestPath(shortestPathNodes, speed);
                return;
            }
            const node = visitedNodesInOrder[i];
            if (!node.isStart && !node.isEnd) {
                node.element.classList.add('visited');
            }
            await sleep(speed);
        }
    }

    function animateShortestPath(shortestPathNodes, speed) {
        for (let i = 0; i < shortestPathNodes.length; i++) {
            setTimeout(() => {
                const node = shortestPathNodes[i];
                if (!node.isStart && !node.isEnd) {
                    node.element.classList.add('path');
                }
            }, i * (speed / 2));
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
