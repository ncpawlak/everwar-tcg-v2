import { describe, it, expect, vi } from 'vitest';
import { createGameStore, SUMMON_SHOWCASE_MS, DICE_ROLL_MS, DICE_HOLD_MS, OUTCOME_POPUP_MS, GRAVEYARD_TRAVEL_MS, RESOLUTION_ROLL_DELAY_MS, SHUFFLE_SPREAD_MS, END_PHASE_DWELL_MS, OPP_PHASE_STEP_MS } from './gameStore';
import { MULTI_DRAW_STAGGER_MS } from '../animation/motionConfig';
import { createInitialState, DECK_SIZE } from './cardData';
import type { GameState } from './types';

/** Build a store with a deterministic hand (cards removed from the deck). */
function storeWithHand(hand: GameState['cardsById'][string]['id'][]) {
  const base = createInitialState();
  return createGameStore({
    ...base,
    hand: [...hand],
    deck: base.deck.filter((id) => !hand.includes(id)),
    // Cards can only be set during Main; put drop tests in the Main phase.
    phase: 'main',
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

  it('dropCard blocks a C card when its linked A slot is empty', () => {
    const store = storeWithHand(['card-C1']);
    store.getState().beginDrag('card-C1');
    store.getState().dropCard('card-C1', 'C1'); // A1 is empty -> illegal

    const s = store.getState();
    expect(s.board.C1).toBeNull();
    expect(s.hand).toContain('card-C1');
    expect(s.dragging).toBeNull();
  });

  it('dropCard sets a C card on its linked A column and rolls a stat buff', () => {
    const store = storeWithHand(['card-A1', 'card-C1']);
    store.getState().beginDrag('card-A1');
    store.getState().dropCard('card-A1', 'A1');

    store.getState().beginDrag('card-C1');
    store.getState().dropCard('card-C1', 'C1'); // now legal: A1 occupied

    const s = store.getState();
    expect(s.board.C1).toBe('card-C1');
    const buff = s.cardsById['card-C1'].buff;
    expect(buff).toBeDefined();
    expect(['hp', 'dmg', 'acc']).toContain(buff!.stat);
    expect(buff!.amount).toBeGreaterThan(0);
  });

  it('dropCard starts a summon reveal that clears after the showcase window', () => {
    vi.useFakeTimers();
    const store = storeWithHand(['card-A1']);
    store.getState().beginDrag('card-A1');
    store.getState().dropCard('card-A1', 'A2');

    // Card is placed immediately, and the transient summon points at it.
    expect(store.getState().board.A2).toBe('card-A1');
    expect(store.getState().summon).toEqual({ cardId: 'card-A1', slotId: 'A2' });

    vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
    expect(store.getState().summon).toBeNull();
    vi.useRealTimers();
  });

  it('an invalid drop does not start a summon reveal', () => {
    const store = storeWithHand(['card-A1']);
    store.getState().beginDrag('card-A1');
    store.getState().dropCard('card-A1', 'B1'); // wrong type
    expect(store.getState().summon).toBeNull();
  });

  it('a level-3 A card cannot be dropped with no materials (stays in hand, no prompt)', () => {
    // card-A4 (Warcry) is level 3; nothing on the board to tribute.
    const store = storeWithHand(['card-A4']);
    store.getState().beginDrag('card-A4');
    store.getState().dropCard('card-A4', 'A2');
    const s = store.getState();
    expect(s.board.A2).toBeNull();
    expect(s.hand).toContain('card-A4');
    expect(s.pendingTribute).toBeNull();
    expect(s.dragging).toBeNull();
  });

  it('dropping a level-3 A card with valid materials opens the tribute prompt (card held in hand)', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-A4'], // level 3
      deck: base.deck.filter((id) => !['card-A4', 'card-A3', 'card-A1'].includes(id)),
      // card-A3 = level 1, card-A1 = level 2 → sum 3.
      board: { ...base.board, A1: 'card-A3', A2: 'card-A1' },
      phase: 'main',
    });
    store.getState().beginDrag('card-A4');
    store.getState().dropCard('card-A4', 'A3'); // empty A slot
    const s = store.getState();
    expect(s.pendingTribute).toEqual({ cardId: 'card-A4', slotId: 'A3' });
    expect(s.hand).toContain('card-A4'); // still in hand until confirmed
    expect(s.dragging).toBeNull();
  });

  it('confirming a tribute sends materials (and linked C) to replen and sets the card', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-A4'],
      deck: base.deck.filter(
        (id) => !['card-A4', 'card-A3', 'card-A1', 'card-C1'].includes(id),
      ),
      board: { ...base.board, A1: 'card-A3', A2: 'card-A1', C1: 'card-C1' },
      phase: 'main',
    });
    store.getState().beginDrag('card-A4');
    store.getState().dropCard('card-A4', 'A3');
    store.getState().confirmTributeSummon(['A1', 'A2']); // levels 1 + 2 = 3

    const s = store.getState();
    expect(s.board.A3).toBe('card-A4'); // summoned into the target slot
    expect(s.board.A1).toBeNull();
    expect(s.board.A2).toBeNull();
    expect(s.board.C1).toBeNull(); // linked C tributed too
    expect(s.replen).toEqual(expect.arrayContaining(['card-A3', 'card-A1', 'card-C1']));
    expect(s.hand).not.toContain('card-A4');
    expect(s.pendingTribute).toBeNull();
  });

  it('confirming a COMMANDER tribute sends materials (and linked C) to the graveyard', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-A5'], // A5 = Commander (level 3)
      deck: base.deck.filter(
        (id) => !['card-A5', 'card-A3', 'card-A1', 'card-C1'].includes(id),
      ),
      board: { ...base.board, A1: 'card-A3', A2: 'card-A1', C1: 'card-C1' },
      phase: 'main',
    });
    store.getState().beginDrag('card-A5');
    store.getState().dropCard('card-A5', 'A3');
    store.getState().confirmTributeSummon(['A1', 'A2']); // levels 1 + 2 = 3

    const s = store.getState();
    expect(s.board.A3).toBe('card-A5'); // commander summoned
    expect(s.board.A1).toBeNull();
    expect(s.board.A2).toBeNull();
    expect(s.board.C1).toBeNull();
    // Commander materials go to the graveyard, NOT the replen.
    expect(s.graveyard).toEqual(
      expect.arrayContaining(['card-A3', 'card-A1', 'card-C1']),
    );
    expect(s.replen).not.toEqual(expect.arrayContaining(['card-A3']));
    expect(s.pendingTribute).toBeNull();
  });

  it('confirming with materials that do not sum to the level is a no-op', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-A4'],
      deck: base.deck.filter((id) => !['card-A4', 'card-A3', 'card-A1'].includes(id)),
      board: { ...base.board, A1: 'card-A3', A2: 'card-A1' },
      phase: 'main',
    });
    store.getState().beginDrag('card-A4');
    store.getState().dropCard('card-A4', 'A3');
    store.getState().confirmTributeSummon(['A2']); // level 2 ≠ 3

    const s = store.getState();
    expect(s.board.A3).toBeNull();
    expect(s.board.A2).toBe('card-A1'); // material untouched
    expect(s.pendingTribute).not.toBeNull(); // prompt still open
  });

  it('cancelTributeSummon clears the prompt and leaves the card in hand', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-A4'],
      deck: base.deck.filter((id) => !['card-A4', 'card-A3', 'card-A1'].includes(id)),
      board: { ...base.board, A1: 'card-A3', A2: 'card-A1' },
      phase: 'main',
    });
    store.getState().beginDrag('card-A4');
    store.getState().dropCard('card-A4', 'A3');
    store.getState().cancelTributeSummon();

    const s = store.getState();
    expect(s.pendingTribute).toBeNull();
    expect(s.hand).toContain('card-A4');
    expect(s.board.A3).toBeNull();
  });

  it('setting a B card enacts its ability after the showcase (draw 1 / draw 2)', () => {
    vi.useFakeTimers();
    const draw1 = storeWithHand(['card-B1']); // B1 = draw1
    draw1.getState().beginDrag('card-B1');
    draw1.getState().dropCard('card-B1', 'B1');
    expect(draw1.getState().hand).toHaveLength(0); // B card left the hand
    vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
    expect(draw1.getState().hand).toHaveLength(1); // drew 1

    const draw2 = storeWithHand(['card-B4']); // B4 = draw2
    draw2.getState().beginDrag('card-B4');
    draw2.getState().dropCard('card-B4', 'B4');
    vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
    expect(draw2.getState().hand).toHaveLength(1); // first card off the deck
    vi.advanceTimersByTime(MULTI_DRAW_STAGGER_MS);
    expect(draw2.getState().hand).toHaveLength(2); // second follows after the stagger
    vi.useRealTimers();
  });

  it('setting a B card routes the graveyard into the replen pile after the showcase', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-B2'], // B2 = graveyardIntoDeck (now graveyard -> replen)
      deck: base.deck.filter((id) => id !== 'card-B2' && id !== 'card-A3'),
      graveyard: ['card-A3'],
      phase: 'main',
    });
    store.getState().beginDrag('card-B2');
    store.getState().dropCard('card-B2', 'B2');
    vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
    expect(store.getState().graveyard).toHaveLength(0);
    // "Shuffle into deck" routes through replen, not the deck itself.
    expect(store.getState().replen).toContain('card-A3');
    expect(store.getState().deck).not.toContain('card-A3');
    vi.useRealTimers();
  });

  it('dropCard with no slot returns the card to the hand in its original order', () => {
    const store = storeWithHand(['card-A1', 'card-B1']);
    const handBefore = [...store.getState().hand];

    store.getState().beginDrag('card-A1');
    store.getState().dropCard('card-A1', null);

    expect(store.getState().hand).toEqual(handBefore);
    expect(store.getState().dragging).toBeNull();
  });

  it('autoPlaceCard quick-sets a hand card into the first legal slot', () => {
    const store = storeWithHand(['card-A1']);
    store.getState().autoPlaceCard('card-A1');
    const s = store.getState();
    // A cards fill A1 first (board order).
    expect(s.board.A1).toBe('card-A1');
    expect(s.hand).not.toContain('card-A1');
  });

  it('autoPlaceCard fills the NEXT free slot when earlier ones are taken', () => {
    const store = storeWithHand(['card-A1', 'card-A2']);
    store.getState().autoPlaceCard('card-A1'); // -> A1
    store.getState().autoPlaceCard('card-A2'); // -> A2 (A1 now taken)
    const s = store.getState();
    expect(s.board.A1).toBe('card-A1');
    expect(s.board.A2).toBe('card-A2');
  });

  it('autoPlaceCard does nothing when the card has no legal slot (C with no A)', () => {
    const store = storeWithHand(['card-C1']);
    const handBefore = [...store.getState().hand];
    store.getState().autoPlaceCard('card-C1'); // no A card on field -> illegal
    expect(store.getState().hand).toEqual(handBefore);
    expect(Object.values(store.getState().board).every((v) => v !== 'card-C1')).toBe(true);
  });

  it('autoPlaceCard is blocked outside the Main phase', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-A1'],
      deck: base.deck.filter((id) => id !== 'card-A1'),
      phase: 'battle',
    });
    store.getState().autoPlaceCard('card-A1');
    expect(store.getState().hand).toContain('card-A1');
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

  it('selects a card that is in a pile (deck/graveyard/replen), e.g. via pile search', () => {
    const store = createGameStore();
    // card-B1 is still in the deck; pile search lets it be inspected.
    const deckCard = store.getState().deck[0];
    store.getState().selectCard(deckCard);
    expect(store.getState().selectedCardId).toBe(deckCard);
  });

  it('ignores a card id that does not exist', () => {
    const store = storeWithHand(['card-A1']);
    store.getState().selectCard('card-does-not-exist');
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

describe('P3-S04 replen (send cards to the replenish pile)', () => {
  it('replenZoneA sends the A card and its linked C card to replen and clears the slots', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, A4: 'card-A4', C4: 'card-C4' },
    });
    store.getState().replenZoneA();
    const s = store.getState();
    expect(s.board.A4).toBeNull();
    expect(s.board.C4).toBeNull();
    expect(s.replen).toContain('card-A4');
    expect(s.replen).toContain('card-C4');
    expect(s.replen).toHaveLength(2);
    // Nothing went to the graveyard.
    expect(s.graveyard).toEqual([]);
  });

  it('replenZoneA is a no-op when no Zone A slot is occupied', () => {
    const store = createGameStore(createInitialState());
    store.getState().replenZoneA();
    expect(store.getState().replen).toEqual([]);
  });

  it('disturbDeck sends the top card of the deck to replen', () => {
    const store = createGameStore();
    const startLen = store.getState().deck.length;
    const topId = store.getState().deck.at(-1)!;
    store.getState().disturbDeck();
    const s = store.getState();
    expect(s.deck).toHaveLength(startLen - 1);
    expect(s.deck).not.toContain(topId);
    expect(s.replen).toEqual([topId]);
  });

  it('disturbDeck is a no-op on an empty deck', () => {
    const store = createGameStore({ ...createInitialState(), deck: [] });
    store.getState().disturbDeck();
    expect(store.getState().replen).toEqual([]);
  });
});

