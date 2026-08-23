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

describe('P3-S02 card selection (inspection)', () => {
  it('selects a card that is in the hand', () => {
    const store = storeWithHand(['card-A1']);
    store.getState().selectCard('card-A1');
    expect(store.getState().selectedCardId).toBe('card-A1');
  });

  it('selects a card that is on the board', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, C3: 'card-C1' },
    });
    store.getState().selectCard('card-C1');
    expect(store.getState().selectedCardId).toBe('card-C1');
  });

  it('ignores a card that is neither in hand nor on the board', () => {
    const store = storeWithHand(['card-A1']);
    // card-B1 is still in the deck.
    store.getState().selectCard('card-B1');
    expect(store.getState().selectedCardId).toBeNull();
  });

  it('closes the panel when passed null', () => {
    const store = storeWithHand(['card-A1']);
    store.getState().selectCard('card-A1');
    expect(store.getState().selectedCardId).toBe('card-A1');
    store.getState().selectCard(null);
    expect(store.getState().selectedCardId).toBeNull();
  });

  it('switches selection from one card to another', () => {
    const store = storeWithHand(['card-A1', 'card-B1']);
    store.getState().selectCard('card-A1');
    store.getState().selectCard('card-B1');
    expect(store.getState().selectedCardId).toBe('card-B1');
  });
});

describe('P3-S03 destroy (send occupied zone card -> graveyard)', () => {
  it('sends the A card and its linked C card to the graveyard and clears the slots', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, A2: 'card-A2', C2: 'card-C2' },
    });
    store.getState().destroyZoneA();
    const s = store.getState();
    expect(s.board.A2).toBeNull();
    expect(s.board.C2).toBeNull();
    expect(s.graveyard).toContain('card-A2');
    expect(s.graveyard).toContain('card-C2');
    expect(s.graveyard).toHaveLength(2);
  });

  it('sends only the A card when the linked C slot is empty', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, A1: 'card-A1' },
    });
    store.getState().destroyZoneA();
    const s = store.getState();
    expect(s.board.A1).toBeNull();
    expect(s.graveyard).toEqual(['card-A1']);
  });

  it('destroyZoneA is a no-op when no Zone A slot is occupied', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, C1: 'card-C1' },
    });
    store.getState().destroyZoneA();
    const s = store.getState();
    expect(s.board.C1).toBe('card-C1');
    expect(s.graveyard).toEqual([]);
  });

  it('appends to the graveyard across repeated attacks (stacking order preserved)', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, A1: 'card-A1', A2: 'card-A2' },
    });
    store.getState().destroyZoneA();
    store.getState().destroyZoneA();
    const s = store.getState();
    expect(s.graveyard).toHaveLength(2);
    expect(s.graveyard).toContain('card-A1');
    expect(s.graveyard).toContain('card-A2');
    expect(s.board.A1).toBeNull();
    expect(s.board.A2).toBeNull();
  });

  it('destroyZoneB sends the occupied B card to the graveyard (no links)', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, B3: 'card-B3', A3: 'card-A3', C3: 'card-C3' },
    });
    store.getState().destroyZoneB();
    const s = store.getState();
    expect(s.board.B3).toBeNull();
    // Zone B has no links: the A3/C3 pair is untouched.
    expect(s.board.A3).toBe('card-A3');
    expect(s.board.C3).toBe('card-C3');
    expect(s.graveyard).toEqual(['card-B3']);
  });

  it('destroyZoneB is a no-op when no Zone B slot is occupied', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, A1: 'card-A1' },
    });
    store.getState().destroyZoneB();
    const s = store.getState();
    expect(s.board.A1).toBe('card-A1');
    expect(s.graveyard).toEqual([]);
  });
});
