const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SnakeEngine = require("../projects/games/snake-game/snakeEngine.js");
const { DIRECTIONS, PLAYER_MODES } = SnakeEngine;

function createDuelState() {
  return SnakeEngine.createInitialState({
    playerMode: PLAYER_MODES.DUEL,
    powerUps: true,
  });
}

function updatePlayer(state, playerId, updates) {
  return {
    ...state,
    players: state.players.map(player =>
      player.id === playerId ? { ...player, ...updates } : player
    ),
  };
}

test("duel mode initializes two separated snakes and shared food", () => {
  const state = createDuelState();
  const [player1, player2] = state.players;
  const occupied = new Set(
    state.players.flatMap(player =>
      player.snake.map(segment => `${segment.x},${segment.y}`)
    )
  );

  assert.equal(state.playerMode, PLAYER_MODES.DUEL);
  assert.equal(state.players.length, 2);
  assert.deepEqual(player1.snake[0], { x: 2, y: 2 });
  assert.deepEqual(player2.snake[0], { x: 17, y: 17 });
  assert.deepEqual(
    player1.snake.map(segment => segment.y),
    [2, 2, 2]
  );
  assert.deepEqual(
    player2.snake.map(segment => segment.y),
    [17, 17, 17]
  );
  assert.equal(player1.direction.name, "RIGHT");
  assert.equal(player2.direction.name, "LEFT");
  assert.equal(player1.isAlive, true);
  assert.equal(player2.isAlive, true);
  assert.equal(occupied.has(`${state.food.x},${state.food.y}`), false);
  assert.equal(state.powerUpsEnabled, false);
});

test("duel mode requires enough board width to place both starting snakes", () => {
  assert.throws(
    () =>
      SnakeEngine.createInitialState({
        gridSize: 7,
        initialLength: 3,
        playerMode: PLAYER_MODES.DUEL,
      }),
    /Two-player mode requires/
  );
  assert.doesNotThrow(() =>
    SnakeEngine.createInitialState({
      gridSize: 8,
      initialLength: 3,
      playerMode: PLAYER_MODES.DUEL,
    })
  );
});

test("both duel snakes move independently in one game tick", () => {
  const state = createDuelState();
  const next = SnakeEngine.stepGame(state, () => 0);

  assert.deepEqual(next.players[0].snake[0], { x: 3, y: 2 });
  assert.deepEqual(next.players[1].snake[0], { x: 16, y: 17 });
  assert.equal(next.isGameOver, false);
});

test("duel food awards points and growth only to the player who reaches it", () => {
  let state = createDuelState();
  state = updatePlayer(state, "player1", {
    snake: [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ],
    direction: DIRECTIONS.RIGHT,
    nextDirection: DIRECTIONS.RIGHT,
  });
  state = updatePlayer(state, "player2", {
    snake: [
      { x: 14, y: 14 },
      { x: 15, y: 14 },
      { x: 16, y: 14 },
    ],
    direction: DIRECTIONS.LEFT,
    nextDirection: DIRECTIONS.LEFT,
  });
  state.food = { x: 6, y: 5 };

  const next = SnakeEngine.stepGame(state, () => 0);

  assert.equal(next.players[0].score, 10);
  assert.equal(next.players[0].snake.length, 4);
  assert.equal(next.players[1].score, 0);
  assert.equal(next.players[1].snake.length, 3);
  assert.notDeepEqual(next.food, { x: 6, y: 5 });
});

test("wall collision eliminates one player and names the surviving winner", () => {
  let state = createDuelState();
  state = updatePlayer(state, "player1", {
    snake: [
      { x: 19, y: 5 },
      { x: 18, y: 5 },
      { x: 17, y: 5 },
    ],
    direction: DIRECTIONS.RIGHT,
    nextDirection: DIRECTIONS.RIGHT,
  });

  const next = SnakeEngine.stepGame(state);

  assert.equal(next.isGameOver, true);
  assert.equal(next.players[0].isAlive, false);
  assert.equal(next.players[0].deathReason, "wall");
  assert.equal(next.players[1].isAlive, true);
  assert.equal(next.winner, "player2");
});

