// Heuristic Bot AI for Ludo Game

const LudoEngineRef =
  typeof require !== "undefined"
    ? require("./ludoEngine")
    : typeof window !== "undefined"
      ? window.LudoEngine
      : null;

function evaluateMove(token, diceValue, gameState) {
  if (!LudoEngineRef) return 0;

  let score = 10; // Base score for any valid move

  const nextState = LudoEngineRef.getNextPositionState(token, diceValue);

  // 1. Entering token out of home base
  if (token.position === -1) {
    score += 50;
  }
  // 2. Finishing token into center goal
  else if (nextState.finished) {
    score += 150;
  }
  // 3. Entering victory path
  else if (!token.isVictoryPath && nextState.isVictoryPath) {
    score += 60;
  }

  // 4. Capturing opponent tokens or reaching safe zone
  if (
    !nextState.isVictoryPath &&
    nextState.position !== -1 &&
    !nextState.finished
  ) {
    const [r, c] = LudoEngineRef.GLOBAL_TRACK[nextState.position];
    const isSafe = LudoEngineRef.SAFE_ZONES.some(z => z[0] === r && z[1] === c);

    if (isSafe) {
      score += 40; // Landing on safe star
    } else {
      LudoEngineRef.COLORS.forEach(color => {
        if (color !== token.color && gameState[color]) {
          gameState[color].forEach(targetToken => {
            if (
              !targetToken.isVictoryPath &&
              targetToken.position === nextState.position &&
              !targetToken.finished
            ) {
              score += 120; // High priority capture
            }
          });
        }
      });
    }
  }

  // 5. Prefer advancing tokens that are closer to home / victory path
  if (token.position !== -1 && !token.isVictoryPath) {
    const dist = LudoEngineRef.calculateDistanceToHome(token);
    score += Math.max(0, 50 - dist);
  }

  return score;
}

function selectBestMove(validTokens, diceValue, gameState, rng = Math.random) {
  if (!validTokens || validTokens.length === 0) return null;

  let bestScore = -Infinity;
  let bestTokens = [];

  validTokens.forEach(token => {
    const score = evaluateMove(token, diceValue, gameState);
    if (score > bestScore) {
      bestScore = score;
      bestTokens = [token];
    } else if (score === bestScore) {
      bestTokens.push(token);
    }
  });

  const chosenIndex = Math.floor(rng() * bestTokens.length);
  return bestTokens[chosenIndex];
}

const LudoBot = {
  evaluateMove,
  selectBestMove,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = LudoBot;
} else if (typeof window !== "undefined") {
  window.LudoBot = LudoBot;
}
