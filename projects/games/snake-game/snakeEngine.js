/**
 * Snake Game — snakeEngine.js
 * Pure state machine and collision detection logic for the classic Snake arcade game.
 * UMD format: browser global window.SnakeEngine and Node.js module.exports.
 */

(function (exports) {
  "use strict";

  const GRID_SIZE = 20;
  const MIN_GRID_SIZE = 3;
  const MAX_GRID_SIZE = 200;

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
   * Special food types. Durations are measured in game ticks so they pause
   * with the game and do not depend on the selected speed.
   */
  const POWER_UP_TYPES = {
    BONUS: "bonus", // Instant +50 points
    SLOW: "slow", // Snake moves slower for a while
    SHRINK: "shrink", // Instantly removes tail segments
  };

  const POWER_UP_CONFIG = {
    spawnChance: 0.25, // Chance to spawn after eating normal food
    lifetimeTicks: 60, // How long an uncollected power-up stays on the board
    bonusPoints: 50,
    slowTicks: 50,
    slowMultiplier: 1.6, // Tick interval multiplier while slowed
    shrinkSegments: 3,
    minLength: 3, // Shrink never takes the snake below this length
  };

  /**
   * Validates square board dimensions before they reach canvas or game state.
   * A 3x3 minimum provides one head and a 3-segment snake; 200 keeps the
   * 400px canvas from allocating tiles smaller than 2px.
   *
   * @param {unknown} gridSize
   * @param {unknown} initialLength
   * @returns {{gridSize: number, initialLength: number}}
   */
  function validateBoardDimensions(gridSize = GRID_SIZE, initialLength = 3) {
    if (
      typeof gridSize !== "number" ||
      Number.isNaN(gridSize) ||
      !Number.isFinite(gridSize)
    ) {
      throw new TypeError("gridSize must be a finite number");
    }
    if (!Number.isInteger(gridSize)) {
      throw new RangeError("gridSize must be a whole number");
    }
    if (gridSize < MIN_GRID_SIZE || gridSize > MAX_GRID_SIZE) {
      throw new RangeError(
        `gridSize must be between ${MIN_GRID_SIZE} and ${MAX_GRID_SIZE}`
      );
    }

    if (
      typeof initialLength !== "number" ||
      Number.isNaN(initialLength) ||
      !Number.isFinite(initialLength)
    ) {
      throw new TypeError("initialLength must be a finite number");
    }
    if (!Number.isInteger(initialLength)) {
      throw new RangeError("initialLength must be a whole number");
    }
    if (initialLength < 1) {
      throw new RangeError("initialLength must be a positive integer");
    }
    if (initialLength > gridSize) {
      throw new RangeError("initialLength cannot be greater than gridSize");
    }

    return { gridSize, initialLength };
  }

  /**
   * Builds the fixed inner-wall layout used by Maze mode.
   * Four corner brackets plus two short centre bars. The snake's starting
   * row is always left clear so the opening moves are safe.
   *
   * @param {number} [gridSize=20]
   * @returns {Array<Object>} Obstacle coordinates [{ x, y }]
   */
  function createMazeObstacles(gridSize = GRID_SIZE) {
    const dimensions = validateBoardDimensions(gridSize, 1);
    gridSize = dimensions.gridSize;

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
   * @param {boolean} [options.powerUps=false] - Enable special power-up food
   * @returns {Object} initial state
   */
  function createInitialState({
    gridSize = 20,
    initialLength = 3,
    highScore = 0,
    mode: requestedMode = MODES.CLASSIC,
    powerUps = false,
  } = {}) {
    const dimensions = validateBoardDimensions(gridSize, initialLength);
    gridSize = dimensions.gridSize;
    initialLength = dimensions.initialLength;

    const startX = Math.max(initialLength - 1, Math.floor(gridSize / 2));
    const startY = Math.floor(gridSize / 2);

    const snake = Array.from({ length: initialLength }, (_, index) => ({
      x: startX - index,
      y: startY,
    }));

    const mode = requestedMode === MODES.MAZE ? MODES.MAZE : MODES.CLASSIC;
    const obstacles = mode === MODES.MAZE ? createMazeObstacles(gridSize) : [];

    return {
      gridSize,
      mode,
      obstacles,
      snake,
      direction: { ...DIRECTIONS.RIGHT },
      nextDirection: { ...DIRECTIONS.RIGHT },
      food: generateFood(snake, gridSize, Math.random, obstacles),
      score: 0,
      highScore,
      isGameOver: false,
      isPaused: false,
      deathReason: null, // "self" | "wall" | "obstacle" | "win"
      powerUpsEnabled: powerUps === true,
      powerUp: null, // { x, y, type, ticksLeft } while on the board
      activeEffect: null, // { type, ticksLeft } while a timed effect runs
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
   * Picks a power-up type and a free cell for it.
   * The cell is never on the snake, an obstacle, or the normal food.
   *
   * @param {Object} state - Game state ({ snake, gridSize, obstacles, food })
   * @param {Function} [randomFn=Math.random]
   * @returns {Object|null} { x, y, type, ticksLeft } or null if no free cell
   */
  function spawnPowerUp(state, randomFn = Math.random) {
    const blocked = Array.isArray(state.obstacles) ? [...state.obstacles] : [];
    if (state.food) blocked.push(state.food);

    const cell = generateFood(state.snake, state.gridSize, randomFn, blocked);
    if (!cell) return null;

    const types = Object.values(POWER_UP_TYPES);
    const type = types[Math.floor(randomFn() * types.length)] || types[0];

    return {
      x: cell.x,
      y: cell.y,
      type,
      ticksLeft: POWER_UP_CONFIG.lifetimeTicks,
    };
  }

  /**
   * Applies a collected power-up to an already-moved state.
   *
   * @param {Object} state - State after the snake has moved onto the power-up
   * @param {string} type - One of POWER_UP_TYPES
   * @returns {Object} New state with the effect applied
   */
  function applyPowerUp(state, type) {
    switch (type) {
      case POWER_UP_TYPES.BONUS:
        return { ...state, score: state.score + POWER_UP_CONFIG.bonusPoints };
      case POWER_UP_TYPES.SLOW:
        return {
          ...state,
          activeEffect: {
            type: POWER_UP_TYPES.SLOW,
            ticksLeft: POWER_UP_CONFIG.slowTicks,
          },
        };
      case POWER_UP_TYPES.SHRINK: {
        const newLength = Math.max(
          POWER_UP_CONFIG.minLength,
          state.snake.length - POWER_UP_CONFIG.shrinkSegments
        );
        return { ...state, snake: state.snake.slice(0, newLength) };
      }
      default:
        return state;
    }
  }

  /**
   * Returns the multiplier the UI should apply to its tick interval.
   * 1 means normal speed; larger means slower.
   *
   * @param {Object} state
   * @returns {number}
   */
  function getSpeedMultiplier(state) {
    if (
      state &&
      state.activeEffect &&
      state.activeEffect.type === POWER_UP_TYPES.SLOW &&
      state.activeEffect.ticksLeft > 0
    ) {
      return POWER_UP_CONFIG.slowMultiplier;
    }
    return 1;
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
    const collectedPowerUp =
      state.powerUp &&
      nextHead.x === state.powerUp.x &&
      nextHead.y === state.powerUp.y
        ? state.powerUp
        : null;

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

    // Power-up still on the board after this move (expires when its timer runs out)
    let powerUp = null;
    if (state.powerUp && !collectedPowerUp && state.powerUp.ticksLeft > 1) {
      powerUp = { ...state.powerUp, ticksLeft: state.powerUp.ticksLeft - 1 };
    }

    // Normal food never spawns on the power-up cell
    let newFood = state.food;
    if (isEating) {
      const blocked = Array.isArray(state.obstacles)
        ? [...state.obstacles]
        : [];
      if (powerUp) blocked.push(powerUp);
      newFood = generateFood(newSnake, state.gridSize, randomFn, blocked);
      if (newFood === null && powerUp) {
        // Only the power-up's cell is free: drop it so food can still spawn
        powerUp = null;
        newFood = generateFood(
          newSnake,
          state.gridSize,
          randomFn,
          state.obstacles
        );
      }
    }

    // Count down the active timed effect (it applies to this tick, then expires)
    let activeEffect = null;
    if (state.activeEffect && state.activeEffect.ticksLeft > 1) {
      activeEffect = {
        ...state.activeEffect,
        ticksLeft: state.activeEffect.ticksLeft - 1,
      };
    }

    let next = {
      ...state,
      snake: newSnake,
      direction,
      nextDirection: direction,
      food: newFood,
      score: newScore,
      powerUp,
      activeEffect,
      isGameOver: newFood === null, // Win condition if all cells filled
      deathReason: newFood === null ? "win" : null,
    };

    if (collectedPowerUp) {
      next = applyPowerUp(next, collectedPowerUp.type);
    }

    // Occasionally spawn a new power-up after eating normal food
    if (
      state.powerUpsEnabled &&
      isEating &&
      !next.isGameOver &&
      !next.powerUp &&
      randomFn() < POWER_UP_CONFIG.spawnChance
    ) {
      next = { ...next, powerUp: spawnPowerUp(next, randomFn) };
    }

    next.highScore = Math.max(state.highScore, next.score);
    return next;
  }

  exports.GRID_SIZE = GRID_SIZE;
  exports.MIN_GRID_SIZE = MIN_GRID_SIZE;
  exports.MAX_GRID_SIZE = MAX_GRID_SIZE;
  exports.validateBoardDimensions = validateBoardDimensions;
  exports.DIRECTIONS = DIRECTIONS;
  exports.MODES = MODES;
  exports.POWER_UP_TYPES = POWER_UP_TYPES;
  exports.POWER_UP_CONFIG = POWER_UP_CONFIG;
  exports.spawnPowerUp = spawnPowerUp;
  exports.applyPowerUp = applyPowerUp;
  exports.getSpeedMultiplier = getSpeedMultiplier;
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
