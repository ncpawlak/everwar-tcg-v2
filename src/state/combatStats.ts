import type { GameState, SlotId, StatBuff, StatKey } from './types';

/**
 * Pure combat-stat math (Phase 3). An A card's shown stats are its base values
 * plus the boost from a linked C card, if one is set. Keeping this side-effect
 * free lets the overlay render effective values + per-stat deltas and lets tests
 * assert the buff math directly.
 */

export const STAT_KEYS: readonly StatKey[] = ['hp', 'atk', 'def'];

/** Amounts a C-card boost can roll (world units, hundreds like the base stats). */
export const BUFF_AMOUNTS: readonly number[] = [100, 200, 300, 400, 500, 600];

/** The C slot linked to an A slot in the same column (A3 -> C3). */
export function linkedCSlot(aSlot: SlotId): SlotId {
  return `C${aSlot[1]}` as SlotId;
}

/**
 * Roll a random C-card boost: a random stat raised by a random amount. `rand`
 * is injectable so tests are deterministic. Positive by design for now (C cards
 * increase a stat); the signed `amount` keeps room for future debuffs.
 */
export function rollCBuff(rand: () => number = Math.random): StatBuff {
  const stat = STAT_KEYS[Math.floor(rand() * STAT_KEYS.length)];
  const amount = BUFF_AMOUNTS[Math.floor(rand() * BUFF_AMOUNTS.length)];
  return { stat, amount };
}

/** One effective stat: its final value and how much a buff shifted it. */
export interface StatLine {
  value: number;
  /** Signed delta vs. base (0 = unmodified, >0 = boosted, <0 = reduced). */
  delta: number;
}

export interface EffectiveStats {
  hp: StatLine;
  atk: StatLine;
  def: StatLine;
}

/**
 * Effective stats for the A card in `aSlot`: its base hp/atk/def plus the boost
 * from the linked C card, if that C slot holds a card carrying a buff. Because
 * this reads live board occupancy, removing the C card reverts the boost.
 */
export function effectiveStats(state: GameState, aSlot: SlotId): EffectiveStats {
  const aId = state.board[aSlot];
  const card = aId ? state.cardsById[aId] : undefined;
  const base = {
    hp: card?.hp ?? 0,
    atk: card?.atk ?? 0,
    def: card?.def ?? 0,
  };

  const cId = state.board[linkedCSlot(aSlot)];
  const buff = cId ? state.cardsById[cId]?.buff : undefined;

  const line = (stat: StatKey): StatLine => {
    const delta = buff && buff.stat === stat ? buff.amount : 0;
    return { value: base[stat] + delta, delta };
  };

  return { hp: line('hp'), atk: line('atk'), def: line('def') };
}
