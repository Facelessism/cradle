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

test("re-importing the same backup multiple times never creates duplicate cards", () => {
  const initialBackup = makeBackup(
    [
      makeDeck("d1", "Deck 1", [
        makeCard("c1", "What is 2+2?", "4"),
        makeCard("c2", "Capital of France?", "Paris"),
      ]),
      makeDeck("d2", "Deck 2", [
        makeCard("c3", "Speed of light?", "299,792,458 m/s"),
      ]),
    ],
    5
  );

  const firstImport = mergeImportedBackup({ decks: [], sessions: 0 }, initialBackup);
  assert.equal(firstImport.success, true);
  assert.equal(firstImport.importedDecks, 2);
  assert.equal(firstImport.importedCards, 3);
  assert.equal(firstImport.skippedCards, 0);

  // Second import of the exact same backup
  const secondImport = mergeImportedBackup(firstImport.data, initialBackup);
  assert.equal(secondImport.success, true);
  assert.equal(secondImport.importedDecks, 0);
  assert.equal(secondImport.skippedDecks, 2);
  assert.equal(secondImport.importedCards, 0);
  assert.equal(secondImport.updatedCards, 0);
  assert.equal(secondImport.skippedCards, 3);

  // Card counts remain identical (no duplicates added)
  assert.equal(secondImport.data.decks[0].cards.length, 2);
  assert.equal(secondImport.data.decks[1].cards.length, 1);

  // Third repeated import
  const thirdImport = mergeImportedBackup(secondImport.data, initialBackup);
  assert.equal(thirdImport.importedCards, 0);
  assert.equal(thirdImport.skippedCards, 3);
  assert.equal(thirdImport.data.decks[0].cards.length, 2);
  assert.equal(thirdImport.data.decks[1].cards.length, 1);
});

test("detects and prevents duplicate cards with different IDs but identical content", () => {
  const current = makeBackup(
    [
      makeDeck("d1", "Capitals", [
        makeCard("local-1", "What is the capital of France?", "Paris"),
      ]),
    ],
    1
  );

  const imported = makeBackup(
    [
      makeDeck("d1", "Capitals", [
        // Same card content, different ID and extra spaces/casing
        makeCard("imported-1", "  what is the CAPITAL of France?  ", "  paris  "),
      ]),
    ],
    1
  );

  const result = mergeImportedBackup(current, imported);
  assert.equal(result.success, true);
  assert.equal(result.data.decks[0].cards.length, 1);
  assert.equal(result.data.decks[0].cards[0].id, "local-1");
  assert.equal(result.importedCards, 0);
  assert.equal(result.skippedCards, 1);
});

test("merges new cards into existing deck while preserving existing cards", () => {
  const current = makeBackup(
    [
      makeDeck("d1", "Science", [
        makeCard("c1", "Water", "H2O"),
        makeCard("c-local", "Local card", "Local answer"),
      ]),
    ],
    2
  );

  const imported = makeBackup(
    [
      makeDeck("d1", "Science", [
        makeCard("c1", "Water", "H2O"),
        makeCard("c2", "Oxygen", "O2"),
      ]),
    ],
    2
  );

  const result = mergeImportedBackup(current, imported);
  assert.equal(result.success, true);
  assert.equal(result.data.decks[0].cards.length, 3);
  assert.deepEqual(
    result.data.decks[0].cards.map(c => c.id),
    ["c1", "c-local", "c2"]
  );
  assert.equal(result.importedCards, 1);
  assert.equal(result.skippedCards, 1);
});

test("applies valid study progress updates from imported backup to existing cards", () => {
  const current = makeBackup(
    [
      makeDeck("d1", "Deck", [
        { id: "c1", front: "Q1", back: "A1", mastery: 1, lastReviewed: 1000 },
        { id: "c2", front: "Q2", back: "A2", mastery: 4, lastReviewed: 5000 },
      ]),
    ],
    1
  );

  const imported = makeBackup(
    [
      makeDeck("d1", "Deck", [
        // c1 has newer study progress
        { id: "c1", front: "Q1", back: "A1", mastery: 4, lastReviewed: 3000 },
        // c2 has older study progress
        { id: "c2", front: "Q2", back: "A2", mastery: 2, lastReviewed: 2000 },
      ]),
    ],
    1
  );

  const result = mergeImportedBackup(current, imported);
  assert.equal(result.success, true);
  assert.equal(result.updatedCards, 1); // only c1 updated
  assert.equal(result.skippedCards, 1); // c2 skipped (older review)
  assert.equal(result.data.decks[0].cards[0].mastery, 4);
  assert.equal(result.data.decks[0].cards[0].lastReviewed, 3000);
  assert.equal(result.data.decks[0].cards[1].mastery, 4);
  assert.equal(result.data.decks[0].cards[1].lastReviewed, 5000);
});

test("applies valid card text edits when matching card by ID", () => {
  const current = makeBackup(
    [
      makeDeck("d1", "Deck", [
        makeCard("c1", "Old question", "Old answer"),
      ]),
    ],
    1
  );

  const imported = makeBackup(
    [
      makeDeck("d1", "Deck", [
        makeCard("c1", "Updated question", "Updated answer"),
      ]),
    ],
    1
  );

  const result = mergeImportedBackup(current, imported);
  assert.equal(result.success, true);
  assert.equal(result.updatedCards, 1);
  assert.equal(result.data.decks[0].cards[0].front, "Updated question");
  assert.equal(result.data.decks[0].cards[0].back, "Updated answer");
  assert.equal(result.data.decks[0].cards.length, 1);
});

test("mergeImportedBackup never mutates currentData or importedData inputs", () => {
  const currentCard = makeCard("c1", "Q", "A");
  currentCard.mastery = 0;
  const current = makeBackup([makeDeck("d1", "Deck", [currentCard])], 1);

  const importedCard = makeCard("c1", "Q", "A");
  importedCard.mastery = 5;
  importedCard.lastReviewed = 9999;
  const imported = makeBackup([makeDeck("d1", "Deck", [importedCard])], 2);

  const result = mergeImportedBackup(current, imported);
  assert.equal(result.success, true);
  assert.equal(current.decks[0].cards[0].mastery, 0);
  assert.equal(current.decks[0].cards[0].lastReviewed, null);
  assert.equal(imported.decks[0].cards[0].mastery, 5);
  assert.equal(result.data.decks[0].cards[0].mastery, 5);
});
