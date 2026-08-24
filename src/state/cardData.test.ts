import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  createInitialCards,
  createEmptyBoard,
  DECK_SIZE,
  OPENING_HAND_SIZE,
  SLOT_IDS,
} from './cardData';

describe('P2-S01 initial state', () => {
  it('creates 13 cards: 5 A (incl. Commander), 4 B, 4 C', () => {
    const { cardsById, deck } = createInitialCards();
    expect(deck).toHaveLength(DECK_SIZE);
    expect(DECK_SIZE).toBe(13);
    const counts = { A: 0, B: 0, C: 0 } as Record<string, number>;
    for (const id of deck) counts[cardsById[id].type]++;
    expect(counts).toEqual({ A: 5, B: 4, C: 4 });
  });

  it('starts with a full deck, empty hand, twelve empty slots, and no drag', () => {
    const s = createInitialState();
    expect(s.deck).toHaveLength(DECK_SIZE);
    expect(s.hand).toEqual([]);
    expect(Object.keys(s.board)).toHaveLength(12);
    expect(Object.values(s.board).every((v) => v === null)).toBe(true);
    expect(s.dragging).toBeNull();
  });

  it('exposes 12 typed slot ids', () => {
    expect(SLOT_IDS).toHaveLength(12);
    expect(SLOT_IDS).toContain('A1');
    expect(SLOT_IDS).toContain('B4');
    expect(SLOT_IDS).toContain('C2');
  });

  it('creates an all-null empty board keyed by every slot id', () => {
    const board = createEmptyBoard();
    for (const id of SLOT_IDS) expect(board[id]).toBeNull();
  });

  it('interleaves types so the opening five come out mixed', () => {
    const s = createInitialState();
    // Draw the top five (last five elements) and confirm >1 distinct type.
    const top5 = s.deck.slice(-5).map((id) => s.cardsById[id].type);
    expect(new Set(top5).size).toBeGreaterThan(1);
  });

  it('P7-S1/S4: gives the opponent its own full-player state + opening hand', () => {
    const s = createInitialState();
    // Opponent draws its opening five off its own 13-card deck, so the draw
    // pile holds the remainder and the hand holds five (all opp-deck cards).
    expect(s.opponentDeck).toHaveLength(DECK_SIZE - OPENING_HAND_SIZE);
    expect(s.opponentHand).toHaveLength(OPENING_HAND_SIZE);
    const oppInPlay = [...s.opponentDeck, ...s.opponentHand];
    expect(oppInPlay.every((id) => id.startsWith('opp-deck-'))).toBe(true);
    expect(oppInPlay.every((id) => s.opponentCards[id])).toBe(true);
    // Opponent starts with an EMPTY board (Slice 4 retired the dummy seeds).
    expect(Object.values(s.opponentBoard).every((v) => v === null)).toBe(true);
    // Replen starts empty; B/C rows are all-null.
    expect(s.opponentReplen).toEqual([]);
    expect(Object.values(s.opponentBBoard).every((v) => v === null)).toBe(true);
    expect(Object.values(s.opponentCBoard).every((v) => v === null)).toBe(true);
    expect(Object.keys(s.opponentBBoard)).toHaveLength(4);
    expect(Object.keys(s.opponentCBoard)).toHaveLength(4);
  });

  it('gives every card a full type-specific profile', () => {
    const { cardsById } = createInitialCards();
    const cards = Object.values(cardsById);
    expect(cards).toHaveLength(13);
    const names = new Set<string>();
    for (const c of cards) {
      expect(c.name.length).toBeGreaterThan(0);
      names.add(c.name);
      expect(c.cost).toBeGreaterThan(0);
      // A (Vanguard) cards carry combat stats; B carry an ability; C a boost.
      if (c.type === 'A') {
        expect(c.dmg).toBeGreaterThanOrEqual(0);
        expect(c.acc).toBeGreaterThanOrEqual(0);
        expect(c.acc).toBeLessThanOrEqual(200);
        // ACC and DMG are base-10 (multiples of 10).
        expect((c.acc ?? 0) % 10).toBe(0);
        expect((c.dmg ?? 0) % 10).toBe(0);
        expect(c.hp).toBeGreaterThanOrEqual(0);
      } else if (c.type === 'B') {
        expect(c.ability).toBeDefined();
        expect(c.dmg).toBeUndefined();
      } else {
        expect(c.dmg).toBeUndefined();
      }
      expect(['Common', 'Rare', 'Epic', 'Legendary']).toContain(c.rarity);
      expect(c.effect.length).toBeGreaterThan(0);
      expect(c.flavor.length).toBeGreaterThan(0);
    }
    // Names are unique across the deck.
    expect(names.size).toBe(13);
  });
});
