const test = require("node:test");
const assert = require("node:assert/strict");

const SnakeEngine = require("../projects/games/snake-game/snakeEngine.js");

test("createInitialState initializes standard snake game state", () => {
  const state = SnakeEngine.createInitialState();

  assert.equal(state.gridSize, 20);
  assert.equal(state.snake.length, 3);
  assert.equal(state.score, 0);
  assert.equal(state.isGameOver, false);
  assert.equal(state.isPaused, false);
  assert.ok(state.food, "Food should be generated");
  assert.equal(state.direction.name, "RIGHT");
});

test("isValidDirectionChange prevents 180-degree suicidal reversal", () => {
  const { UP, DOWN, LEFT, RIGHT } = SnakeEngine.DIRECTIONS;

  // Cannot turn directly opposite
  assert.equal(SnakeEngine.isValidDirectionChange(RIGHT, LEFT), false);
  assert.equal(SnakeEngine.isValidDirectionChange(LEFT, RIGHT), false);
  assert.equal(SnakeEngine.isValidDirectionChange(UP, DOWN), false);
  assert.equal(SnakeEngine.isValidDirectionChange(DOWN, UP), false);

  // Can turn 90 degrees
  assert.equal(SnakeEngine.isValidDirectionChange(RIGHT, UP), true);
  assert.equal(SnakeEngine.isValidDirectionChange(RIGHT, DOWN), true);
  assert.equal(SnakeEngine.isValidDirectionChange(UP, LEFT), true);
  assert.equal(SnakeEngine.isValidDirectionChange(UP, RIGHT), true);
});

test("checkWallCollision detects boundary wall collisions", () => {
  assert.equal(SnakeEngine.checkWallCollision({ x: 0, y: 0 }, 20), false);
  assert.equal(SnakeEngine.checkWallCollision({ x: 19, y: 19 }, 20), false);

  assert.equal(SnakeEngine.checkWallCollision({ x: -1, y: 5 }, 20), true);
  assert.equal(SnakeEngine.checkWallCollision({ x: 20, y: 5 }, 20), true);
  assert.equal(SnakeEngine.checkWallCollision({ x: 5, y: -1 }, 20), true);
  assert.equal(SnakeEngine.checkWallCollision({ x: 5, y: 20 }, 20), true);
});

test("checkSelfCollision returns false for safe movements", () => {
  const snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
    { x: 7, y: 10 },
  ];

  // Moving forward into empty space
  assert.equal(SnakeEngine.checkSelfCollision({ x: 11, y: 10 }, snake), false);
  // Moving up into empty space
  assert.equal(SnakeEngine.checkSelfCollision({ x: 10, y: 9 }, snake), false);
});

test("Issue #998 - checkSelfCollision detects head colliding with any body segment", () => {
  // A snake looped in a U-shape:
  // (10,10) Head -> (10,9) -> (9,9) -> (9,10) -> (9,11) -> (10,11)
  const snake = [
    { x: 10, y: 10 },
    { x: 10, y: 9 },
    { x: 9, y: 9 },
    { x: 9, y: 10 },
    { x: 9, y: 11 },
    { x: 10, y: 11 },
  ];

  // If head attempts to move into (9,10) (an existing body segment)
  const collidingHead = { x: 9, y: 10 };
  assert.equal(
    SnakeEngine.checkSelfCollision(collidingHead, snake),
    true,
    "Self-collision must be detected when head matches a body segment"
  );
});

test("Issue #998 - Reproduction: Snake of >= 5 segments steering into its own body triggers Game Over", () => {
  // Set up snake with 6 segments in an almost-closed square:
  // Head at (5, 5), body looping around: (5,4), (4,4), (4,5), (4,6), (5,6)
  const snake = [
    { x: 5, y: 5 }, // head
    { x: 5, y: 4 },
    { x: 4, y: 4 },
    { x: 4, y: 5 },
    { x: 4, y: 6 },
    { x: 5, y: 6 },
  ];

  const state = {
    gridSize: 20,
    snake,
    direction: SnakeEngine.DIRECTIONS.LEFT,
    nextDirection: SnakeEngine.DIRECTIONS.LEFT, // Steers directly into segment (4,5)
    food: { x: 15, y: 15 },
    score: 50,
    highScore: 100,
    isGameOver: false,
    isPaused: false,
    deathReason: null,
  };

  const nextState = SnakeEngine.stepGame(state);

  assert.equal(
    nextState.isGameOver,
    true,
    "Game must immediately transition to game-over when head collides with body"
  );
  assert.equal(
    nextState.deathReason,
    "self",
    "Death reason must identify self-collision"
  );
});

