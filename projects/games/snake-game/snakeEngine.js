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

  /**
   * Creates an initial snake game state.
   *
   * @param {Object} [options]
   * @param {number} [options.gridSize=20]
   * @param {number} [options.initialLength=3]
   * @param {number} [options.highScore=0]
   * @returns {Object} initial state
   */
  function createInitialState({
    gridSize = 20,
    initialLength = 3,
    highScore = 0,
  } = {}) {
    if (!Number.isInteger(initialLength) || initialLength < 1) {
      throw new RangeError("initialLength must be a positive integer");
    }

    if (initialLength > gridSize) {
      throw new RangeError(
        "initialLength cannot be greater than gridSize"
      );
    }

    const startX = Math.floor(gridSize / 2);
    const startY = Math.floor(gridSize / 2);

    const snake = Array.from(
      { length: initialLength },
      (_, index) => ({
        x: startX - index,
        y: startY,
      })
    );

    return {
      gridSize,
      snake,
      direction: { ...DIRECTIONS.RIGHT },
      nextDirection: { ...DIRECTIONS.RIGHT },
      food: generateFood(snake, gridSize),
      score: 0,
      highScore,
      isGameOver: false,
      isPaused: false,
      deathReason: null,
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
   * Generates a random food coordinate not currently occupied by the snake.
   *
   * @param {Array<Object>} snake - Current snake segments
   * @param {number} [gridSize=20]
   * @param {Function} [randomFn=Math.random]
   * @returns {Object|null} Food coordinate { x, y } or null if grid is full
   */
  function generateFood(snake, gridSize = GRID_SIZE, randomFn = Math.random) {
    const occupied = new Set();
    if (Array.isArray(snake)) {
      snake.forEach(seg => occupied.add(`${seg.x},${seg.y}`));
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

    // 2. Food check
    const isEating =
      state.food && nextHead.x === state.food.x && nextHead.y === state.food.y;

    // 3. Self-collision check (Issue #998)
    if (checkSelfCollision(nextHead, state.snake, isEating)) {
      return {
        ...state,
        direction,
        isGameOver: true,
        deathReason: "self",
      };
    }

    // 4. Move snake
    const newSnake = [nextHead, ...state.snake];
    if (!isEating) {
      newSnake.pop(); // Remove tail segment
    }

    const newScore = isEating ? state.score + 10 : state.score;
    const newHighScore = Math.max(state.highScore, newScore);
    const newFood = isEating
      ? generateFood(newSnake, state.gridSize, randomFn)
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
  exports.createInitialState = createInitialState;
  exports.isValidDirectionChange = isValidDirectionChange;
  exports.getNextHeadPosition = getNextHeadPosition;
  exports.checkWallCollision = checkWallCollision;
  exports.checkSelfCollision = checkSelfCollision;
  exports.generateFood = generateFood;
  exports.stepGame = stepGame;
})(typeof exports === "undefined" ? (window.SnakeEngine = {}) : exports);
