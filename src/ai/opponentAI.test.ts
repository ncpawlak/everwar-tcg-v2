import { afterEach, describe, expect, it, vi } from 'vitest';
import { planAttacks, shouldMulligan } from './opponentAI';
import { createGameStore, OPP_EFFECT_STEP_MS, OPP_MAIN_DURATION_MS, OPP_PHASE_STEP_MS, OPP_PLAY_GAP_MS, OPP_PLAY_SHOWCASE_MS, OPP_PLAY_STEP_MS, SHUFFLE_SPREAD_MS } from '../state/gameStore';
import { createInitialState, OPENING_HAND_SIZE } from '../state/cardData';
import { requiresTribute } from '../board/slotRules';
import type { Card, GameState } from '../state/types';
import { MULTI_DRAW_STAGGER_MS } from '../animation/motionConfig';

const oppFind = (s: GameState, pred: (c: Card) => boolean, skip: string[] = []) =>
  Object.values(s.opponentCards).find((c) => pred(c) && !skip.includes(c.id))!;

afterEach(() => {
  vi.useRealTimers();
});

describe('planAttacks', () => {
  const targets = [
    { slot: 'A1' as const, hp: 40, bars: 0, level: 1 },
    { slot: 'A2' as const, hp: 8, bars: 0, level: 2 },
  ];

  it('Normal goes for a Hero it can finish', () => {
    const out = planAttacks({ attackers: [{ slot: 'O1', dmg: 10 }], targets, forced: null, difficulty: 'normal' });
    expect(out.O1).toBe('A2');
  });

  it('Hard focuses fire: after a kill, the next attacker moves on', () => {
    const out = planAttacks({
      attackers: [
        { slot: 'O1', dmg: 10 },
        { slot: 'O2', dmg: 30 },
      ],
      targets: [
        { slot: 'A1', hp: 30, bars: 0, level: 3 },
        { slot: 'A2', hp: 8, bars: 0, level: 1 },
      ],
      forced: null,
      difficulty: 'hard',
    });
    // The 30-DMG hitter takes the level-3 kill; the 10-DMG one finishes the level-1.
    expect(out.O2).toBe('A1');
    expect(out.O1).toBe('A2');
  });

  it('a forced target (Iron Wall) overrides every difficulty', () => {
    const out = planAttacks({ attackers: [{ slot: 'O1', dmg: 10 }], targets, forced: 'A1', difficulty: 'hard' });
    expect(out.O1).toBe('A1');
  });
});

describe('shouldMulligan', () => {
  it('Easy never mulligans; Normal does with no free Hero in hand', () => {
    const s = createInitialState();
    const noHeroes = Object.values(s.opponentCards)
      .filter((c) => c.type !== 'A')
      .slice(0, 5)
      .map((c) => c.id);
    expect(shouldMulligan(noHeroes, s.opponentCards, 'easy')).toBe(false);
    expect(shouldMulligan(noHeroes, s.opponentCards, 'normal')).toBe(true);
  });
});

describe('mulligan + difficulty flow', () => {
  it('chooseDifficulty locks in the first pick', () => {
    const store = createGameStore(createInitialState());
    store.getState().chooseDifficulty('hard');
    store.getState().chooseDifficulty('easy');
    expect(store.getState().difficulty).toBe('hard');
  });

  it('mulligan shuffles the hand back, redraws 5, then starts turn 1 — only once', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const hand = base.deck.slice(-OPENING_HAND_SIZE);
    const store = createGameStore({ ...base, deck: base.deck.slice(0, -OPENING_HAND_SIZE), hand, difficulty: 'easy' });
    const total = base.deck.length;
    store.getState().offerMulligan();
    expect(store.getState().mulligan).toBe('offer');
    store.getState().resolveMulligan(true);
    expect(store.getState().hand).toEqual([]);
    expect(store.getState().deck.length).toBe(total);
    vi.advanceTimersByTime(SHUFFLE_SPREAD_MS + 250 + OPENING_HAND_SIZE * MULTI_DRAW_STAGGER_MS + 750);
    const s = store.getState();
    expect(s.mulligan).toBe('done');
    expect(s.phase).toBe('draw');
    expect(s.hand.length).toBeGreaterThanOrEqual(OPENING_HAND_SIZE);
    // A second mulligan is refused.
    store.getState().offerMulligan();
    expect(store.getState().mulligan).toBe('done');
  });

  it('Keep goes straight to turn 1 Draw', () => {
    vi.useFakeTimers();
    const store = createGameStore({ ...createInitialState(), difficulty: 'normal' });
    store.getState().offerMulligan();
    store.getState().resolveMulligan(false);
    expect(store.getState().phase).toBe('draw');
  });
});

