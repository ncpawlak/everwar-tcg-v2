import type { Card, GameState, OppCSlotId, OppSlotId, SlotId, StatKey } from './types';
import { collectAuras, auraStatDelta, type SideField } from '../abilities/auras';
import type { AuraStat } from '../abilities/abilityIR';

/**
 * Pure combat-stat math. An A card's shown stats are its base values plus
 * passive auras and activated/turn buffs. Keeping this side-effect free lets the
 * overlay render effective values + per-stat deltas and lets tests assert the
 * math directly.
 */

export const STAT_KEYS: readonly StatKey[] = ['hp', 'dmg', 'acc'];

/**
 * Set-turn attack rule: a Hero can only attack during the turn it was Set if a
 * Weapon is equipped to it (its linked C slot), or an ability lifts the rule
 * (Shock Deployment). Heroes with no recorded Set turn are always ready.
 */
export function heroCanAttack(state: GameState, side: 'player' | 'opponent', slot: SlotId | OppSlotId): boolean {
  const id = side === 'player' ? state.board[slot as SlotId] : state.opponentBoard[slot as OppSlotId];
  if (!id) return false;
  if (state.heroSetTurn?.[id] !== state.turn) return true;
  if (state.setTurnAttack?.[id]) return true;
  const cId =
    side === 'player'
      ? state.board[`C${slot[slot.length - 1]}` as SlotId]
      : state.opponentCBoard[`OC${slot[slot.length - 1]}` as OppCSlotId];
  const equip = cId ? (side === 'player' ? state.cardsById[cId] : state.opponentCards[cId]) : undefined;
  return equip?.subType === 'Weapon';
}

/** The C slot linked to an A slot in the same column (A3 -> C3). */
export function linkedCSlot(aSlot: SlotId): SlotId {
  return `C${aSlot[1]}` as SlotId;
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
 * Effective stats for the A card in `aSlot`: its base hp/dmg/acc plus any
 * passive stat-auras the controller has active and any activated/turn buffs.
 * Because this reads live board occupancy, removing an aura source reverts the
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

  const selfBuff = aId ? state.activatedStatBuffs[aId] : undefined;
  const turnBuff = aId ? state.turnStatBuffs?.[aId] : undefined;

  const line = (stat: StatKey): StatLine => {
    const aDelta = card ? playerAuraDelta(state, card, stat) : 0;
    const sDelta = (selfBuff?.[stat] ?? 0) + (turnBuff?.[stat] ?? 0);
    const delta = aDelta + sDelta;
    return { value: base[stat] + delta, delta };
  };

  return { hp: line('hp'), dmg: line('dmg'), acc: line('acc') };
}

/**
 * Effective stats for the OPPONENT A card in `oppSlot`: its base hp/dmg/acc plus
 * passive auras. Mirror of `effectiveStats` but reading the opponent's board +
 * card lookup, used when the opponent attacks on its turn.
 */
export function opponentEffectiveStats(state: GameState, oppSlot: OppSlotId): EffectiveStats {
  const aId = state.opponentBoard[oppSlot];
  const card = aId ? state.opponentCards[aId] : undefined;
  const base = {
    hp: card?.hp ?? 0,
    dmg: card?.dmg ?? 0,
    acc: card?.acc ?? 0,
  };


  const debuff = aId ? state.enemyStatDebuffs?.[aId] : undefined;
  const line = (stat: StatKey): StatLine => {
    const delta = (card ? opponentAuraDelta(state, card, stat) : 0) + (debuff?.[stat] ?? 0);
    return { value: base[stat] + delta, delta };
  };

  return { hp: line('hp'), dmg: line('dmg'), acc: line('acc') };
}
