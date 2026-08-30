/* =========================================================
   MORSE CODE STUDIO — ENGINE MODULE
   Modular Morse code translation dictionary, signal generator,
   Web Audio synth tone timing, and WPM velocity calculator.
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
    "_": "..--.-",
    '"': ".-..-.",
    "$": "...-..-",
    "@": ".--.-.",
    " ": "/"
  });

  const REVERSE_MORSE_MAP = Object.freeze(
    Object.fromEntries(
      Object.entries(MORSE_MAP).map(([character, code]) => [
        code,
        character
      ])
    )
  );

  function getDitDurationMs(wpm = 20) {
    const safeWpm = Math.max(5, Math.min(60, Number(wpm) || 20));
    return Math.round(1200 / safeWpm);
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

  function generateAudioSequence(
    morseString = "",
    wpm = 20,
    frequency = 650
  ) {
    if (typeof morseString !== "string" || !morseString.trim()) {
      return [];
    }

    const ditMs = getDitDurationMs(wpm);
    const dahMs = ditMs * 3;
    const symbolPauseMs = ditMs;
    const letterPauseMs = ditMs * 3;
    const wordPauseMs = ditMs * 7;

    const sequence = [];
    const tokens = morseString.trim().split(/\s+/);

    tokens.forEach((token, tokenIndex) => {
      if (token === "/") {
        sequence.push({
          type: "pause",
          durationMs: wordPauseMs
        });
        return;
      }

      for (let index = 0; index < token.length; index += 1) {
        const symbol = token[index];

        if (symbol !== "." && symbol !== "-") continue;

        sequence.push({
          type: "tone",
          durationMs: symbol === "." ? ditMs : dahMs,
          frequency
        });

        if (index < token.length - 1) {
          sequence.push({
            type: "pause",
            durationMs: symbolPauseMs
          });
        }
      }

      const nextToken = tokens[tokenIndex + 1];

      if (nextToken && nextToken !== "/") {
        sequence.push({
          type: "pause",
          durationMs: letterPauseMs
        });
      }
    });

    return sequence;
  }

  return Object.freeze({
    MORSE_MAP,
    REVERSE_MORSE_MAP,
    getDitDurationMs,
    textToMorse,
    morseToText,
    generateAudioSequence
  });
});