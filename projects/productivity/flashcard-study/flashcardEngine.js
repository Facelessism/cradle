/* ================================================================
   Flashcard Studio — import/export data helpers
   Pure functions shared by the browser app and Node.js tests.
   ================================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FlashcardEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function validateBackup(input) {
    if (!isPlainObject(input)) {
      return { valid: false, error: "Backup must be a JSON object." };
    }
    if (!Array.isArray(input.decks)) {
      return { valid: false, error: "Backup must contain a decks array." };
    }
    if (!Number.isSafeInteger(input.sessions) || input.sessions < 0) {
      return {
        valid: false,
        error: "Backup must contain a non-negative integer sessions count.",
      };
    }

    const deckIds = new Set();
    for (const [deckIndex, deck] of input.decks.entries()) {
      if (
        !isPlainObject(deck) ||
        typeof deck.id !== "string" ||
        !deck.id.trim() ||
        typeof deck.name !== "string" ||
        !deck.name.trim() ||
        typeof deck.description !== "string" ||
        !Array.isArray(deck.cards)
      ) {
        return {
          valid: false,
          error: `Deck at position ${deckIndex + 1} has an invalid structure.`,
        };
      }
      if (deckIds.has(deck.id)) {
        return {
          valid: false,
          error: `Backup contains duplicate deck ID "${deck.id}".`,
        };
      }
      deckIds.add(deck.id);

      const cardIds = new Set();
      for (const [cardIndex, card] of deck.cards.entries()) {
        if (
          !isPlainObject(card) ||
          typeof card.id !== "string" ||
          !card.id.trim() ||
          typeof card.front !== "string" ||
          typeof card.back !== "string" ||
          !Number.isInteger(card.mastery) ||
          card.mastery < 0 ||
          card.mastery > 5 ||
          !(card.lastReviewed === null ||
            (typeof card.lastReviewed === "number" &&
              Number.isFinite(card.lastReviewed)))
        ) {
          return {
            valid: false,
            error: `Card ${cardIndex + 1} in deck "${deck.name}" has an invalid structure.`,
          };
        }
        if (cardIds.has(card.id)) {
          return {
            valid: false,
            error: `Deck "${deck.name}" contains duplicate card ID "${card.id}".`,
          };
        }
        cardIds.add(card.id);
      }
    }

    return { valid: true, error: null };
  }

  /**
   * Merges an imported backup into existing state without mutating either
   * input. Decks with IDs already present are skipped; new decks are appended.
   * Session counts are combined by taking the larger total rather than
   * summing it, making repeated imports of the same full backup idempotent.
   */
  function mergeImportedBackup(currentData, importedData) {
    const current = currentData || { decks: [], sessions: 0 };
    const validation = validateBackup(importedData);
    if (!validation.valid) {
      return { success: false, error: validation.error, data: current };
    }

    if (
      !Array.isArray(current.decks) ||
      !Number.isSafeInteger(current.sessions) ||
      current.sessions < 0
    ) {
      return {
        success: false,
        error: "Current flashcard data is invalid. Please refresh and try again.",
        data: current,
      };
    }

    const currentIds = new Set(current.decks.map(deck => deck.id));
    const newDecks = importedData.decks.filter(deck => !currentIds.has(deck.id));

    return {
      success: true,
      error: null,
      data: {
        ...current,
        decks: [...current.decks, ...newDecks],
        sessions: Math.max(current.sessions, importedData.sessions),
      },
      importedDecks: newDecks.length,
      skippedDecks: importedData.decks.length - newDecks.length,
    };
  }

  return { validateBackup, mergeImportedBackup };
});
