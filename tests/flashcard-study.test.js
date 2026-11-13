const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateBackup,
  mergeImportedBackup,
} = require("../projects/productivity/flashcard-study/flashcardEngine.js");

function makeDeck(id, name = `Deck ${id}`, cards = []) {
  return { id, name, description: "", cards, createdAt: 1 };
}

function makeCard(id, front = "Question", back = "Answer") {
  return { id, front, back, mastery: 0, lastReviewed: null };
}

function makeBackup(decks = [], sessions = 0) {
  return { decks, sessions };
}

test("validateBackup accepts a valid exported backup, including empty backups", () => {
  assert.deepEqual(validateBackup(makeBackup()), { valid: true, error: null });
  assert.equal(validateBackup(makeBackup([makeDeck("d1", "Deck", [makeCard("c1")])], 3)).valid, true);
});

test("validateBackup rejects missing or incorrectly typed top-level fields", () => {
  for (const input of [null, [], {}, { decks: {} }, { decks: [], sessions: "2" }, { decks: [], sessions: -1 }, { decks: [], sessions: 1.5 }]) {
    assert.equal(validateBackup(input).valid, false);
  }
});

test("validateBackup rejects invalid deck and card records", () => {
  assert.equal(validateBackup(makeBackup([{}])).valid, false);
  assert.equal(validateBackup(makeBackup([makeDeck("d1", "Deck", [{}])])).valid, false);
  assert.equal(validateBackup(makeBackup([makeDeck("d1"), makeDeck("d1")])).valid, false);
  assert.equal(validateBackup(makeBackup([makeDeck("d1", "Deck", [makeCard("c1"), makeCard("c1")])])).valid, false);
});

test("mergeImportedBackup appends new decks and preserves current decks", () => {
  const current = makeBackup([makeDeck("existing")], 2);
  const imported = makeBackup([makeDeck("existing", "Imported copy"), makeDeck("new")], 4);
  const result = mergeImportedBackup(current, imported);

  assert.equal(result.success, true);
  assert.deepEqual(result.data.decks.map(deck => deck.id), ["existing", "new"]);
  assert.equal(result.data.decks[0].name, "Deck existing");
  assert.equal(result.data.sessions, 4);
  assert.equal(result.importedDecks, 1);
  assert.equal(result.skippedDecks, 1);
  assert.deepEqual(current.decks.map(deck => deck.id), ["existing"]);
});

test("re-importing the same backup is idempotent for deck IDs and session count", () => {
  const current = makeBackup([makeDeck("d1")], 5);
  const imported = makeBackup([makeDeck("d1"), makeDeck("d2")], 7);

  const first = mergeImportedBackup(current, imported);
  const second = mergeImportedBackup(first.data, imported);

  assert.deepEqual(second.data.decks.map(deck => deck.id), ["d1", "d2"]);
  assert.equal(second.data.sessions, 7);
  assert.equal(second.importedDecks, 0);
});

test("session count never decreases when importing an older backup", () => {
  const result = mergeImportedBackup(makeBackup([makeDeck("local")], 12), makeBackup([makeDeck("backup")], 4));
  assert.equal(result.data.sessions, 12);
});

test("invalid imports leave current data unchanged", () => {
  const current = makeBackup([makeDeck("keep")], 9);
  const result = mergeImportedBackup(current, { notes: "not a backup" });

  assert.equal(result.success, false);
  assert.deepEqual(result.data, current);
  assert.deepEqual(current.decks.map(deck => deck.id), ["keep"]);
  assert.equal(current.sessions, 9);
});
