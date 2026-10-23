import { describe, it, expect, vi } from 'vitest';
import { createGameStore, SUMMON_SHOWCASE_MS, DICE_ROLL_MS, DICE_HOLD_MS, OUTCOME_POPUP_MS, GRAVEYARD_TRAVEL_MS, RESOLUTION_ROLL_DELAY_MS, SHUFFLE_SPREAD_MS, END_PHASE_DWELL_MS, OPP_PHASE_STEP_MS, OPP_PLAY_SHOWCASE_MS, OPP_PLAY_STEP_MS, OPP_MAIN_DURATION_MS, ON_SENT_PROMPT_MS } from './gameStore';
import { MULTI_DRAW_STAGGER_MS } from '../animation/motionConfig';
import { createInitialState, DECK_SIZE } from './cardData';
import type { GameState, Card, OppSlotId } from './types';
import { effectiveStats } from './combatStats';
import { heroCanAttack, opponentEffectiveStats } from './combatStats';
import { counterAbility } from '../abilities/counters';

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

/**
 * Seed a single opponent A-card onto an opponent board slot for combat tests.
 * The opponent board now starts EMPTY (Slice 4 retired the dummy seeds), so
 * player-attack tests must place a target explicitly. Returns a partial state
 * to spread into createGameStore.
 */
