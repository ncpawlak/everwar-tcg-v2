import { describe, it, expect } from 'vitest';
import { createGameStore } from './gameStore';
import { createInitialState } from './cardData';

describe('P1-S02/S08 game store actions', () => {
  it('drawCard moves the top deck card into the hand', () => {
    const store = createGameStore();
    const topId = store.getState().deck.at(-1)!;
    store.getState().drawCard();
    const s = store.getState();
    expect(s.deck).toHaveLength(9);
    expect(s.hand).toEqual([topId]);
  });

  it('drawCard is a no-op on an empty deck', () => {
    const store = createGameStore({
      ...createInitialState(),
      deck: [],
    });
    store.getState().drawCard();
    expect(store.getState().hand).toEqual([]);
  });

  it('draws in top-of-deck order across multiple draws', () => {
    const store = createGameStore();
    const deck = [...store.getState().deck];
    store.getState().drawCard();
    store.getState().drawCard();
    expect(store.getState().hand).toEqual([deck[9], deck[8]]);
  });

  it('beginDrag only works for a card in hand and when not already dragging', () => {
    const store = createGameStore();
    store.getState().drawCard();
    const cardId = store.getState().hand[0];

    store.getState().beginDrag('card-1'); // not in hand
    expect(store.getState().dragging).toBeNull();

    store.getState().beginDrag(cardId);
    expect(store.getState().dragging?.cardId).toBe(cardId);

    // second beginDrag ignored while dragging
    store.getState().beginDrag(cardId);
    expect(store.getState().dragging?.cardId).toBe(cardId);
  });

  it('dropCard on an empty slot moves the card hand -> board', () => {
    const store = createGameStore();
    store.getState().drawCard();
    const cardId = store.getState().hand[0];
    store.getState().beginDrag(cardId);
    store.getState().dropCard(cardId, 'slotB');

    const s = store.getState();
    expect(s.board.slotB).toBe(cardId);
    expect(s.hand).not.toContain(cardId);
    expect(s.dragging).toBeNull();
  });

  it('dropCard on a filled slot returns the card to the hand', () => {
    const store = createGameStore();
    store.getState().drawCard();
    store.getState().drawCard();
    const [first, second] = store.getState().hand;

    store.getState().beginDrag(first);
    store.getState().dropCard(first, 'slotA');

    store.getState().beginDrag(second);
    store.getState().dropCard(second, 'slotA'); // occupied

    const s = store.getState();
    expect(s.board.slotA).toBe(first);
    expect(s.hand).toContain(second);
    expect(s.dragging).toBeNull();
  });

  it('dropCard with no slot returns the card to the hand in its original order', () => {
    const store = createGameStore();
    store.getState().drawCard();
    store.getState().drawCard();
    const handBefore = [...store.getState().hand];
    const target = handBefore[0];

    store.getState().beginDrag(target);
    store.getState().dropCard(target, null);

    expect(store.getState().hand).toEqual(handBefore);
    expect(store.getState().dragging).toBeNull();
  });

  it('updateDrag and hoverSlot record drag details', () => {
    const store = createGameStore();
    store.getState().drawCard();
    const cardId = store.getState().hand[0];
    store.getState().beginDrag(cardId);
    store.getState().updateDrag([1, 0, 2]);
    store.getState().hoverSlot('slotC');

    const d = store.getState().dragging!;
    expect(d.projectedPoint).toEqual([1, 0, 2]);
    expect(d.hoveredSlotId).toBe('slotC');
  });

  it('returnToHand cancels the drag without moving the card', () => {
    const store = createGameStore();
    store.getState().drawCard();
    const cardId = store.getState().hand[0];
    store.getState().beginDrag(cardId);
    store.getState().returnToHand(cardId);

    expect(store.getState().dragging).toBeNull();
    expect(store.getState().hand).toContain(cardId);
  });

  it('hoverCard raises a hand card and clears with null', () => {
    const store = createGameStore();
    store.getState().drawCard();
    const cardId = store.getState().hand[0];

    store.getState().hoverCard(cardId);
    expect(store.getState().hoveredCardId).toBe(cardId);

    store.getState().hoverCard(null);
    expect(store.getState().hoveredCardId).toBeNull();
  });

  it('hoverCard ignores cards not in hand and clears hover while dragging', () => {
    const store = createGameStore();
    store.getState().drawCard();
    const cardId = store.getState().hand[0];

    // A card that isn't in the hand cannot be hovered.
    store.getState().hoverCard('card-1');
    expect(store.getState().hoveredCardId).toBeNull();

    // Starting a drag clears any hover, and hover is refused mid-drag.
    store.getState().hoverCard(cardId);
    store.getState().beginDrag(cardId);
    expect(store.getState().hoveredCardId).toBeNull();
    store.getState().hoverCard(cardId);
    expect(store.getState().hoveredCardId).toBeNull();
  });
});
