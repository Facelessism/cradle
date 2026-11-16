const test = require("node:test");
const assert = require("node:assert/strict");

const SnakeEngine = require("../snakeEngine.js");

const { POWER_UP_TYPES, POWER_UP_CONFIG, DIRECTIONS } = SnakeEngine;

/** Returns a randomFn that yields the given values in order, then repeats the last. */
function sequence(...values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

/** A small running state: snake heading RIGHT at (5,5) on a roomy board. */
function makeState(overrides = {}) {
  return {
    ...SnakeEngine.createInitialState({ gridSize: 120, powerUps: true }),
    snake: [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ],
    direction: DIRECTIONS.RIGHT,
    nextDirection: DIRECTIONS.RIGHT,
    food: { x: 100, y: 100 },
    obstacles: [],
    powerUp: null,
    activeEffect: null,
    ...overrides,
  };
}

test("createInitialState: power-ups are off by default and start empty", () => {
  const classic = SnakeEngine.createInitialState();
  assert.equal(classic.powerUpsEnabled, false);
  assert.equal(classic.powerUp, null);
  assert.equal(classic.activeEffect, null);

  const enabled = SnakeEngine.createInitialState({ powerUps: true });
  assert.equal(enabled.powerUpsEnabled, true);
  assert.equal(enabled.powerUp, null);
  assert.equal(enabled.activeEffect, null);
});

test("createInitialState: respects initialLength and maze mode together", () => {
  const state = SnakeEngine.createInitialState({
    initialLength: 5,
    mode: "maze",
  });
  assert.equal(state.snake.length, 5);
  assert.equal(state.mode, "maze");
  assert.ok(state.obstacles.length > 0);
  assert.equal(
    SnakeEngine.checkObstacleCollision(state.food, state.obstacles),
    false
  );
});

test("spawnPowerUp only uses free cells (not snake, obstacles or food)", () => {
  const gridSize = 3;
  const snake = [{ x: 0, y: 0 }];
  const food = { x: 1, y: 0 };
  // Block everything else except (2,2)
  const obstacles = [];
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      const key = `${x},${y}`;
      if (!["0,0", "1,0", "2,2"].includes(key)) obstacles.push({ x, y });
    }
  }

  for (let i = 0; i < 25; i++) {
    const p = SnakeEngine.spawnPowerUp(
      { snake, food, obstacles, gridSize },
      Math.random
    );
    assert.equal(p.x, 2);
    assert.equal(p.y, 2);
    assert.ok(Object.values(POWER_UP_TYPES).includes(p.type));
    assert.equal(p.ticksLeft, POWER_UP_CONFIG.lifetimeTicks);
  }
});

test("spawnPowerUp returns null when the board has no free cell", () => {
  const p = SnakeEngine.spawnPowerUp({
    snake: [{ x: 0, y: 0 }],
    food: { x: 1, y: 0 },
    obstacles: [],
    gridSize: 1,
  });
  assert.equal(p, null);
});

test("stepGame spawns a power-up after eating when the roll succeeds", () => {
  const state = makeState({ food: { x: 6, y: 5 } });
  // generateFood index, spawn roll (< chance), power-up cell index, type index
  const next = SnakeEngine.stepGame(state, sequence(0.5, 0, 0.3, 0));

  assert.equal(next.score, 10);
  assert.ok(next.powerUp, "A power-up should have spawned");
  assert.equal(next.powerUp.type, POWER_UP_TYPES.BONUS);
  const onSnake = next.snake.some(
    s => s.x === next.powerUp.x && s.y === next.powerUp.y
  );
  assert.equal(onSnake, false);
  assert.notDeepEqual(
    { x: next.powerUp.x, y: next.powerUp.y },
    { x: next.food.x, y: next.food.y }
  );
});

test("stepGame does not spawn a power-up when the roll fails", () => {
  const state = makeState({ food: { x: 6, y: 5 } });
  const next = SnakeEngine.stepGame(state, sequence(0.5, 0.99));
  assert.equal(next.powerUp, null);
});

test("Normal food behaviour is unchanged when power-ups are disabled", () => {
  const state = makeState({ food: { x: 6, y: 5 }, powerUpsEnabled: false });
  const next = SnakeEngine.stepGame(state, () => 0);

  assert.equal(next.score, 10);
  assert.equal(next.snake.length, 4);
  assert.equal(next.powerUp, null);
  assert.equal(next.activeEffect, null);
});

test("Collecting BONUS adds points without growing the snake", () => {
  const state = makeState({
    powerUp: { x: 6, y: 5, type: POWER_UP_TYPES.BONUS, ticksLeft: 10 },
  });
  const next = SnakeEngine.stepGame(state);

  assert.equal(next.score, POWER_UP_CONFIG.bonusPoints);
  assert.equal(next.highScore, POWER_UP_CONFIG.bonusPoints);
  assert.equal(next.snake.length, 3);
  assert.equal(next.powerUp, null);
  assert.deepEqual(next.food, state.food, "Normal food stays where it was");
});