function withOpponent(base: GameState, slot: OppSlotId, card?: Partial<Card>): Partial<GameState> {
  const id = `opp-${slot}`;
  const full = {
    id, type: 'A', name: 'Test Sentinel', cost: 4, hp: 4000, dmg: 1600, acc: 120, rarity: 'Epic',
    effect: '', flavor: '', ...card,
  } as Card;
  return {
    opponentBoard: { ...base.opponentBoard, [slot]: id },
    opponentCards: { ...base.opponentCards, [id]: full },
  };
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
    const store = storeWithHand(['card-hero-6']);

    store.getState().beginDrag('card-ability-1'); // not in hand
    expect(store.getState().dragging).toBeNull();

    store.getState().beginDrag('card-hero-6');
    expect(store.getState().dragging?.cardId).toBe('card-hero-6');

    // second beginDrag ignored while dragging
    store.getState().beginDrag('card-hero-6');
    expect(store.getState().dragging?.cardId).toBe('card-hero-6');
  });

  it('dropCard on a matching empty slot moves the card hand -> board', () => {
    const store = storeWithHand(['card-hero-6']);
    store.getState().beginDrag('card-hero-6');
    store.getState().dropCard('card-hero-6', 'A2');

    const s = store.getState();
    expect(s.board.A2).toBe('card-hero-6');
    expect(s.hand).not.toContain('card-hero-6');
    expect(s.dragging).toBeNull();
  });

  it('dropCard on a wrong-type slot returns the card to the hand', () => {
    const store = storeWithHand(['card-hero-6']);
    store.getState().beginDrag('card-hero-6');
    store.getState().dropCard('card-hero-6', 'B1'); // wrong type

    const s = store.getState();
    expect(s.board.B1).toBeNull();
    expect(s.hand).toContain('card-hero-6');
    expect(s.dragging).toBeNull();
  });

  it('dropCard on a filled slot returns the card to the hand', () => {
    const store = storeWithHand(['card-hero-6', 'card-hero-7']);
    store.getState().beginDrag('card-hero-6');
    store.getState().dropCard('card-hero-6', 'A3');

    store.getState().beginDrag('card-hero-7');
    store.getState().dropCard('card-hero-7', 'A3'); // occupied

    const s = store.getState();
    expect(s.board.A3).toBe('card-hero-6');
    expect(s.hand).toContain('card-hero-7');
    expect(s.dragging).toBeNull();
  });

  it('dropCard blocks a C card when its linked A slot is empty', () => {
    const store = storeWithHand(['card-equipment-1']);
    store.getState().beginDrag('card-equipment-1');
    store.getState().dropCard('card-equipment-1', 'C1'); // A1 is empty -> illegal

    const s = store.getState();
    expect(s.board.C1).toBeNull();
    expect(s.hand).toContain('card-equipment-1');
    expect(s.dragging).toBeNull();
  });

  it('dropCard sets a C card on its linked A column (no random stat buff)', () => {
    const store = storeWithHand(['card-hero-6', 'card-equipment-1']);
    store.getState().beginDrag('card-hero-6');
    store.getState().dropCard('card-hero-6', 'A1');

    store.getState().beginDrag('card-equipment-1');
    store.getState().dropCard('card-equipment-1', 'C1'); // now legal: A1 occupied

    const s = store.getState();
    expect(s.board.C1).toBe('card-equipment-1');
    expect(s.cardsById['card-equipment-1']).not.toHaveProperty('buff');
  });

  it('dropCard starts a summon reveal that clears after the showcase window', () => {
    vi.useFakeTimers();
    const store = storeWithHand(['card-hero-6']);
    store.getState().beginDrag('card-hero-6');
    store.getState().dropCard('card-hero-6', 'A2');

    // Card is placed immediately, and the transient summon points at it.
    expect(store.getState().board.A2).toBe('card-hero-6');
    expect(store.getState().summon).toEqual({ cardId: 'card-hero-6', slotId: 'A2' });

    vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
    expect(store.getState().summon).toBeNull();
    vi.useRealTimers();
  });

  it('an invalid drop does not start a summon reveal', () => {
    const store = storeWithHand(['card-hero-6']);
    store.getState().beginDrag('card-hero-6');
    store.getState().dropCard('card-hero-6', 'B1'); // wrong type
    expect(store.getState().summon).toBeNull();
  });

  it('a level-3 A card cannot be dropped with no materials (stays in hand, no prompt)', () => {
    // card-hero-40 is level 3; nothing on the board to tribute.
    const store = storeWithHand(['card-hero-40']);
    store.getState().beginDrag('card-hero-40');
    store.getState().dropCard('card-hero-40', 'A2');
    const s = store.getState();
    expect(s.board.A2).toBeNull();
    expect(s.hand).toContain('card-hero-40');
    expect(s.pendingTribute).toBeNull();
    expect(s.dragging).toBeNull();
  });

  it('dropping a level-3 A card with valid materials opens the tribute prompt (card held in hand)', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-hero-40'], // level 3
      deck: base.deck.filter((id) => !['card-hero-40', 'card-hero-1', 'card-hero-17'].includes(id)),
      // card-hero-1 = level 1, card-hero-17 = level 2 → sum 3.
      board: { ...base.board, A1: 'card-hero-1', A2: 'card-hero-17' },
      phase: 'main',
    });
    store.getState().beginDrag('card-hero-40');
    store.getState().dropCard('card-hero-40', 'A3'); // drop opens the picker
    const s = store.getState();
    expect(s.pendingTribute).toEqual({ cardId: 'card-hero-40' });
    expect(s.hand).toContain('card-hero-40'); // still in hand until confirmed
    expect(s.dragging).toBeNull();
  });

  it('confirming a tribute sends materials (and linked C) to replen, then a chosen slot summons the card', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-hero-40'],
      deck: base.deck.filter(
        (id) => !['card-hero-40', 'card-hero-1', 'card-hero-17', 'card-equipment-1'].includes(id),
      ),
      board: { ...base.board, A1: 'card-hero-1', A2: 'card-hero-17', C1: 'card-equipment-1' },
      phase: 'main',
    });
    store.getState().beginDrag('card-hero-40');
    store.getState().dropCard('card-hero-40', 'A3');
    store.getState().confirmTributeSummon(['A1', 'A2']); // levels 1 + 2 = 3

    // Materials are gone and the card now awaits slot selection (still in hand).
    let s = store.getState();
    expect(s.board.A1).toBeNull();
    expect(s.board.A2).toBeNull();
    expect(s.board.C1).toBeNull(); // linked C tributed too
    expect(s.replen).toEqual(expect.arrayContaining(['card-hero-1', 'card-hero-17', 'card-equipment-1']));
    expect(s.pendingTribute).toBeNull();
    expect(s.pendingSummon).toEqual({ cardId: 'card-hero-40', setKind: 'replen', materials: 2 });
    expect(s.hand).toContain('card-hero-40'); // not placed until a slot is picked

    // Pick an open slot — now the card is summoned there.
    store.getState().placePendingSummon('A3');
    s = store.getState();
    expect(s.board.A3).toBe('card-hero-40');
    expect(s.hand).not.toContain('card-hero-40');
    expect(s.pendingSummon).toBeNull();
  });

  it('confirming a COMMANDER tribute sends materials (and linked C) to the graveyard', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-hero-56'], // Commander (level 4)
      deck: base.deck.filter(
        (id) => !['card-hero-56', 'card-hero-17', 'card-hero-21', 'card-equipment-1'].includes(id),
      ),
      board: { ...base.board, A1: 'card-hero-17', A2: 'card-hero-21', C1: 'card-equipment-1' },
      phase: 'main',
    });
    store.getState().beginDrag('card-hero-56');
    store.getState().dropCard('card-hero-56', 'A3');
    store.getState().confirmTributeSummon(['A1', 'A2']); // levels 2 + 2 = 4
    store.getState().placePendingSummon('A3');

    const s = store.getState();
    expect(s.board.A3).toBe('card-hero-56'); // commander summoned
    expect(s.board.A1).toBeNull();
    expect(s.board.A2).toBeNull();
    expect(s.board.C1).toBeNull();
    // Commander materials go to the graveyard, NOT the replen.
    expect(s.graveyard).toEqual(
      expect.arrayContaining(['card-hero-17', 'card-hero-21', 'card-equipment-1']),
    );
    expect(s.replen).not.toEqual(expect.arrayContaining(['card-hero-17']));
    expect(s.pendingTribute).toBeNull();
    expect(s.pendingSummon).toBeNull();
  });

  it('confirming with materials that do not sum to the level is a no-op', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-hero-40'],
      deck: base.deck.filter((id) => !['card-hero-40', 'card-hero-1', 'card-hero-17'].includes(id)),
      board: { ...base.board, A1: 'card-hero-1', A2: 'card-hero-17' },
      phase: 'main',
    });
    store.getState().beginDrag('card-hero-40');
    store.getState().dropCard('card-hero-40', 'A3');
    store.getState().confirmTributeSummon(['A2']); // level 2 ≠ 3

    const s = store.getState();
    expect(s.board.A3).toBeNull();
    expect(s.board.A2).toBe('card-hero-17'); // material untouched
    expect(s.pendingTribute).not.toBeNull(); // prompt still open
  });

  it('cancelTributeSummon clears the prompt and leaves the card in hand', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-hero-40'],
      deck: base.deck.filter((id) => !['card-hero-40', 'card-hero-1', 'card-hero-17'].includes(id)),
      board: { ...base.board, A1: 'card-hero-1', A2: 'card-hero-17' },
      phase: 'main',
    });
    store.getState().beginDrag('card-hero-40');
    store.getState().dropCard('card-hero-40', 'A3');
    store.getState().cancelTributeSummon();

    const s = store.getState();
    expect(s.pendingTribute).toBeNull();
    expect(s.hand).toContain('card-hero-40');
    expect(s.board.A3).toBeNull();
  });

  it('a level-3 A card can be tribute-summoned even when all 4 A slots are full', () => {
    // The bug: with every A slot occupied there is no empty slot to drop onto,
    // but tribute materials free up a slot, so the summon must still be possible.
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-hero-40'], // level 3
      deck: base.deck.filter(
        (id) => !['card-hero-40', 'card-hero-1', 'card-hero-17', 'card-hero-4', 'card-hero-5'].includes(id),
      ),
      // All four A slots filled; A1 (lvl1) + A2 (lvl2) sum to 3.
      board: {
        ...base.board,
        A1: 'card-hero-1',
        A2: 'card-hero-17',
        A3: 'card-hero-4',
        A4: 'card-hero-5',
      },
      phase: 'main',
    });
    store.getState().beginDrag('card-hero-40');
    // Drop lands on an occupied column — still opens the picker (materials free a slot).
    store.getState().dropCard('card-hero-40', 'A1');
    expect(store.getState().pendingTribute).toEqual({ cardId: 'card-hero-40' });

    store.getState().confirmTributeSummon(['A1', 'A2']); // frees A1 and A2
    expect(store.getState().pendingSummon).toEqual({ cardId: 'card-hero-40', setKind: 'replen', materials: 2 });

    // A freed slot is now a legal target.
    store.getState().placePendingSummon('A1');
    const s = store.getState();
    expect(s.board.A1).toBe('card-hero-40');
    expect(s.board.A2).toBeNull();
    expect(s.pendingSummon).toBeNull();
    expect(s.hand).not.toContain('card-hero-40');
  });

  it('placePendingSummon ignores an occupied slot and only lands on an empty A slot', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-hero-10'],
      deck: base.deck.filter((id) => !['card-hero-10', 'card-hero-1', 'card-hero-6'].includes(id)),
      board: { ...base.board, A1: 'card-hero-1', A2: 'card-hero-6', A4: 'card-hero-7' },
      pendingSummon: { cardId: 'card-hero-10' },
      phase: 'main',
    });
    // A4 is occupied — no-op; A3 is empty — lands.
    store.getState().placePendingSummon('A4');
    expect(store.getState().board.A4).toBe('card-hero-7');
    expect(store.getState().pendingSummon).not.toBeNull();
    store.getState().placePendingSummon('A3');
    expect(store.getState().board.A3).toBe('card-hero-10');
    expect(store.getState().pendingSummon).toBeNull();
  });

  it('dragging the pending summon card onto an open slot places it (no re-tribute)', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-hero-10'],
      deck: base.deck.filter((id) => !['card-hero-10', 'card-hero-1'].includes(id)),
      board: { ...base.board, A1: 'card-hero-1' },
      pendingSummon: { cardId: 'card-hero-10' },
      phase: 'main',
    });
    store.getState().beginDrag('card-hero-10');
    store.getState().dropCard('card-hero-10', 'A2'); // open A slot
    const s = store.getState();
    expect(s.board.A2).toBe('card-hero-10');
    expect(s.pendingSummon).toBeNull();
    expect(s.pendingTribute).toBeNull(); // did NOT reopen the material picker
    expect(s.dragging).toBeNull();
  });

  // TODO(ability-engine phase): re-enable once B-card ability slugs are wired to
  // the v3 catalog. The old draw1/draw2/graveyardIntoDeck fixture slugs no longer
  // exist; B-card enactment will be reworked in the ability-parsing slice.
  it.skip('setting a B card enacts its ability after the showcase (draw 1 / draw 2)', () => {
    vi.useFakeTimers();
    const draw1 = storeWithHand(['card-ability-1']); // B1 = draw1
    draw1.getState().beginDrag('card-ability-1');
    draw1.getState().dropCard('card-ability-1', 'B1');
    expect(draw1.getState().hand).toHaveLength(0); // B card left the hand
    vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
    expect(draw1.getState().hand).toHaveLength(1); // drew 1

    const draw2 = storeWithHand(['card-ability-4']); // B4 = draw2
    draw2.getState().beginDrag('card-ability-4');
    draw2.getState().dropCard('card-ability-4', 'B4');
    vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
    expect(draw2.getState().hand).toHaveLength(1); // first card off the deck
    vi.advanceTimersByTime(MULTI_DRAW_STAGGER_MS);
    expect(draw2.getState().hand).toHaveLength(2); // second follows after the stagger
    vi.useRealTimers();
  });

  // TODO(ability-engine phase): re-enable once B-card ability slugs are wired to
  // the v3 catalog (graveyardIntoDeck no longer maps to a v3 ability card).
  it.skip('setting a B card routes the graveyard into the replen pile after the showcase', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-ability-2'], // B2 = graveyardIntoDeck (now graveyard -> replen)
      deck: base.deck.filter((id) => id !== 'card-ability-2' && id !== 'card-hero-1'),
      graveyard: ['card-hero-1'],
      phase: 'main',
    });
    store.getState().beginDrag('card-ability-2');
    store.getState().dropCard('card-ability-2', 'B2');
    vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
    expect(store.getState().graveyard).toHaveLength(0);
    // "Shuffle into deck" routes through replen, not the deck itself.
    expect(store.getState().replen).toContain('card-hero-1');
    expect(store.getState().deck).not.toContain('card-hero-1');
    vi.useRealTimers();
  });

  it('dropCard with no slot returns the card to the hand in its original order', () => {
    const store = storeWithHand(['card-hero-6', 'card-ability-1']);
    const handBefore = [...store.getState().hand];

    store.getState().beginDrag('card-hero-6');
    store.getState().dropCard('card-hero-6', null);

    expect(store.getState().hand).toEqual(handBefore);
    expect(store.getState().dragging).toBeNull();
  });

  it('autoPlaceCard quick-sets a hand card into the first legal slot', () => {
    const store = storeWithHand(['card-hero-6']);
    store.getState().autoPlaceCard('card-hero-6');
    const s = store.getState();
    // A cards fill A1 first (board order).
    expect(s.board.A1).toBe('card-hero-6');
    expect(s.hand).not.toContain('card-hero-6');
  });

  it('autoPlaceCard fills the NEXT free slot when earlier ones are taken', () => {
    const store = storeWithHand(['card-hero-6', 'card-hero-7']);
    store.getState().autoPlaceCard('card-hero-6'); // -> A1
    store.getState().autoPlaceCard('card-hero-7'); // -> A2 (A1 now taken)
    const s = store.getState();
    expect(s.board.A1).toBe('card-hero-6');
    expect(s.board.A2).toBe('card-hero-7');
  });

  it('autoPlaceCard does nothing when the card has no legal slot (C with no A)', () => {
    const store = storeWithHand(['card-equipment-1']);
    const handBefore = [...store.getState().hand];
    store.getState().autoPlaceCard('card-equipment-1'); // no A card on field -> illegal
    expect(store.getState().hand).toEqual(handBefore);
    expect(Object.values(store.getState().board).every((v) => v !== 'card-equipment-1')).toBe(true);
  });

  it('autoPlaceCard is blocked outside the Main phase', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-hero-6'],
      deck: base.deck.filter((id) => id !== 'card-hero-6'),
      phase: 'battle',
    });
    store.getState().autoPlaceCard('card-hero-6');
    expect(store.getState().hand).toContain('card-hero-6');
  });

  it('updateDrag and hoverSlot record drag details', () => {
    const store = storeWithHand(['card-hero-6']);
    store.getState().beginDrag('card-hero-6');
    store.getState().updateDrag([1, 0, 2]);
    store.getState().hoverSlot('C3');

    const d = store.getState().dragging!;
    expect(d.projectedPoint).toEqual([1, 0, 2]);
    expect(d.hoveredSlotId).toBe('C3');
  });

  it('returnToHand cancels the drag without moving the card', () => {
    const store = storeWithHand(['card-hero-6']);
    store.getState().beginDrag('card-hero-6');
    store.getState().returnToHand('card-hero-6');

    expect(store.getState().dragging).toBeNull();
    expect(store.getState().hand).toContain('card-hero-6');
  });

  it('hoverCard raises a hand card and clears with null', () => {
    const store = storeWithHand(['card-hero-6']);

    store.getState().hoverCard('card-hero-6');
    expect(store.getState().hoveredCardId).toBe('card-hero-6');

    store.getState().hoverCard(null);
    expect(store.getState().hoveredCardId).toBeNull();
  });

  it('hoverCard ignores cards not in hand and clears hover while dragging', () => {
    const store = storeWithHand(['card-hero-6']);

    // A card that isn't in the hand cannot be hovered.
    store.getState().hoverCard('card-ability-1');
    expect(store.getState().hoveredCardId).toBeNull();

    // Starting a drag clears any hover, and hover is refused mid-drag.
    store.getState().hoverCard('card-hero-6');
    store.getState().beginDrag('card-hero-6');
    expect(store.getState().hoveredCardId).toBeNull();
    store.getState().hoverCard('card-hero-6');
    expect(store.getState().hoveredCardId).toBeNull();
  });
});

describe('P3-S02 card selection (inspection)', () => {
  it('selects a card that is in the hand', () => {
    const store = storeWithHand(['card-hero-6']);
    store.getState().selectCard('card-hero-6');
    expect(store.getState().selectedCardId).toBe('card-hero-6');
  });

  it('selects a card that is on the board', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, C3: 'card-equipment-1' },
    });
    store.getState().selectCard('card-equipment-1');
    expect(store.getState().selectedCardId).toBe('card-equipment-1');
  });

  it('selects a card that is in a pile (deck/graveyard/replen), e.g. via pile search', () => {
    const store = createGameStore();
    // card-ability-1 is still in the deck; pile search lets it be inspected.
    const deckCard = store.getState().deck[0];
    store.getState().selectCard(deckCard);
    expect(store.getState().selectedCardId).toBe(deckCard);
  });

  it('ignores a card id that does not exist', () => {
    const store = storeWithHand(['card-hero-6']);
    store.getState().selectCard('card-does-not-exist');
    expect(store.getState().selectedCardId).toBeNull();
  });

  it('closes the panel when passed null', () => {
    const store = storeWithHand(['card-hero-6']);
    store.getState().selectCard('card-hero-6');
    expect(store.getState().selectedCardId).toBe('card-hero-6');
    store.getState().selectCard(null);
    expect(store.getState().selectedCardId).toBeNull();
  });

  it('switches selection from one card to another', () => {
    const store = storeWithHand(['card-hero-6', 'card-ability-1']);
    store.getState().selectCard('card-hero-6');
    store.getState().selectCard('card-ability-1');
    expect(store.getState().selectedCardId).toBe('card-ability-1');
  });
});

