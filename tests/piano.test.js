import assert from "node:assert/strict";
import { test } from "node:test";
import PianoEngine from "../projects/instruments/piano/pianoEngine.js";

test("getFrequency returns correct frequency for piano notes", () => {
  assert.equal(PianoEngine.getFrequency("A4"), 440);
  assert.equal(PianoEngine.getFrequency("C4"), 261.63);
  assert.equal(PianoEngine.getFrequency("E4"), 329.63);
});

test("getFrequency returns null for an invalid note", () => {
  assert.equal(PianoEngine.getFrequency("H4"), null);
  assert.equal(PianoEngine.getFrequency("C#9"), null);
});

test("getNoteFromKey returns the correct note for keyboard mappings", () => {
  assert.equal(PianoEngine.getNoteFromKey("a"), "C4");
  assert.equal(PianoEngine.getNoteFromKey("s"), "D4");
  assert.equal(PianoEngine.getNoteFromKey("d"), "E4");
  assert.equal(PianoEngine.getNoteFromKey("f"), "F4");
  assert.equal(PianoEngine.getNoteFromKey("w"), "C#4");
  assert.equal(PianoEngine.getNoteFromKey("t"), "F#4");
});

test("getNoteFromKey handles uppercase keyboard input", () => {
  assert.equal(PianoEngine.getNoteFromKey("A"), "C4");
  assert.equal(PianoEngine.getNoteFromKey("S"), "D4");
  assert.equal(PianoEngine.getNoteFromKey("W"), "C#4");
});

test("getNoteFromKey returns null for an unmapped key", () => {
  assert.equal(PianoEngine.getNoteFromKey("x"), null);
  assert.equal(PianoEngine.getNoteFromKey("Enter"), null);
  assert.equal(PianoEngine.getNoteFromKey(""), null);
});

test("getKeyFromNote returns the correct keyboard key", () => {
  assert.equal(PianoEngine.getKeyFromNote("C4"), "a");
  assert.equal(PianoEngine.getKeyFromNote("D4"), "s");
  assert.equal(PianoEngine.getKeyFromNote("A4"), "h");
  assert.equal(PianoEngine.getKeyFromNote("C#4"), "w");
  assert.equal(PianoEngine.getKeyFromNote("A#4"), "u");
});

test("getKeyFromNote returns null for an invalid note", () => {
  assert.equal(PianoEngine.getKeyFromNote("H4"), null);
  assert.equal(PianoEngine.getKeyFromNote("C#9"), null);
});

test("isValidNote correctly identifies valid piano notes", () => {
  assert.equal(PianoEngine.isValidNote("C4"), true);
  assert.equal(PianoEngine.isValidNote("A4"), true);
  assert.equal(PianoEngine.isValidNote("C#4"), true);
  assert.equal(PianoEngine.isValidNote("C5"), true);
});

test("isValidNote returns false for invalid notes", () => {
  assert.equal(PianoEngine.isValidNote("H4"), false);
  assert.equal(PianoEngine.isValidNote("C#9"), false);
  assert.equal(PianoEngine.isValidNote(""), false);
});

test("getNotes returns all visible piano notes", () => {
  const notes = PianoEngine.getNotes();

  assert.ok(notes.includes("C4"));
  assert.ok(notes.includes("D4"));
  assert.ok(notes.includes("E4"));
  assert.ok(notes.includes("F4"));
  assert.ok(notes.includes("G4"));
  assert.ok(notes.includes("A4"));
  assert.ok(notes.includes("B4"));
  assert.ok(notes.includes("C5"));
});

test("getNotes includes all black keys", () => {
  const notes = PianoEngine.getNotes();

  assert.ok(notes.includes("C#4"));
  assert.ok(notes.includes("D#4"));
  assert.ok(notes.includes("F#4"));
  assert.ok(notes.includes("G#4"));
  assert.ok(notes.includes("A#4"));
});

test("getKeyboardMap returns the expected keyboard mapping", () => {
  const map = PianoEngine.getKeyboardMap();

  assert.equal(map.a, "C4");
  assert.equal(map.w, "C#4");
  assert.equal(map.s, "D4");
  assert.equal(map.e, "D#4");
  assert.equal(map.d, "E4");
  assert.equal(map.f, "F4");
  assert.equal(map.t, "F#4");
  assert.equal(map.g, "G4");
  assert.equal(map.y, "G#4");
  assert.equal(map.h, "A4");
  assert.equal(map.u, "A#4");
  assert.equal(map.j, "B4");
  assert.equal(map.k, "C5");
});

test("note to keyboard mapping is reversible", () => {
  const notes = PianoEngine.getNotes();

  notes.forEach(note => {
    const key = PianoEngine.getKeyFromNote(note);

    if (key) {
      assert.equal(PianoEngine.getNoteFromKey(key), note);
    }
  });
});