// Modular Ludo Game Engine

const COLORS = ["red", "green", "blue", "yellow"];

const THEME = {
  red: "#ff4757",
  green: "#2ed573",
  blue: "#1e90ff",
  yellow: "#ffc312",
  redDark: "#c0392b",
  greenDark: "#1e8449",
  blueDark: "#1565c0",
  yellowDark: "#d4a017",
  boardBg: "#1a1a2e",
  trackBg: "#2a2a40",
  border: "#3a3a55",
  safeZone: "#35354d",
  centerBg: "#222240",
};

const GLOBAL_TRACK = [
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],
  [0, 7],
  [0, 8],
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8],
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14],
  [7, 14],
  [8, 14],
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9],
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8],
  [14, 7],
  [14, 6],
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6],
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0],
  [7, 0],
  [6, 0],
];

const SAFE_ZONES = [
  [6, 1],
  [2, 6],
  [1, 8],
  [6, 13],
  [8, 13],
  [12, 8],
  [13, 6],
  [8, 1],
];

const VICTORY_PATHS = {
  red: [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
  ],
  green: [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
  ],
  blue: [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
  ],
  yellow: [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
  ],
};

const HOME_CENTERS = {
  red: [
    [2, 2],
    [2, 3],
    [3, 2],
    [3, 3],
  ],
  green: [
    [2, 11],
    [2, 12],
    [3, 11],
    [3, 12],
  ],
  blue: [
    [11, 11],
    [11, 12],
    [12, 11],
    [12, 12],
  ],
  yellow: [
    [11, 2],
    [11, 3],
    [12, 2],
    [12, 3],
  ],
};

const START_INDEX = { red: 0, green: 13, blue: 26, yellow: 39 };

const HOME_ENTRY_INDEX = { red: 50, green: 11, blue: 24, yellow: 37 };

function createTokens(color, cellSize = 40) {
  return Array.from({ length: 4 }, (_, id) => ({
    id,
    color,
    position: -1, // -1 means home base
    isVictoryPath: false,
    finished: false,
    currentX: HOME_CENTERS[color][id][1] * cellSize + cellSize / 2,
    currentY: HOME_CENTERS[color][id][0] * cellSize + cellSize / 2,
    targetX: null,
    targetY: null,
    animProgress: 1,
    zOffset: 0,
  }));
}

function calculateDistanceToHome(token) {
  if (token.position === -1 || token.isVictoryPath || token.finished) return 0;
  const entryIdx = HOME_ENTRY_INDEX[token.color];
  if (token.position <= entryIdx) {
    return entryIdx - token.position;
  }
  return 52 - token.position + entryIdx;
}

function isValidMove(token, currentColor, diceValue) {
  if (
    !token ||
    currentColor !== token.color ||
    diceValue === null ||
    diceValue === undefined
  ) {
    return false;
  }
  if (token.finished) return false;

  if (token.position === -1) {
    return diceValue === 6;
  }

  if (token.isVictoryPath) {
    return token.position + diceValue <= 5; // 5 means finished inside center
  }

  const distToHome = calculateDistanceToHome(token);
  if (diceValue > distToHome + 5) {
    return false; // Overshoots center
  }

  return true;
}

function getNextPositionState(token, diceValue) {
  if (token.position === -1) {
    if (diceValue === 6) {
      return {
        position: START_INDEX[token.color],
        isVictoryPath: false,
        finished: false,
      };
    }
    return { position: -1, isVictoryPath: false, finished: false };
  }

  if (token.isVictoryPath) {
    const newPos = token.position + diceValue;
    if (newPos === 5) {
      return { position: 5, isVictoryPath: true, finished: true };
    }
    return { position: newPos, isVictoryPath: true, finished: false };
  }

  const dist = calculateDistanceToHome(token);
  if (diceValue > dist) {
    const victoryIdx = diceValue - dist - 1;
    if (victoryIdx === 5) {
      return { position: 5, isVictoryPath: true, finished: true };
    }
    return { position: victoryIdx, isVictoryPath: true, finished: false };
  }

  return {
    position: (token.position + diceValue) % 52,
    isVictoryPath: false,
    finished: false,
  };
}

function checkCaptures(movedToken, state) {
  if (
    movedToken.isVictoryPath ||
    movedToken.position === -1 ||
    movedToken.finished
  ) {
    return [];
  }

  const [r, c] = GLOBAL_TRACK[movedToken.position];
  const isSafe = SAFE_ZONES.some(z => z[0] === r && z[1] === c);
  if (isSafe) return [];

  const captured = [];
  COLORS.forEach(color => {
    if (color === movedToken.color) return;
    if (!state[color]) return;
    state[color].forEach(targetToken => {
      if (
        !targetToken.isVictoryPath &&
        targetToken.position === movedToken.position &&
        !targetToken.finished
      ) {
        targetToken.position = -1;
        captured.push(targetToken);
      }
    });
  });

  return captured;
}

function checkWinner(state, color) {
  if (!state[color] || state[color].length === 0) return false;
  return state[color].every(t => t.finished);
}

function getTokenCoordinate(token, cellSize = 40) {
  if (!token || token.finished) return null;

  let r, c;
  if (token.position === -1) {
    [r, c] = HOME_CENTERS[token.color][token.id];
  } else if (token.isVictoryPath) {
    [r, c] = VICTORY_PATHS[token.color][token.position];
  } else {
    [r, c] = GLOBAL_TRACK[token.position];
  }

  return {
    x: c * cellSize + cellSize / 2,
    y: r * cellSize + cellSize / 2,
  };
}

const LudoEngine = {
  COLORS,
  THEME,
  GLOBAL_TRACK,
  SAFE_ZONES,
  VICTORY_PATHS,
  HOME_CENTERS,
  START_INDEX,
  HOME_ENTRY_INDEX,
  createTokens,
  calculateDistanceToHome,
  isValidMove,
  getNextPositionState,
  checkCaptures,
  checkWinner,
  getTokenCoordinate,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = LudoEngine;
} else if (typeof window !== "undefined") {
  window.LudoEngine = LudoEngine;
}