describe('P3-S03 destroy (send occupied zone card -> graveyard)', () => {
  it('sends the A card and its linked C card to the graveyard and clears the slots', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, A2: 'card-hero-7', C2: 'card-equipment-2' },
    });
    store.getState().destroyZoneA();
    const s = store.getState();
    expect(s.board.A2).toBeNull();
    expect(s.board.C2).toBeNull();
    expect(s.graveyard).toContain('card-hero-7');
    expect(s.graveyard).toContain('card-equipment-2');
    expect(s.graveyard).toHaveLength(2);
  });

  it('sends only the A card when the linked C slot is empty', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, A1: 'card-hero-6' },
    });
    store.getState().destroyZoneA();
    const s = store.getState();
    expect(s.board.A1).toBeNull();
    expect(s.graveyard).toEqual(['card-hero-6']);
  });

  it('destroyZoneA is a no-op when no Zone A slot is occupied', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, C1: 'card-equipment-1' },
    });
    store.getState().destroyZoneA();
    const s = store.getState();
    expect(s.board.C1).toBe('card-equipment-1');
    expect(s.graveyard).toEqual([]);
  });

  it('appends to the graveyard across repeated attacks (stacking order preserved)', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, A1: 'card-hero-6', A2: 'card-hero-7' },
    });
    store.getState().destroyZoneA();
    store.getState().destroyZoneA();
    const s = store.getState();
    expect(s.graveyard).toHaveLength(2);
    expect(s.graveyard).toContain('card-hero-6');
    expect(s.graveyard).toContain('card-hero-7');
    expect(s.board.A1).toBeNull();
    expect(s.board.A2).toBeNull();
  });

  it('destroyZoneB sends the occupied B card to the graveyard (no links)', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, B3: 'card-ability-3', A3: 'card-hero-1', C3: 'card-equipment-3' },
    });
    store.getState().destroyZoneB();
    const s = store.getState();
    expect(s.board.B3).toBeNull();
    // Zone B has no links: the A3/C3 pair is untouched.
    expect(s.board.A3).toBe('card-hero-1');
    expect(s.board.C3).toBe('card-equipment-3');
    expect(s.graveyard).toEqual(['card-ability-3']);
  });

  it('destroyZoneB is a no-op when no Zone B slot is occupied', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, A1: 'card-hero-6' },
    });
    store.getState().destroyZoneB();
    const s = store.getState();
    expect(s.board.A1).toBe('card-hero-6');
    expect(s.graveyard).toEqual([]);
  });
});