test("stepGame moves snake and handles food consumption accurately", () => {
  const initial = SnakeEngine.createInitialState({ gridSize: 20 });
  const foodPos = { x: initial.snake[0].x + 1, y: initial.snake[0].y };

  const stateWithFoodAhead = {
    ...initial,
    food: foodPos,
  };

  // Step into food
  const afterFoodState = SnakeEngine.stepGame(stateWithFoodAhead, () => 0.5);

  assert.equal(afterFoodState.score, 10, "Score should increment by 10");
  assert.equal(
    afterFoodState.snake.length,
    4,
    "Snake should grow by 1 segment"
  );
  assert.deepEqual(
    afterFoodState.snake[0],
    foodPos,
    "New head should be on the food tile"
  );
  assert.notDeepEqual(
    afterFoodState.food,
    foodPos,
    "New food should be spawned elsewhere"
  );
});

test("generateFood never spawns on top of existing snake segments", () => {
  const gridSize = 5;
  // Fill almost entire 5x5 grid with snake
  const snake = [];
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (!(x === 4 && y === 4)) {
        snake.push({ x, y });
      }
    }
  }

  // Only (4,4) is free
  const food = SnakeEngine.generateFood(snake, gridSize);
  assert.deepEqual(food, { x: 4, y: 4 });
});

test("Classic mode (default) has no obstacles", () => {
  const state = SnakeEngine.createInitialState();
  assert.equal(state.mode, "classic");
  assert.deepEqual(state.obstacles, []);

  const explicit = SnakeEngine.createInitialState({ mode: "unknown" });
  assert.equal(explicit.mode, "classic");
  assert.deepEqual(explicit.obstacles, []);
});

test("Maze mode creates obstacles that don't overlap the snake or food", () => {
  const state = SnakeEngine.createInitialState({ mode: "maze" });
  assert.equal(state.mode, "maze");
  assert.ok(state.obstacles.length > 0, "Maze mode should have obstacles");

  const blocked = new Set(state.obstacles.map(o => `${o.x},${o.y}`));
  state.snake.forEach(seg =>
    assert.equal(blocked.has(`${seg.x},${seg.y}`), false)
  );
  assert.equal(blocked.has(`${state.food.x},${state.food.y}`), false);

  // All obstacles are inside the board
  state.obstacles.forEach(o => {
    assert.equal(SnakeEngine.checkWallCollision(o, state.gridSize), false);
  });
});

test("Maze mode keeps the snake's opening path clear", () => {
  let state = SnakeEngine.createInitialState({ mode: "maze" });
  state.food = null;
  const head = state.snake[0];
  // Moving RIGHT from the start must reach the outer wall without hitting an obstacle
  for (let x = head.x + 1; x < state.gridSize; x++) {
    state = SnakeEngine.stepGame({ ...state, food: { x: 0, y: 0 } });
    assert.equal(state.isGameOver, false, `crashed early at x=${x}`);
  }
});

test("checkObstacleCollision detects obstacle hits", () => {
  const obstacles = [
    { x: 3, y: 3 },
    { x: 4, y: 3 },
  ];
  assert.equal(
    SnakeEngine.checkObstacleCollision({ x: 3, y: 3 }, obstacles),
    true
  );
  assert.equal(
    SnakeEngine.checkObstacleCollision({ x: 5, y: 3 }, obstacles),
    false
  );
  assert.equal(SnakeEngine.checkObstacleCollision({ x: 3, y: 3 }, []), false);
  assert.equal(SnakeEngine.checkObstacleCollision({ x: 3, y: 3 }), false);
});

test("stepGame ends the game when the snake hits an obstacle", () => {
  const state = {
    ...SnakeEngine.createInitialState({ mode: "maze" }),
    snake: [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ],
    direction: SnakeEngine.DIRECTIONS.RIGHT,
    nextDirection: SnakeEngine.DIRECTIONS.RIGHT,
    obstacles: [{ x: 6, y: 5 }],
    food: { x: 0, y: 0 },
  };

  const next = SnakeEngine.stepGame(state);
  assert.equal(next.isGameOver, true);
  assert.equal(next.deathReason, "obstacle");
  // Snake does not move into the obstacle
  assert.deepEqual(next.snake[0], { x: 5, y: 5 });
});

test("generateFood never spawns inside obstacles", () => {
  const gridSize = 3;
  const snake = [{ x: 0, y: 0 }];
  // Block every cell except (2,2)
  const obstacles = [];
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (!(x === 0 && y === 0) && !(x === 2 && y === 2)) {
        obstacles.push({ x, y });
      }
    }
  }
  for (let i = 0; i < 20; i++) {
    const food = SnakeEngine.generateFood(
      snake,
      gridSize,
      Math.random,
      obstacles
    );
    assert.deepEqual(food, { x: 2, y: 2 });
  }
});

test("Food eaten in Maze mode respawns outside obstacles", () => {
  const base = SnakeEngine.createInitialState({ mode: "maze" });
  const head = base.snake[0];
  const state = { ...base, food: { x: head.x + 1, y: head.y } };

  for (let i = 0; i < 50; i++) {
    const next = SnakeEngine.stepGame(state);
    assert.equal(next.score, 10);
    assert.equal(
      SnakeEngine.checkObstacleCollision(next.food, next.obstacles),
      false
    );
  }
});