describe('CPU turn by difficulty', () => {
  /** Hand the turn to the CPU from the player's End phase. */
  const startCpuTurn = (state: Partial<GameState>) => {
    const base = createInitialState();
    const store = createGameStore({
      ...base,
      phase: 'end',
      activePlayer: 'player',
      turn: 2,
      opponentDeck: [],
      ...state,
    });
    store.getState().advancePhase();
    return store;
  };

  const freeHeroes = (s: GameState, n: number) => {
    const out: string[] = [];
    const names = new Set<string>();
    for (const c of Object.values(s.opponentCards)) {
      if (c.type === 'A' && !requiresTribute(c) && !names.has(c.name)) {
        out.push(c.id);
        names.add(c.name);
      }
      if (out.length === n) break;
    }
    return out;
  };

  it('Normal fills multiple columns in one turn (Easy sets just one Hero)', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const hand = freeHeroes(base, 3);
    const normal = startCpuTurn({ opponentHand: hand, difficulty: 'normal' });
    vi.advanceTimersByTime(OPP_PHASE_STEP_MS + 3 * OPP_PLAY_STEP_MS + 100);
    expect(Object.values(normal.getState().opponentBoard).filter(Boolean).length).toBe(3);

    const easy = startCpuTurn({ opponentHand: hand, difficulty: 'easy' });
    vi.advanceTimersByTime(OPP_PHASE_STEP_MS + 3 * OPP_PLAY_STEP_MS + 100);
    expect(Object.values(easy.getState().opponentBoard).filter(Boolean).length).toBe(1);
  });

  it('Normal tribute Sets a level-3 Hero, sending the materials to Replen', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const big = oppFind(base, (c) => c.type === 'A' && c.level === 3 && !c.commander && requiresTribute(c));
    const l1 = oppFind(base, (c) => c.type === 'A' && c.level === 1 && !requiresTribute(c));
    const l2 = oppFind(base, (c) => c.type === 'A' && c.level === 2 && !requiresTribute(c));
    const store = startCpuTurn({
      difficulty: 'normal',
      opponentHand: [big.id],
      opponentBoard: { ...base.opponentBoard, O1: l1.id, O2: l2.id, O3: null, O4: null },
    });
    vi.advanceTimersByTime(OPP_PHASE_STEP_MS + OPP_PLAY_STEP_MS);
    const s = store.getState();
    expect(Object.values(s.opponentBoard)).toContain(big.id);
    expect(s.opponentReplen).toEqual(expect.arrayContaining([l1.id, l2.id]));
  });

  it('a tribute Set keeps the best material Equipment on the new Hero', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const big = oppFind(base, (c) => c.type === 'A' && c.level === 3 && !c.commander && requiresTribute(c));
    const l1 = oppFind(base, (c) => c.type === 'A' && c.level === 1 && !requiresTribute(c));
    const l2 = oppFind(base, (c) => c.type === 'A' && c.level === 2 && !requiresTribute(c));
    const eq = oppFind(base, (c) => c.type === 'C' && c.subType === 'Weapon');
    const store = startCpuTurn({
      difficulty: 'normal',
      opponentHand: [big.id],
      opponentBoard: { ...base.opponentBoard, O1: l1.id, O2: l2.id, O3: null, O4: null },
      opponentCBoard: { ...base.opponentCBoard, OC1: eq.id },
    });
    vi.advanceTimersByTime(OPP_PHASE_STEP_MS + OPP_PLAY_STEP_MS);
    const s = store.getState();
    const slot = (Object.keys(s.opponentBoard) as (keyof typeof s.opponentBoard)[]).find((k) => s.opponentBoard[k] === big.id)!;
    expect(s.opponentCBoard[`OC${slot[1]}` as keyof typeof s.opponentCBoard]).toBe(eq.id);
    expect(s.opponentReplen).not.toContain(eq.id);
  });

  it('a spell resolves step by step and the next play waits for it to settle', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const tc = oppFind(base, (c) => c.name === 'Team Contingency');
    const [fodder] = freeHeroes(base, 1);
    const allegiance = base.opponentCards[fodder].allegiance;
    const found = oppFind(
      base,
      (c) => c.type === 'A' && !requiresTribute(c) && c.allegiance === allegiance && c.name !== base.opponentCards[fodder].name,
    );
    // Battle-timed Abilities (with no targets) pad the deck so the Draw phase
    // can't pull the target and the search can't match them.
    const fillers = Object.values(base.opponentCards)
      .filter((c) => c.type === 'B' && (c.timing ?? '').toLowerCase() === 'battle')
      .slice(0, 8)
      .map((c) => c.id);
    const store = startCpuTurn({ difficulty: 'normal', opponentHand: [tc.id, fodder], opponentDeck: [found.id, ...fillers] });

    // Showcase lands: the cost is paid, nothing searched yet.
    vi.advanceTimersByTime(OPP_PHASE_STEP_MS + OPP_PLAY_SHOWCASE_MS + 10);
    const deck = store.getState().opponentDeck;
    const filler = { id: deck[deck.length - 1] };
    expect(store.getState().opponentGraveyard).toContain(fodder);
    expect(store.getState().opponentHand).not.toContain(found.id);
    // Next step: the search adds the Hero to hand, and the CPU hasn't jumped ahead.
    vi.advanceTimersByTime(OPP_EFFECT_STEP_MS);
    expect(store.getState().opponentHand).toContain(found.id);
    expect(store.getState().opponentDeck).toContain(filler.id);
    // Next step: disturb. Still nothing Set while the effect plays out.
    vi.advanceTimersByTime(OPP_EFFECT_STEP_MS);
    expect(store.getState().opponentReplen).toContain(filler.id);
    expect(Object.values(store.getState().opponentBoard).filter(Boolean)).toEqual([]);
    // Once the last step settles, the searched Hero is Set.
    vi.advanceTimersByTime(OPP_EFFECT_STEP_MS + OPP_PLAY_GAP_MS + 10);
    expect(Object.values(store.getState().opponentBoard)).toContain(found.id);
  });

  it('Disarm destroys a player Weapon during the CPU Battle phase', () => {
    vi.useFakeTimers();
    const base = createInitialState();
    const disarm = oppFind(base, (c) => c.name === 'Disarm');
    const hero = Object.values(base.cardsById).find((c) => c.type === 'A')!;
    const weapon = Object.values(base.cardsById).find((c) => c.type === 'C' && c.subType === 'Weapon')!;
    const store = startCpuTurn({
      difficulty: 'normal',
      opponentHand: [disarm.id],
      board: { ...base.board, A1: hero.id, C1: weapon.id },
    });
    vi.advanceTimersByTime(OPP_PHASE_STEP_MS + OPP_MAIN_DURATION_MS + OPP_PLAY_SHOWCASE_MS + 100);
    const s = store.getState();
    expect(s.board.C1).toBeNull();
    expect(s.graveyard).toContain(weapon.id);
    expect(s.board.A1).toBe(hero.id);
  });
});
