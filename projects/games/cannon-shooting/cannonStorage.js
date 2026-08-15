// Cannon Storage System for persisting high scores and defense streaks

const storage =
  typeof window !== "undefined" && window.CradleStorage
    ? window.CradleStorage
    : require("../../../src/components/ui/storage.js");

const STORAGE_KEY = "cradle_cannon_stats";
const LEGACY_STORAGE_KEY = "cannonShootingStats";

function getInitialStats() {
  return {
    highScore: 0,
    score: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalHits: 0,
    totalShots: 0,
  };
}

function loadStats() {
  const saved =
    storage.get(STORAGE_KEY, null) ?? storage.get(LEGACY_STORAGE_KEY, null);
  return saved && typeof saved === "object"
    ? { ...getInitialStats(), ...saved }
    : getInitialStats();
}

function saveStats(stats) {
  storage.set(STORAGE_KEY, stats);
}

function recordShot(stats, isHit, scoreAwarded = 0, newStreak = 0) {
  const updated = { ...stats };
  updated.totalShots += 1;

  if (isHit) {
    updated.totalHits += 1;
    updated.score += scoreAwarded;
    updated.currentStreak = newStreak;
    if (updated.score > updated.highScore) {
      updated.highScore = updated.score;
    }
    if (updated.currentStreak > updated.bestStreak) {
      updated.bestStreak = updated.currentStreak;
    }
  } else {
    updated.currentStreak = 0;
  }

  saveStats(updated);
  return updated;
}

function resetStats() {
  const fresh = getInitialStats();
  saveStats(fresh);
  return fresh;
}

const CannonStorage = {
  STORAGE_KEY,
  getInitialStats,
  loadStats,
  saveStats,
  recordShot,
  resetStats,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = CannonStorage;
} else if (typeof window !== "undefined") {
  window.CannonStorage = CannonStorage;
}
