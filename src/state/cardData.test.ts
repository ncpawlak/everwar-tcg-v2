import { describe, it, expect } from 'vitest';
import { createInitialState, createInitialCards, DECK_SIZE } from './cardData';

describe('P1-S02 initial state', () => {
  it('creates 10 cards numbered 1..10', () => {
    const { cardsById, deck } = createInitialCards();
    expect(deck).toHaveLength(DECK_SIZE);
    const numbers = deck.map((id) => cardsById[id].number).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('starts with a full deck, empty hand, three empty slots, and no drag', () => {
    const s = createInitialState();
    expect(s.deck).toHaveLength(DECK_SIZE);
    expect(s.hand).toEqual([]);
    expect(s.board).toEqual({ slotA: null, slotB: null, slotC: null });
    expect(s.dragging).toBeNull();
  });

  it('orders the deck so the top card is the last element', () => {
    const s = createInitialState();
    const top = s.deck[s.deck.length - 1];
    expect(s.cardsById[top].number).toBe(10);
  });
});
