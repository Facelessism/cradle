// --- LOCAL STORAGE & PRESETS ENGINE ---
const storage =
  typeof window !== "undefined" && window.CradleStorage
    ? window.CradleStorage
    : require("../../../src/components/ui/storage.js");

const STORAGE_KEY = "cradle_meme_presets_v1";

function getSavedMemes() {
  const memes = storage.get(STORAGE_KEY, []);
  return Array.isArray(memes) ? memes : [];
}

function saveMemePreset(preset) {
  if (!preset || !preset.topText) return getSavedMemes();
  const memes = getSavedMemes();
  const newEntry = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    ...preset,
  };
  memes.unshift(newEntry);
  const trimmed = memes.slice(0, 10); // Keep max 10 presets
  storage.set(STORAGE_KEY, trimmed);
  return trimmed;
}

function deleteMemePreset(id) {
  const memes = getSavedMemes().filter(m => m.id !== id);
  storage.set(STORAGE_KEY, memes);
  return memes;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getSavedMemes,
    saveMemePreset,
    deleteMemePreset,
  };
}