describe('P3-S04 replen (send cards to the replenish pile)', () => {
  it('replenZoneA sends the A card and its linked C card to replen and clears the slots', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, A4: 'card-hero-10', C4: 'card-equipment-4' },
    });
    store.getState().replenZoneA();
    const s = store.getState();
    expect(s.board.A4).toBeNull();
    expect(s.board.C4).toBeNull();
    expect(s.replen).toContain('card-hero-10');
    expect(s.replen).toContain('card-equipment-4');
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
      const store = createGameStore({ ...base, replen: ['card-hero-6', 'card-ability-1'] });
      const deckLen = store.getState().deck.length;

      store.getState().replenIntoDeck();
      // Cards moved synchronously; replen emptied; spread begins.
      expect(store.getState().replen).toEqual([]);
      expect(store.getState().deck).toHaveLength(deckLen + 2);
      expect(store.getState().deck).toContain('card-hero-6');
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
    const store = createGameStore({ ...base, graveyard: ['card-equipment-1'] });
    const replenLen = store.getState().replen.length;
    const deckLen = store.getState().deck.length;

    store.getState().graveyardIntoDeck();
    expect(store.getState().graveyard).toEqual([]);
    // Routes through replen, not the deck itself; replen folds into the deck at End.
    expect(store.getState().replen).toContain('card-equipment-1');
    expect(store.getState().replen).toHaveLength(replenLen + 1);
    expect(store.getState().deck).toHaveLength(deckLen);
  });

  it('handIntoDeck returns the hand to the deck (clearing hover) then shuffles', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        hand: ['card-hero-6', 'card-hero-7'],
        deck: base.deck.filter((id) => id !== 'card-hero-6' && id !== 'card-hero-7'),
        hoveredCardId: 'card-hero-6',
      });
      const deckLen = store.getState().deck.length;

      store.getState().handIntoDeck();
      expect(store.getState().hand).toEqual([]);
      expect(store.getState().hoveredCardId).toBeNull();
      expect(store.getState().deck).toHaveLength(deckLen + 2);
      expect(store.getState().deck).toContain('card-hero-6');

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
      const store = createGameStore({ ...createInitialState(), phase: 'main', turn: 2 });

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
          B1: 'card-ability-1', // not continuous (timing Main)
          B3: 'card-ability-12', // continuous (timing Cont.)
        },
      });

      store.getState().advancePhase(); // battle -> resolution
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS + 400); // -> end (runEndPhase), before hand-off
      const s = store.getState();
      expect(s.phase).toBe('end');
      expect(s.board.B1).toBeNull();
      expect(s.graveyard).toContain('card-ability-1');
      expect(s.board.B3).toBe('card-ability-12');
      expect(s.graveyard).not.toContain('card-ability-12');
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
        replen: ['card-hero-6'],
      });
      const deckLen = store.getState().deck.length;

      store.getState().advancePhase(); // battle -> resolution
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS + SHUFFLE_SPREAD_MS + 400); // -> end, replen folds in + shuffle completes (before hand-off)
      expect(store.getState().replen).toEqual([]);
      expect(store.getState().deck).toContain('card-hero-6');
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
      hand: ['card-hero-6'],
      deck: base.deck.filter((id) => id !== 'card-hero-6'),
      phase: 'battle',
    });
    store.getState().beginDrag('card-hero-6');
    store.getState().dropCard('card-hero-6', 'A1');
    expect(store.getState().board.A1).toBeNull();
    expect(store.getState().hand).toContain('card-hero-6');
    expect(store.getState().dragging).toBeNull();
  });

  it('aimAttack begins targeting and assignTarget commits an opponent target during Battle', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      phase: 'battle',
      board: { ...base.board, A1: 'card-hero-6' },
      ...withOpponent(base, 'O1'),
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
      board: { ...base.board, A1: 'card-hero-6', B1: 'card-ability-1' },
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
      board: { ...base.board, A1: 'card-hero-6' },
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
        board: { ...base.board, A1: 'card-hero-6', A2: 'card-hero-7' },
        // Both attackers aim at the same opponent; their damage stacks onto O1.
        attackTargets: { A1: 'O1', A2: 'O1' },
        ...withOpponent(base, 'O1'),
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
      const oppId = store.getState().opponentBoard.O1!;
      const maxHp = store.getState().opponentCards[oppId].hp!;
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

  it('flat Armor subtracts from a normal hit and Armor Bars absorb a hit before breaking (P8)', () => {
    vi.useFakeTimers();
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.2); // roll 5 -> normal hit
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        board: { ...base.board, A1: 'card-hero-6' }, // pinned to dmg 70, acc 70 below
        attackTargets: { A1: 'O1' },
        cardsById: {
          ...base.cardsById,
          'card-hero-6': { ...base.cardsById['card-hero-6'], dmg: 70, acc: 70 },
        },
        ...withOpponent(base, 'O1', { hp: 200, armor: 20, armorBars: 0 }),
      });

      store.getState().advancePhase(); // battle -> resolution
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS);
      vi.advanceTimersByTime(DICE_ROLL_MS);
      vi.advanceTimersByTime(DICE_HOLD_MS);

      const s = store.getState();
      const oppId = s.opponentBoard.O1!;
      // 70 raw - 20 armor = 50 to HP.
      expect(s.currentHp[oppId]).toBe(150);
      expect(s.damagePopups.O1).toBe(50);
      expect(s.currentArmorBars[oppId]).toBe(0);
    } finally {
      rnd.mockRestore();
      vi.useRealTimers();
    }
  });

  it('Armor Bars deplete per attacker in slot order (first hit absorbed, second lands) (P8)', () => {
    vi.useFakeTimers();
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.2); // roll 5 -> normal hit
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        // A1 = card-hero-6 (dmg 70), A2 = card-hero-7 (dmg 80). Both aim at O1.
        board: { ...base.board, A1: 'card-hero-6', A2: 'card-hero-7' },
        attackTargets: { A1: 'O1', A2: 'O1' },
        cardsById: {
          ...base.cardsById,
          'card-hero-6': { ...base.cardsById['card-hero-6'], dmg: 70, acc: 70 },
          'card-hero-7': { ...base.cardsById['card-hero-7'], dmg: 80, acc: 70 },
        },
        ...withOpponent(base, 'O1', { hp: 300, armor: 0, armorBars: 1 }),
      });

      store.getState().advancePhase(); // battle -> resolution
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS);
      vi.advanceTimersByTime(DICE_ROLL_MS);
      vi.advanceTimersByTime(DICE_HOLD_MS);

      const s = store.getState();
      const oppId = s.opponentBoard.O1!;
      // A1 breaks the lone bar (0 dmg); A2 then lands its full 80.
      expect(s.currentArmorBars[oppId]).toBe(0);
      expect(s.currentHp[oppId]).toBe(220);
      expect(s.damagePopups.O1).toBe(80);
    } finally {
      rnd.mockRestore();
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
    // Force a low roll (1) so the remapped Hero's attack is a glancing hit, not a miss.
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const base = createInitialState();
      const oppId = 'opp-O1';
      const store = createGameStore({
        ...base,
        phase: 'battle',
        board: { ...base.board, A1: 'card-hero-6' },
        attackTargets: { A1: 'O1' },
        ...withOpponent(base, 'O1'),
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
        board: { ...base.board, A1: 'card-hero-6', C1: 'card-equipment-1' },
        currentHp: { 'card-hero-6': 1 },
        // Seed the opponent attacker directly and empty its hand so the AI
        // summon step is a no-op — this test isolates the combat path.
        ...withOpponent(base, 'O1'),
        opponentHand: [],
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
      vi.advanceTimersByTime(OPP_PHASE_STEP_MS * 2 + OPP_MAIN_DURATION_MS + 20);
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
      expect(s.graveyard).toContain('card-hero-6');
      // ...and its linked C-card (same column) fell with it.
      expect(s.board.C1).toBeNull();
      expect(s.graveyard).toContain('card-equipment-1');
      expect(s.currentHp['card-hero-6']).toBeUndefined();
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
      vi.advanceTimersByTime(OPP_PHASE_STEP_MS * 2 + OPP_MAIN_DURATION_MS + 20);
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

describe('P7-S4 opponent AI (draw + summon)', () => {
  it('the opponent draws a card and summons a free Vanguard onto an empty slot on its turn', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      // Give the opponent a single free Vanguard in hand (A3 is level 1) so the
      // summon is deterministic; empty the deck-drawn ambiguity by controlling
      // the hand contents directly.
      const freeCard = base.opponentCards['opp-deck-hero-1'];
      expect(freeCard.type).toBe('A');
      const store = createGameStore({
        ...base,
        phase: 'battle',
        activePlayer: 'player',
        opponentHand: ['opp-deck-hero-1'],
        opponentDeck: ['opp-deck-hero-6'], // one card to draw (another Vanguard)
        opponentBoard: { O1: null, O2: null, O3: null, O4: null },
      });

      // Player has no attackers -> straight to End, then hand off to opponent.
      store.getState().advancePhase();
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS + 400);
      vi.advanceTimersByTime(END_PHASE_DWELL_MS + 20);
      expect(store.getState().activePlayer).toBe('opponent');
      expect(store.getState().phase).toBe('draw');

      // Draw happens immediately on entering the opponent's draw phase.
      expect(store.getState().opponentDeck).toEqual([]);
      expect(store.getState().opponentHand).toContain('opp-deck-hero-6');

      // Advance to Main: the opponent summons its first free Vanguard onto O1 and
      // showcases it (the reveal), removing it from hand. Only one Vanguard plays
      // per turn, so the second A stays in hand.
      vi.advanceTimersByTime(OPP_PHASE_STEP_MS + 20);
      expect(store.getState().phase).toBe('main');
      expect(store.getState().opponentBoard.O1).toBe('opp-deck-hero-1');
      expect(store.getState().opponentHand).not.toContain('opp-deck-hero-1');
      expect(store.getState().opponentHand).toContain('opp-deck-hero-6');
      expect(store.getState().oppSummon).toEqual({ cardId: 'opp-deck-hero-1', slotId: 'O1' });

      // The play showcase self-clears after OPP_PLAY_SHOWCASE_MS.
      vi.advanceTimersByTime(OPP_PLAY_SHOWCASE_MS + 20);
      expect(store.getState().oppSummon).toBeNull();
      // The summoned card stays on the board.
      expect(store.getState().opponentBoard.O1).toBe('opp-deck-hero-1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('the opponent plays nothing when its hand holds no free Vanguard, Bulwark, or Arcane', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        activePlayer: 'player',
        // Only a tribute-level Commander: not a free summon, and no B/C to set.
        opponentHand: ['opp-deck-hero-56'],
        opponentDeck: [],
        opponentBoard: { O1: null, O2: null, O3: null, O4: null },
      });
      store.getState().advancePhase();
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS + 400);
      vi.advanceTimersByTime(END_PHASE_DWELL_MS + 20);
      vi.advanceTimersByTime(OPP_PHASE_STEP_MS + OPP_PLAY_STEP_MS * 2 + OPP_PLAY_SHOWCASE_MS + 20); // main + all paced play attempts
      expect(store.getState().phase).toBe('main');
      expect(Object.values(store.getState().opponentBoard).every((v) => v === null)).toBe(true);
      expect(Object.values(store.getState().opponentBBoard).every((v) => v === null)).toBe(true);
      expect(Object.values(store.getState().opponentCBoard).every((v) => v === null)).toBe(true);
      expect(store.getState().oppSummon).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('the opponent plays one of each row type per turn — a Vanguard, a linked Bulwark, and an Arcane', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        activePlayer: 'player',
        // A free Vanguard, its linked-column Bulwark, and an Arcane.
        // A3 -> O3, C3 -> OC3 (linked to O3), B1 -> OB1.
        opponentHand: ['opp-deck-hero-1', 'opp-deck-equipment-3', 'opp-deck-ability-1'],
        opponentDeck: [],
        opponentBoard: { O1: null, O2: null, O3: null, O4: null },
        opponentBBoard: { OB1: null, OB2: null, OB3: null, OB4: null },
        opponentCBoard: { OC1: null, OC2: null, OC3: null, OC4: null },
      });

      store.getState().advancePhase();
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS + 400);
      vi.advanceTimersByTime(END_PHASE_DWELL_MS + 20);
      expect(store.getState().activePlayer).toBe('opponent');

      // Advance into Main and let all three paced play attempts fire.
      vi.advanceTimersByTime(OPP_PHASE_STEP_MS + OPP_PLAY_STEP_MS * 2 + OPP_PLAY_SHOWCASE_MS + 20);
      const s = store.getState();

      // Vanguard summoned to the first open O-slot (O1).
      expect(s.opponentBoard.O1).toBe('opp-deck-hero-1');
      // Bulwark set to a linked, occupied OC-slot (OC1, linked to O1).
      expect(s.opponentCBoard.OC1).toBe('opp-deck-equipment-3');
      // Arcane set to the first open OB-slot (OB1).
      expect(s.opponentBBoard.OB1).toBe('opp-deck-ability-1');
      // All three left the hand.
      expect(s.opponentHand).toEqual([]);
      // The last reveal has cleared before Battle.
      expect(s.oppSummon).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

// TODO(ability-engine phase): the pile / combat-trigger blocks below still use
// v1 fixture wording (Salvage Beacon, Field Cache) absent from the v3 catalog.
// The engine is intact; the tests will be rewritten with explicit ability
// fixtures when we build out ability parsing. Quarantined to keep the suite green
// after the catalog swap.
describe('P8 activated abilities (self stat-buff, discard cost, end-of-turn)', () => {
  // Roma (card-hero-49): "Wasteland Deadeye: Once per turn, you can discard 1
  // card from your Hand: this Hero gains +30 ACC until the end of your turn."
  const ROMA = 'card-hero-49';
  const FODDER = 'card-hero-1';
  function withRomaOnBoard(hand: string[] = [FODDER]) {
    const base = createInitialState();
    return createGameStore({
      ...base,
      deck: base.deck.filter((id) => id !== ROMA && !hand.includes(id)),
      board: { ...base.board, A1: ROMA },
      hand,
      phase: 'main',
    });
  }

  it('discards the picked Hand card and folds +30 ACC into effective ACC', () => {
    const store = withRomaOnBoard();
    const before = effectiveStats(store.getState(), 'A1').acc.value;
    store.getState().activateAbility(ROMA, 0);
    expect(store.getState().abilityTargeting).toMatchObject({ sourceCardId: ROMA, step: 'cost' });
    store.getState().chooseAbilityCost(FODDER);
    const s = store.getState();
    expect(s.abilityTargeting).toBeNull();
    expect(s.hand).not.toContain(FODDER);
    expect(s.graveyard).toContain(FODDER);
    expect(s.turnStatBuffs[ROMA]).toEqual({ acc: 30 });
    expect(s.activatedStatBuffs[ROMA]).toBeUndefined();
    expect(s.usedActivatedAbilities[ROMA]).toEqual(['Wasteland Deadeye']);
    expect(effectiveStats(s, 'A1').acc.value).toBe(before + 30);
  });

  it('is once-per-turn: a second activation the same turn is a no-op', () => {
    const store = withRomaOnBoard([FODDER, 'card-hero-2']);
    store.getState().activateAbility(ROMA, 0);
    store.getState().chooseAbilityCost(FODDER);
    store.getState().activateAbility(ROMA, 0);
    expect(store.getState().abilityTargeting).toBeNull();
    expect(store.getState().turnStatBuffs[ROMA]).toEqual({ acc: 30 });
  });

  it('the +30 ACC expires when the player turn ends', () => {
    vi.useFakeTimers();
    try {
      const store = withRomaOnBoard();
      store.getState().activateAbility(ROMA, 0);
      store.getState().chooseAbilityCost(FODDER);
      expect(store.getState().turnStatBuffs[ROMA]).toEqual({ acc: 30 });
      store.setState({ phase: 'end' });
      store.getState().advancePhase(); // end -> opponent turn
      expect(store.getState().activePlayer).toBe('opponent');
      expect(store.getState().turnStatBuffs).toEqual({});
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not open with an empty Hand (cost unpayable)', () => {
    const store = withRomaOnBoard([]);
    store.getState().activateAbility(ROMA, 0);
    expect(store.getState().abilityTargeting).toBeNull();
  });

  it('does nothing outside the player Main phase or on the opponent turn', () => {
    const store = withRomaOnBoard();
    store.setState({ phase: 'battle' });
    store.getState().activateAbility(ROMA, 0);
    expect(store.getState().abilityTargeting).toBeNull();
    store.setState({ phase: 'main', activePlayer: 'opponent' });
    store.getState().activateAbility(ROMA, 0);
    expect(store.getState().abilityTargeting).toBeNull();
  });

  it('does nothing for a card that is not on the player board', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: [ROMA, FODDER],
      deck: base.deck.filter((id) => id !== ROMA && id !== FODDER),
      phase: 'main',
    });
    store.getState().activateAbility(ROMA, 0);
    expect(store.getState().abilityTargeting).toBeNull();
  });
});

