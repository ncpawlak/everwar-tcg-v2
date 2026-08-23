import { describe, it, expect } from 'vitest';
import { createGameStore } from './gameStore';
import { createInitialState, DECK_SIZE } from './cardData';
import type { GameState } from './types';

/** Build a store with a deterministic hand (cards removed from the deck). */
function storeWithHand(hand: GameState['cardsById'][string]['id'][]) {
  const base = createInitialState();
  return createGameStore({
    ...base,
    hand: [...hand],
    deck: base.deck.filter((id) => !hand.includes(id)),
  });
}

describe('P2-S02/S08 game store actions', () => {
  it('drawCard moves the top deck card into the hand', () => {
    const store = createGameStore();
    const topId = store.getState().deck.at(-1)!;
    store.getState().drawCard();
    const s = store.getState();
    expect(s.deck).toHaveLength(DECK_SIZE - 1);
    expect(s.hand).toEqual([topId]);
  });

  it('drawCard is a no-op on an empty deck', () => {
    const store = createGameStore({ ...createInitialState(), deck: [] });
    store.getState().drawCard();
    expect(store.getState().hand).toEqual([]);
  });

  it('draws in top-of-deck order across multiple draws', () => {
    const store = createGameStore();
    const deck = [...store.getState().deck];
    store.getState().drawCard();
    store.getState().drawCard();
    expect(store.getState().hand).toEqual([deck.at(-1), deck.at(-2)]);
  });

  it('beginDrag only works for a card in hand and when not already dragging', () => {
    const store = storeWithHand(['card-A1']);

    store.getState().beginDrag('card-B1'); // not in hand
    expect(store.getState().dragging).toBeNull();

    store.getState().beginDrag('card-A1');
    expect(store.getState().dragging?.cardId).toBe('card-A1');

    // second beginDrag ignored while dragging
    store.getState().beginDrag('card-A1');
    expect(store.getState().dragging?.cardId).toBe('card-A1');
  });

  it('dropCard on a matching empty slot moves the card hand -> board', () => {
    const store = storeWithHand(['card-A1']);
    store.getState().beginDrag('card-A1');
    store.getState().dropCard('card-A1', 'A2');

    const s = store.getState();
    expect(s.board.A2).toBe('card-A1');
    expect(s.hand).not.toContain('card-A1');
    expect(s.dragging).toBeNull();
  });

  it('dropCard on a wrong-type slot returns the card to the hand', () => {
    const store = storeWithHand(['card-A1']);
    store.getState().beginDrag('card-A1');
    store.getState().dropCard('card-A1', 'B1'); // wrong type

    const s = store.getState();
    expect(s.board.B1).toBeNull();
    expect(s.hand).toContain('card-A1');
    expect(s.dragging).toBeNull();
  });

  it('dropCard on a filled slot returns the card to the hand', () => {
    const store = storeWithHand(['card-A1', 'card-A2']);
    store.getState().beginDrag('card-A1');
    store.getState().dropCard('card-A1', 'A3');

    store.getState().beginDrag('card-A2');
    store.getState().dropCard('card-A2', 'A3'); // occupied

    const s = store.getState();
    expect(s.board.A3).toBe('card-A1');
    expect(s.hand).toContain('card-A2');
    expect(s.dragging).toBeNull();
  });

  it('dropCard with no slot returns the card to the hand in its original order', () => {
    const store = storeWithHand(['card-A1', 'card-B1']);
    const handBefore = [...store.getState().hand];

    store.getState().beginDrag('card-A1');
    store.getState().dropCard('card-A1', null);

    expect(store.getState().hand).toEqual(handBefore);
    expect(store.getState().dragging).toBeNull();
  });

  it('updateDrag and hoverSlot record drag details', () => {
    const store = storeWithHand(['card-A1']);
    store.getState().beginDrag('card-A1');
    store.getState().updateDrag([1, 0, 2]);
    store.getState().hoverSlot('C3');

    const d = store.getState().dragging!;
    expect(d.projectedPoint).toEqual([1, 0, 2]);
    expect(d.hoveredSlotId).toBe('C3');
  });

  it('returnToHand cancels the drag without moving the card', () => {
    const store = storeWithHand(['card-A1']);
    store.getState().beginDrag('card-A1');
    store.getState().returnToHand('card-A1');

    expect(store.getState().dragging).toBeNull();
    expect(store.getState().hand).toContain('card-A1');
  });

  it('hoverCard raises a hand card and clears with null', () => {
    const store = storeWithHand(['card-A1']);

    store.getState().hoverCard('card-A1');
    expect(store.getState().hoveredCardId).toBe('card-A1');

    store.getState().hoverCard(null);
    expect(store.getState().hoveredCardId).toBeNull();
  });

  it('hoverCard ignores cards not in hand and clears hover while dragging', () => {
    const store = storeWithHand(['card-A1']);

    // A card that isn't in the hand cannot be hovered.
    store.getState().hoverCard('card-B1');
    expect(store.getState().hoveredCardId).toBeNull();

    // Starting a drag clears any hover, and hover is refused mid-drag.
    store.getState().hoverCard('card-A1');
    store.getState().beginDrag('card-A1');
    expect(store.getState().hoveredCardId).toBeNull();
    store.getState().hoverCard('card-A1');
    expect(store.getState().hoveredCardId).toBeNull();
  });
});
