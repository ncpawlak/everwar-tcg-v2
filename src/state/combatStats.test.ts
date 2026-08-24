import { describe, it, expect } from 'vitest';
import { effectiveStats, linkedCSlot, rollCBuff, BUFF_AMOUNTS, STAT_KEYS } from './combatStats';
import { createInitialState } from './cardData';
import type { GameState } from './types';

describe('combatStats', () => {
  it('linkedCSlot maps an A slot to its column C slot', () => {
    expect(linkedCSlot('A1')).toBe('C1');
    expect(linkedCSlot('A4')).toBe('C4');
  });

  it('rollCBuff returns a valid stat + amount and is deterministic for a fixed rng', () => {
    const buff = rollCBuff(() => 0);
    expect(STAT_KEYS).toContain(buff.stat);
    expect(BUFF_AMOUNTS).toContain(buff.amount);
    expect(rollCBuff(() => 0)).toEqual(buff);
    // A near-1 rng lands on the last option of each list.
    const high = rollCBuff(() => 0.999);
    expect(high).toEqual({ stat: STAT_KEYS[STAT_KEYS.length - 1], amount: BUFF_AMOUNTS[BUFF_AMOUNTS.length - 1] });
  });

  it('effectiveStats returns base values with zero deltas when no C card is linked', () => {
    const base = createInitialState();
    const state: GameState = { ...base, board: { ...base.board, A1: 'card-hero-6' } };
    const card = state.cardsById['card-hero-6'];
    const eff = effectiveStats(state, 'A1');
    expect(eff.dmg).toEqual({ value: card.dmg, delta: 0 });
    expect(eff.acc).toEqual({ value: card.acc, delta: 0 });
    expect(eff.hp).toEqual({ value: card.hp, delta: 0 });
  });

  it('effectiveStats adds the linked C card buff to the matching stat only', () => {
    const base = createInitialState();
    const buffed = { ...base.cardsById['card-equipment-1'], buff: { stat: 'dmg' as const, amount: 300 } };
    const state: GameState = {
      ...base,
      board: { ...base.board, A1: 'card-hero-6', C1: 'card-equipment-1' },
      cardsById: { ...base.cardsById, 'card-equipment-1': buffed },
    };
    const card = state.cardsById['card-hero-6'];
    const eff = effectiveStats(state, 'A1');
    expect(eff.dmg).toEqual({ value: card.dmg! + 300, delta: 300 });
    expect(eff.acc).toEqual({ value: card.acc, delta: 0 });
    expect(eff.hp).toEqual({ value: card.hp, delta: 0 });
  });

  it('removing the C card reverts the boost (buff is presence-based)', () => {
    const base = createInitialState();
    const buffed = { ...base.cardsById['card-equipment-1'], buff: { stat: 'acc' as const, amount: 500 } };
    const withC: GameState = {
      ...base,
      board: { ...base.board, A1: 'card-hero-6', C1: 'card-equipment-1' },
      cardsById: { ...base.cardsById, 'card-equipment-1': buffed },
    };
    expect(effectiveStats(withC, 'A1').acc.delta).toBe(500);
    // C1 removed from the board -> no boost, even though the card still carries buff data.
    const withoutC: GameState = { ...withC, board: { ...withC.board, C1: null } };
    expect(effectiveStats(withoutC, 'A1').acc.delta).toBe(0);
  });

  it('P8: an Echo Assist source on the board raises ACC of every Echo Hero, itself included', () => {
    const base = createInitialState();
    // card-hero-2 = Echo Reserve (carries Echo Assist, base acc 60);
    // card-hero-9 = Echo Demolitions (Echo, base acc 80, no ability of its own).
    const echoSource = base.cardsById['card-hero-2'];
    const echoAlly = base.cardsById['card-hero-9'];
    const state: GameState = { ...base, board: { ...base.board, A1: 'card-hero-2', A2: 'card-hero-9' } };
    // The aura source buffs itself...
    expect(effectiveStats(state, 'A1').acc).toEqual({ value: echoSource.acc! + 10, delta: 10 });
    // ...and its Echo ally.
    expect(effectiveStats(state, 'A2').acc).toEqual({ value: echoAlly.acc! + 10, delta: 10 });
    // Non-ACC stats untouched.
    expect(effectiveStats(state, 'A1').dmg.delta).toBe(0);
  });

  it('P8: Echo Assist ignores non-Echo Heroes and reverts when its source leaves the board', () => {
    const base = createInitialState();
    // card-hero-1 = Duneside Scout (not an Echo Hero).
    const scout = base.cardsById['card-hero-1'];
    const withAura: GameState = { ...base, board: { ...base.board, A1: 'card-hero-2', A2: 'card-hero-1' } };
    expect(effectiveStats(withAura, 'A2').acc).toEqual({ value: scout.acc!, delta: 0 });
    // Remove the Echo Assist source: the aura is board-derived, so it vanishes.
    const echoSelf = base.cardsById['card-hero-2'];
    const withoutSource: GameState = { ...withAura, board: { ...withAura.board, A1: null } };
    expect(effectiveStats(withoutSource, 'A2').acc.delta).toBe(0);
    // And re-adding a lone Echo source with no ally still self-buffs.
    const soloSource: GameState = { ...base, board: { ...base.board, A3: 'card-hero-2' } };
    expect(effectiveStats(soloSource, 'A3').acc).toEqual({ value: echoSelf.acc! + 10, delta: 10 });
  });
});
