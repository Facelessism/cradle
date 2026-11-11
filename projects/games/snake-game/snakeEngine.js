/**
 * Snake Game — snakeEngine.js
 * Pure state machine and collision detection logic for the classic Snake arcade game.
 * UMD format: browser global window.SnakeEngine and Node.js module.exports.
 */

(function (exports) {
  "use strict";

  const GRID_SIZE = 20;

  const DIRECTIONS = {
    UP: { x: 0, y: -1, name: "UP" },
    DOWN: { x: 0, y: 1, name: "DOWN" },
    LEFT: { x: -1, y: 0, name: "LEFT" },
    RIGHT: { x: 1, y: 0, name: "RIGHT" },
  };

  const MODES = {
    CLASSIC: "classic",
    MAZE: "maze",
  };

  /**
   * Builds the fixed inner-wall layout used by Maze mode.
   * Four corner brackets plus two short centre bars. The snake's starting
   * row is always left clear so the opening moves are safe.
   *
   * @param {number} [gridSize=20]
   * @returns {Array<Object>} Obstacle coordinates [{ x, y }]
   */
  function createMazeObstacles(gridSize = GRID_SIZE) {
    const cells = new Map();
    const add = (x, y) => {
      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        cells.set(`${x},${y}`, { x, y });
      }
    };

    const margin = 3;
    const arm = 5;
    const far = gridSize - 1 - margin;
    const mid = Math.floor(gridSize / 2);

    for (let i = 0; i < arm; i++) {
      // Horizontal arms of each corner bracket
      add(margin + i, margin);
      add(far - i, margin);
      add(margin + i, far);
      add(far - i, far);
      // Vertical arms of each corner bracket
      add(margin, margin + i);
      add(far, margin + i);
      add(margin, far - i);
      add(far, far - i);
    }

    // Two short bars above and below the centre
    for (let x = mid - 2; x <= mid + 1; x++) {
      add(x, margin + 3);
      add(x, far - 3);
    }

    // Keep the starting row clear
    return [...cells.values()].filter(cell => cell.y !== mid);
  }

  /**
   * Creates an initial snake game state.
   *
   * @param {Object} [options]
   * @param {number} [options.gridSize=20]
   * @param {number} [options.initialLength=3]
   * @param {number} [options.highScore=0]
   * @param {string} [options.mode="classic"] - "classic" or "maze"
   * @returns {Object} initial state
   */
  function createInitialState(options = {}) {
    const gridSize = options.gridSize || GRID_SIZE;
    const midX = Math.floor(gridSize / 2);
    const midY = Math.floor(gridSize / 2);

    const snake = [
      { x: midX, y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY },
    ];

    const mode = options.mode === MODES.MAZE ? MODES.MAZE : MODES.CLASSIC;
    const obstacles = mode === MODES.MAZE ? createMazeObstacles(gridSize) : [];

    const food = generateFood(snake, gridSize, Math.random, obstacles);

    return {
      gridSize,
      mode,
      obstacles,
      snake,
      direction: DIRECTIONS.RIGHT,
      nextDirection: DIRECTIONS.RIGHT,
      food,
      score: 0,
      highScore: options.highScore || 0,
      isGameOver: false,
      isPaused: false,
      deathReason: null, // "self" | "wall" | "obstacle" | "win"
    };
  }

  /**
   * Checks whether a new direction is a valid move (prevents 180-degree reversing into own neck).
   *
   * @param {Object} currentDir - { x, y }
   * @param {Object} nextDir - { x, y }
   * @returns {boolean}
   */
  function isValidDirectionChange(currentDir, nextDir) {
    if (!currentDir || !nextDir) return false;
    // Disallow exact opposite direction (e.g. moving RIGHT and pressing LEFT)
    return !(currentDir.x + nextDir.x === 0 && currentDir.y + nextDir.y === 0);
  }

  /**
   * Computes the next head position given current head and direction.
   *
   * @param {Object} head - { x, y }
   * @param {Object} direction - { x, y }
   * @returns {Object} { x, y }
   */
  function getNextHeadPosition(head, direction) {
    if (!head || !direction) return { x: 0, y: 0 };
    return {
      x: head.x + direction.x,
      y: head.y + direction.y,
    };
  }

  /**
   * Checks if position hits the boundary walls.
   *
   * @param {Object} position - { x, y }
   * @param {number} [gridSize=20]
   * @returns {boolean}
   */
  function checkWallCollision(position, gridSize = GRID_SIZE) {
    if (!position) return true;
    return (
      position.x < 0 ||
      position.x >= gridSize ||
      position.y < 0 ||
      position.y >= gridSize
    );
  }

  /**
   * Checks if position hits an inner obstacle (Maze mode).
   *
   * @param {Object} position - { x, y }
   * @param {Array<Object>} [obstacles=[]]
   * @returns {boolean}
   */
  function checkObstacleCollision(position, obstacles = []) {
    if (!position || !Array.isArray(obstacles)) return false;
    return obstacles.some(o => o.x === position.x && o.y === position.y);
  }

  /**
   * Checks if position collides with any segment in the snake body (Self-Collision Detection).
   * Addresses Issue #998: accurately detects when the snake head steers into its own segments.
   *
   * @param {Object} nextHead - The upcoming head position { x, y }
   * @param {Array<Object>} body - Array of body coordinates [{ x, y }]
   * @param {boolean} [willGrow=false] - Whether the snake will eat and grow on this step
   * @returns {boolean} True if self-collision occurred
   */
  function checkSelfCollision(nextHead, body, willGrow = false) {
    if (!nextHead || !Array.isArray(body) || body.length < 4) {
      return false;
    }
    // If the snake won't grow this step, the tail segment will vacate its position.
    // However, if willGrow is true, the tail remains.
    const segments = willGrow ? body : body.slice(0, -1);
    return segments.some(seg => seg.x === nextHead.x && seg.y === nextHead.y);
  }

  /**
   * Generates a random food coordinate not occupied by the snake or obstacles.
   *
   * @param {Array<Object>} snake - Current snake segments
   * @param {number} [gridSize=20]
   * @param {Function} [randomFn=Math.random]
   * @param {Array<Object>} [obstacles=[]] - Cells food must never spawn on
   * @returns {Object|null} Food coordinate { x, y } or null if grid is full
   */
  function generateFood(
    snake,
    gridSize = GRID_SIZE,
    randomFn = Math.random,
    obstacles = []
  ) {
    const occupied = new Set();
    if (Array.isArray(snake)) {
      snake.forEach(seg => occupied.add(`${seg.x},${seg.y}`));
    }
    if (Array.isArray(obstacles)) {
      obstacles.forEach(o => occupied.add(`${o.x},${o.y}`));
    }

    const emptyCells = [];
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        if (!occupied.has(`${x},${y}`)) {
          emptyCells.push({ x, y });
        }
      }
    }

    if (emptyCells.length === 0) return null; // Win state (grid completely filled)

    const index = Math.floor(randomFn() * emptyCells.length);
    return emptyCells[index];
  }

  /**
   * Advances the game state by one tick.
   *
   * @param {Object} state - Current game state
   * @param {Function} [randomFn=Math.random]
   * @returns {Object} New game state
   */
  function stepGame(state, randomFn = Math.random) {
    if (state.isGameOver || state.isPaused) {
      return state;
    }

    const direction = state.nextDirection || state.direction;
    const currentHead = state.snake[0];
    const nextHead = getNextHeadPosition(currentHead, direction);

    // 1. Wall collision check
    if (checkWallCollision(nextHead, state.gridSize)) {
      return {
        ...state,
        direction,
        isGameOver: true,
        deathReason: "wall",
      };
    }

    // 2. Obstacle collision check (Maze mode)
    if (checkObstacleCollision(nextHead, state.obstacles)) {
      return {
        ...state,
        direction,
        isGameOver: true,
        deathReason: "obstacle",
      };
    }

    // 3. Food check
    const isEating =
      state.food && nextHead.x === state.food.x && nextHead.y === state.food.y;

    // 4. Self-collision check (Issue #998)
    if (checkSelfCollision(nextHead, state.snake, isEating)) {
      return {
        ...state,
        direction,
        isGameOver: true,
        deathReason: "self",
      };
    }

    // 5. Move snake
    const newSnake = [nextHead, ...state.snake];
    if (!isEating) {
      newSnake.pop(); // Remove tail segment
    }

    const newScore = isEating ? state.score + 10 : state.score;
    const newHighScore = Math.max(state.highScore, newScore);
    const newFood = isEating
      ? generateFood(newSnake, state.gridSize, randomFn, state.obstacles)
      : state.food;

    return {
      ...state,
      snake: newSnake,
      direction,
      nextDirection: direction,
      food: newFood,
      score: newScore,
      highScore: newHighScore,
      isGameOver: newFood === null, // Win condition if all cells filled
      deathReason: newFood === null ? "win" : null,
    };
  }

  exports.GRID_SIZE = GRID_SIZE;
  exports.DIRECTIONS = DIRECTIONS;
  exports.MODES = MODES;
  exports.createMazeObstacles = createMazeObstacles;
  exports.createInitialState = createInitialState;
  exports.isValidDirectionChange = isValidDirectionChange;
  exports.getNextHeadPosition = getNextHeadPosition;
  exports.checkWallCollision = checkWallCollision;
  exports.checkObstacleCollision = checkObstacleCollision;
  exports.checkSelfCollision = checkSelfCollision;
  exports.generateFood = generateFood;
  exports.stepGame = stepGame;
})(typeof exports === "undefined" ? (window.SnakeEngine = {}) : exports);