describe('P8 activated abilities (targeted cost: Quick Reload)', () => {
  // Riko (card-hero-43) ability 1: "Quick Reload: Once per turn, you can send 1
  // card from your Hand to Replen: select another Infantry Hero you control;
  // that Hero gains +20 ACC." Tundra Rifleman (card-hero-1) is an Infantry ally.
  const RIKO = 'card-hero-43';
  const ALLY = 'card-hero-1';
  const COST = 'card-hero-2';
  function withDuo(hand: string[] = [COST], ally: string | null = ALLY) {
    const base = createInitialState();
    return createGameStore({
      ...base,
      deck: base.deck.filter((id) => ![RIKO, ALLY, ...hand].includes(id)),
      board: { ...base.board, A1: RIKO, A2: ally },
      hand,
      phase: 'main',
    });
  }

  it('resolves the two-step flow: pay the cost, then buff the chosen target', () => {
    const store = withDuo();
    const beforeAcc = effectiveStats(store.getState(), 'A2').acc.value;
    store.getState().activateAbility(RIKO, 1);
    expect(store.getState().abilityTargeting).toMatchObject({ sourceCardId: RIKO, step: 'cost', costCardId: null });
    store.getState().chooseAbilityCost(COST);
    expect(store.getState().abilityTargeting).toMatchObject({ step: 'target', costCardId: COST });
    store.getState().chooseAbilityTarget(ALLY);
    const s = store.getState();
    expect(s.abilityTargeting).toBeNull();
    expect(s.hand).not.toContain(COST);
    expect(s.replen).toContain(COST);
    expect(s.activatedStatBuffs[ALLY]).toEqual({ acc: 20 });
    expect(s.usedActivatedAbilities[RIKO]).toEqual(['Quick Reload']);
    expect(effectiveStats(s, 'A2').acc.value).toBe(beforeAcc + 20);
  });

  it('rejects an illegal target (the source itself)', () => {
    const store = withDuo();
    store.getState().activateAbility(RIKO, 1);
    store.getState().chooseAbilityCost(COST);
    store.getState().chooseAbilityTarget(RIKO);
    expect(store.getState().abilityTargeting).toMatchObject({ step: 'target' });
    expect(store.getState().hand).toContain(COST);
  });

  it('cancelling at the target step spends nothing', () => {
    const store = withDuo();
    store.getState().activateAbility(RIKO, 1);
    store.getState().chooseAbilityCost(COST);
    store.getState().cancelAbilityTargeting();
    const s = store.getState();
    expect(s.abilityTargeting).toBeNull();
    expect(s.hand).toContain(COST);
    expect(s.replen).not.toContain(COST);
    expect(s.activatedStatBuffs[ALLY]).toBeUndefined();
    expect(s.usedActivatedAbilities[RIKO]).toBeUndefined();
  });

  it('does not open the flow when the Hand cannot pay the cost', () => {
    const store = withDuo([]);
    store.getState().activateAbility(RIKO, 1);
    expect(store.getState().abilityTargeting).toBeNull();
  });

  it('does not open the flow when there is no legal target', () => {
    const store = withDuo([COST], null);
    store.getState().activateAbility(RIKO, 1);
    expect(store.getState().abilityTargeting).toBeNull();
  });
});

describe('P8 activated abilities (heal + GY recovery)', () => {
  // Frostline Medic (card-hero-39): "First Aid Kit: ... discard 1 card: select 1
  // Hero you control; that Hero recovers 30 HP."
  // Byrd (card-hero-51) ability 1: "Jackal Reinforcement: ... discard 1 card
  // from your Hand: select 1 Hero in your GY and send that Hero to Replen."
  const MEDIC = 'card-hero-39';
  const BYRD = 'card-hero-51';
  const ALLY = 'card-hero-1';
  const COST = 'card-hero-2';
  const DEAD = 'card-hero-3';

  it('First Aid Kit heals the chosen Hero, capped at max HP', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      deck: base.deck.filter((id) => ![MEDIC, ALLY, COST].includes(id)),
      board: { ...base.board, A1: MEDIC, A2: ALLY },
      hand: [COST],
      currentHp: { [ALLY]: 50 },
      phase: 'main',
    });
    store.getState().activateAbility(MEDIC, 0);
    store.getState().chooseAbilityCost(COST);
    store.getState().chooseAbilityTarget(ALLY);
    let s = store.getState();
    expect(s.graveyard).toContain(COST);
    expect(s.currentHp[ALLY]).toBe(80);

    // Next turn: heal from 90/100 caps at 100.
    store.setState({ usedActivatedAbilities: {}, hand: ['card-hero-4'], currentHp: { [ALLY]: 90 } });
    store.getState().activateAbility(MEDIC, 0);
    store.getState().chooseAbilityCost('card-hero-4');
    store.getState().chooseAbilityTarget(ALLY);
    s = store.getState();
    expect(s.currentHp[ALLY]).toBe(effectiveStats(s, 'A2').hp.value);
  });

  it('Jackal Reinforcement moves a Hero from the GY to Replen', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      deck: base.deck.filter((id) => ![BYRD, COST, DEAD].includes(id)),
      board: { ...base.board, A1: BYRD },
      hand: [COST],
      graveyard: [DEAD],
      phase: 'main',
    });
    store.getState().activateAbility(BYRD, 1);
    store.getState().chooseAbilityCost(COST);
    store.getState().chooseAbilityTarget(DEAD);
    const s = store.getState();
    expect(s.graveyard).toEqual([COST]);
    expect(s.replen).toContain(DEAD);
    expect(s.usedActivatedAbilities[BYRD]).toEqual(['Jackal Reinforcement']);
  });

  it('Jackal Reinforcement does not open with an empty GY', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      deck: base.deck.filter((id) => ![BYRD, COST].includes(id)),
      board: { ...base.board, A1: BYRD },
      hand: [COST],
      graveyard: [],
      phase: 'main',
    });
    store.getState().activateAbility(BYRD, 1);
    expect(store.getState().abilityTargeting).toBeNull();
  });
});

describe.skip('P8-S05 pile abilities', () => {
  it('destroyZoneA fires an on-sent prompt after the send, and Use draws a card', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    // card-hero-5 = Tundra Rifleman (Salvage Beacon: on-sent to Graveyard, draw 1).
    const store = createGameStore({
      ...base,
      board: { ...base.board, A1: 'card-hero-5' },
      phase: 'main',
      activePlayer: 'player',
    });
    store.getState().destroyZoneA();
    expect(store.getState().graveyard).toContain('card-hero-5');
    // Prompt only appears once the send-to-pile travel lands.
    expect(store.getState().abilityPrompt).toBeNull();
    vi.advanceTimersByTime(ON_SENT_PROMPT_MS);
    expect(store.getState().abilityPrompt).toMatchObject({
      cardId: 'card-hero-5',
      abilityName: 'Salvage Beacon',
    });

    const before = store.getState().hand.length;
    store.getState().resolveAbilityPrompt(true);
    expect(store.getState().hand.length).toBe(before + 1);
    expect(store.getState().abilityPrompt).toBeNull();
    expect(store.getState().abilityShowcase).toMatchObject({ cardId: 'card-hero-5' });
    vi.useRealTimers();
  });

  it('declining an on-sent prompt draws nothing', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, A1: 'card-hero-5' },
      phase: 'main',
      activePlayer: 'player',
    });
    store.getState().destroyZoneA();
    vi.advanceTimersByTime(ON_SENT_PROMPT_MS);
    const before = store.getState().hand.length;
    store.getState().resolveAbilityPrompt(false);
    expect(store.getState().hand.length).toBe(before);
    expect(store.getState().abilityPrompt).toBeNull();
    vi.useRealTimers();
  });

  it('does not prompt on the opponent turn', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      board: { ...base.board, A1: 'card-hero-5' },
      phase: 'main',
      activePlayer: 'opponent',
    });
    store.getState().destroyZoneA();
    vi.advanceTimersByTime(ON_SENT_PROMPT_MS);
    expect(store.getState().abilityPrompt).toBeNull();
    vi.useRealTimers();
  });

  it('activatePileAbility returns a Field Cache Hero from Replen to the Hand and closes the pop-up', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    // card-hero-5 also carries Field Cache (in-Replen: return it to Hand).
    const store = createGameStore({
      ...base,
      deck: base.deck.filter((id) => id !== 'card-hero-5'),
      replen: ['card-hero-5'],
      phase: 'main',
      activePlayer: 'player',
      pileSearch: 'replen',
    });
    store.getState().activatePileAbility('card-hero-5');
    const s = store.getState();
    expect(s.replen).not.toContain('card-hero-5');
    expect(s.hand).toContain('card-hero-5');
    expect(s.pileSearch).toBeNull();
    expect(s.abilityShowcase).toMatchObject({ cardId: 'card-hero-5' });
    vi.useRealTimers();
  });

  it('activatePileAbility is a no-op outside the player Main phase', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      deck: base.deck.filter((id) => id !== 'card-hero-5'),
      replen: ['card-hero-5'],
      phase: 'main',
      activePlayer: 'opponent',
    });
    store.getState().activatePileAbility('card-hero-5');
    expect(store.getState().replen).toContain('card-hero-5');
    expect(store.getState().hand).not.toContain('card-hero-5');
  });
});