test("self collision eliminates the moving player", () => {
  let state = createDuelState();
  state = updatePlayer(state, "player1", {
    snake: [
      { x: 5, y: 5 },
      { x: 5, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 5 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
    ],
    direction: DIRECTIONS.LEFT,
    nextDirection: DIRECTIONS.LEFT,
  });

  const next = SnakeEngine.stepGame(state);

  assert.equal(next.players[0].isAlive, false);
  assert.equal(next.players[0].deathReason, "self");
  assert.equal(next.winner, "player2");
});

test("colliding with the other snake eliminates only the colliding player", () => {
  let state = createDuelState();
  state = updatePlayer(state, "player1", {
    snake: [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ],
    direction: DIRECTIONS.RIGHT,
    nextDirection: DIRECTIONS.RIGHT,
  });
  state = updatePlayer(state, "player2", {
    snake: [
      { x: 10, y: 10 },
      { x: 6, y: 5 },
      { x: 9, y: 10 },
    ],
    direction: DIRECTIONS.RIGHT,
    nextDirection: DIRECTIONS.RIGHT,
  });

  const next = SnakeEngine.stepGame(state);

  assert.equal(next.players[0].isAlive, false);
  assert.equal(next.players[0].deathReason, "snake");
  assert.equal(next.players[1].isAlive, true);
  assert.equal(next.winner, "player2");
});

test("simultaneous head-on collision ends in a draw", () => {
  let state = createDuelState();
  state = updatePlayer(state, "player1", {
    snake: [
      { x: 7, y: 10 },
      { x: 6, y: 10 },
      { x: 5, y: 10 },
    ],
    direction: DIRECTIONS.RIGHT,
    nextDirection: DIRECTIONS.RIGHT,
  });
  state = updatePlayer(state, "player2", {
    snake: [
      { x: 9, y: 10 },
      { x: 10, y: 10 },
      { x: 11, y: 10 },
    ],
    direction: DIRECTIONS.LEFT,
    nextDirection: DIRECTIONS.LEFT,
  });

  const next = SnakeEngine.stepGame(state);

  assert.equal(next.isGameOver, true);
  assert.equal(next.players[0].isAlive, false);
  assert.equal(next.players[1].isAlive, false);
  assert.equal(next.winner, null);
  assert.equal(next.deathReason, "draw");
});

test("resetting duel mode creates two fresh snakes and resets both scores", () => {
  const state = createDuelState();
  const reset = SnakeEngine.createInitialState({
    playerMode: PLAYER_MODES.DUEL,
  });

  assert.equal(reset.players.length, 2);
  assert.deepEqual(
    reset.players.map(player => player.score),
    [0, 0]
  );
  assert.deepEqual(
    reset.players.map(player => player.snake),
    state.players.map(player => player.snake)
  );
});

test("the game UI exposes duel selection and distinct keyboard controls", () => {
  const html = fs.readFileSync(
    path.resolve(__dirname, "../projects/games/snake-game/index.html"),
    "utf8"
  );
  const script = fs.readFileSync(
    path.resolve(__dirname, "../projects/games/snake-game/script.js"),
    "utf8"
  );

  assert.match(html, /<option value="duel">2 Players<\/option>/);
  assert.match(html, /Player 1:.*Player 2:/s);
  assert.match(script, /KeyW: \["player1"/);
  assert.match(script, /ArrowUp: \["player2"/);
});

test("the duel HUD visually separates the two player scores", () => {
  const html = fs.readFileSync(
    path.resolve(__dirname, "../projects/games/snake-game/index.html"),
    "utf8"
  );
  const script = fs.readFileSync(
    path.resolve(__dirname, "../projects/games/snake-game/script.js"),
    "utf8"
  );
  const style = fs.readFileSync(
    path.resolve(__dirname, "../projects/games/snake-game/style.css"),
    "utf8"
  );

  assert.match(html, /class="scores-container"/);
  assert.match(
    script,
    /scoresContainer\.classList\.toggle\("scores-container--duel", isDuel\)/
  );
  assert.match(
    style,
    /\.scores-container--duel \.score-card:first-child::after/
  );
});
