import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  createInitialCards,
  createEmptyBoard,
  DECK_SIZE,
  SLOT_IDS,
} from './cardData';

describe('P2-S01 initial state', () => {
  it('creates 12 cards, 4 each of A/B/C', () => {
    const { cardsById, deck } = createInitialCards();
    expect(deck).toHaveLength(DECK_SIZE);
    expect(DECK_SIZE).toBe(12);
    const counts = { A: 0, B: 0, C: 0 } as Record<string, number>;
    for (const id of deck) counts[cardsById[id].type]++;
    expect(counts).toEqual({ A: 4, B: 4, C: 4 });
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

  it('gives every card a full combat profile', () => {
    const { cardsById } = createInitialCards();
    const cards = Object.values(cardsById);
    expect(cards).toHaveLength(12);
    const names = new Set<string>();
    for (const c of cards) {
      expect(c.name.length).toBeGreaterThan(0);
      names.add(c.name);
      expect(c.cost).toBeGreaterThan(0);
      expect(c.atk).toBeGreaterThanOrEqual(0);
      expect(c.def).toBeGreaterThanOrEqual(0);
      expect(['Common', 'Rare', 'Epic', 'Legendary']).toContain(c.rarity);
      expect(c.effect.length).toBeGreaterThan(0);
      expect(c.flavor.length).toBeGreaterThan(0);
    }
    // Names are unique across the deck.
    expect(names.size).toBe(12);
  });
});
