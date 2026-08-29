import assert from "node:assert/strict";
import { test } from "node:test";
import GuzhengEngine from "../projects/instruments/guzheng/guzhengEngine.js";

test("getFrequency returns correct frequency for guzheng strings", () => {
    assert.equal(GuzhengEngine.getFrequency("D4"), 293.66);
    assert.equal(GuzhengEngine.getFrequency("A4"), 440.0);
    assert.equal(GuzhengEngine.getFrequency("D7"), 2349.32);
});

test("getFrequency returns null for a note outside the tuning", () => {
    assert.equal(GuzhengEngine.getFrequency("C4"), null);
    assert.equal(GuzhengEngine.getFrequency("G4"), null);
});

test("getNoteFromKey returns the correct note for keyboard mappings", () => {
    assert.equal(GuzhengEngine.getNoteFromKey("1"), "D3");
    assert.equal(GuzhengEngine.getNoteFromKey("q"), "D5");
    assert.equal(GuzhengEngine.getNoteFromKey("["), "D7");
});

test("getNoteFromKey handles uppercase keyboard input", () => {
    assert.equal(GuzhengEngine.getNoteFromKey("Q"), "D5");
    assert.equal(GuzhengEngine.getNoteFromKey("P"), "B6");
});

test("getNoteFromKey returns null for an unmapped key", () => {
    assert.equal(GuzhengEngine.getNoteFromKey("z"), null);
    assert.equal(GuzhengEngine.getNoteFromKey("Enter"), null);
    assert.equal(GuzhengEngine.getNoteFromKey(""), null);
});

test("getKeyFromNote returns the correct keyboard key", () => {
    assert.equal(GuzhengEngine.getKeyFromNote("D3"), "1");
    assert.equal(GuzhengEngine.getKeyFromNote("D7"), "[");
});

test("getStrings returns all 21 strings", () => {
    assert.equal(GuzhengEngine.getStrings().length, 21);
});

test("isValidNote recognizes valid and invalid notes", () => {
    assert.equal(GuzhengEngine.isValidNote("A5"), true);
    assert.equal(GuzhengEngine.isValidNote("C5"), false);
});