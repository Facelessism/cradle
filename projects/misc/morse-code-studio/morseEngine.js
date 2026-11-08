/* =========================================================
   MORSE CODE STUDIO — ENGINE MODULE
   Modular Morse code translation dictionary, signal generator,
   Web Audio synth tone timing, Paris/Farnsworth velocity calculator,
   and real-time CW pulse & audio spectrum decoder.
   ========================================================= */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MorseEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MORSE_MAP = Object.freeze({
    A: ".-",
    B: "-...",
    C: "-.-.",
    D: "-..",
    E: ".",
    F: "..-.",
    G: "--.",
    H: "....",
    I: "..",
    J: ".---",
    K: "-.-",
    L: ".-..",
    M: "--",
    N: "-.",
    O: "---",
    P: ".--.",
    Q: "--.-",
    R: ".-.",
    S: "...",
    T: "-",
    U: "..-",
    V: "...-",
    W: ".--",
    X: "-..-",
    Y: "-.--",
    Z: "--..",
    0: "-----",
    1: ".----",
    2: "..---",
    3: "...--",
    4: "....-",
    5: ".....",
    6: "-....",
    7: "--...",
    8: "---..",
    9: "----.",
    ".": ".-.-.-",
    ",": "--..--",
    "?": "..--..",
    "'": ".----.",
    "!": "-.-.--",
    "/": "-..-.",
    "(": "-.--.",
    ")": "-.--.-",
    "&": ".-...",
    ":": "---...",
    ";": "-.-.-.",
    "=": "-...-",
    "+": ".-.-.",
    "-": "-....-",
    _: "..--.-",
    '"': ".-..-.",
    $: "...-..-",
    "@": ".--.-.",
    " ": "/",
  });

  const REVERSE_MORSE_MAP = Object.freeze(
    Object.fromEntries(
      Object.entries(MORSE_MAP).map(([character, code]) => [code, character])
    )
  );

  /**
   * Standard Paris timing: dit duration = 1200 / WPM ms.
   * WPM is clamped between 5 and 60.
   */
  function getDitDurationMs(wpm = 20) {
    const safeWpm = Math.max(5, Math.min(60, Number(wpm) || 20));
    return Math.round(1200 / safeWpm);
  }

  /**
   * Calculates comprehensive Paris and ARRL Farnsworth timing parameters.
   * In Farnsworth timing, dits, dahs, and intra-character gaps use charWpm,
   * while inter-character and inter-word gaps are lengthened to match overall farnsworthWpm.
   */
  function calculateTiming(charWpm = 20, farnsworthWpm = null, frequency = 650) {
    const safeCharWpm = Math.max(5, Math.min(60, Number(charWpm) || 20));
    const safeFarnsworthWpm =
      farnsworthWpm !== null && farnsworthWpm !== undefined && Number(farnsworthWpm) > 0
        ? Math.max(5, Math.min(safeCharWpm, Number(farnsworthWpm)))
        : safeCharWpm;

    const safeFrequency = Math.max(300, Math.min(1000, Number(frequency) || 650));

    const ditMs = Math.round(1200 / safeCharWpm);
    const dahMs = ditMs * 3;
    const symbolPauseMs = ditMs;

    let charPauseMs = ditMs * 3;
    let wordPauseMs = ditMs * 7;

    // ARRL Farnsworth calculation if overall WPM is slower than character WPM
    if (safeFarnsworthWpm < safeCharWpm) {
      // Delay per space unit: (60000/farnsworth - 37200/charWpm) / 19
      const unitSpaceDelayMs = (60000 / safeFarnsworthWpm - 37200 / safeCharWpm) / 19;
      charPauseMs = Math.max(charPauseMs, Math.round(3 * unitSpaceDelayMs));
      wordPauseMs = Math.max(wordPauseMs, Math.round(7 * unitSpaceDelayMs));
    }

    return {
      ditMs,
      dahMs,
      symbolPauseMs,
      charPauseMs,
      wordPauseMs,
      charWpm: safeCharWpm,
      farnsworthWpm: safeFarnsworthWpm,
      frequency: safeFrequency,
    };
  }

  function textToMorse(text = "") {
    if (typeof text !== "string") return "";

    return text
      .toUpperCase()
      .split("")
      .map(character => MORSE_MAP[character])
      .filter(Boolean)
      .join(" ");
  }

  function morseToText(morse = "") {
    if (typeof morse !== "string") return "";

    const normalized = morse.trim();

    if (!normalized) return "";

    return normalized
      .split(/\s+/)
      .map(token => {
        if (token === "/") return " ";
        return REVERSE_MORSE_MAP[token] || "";
      })
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Generates ordered audio tone and pause sequence.
   * Supports positional arguments: (morseString, wpm, frequency, farnsworthWpm)
   * or options object: (morseString, { wpm, frequency, farnsworthWpm })
   */
  function generateAudioSequence(morseString = "", wpm = 20, frequency = 650, farnsworthWpm = null) {
    if (typeof morseString !== "string" || !morseString.trim()) {
      return [];
    }

    let charWpm = wpm;
    let freq = frequency;
    let farnsworth = farnsworthWpm;

    if (typeof wpm === "object" && wpm !== null) {
      charWpm = wpm.wpm || wpm.charWpm || 20;
      freq = wpm.frequency || frequency;
      farnsworth = wpm.farnsworthWpm || null;
    }

    const timing = calculateTiming(charWpm, farnsworth, freq);
    const ditMs = timing.ditMs;
    const dahMs = timing.dahMs;
    const symbolPauseMs = timing.symbolPauseMs;
    const letterPauseMs = timing.charPauseMs;
    const wordPauseMs = timing.wordPauseMs;
    const toneFreq = timing.frequency;

    const sequence = [];
    const tokens = morseString.trim().split(/\s+/);

    tokens.forEach((token, tokenIndex) => {
      if (token === "/") {
        sequence.push({
          type: "pause",
          durationMs: wordPauseMs,
        });
        return;
      }

      for (let index = 0; index < token.length; index += 1) {
        const symbol = token[index];

        if (symbol !== "." && symbol !== "-") continue;

        sequence.push({
          type: "tone",
          durationMs: symbol === "." ? ditMs : dahMs,
          frequency: toneFreq,
        });

        if (index < token.length - 1) {
          sequence.push({
            type: "pause",
            durationMs: symbolPauseMs,
          });
        }
      }

      const nextToken = tokens[tokenIndex + 1];

      if (nextToken && nextToken !== "/") {
        sequence.push({
          type: "pause",
          durationMs: letterPauseMs,
        });
      }
    });

    return sequence;
  }

  /**
   * Classify an ON pulse duration into a dot ('.'), dash ('-'), or null (noise glitch).
   */
  function classifyPulse(durationMs, ditDurationMs = 60) {
    const dit = Math.max(10, Number(ditDurationMs) || 60);
    // Ignore pulses shorter than 30% of a dit duration as noise
    if (durationMs < dit * 0.3) {
      return null;
    }
    // Threshold between dot and dash is 2.0x dit duration
    return durationMs < dit * 2.0 ? "." : "-";
  }

  /**
   * Classify an OFF silence duration into element pause, character pause, or word space.
   */
  function classifyGap(gapMs, ditDurationMs = 60) {
    const dit = Math.max(10, Number(ditDurationMs) || 60);
    if (gapMs < dit * 0.35) {
      return null; // Transient bounce
    }
    if (gapMs < dit * 2.2) {
      return "element";
    }
    if (gapMs < dit * 5.5) {
      return "character";
    }
    return "word";
  }

  /**
   * Detects the dominant peak frequency within [minFreq, maxFreq] in FFT magnitude array.
   */
  function detectPeakFrequency(freqData, sampleRate = 48000, minFreq = 300, maxFreq = 1000) {
    if (!freqData || freqData.length === 0 || !sampleRate) {
      return { frequency: 0, magnitude: 0, bin: 0, snr: 0 };
    }

    const fftSize = freqData.length * 2;
    const binResolution = sampleRate / fftSize;

    const minBin = Math.max(0, Math.floor(minFreq / binResolution));
    const maxBin = Math.min(freqData.length - 1, Math.ceil(maxFreq / binResolution));

    let maxMag = -Infinity;
    let peakBin = minBin;
    let sumMag = 0;
    let count = 0;

    for (let i = minBin; i <= maxBin; i += 1) {
      const mag = freqData[i];
      sumMag += mag;
      count += 1;
      if (mag > maxMag) {
        maxMag = mag;
        peakBin = i;
      }
    }

    const avgNoise = count > 0 ? sumMag / count : 1;
    const snr = avgNoise > 0 ? maxMag / avgNoise : 1;

    // Parabolic interpolation for sub-bin frequency accuracy
    let fineBin = peakBin;
    if (peakBin > 0 && peakBin < freqData.length - 1) {
      const alpha = freqData[peakBin - 1];
      const beta = freqData[peakBin];
      const gamma = freqData[peakBin + 1];
      const denom = alpha - 2 * beta + gamma;
      if (denom !== 0) {
        fineBin = peakBin + 0.5 * (alpha - gamma) / denom;
      }
    }

    const estimatedFreq = Math.round(fineBin * binResolution);

    return {
      frequency: estimatedFreq,
      magnitude: maxMag,
      bin: peakBin,
      snr,
    };
  }

  /**
   * Checks whether a tone at targetFreq is active in the frequency spectrum data.
   */
  function isTonePresent(freqData, sampleRate = 48000, targetFreq = 650, bandwidth = 120, threshold = 45) {
    if (!freqData || freqData.length === 0) {
      return { active: false, level: 0, peakFreq: targetFreq };
    }

    const fftSize = freqData.length * 2;
    const binResolution = sampleRate / fftSize;

    const minBin = Math.max(0, Math.floor((targetFreq - bandwidth / 2) / binResolution));
    const maxBin = Math.min(freqData.length - 1, Math.ceil((targetFreq + bandwidth / 2) / binResolution));

    let maxMag = 0;
    let peakBin = minBin;

    for (let i = minBin; i <= maxBin; i += 1) {
      if (freqData[i] > maxMag) {
        maxMag = freqData[i];
        peakBin = i;
      }
    }

    const peakFreq = Math.round(peakBin * binResolution);
    const active = maxMag >= threshold;

    return {
      active,
      level: maxMag,
      peakFreq,
    };
  }

  /**
   * Factory for creating a stream-oriented Morse code audio decoder.
   * Processes time-series tone on/off states and translates them into characters and words.
   */
  function createMorseStreamDecoder(options = {}) {
    let wpm = Math.max(5, Math.min(60, Number(options.wpm) || 20));
    let ditMs = getDitDurationMs(wpm);

    let currentBuffer = "";
    let decodedText = "";
    let isToneActive = false;
    let toneStartTime = 0;
    let toneEndTime = 0;
    let lastCharDecodedTime = 0;
    let lastWordAppended = false;

    const onSymbol = typeof options.onSymbol === "function" ? options.onSymbol : null;
    const onCharacter = typeof options.onCharacter === "function" ? options.onCharacter : null;
    const onWordSpace = typeof options.onWordSpace === "function" ? options.onWordSpace : null;
    const onUpdate = typeof options.onUpdate === "function" ? options.onUpdate : null;

    function notifyUpdate() {
      if (onUpdate) {
        onUpdate({
          buffer: currentBuffer,
          decodedText,
          isToneActive,
          wpm,
          ditMs,
        });
      }
    }

    function flushBuffer() {
      if (!currentBuffer) return "";
      const char = REVERSE_MORSE_MAP[currentBuffer] || "?";
      decodedText += char;
      const flushedSeq = currentBuffer;
      currentBuffer = "";
      lastWordAppended = false;

      if (onCharacter) {
        onCharacter(char, flushedSeq);
      }
      notifyUpdate();
      return char;
    }

    function appendSpace() {
      if (decodedText.length === 0 || decodedText.endsWith(" ") || lastWordAppended) {
        return;
      }
      decodedText += " ";
      lastWordAppended = true;
      if (onWordSpace) {
        onWordSpace();
      }
      notifyUpdate();
    }

    function feedTone(durationMs) {
      const symbol = classifyPulse(durationMs, ditMs);
      if (symbol) {
        currentBuffer += symbol;
        if (onSymbol) {
          onSymbol(symbol, currentBuffer);
        }
        notifyUpdate();
      }
      return symbol;
    }

    function feedSilence(durationMs) {
      const gap = classifyGap(durationMs, ditMs);
      if (gap === "character") {
        flushBuffer();
      } else if (gap === "word") {
        flushBuffer();
        appendSpace();
      }
      return gap;
    }

    function processState(isToneOn, timestamp = Date.now()) {
      if (isToneOn && !isToneActive) {
        // Key down / tone started
        if (toneEndTime > 0) {
          const gapMs = timestamp - toneEndTime;
          const gap = classifyGap(gapMs, ditMs);
          if (gap === "character") {
            flushBuffer();
          } else if (gap === "word") {
            flushBuffer();
            appendSpace();
          }
        }
        isToneActive = true;
        toneStartTime = timestamp;
        notifyUpdate();
      } else if (!isToneOn && isToneActive) {
        // Key up / tone ended
        isToneActive = false;
        toneEndTime = timestamp;
        const pulseMs = timestamp - toneStartTime;
        const symbol = classifyPulse(pulseMs, ditMs);
        if (symbol) {
          currentBuffer += symbol;
          if (onSymbol) {
            onSymbol(symbol, currentBuffer);
          }
        }
        notifyUpdate();
      } else if (!isToneActive && toneEndTime > 0) {
        // Idle silence check
        const gapMs = timestamp - toneEndTime;
        if (currentBuffer.length > 0 && gapMs >= ditMs * 2.5) {
          flushBuffer();
        } else if (gapMs >= ditMs * 6.5 && !lastWordAppended && decodedText.length > 0 && !decodedText.endsWith(" ")) {
          appendSpace();
        }
      }
    }

    function setWpm(newWpm) {
      wpm = Math.max(5, Math.min(60, Number(newWpm) || 20));
      ditMs = getDitDurationMs(wpm);
      notifyUpdate();
    }

    function reset() {
      currentBuffer = "";
      decodedText = "";
      isToneActive = false;
      toneStartTime = 0;
      toneEndTime = 0;
      lastWordAppended = false;
      notifyUpdate();
    }

    return {
      feedTone,
      feedSilence,
      processState,
      flushBuffer,
      appendSpace,
      reset,
      setWpm,
      getBuffer: () => currentBuffer,
      getText: () => decodedText,
      getWpm: () => wpm,
      getDitMs: () => ditMs,
    };
  }

  return Object.freeze({
    MORSE_MAP,
    REVERSE_MORSE_MAP,
    getDitDurationMs,
    calculateTiming,
    textToMorse,
    morseToText,
    generateAudioSequence,
    classifyPulse,
    classifyGap,
    detectPeakFrequency,
    isTonePresent,
    createMorseStreamDecoder,
  });
});
