/* ============================================================
   VIRTUAL VIOLIN
   ============================================================ */

(() => {
  "use strict";


  /* ==========================================================
     VIOLIN DATA
     ========================================================== */

  const STRINGS = [
    {
      name: "G",
      openNote: "G3",
      frequency: 196.00
    },
    {
      name: "D",
      openNote: "D4",
      frequency: 293.66
    },
    {
      name: "A",
      openNote: "A4",
      frequency: 440.00
    },
    {
      name: "E",
      openNote: "E5",
      frequency: 659.25
    }
  ];


  /*
   * Open string keyboard controls.
   */

  const OPEN_KEYS = {
    a: 0,
    s: 1,
    d: 2,
    f: 3
  };


  /*
   * Finger positions.
   *
   * Four positions × four strings = 16 notes.
   */

  const POSITION_KEYS = {
    q: 0,
    w: 1,
    e: 2,
    r: 3,

    "1": 0,
    "2": 1,
    "3": 2,
    "4": 3,

    z: 0,
    x: 1,
    c: 2,
    v: 3,

    "5": 0,
    "6": 1,
    "7": 2,
    "8": 3
  };


  const POSITION_SEMITONES = [
    0,
    2,
    4,
    5
  ];


  /* ==========================================================
     DOM
     ========================================================== */

  const noteLabel =
    document.getElementById("note-label");

  const status =
    document.getElementById("status");

  const interactionLabel =
    document.getElementById("interaction-label");

  const selectedStringLabel =
    document.getElementById("selected-string-label");

  const stringLayer =
    document.getElementById("string-layer");

  const volumeSlider =
    document.getElementById("volume-slider");

  const volumeValue =
    document.getElementById("volume-value");

  const muteButton =
    document.getElementById("mute-button");

  const sustainToggle =
    document.getElementById("sustain-toggle");

  const clearButton =
    document.getElementById("clear-button");


  /* ==========================================================
     STATE
     ========================================================== */

  let selectedString = 0;

  let volume = 0.18;

  let previousVolume = 0.18;

  let muted = false;

  let sustain = false;

  let activeString = null;

  let pointerPlaying = false;

  let audioContext = null;

  const activeVoices = new Map();


  /* ==========================================================
     AUDIO
     ========================================================== */

  function getAudioContext() {

    if (!audioContext) {

      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContext) {
        return null;
      }

      audioContext = new AudioContext();
    }

    return audioContext;
  }


  async function resumeAudio() {

    const context = getAudioContext();

    if (!context) {
      return null;
    }

    if (context.state === "suspended") {
      await context.resume();
    }

    return context;
  }


  function midiToFrequency(midi) {
    return 440 * Math.pow(
      2,
      (midi - 69) / 12
    );
  }


  function frequencyToMidi(frequency) {

    return 69 +
      12 *
      Math.log2(
        frequency / 440
      );
  }


  /* ==========================================================
     STRING ELEMENTS
     ========================================================== */

  const stringIds = [
    "violin-string-g",
    "violin-string-d",
    "violin-string-a",
    "violin-string-e"
  ];


  function getVisualString(index) {

    const id = stringIds[index];

    return document.getElementById(id);
  }


  /* ==========================================================
     STRING HIGHLIGHT
     ========================================================== */

  function setPlayingString(index) {

    stringIds.forEach((id, stringIndex) => {

      const string =
        document.getElementById(id);

      if (!string) {
        return;
      }

      string.classList.toggle(
        "is-playing",
        stringIndex === index
      );

    });


    document
      .querySelectorAll(".quick-string")
      .forEach((button) => {

        const buttonIndex =
          Number(button.dataset.stringIndex);

        button.classList.toggle(
          "is-playing",
          buttonIndex === index
        );

      });


    document
      .querySelectorAll(".string-select")
      .forEach((button) => {

        const buttonIndex =
          Number(button.dataset.stringIndex);

        button.classList.toggle(
          "is-playing",
          buttonIndex === index
        );

      });


    activeString = index;
  }


  function releasePlayingStrings() {

    stringIds.forEach((id) => {

      const string =
        document.getElementById(id);

      if (string) {
        string.classList.remove(
          "is-playing"
        );
      }

    });


    document
      .querySelectorAll(".quick-string")
      .forEach((button) => {

        button.classList.remove(
          "is-playing"
        );

      });


    document
      .querySelectorAll(".string-select")
      .forEach((button) => {

        button.classList.remove(
          "is-playing"
        );

      });


    activeString = null;
  }


  /* ==========================================================
     SELECT STRING
     ========================================================== */

  function selectString(index) {

    if (
      index < 0 ||
      index >= STRINGS.length
    ) {
      return;
    }

    selectedString = index;

    const stringData =
      STRINGS[index];

    selectedStringLabel.textContent =
      stringData.name;


    document
      .querySelectorAll(".string-select")
      .forEach((button) => {

        const buttonIndex =
          Number(button.dataset.stringIndex);

        const active =
          buttonIndex === index;

        button.classList.toggle(
          "active",
          active
        );

        button.setAttribute(
          "aria-pressed",
          String(active)
        );

      });
  }


  /* ==========================================================
     CREATE AUDIO VOICE
     ========================================================== */

  async function startVoice(
    stringIndex,
    frequency
  ) {

    const context =
      await resumeAudio();

    if (!context) {
      return null;
    }


    const output =
      context.createGain();

    const oscillator =
      context.createOscillator();

    const harmonic =
      context.createOscillator();

    const harmonicGain =
      context.createGain();


    oscillator.type = "sawtooth";

    oscillator.frequency.value =
      frequency;


    harmonic.type =
      "triangle";

    harmonic.frequency.value =
      frequency * 2;


    harmonicGain.gain.value =
      0.12;


    output.gain.value =
      0.0001;


    oscillator.connect(output);

    harmonic.connect(harmonicGain);

    harmonicGain.connect(output);

    output.connect(context.destination);


    const now =
      context.currentTime;


    const effectiveVolume =
      muted ? 0 : volume;


    output.gain.cancelScheduledValues(now);

    output.gain.setValueAtTime(
      0.0001,
      now
    );

    output.gain.exponentialRampToValueAtTime(
      Math.max(
        0.0002,
        effectiveVolume * 0.22
      ),
      now + 0.025
    );


    oscillator.start(now);

    harmonic.start(now);


    const voice = {
      oscillator,
      harmonic,
      output,
      stringIndex
    };


    activeVoices.set(
      stringIndex,
      voice
    );


    return voice;
  }


  /* ==========================================================
     STOP VOICE
     ========================================================== */

  function stopVoice(
    stringIndex
  ) {

    const voice =
      activeVoices.get(
        stringIndex
      );

    if (!voice) {
      return;
    }


    const context =
      getAudioContext();

    if (!context) {
      return;
    }


    const now =
      context.currentTime;


    if (sustain) {
      return;
    }


    voice.output.gain.cancelScheduledValues(
      now
    );


    voice.output.gain.setValueAtTime(
      Math.max(
        0.0001,
        voice.output.gain.value
      ),
      now
    );


    voice.output.gain.exponentialRampToValueAtTime(
      0.0001,
      now + 0.18
    );


    window.setTimeout(() => {

      try {
        voice.oscillator.stop();
      } catch (_) {}

      try {
        voice.harmonic.stop();
      } catch (_) {}

      voice.output.disconnect();

    }, 250);


    activeVoices.delete(
      stringIndex
    );
  }


  /* ==========================================================
     RELEASE ALL
     ========================================================== */

  function releaseAll() {

    const voices =
      Array.from(
        activeVoices.keys()
      );

    voices.forEach(
      stopVoice
    );

    releasePlayingStrings();

    noteLabel.textContent =
      "Ready";

    status.textContent =
      "Choose a string to begin.";

    interactionLabel.textContent =
      "Tap a string";
  }


  /* ==========================================================
     PLAY NOTE
     ========================================================== */

  async function playNote(
    stringIndex,
    semitones = 0,
    positionLabel = "Open"
  ) {

    const stringData =
      STRINGS[stringIndex];


    const frequency =
      midiToFrequency(
        frequencyToMidi(
          stringData.frequency
        ) + semitones
      );


    setPlayingString(
      stringIndex
    );


    selectString(
      stringIndex
    );


    const noteName =
      getNoteName(
        frequency
      );


    noteLabel.textContent =
      `${stringData.name} · ${noteName}`;

    status.textContent =
      `${stringData.name} string · ${positionLabel}`;


    interactionLabel.textContent =
      `${stringData.name} string · ${positionLabel}`;


    /*
     * Stop an existing voice for this string
     * before starting a fresh one.
     */

    if (
      activeVoices.has(
        stringIndex
      )
    ) {
      stopVoice(
        stringIndex
      );
    }


    await startVoice(
      stringIndex,
      frequency
    );
  }


  /* ==========================================================
     NOTE NAME
     ========================================================== */

  function getNoteName(frequency) {

    const noteNames = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B"
    ];


    const midi =
      Math.round(
        frequencyToMidi(
          frequency
        )
      );


    const octave =
      Math.floor(
        midi / 12
      ) - 1;


    const name =
      noteNames[
        ((midi % 12) + 12) % 12
      ];


    return `${name}${octave}`;
  }


  /* ==========================================================
     QUICK PLAY
     ========================================================== */

  document
    .querySelectorAll(".quick-string")
    .forEach((button) => {

      button.addEventListener(
        "click",
        async () => {

          const index =
            Number(
              button.dataset.stringIndex
            );

          await playNote(
            index,
            0,
            "Open"
          );

        }
      );

    });


  /* ==========================================================
     STRING SELECTION
     ========================================================== */

  document
    .querySelectorAll(".string-select")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          const index =
            Number(
              button.dataset.stringIndex
            );

          selectString(
            index
          );

          status.textContent =
            `${STRINGS[index].name} string selected.`;

          interactionLabel.textContent =
            "Tap or drag the string.";

        }
      );

    });


  /* ==========================================================
     CREATE TRANSPARENT STRING HIT AREAS
     ========================================================== */

  function createStringHitAreas() {

    stringLayer.innerHTML = "";


    STRINGS.forEach(
      (_, index) => {

        const button =
          document.createElement(
            "button"
          );


        button.type =
          "button";

        button.className =
          "string-hit";

        button.dataset.stringIndex =
          String(index);

        button.setAttribute(
          "aria-label",
          `Play ${STRINGS[index].name} string`
        );


        stringLayer.appendChild(
          button
        );

      }
    );
  }


  createStringHitAreas();


  /* ==========================================================
     STRING POINTER INTERACTION
     ========================================================== */

  const stringHits =
    document.querySelectorAll(
      ".string-hit"
    );


  stringHits.forEach((hit) => {

    hit.addEventListener(
      "pointerdown",
      async (event) => {

        event.preventDefault();

        const index =
          Number(
            hit.dataset.stringIndex
          );


        pointerPlaying = true;


        try {
          hit.setPointerCapture(
            event.pointerId
          );
        } catch (_) {}


        await playNote(
          index,
          0,
          "Open"
        );

      }
    );


    hit.addEventListener(
      "pointermove",
      async (event) => {

        if (!pointerPlaying) {
          return;
        }


        const index =
          Number(
            hit.dataset.stringIndex
          );


        const rect =
          hit.getBoundingClientRect();


        const relativeY =
          Math.max(
            0,
            Math.min(
              1,
              (event.clientY - rect.top) /
              rect.height
            )
          );


        /*
         * Moving toward the bridge
         * raises pitch.
         */

        const position =
          Math.round(
            relativeY * 4
          );


        const semitones =
          POSITION_SEMITONES[
            Math.min(
              3,
              position
            )
          ];


        const labels = [
          "Open",
          "1st finger",
          "2nd finger",
          "3rd finger"
        ];


        await playNote(
          index,
          semitones,
          labels[
            Math.min(
              3,
              position
            )
          ]
        );

      }
    );


    hit.addEventListener(
      "pointerup",
      (event) => {

        pointerPlaying = false;

        try {
          hit.releasePointerCapture(
            event.pointerId
          );
        } catch (_) {}


        stopVoice(
          Number(
            hit.dataset.stringIndex
          )
        );


        if (!sustain) {
          releasePlayingStrings();
        }

      }
    );


    hit.addEventListener(
      "pointercancel",
      () => {

        pointerPlaying = false;

        stopVoice(
          Number(
            hit.dataset.stringIndex
          )
        );


        if (!sustain) {
          releasePlayingStrings();
        }

      }
    );

  });


  /* ==========================================================
     KEYBOARD
     ========================================================== */

  const pressedKeys =
    new Set();


  document.addEventListener(
    "keydown",
    async (event) => {

      if (event.repeat) {
        return;
      }


      const key =
        event.key.toLowerCase();


      if (
        OPEN_KEYS[key] !== undefined
      ) {

        event.preventDefault();

        if (
          pressedKeys.has(key)
        ) {
          return;
        }


        pressedKeys.add(key);


        const index =
          OPEN_KEYS[key];


        await playNote(
          index,
          0,
          "Open"
        );


        return;
      }


      if (
        POSITION_KEYS[key] !== undefined
      ) {

        event.preventDefault();

        if (
          pressedKeys.has(key)
        ) {
          return;
        }


        pressedKeys.add(key);


        const index =
          POSITION_KEYS[key];


        /*
         * Determine position from key.
         */

        let semitones = 0;

        let position =
          "1st finger";


        if (
          "1234".includes(key)
        ) {

          semitones =
            POSITION_SEMITONES[1];

          position =
            "2nd finger";

        } else if (
          "zxcv".includes(key)
        ) {

          semitones =
            POSITION_SEMITONES[2];

          position =
            "3rd finger";

        } else if (
          "5678".includes(key)
        ) {

          semitones =
            POSITION_SEMITONES[3];

          position =
            "4th finger";

        } else {

          semitones =
            POSITION_SEMITONES[1];

        }


        await playNote(
          index,
          semitones,
          position
        );

      }

    }
  );


  document.addEventListener(
    "keyup",
    (event) => {

      const key =
        event.key.toLowerCase();


      pressedKeys.delete(
        key
      );


      if (
        OPEN_KEYS[key] !== undefined
      ) {

        stopVoice(
          OPEN_KEYS[key]
        );

      }


      if (
        POSITION_KEYS[key] !== undefined
      ) {

        stopVoice(
          POSITION_KEYS[key]
        );

      }


      if (!sustain) {
        releasePlayingStrings();
      }

    }
  );


  /* ==========================================================
     VOLUME
     ========================================================== */

  volumeSlider.addEventListener(
    "input",
    () => {

      volume =
        Number(
          volumeSlider.value
        ) / 100;


      volumeValue.textContent =
        `${Math.round(volume * 100)}%`;


      if (volume > 0) {

        previousVolume =
          volume;

        muted = false;

        muteButton.setAttribute(
          "aria-pressed",
          "false"
        );

        muteButton.textContent =
          "🔊";

      }


      updateVoiceVolumes();

    }
  );


  function updateVoiceVolumes() {

    const context =
      getAudioContext();

    if (!context) {
      return;
    }


    const target =
      muted
        ? 0.0001
        : Math.max(
            0.0001,
            volume * 0.22
          );


    activeVoices.forEach(
      (voice) => {

        voice.output.gain.setTargetAtTime(
          target,
          context.currentTime,
          0.03
        );

      }
    );

  }


  /* ==========================================================
     MUTE
     ========================================================== */

  muteButton.addEventListener(
    "click",
    () => {

      muted =
        !muted;


      if (muted) {

        previousVolume =
          volume;

        volume = 0;

        volumeSlider.value =
          "0";

        volumeValue.textContent =
          "0%";

        muteButton.textContent =
          "🔇";

      } else {

        volume =
          previousVolume || 0.18;

        volumeSlider.value =
          String(
            Math.round(
              volume * 100
            )
          );

        volumeValue.textContent =
          `${Math.round(volume * 100)}%`;

        muteButton.textContent =
          "🔊";

      }


      muteButton.setAttribute(
        "aria-pressed",
        String(muted)
      );


      updateVoiceVolumes();

    }
  );


  /* ==========================================================
     SUSTAIN
     ========================================================== */

  sustainToggle.addEventListener(
    "click",
    () => {

      sustain =
        !sustain;


      sustainToggle.setAttribute(
        "aria-pressed",
        String(sustain)
      );


      sustainToggle.textContent =
        sustain
          ? "Sustain: On"
          : "Sustain: Off";


      if (!sustain) {

        activeVoices.forEach(
          (_, index) => {
            stopVoice(index);
          }
        );

        releasePlayingStrings();

      }

    }
  );


  /* ==========================================================
     RELEASE ALL
     ========================================================== */

  clearButton.addEventListener(
    "click",
    () => {

      releaseAll();

    }
  );


  /* ==========================================================
     SELECTED STRING INITIAL STATE
     ========================================================== */

  selectString(
    0
  );


  /* ==========================================================
     INITIAL VOLUME
     ========================================================== */

  volume =
    Number(
      volumeSlider.value
    ) / 100;


  previousVolume =
    volume;


  volumeValue.textContent =
    `${Math.round(volume * 100)}%`;

})();