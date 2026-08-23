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
    const state: GameState = { ...base, board: { ...base.board, A1: 'card-A1' } };
    const card = state.cardsById['card-A1'];
    const eff = effectiveStats(state, 'A1');
    expect(eff.atk).toEqual({ value: card.atk, delta: 0 });
    expect(eff.def).toEqual({ value: card.def, delta: 0 });
    expect(eff.hp).toEqual({ value: card.hp, delta: 0 });
  });

  it('effectiveStats adds the linked C card buff to the matching stat only', () => {
    const base = createInitialState();
    const buffed = { ...base.cardsById['card-C1'], buff: { stat: 'atk' as const, amount: 300 } };
    const state: GameState = {
      ...base,
      board: { ...base.board, A1: 'card-A1', C1: 'card-C1' },
      cardsById: { ...base.cardsById, 'card-C1': buffed },
    };
    const card = state.cardsById['card-A1'];
    const eff = effectiveStats(state, 'A1');
    expect(eff.atk).toEqual({ value: card.atk + 300, delta: 300 });
    expect(eff.def).toEqual({ value: card.def, delta: 0 });
    expect(eff.hp).toEqual({ value: card.hp, delta: 0 });
  });

  it('removing the C card reverts the boost (buff is presence-based)', () => {
    const base = createInitialState();
    const buffed = { ...base.cardsById['card-C1'], buff: { stat: 'def' as const, amount: 500 } };
    const withC: GameState = {
      ...base,
      board: { ...base.board, A1: 'card-A1', C1: 'card-C1' },
      cardsById: { ...base.cardsById, 'card-C1': buffed },
    };
    expect(effectiveStats(withC, 'A1').def.delta).toBe(500);
    // C1 removed from the board -> no boost, even though the card still carries buff data.
    const withoutC: GameState = { ...withC, board: { ...withC.board, C1: null } };
    expect(effectiveStats(withoutC, 'A1').def.delta).toBe(0);
  });
});