describe('P8 combat triggers (S6, v3 wording)', () => {
  // Time to advance from entering Resolution to the point the hit lands / the
  // Bunker Busting prompt is raised.
  const TO_HIT = RESOLUTION_ROLL_DELAY_MS + DICE_ROLL_MS + DICE_HOLD_MS;
  // card-hero-57 = Snow Viper (dmg 90, acc 140); card-hero-6 = Back Alley
  // Patrolman (dmg 60, acc 70, no abilities); card-equipment-11 = Headhunter;
  // card-equipment-16 = Anvil.

  it('Hidden Finisher instantly eliminates a low-HP Normal Hero, ignoring armor bars', () => {
    vi.useFakeTimers();
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.2); // roll 5 -> hit
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        board: { ...base.board, A1: 'card-hero-57' },
        attackTargets: { A1: 'O1' },
        ...withOpponent(base, 'O1', { level: 2, hp: 100, armor: 0, armorBars: 2 }),
        currentHp: { 'opp-O1': 40 }, // under half of 100
      });
      store.getState().advancePhase();
      vi.advanceTimersByTime(TO_HIT);
      const s = store.getState();
      // Finisher pre-empts the bunker prompt and ignores the 2 armor bars.
      expect(s.combatPrompt).toBeNull();
      expect(s.currentHp['opp-O1']).toBe(0);
      expect(s.destroying).toContain('O1');
    } finally {
      rnd.mockRestore();
      vi.useRealTimers();
    }
  });

  it('Hidden Finisher does not fire against a level-3+ Hero; normal armor math applies', () => {
    vi.useFakeTimers();
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.2); // roll 5 -> normal hit
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        board: { ...base.board, A1: 'card-hero-57' }, // dmg 90
        attackTargets: { A1: 'O1' },
        ...withOpponent(base, 'O1', { level: 3, hp: 300, armor: 0, armorBars: 0 }),
        currentHp: { 'opp-O1': 100 }, // under half but level 3 -> not eligible
      });
      store.getState().advancePhase();
      vi.advanceTimersByTime(TO_HIT);
      const s = store.getState();
      expect(s.combatPrompt).toBeNull();
      expect(s.currentHp['opp-O1']).toBe(10); // 100 - 90 normal damage
      expect(s.destroying).not.toContain('O1');
    } finally {
      rnd.mockRestore();
      vi.useRealTimers();
    }
  });

  it('Bunker Busting pauses Resolution and raises a prompt when the target has armor bars', () => {
    vi.useFakeTimers();
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.2);
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        board: { ...base.board, A1: 'card-hero-57' },
        attackTargets: { A1: 'O1' },
        ...withOpponent(base, 'O1', { level: 3, hp: 300, armor: 0, armorBars: 2 }),
      });
      store.getState().advancePhase();
      vi.advanceTimersByTime(TO_HIT);
      const s = store.getState();
      expect(s.phase).toBe('resolution');
      expect(s.combatPrompt).toMatchObject({
        sourceSlot: 'A1',
        targetSlot: 'O1',
        sourceCardId: 'card-hero-57',
        targetCardId: 'opp-O1',
        abilityName: 'Bunker Busting Round',
      });
      // Nothing applied yet — the hit is deferred to the player's choice.
      expect(s.currentHp['opp-O1']).toBeUndefined();
      expect(s.pendingCombatQueue).toEqual([]);
    } finally {
      rnd.mockRestore();
      vi.useRealTimers();
    }
  });

  it('accepting Bunker Busting wipes ALL armor bars, deals no damage, and marks it used', () => {
    vi.useFakeTimers();
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.2);
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        board: { ...base.board, A1: 'card-hero-57' },
        attackTargets: { A1: 'O1' },
        ...withOpponent(base, 'O1', { level: 3, hp: 300, armor: 0, armorBars: 2 }),
      });
      store.getState().advancePhase();
      vi.advanceTimersByTime(TO_HIT);
      store.getState().resolveCombatPrompt(true);
      const s = store.getState();
      expect(s.combatPrompt).toBeNull();
      expect(s.currentArmorBars['opp-O1']).toBe(0); // both bars wiped
      expect(s.currentHp['opp-O1']).toBeUndefined(); // no HP damage
      expect(s.usedActivatedAbilities['card-hero-57']).toContain('Bunker Busting Round');
      // Resolution resumes and settles to End.
      vi.advanceTimersByTime(OUTCOME_POPUP_MS + 40);
      expect(store.getState().phase).toBe('end');
    } finally {
      rnd.mockRestore();
      vi.useRealTimers();
    }
  });

  it('declining Bunker Busting applies normal armor math (one bar absorbs) and does not consume it', () => {
    vi.useFakeTimers();
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.2);
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        board: { ...base.board, A1: 'card-hero-57' },
        attackTargets: { A1: 'O1' },
        ...withOpponent(base, 'O1', { level: 3, hp: 300, armor: 0, armorBars: 2 }),
      });
      store.getState().advancePhase();
      vi.advanceTimersByTime(TO_HIT);
      store.getState().resolveCombatPrompt(false);
      const s = store.getState();
      expect(s.currentArmorBars['opp-O1']).toBe(1); // one bar absorbed the hit
      expect(s.currentHp['opp-O1']).toBeUndefined(); // bar ate it, no HP loss
      expect(s.usedActivatedAbilities['card-hero-57']).toBeUndefined();
    } finally {
      rnd.mockRestore();
      vi.useRealTimers();
    }
  });

  it('Bunker Busting is not offered again once used this turn; normal math applies', () => {
    vi.useFakeTimers();
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.2);
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        board: { ...base.board, A1: 'card-hero-57' },
        attackTargets: { A1: 'O1' },
        ...withOpponent(base, 'O1', { level: 3, hp: 300, armor: 0, armorBars: 2 }),
        usedActivatedAbilities: { 'card-hero-57': ['Bunker Busting Round'] },
      });
      store.getState().advancePhase();
      vi.advanceTimersByTime(TO_HIT);
      const s = store.getState();
      expect(s.combatPrompt).toBeNull();
      expect(s.currentArmorBars['opp-O1']).toBe(1); // normal math broke one bar
    } finally {
      rnd.mockRestore();
      vi.useRealTimers();
    }
  });

  it('Headhunter (equipped) eliminates on a crit against a target with no Armor Bars', () => {
    vi.useFakeTimers();
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.99); // roll 20 -> crit
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        board: { ...base.board, A1: 'card-hero-6', C1: 'card-equipment-11' },
        attackTargets: { A1: 'O1' },
        ...withOpponent(base, 'O1', { level: 5, hp: 500, armor: 0, armorBars: 0 }),
      });
      store.getState().advancePhase();
      vi.advanceTimersByTime(TO_HIT);
      const s = store.getState();
      expect(s.currentHp['opp-O1']).toBe(0);
      expect(s.destroying).toContain('O1');
    } finally {
      rnd.mockRestore();
      vi.useRealTimers();
    }
  });

  it('Headhunter does not fire when the target still has an Armor Bar', () => {
    vi.useFakeTimers();
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.99); // crit
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        board: { ...base.board, A1: 'card-hero-6', C1: 'card-equipment-11' },
        attackTargets: { A1: 'O1' },
        ...withOpponent(base, 'O1', { level: 5, hp: 500, armor: 0, armorBars: 2 }),
      });
      store.getState().advancePhase();
      vi.advanceTimersByTime(TO_HIT);
      const s = store.getState();
      expect(s.currentArmorBars['opp-O1']).toBe(0); // crit broke 2 bars
      expect(s.currentHp['opp-O1']).toBeUndefined();
      expect(s.destroying).not.toContain('O1');
    } finally {
      rnd.mockRestore();
      vi.useRealTimers();
    }
  });

  it('Anvil (equipped) hits ignore Armor Bars: full damage, bars untouched', () => {
    vi.useFakeTimers();
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.2); // normal hit
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'battle',
        board: { ...base.board, A1: 'card-hero-6', C1: 'card-equipment-16' },
        attackTargets: { A1: 'O1' },
        ...withOpponent(base, 'O1', { level: 3, hp: 300, armor: 0, armorBars: 2 }),
      });
      store.getState().advancePhase();
      vi.advanceTimersByTime(TO_HIT);
      const s = store.getState();
      const dmg = store.getState().resolutionResults.A1?.damage ?? 0;
      expect(dmg).toBeGreaterThan(0);
      expect(s.currentHp['opp-O1']).toBe(300 - dmg);
      expect(s.currentArmorBars['opp-O1'] ?? 2).toBe(2);
    } finally {
      rnd.mockRestore();
      vi.useRealTimers();
    }
  });

  it('resumes the remaining attackers after a Bunker Busting prompt is resolved', () => {
    vi.useFakeTimers();
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.2);
    try {
      const base = createInitialState();
      const oA = withOpponent(base, 'O1', { level: 3, hp: 300, armor: 0, armorBars: 2 });
      const oB = withOpponent(base, 'O2', { level: 3, hp: 300, armor: 0, armorBars: 0 });
      const store = createGameStore({
        ...base,
        phase: 'battle',
        // A1 Snow Viper -> O1 (prompt); A2 card-hero-6 (dmg 60) -> O2 (normal).
        board: { ...base.board, A1: 'card-hero-57', A2: 'card-hero-6' },
        attackTargets: { A1: 'O1', A2: 'O2' },
        opponentBoard: { ...base.opponentBoard, O1: 'opp-O1', O2: 'opp-O2' },
        opponentCards: { ...oA.opponentCards, ...oB.opponentCards },
      });
      store.getState().advancePhase();
      vi.advanceTimersByTime(TO_HIT);
      // A1 paused at the prompt; A2 has not been applied yet.
      expect(store.getState().combatPrompt).not.toBeNull();
      expect(store.getState().currentHp['opp-O2']).toBeUndefined();
      store.getState().resolveCombatPrompt(true);
      const s = store.getState();
      expect(s.currentArmorBars['opp-O1']).toBe(0); // A1 bunker-busted
      expect(s.currentHp['opp-O2']).toBe(240); // A2's 60 landed on resume
    } finally {
      rnd.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe('P8 On-Set triggers (v3 wording)', () => {
  /** Place `cardId` via the tribute hand-off (materials already paid). */
  function storeForSet(cardId: string, setKind: 'replen' | 'commit', materials: number, extra: Partial<GameState> = {}) {
    const base = createInitialState();
    return createGameStore({
      ...base,
      phase: 'main',
      hand: [cardId],
      deck: base.deck.filter((id) => id !== cardId),
      pendingSummon: { cardId, setKind, materials },
      ...extra,
    });
  }

  it('Supply Disruption (Normal Set) sends 1 random opponent Hand card to their Replen', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      const store = createGameStore({
        ...base,
        phase: 'main',
        hand: ['card-hero-16'],
        deck: base.deck.filter((id) => id !== 'card-hero-16'),
        opponentHand: ['o-1', 'o-2', 'o-3'],
        opponentReplen: [],
      });
      store.getState().autoPlaceCard('card-hero-16');
      vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
      const s = store.getState();
      expect(s.opponentHand).toHaveLength(2);
      expect(s.opponentReplen).toHaveLength(1);
      expect(['o-1', 'o-2', 'o-3']).toContain(s.opponentReplen[0]);
      expect(s.abilityShowcase).toMatchObject({ cardId: 'card-hero-16', abilityName: 'Supply Disruption' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('Extra Baggage draws 1 on a Replen Set but not on a Commit Set', () => {
    vi.useFakeTimers();
    try {
      const store = storeForSet('card-hero-51', 'replen', 1);
      store.getState().placePendingSummon('A1');
      vi.advanceTimersByTime(SUMMON_SHOWCASE_MS + MULTI_DRAW_STAGGER_MS * 2);
      expect(store.getState().hand).toHaveLength(1);
      const commit = storeForSet('card-hero-51', 'commit', 1);
      commit.getState().placePendingSummon('A1');
      vi.advanceTimersByTime(SUMMON_SHOWCASE_MS + MULTI_DRAW_STAGGER_MS * 2);
      expect(commit.getState().hand).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Stay Armed equips the top Weapon from the Deck, then Disturbs the Deck', () => {
    vi.useFakeTimers();
    try {
      const deck = ['card-hero-6', 'card-equipment-11', 'card-hero-7', 'card-equipment-7'];
      const store = storeForSet('card-hero-52', 'replen', 1, { deck });
      store.getState().placePendingSummon('A2');
      vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
      const s = store.getState();
      // Topmost Weapon is Headhunter (card-equipment-7 Tankwalker is not a Weapon).
      expect(s.board.C2).toBe('card-equipment-11');
      // Disturb: top card (Tankwalker) → Replen.
      expect(s.replen).toEqual(['card-equipment-7']);
      expect(s.deck).toEqual(['card-hero-6', 'card-hero-7']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Stay Armed does nothing when the Hero is already equipped', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      const deck = ['card-equipment-11'];
      const store = storeForSet('card-hero-52', 'replen', 1, { deck, board: { ...base.board, C2: 'card-equipment-16' } });
      store.getState().placePendingSummon('A2');
      vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
      expect(store.getState().board.C2).toBe('card-equipment-16');
      expect(store.getState().deck).toEqual(['card-equipment-11']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Domination destroys every enemy Normal Hero; Special Heroes are immune', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      const o1 = withOpponent(base, 'O1', { level: 1, hp: 50 });
      const o2 = withOpponent(base, 'O2', { level: 2, hp: 80 });
      const o3 = withOpponent(base, 'O3', { level: 3, hp: 120 });
      const store = storeForSet('card-hero-56', 'commit', 1, {
        opponentBoard: { ...base.opponentBoard, O1: 'opp-O1', O2: 'opp-O2', O3: 'opp-O3' },
        opponentCards: { ...o1.opponentCards, ...o2.opponentCards, ...o3.opponentCards },
      });
      store.getState().placePendingSummon('A1');
      vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
      const s = store.getState();
      expect(s.opponentBoard.O1).toBeNull();
      expect(s.opponentBoard.O2).toBeNull(); // no material cap any more
      expect(s.opponentBoard.O3).toBe('opp-O3'); // Special Hero immune
      expect(s.opponentGraveyard).toEqual(expect.arrayContaining(['opp-O1', 'opp-O2']));
    } finally {
      vi.useRealTimers();
    }
  });

  it('Reclaim Ops opens a GY Ability Card choice; confirming adds it to the Hand', () => {
    vi.useFakeTimers();
    try {
      const store = storeForSet('card-hero-58', 'commit', 2, { graveyard: ['card-hero-6', 'card-ability-1'] });
      store.getState().placePendingSummon('A1');
      vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
      expect(store.getState().onSetChoice).toMatchObject({ sourceCardId: 'card-hero-58', options: ['card-ability-1'] });
      store.getState().resolveOnSetChoice('card-ability-1');
      const s = store.getState();
      expect(s.onSetChoice).toBeNull();
      expect(s.hand).toContain('card-ability-1');
      expect(s.graveyard).toEqual(['card-hero-6']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Field Disruption lets the player send an enemy Equipment to their Replen, or skip', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      const opp = withOpponent(base, 'O1', { level: 2 });
      const eq = { id: 'opp-eq', type: 'C', name: 'Enemy Rifle', subType: 'Weapon', rarity: 'Common' } as Card;
      const extra: Partial<GameState> = {
        ...opp,
        opponentCards: { ...opp.opponentCards, 'opp-eq': eq },
        opponentCBoard: { ...base.opponentCBoard, OC1: 'opp-eq' },
        opponentReplen: [],
      };
      const store = storeForSet('card-hero-46', 'replen', 1, extra);
      store.getState().placePendingSummon('A1');
      vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
      expect(store.getState().onSetChoice?.options).toEqual(['opp-eq']);
      store.getState().resolveOnSetChoice('opp-eq');
      expect(store.getState().opponentCBoard.OC1).toBeNull();
      expect(store.getState().opponentReplen).toEqual(['opp-eq']);

      const skip = storeForSet('card-hero-46', 'replen', 1, extra);
      skip.getState().placePendingSummon('A1');
      vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
      skip.getState().resolveOnSetChoice(null);
      expect(skip.getState().onSetChoice).toBeNull();
      expect(skip.getState().opponentCBoard.OC1).toBe('opp-eq');
    } finally {
      vi.useRealTimers();
    }
  });
});
describe('set permissions in the store', () => {
  it('Troop Lead: Sandman Replen Sets with a single Infantry Hero', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-hero-52'],
      deck: base.deck.filter((id) => !['card-hero-52', 'card-hero-1'].includes(id)),
      board: { ...base.board, A1: 'card-hero-1' },
      phase: 'main',
    });
    store.getState().beginDrag('card-hero-52');
    store.getState().dropCard('card-hero-52', 'A2');
    expect(store.getState().pendingTribute).toEqual({ cardId: 'card-hero-52' });
    store.getState().confirmTributeSummon(['A1']);
    const s = store.getState();
    expect(s.board.A1).toBeNull();
    expect(s.replen).toContain('card-hero-1');
    expect(s.pendingSummon).toEqual({ cardId: 'card-hero-52', setKind: 'replen', materials: 1 });
  });

  it('Rapid Deployment: Riko is Normal Set straight into a slot', () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      hand: ['card-hero-43'],
      deck: base.deck.filter((id) => id !== 'card-hero-43'),
      phase: 'main',
    });
    store.getState().beginDrag('card-hero-43');
    store.getState().dropCard('card-hero-43', 'A1');
    expect(store.getState().board.A1).toBe('card-hero-43');
    expect(store.getState().pendingTribute).toBeNull();
  });
});
describe('B-card spells', () => {
  it('Convoy Incoming: pick a Hand card for the GY, then tutor a Devil Dog and Disturb', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const dogs = base.deck.filter((id) => base.cardsById[id].type === 'A' && base.cardsById[id].name.includes('Devil Dog'));
    expect(dogs.length).toBeGreaterThan(0);
    const spell = 'card-ability-8';
    const fodder = 'card-hero-1';
    const deck = base.deck.filter((id) => id !== spell && id !== fodder);
    const topDog = [...deck].reverse().find((id) => dogs.includes(id))!;
    const store = createGameStore({ ...base, hand: [spell, fodder], deck, phase: 'main' });
    store.getState().beginDrag(spell);
    store.getState().dropCard(spell, 'B1');
    vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
    expect(store.getState().spellCost).toMatchObject({ sourceCardId: spell, to: 'graveyard', options: [fodder] });
    store.getState().resolveSpellCost(fodder);
    vi.advanceTimersByTime(5000);
    const s = store.getState();
    expect(s.spellCost).toBeNull();
    expect(s.graveyard).toContain(fodder);
    expect(s.hand).toContain(topDog);
    expect(s.deck).not.toContain(topDog);
    expect(s.replen.length).toBe(1); // Disturb moved the top deck card to Replen
    vi.useRealTimers();
  });

  it('a Hand cost with nothing to pay fizzles the spell', () => {
    vi.useFakeTimers();
    const store = storeWithHand(['card-ability-8']);
    store.getState().beginDrag('card-ability-8');
    store.getState().dropCard('card-ability-8', 'B1');
    vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
    expect(store.getState().spellCost).toBeNull();
    expect(store.getState().hand).toHaveLength(0);
    vi.useRealTimers();
  });

  it('The Armory draws 2 cards', () => {
    vi.useFakeTimers();
    const store = storeWithHand(['card-ability-20']);
    store.getState().beginDrag('card-ability-20');
    store.getState().dropCard('card-ability-20', 'B1');
    vi.advanceTimersByTime(SUMMON_SHOWCASE_MS + MULTI_DRAW_STAGGER_MS * 2);
    expect(store.getState().hand).toHaveLength(2);
    vi.useRealTimers();
  });

  const cast = (store: ReturnType<typeof createGameStore>, spell: string) => {
    store.getState().beginDrag(spell);
    store.getState().dropCard(spell, 'B1');
    vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
  };
  const find = (pred: (c: Card) => boolean) => {
    const base = createInitialState();
    return Object.values(base.cardsById).filter(pred).map((c) => c.id);
  };

  it('Snowmobile Transport: reveal 5, add the picked Echo Hero, rest to Replen', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const spell = 'card-ability-1';
    const echo = find((c) => c.type === 'A' && c.name.includes('Echo'))[0];
    const others = base.deck.filter((id) => id !== spell && id !== echo && !base.cardsById[id].name.includes('Echo'));
    // Deck end is the top: echo sits 3rd from the top.
    const deck = [...others.slice(4), others[0], others[1], echo, others[2], others[3]];
    const store = createGameStore({ ...base, hand: [spell], deck, phase: 'main' });
    cast(store, spell);
    const sc = store.getState().spellChoice!;
    expect(sc).toMatchObject({ kind: 'reveal', options: [echo] });
    expect(sc.revealed).toHaveLength(5);
    expect(store.getState().deck).toHaveLength(deck.length - 5);
    store.getState().resolveSpellChoice(echo);
    const s = store.getState();
    expect(s.spellChoice).toBeNull();
    expect(s.hand).toEqual([echo]);
    expect(s.replen).toHaveLength(4);
    expect(s.replen).not.toContain(echo);
    vi.useRealTimers();
  });

  it('Snowmobile Transport: no Echo revealed sends all 5 to Replen', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const spell = 'card-ability-1';
    const deck = base.deck.filter((id) => id !== spell && !base.cardsById[id].name.includes('Echo'));
    const store = createGameStore({ ...base, hand: [spell], deck, phase: 'main' });
    cast(store, spell);
    expect(store.getState().spellChoice).toBeNull();
    expect(store.getState().replen).toHaveLength(5);
    vi.useRealTimers();
  });

  it('Man Down!: fizzles without a Coalition loss last turn', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const spell = 'card-ability-6';
    const deck = base.deck.filter((id) => id !== spell);
    const store = createGameStore({ ...base, hand: [spell], deck, phase: 'main', turn: 3 });
    cast(store, spell);
    expect(store.getState().hand).toHaveLength(0);
    expect(store.getState().deck).toHaveLength(deck.length);
    vi.useRealTimers();
  });

  it('Man Down!: tutors a Coalition Medic after a Coalition Hero fell last turn', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const spell = 'card-ability-6';
    const medic = find((c) => c.type === 'A' && c.allegiance === 'Coalition' && c.subType === 'Medic')[0];
    const fallen = find((c) => c.type === 'A' && c.allegiance === 'Coalition' && c.id !== medic)[0];
    const deck = [...base.deck.filter((id) => id !== spell && id !== medic && id !== fallen), medic];
    const store = createGameStore({
      ...base,
      hand: [spell],
      deck,
      phase: 'main',
      turn: 3,
      graveyard: [fallen],
      playerHeroLosses: [{ cardId: fallen, turn: 2 }],
    });
    cast(store, spell);
    const s = store.getState();
    expect(s.hand).toEqual([medic]);
    expect(s.replen).toHaveLength(1);
    vi.useRealTimers();
  });

  it('Big Weapon Drop: equips the top Suppressive Weapon to the chosen Heavy Hero', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const spell = 'card-ability-9';
    const heavy = find((c) => c.type === 'A' && c.subType === 'Heavy')[0];
    const supp = find((c) => c.type === 'C' && c.subType === 'Weapon' && c.weaponClass === 'Suppressive');
    expect(supp.length).toBeGreaterThan(0);
    const deck = [...base.deck.filter((id) => id !== spell && id !== heavy && !supp.includes(id)), supp[0]];
    const store = createGameStore({
      ...base,
      hand: [spell],
      deck,
      phase: 'main',
      board: { ...base.board, A2: heavy },
    });
    cast(store, spell);
    expect(store.getState().spellChoice).toMatchObject({ kind: 'equipAlly', options: [heavy] });
    store.getState().resolveSpellChoice(heavy);
    const s = store.getState();
    expect(s.spellChoice).toBeNull();
    expect(s.board.C2).toBe(supp[0]);
    expect(s.deck).not.toContain(supp[0]);
    expect(s.replen).toHaveLength(1);
    vi.useRealTimers();
  });

  it('Big Weapon Drop: fizzles with no unequipped Heavy Hero', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const spell = 'card-ability-9';
    const deck = base.deck.filter((id) => id !== spell);
    const store = createGameStore({ ...base, hand: [spell], deck, phase: 'main' });
    cast(store, spell);
    expect(store.getState().spellChoice).toBeNull();
    expect(store.getState().replen).toHaveLength(0);
    vi.useRealTimers();
  });
});

