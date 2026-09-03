/**
 * Audio Presets Engine - Tone generator parameters & synth configuration
 */
(function (exports) {
  const PRESET_TONES = {
    sine440: { name: "A4 Sine Wave (440Hz)", type: "sine", frequency: 440 },
    square220: { name: "A3 Square Wave (220Hz)", type: "square", frequency: 220 },
    sawtooth880: { name: "A5 Sawtooth Wave (880Hz)", type: "sawtooth", frequency: 880 },
    triangle330: { name: "E4 Triangle Wave (330Hz)", type: "triangle", frequency: 330 }
  };

  function getPresets() {
    return Object.entries(PRESET_TONES).map(([key, data]) => ({
      key,
      name: data.name,
      type: data.type,
      frequency: data.frequency
    }));
  }

  function calculateFrequencyFromNote(noteNumber) {
    // A4 = 440 Hz at note number 69
    return 440 * Math.pow(2, (noteNumber - 69) / 12);
  }

  exports.PRESET_TONES = PRESET_TONES;
  exports.getPresets = getPresets;
  exports.calculateFrequencyFromNote = calculateFrequencyFromNote;
})(typeof exports === "undefined" ? (window.AudioPresetsEngine = {}) : exports);
