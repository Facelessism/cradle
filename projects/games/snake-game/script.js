/**
 * Snake Game — script.js
 * Canvas rendering, input handling, sound synthesis, and lifecycle controller.
 */

document.addEventListener("DOMContentLoaded", () => {
  /* ── DOM References ── */
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("scoreValue");
  const highScoreEl = document.getElementById("highScoreValue");
  const lengthEl = document.getElementById("lengthValue");
  const scoreLabel = document.getElementById("scoreLabel");
  const highScoreLabel = document.getElementById("highScoreLabel");
  const lengthLabel = document.getElementById("lengthLabel");
  const scoresContainer = document.querySelector(".scores-container");
  const speedSelect = document.getElementById("speedSelect");
  const modeSelect = document.getElementById("modeSelect");
  const playerModeSelect = document.getElementById("playerModeSelect");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const gameOverModal = document.getElementById("gameOverModal");
  const deathReasonEl = document.getElementById("deathReason");
  const finalScoreEl = document.getElementById("finalScore");
  const finalHighScoreEl = document.getElementById("finalHighScore");
  const finalScoreLabel = document.getElementById("finalScoreLabel");
  const finalHighScoreLabel = document.getElementById("finalHighScoreLabel");
  const restartBtn = document.getElementById("restartBtn");
  const powerupLegend = document.querySelector(".powerup-legend");

  // D-Pad buttons for mobile
  const btnUp = document.getElementById("dpadUp");
  const btnDown = document.getElementById("dpadDown");
  const btnLeft = document.getElementById("dpadLeft");
  const btnRight = document.getElementById("dpadRight");

  /* ── Audio Synthesis (Web Audio API) ── */
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    try {
      const ac = getAudioContext();
      if (!ac) return;

      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);

      const now = ac.currentTime;

      if (type === "eat") {
        // High cheery blip
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === "gameover") {
        // Low descending thud
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.35);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "powerup") {
        // Bright rising arpeggio
        osc.type = "square";
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.06);
        osc.frequency.setValueAtTime(784, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === "turn") {
        // Soft click
        osc.type = "triangle";
        osc.frequency.setValueAtTime(300, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.start(now);
        osc.stop(now + 0.03);
      }
    } catch {
      /* Audio policy or unavailable */
    }
  }

  /* ── Storage Helper (CradleStorage) ── */
  const STORAGE_KEY = "cradle_snake_high_score";
  function loadHighScore() {
    if (
      window.CradleStorage &&
      typeof window.CradleStorage.get === "function"
    ) {
      return window.CradleStorage.get(
        STORAGE_KEY,
        0,
        v => Number.isInteger(v) && v >= 0
      );
    }
    try {
      const val = parseInt(localStorage.getItem(STORAGE_KEY), 10);
      return isNaN(val) ? 0 : val;
    } catch {
      return 0;
    }
  }

  function saveHighScore(score) {
    if (
      window.CradleStorage &&
      typeof window.CradleStorage.set === "function"
    ) {
      window.CradleStorage.set(STORAGE_KEY, score);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, String(score));
    } catch {
      /* ignore */
    }
  }

  /* ── Game Settings & State ── */
  const SPEED_PRESETS = {
    easy: 130,
    medium: 90,
    hard: 60,
  };

  function getSelectedMode() {
    return modeSelect?.value === SnakeEngine.MODES.MAZE
      ? SnakeEngine.MODES.MAZE
      : SnakeEngine.MODES.CLASSIC;
  }

  function getSelectedPlayerMode() {
    return playerModeSelect?.value === SnakeEngine.PLAYER_MODES.DUEL
      ? SnakeEngine.PLAYER_MODES.DUEL
      : SnakeEngine.PLAYER_MODES.SINGLE;
  }

  let gameState = SnakeEngine.createInitialState({
    highScore: loadHighScore(),
    mode: getSelectedMode(),
    playerMode: getSelectedPlayerMode(),
    powerUps: true,
  });

  let gameLoopId = null;
  let isRunning = false;
  let lastTickTime = 0;
  let inputQueue = [];
  let playerInputQueues = {
    player1: [],
    player2: [],
  };

  /* ── Drawing Helpers ── */
  function resolveCSSColor(variableName, fallback) {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(variableName)
      .trim();
    return value || fallback;
  }

  // Rounded rectangle path with a plain-rect fallback for browsers without ctx.roundRect
  function roundRect(x, y, w, h, r) {
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
    }
  }

  /* ── Power-Up Visuals ── */
  const POWER_UP_STYLES = {
    [SnakeEngine.POWER_UP_TYPES.BONUS]: {
      color: "#facc15",
      symbol: "★",
      label: "+50",
    },
    [SnakeEngine.POWER_UP_TYPES.SLOW]: {
      color: "#38bdf8",
      symbol: "❄",
      label: "SLOW",
    },
    [SnakeEngine.POWER_UP_TYPES.SHRINK]: {
      color: "#c084fc",
      symbol: "✂",
      label: "SHRINK",
    },
  };
  const POWER_UP_BLINK_TICKS = 15;

  /* ── Canvas Metrics ── */
  const TILE_COUNT = gameState.gridSize; // 20
  const TILE_SIZE = canvas.width / TILE_COUNT; // 400 / 20 = 20px

  /* ── Direction Input ── */
  function requestDirection(newDir, playerId = "player1") {
    // Direction input is accepted only during active gameplay.
    if (!isRunning || gameState.isPaused || gameState.isGameOver) return;

    if (gameState.playerMode === SnakeEngine.PLAYER_MODES.DUEL) {
      const player = gameState.players.find(
        candidate => candidate.id === playerId
      );
      if (!player) return;
      const queue = playerInputQueues[playerId];
      if (!player.isAlive || !queue || queue.length >= 2) return;

      const lastDir =
        queue.length > 0 ? queue[queue.length - 1] : player.nextDirection;
      if (SnakeEngine.isValidDirectionChange(lastDir, newDir)) {
        queue.push(newDir);
        playSound("turn");
      }
      return;
    }

    // Buffer up to 2 moves to avoid drop when chaining rapid turns
    const lastDir =
      inputQueue.length > 0
        ? inputQueue[inputQueue.length - 1]
        : gameState.direction;

    if (SnakeEngine.isValidDirectionChange(lastDir, newDir)) {
      if (inputQueue.length < 2) {
        inputQueue.push(newDir);
        playSound("turn");
      }
    }
  }

  /* ── Game Loop ── */
  function gameTick(currentTime) {
    if (!isRunning) return;

    // Slow power-up stretches the tick interval while it is active
    const currentSpeed =
      (SPEED_PRESETS[speedSelect.value] || SPEED_PRESETS.medium) *
      SnakeEngine.getSpeedMultiplier(gameState);

    if (currentTime - lastTickTime >= currentSpeed) {
      lastTickTime = currentTime;

      if (gameState.playerMode === SnakeEngine.PLAYER_MODES.DUEL) {
        gameState.players.forEach(player => {
          const queue = playerInputQueues[player.id];
          if (queue.length > 0) player.nextDirection = queue.shift();
        });
      } else if (inputQueue.length > 0) {
        gameState.nextDirection = inputQueue.shift();
      }

      const prevScores = gameState.players
        ? gameState.players.map(player => player.score)
        : [gameState.score];
      const prevHighScore = gameState.highScore;
      const prevPowerUp = gameState.powerUp;
      gameState = SnakeEngine.stepGame(gameState);

      const collectedPowerUp = gameState.players
        ? false
        : prevPowerUp &&
          !gameState.isGameOver &&
          gameState.snake[0].x === prevPowerUp.x &&
          gameState.snake[0].y === prevPowerUp.y;

      if (collectedPowerUp) {
        playSound("powerup");
      }

      const scores = gameState.players
        ? gameState.players.map(player => player.score)
        : [gameState.score];
      const scoreIncreased = scores.some(
        (score, index) => score > prevScores[index]
      );
      if (scoreIncreased) {
        if (!collectedPowerUp) playSound("eat");
        const bestScore = Math.max(...scores);
        if (bestScore > prevHighScore) {
          saveHighScore(bestScore);
        }
      }

      // Check for Game Over (Self-Collision or Wall Collision)
      if (gameState.isGameOver) {
        handleGameOver();
        render();
        return;
      }

      updateHUD();
    }

    render();
    gameLoopId = requestAnimationFrame(gameTick);
  }

  function startGame() {
    if (isRunning) return;

    getAudioContext();
    if (gameState.isGameOver) {
      resetGame();
    }

    isRunning = true;
    gameState.isPaused = false;
    startBtn.hidden = true;
    startBtn.disabled = true;
    pauseBtn.hidden = false;
    gameOverModal.hidden = true;
    lastTickTime = performance.now();
    cancelAnimationFrame(gameLoopId);
    gameLoopId = requestAnimationFrame(gameTick);
  }

  function pauseGame() {
    isRunning = false;
    gameState.isPaused = true;
    inputQueue = [];
    playerInputQueues = { player1: [], player2: [] };
    startBtn.hidden = false;
    startBtn.disabled = false;
    startBtn.textContent = "▶ Resume";
    pauseBtn.hidden = true;
    cancelAnimationFrame(gameLoopId);
    render();
  }

  function resetGame() {
    isRunning = false;
    cancelAnimationFrame(gameLoopId);
    inputQueue = [];
    playerInputQueues = { player1: [], player2: [] };

    const currentHigh = Math.max(gameState.highScore, loadHighScore());
    gameState = SnakeEngine.createInitialState({
      highScore: currentHigh,
      mode: getSelectedMode(),
      playerMode: getSelectedPlayerMode(),
      powerUps: true,
    });

    startBtn.hidden = false;
    startBtn.disabled = false;
    startBtn.textContent = "▶ Start";
    pauseBtn.hidden = true;
    gameOverModal.hidden = true;

    updatePlayerModeUI();
    updateHUD();
    render();
  }

  function handleGameOver() {
    isRunning = false;
    cancelAnimationFrame(gameLoopId);
    playSound("gameover");

    const bestScore = gameState.players
      ? Math.max(...gameState.players.map(player => player.score))
      : gameState.score;
    if (bestScore >= gameState.highScore) {
      saveHighScore(bestScore);
    }

    startBtn.hidden = false;
    startBtn.disabled = false;
    startBtn.textContent = "↻ Play Again";
    pauseBtn.hidden = true;

    if (gameState.playerMode === SnakeEngine.PLAYER_MODES.DUEL) {
      const winner = gameState.players.find(
        player => player.id === gameState.winner
      );
      deathReasonEl.textContent = winner
        ? `${winner.name} wins!`
        : gameState.deathReason === "win"
          ? "Draw! The board is full."
          : "Draw! Both snakes were eliminated.";
      finalScoreLabel.textContent = "Player 1";
      finalHighScoreLabel.textContent = "Player 2";
      finalScoreEl.textContent = gameState.players[0].score;
      finalHighScoreEl.textContent = gameState.players[1].score;
    } else if (gameState.deathReason === "self") {
      deathReasonEl.textContent = "💀 You collided with your own body!";
    } else if (gameState.deathReason === "wall") {
      deathReasonEl.textContent = "💥 You crashed into the wall!";
    } else if (gameState.deathReason === "obstacle") {
      deathReasonEl.textContent = "🧱 You crashed into an obstacle!";
    } else if (gameState.deathReason === "win") {
      deathReasonEl.textContent =
        "🏆 Incredible! You completely filled the grid!";
    } else {
      deathReasonEl.textContent = "💀 Game Over!";
    }

    if (gameState.playerMode !== SnakeEngine.PLAYER_MODES.DUEL) {
      finalScoreLabel.textContent = "Score";
      finalHighScoreLabel.textContent = "High Score";
      finalScoreEl.textContent = gameState.score;
      finalHighScoreEl.textContent = gameState.highScore;
    }
    gameOverModal.hidden = false;
  }

  /* ── HUD Update ── */
  function updateHUD() {
    if (gameState.players) {
      scoreLabel.textContent = "Player 1";
      highScoreLabel.textContent = "Player 2";
      lengthLabel.textContent = "Lengths P1 / P2";
      scoreEl.textContent = gameState.players[0].score;
      highScoreEl.textContent = gameState.players[1].score;
      lengthEl.textContent = `${gameState.players[0].snake.length} / ${gameState.players[1].snake.length}`;
      return;
    }

    scoreLabel.textContent = "Score";
    highScoreLabel.textContent = "High Score";
    lengthLabel.textContent = "Length";
    scoreEl.textContent = gameState.score;
    highScoreEl.textContent = gameState.highScore;
    lengthEl.textContent = gameState.snake.length;
  }

  function updatePlayerModeUI() {
    const isDuel = getSelectedPlayerMode() === SnakeEngine.PLAYER_MODES.DUEL;
    document.getElementById("singlePlayerControls").hidden = isDuel;
    document.getElementById("duelPlayerControls").hidden = !isDuel;
    powerupLegend.hidden = isDuel;
    scoresContainer.classList.toggle("scores-container--duel", isDuel);
  }

  /* ── Canvas Rendering ── */
  function render() {
    // Clear background
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += TILE_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += TILE_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw Obstacles (Maze mode)
    if (gameState.obstacles && gameState.obstacles.length > 0) {
      ctx.save();
      gameState.obstacles.forEach(o => {
        const ox = o.x * TILE_SIZE;
        const oy = o.y * TILE_SIZE;
        ctx.fillStyle = "#475569";
        ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = "#64748b";
        ctx.fillRect(ox + 2, oy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + 0.5, oy + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      });
      ctx.restore();
    }

    // Draw Food (Glowing Orb / Apple)
    if (gameState.food) {
      const fx = gameState.food.x * TILE_SIZE;
      const fy = gameState.food.y * TILE_SIZE;
      const radius = TILE_SIZE / 2 - 2;

      ctx.save();
      ctx.shadowColor = "#f43f5e";
      ctx.shadowBlur = 12;

      // Radial food gradient
      const foodGrad = ctx.createRadialGradient(
        fx + TILE_SIZE / 2 - 2,
        fy + TILE_SIZE / 2 - 2,
        2,
        fx + TILE_SIZE / 2,
        fy + TILE_SIZE / 2,
        radius
      );
      foodGrad.addColorStop(0, "#fda4af");
      foodGrad.addColorStop(0.7, "#f43f5e");
      foodGrad.addColorStop(1, "#be123c");

      ctx.fillStyle = foodGrad;
      ctx.beginPath();
      ctx.arc(fx + TILE_SIZE / 2, fy + TILE_SIZE / 2, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Power-Up (diamond with a symbol; blinks shortly before it vanishes)
    const powerUp = gameState.powerUp;
    const blinkHidden =
      powerUp &&
      powerUp.ticksLeft <= POWER_UP_BLINK_TICKS &&
      Math.floor(performance.now() / 150) % 2 === 0;
    if (powerUp && !blinkHidden) {
      const style = POWER_UP_STYLES[powerUp.type];
      if (style) {
        const cx = powerUp.x * TILE_SIZE + TILE_SIZE / 2;
        const cy = powerUp.y * TILE_SIZE + TILE_SIZE / 2;
        const half = TILE_SIZE / 2 - 1;

        ctx.save();
        ctx.shadowColor = style.color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = style.color;
        ctx.beginPath();
        ctx.moveTo(cx, cy - half);
        ctx.lineTo(cx + half, cy);
        ctx.lineTo(cx, cy + half);
        ctx.lineTo(cx - half, cy);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#0f172a";
        ctx.font = `bold ${Math.round(TILE_SIZE * 0.55)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(style.symbol, cx, cy + 1);
        ctx.restore();
      }
    }

    // Draw each snake independently; the single-player palette is unchanged.
    const snakesToRender = gameState.players
      ? gameState.players.map(player => ({
          snake: player.snake,
          direction: player.direction,
          headColor: player.color,
          glowColor: player.color,
          bodyHue: player.id === "player1" ? 155 : 198,
        }))
      : [
          {
            snake: gameState.snake,
            direction: gameState.direction,
            headColor: "#34d399",
            glowColor: "#10b981",
            bodyHue: 155,
          },
        ];

    snakesToRender.forEach(
      ({ snake, direction, headColor, glowColor, bodyHue }) => {
        for (let i = snake.length - 1; i >= 0; i--) {
          const segment = snake[i];
          const sx = segment.x * TILE_SIZE;
          const sy = segment.y * TILE_SIZE;
          const isHead = i === 0;

          ctx.save();
          if (isHead) {
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 10;
            ctx.fillStyle = headColor;
            ctx.beginPath();
            roundRect(sx + 1, sy + 1, TILE_SIZE - 2, TILE_SIZE - 2, 6);
            ctx.fill();

            ctx.fillStyle = "#0f172a";
            const eyeOffset = 5;
            const eyeSize = 3;

            let eye1X, eye1Y, eye2X, eye2Y;
            if (direction.x === 1) {
              eye1X = eye2X = sx + TILE_SIZE - 6;
              eye1Y = sy + eyeOffset;
              eye2Y = sy + TILE_SIZE - eyeOffset - eyeSize;
            } else if (direction.x === -1) {
              eye1X = eye2X = sx + 3;
              eye1Y = sy + eyeOffset;
              eye2Y = sy + TILE_SIZE - eyeOffset - eyeSize;
            } else if (direction.y === -1) {
              eye1Y = eye2Y = sy + 3;
              eye1X = sx + eyeOffset;
              eye2X = sx + TILE_SIZE - eyeOffset - eyeSize;
            } else {
              eye1Y = eye2Y = sy + TILE_SIZE - 6;
              eye1X = sx + eyeOffset;
              eye2X = sx + TILE_SIZE - eyeOffset - eyeSize;
            }

            ctx.fillRect(eye1X, eye1Y, eyeSize, eyeSize);
            ctx.fillRect(eye2X, eye2Y, eyeSize, eyeSize);
          } else {
            const t = i / snake.length;
            ctx.fillStyle = `hsl(${bodyHue - t * 25}, ${80 - t * 20}%, ${45 - t * 10}%)`;
            ctx.beginPath();
            roundRect(sx + 1.5, sy + 1.5, TILE_SIZE - 3, TILE_SIZE - 3, 4);
            ctx.fill();
          }
          ctx.restore();
        }
      }
    );

    // Active timed effect indicator (top bar that shrinks as the effect runs out)
    const effect = gameState.activeEffect;
    if (effect && POWER_UP_STYLES[effect.type]) {
      const style = POWER_UP_STYLES[effect.type];
      const total = SnakeEngine.POWER_UP_CONFIG.slowTicks;
      const fraction = Math.max(0, Math.min(1, effect.ticksLeft / total));

      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
      ctx.fillRect(0, 0, canvas.width, 6);
      ctx.fillStyle = style.color;
      ctx.fillRect(0, 0, canvas.width * fraction, 6);
      ctx.font = "bold 12px 'Outfit', sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillStyle = resolveCSSColor("--text-main", "#f8fafc");
      ctx.fillText(`${style.symbol} ${style.label}`, canvas.width - 6, 10);
      ctx.restore();
    }

    // Pause overlay
    if (gameState.isPaused && !gameState.isGameOver) {
      ctx.fillStyle = "rgba(9, 13, 22, 0.75)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = resolveCSSColor("--text-main", "#f8fafc");
      ctx.font = "bold 24px 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
      ctx.font = "14px 'Outfit', sans-serif";
      ctx.fillStyle = resolveCSSColor("--text-muted", "#94a3b8");
      ctx.fillText(
        "Press Space or click Resume to continue",
        canvas.width / 2,
        canvas.height / 2 + 30
      );
    }
  }

  /* ── Event Listeners ── */
  startBtn.addEventListener("click", startGame);
  pauseBtn.addEventListener("click", pauseGame);
  resetBtn.addEventListener("click", resetGame);
  // Switching mode starts a fresh board in the chosen layout
  modeSelect?.addEventListener("change", () => {
    resetGame();
    modeSelect.blur();
  });
  playerModeSelect?.addEventListener("change", () => {
    resetGame();
    playerModeSelect.blur();
  });
  restartBtn.addEventListener("click", () => {
    resetGame();
    startGame();
  });

  // Keyboard navigation
  window.addEventListener("keydown", e => {
    // Avoid interfering when user is on a select or input
    if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;

    const singlePlayerDirections = {
      ArrowUp: SnakeEngine.DIRECTIONS.UP,
      KeyW: SnakeEngine.DIRECTIONS.UP,
      ArrowDown: SnakeEngine.DIRECTIONS.DOWN,
      KeyS: SnakeEngine.DIRECTIONS.DOWN,
      ArrowLeft: SnakeEngine.DIRECTIONS.LEFT,
      KeyA: SnakeEngine.DIRECTIONS.LEFT,
      ArrowRight: SnakeEngine.DIRECTIONS.RIGHT,
      KeyD: SnakeEngine.DIRECTIONS.RIGHT,
    };
    const duelPlayerDirections = {
      KeyW: ["player1", SnakeEngine.DIRECTIONS.UP],
      KeyS: ["player1", SnakeEngine.DIRECTIONS.DOWN],
      KeyA: ["player1", SnakeEngine.DIRECTIONS.LEFT],
      KeyD: ["player1", SnakeEngine.DIRECTIONS.RIGHT],
      ArrowUp: ["player2", SnakeEngine.DIRECTIONS.UP],
      ArrowDown: ["player2", SnakeEngine.DIRECTIONS.DOWN],
      ArrowLeft: ["player2", SnakeEngine.DIRECTIONS.LEFT],
      ArrowRight: ["player2", SnakeEngine.DIRECTIONS.RIGHT],
    };

    if (gameState.playerMode === SnakeEngine.PLAYER_MODES.DUEL) {
      const control = duelPlayerDirections[e.code];
      if (control) {
        e.preventDefault();
        requestDirection(control[1], control[0]);
        return;
      }
    } else if (singlePlayerDirections[e.code]) {
      e.preventDefault();
      requestDirection(singlePlayerDirections[e.code]);
      return;
    }

    switch (e.code) {
      case "Space":
        e.preventDefault();
        if (gameState.isGameOver) {
          resetGame();
          startGame();
        } else if (isRunning) {
          pauseGame();
        } else {
          startGame();
        }
        break;
      case "KeyR":
        e.preventDefault();
        resetGame();
        break;
    }
  });

  // D-Pad touch buttons
  btnUp?.addEventListener("click", () =>
    requestDirection(SnakeEngine.DIRECTIONS.UP)
  );
  btnDown?.addEventListener("click", () =>
    requestDirection(SnakeEngine.DIRECTIONS.DOWN)
  );
  btnLeft?.addEventListener("click", () =>
    requestDirection(SnakeEngine.DIRECTIONS.LEFT)
  );
  btnRight?.addEventListener("click", () =>
    requestDirection(SnakeEngine.DIRECTIONS.RIGHT)
  );

  // Touch Swipe on Canvas
  let touchStartX = 0;
  let touchStartY = 0;

  canvas.addEventListener(
    "touchstart",
    e => {
      // Prevent page scroll / browser gestures while swiping on the canvas
      if (e.cancelable) e.preventDefault();
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchmove",
    e => {
      if (e.cancelable) e.preventDefault();
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchend",
    e => {
      if (e.cancelable) e.preventDefault();
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const minSwipeDistance = 25;

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (Math.abs(deltaX) > minSwipeDistance) {
          if (deltaX > 0) requestDirection(SnakeEngine.DIRECTIONS.RIGHT);
          else requestDirection(SnakeEngine.DIRECTIONS.LEFT);
        }
      } else {
        if (Math.abs(deltaY) > minSwipeDistance) {
          if (deltaY > 0) requestDirection(SnakeEngine.DIRECTIONS.DOWN);
          else requestDirection(SnakeEngine.DIRECTIONS.UP);
        }
      }
    },
    { passive: false }
  );

  document.documentElement.addEventListener("cradle:themechange", render);
  document.documentElement.addEventListener("cradle:contrastchange", render);

  /* ── Initial Render ── */
  gameOverModal.hidden = true;
  updatePlayerModeUI();
  updateHUD();
  render();
});