describe('P3-S05 shuffle (animated deck reshuffle)', () => {
  it('shuffleDeck spreads immediately then collapses to a permutation', () => {
    vi.useFakeTimers();
    try {
      const store = createGameStore();
      const before = [...store.getState().deck];

      store.getState().shuffleDeck();
      // Spread phase is active right away.
      expect(store.getState().deckSpread).toBe(true);

      vi.runAllTimers();
      const after = store.getState().deck;
      expect(store.getState().deckSpread).toBe(false);
      expect(after).toHaveLength(before.length);
      expect([...after].sort()).toEqual([...before].sort());
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a second shuffle while one is already running', () => {
    vi.useFakeTimers();
    try {
      const store = createGameStore();
      store.getState().shuffleDeck();
      expect(store.getState().deckSpread).toBe(true);
      // Second call is a no-op (does not throw, stays spreading).
      store.getState().shuffleDeck();
      expect(store.getState().deckSpread).toBe(true);
      vi.runAllTimers();
      expect(store.getState().deckSpread).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('replenIntoDeck folds the replen pile into the deck then shuffles', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      const store = createGameStore({ ...base, replen: ['card-A1', 'card-B1'] });
      const deckLen = store.getState().deck.length;

      store.getState().replenIntoDeck();
      // Cards moved synchronously; replen emptied; spread begins.
      expect(store.getState().replen).toEqual([]);
      expect(store.getState().deck).toHaveLength(deckLen + 2);
      expect(store.getState().deck).toContain('card-A1');
      expect(store.getState().deckSpread).toBe(true);

      vi.runAllTimers();
      expect(store.getState().deckSpread).toBe(false);
      expect(store.getState().deck).toHaveLength(deckLen + 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('graveyardIntoDeck routes the graveyard into the replen pile (shuffled)', () => {
    const base = createInitialState();
    const store = createGameStore({ ...base, graveyard: ['card-C1'] });
    const replenLen = store.getState().replen.length;
    const deckLen = store.getState().deck.length;

    store.getState().graveyardIntoDeck();
    expect(store.getState().graveyard).toEqual([]);
    // Routes through replen, not the deck itself; replen folds into the deck at End.
    expect(store.getState().replen).toContain('card-C1');
    expect(store.getState().replen).toHaveLength(replenLen + 1);
    expect(store.getState().deck).toHaveLength(deckLen);
  });

  it('handIntoDeck returns the hand to the deck (clearing hover) then shuffles', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        hand: ['card-A1', 'card-A2'],
        deck: base.deck.filter((id) => id !== 'card-A1' && id !== 'card-A2'),
        hoveredCardId: 'card-A1',
      });
      const deckLen = store.getState().deck.length;

      store.getState().handIntoDeck();
      expect(store.getState().hand).toEqual([]);
      expect(store.getState().hoveredCardId).toBeNull();
      expect(store.getState().deck).toHaveLength(deckLen + 2);
      expect(store.getState().deck).toContain('card-A1');

      vi.runAllTimers();
      expect(store.getState().deckSpread).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('pile-search pop-up state', () => {
  it('openPileSearch opens a pile and closePileSearch clears it', () => {
      const store = createGameStore();
      expect(store.getState().pileSearch).toBeNull();
      store.getState().openPileSearch('graveyard');
      expect(store.getState().pileSearch).toBe('graveyard');
      store.getState().openPileSearch('replen');
      expect(store.getState().pileSearch).toBe('replen');
      store.getState().closePileSearch();
      expect(store.getState().pileSearch).toBeNull();
  });
});

describe('P4 turn / phase mechanics', () => {
  it('beginDrawPhase draws up to the hand target then auto-advances to Main', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      // Start with 5 in hand (like the opening deal), draw phase should top to 6.
      const hand = base.deck.slice(-5);
      const store = createGameStore({
        ...base,
        hand: [...hand],
        deck: base.deck.slice(0, -5),
      });

      store.getState().beginDrawPhase();
      expect(store.getState().phase).toBe('draw');
      expect(store.getState().phaseAnnounce).toBe(1);
      expect(store.getState().hand).toHaveLength(6);

      // After the dwell it auto-advances to Main.
      vi.runAllTimers();
      expect(store.getState().phase).toBe('main');
      expect(store.getState().phaseAnnounce).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Draw phase draws exactly 1 when the hand is already at or above the target', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      const hand = base.deck.slice(-6);
      const store = createGameStore({
        ...base,
        hand: [...hand],
        deck: base.deck.slice(0, -6),
      });

      store.getState().beginDrawPhase();
      expect(store.getState().hand).toHaveLength(7);
      vi.runAllTimers();
      expect(store.getState().phase).toBe('main');
    } finally {
      vi.useRealTimers();
    }
  });

  it('phases auto-advance Main -> Battle -> Resolution -> End, and End auto-hands off to the opponent', () => {
    vi.useFakeTimers();
    try {
      const store = createGameStore({ ...createInitialState(), phase: 'main' });

      store.getState().advancePhase();
      expect(store.getState().phase).toBe('battle');

      store.getState().advancePhase(); // battle -> resolution
      expect(store.getState().phase).toBe('resolution');

      // With no attackers, Resolution auto-advances to End after a short beat.
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS + 400);
      expect(store.getState().phase).toBe('end');
      expect(store.getState().activePlayer).toBe('player');

      const turnBefore = store.getState().turn;
      // End auto-advances after its dwell, handing control to the opponent.
      vi.advanceTimersByTime(END_PHASE_DWELL_MS);
      expect(store.getState().activePlayer).toBe('opponent');
      expect(store.getState().turn).toBe(turnBefore + 1);
      expect(store.getState().phase).toBe('draw');
    } finally {
      vi.useRealTimers();
    }
  });

  it('the opponent auto-plays a full turn then hands control back to the player', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      const store = createGameStore({ ...base, phase: 'end', activePlayer: 'player' });
      const turnBefore = store.getState().turn;

      store.getState().advancePhase(); // end -> opponent turn
      expect(store.getState().activePlayer).toBe('opponent');
      expect(store.getState().turn).toBe(turnBefore + 1);

      // Player input is ignored while the opponent is playing.
      store.getState().advancePhase();
      expect(store.getState().activePlayer).toBe('opponent');

      // Let the opponent step through all five phases and hand back.
      vi.runAllTimers();
      expect(store.getState().activePlayer).toBe('player');
      expect(store.getState().turn).toBe(turnBefore + 2);
      // The player's Draw auto-advances to Main once control returns.
      expect(store.getState().phase).toBe('main');
    } finally {
      vi.useRealTimers();
    }
  });

  it('advancePhase is a no-op during the Draw phase (Draw auto-advances)', () => {
    const store = createGameStore({ ...createInitialState(), phase: 'draw' });
    store.getState().advancePhase();
    expect(store.getState().phase).toBe('draw');
  });

  it('End phase discards non-continuous B cards and keeps continuous ones', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        board: {
          ...base.board,
          B1: 'card-B1', // not continuous
          B3: 'card-B3', // continuous
        },
      });

      store.getState().advancePhase(); // battle -> resolution
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS + 400); // -> end (runEndPhase), before hand-off
      const s = store.getState();
      expect(s.phase).toBe('end');
      expect(s.board.B1).toBeNull();
      expect(s.graveyard).toContain('card-B1');
      expect(s.board.B3).toBe('card-B3');
      expect(s.graveyard).not.toContain('card-B3');
    } finally {
      vi.useRealTimers();
    }
  });

  it('End phase shuffles the replen pile back into the deck', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        replen: ['card-A1'],
      });
      const deckLen = store.getState().deck.length;

      store.getState().advancePhase(); // battle -> resolution
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS + SHUFFLE_SPREAD_MS + 400); // -> end, replen folds in + shuffle completes (before hand-off)
      expect(store.getState().replen).toEqual([]);
      expect(store.getState().deck).toContain('card-A1');
      expect(store.getState().deck).toHaveLength(deckLen + 1);
      expect(store.getState().deckSpread).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('End phase does NOT shuffle the deck when the replen pile is empty', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        replen: [],
      });
      const deckBefore = [...store.getState().deck];

      store.getState().advancePhase(); // battle -> resolution
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS + 400); // -> end (runEndPhase); no replen, so no shuffle (before hand-off)
      // Deck order is untouched — no needless shuffle fired.
      expect(store.getState().deck).toEqual(deckBefore);
      expect(store.getState().deckSpread).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('dropCard is blocked outside the Main phase', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-A1'],
      deck: base.deck.filter((id) => id !== 'card-A1'),
      phase: 'battle',
    });
    store.getState().beginDrag('card-A1');
    store.getState().dropCard('card-A1', 'A1');
    expect(store.getState().board.A1).toBeNull();
    expect(store.getState().hand).toContain('card-A1');
    expect(store.getState().dragging).toBeNull();
  });

  it('aimAttack begins targeting and assignTarget commits an opponent target during Battle', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      phase: 'battle',
      board: { ...base.board, A1: 'card-A1' },
    });

    store.getState().aimAttack('A1');
    expect(store.getState().targeting).toBe('A1');

    store.getState().assignTarget('O1');
    expect(store.getState().targeting).toBeNull();
    expect(store.getState().attackTargets).toEqual({ A1: 'O1' });

    // Re-aiming the same source drops its old target until a new one is picked.
    store.getState().aimAttack('A1');
    expect(store.getState().targeting).toBe('A1');
    expect(store.getState().attackTargets).toEqual({});

    // Clicking the aiming source again cancels the aim.
    store.getState().aimAttack('A1');
    expect(store.getState().targeting).toBeNull();
  });

  it('aimAttack/assignTarget ignore empty A-slots, non-A slots, empty opponents, and non-Battle', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      phase: 'battle',
      board: { ...base.board, A1: 'card-A1', B1: 'card-B1' },
    });

    store.getState().aimAttack('A2'); // empty A-slot
    store.getState().aimAttack('B1'); // non-A slot
    expect(store.getState().targeting).toBeNull();

    store.getState().aimAttack('A1');
    store.getState().assignTarget('O4'); // O4 is empty in the initial seed
    expect(store.getState().attackTargets).toEqual({});
    expect(store.getState().targeting).toBe('A1'); // still aiming, no target set

    const mainStore = createGameStore({
      ...base,
      phase: 'main',
      board: { ...base.board, A1: 'card-A1' },
    });
    mainStore.getState().aimAttack('A1'); // not Battle
    expect(mainStore.getState().targeting).toBeNull();
  });

  it('Resolution rolls a die per attacker, drains the targeted opponent, then advances to End', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        board: { ...base.board, A1: 'card-A1', A2: 'card-A2' },
        // Both attackers aim at the same opponent; their damage stacks onto O1.
        attackTargets: { A1: 'O1', A2: 'O1' },
      });

      store.getState().advancePhase(); // battle -> resolution
      expect(store.getState().phase).toBe('resolution');
      // Dice wait for the phase banner to clear before they start tumbling.
      expect(store.getState().resolutionRolls).toEqual({});

      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS);
      const rolls = store.getState().resolutionRolls;
      expect(Object.keys(rolls).sort()).toEqual(['A1', 'A2']);
      for (const slot of ['A1', 'A2']) {
        expect(rolls[slot].rolling).toBe(true);
        expect(rolls[slot].value).toBeGreaterThanOrEqual(1);
        expect(rolls[slot].value).toBeLessThanOrEqual(20);
        expect(store.getState().lastRolls[slot]).toBe(rolls[slot].value);
      }

      vi.advanceTimersByTime(DICE_ROLL_MS);
      expect(store.getState().resolutionRolls.A1.rolling).toBe(false);

      // Dice settle-hold, then the outcome pop-up snapshots. We STAY in Resolution
      // while the die values + pop-up linger, so the End banner can't collide.
      vi.advanceTimersByTime(DICE_HOLD_MS);
      expect(store.getState().phase).toBe('resolution');
      expect(Object.keys(store.getState().outcomePopups).sort()).toEqual(['A1', 'A2']);
      for (const slot of ['A1', 'A2'] as const) {
        expect(['glancing', 'normal', 'miss', 'crit']).toContain(
          store.getState().outcomePopups[slot].outcome,
        );
      }

      // Both attackers targeted O1: its HP drops by their combined damage and a
      // single red -total pop-up appears over the opponent.
      const s = store.getState();
      const totalDmg =
        (s.outcomePopups['A1'].damage ?? 0) + (s.outcomePopups['A2'].damage ?? 0);
      const oppId = createInitialState().opponentBoard.O1!;
      const maxHp = createInitialState().opponentCards[oppId].hp!;
      if (totalDmg > 0) {
        expect(s.currentHp[oppId]).toBe(Math.max(0, maxHp - totalDmg));
        expect(s.damagePopups.O1).toBe(totalDmg);
      } else {
        expect(s.currentHp[oppId]).toBeUndefined();
        expect(s.damagePopups).toEqual({});
      }

      // After the dwell the dice + pop-ups clear together...
      vi.advanceTimersByTime(OUTCOME_POPUP_MS);
      expect(store.getState().outcomePopups).toEqual({});
      expect(store.getState().resolutionRolls).toEqual({});
      expect(store.getState().damagePopups).toEqual({});
      // ...then it advances to End (held briefly for the slash travel if the
      // opponent was destroyed this Resolution).
      vi.advanceTimersByTime(GRAVEYARD_TRAVEL_MS);
      expect(store.getState().phase).toBe('end');

      // Attack declaration + spent dice are cleared entering End; values persist.
      expect(store.getState().attackTargets).toEqual({});
      expect(store.getState().resolutionRolls).toEqual({});
      expect(Object.keys(store.getState().lastRolls).sort()).toEqual(['A1', 'A2']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Resolution with no attackers rolls nothing and still advances to End', () => {
    vi.useFakeTimers();
    try {
      const store = createGameStore({ ...createInitialState(), phase: 'battle' });
      store.getState().advancePhase(); // -> resolution
      expect(store.getState().resolutionRolls).toEqual({});
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS + 400); // -> end (before hand-off)
      expect(store.getState().phase).toBe('end');
    } finally {
      vi.useRealTimers();
    }
  });

  it('an opponent reduced to 0 HP is slashed, then removed from the field', () => {
    vi.useFakeTimers();
    // Force a mid-range roll (11) so the attack is a normal hit, not a miss.
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const base = createInitialState();
      const oppId = base.opponentBoard.O1!;
      const store = createGameStore({
        ...base,
        phase: 'battle',
        board: { ...base.board, A1: 'card-A1' },
        attackTargets: { A1: 'O1' },
        // O1 is dropped to 1 HP, so any hit is lethal.
        currentHp: { [oppId]: 1 },
      });

      store.getState().advancePhase(); // battle -> resolution
      // Advance through roll + settle + damage apply (banner 1700 + roll 800 +
      // hold 600 = 3100ms): the doomed opponent is now flagged for the slash FX.
      vi.advanceTimersByTime(3100);
      expect(store.getState().destroying).toContain('O1');

      vi.advanceTimersByTime(OUTCOME_POPUP_MS + GRAVEYARD_TRAVEL_MS + 50); // dwell, remove, -> End (before hand-off)

      const s = store.getState();
      expect(s.phase).toBe('end');
      // The dead opponent leaves its slot and travels into the opponent
      // graveyard (mirror of the player's death → graveyard), so its HP entry
      // is cleared but it persists in state for the travel animation.
      expect(s.opponentBoard.O1).toBeNull();
      expect(s.opponentGraveyard).toContain(oppId);
      expect(s.currentHp[oppId]).toBeUndefined();
      // ...and the slash-FX flag clears once the card actually leaves.
      expect(s.destroying).toEqual([]);
    } finally {
      rand.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe('P7-S3 opponent-as-attacker combat (bidirectional)', () => {
  it('the opponent strikes a player A-card on its turn and sends a doomed one to the player graveyard', () => {
    vi.useFakeTimers();
    // random() = 0 -> every D20 rolls a 1 (glancing), so every opponent attack
    // deals half-DMG > 0 and is a guaranteed hit.
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        activePlayer: 'player',
        // A lone player Vanguard on 1 HP: any opponent hit is lethal.
        board: { ...base.board, A1: 'card-A1', C1: 'card-C1' },
        currentHp: { 'card-A1': 1 },
      });

      // Player has no attackers: Battle -> Resolution flows straight to End...
      store.getState().advancePhase();
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS + 400);
      expect(store.getState().phase).toBe('end');
      expect(store.getState().activePlayer).toBe('player');

      // ...then the End dwell hands off to the opponent's auto-turn.
      vi.advanceTimersByTime(END_PHASE_DWELL_MS + 20);
      expect(store.getState().activePlayer).toBe('opponent');

      // Step through draw -> main -> battle (attacks declared) -> resolution.
      vi.advanceTimersByTime(OPP_PHASE_STEP_MS * 3 + 20);
      expect(store.getState().phase).toBe('resolution');
      // The opponent aimed its same-column Vanguard (O1) at the player's A1.
      expect(store.getState().oppAttackTargets.O1).toBe('A1');

      // Run the opponent Resolution timeline: roll -> settle -> apply -> remove.
      vi.advanceTimersByTime(
        RESOLUTION_ROLL_DELAY_MS + DICE_ROLL_MS + DICE_HOLD_MS + OUTCOME_POPUP_MS + GRAVEYARD_TRAVEL_MS + 60,
      );

      const s = store.getState();
      // The player's card took lethal damage and was sent to the PLAYER graveyard.
      expect(s.board.A1).toBeNull();
      expect(s.graveyard).toContain('card-A1');
      // ...and its linked C-card (same column) fell with it.
      expect(s.board.C1).toBeNull();
      expect(s.graveyard).toContain('card-C1');
      expect(s.currentHp['card-A1']).toBeUndefined();
      expect(s.oppDestroying).toEqual([]);

      // Control returns to the player after the opponent's End dwell.
      vi.advanceTimersByTime(END_PHASE_DWELL_MS + 20);
      expect(store.getState().activePlayer).toBe('player');
    } finally {
      rand.mockRestore();
      vi.useRealTimers();
    }
  });

  it('the opponent makes no attacks when the player has no A-cards on the field', () => {
    vi.useFakeTimers();
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const base = createInitialState();
      const store = createGameStore({ ...base, phase: 'battle', activePlayer: 'player' });
      store.getState().advancePhase();
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS + 400);
      vi.advanceTimersByTime(END_PHASE_DWELL_MS + 20);
      expect(store.getState().activePlayer).toBe('opponent');
      vi.advanceTimersByTime(OPP_PHASE_STEP_MS * 3 + 20);
      expect(store.getState().oppAttackTargets).toEqual({});
      // With no targets, the opponent's Resolution still resolves and hands back.
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS + 400 + END_PHASE_DWELL_MS + 40);
      expect(store.getState().activePlayer).toBe('player');
    } finally {
      rand.mockRestore();
      vi.useRealTimers();
    }
  });
});
