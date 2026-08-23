import type { Card, CardId, CardNumber, GameState, SlotId } from './types';

/** The three Phase 1 board slots, left-to-right. */
export const SLOT_IDS: readonly SlotId[] = ['slotA', 'slotB', 'slotC'];

/** Phase 1 deck size. */
export const DECK_SIZE = 10;

/** Cards drawn automatically on start. */
export const OPENING_HAND_SIZE = 5;

/**
 * Build the Phase 1 deck: 10 placeholder cards numbered 1..10.
 * Deck order is bottom-to-top, so the last element is the top of the deck.
 */
export function createInitialCards(): {
  cardsById: Record<CardId, Card>;
  deck: CardId[];
} {
  const cardsById: Record<CardId, Card> = {};
  const deck: CardId[] = [];
  for (let i = 0; i < DECK_SIZE; i++) {
    const number = (i + 1) as CardNumber;
    const id: CardId = `card-${number}`;
    cardsById[id] = { id, number };
    deck.push(id);
  }
  return { cardsById, deck };
}

/** A fresh Phase 1 game state: full deck, empty hand, empty board, no drag. */
export function createInitialState(): GameState {
  const { cardsById, deck } = createInitialCards();
  return {
    cardsById,
    deck,
    hand: [],
    board: { slotA: null, slotB: null, slotC: null },
    dragging: null,
    hoveredCardId: null,
  };
}
