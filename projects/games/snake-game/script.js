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
  const speedSelect = document.getElementById("speedSelect");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const gameOverModal = document.getElementById("gameOverModal");
  const deathReasonEl = document.getElementById("deathReason");
  const finalScoreEl = document.getElementById("finalScore");
  const finalHighScoreEl = document.getElementById("finalHighScore");
  const restartBtn = document.getElementById("restartBtn");

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

  let gameState = SnakeEngine.createInitialState({
    highScore: loadHighScore(),
  });

  let gameLoopId = null;
  let isRunning = false;
  let lastTickTime = 0;
  let inputQueue = [];

  /* ── Canvas Metrics ── */
  const TILE_COUNT = gameState.gridSize; // 20
  const TILE_SIZE = canvas.width / TILE_COUNT; // 400 / 20 = 20px

  /* ── Direction Input ── */
  function requestDirection(newDir) {
    if (gameState.isGameOver) return;

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

    const currentSpeed =
      SPEED_PRESETS[speedSelect.value] || SPEED_PRESETS.medium;

    if (currentTime - lastTickTime >= currentSpeed) {
      lastTickTime = currentTime;

      // Apply buffered input if any
      if (inputQueue.length > 0) {
        gameState.nextDirection = inputQueue.shift();
      }

      const prevScore = gameState.score;
      gameState = SnakeEngine.stepGame(gameState);

      // Check for score increase (food eaten)
      if (gameState.score > prevScore) {
        playSound("eat");
        if (gameState.score > gameState.highScore) {
          saveHighScore(gameState.score);
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
    getAudioContext();
    if (gameState.isGameOver) {
      resetGame();
    }

    isRunning = true;
    gameState.isPaused = false;
    startBtn.hidden = true;
    pauseBtn.hidden = false;
    gameOverModal.hidden = true;
    lastTickTime = performance.now();
    cancelAnimationFrame(gameLoopId);
    gameLoopId = requestAnimationFrame(gameTick);
  }

  function pauseGame() {
    isRunning = false;
    gameState.isPaused = true;
    startBtn.hidden = false;
    startBtn.textContent = "▶ Resume";
    pauseBtn.hidden = true;
    cancelAnimationFrame(gameLoopId);
    render();
  }

  function resetGame() {
    isRunning = false;
    cancelAnimationFrame(gameLoopId);
    inputQueue = [];

    const currentHigh = Math.max(gameState.highScore, loadHighScore());
    gameState = SnakeEngine.createInitialState({ highScore: currentHigh });

    startBtn.hidden = false;
    startBtn.textContent = "▶ Start";
    pauseBtn.hidden = true;
    gameOverModal.hidden = true;

    updateHUD();
    render();
  }

  function handleGameOver() {
    isRunning = false;
    cancelAnimationFrame(gameLoopId);
    playSound("gameover");

    if (gameState.score >= gameState.highScore) {
      saveHighScore(gameState.score);
    }

    startBtn.hidden = false;
    startBtn.textContent = "↻ Play Again";
    pauseBtn.hidden = true;

    // Show Game Over modal with specific death reason
    if (gameState.deathReason === "self") {
      deathReasonEl.textContent = "💀 You collided with your own body!";
    } else if (gameState.deathReason === "wall") {
      deathReasonEl.textContent = "💥 You crashed into the wall!";
    } else if (gameState.deathReason === "win") {
      deathReasonEl.textContent =
        "🏆 Incredible! You completely filled the grid!";
    } else {
      deathReasonEl.textContent = "💀 Game Over!";
    }

    finalScoreEl.textContent = gameState.score;
    finalHighScoreEl.textContent = gameState.highScore;
    gameOverModal.hidden = false;
  }

  /* ── HUD Update ── */
  function updateHUD() {
    scoreEl.textContent = gameState.score;
    highScoreEl.textContent = gameState.highScore;
    lengthEl.textContent = gameState.snake.length;
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

    // Draw Snake
    const snake = gameState.snake;
    for (let i = snake.length - 1; i >= 0; i--) {
      const segment = snake[i];
      const sx = segment.x * TILE_SIZE;
      const sy = segment.y * TILE_SIZE;
      const isHead = i === 0;

      ctx.save();
      if (isHead) {
        // Glowing Head
        ctx.shadowColor = "#10b981";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#34d399";
        ctx.beginPath();
        ctx.roundRect(sx + 1, sy + 1, TILE_SIZE - 2, TILE_SIZE - 2, 6);
        ctx.fill();

        // Eyes on the head
        ctx.fillStyle = "#0f172a";
        const eyeOffset = 5;
        const eyeSize = 3;
        const dir = gameState.direction;

        let eye1X, eye1Y, eye2X, eye2Y;
        if (dir.x === 1) {
          // RIGHT
          eye1X = eye2X = sx + TILE_SIZE - 6;
          eye1Y = sy + eyeOffset;
          eye2Y = sy + TILE_SIZE - eyeOffset - eyeSize;
        } else if (dir.x === -1) {
          // LEFT
          eye1X = eye2X = sx + 3;
          eye1Y = sy + eyeOffset;
          eye2Y = sy + TILE_SIZE - eyeOffset - eyeSize;
        } else if (dir.y === -1) {
          // UP
          eye1Y = eye2Y = sy + 3;
          eye1X = sx + eyeOffset;
          eye2X = sx + TILE_SIZE - eyeOffset - eyeSize;
        } else {
          // DOWN
          eye1Y = eye2Y = sy + TILE_SIZE - 6;
          eye1X = sx + eyeOffset;
          eye2X = sx + TILE_SIZE - eyeOffset - eyeSize;
        }

        ctx.fillRect(eye1X, eye1Y, eyeSize, eyeSize);
        ctx.fillRect(eye2X, eye2Y, eyeSize, eyeSize);
      } else {
        // Body segment
        const t = i / snake.length; // 0 (near head) to 1 (tail)
        ctx.fillStyle = `hsl(${155 - t * 25}, ${80 - t * 20}%, ${45 - t * 10}%)`;
        ctx.beginPath();
        ctx.roundRect(sx + 1.5, sy + 1.5, TILE_SIZE - 3, TILE_SIZE - 3, 4);
        ctx.fill();
      }
      ctx.restore();
    }

    // Pause overlay
    if (gameState.isPaused && !gameState.isGameOver) {
      ctx.fillStyle = "rgba(9, 13, 22, 0.75)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
      ctx.font = "14px 'Outfit', sans-serif";
      ctx.fillStyle = "var(--text-muted, #94a3b8)";
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
  restartBtn.addEventListener("click", () => {
    resetGame();
    startGame();
  });

  // Keyboard navigation
  window.addEventListener("keydown", e => {
    // Avoid interfering when user is on a select or input
    if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;

    switch (e.code) {
      case "ArrowUp":
      case "KeyW":
        e.preventDefault();
        requestDirection(SnakeEngine.DIRECTIONS.UP);
        break;
      case "ArrowDown":
      case "KeyS":
        e.preventDefault();
        requestDirection(SnakeEngine.DIRECTIONS.DOWN);
        break;
      case "ArrowLeft":
      case "KeyA":
        e.preventDefault();
        requestDirection(SnakeEngine.DIRECTIONS.LEFT);
        break;
      case "ArrowRight":
      case "KeyD":
        e.preventDefault();
        requestDirection(SnakeEngine.DIRECTIONS.RIGHT);
        break;
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
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    },
    { passive: true }
  );

  canvas.addEventListener(
    "touchend",
    e => {
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
    { passive: true }
  );

  /* ── Initial Render ── */
  gameOverModal.hidden = true;
  updateHUD();
  render();
});
