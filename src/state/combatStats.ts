import type { Card, GameState, OppCSlotId, OppSlotId, SlotId, StatBuff, StatKey } from './types';
import { collectAuras, auraStatDelta, type SideField } from '../abilities/auras';
import type { AuraStat } from '../abilities/abilityIR';

/**
 * Pure combat-stat math (Phase 3). An A card's shown stats are its base values
 * plus the boost from a linked C card, if one is set. Keeping this side-effect
 * free lets the overlay render effective values + per-stat deltas and lets tests
 * assert the buff math directly.
 */

export const STAT_KEYS: readonly StatKey[] = ['hp', 'dmg', 'acc'];

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
  dmg: StatLine;
  acc: StatLine;
}

/** Hero (A) cards a side controls on its A-board, for aura collection. */
export function boardHeroes(board: Record<string, string | null>, lookup: Record<string, Card>): Card[] {
  const out: Card[] = [];
  for (const id of Object.values(board)) {
    const c = id ? lookup[id] : undefined;
    if (c && c.type === 'A') out.push(c);
  }
  return out;
}

/** The player's field for the aura runtime: A-board Heroes + the Equipment in
 *  each Hero's linked C slot (A2 → C2). */
export function playerField(state: GameState): SideField {
  return {
    heroes: boardHeroes(state.board, state.cardsById),
    equipmentOf: (heroId) => {
      const slot = (Object.keys(state.board) as SlotId[]).find((k) => k[0] === 'A' && state.board[k] === heroId);
      const cId = slot ? state.board[linkedCSlot(slot)] : null;
      return cId ? state.cardsById[cId] : undefined;
    },
  };
}

/** The opponent's field for the aura runtime: O-board Heroes + the Equipment in
 *  each Hero's linked OC slot (O2 → OC2). */
export function opponentField(state: GameState): SideField {
  return {
    heroes: boardHeroes(state.opponentBoard, state.opponentCards),
    equipmentOf: (heroId) => {
      const slot = (Object.keys(state.opponentBoard) as OppSlotId[]).find((k) => state.opponentBoard[k] === heroId);
      const cId = slot ? state.opponentCBoard[`OC${slot[1]}` as OppCSlotId] : null;
      return cId ? state.opponentCards[cId] : undefined;
    },
  };
}

/** Total passive-aura delta on one of the PLAYER's Heroes: the player's own
 *  ally auras plus the opponent's enemy-targeting auras. */
export function playerAuraDelta(state: GameState, card: Card, stat: AuraStat): number {
  return (
    auraStatDelta(collectAuras(playerField(state)), card, stat, 'ally') +
    auraStatDelta(collectAuras(opponentField(state)), card, stat, 'enemy')
  );
}

/** Total passive-aura delta on one of the OPPONENT's Heroes (mirror). */
export function opponentAuraDelta(state: GameState, card: Card, stat: AuraStat): number {
  return (
    auraStatDelta(collectAuras(opponentField(state)), card, stat, 'ally') +
    auraStatDelta(collectAuras(playerField(state)), card, stat, 'enemy')
  );
}

/**
 * Effective stats for the A card in `aSlot`: its base hp/dmg/acc plus the boost
 * from the linked C card, if that C slot holds a card carrying a buff, plus any
 * passive stat-auras the controller has active (Phase 8). Because this reads
 * live board occupancy, removing the C card or the aura source reverts the
 * boost with no cleanup code.
 */
export function effectiveStats(state: GameState, aSlot: SlotId): EffectiveStats {
  const aId = state.board[aSlot];
  const card = aId ? state.cardsById[aId] : undefined;
  const base = {
    hp: card?.hp ?? 0,
    dmg: card?.dmg ?? 0,
    acc: card?.acc ?? 0,
  };

  const cId = state.board[linkedCSlot(aSlot)];
  const buff = cId ? state.cardsById[cId]?.buff : undefined;
  const selfBuff = aId ? state.activatedStatBuffs[aId] : undefined;
  const turnBuff = aId ? state.turnStatBuffs?.[aId] : undefined;

  const line = (stat: StatKey): StatLine => {
    const cDelta = buff && buff.stat === stat ? buff.amount : 0;
    const aDelta = card ? playerAuraDelta(state, card, stat) : 0;
    const sDelta = (selfBuff?.[stat] ?? 0) + (turnBuff?.[stat] ?? 0);
    const delta = cDelta + aDelta + sDelta;
    return { value: base[stat] + delta, delta };
  };

  return { hp: line('hp'), dmg: line('dmg'), acc: line('acc') };
}

/**
 * Effective stats for the OPPONENT A card in `oppSlot` (Phase 7): its base
 * hp/dmg/acc plus the boost from the linked opponent C card, if that OC slot
 * holds a card carrying a buff. Mirror of `effectiveStats` but reading the
 * opponent's board + card lookup, used when the opponent attacks on its turn.
 */
export function opponentEffectiveStats(state: GameState, oppSlot: OppSlotId): EffectiveStats {
  const aId = state.opponentBoard[oppSlot];
  const card = aId ? state.opponentCards[aId] : undefined;
  const base = {
    hp: card?.hp ?? 0,
    dmg: card?.dmg ?? 0,
    acc: card?.acc ?? 0,
  };

  const cId = state.opponentCBoard[`OC${oppSlot[1]}` as OppCSlotId];
  const buff = cId ? state.opponentCards[cId]?.buff : undefined;

  const line = (stat: StatKey): StatLine => {
    const cDelta = buff && buff.stat === stat ? buff.amount : 0;
    const aDelta = card ? opponentAuraDelta(state, card, stat) : 0;
    const delta = cDelta + aDelta;
    return { value: base[stat] + delta, delta };
  };

  return { hp: line('hp'), dmg: line('dmg'), acc: line('acc') };
}
