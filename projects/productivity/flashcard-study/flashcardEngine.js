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

  function normalizeText(text) {
    if (typeof text !== "string") return "";
    return text.trim().toLowerCase().replace(/\s+/g, " ");
  }

  function cardContentKey(card) {
    if (!card) return "";
    return `${normalizeText(card.front)}:::${normalizeText(card.back)}`;
  }

  /**
   * Merges an imported backup into existing state without mutating either input.
   * Matches decks by ID (or unique normalized name if ID is not found).
   * Within matched decks, cards are deduplicated by ID and normalized content
   * (front and back text, case- and whitespace-insensitive).
   * Valid updates (more recent study timestamps, higher mastery, updated text)
   * are applied to existing cards, while new cards are appended and existing
   * cards not in the backup are preserved.
   * Repeated imports of the same backup are idempotent and never create duplicates.
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

    // Build lookup maps for existing decks
    const currentDecksById = new Map();
    const currentDecksByName = new Map();

    for (const deck of current.decks) {
      if (deck && typeof deck.id === "string") {
        currentDecksById.set(deck.id, deck);
        const nameKey = normalizeText(deck.name);
        if (nameKey && !currentDecksByName.has(nameKey)) {
          currentDecksByName.set(nameKey, deck);
        }
      }
    }

    const matchedExistingDeckIds = new Set();
    const mergedDecksMap = new Map(); // existingDeckId -> merged cloned deck
    const newlyAddedDecks = [];

    let importedCardsCount = 0;
    let updatedCardsCount = 0;
    let skippedCardsCount = 0;

    for (const importedDeck of importedData.decks) {
      // Find matching existing deck by ID, or by name if not yet matched
      let existingDeck = currentDecksById.get(importedDeck.id);
      if (!existingDeck) {
        const nameKey = normalizeText(importedDeck.name);
        if (nameKey && currentDecksByName.has(nameKey)) {
          const candidate = currentDecksByName.get(nameKey);
          if (!matchedExistingDeckIds.has(candidate.id)) {
            existingDeck = candidate;
          }
        }
      }

      if (existingDeck) {
        matchedExistingDeckIds.add(existingDeck.id);

        // Get or initialize the merged clone for this existing deck
        let mergedDeck = mergedDecksMap.get(existingDeck.id);
        let cardsById;
        let cardsByContent;

        if (!mergedDeck) {
          const clonedCards = (
            Array.isArray(existingDeck.cards) ? existingDeck.cards : []
          ).map(card => ({ ...card }));

          mergedDeck = {
            ...existingDeck,
            description:
              existingDeck.description || importedDeck.description || "",
            cards: clonedCards,
          };
          mergedDecksMap.set(existingDeck.id, mergedDeck);

          cardsById = new Map();
          cardsByContent = new Map();
          for (const card of clonedCards) {
            if (card && typeof card.id === "string") {
              cardsById.set(card.id, card);
              const key = cardContentKey(card);
              if (key && !cardsByContent.has(key)) {
                cardsByContent.set(key, card);
              }
            }
          }
          mergedDeck._cardsById = cardsById;
          mergedDeck._cardsByContent = cardsByContent;
        } else {
          cardsById = mergedDeck._cardsById;
          cardsByContent = mergedDeck._cardsByContent;
        }

        // Merge cards from importedDeck
        const importedCards = Array.isArray(importedDeck.cards)
          ? importedDeck.cards
          : [];

        for (const importedCard of importedCards) {
          const existingCard =
            cardsById.get(importedCard.id) ||
            cardsByContent.get(cardContentKey(importedCard));

          if (existingCard) {
            let isUpdated = false;

            // Content update when matched by ID
            if (existingCard.id === importedCard.id) {
              const frontTrimmed = importedCard.front.trim();
              const backTrimmed = importedCard.back.trim();
              if (
                frontTrimmed &&
                backTrimmed &&
                (frontTrimmed !== existingCard.front ||
                  backTrimmed !== existingCard.back)
              ) {
                existingCard.front = frontTrimmed;
                existingCard.back = backTrimmed;
                isUpdated = true;
              }
            }

            // Study review progress updates
            const importedReviewed = importedCard.lastReviewed;
            const existingReviewed = existingCard.lastReviewed;

            if (typeof importedReviewed === "number") {
              if (
                existingReviewed === null ||
                importedReviewed > existingReviewed
              ) {
                if (
                  existingCard.lastReviewed !== importedReviewed ||
                  existingCard.mastery !== importedCard.mastery
                ) {
                  existingCard.lastReviewed = importedReviewed;
                  existingCard.mastery = importedCard.mastery;
                  isUpdated = true;
                }
              } else if (importedReviewed === existingReviewed) {
                if (importedCard.mastery > existingCard.mastery) {
                  existingCard.mastery = importedCard.mastery;
                  isUpdated = true;
                }
              }
            } else if (importedReviewed === null && existingReviewed === null) {
              if (importedCard.mastery > existingCard.mastery) {
                existingCard.mastery = importedCard.mastery;
                isUpdated = true;
              }
            }

            if (isUpdated) {
              updatedCardsCount++;
            } else {
              skippedCardsCount++;
            }
          } else {
            // New card in existing deck
            const newCard = {
              ...importedCard,
              id: importedCard.id,
              front: importedCard.front.trim(),
              back: importedCard.back.trim(),
              mastery: importedCard.mastery,
              lastReviewed: importedCard.lastReviewed,
            };
            mergedDeck.cards.push(newCard);
            cardsById.set(newCard.id, newCard);
            const key = cardContentKey(newCard);
            if (key) {
              cardsByContent.set(key, newCard);
            }
            importedCardsCount++;
          }
        }
      } else {
        // Genuinely new deck
        const newCards = [];
        const newCardsById = new Map();
        const newCardsByContent = new Map();

        const importedCards = Array.isArray(importedDeck.cards)
          ? importedDeck.cards
          : [];

        for (const importedCard of importedCards) {
          const contentKey = cardContentKey(importedCard);
          const duplicateInNew =
            newCardsById.get(importedCard.id) ||
            (contentKey ? newCardsByContent.get(contentKey) : null);

          if (duplicateInNew) {
            skippedCardsCount++;
          } else {
            const cardClone = {
              ...importedCard,
              id: importedCard.id,
              front: importedCard.front.trim(),
              back: importedCard.back.trim(),
              mastery: importedCard.mastery,
              lastReviewed: importedCard.lastReviewed,
            };
            newCards.push(cardClone);
            newCardsById.set(cardClone.id, cardClone);
            if (contentKey) {
              newCardsByContent.set(contentKey, cardClone);
            }
            importedCardsCount++;
          }
        }

        const newDeck = {
          ...importedDeck,
          id: importedDeck.id,
          name: importedDeck.name,
          description: importedDeck.description || "",
          cards: newCards,
        };
        newlyAddedDecks.push(newDeck);
      }
    }

    // Assemble final decks: current decks in original order, then newly added decks
    const finalDecks = [];
    for (const currentDeck of current.decks) {
      const merged = mergedDecksMap.get(currentDeck.id);
      if (merged) {
        delete merged._cardsById;
        delete merged._cardsByContent;
        finalDecks.push(merged);
      } else {
        finalDecks.push({
          ...currentDeck,
          cards: (
            Array.isArray(currentDeck.cards) ? currentDeck.cards : []
          ).map(card => ({ ...card })),
        });
      }
    }
    for (const newDeck of newlyAddedDecks) {
      finalDecks.push(newDeck);
    }

    return {
      success: true,
      error: null,
      data: {
        ...current,
        decks: finalDecks,
        sessions: Math.max(current.sessions, importedData.sessions),
      },
      importedDecks: newlyAddedDecks.length,
      skippedDecks: importedData.decks.length - newlyAddedDecks.length,
      importedCards: importedCardsCount,
      updatedCards: updatedCardsCount,
      skippedCards: skippedCardsCount,
    };
  }

  return {
    validateBackup,
    mergeImportedBackup,
    normalizeText,
    cardContentKey,
  };
});