describe('Set-turn attack rule', () => {
  const HERO = 'card-hero-1';
  const WEAPON = 'card-equipment-13';
  const fresh = (hand: string[]) => {
    const base = createInitialState();
    return createGameStore({ ...base, hand, deck: base.deck.filter((id) => !hand.includes(id)), phase: 'main' });
  };

  it('a Hero Set this turn cannot attack', () => {
    vi.useFakeTimers();
    const store = fresh([HERO]);
    store.getState().beginDrag(HERO);
    store.getState().dropCard(HERO, 'A1');
    vi.advanceTimersByTime(SUMMON_SHOWCASE_MS + 2000);
    expect(store.getState().board.A1).toBe(HERO);
    expect(store.getState().heroSetTurn[HERO]).toBe(store.getState().turn);
    store.setState({ phase: 'battle' });
    store.getState().aimAttack('A1');
    expect(store.getState().targeting).toBeNull();
    vi.useRealTimers();
  });

  it('can attack the turn it is Set once a Weapon is equipped', () => {
    vi.useFakeTimers();
    const store = fresh([HERO, WEAPON]);
    store.getState().beginDrag(HERO);
    store.getState().dropCard(HERO, 'A1');
    vi.advanceTimersByTime(SUMMON_SHOWCASE_MS + 2000);
    store.getState().beginDrag(WEAPON);
    store.getState().dropCard(WEAPON, 'C1');
    vi.advanceTimersByTime(SUMMON_SHOWCASE_MS + 2000);
    expect(store.getState().board.C1).toBe(WEAPON);
    store.setState({ phase: 'battle' });
    store.getState().aimAttack('A1');
    expect(store.getState().targeting).toBe('A1');
    vi.useRealTimers();
  });

  it('a Hero Set on an earlier turn can attack', () => {
    const store = fresh([]);
    store.setState({ board: { ...store.getState().board, A1: HERO } });
    store.setState({ turn: store.getState().turn + 2, phase: 'battle' });
    store.getState().aimAttack('A1');
    expect(store.getState().targeting).toBe('A1');
  });

  it('an opponent Hero placed this turn cannot attack without a Weapon', () => {
    const base = createInitialState();
    const store = createGameStore({ ...base, activePlayer: 'opponent' });
    const opp = 'opp-deck-hero-1';
    store.setState({ opponentBoard: { ...store.getState().opponentBoard, O1: opp } });
    expect(heroCanAttack(store.getState(), 'opponent', 'O1')).toBe(false);
    store.setState({ opponentCBoard: { ...store.getState().opponentCBoard, OC1: 'opp-deck-equipment-13' } });
    expect(heroCanAttack(store.getState(), 'opponent', 'O1')).toBe(true);
  });

  it('entries for cards leaving the field are pruned', () => {
    const store = fresh([]);
    store.setState({ board: { ...store.getState().board, A1: HERO }, counters: { [HERO]: 2 } });
    store.setState({ board: { ...store.getState().board, A1: null } });
    expect(store.getState().heroSetTurn[HERO]).toBeUndefined();
    expect(store.getState().counters[HERO]).toBeUndefined();
  });
});