test("Collecting SHRINK removes tail segments but keeps a minimum length", () => {
  const long = makeState({
    snake: Array.from({ length: 8 }, (_, i) => ({ x: 20 - i, y: 5 })),
    powerUp: { x: 21, y: 5, type: POWER_UP_TYPES.SHRINK, ticksLeft: 10 },
  });
  const shrunk = SnakeEngine.stepGame(long);
  assert.equal(shrunk.snake.length, 8 - POWER_UP_CONFIG.shrinkSegments);
  assert.deepEqual(shrunk.snake[0], { x: 21, y: 5 });

  const short = makeState({
    snake: Array.from({ length: 4 }, (_, i) => ({ x: 20 - i, y: 5 })),
    powerUp: { x: 21, y: 5, type: POWER_UP_TYPES.SHRINK, ticksLeft: 10 },
  });
  assert.equal(
    SnakeEngine.stepGame(short).snake.length,
    POWER_UP_CONFIG.minLength
  );
});

test("Collecting SLOW applies a timed effect that expires", () => {
  let state = makeState({
    powerUp: { x: 6, y: 5, type: POWER_UP_TYPES.SLOW, ticksLeft: 10 },
  });
  assert.equal(SnakeEngine.getSpeedMultiplier(state), 1);

  state = SnakeEngine.stepGame(state);
  assert.deepEqual(state.activeEffect, {
    type: POWER_UP_TYPES.SLOW,
    ticksLeft: POWER_UP_CONFIG.slowTicks,
  });
  assert.equal(
    SnakeEngine.getSpeedMultiplier(state),
    POWER_UP_CONFIG.slowMultiplier
  );

  // The effect lasts exactly slowTicks ticks, then is cleared
  for (let i = 1; i < POWER_UP_CONFIG.slowTicks; i++) {
    state = SnakeEngine.stepGame(state);
    assert.ok(state.activeEffect, `effect should still run at tick ${i}`);
  }
  state = SnakeEngine.stepGame(state);
  assert.equal(state.activeEffect, null);
  assert.equal(SnakeEngine.getSpeedMultiplier(state), 1);
});

test("An uncollected power-up disappears after its lifetime", () => {
  let state = makeState({
    powerUp: { x: 5, y: 50, type: POWER_UP_TYPES.BONUS, ticksLeft: 3 },
  });
  state = SnakeEngine.stepGame(state);
  assert.equal(state.powerUp.ticksLeft, 2);
  state = SnakeEngine.stepGame(state);
  assert.equal(state.powerUp.ticksLeft, 1);
  state = SnakeEngine.stepGame(state);
  assert.equal(state.powerUp, null);
});

test("New normal food never spawns on the power-up cell", () => {
  const gridSize = 3;
  // Snake fills row 0 except the food cell; power-up sits on (2,2)
  for (let i = 0; i < 25; i++) {
    const state = {
      ...SnakeEngine.createInitialState({ gridSize, powerUps: true }),
      snake: [
        { x: 1, y: 0 },
        { x: 0, y: 0 },
      ],
      direction: DIRECTIONS.RIGHT,
      nextDirection: DIRECTIONS.RIGHT,
      food: { x: 2, y: 0 },
      obstacles: [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 0, y: 2 },
      ],
      powerUp: { x: 2, y: 2, type: POWER_UP_TYPES.BONUS, ticksLeft: 10 },
      activeEffect: null,
    };
    const next = SnakeEngine.stepGame(state, Math.random);
    // Only (1,2) is free for food
    assert.deepEqual(next.food, { x: 1, y: 2 });
    assert.deepEqual({ x: next.powerUp.x, y: next.powerUp.y }, { x: 2, y: 2 });
  }
});

test("Power-ups don't change collision rules", () => {
  const state = makeState({
    snake: [
      { x: 119, y: 5 },
      { x: 118, y: 5 },
      { x: 117, y: 5 },
    ],
    powerUp: { x: 10, y: 10, type: POWER_UP_TYPES.SLOW, ticksLeft: 10 },
    activeEffect: { type: POWER_UP_TYPES.SLOW, ticksLeft: 10 },
  });
  const next = SnakeEngine.stepGame(state);
  assert.equal(next.isGameOver, true);
  assert.equal(next.deathReason, "wall");
});

test("Restarting clears active power-up state", () => {
  const mid = makeState({
    powerUp: { x: 9, y: 9, type: POWER_UP_TYPES.SHRINK, ticksLeft: 5 },
    activeEffect: { type: POWER_UP_TYPES.SLOW, ticksLeft: 20 },
  });
  assert.ok(mid.powerUp && mid.activeEffect);

  const restarted = SnakeEngine.createInitialState({ powerUps: true });
  assert.equal(restarted.powerUp, null);
  assert.equal(restarted.activeEffect, null);
  assert.equal(SnakeEngine.getSpeedMultiplier(restarted), 1);
});
