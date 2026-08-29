'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const guitar = new GuitarEngine();

  const strings = [
    ...document.querySelectorAll('[data-string]')
  ];

  const fretButtons = [
    ...document.querySelectorAll('[data-fret]')
  ];

  const status = document.querySelector('[data-status]');
  const noteDisplay = document.querySelector('[data-note]');
  const tuningDisplay = document.querySelector('[data-tuning]');

  const keyboardMap = {
    'a': { string: 0, fret: 0 },
    's': { string: 1, fret: 0 },
    'd': { string: 2, fret: 0 },
    'f': { string: 3, fret: 0 },
    'g': { string: 4, fret: 0 },
    'h': { string: 5, fret: 0 },

    'q': { string: 0, fret: 3 },
    'w': { string: 1, fret: 3 },
    'e': { string: 2, fret: 3 },
    'r': { string: 3, fret: 3 },
    't': { string: 4, fret: 3 },
    'y': { string: 5, fret: 3 }
  };

  let selectedFret = 0;
  let activePointers = new Map();

  function setStatus(text) {
    if (status) {
      status.textContent = text;
    }
  }

  function displayNote(note, frequency) {
    if (noteDisplay) {
      noteDisplay.textContent = note;
    }

    if (frequency && tuningDisplay) {
      tuningDisplay.textContent =
        `${frequency.toFixed(2)} Hz`;
    }
  }

  function activateElement(element) {
    if (!element) return;

    element.classList.add('active');

    window.setTimeout(() => {
      element.classList.remove('active');
    }, 120);
  }

  async function playString(stringIndex, fret = 0, element = null) {
    try {
      const result = await guitar.playString(
        stringIndex,
        fret
      );

      activateElement(element);

      displayNote(
        result.note,
        result.frequency
      );

      setStatus(
        `${result.note} · String ${stringIndex + 1}`
      );

      return result;
    } catch (error) {
      console.error('Guitar playback error:', error);
      setStatus('Audio unavailable');
    }
  }

  function getStringElement(stringIndex) {
    return document.querySelector(
      `[data-string="${stringIndex}"]`
    );
  }

  function getFretButton(fret) {
    return document.querySelector(
      `[data-fret="${fret}"]`
    );
  }

  function selectFret(fret) {
    selectedFret = fret;

    fretButtons.forEach(element => {
      element.classList.remove('selected');
    });

    const element = getFretButton(fret);

    if (element) {
      element.classList.add('selected');
    }

    setStatus(
      fret === 0
        ? 'Open position'
        : `Fret ${fret} selected`
    );
  }

  function getSelectedFret() {
    return selectedFret;
  }

  function handleFretInteraction(element) {
    const fret = Number(element.dataset.fret);

    if (!Number.isInteger(fret)) {
      return;
    }

    selectFret(fret);
  }

  fretButtons.forEach(element => {
    element.addEventListener('pointerdown', event => {
      event.preventDefault();

      handleFretInteraction(element);
    });
  });

  strings.forEach(element => {
    element.addEventListener('pointerdown', async event => {
      event.preventDefault();

      const stringIndex =
        Number(element.dataset.string);

      const fret =
        getSelectedFret();

      activePointers.set(
        event.pointerId,
        {
          stringIndex,
          fret
        }
      );

      await playString(
        stringIndex,
        fret,
        element
      );
    });

    element.addEventListener('pointerenter', event => {
      if (event.buttons !== 1) {
        return;
      }

      const stringIndex =
        Number(element.dataset.string);

      const fret =
        getSelectedFret();

      playString(
        stringIndex,
        fret,
        element
      );
    });

    element.addEventListener('pointerup', event => {
      activePointers.delete(
        event.pointerId
      );
    });

    element.addEventListener('pointercancel', event => {
      activePointers.delete(
        event.pointerId
      );
    });
  });

  document.addEventListener('keydown', event => {
    if (
      event.repeat ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    ) {
      return;
    }

    const key =
      event.key.toLowerCase();

    const mapping =
      keyboardMap[key];

    if (!mapping) {
      return;
    }

    event.preventDefault();

    const {
      string: stringIndex,
      fret
    } = mapping;

    const element =
      getStringElement(
        stringIndex
      );

    playString(
      stringIndex,
      fret,
      element
    );
  });

  document.addEventListener('keyup', event => {
    const key =
      event.key.toLowerCase();

    if (!keyboardMap[key]) {
      return;
    }

    const mapping =
      keyboardMap[key];

    const element =
      getStringElement(
        mapping.string
      );

    if (element) {
      element.classList.remove('active');
    }
  });

  const strumDownButton =
    document.querySelector(
      '[data-strum="down"]'
    );

  const strumUpButton =
    document.querySelector(
      '[data-strum="up"]'
    );

  async function strum(direction) {
    try {
      const results =
        await guitar.strum(
          [0, 1, 2, 3, 4, 5],
          {
            direction,
            fret: getSelectedFret(),
            delay: 0.045
          }
        );

      strings.forEach(element => {
        element.classList.add('active');

        window.setTimeout(() => {
          element.classList.remove('active');
        }, 140);
      });

      if (results.length > 0) {
        const last =
          direction === 'down'
            ? results[results.length - 1]
            : results[0];

        displayNote(
          last.note,
          last.frequency
        );

        setStatus(
          `${direction === 'down' ? '↓' : '↑'} Strum`
        );
      }
    } catch (error) {
      console.error('Strum error:', error);
      setStatus('Audio unavailable');
    }
  }

  if (strumDownButton) {
    strumDownButton.addEventListener(
      'pointerdown',
      event => {
        event.preventDefault();
        strum('down');
      }
    );
  }

  if (strumUpButton) {
    strumUpButton.addEventListener(
      'pointerdown',
      event => {
        event.preventDefault();
        strum('up');
      }
    );
  }

  const volumeControl =
    document.querySelector(
      '[data-volume]'
    );

  if (volumeControl) {
    volumeControl.addEventListener(
      'input',
      event => {
        guitar.setVolume(
          Number(event.target.value)
        );
      }
    );
  }

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        guitar.stopAll();
      }
    }
  );

  window.guitar = guitar;

  setStatus('Ready');
});