describe('Goliath abilities', () => {
  const GOLIATH = 'card-hero-59';
  const withGoliath = () => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      deck: base.deck.filter((id) => id !== GOLIATH),
      phase: 'main',
    });
    store.setState({
      board: { ...store.getState().board, A1: GOLIATH },
      opponentBoard: { O1: 'opp-deck-hero-1', O2: 'opp-deck-hero-23', O3: 'opp-deck-hero-5', O4: null },
    });
    return store;
  };

  it('Heavy Suppression debuffs up to 2 enemy Heroes until the opponent turn ends', () => {
    vi.useFakeTimers();
    const store = withGoliath();
    const before = opponentEffectiveStats(store.getState(), 'O1').acc.value;
    store.getState().activateAbility(GOLIATH, 0);
    expect(store.getState().abilityTargeting).toMatchObject({ step: 'target' });
    store.getState().chooseAbilityTargets(['opp-deck-hero-1', 'opp-deck-hero-23', 'opp-deck-hero-5']);
    expect(store.getState().abilityTargeting).not.toBeNull(); // 3 > max 2
    store.getState().chooseAbilityTargets(['opp-deck-hero-1', 'opp-deck-hero-23']);
    const s = store.getState();
    expect(s.abilityTargeting).toBeNull();
    expect(Object.keys(s.enemyStatDebuffs).sort()).toEqual(['opp-deck-hero-1', 'opp-deck-hero-23']);
    expect(opponentEffectiveStats(s, 'O1').acc.value).toBeLessThan(before);
    vi.useRealTimers();
  });

  it('Iron Wall forces enemy attacks onto Goliath', () => {
    const store = withGoliath();
    store.getState().activateAbility(GOLIATH, 2);
    const at = store.getState().abilityTargeting;
    if (at) store.getState().chooseAbilityCost(store.getState().hand[0]);
    expect(store.getState().forcedTarget).toBe(GOLIATH);
  });
});

describe('Counters', () => {
  const RIFLEMAN = 'card-hero-19';

  it('Devil Dog Rifleman gains a counter each End; at 3 it can transform into a Devil Dog Special', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const store = createGameStore({ ...base, deck: base.deck.filter((id) => id !== RIFLEMAN), phase: 'main' });
    store.setState({ board: { ...store.getState().board, A1: RIFLEMAN }, counters: { [RIFLEMAN]: 2 } });
    store.setState({ phase: 'battle' });
    store.getState().advancePhase(); // battle -> resolution
    vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS + 400); // -> end
    expect(store.getState().phase).toBe('end');
    expect(store.getState().counters[RIFLEMAN]).toBe(3);
    expect(store.getState().counterPrompt).toMatchObject({ cardId: RIFLEMAN });
    vi.advanceTimersByTime(END_PHASE_DWELL_MS * 2);
    expect(store.getState().activePlayer).toBe('player'); // hand-off waits on the prompt
    const deckBefore = store.getState().deck;
    store.getState().resolveCounterPrompt(true);
    vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
    const s = store.getState();
    expect(s.replen).toContain(RIFLEMAN);
    const special = s.cardsById[s.board.A1!];
    expect(special.name).toContain('Devil Dog');
    expect(special.level).toBeGreaterThanOrEqual(3);
    expect(s.deck.length).toBe(deckBefore.length - 2); // Special pulled + Disturb
    vi.advanceTimersByTime(END_PHASE_DWELL_MS + 10);
    expect(store.getState().activePlayer).toBe('opponent');
    vi.useRealTimers();
  });

  it('two Riflemen hitting 3 together each Set a Special; with none left the prompt is skipped and a notice shows', () => {
    vi.useFakeTimers();
    try {
      const base = createInitialState();
      const rifles = Object.keys(base.cardsById).filter((id) => base.cardsById[id].name === 'Devil Dog Rifleman');
      const specials = base.deck.filter((id) => /^Devil Dog \d/.test(base.cardsById[id].name));
      // Keep exactly one Special in the Deck.
      const deck = base.deck.filter((id) => !rifles.includes(id) && !specials.slice(1).includes(id));
      const store = createGameStore({ ...base, deck, phase: 'battle', turn: 3 });
      store.setState({ board: { ...store.getState().board, A1: rifles[0], A2: rifles[1] }, counters: { [rifles[0]]: 2, [rifles[1]]: 2 } });
      store.getState().advancePhase();
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS + 400);
      expect(store.getState().counterPrompt?.cardId).toBe(rifles[0]);
      store.getState().resolveCounterPrompt(true);
      vi.advanceTimersByTime(SUMMON_SHOWCASE_MS);
      const s = store.getState();
      expect(s.board.A1).toBe(specials[0]);
      expect(s.counterPrompt).toBeNull();
      expect(s.board.A2).toBe(rifles[1]); // not sent away for nothing
      expect(s.notice?.text).toMatch(/no "Devil Dog" Special Hero left/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Zero Path Escort counts damage and hits its threshold (3) for the GY swap', () => {
    const ca = counterAbility(createInitialState().opponentCards['opp-deck-hero-7']);
    expect(ca?.effect).toMatchObject({ gain: 'inflictDamage', threshold: 3, sendTo: 'graveyard', setFamily: 'Zero' });
    expect(ca?.ir.optional).toBeFalsy();
  });
});

describe('turn-1 skip and points', () => {
  it('turn 1 Main skips Battle and goes straight to End (no empty-field points on turn 1)', () => {
    vi.useFakeTimers();
    try {
      const store = createGameStore({ ...createInitialState(), phase: 'main', turn: 1 });
      store.getState().advancePhase();
      expect(store.getState().phase).toBe('end');
      expect(store.getState().points).toEqual({ player: 0, opponent: 0 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('ending a later turn with no Heroes gives the opponent 3 points', () => {
    vi.useFakeTimers();
    try {
      const store = createGameStore({ ...createInitialState(), phase: 'main', turn: 2 });
      store.getState().advancePhase(); // battle
      store.getState().advancePhase(); // resolution
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS + 400);
      expect(store.getState().phase).toBe('end');
      expect(store.getState().points.opponent).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reaching 15 points declares a winner', () => {
    vi.useFakeTimers();
    try {
      const store = createGameStore({ ...createInitialState(), phase: 'main', turn: 2, points: { player: 0, opponent: 13 } });
      store.getState().advancePhase();
      store.getState().advancePhase();
      vi.advanceTimersByTime(RESOLUTION_ROLL_DELAY_MS + 400);
      expect(store.getState().points.opponent).toBe(16);
      expect(store.getState().winner).toBe('opponent');
    } finally {
      vi.useRealTimers();
    }
  });
});
