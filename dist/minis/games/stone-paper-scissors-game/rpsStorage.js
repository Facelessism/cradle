/**
 * RPS Storage Handler - Manages score history, win streaks, and match statistics
 */
(function (exports) {
  const storage =
    typeof window !== "undefined" && window.CradleStorage
      ? window.CradleStorage
      : require("../../../src/components/ui/storage.js");
  const store = storage.namespace("cradle_rps_");

  const memoryStats = {
    wins: 0,
    losses: 0,
    ties: 0,
    currentStreak: 0,
    bestStreak: 0,
    moveCounts: { rock: 0, paper: 0, scissors: 0, lizard: 0, spock: 0 },
  };

  function getStats() {
    const saved = store.get("stats", {});
    return { ...memoryStats, ...saved };
  }

  function recordOutcome(outcome, playerChoice) {
    const stats = getStats();
    if (outcome === "player") {
      stats.wins += 1;
      stats.currentStreak += 1;
      if (stats.currentStreak > stats.bestStreak) {
        stats.bestStreak = stats.currentStreak;
      }
    } else if (outcome === "computer") {
      stats.losses += 1;
      stats.currentStreak = 0;
    } else {
      stats.ties += 1;
    }

    if (playerChoice && stats.moveCounts[playerChoice] !== undefined) {
      stats.moveCounts[playerChoice] += 1;
    }

    store.set("stats", stats);

    return stats;
  }

  function resetStats() {
    const fresh = { ...memoryStats };
    store.set("stats", fresh);
    return fresh;
  }

  exports.getStats = getStats;
  exports.recordOutcome = recordOutcome;
  exports.resetStats = resetStats;
})(typeof exports === "undefined" ? (window.RpsStorage = {}) : exports);
