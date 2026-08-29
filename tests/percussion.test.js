import assert from "node:assert/strict";
import { test } from "node:test";
import PercussionEngine from "../projects/instruments/percussion/percussionEngine.js";

test("getPadFromKey returns the correct pad for keyboard mappings", () => {
    assert.equal(PercussionEngine.getPadFromKey("q"), "kick");
    assert.equal(PercussionEngine.getPadFromKey("w"), "snare");
    assert.equal(PercussionEngine.getPadFromKey("e"), "hihatClosed");
    assert.equal(PercussionEngine.getPadFromKey("r"), "hihatOpen");
    assert.equal(PercussionEngine.getPadFromKey("a"), "tomLow");
    assert.equal(PercussionEngine.getPadFromKey("s"), "tomHigh");
    assert.equal(PercussionEngine.getPadFromKey("d"), "clap");
    assert.equal(PercussionEngine.getPadFromKey("f"), "crash");
});

test("getPadFromKey handles uppercase keyboard input", () => {
    assert.equal(PercussionEngine.getPadFromKey("Q"), "kick");
    assert.equal(PercussionEngine.getPadFromKey("A"), "tomLow");
});

test("getPadFromKey returns null for an unmapped key", () => {
    assert.equal(PercussionEngine.getPadFromKey("z"), null);
    assert.equal(PercussionEngine.getPadFromKey("Enter"), null);
    assert.equal(PercussionEngine.getPadFromKey(""), null);
});

test("getKeyFromPad returns the correct keyboard key", () => {
    assert.equal(PercussionEngine.getKeyFromPad("kick"), "q");
    assert.equal(PercussionEngine.getKeyFromPad("crash"), "f");
});

test("isValidPad recognizes valid and invalid pads", () => {
    assert.equal(PercussionEngine.isValidPad("kick"), true);
    assert.equal(PercussionEngine.isValidPad("cowbell"), false);
});

test("getPads returns all 8 pads", () => {
    assert.equal(PercussionEngine.getPads().length, 8);
});

test("getPadLabel returns a human-readable label", () => {
    assert.equal(PercussionEngine.getPadLabel("hihatClosed"), "Closed Hi-Hat");
    assert.equal(PercussionEngine.getPadLabel("missing"), null);
});