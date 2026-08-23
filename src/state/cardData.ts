import type { Card, CardId, CardType, GameState, SlotId } from './types';

/** The three typed families, in canonical order. */
export const CARD_TYPES: readonly CardType[] = ['A', 'B', 'C'];

/** Slots per type family. */
export const SLOTS_PER_TYPE = 4;

/**
 * All 12 slot ids. Grouped by type family (A1..A4, B1..B4, C1..C4). Order here
 * only affects iteration (empty-slot listing, highlight scans), not layout.
 */
export const SLOT_IDS: readonly SlotId[] = CARD_TYPES.flatMap((t) =>
  Array.from({ length: SLOTS_PER_TYPE }, (_, i) => `${t}${i + 1}` as SlotId),
);

/** Phase 2 deck size: 4 of each of the 3 types. */
export const DECK_SIZE = CARD_TYPES.length * SLOTS_PER_TYPE;

/** Cards drawn automatically on start. */
export const OPENING_HAND_SIZE = 5;

/**
 * Build the Phase 2 deck: 12 cards, 4 each of A/B/C.
 *
 * Deck order is bottom-to-top (last element = top = drawn first). The types are
 * interleaved (A,B,C,A,B,C,...) so the opening hand of 5 comes out mixed rather
 * than four of one type in a row.
 */
export function createInitialCards(): {
  cardsById: Record<CardId, Card>;
  deck: CardId[];
} {
  const cardsById: Record<CardId, Card> = {};
  const deck: CardId[] = [];
  for (let i = 1; i <= SLOTS_PER_TYPE; i++) {
    for (const type of CARD_TYPES) {
      const id: CardId = `card-${type}${i}`;
      cardsById[id] = { id, type };
      deck.push(id);
    }
  }
  return { cardsById, deck };
}

/** A fresh empty board: all 12 typed slots unoccupied. */
export function createEmptyBoard(): GameState['board'] {
  return Object.fromEntries(SLOT_IDS.map((id) => [id, null])) as GameState['board'];
}

/** A fresh Phase 2 game state: full deck, empty hand, empty board, no drag. */
export function createInitialState(): GameState {
  const { cardsById, deck } = createInitialCards();
  return {
    cardsById,
    deck,
    hand: [],
    board: createEmptyBoard(),
    dragging: null,
    hoveredCardId: null,
  };
}
