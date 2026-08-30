'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const GuitarEngine = require(
  '../projects/instruments/guitar/guitarEngine.js'
);

test('GuitarEngine', async t => {
  await t.test('constructor uses default options', () => {
    const guitar = new GuitarEngine();

    assert.deepStrictEqual(guitar.options, {
      duration: 2.2,
      volume: 0.45,
      decay: 2,
      brightness: 0.35
    });

    assert.strictEqual(guitar.audioContext, null);
    assert.strictEqual(guitar.masterGain, null);
    assert.strictEqual(guitar.initialized, false);
  });

  await t.test('constructor accepts custom options', () => {
    const guitar = new GuitarEngine({
      duration: 3,
      volume: 0.7,
      brightness: 0.8
    });

    assert.strictEqual(guitar.options.duration, 3);
    assert.strictEqual(guitar.options.volume, 0.7);
    assert.strictEqual(guitar.options.brightness, 0.8);

    // Unspecified options remain at their defaults.
    assert.strictEqual(guitar.options.decay, 2);
  });

  await t.test('standard tuning contains six strings', () => {
    assert.strictEqual(
      GuitarEngine.STANDARD_TUNING.length,
      6
    );
  });

  await t.test('standard tuning is correct', () => {
    assert.deepStrictEqual(
      GuitarEngine.STANDARD_TUNING,
      [
        { name: 'E2', frequency: 82.4069 },
        { name: 'A2', frequency: 110.0 },
        { name: 'D3', frequency: 146.832 },
        { name: 'G3', frequency: 195.998 },
        { name: 'B3', frequency: 246.942 },
        { name: 'E4', frequency: 329.628 }
      ]
    );
  });

  await t.test('getTuning returns indexed tuning data', () => {
    const guitar = new GuitarEngine();

    assert.deepStrictEqual(guitar.getTuning(), [
      { index: 0, name: 'E2', frequency: 82.4069 },
      { index: 1, name: 'A2', frequency: 110.0 },
      { index: 2, name: 'D3', frequency: 146.832 },
      { index: 3, name: 'G3', frequency: 195.998 },
      { index: 4, name: 'B3', frequency: 246.942 },
      { index: 5, name: 'E4', frequency: 329.628 }
    ]);
  });

  await t.test('getString returns string information', () => {
    const guitar = new GuitarEngine();

    assert.deepStrictEqual(guitar.getString(0), {
      index: 0,
      name: 'E2',
      frequency: 82.4069
    });

    assert.deepStrictEqual(guitar.getString(5), {
      index: 5,
      name: 'E4',
      frequency: 329.628
    });
  });

  await t.test('validateString accepts valid indexes', () => {
    const guitar = new GuitarEngine();

    assert.doesNotThrow(() => guitar.validateString(0));
    assert.doesNotThrow(() => guitar.validateString(1));
    assert.doesNotThrow(() => guitar.validateString(5));
  });

  await t.test('validateString rejects invalid indexes', () => {
    const guitar = new GuitarEngine();

    assert.throws(
      () => guitar.validateString(-1),
      /Invalid guitar string: -1/
    );

    assert.throws(
      () => guitar.validateString(6),
      /Invalid guitar string: 6/
    );

    assert.throws(
      () => guitar.validateString(1.5),
      /Invalid guitar string: 1.5/
    );

    assert.throws(
      () => guitar.validateString('1'),
      /Invalid guitar string: 1/
    );
  });

  await t.test('midiToFrequency converts A4 to 440 Hz', () => {
    const guitar = new GuitarEngine();

    assert.ok(
      Math.abs(guitar.midiToFrequency(69) - 440) < 0.0001
    );
  });

  await t.test('midiToFrequency converts C4 correctly', () => {
    const guitar = new GuitarEngine();

    assert.ok(
      Math.abs(
        guitar.midiToFrequency(60) - 261.625565
      ) < 0.0001
    );
  });

  await t.test('noteToMidi converts common notes', () => {
    const guitar = new GuitarEngine();

    assert.strictEqual(guitar.noteToMidi('C4'), 60);
    assert.strictEqual(guitar.noteToMidi('A4'), 69);
    assert.strictEqual(guitar.noteToMidi('E2'), 40);
    assert.strictEqual(guitar.noteToMidi('E4'), 64);
  });

  await t.test('noteToMidi handles sharps', () => {
    const guitar = new GuitarEngine();

    assert.strictEqual(guitar.noteToMidi('C#4'), 61);
    assert.strictEqual(guitar.noteToMidi('F#4'), 66);
  });

  await t.test('noteToMidi handles flats', () => {
    const guitar = new GuitarEngine();

    assert.strictEqual(guitar.noteToMidi('Bb4'), 70);
    assert.strictEqual(guitar.noteToMidi('Eb4'), 63);
  });

  await t.test('noteToMidi rejects invalid notes', () => {
    const guitar = new GuitarEngine();

    assert.throws(
      () => guitar.noteToMidi('H4'),
      /Invalid note: H4/
    );

    assert.throws(
      () => guitar.noteToMidi('invalid'),
      /Invalid note: invalid/
    );

    assert.throws(
      () => guitar.noteToMidi('E'),
      /Invalid note: E/
    );
  });

  await t.test('midiToNote converts MIDI values to notes', () => {
    const guitar = new GuitarEngine();

    assert.strictEqual(guitar.midiToNote(60), 'C4');
    assert.strictEqual(guitar.midiToNote(69), 'A4');
    assert.strictEqual(guitar.midiToNote(40), 'E2');
    assert.strictEqual(guitar.midiToNote(64), 'E4');
  });

  await t.test('midiToNote handles sharp notes', () => {
    const guitar = new GuitarEngine();

    assert.strictEqual(guitar.midiToNote(61), 'C#4');
    assert.strictEqual(guitar.midiToNote(66), 'F#4');
  });

  await t.test('getFrequency returns open string frequency', () => {
    const guitar = new GuitarEngine();

    assert.ok(
      Math.abs(guitar.getFrequency(0, 0) - 82.4069) < 0.0001
    );

    assert.ok(
      Math.abs(guitar.getFrequency(1, 0) - 110) < 0.0001
    );

    assert.ok(
      Math.abs(guitar.getFrequency(5, 0) - 329.628) < 0.0001
    );
  });

  await t.test('getFrequency calculates fret frequency', () => {
    const guitar = new GuitarEngine();

    const frequency = guitar.getFrequency(0, 1);

    assert.ok(
      Math.abs(frequency - 87.307) < 0.01
    );
  });

  await t.test('twelfth fret is one octave higher', () => {
    const guitar = new GuitarEngine();

    const openFrequency = guitar.getFrequency(0, 0);
    const octaveFrequency = guitar.getFrequency(0, 12);

    assert.ok(
      Math.abs(
        octaveFrequency - openFrequency * 2
      ) < 0.01
    );
  });

  await t.test('getFrequency rejects negative frets', () => {
    const guitar = new GuitarEngine();

    assert.throws(
      () => guitar.getFrequency(0, -1),
      /Fret must be a non-negative integer/
    );
  });

  await t.test('getFrequency rejects fractional frets', () => {
    const guitar = new GuitarEngine();

    assert.throws(
      () => guitar.getFrequency(0, 1.5),
      /Fret must be a non-negative integer/
    );
  });

  await t.test('getFrequency rejects invalid strings', () => {
    const guitar = new GuitarEngine();

    assert.throws(
      () => guitar.getFrequency(6, 0),
      /Invalid guitar string: 6/
    );
  });

  await t.test('getNote returns open string notes', () => {
    const guitar = new GuitarEngine();

    assert.strictEqual(guitar.getNote(0, 0), 'E2');
    assert.strictEqual(guitar.getNote(1, 0), 'A2');
    assert.strictEqual(guitar.getNote(2, 0), 'D3');
    assert.strictEqual(guitar.getNote(3, 0), 'G3');
    assert.strictEqual(guitar.getNote(4, 0), 'B3');
    assert.strictEqual(guitar.getNote(5, 0), 'E4');
  });

  await t.test('getNote returns correct first-fret notes', () => {
    const guitar = new GuitarEngine();

    assert.strictEqual(guitar.getNote(0, 1), 'F2');
    assert.strictEqual(guitar.getNote(1, 1), 'A#2');
    assert.strictEqual(guitar.getNote(2, 1), 'D#3');
  });

  await t.test('getNote returns correct twelfth-fret notes', () => {
    const guitar = new GuitarEngine();

    assert.strictEqual(guitar.getNote(0, 12), 'E3');
    assert.strictEqual(guitar.getNote(1, 12), 'A3');
    assert.strictEqual(guitar.getNote(5, 12), 'E5');
  });

  await t.test('getNote rejects invalid frets', () => {
    const guitar = new GuitarEngine();

    assert.throws(
      () => guitar.getNote(0, -1),
      /Fret must be a non-negative integer/
    );

    assert.throws(
      () => guitar.getNote(0, 1.5),
      /Fret must be a non-negative integer/
    );
  });

  await t.test('getNote rejects invalid strings', () => {
    const guitar = new GuitarEngine();

    assert.throws(
      () => guitar.getNote(10, 0),
      /Invalid guitar string: 10/
    );
  });

  await t.test('playNote rejects zero frequency', async () => {
    const guitar = new GuitarEngine();

    await assert.rejects(
      () => guitar.playNote(0),
      /Frequency must be a positive number/
    );
  });

  await t.test('playNote rejects negative frequency', async () => {
    const guitar = new GuitarEngine();

    await assert.rejects(
      () => guitar.playNote(-440),
      /Frequency must be a positive number/
    );
  });

  await t.test('playNote rejects NaN', async () => {
    const guitar = new GuitarEngine();

    await assert.rejects(
      () => guitar.playNote(NaN),
      /Frequency must be a positive number/
    );
  });

  await t.test('playNote rejects Infinity', async () => {
    const guitar = new GuitarEngine();

    await assert.rejects(
      () => guitar.playNote(Infinity),
      /Frequency must be a positive number/
    );
  });

  await t.test('setVolume clamps values below zero', () => {
    const guitar = new GuitarEngine();

    guitar.initialized = true;
    guitar.audioContext = {
      currentTime: 0
    };

    guitar.masterGain = {
      gain: {
        setTargetAtTime() {}
      }
    };

    guitar.setVolume(-1);

    assert.strictEqual(guitar.options.volume, 0);
  });

  await t.test('setVolume clamps values above one', () => {
    const guitar = new GuitarEngine();

    guitar.initialized = true;
    guitar.audioContext = {
      currentTime: 0
    };

    guitar.masterGain = {
      gain: {
        setTargetAtTime() {}
      }
    };

    guitar.setVolume(2);

    assert.strictEqual(guitar.options.volume, 1);
  });

  await t.test('setVolume accepts valid values', () => {
    const guitar = new GuitarEngine();

    let receivedArguments;

    guitar.initialized = true;

    guitar.audioContext = {
      currentTime: 10
    };

    guitar.masterGain = {
      gain: {
        setTargetAtTime(...args) {
          receivedArguments = args;
        }
      }
    };

    guitar.setVolume(0.65);

    assert.strictEqual(guitar.options.volume, 0.65);

    assert.deepStrictEqual(receivedArguments, [
      0.65,
      10,
      0.01
    ]);
  });

  await t.test('stopAll stops every active voice', () => {
    const guitar = new GuitarEngine();

    let oscillatorStopped = false;
    let harmonicStopped = false;
    let noiseStopped = false;

    const voice = {
      oscillator: {
        stop() {
          oscillatorStopped = true;
        }
      },
      harmonic: {
        stop() {
          harmonicStopped = true;
        }
      },
      noise: {
        stop() {
          noiseStopped = true;
        }
      }
    };

    guitar.activeVoices.add(voice);

    guitar.stopAll();

    assert.strictEqual(oscillatorStopped, true);
    assert.strictEqual(harmonicStopped, true);
    assert.strictEqual(noiseStopped, true);
    assert.strictEqual(guitar.activeVoices.size, 0);
  });

  await t.test(
    'stopAll handles already stopped audio nodes',
    () => {
      const guitar = new GuitarEngine();

      const voice = {
        oscillator: {
          stop() {
            throw new Error('already stopped');
          }
        },
        harmonic: {
          stop() {
            throw new Error('already stopped');
          }
        },
        noise: {
          stop() {
            throw new Error('already stopped');
          }
        }
      };

      guitar.activeVoices.add(voice);

      assert.doesNotThrow(() => guitar.stopAll());
      assert.strictEqual(guitar.activeVoices.size, 0);
    }
  );
});