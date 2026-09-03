const storage =
  typeof window !== "undefined" && window.CradleStorage
    ? window.CradleStorage
    : require("../../../src/components/ui/storage.js");

const STATE_KEY_PREFIX = "cradle_2048_game_state_";
const BEST_KEY_PREFIX = "cradle_2048_best_score_";
const LEGACY_STATE_KEY_PREFIX = "2048_game_state_";
const LEGACY_BEST_KEY_PREFIX = "2048_best_score_";

function saveGameState(size, state) {
  if (!size) return;
  storage.set(STATE_KEY_PREFIX + size, state);
}

function loadGameState(size) {
  if (!size) return null;
  return (
    storage.get(STATE_KEY_PREFIX + size, null) ??
    storage.get(LEGACY_STATE_KEY_PREFIX + size, null)
  );
}

function clearGameState(size) {
  if (!size) return;
  storage.remove(STATE_KEY_PREFIX + size);
  storage.remove(LEGACY_STATE_KEY_PREFIX + size);
}

function saveBestScore(size, score) {
  if (!size) return;
  const currentBest = getBestScore(size);
  if (score > currentBest) {
    storage.setRaw(BEST_KEY_PREFIX + size, score);
    return true;
  }
  return false;
}

function getBestScore(size) {
  if (!size) return 0;
  const val =
    storage.getRaw(BEST_KEY_PREFIX + size, "") ||
    storage.getRaw(LEGACY_BEST_KEY_PREFIX + size, "");
  return val ? parseInt(val, 10) : 0;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    saveGameState,
    loadGameState,
    clearGameState,
    saveBestScore,
    getBestScore,
  };
}
