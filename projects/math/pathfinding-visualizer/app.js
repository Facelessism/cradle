import { Grid } from "./grid.js";
import {
  bfs,
  dijkstra,
  astar,
  bidirectionalDijkstra,
  bidirectionalAstar,
} from "./algorithms.js";

document.addEventListener("DOMContentLoaded", () => {
  const ROWS = 20;
  const COLS = 40;
  const grid = new Grid(ROWS, COLS, "grid-container");

  const btnVisualize = document.getElementById("btn-visualize");
  const btnClearBoard =
    document.getElementById("btn-clear-board") ||
    document.getElementById("btn-clear-grid");
  const btnClearWalls = document.getElementById("btn-clear-walls");
  const btnClearPath = document.getElementById("btn-clear-path");
  const btnGenerateMaze = document.getElementById("btn-generate-maze");
  const algorithmSelect = document.getElementById("algorithm-select");
  const speedSelect = document.getElementById("speed-select");
  const heuristicSelect = document.getElementById("heuristic-select");
  const heuristicGroup = document.getElementById("heuristic-group");
  const movementSelect = document.getElementById("movement-select");
  const cornerCuttingToggle = document.getElementById("corner-cutting-toggle");
  const cornerCuttingGroup = document.getElementById("corner-cutting-group");
  const statusMessage = document.getElementById("status-message");

  let isVisualizing = false;
  let animationSessionId = 0;

  function updateControlsState() {
    const algo = algorithmSelect.value;
    const isHeuristicAlgo =
      algo === "astar" || algo === "bidirectional-astar";

    if (heuristicGroup) {
      heuristicGroup.classList.toggle("disabled", !isHeuristicAlgo);
      if (heuristicSelect) heuristicSelect.disabled = !isHeuristicAlgo;
    }

    const isDiagonal = movementSelect && movementSelect.value === "diagonal";
    if (cornerCuttingGroup) {
      cornerCuttingGroup.classList.toggle("disabled", !isDiagonal);
      if (cornerCuttingToggle) cornerCuttingToggle.disabled = !isDiagonal;
    }
  }

  if (algorithmSelect) {
    algorithmSelect.addEventListener("change", updateControlsState);
  }

  if (movementSelect) {
    movementSelect.addEventListener("change", () => {
      if (movementSelect.value === "diagonal" && heuristicSelect) {
        if (heuristicSelect.value === "manhattan") {
          heuristicSelect.value = "octile";
        }
      } else if (movementSelect.value === "orthogonal" && heuristicSelect) {
        if (heuristicSelect.value === "octile") {
          heuristicSelect.value = "manhattan";
        }
      }
      updateControlsState();
    });
  }

  updateControlsState();

  function stopVisualization() {
    animationSessionId++;
    isVisualizing = false;
  }

  if (btnClearBoard) {
    btnClearBoard.addEventListener("click", () => {
      stopVisualization();
      grid.clearBoard();
      statusMessage.textContent = "Board cleared.";
    });
  }

  if (btnClearWalls) {
    btnClearWalls.addEventListener("click", () => {
      stopVisualization();
      grid.clearWalls();
      statusMessage.textContent = "Walls cleared.";
    });
  }

  if (btnClearPath) {
    btnClearPath.addEventListener("click", () => {
      stopVisualization();
      grid.clearPath();
      statusMessage.textContent = "Path cleared.";
    });
  }

  if (btnGenerateMaze) {
    btnGenerateMaze.addEventListener("click", () => {
      stopVisualization();
      grid.generateRandomMaze();
      statusMessage.textContent = "Random maze generated.";
    });
  }

  btnVisualize.addEventListener("click", async () => {
    if (isVisualizing) return;
    isVisualizing = true;
    grid.clearPath();
    statusMessage.textContent = "Visualizing...";

    const currentSession = ++animationSessionId;
    const algorithm = algorithmSelect.value;
    const speed = parseInt(speedSelect.value, 10);
    const startNode = grid.getStartNode();
    const endNode = grid.getEndNode();

    const allowDiagonal = movementSelect
      ? movementSelect.value === "diagonal"
      : false;
    const preventCornerCutting = cornerCuttingToggle
      ? cornerCuttingToggle.checked
      : true;
    const heuristic = heuristicSelect ? heuristicSelect.value : "manhattan";
    const options = { allowDiagonal, preventCornerCutting, heuristic };

    let result;
    switch (algorithm) {
      case "bfs":
        result = bfs(grid.grid, startNode, endNode, options);
        break;
      case "dijkstra":
        result = dijkstra(grid.grid, startNode, endNode, options);
        break;
      case "astar":
        result = astar(grid.grid, startNode, endNode, options);
        break;
      case "bidirectional-dijkstra":
        result = bidirectionalDijkstra(grid.grid, startNode, endNode, options);
        break;
      case "bidirectional-astar":
        result = bidirectionalAstar(grid.grid, startNode, endNode, options);
        break;
      default:
        result = astar(grid.grid, startNode, endNode, options);
        break;
    }

    await animateAlgorithm(
      result.visitedNodesInOrder,
      result.shortestPathNodes,
      speed,
      currentSession
    );

    if (animationSessionId !== currentSession) {
      return;
    }

    isVisualizing = false;

    if (result.shortestPathNodes.length > 0) {
      let cost = 0;
      for (let i = 0; i < result.shortestPathNodes.length - 1; i++) {
        const n1 = result.shortestPathNodes[i];
        const n2 = result.shortestPathNodes[i + 1];
        const isDiag = n1.r !== n2.r && n1.c !== n2.c;
        cost += isDiag ? Math.SQRT2 : 1;
      }
      const formattedCost = Number(cost.toFixed(2));
      statusMessage.textContent = `Path found! Length: ${result.shortestPathNodes.length} nodes (Cost: ${formattedCost}) | Visited: ${result.visitedNodesInOrder.length} nodes.`;
    } else {
      statusMessage.textContent = `No path found. Visited: ${result.visitedNodesInOrder.length} nodes.`;
    }
  });

  async function animateAlgorithm(
    visitedNodesInOrder,
    shortestPathNodes,
    speed,
    sessionId
  ) {
    for (let i = 0; i < visitedNodesInOrder.length; i++) {
      if (animationSessionId !== sessionId) return false;
      const node = visitedNodesInOrder[i];
      if (!node.isStart && !node.isEnd) {
        node.element.classList.add("visited");
        if (node.visitDirection === "backward") {
          node.element.classList.add("visited-backward");
        } else if (node.visitDirection === "forward") {
          node.element.classList.add("visited-forward");
        }
      }
      await sleep(speed);
      if (animationSessionId !== sessionId) return false;
    }

    if (shortestPathNodes.length > 0) {
      await sleep(Math.min(500, 5 * speed));
      if (animationSessionId !== sessionId) return false;

      const pathDelay = Math.max(15, Math.floor(speed / 2));
      for (let i = 0; i < shortestPathNodes.length; i++) {
        if (animationSessionId !== sessionId) return false;
        const node = shortestPathNodes[i];
        if (!node.isStart && !node.isEnd) {
          node.element.classList.add("path");
        }
        await sleep(pathDelay);
        if (animationSessionId !== sessionId) return false;
      }
    }

    return true;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
});
