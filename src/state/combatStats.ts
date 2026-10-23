import type { Card, CardId, GameState, OppCSlotId, OppSlotId, SlotId, StatKey } from './types';
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

export type Side = 'player' | 'opponent';

/** The Hero card in a side's A/O slot. */
export function heroAt(state: GameState, side: Side, slot: SlotId | OppSlotId): Card | undefined {
  const id = side === 'player' ? state.board[slot as SlotId] : state.opponentBoard[slot as OppSlotId];
  return id ? (side === 'player' ? state.cardsById[id] : state.opponentCards[id]) : undefined;
}

/** The Equipment linked to a side's A/O slot (A2 → C2, O2 → OC2). */
export function linkedEquipment(state: GameState, side: Side, slot: SlotId | OppSlotId): Card | undefined {
  const col = slot[slot.length - 1];
  const cId = side === 'player' ? state.board[`C${col}` as SlotId] : state.opponentCBoard[`OC${col}` as OppCSlotId];
  return cId ? (side === 'player' ? state.cardsById[cId] : state.opponentCards[cId]) : undefined;
}

/** Flat stat bonuses an Equipment grants a specific Hero. */
export interface EquipBonus {
  hp: number;
  dmg: number;
  acc: number;
  armor: number;
  armorBars: number;
}

export function equipmentBonus(hero: Card | undefined, equip: Card | undefined): EquipBonus {
  const e = equip?.equipStats;
  if (!hero || !e) return { hp: 0, dmg: 0, acc: 0, armor: 0, armorBars: 0 };
  const medic = hero.subType === 'Medic' ? e.medicHp ?? 0 : 0;
  return {
    hp: (e.hp ?? 0) + medic,
    dmg: e.dmg ?? 0,
    acc: e.acc ?? 0,
    armor: e.armor ?? 0,
    armorBars: e.armorBars ?? 0,
  };
}

/** Equipment bonus for whatever Hero/Equipment sit in a side's column. */
export function slotEquipBonus(state: GameState, side: Side, slot: SlotId | OppSlotId): EquipBonus {
  return equipmentBonus(heroAt(state, side, slot), linkedEquipment(state, side, slot));
}

/** Flat Armor: base + armor auras (both sides) + Equipment. */
export function heroArmor(state: GameState, side: Side, slot: SlotId | OppSlotId): number {
  const card = heroAt(state, side, slot);
  if (!card) return 0;
  const aura = side === 'player' ? playerAuraDelta(state, card, 'armor') : opponentAuraDelta(state, card, 'armor');
  return (card.armor ?? 0) + aura + slotEquipBonus(state, side, slot).armor;
}

/** Full Armor Bar count: the Hero's own bars + any granted by Equipment. */
export function heroMaxBars(state: GameState, side: Side, slot: SlotId | OppSlotId): number {
  return (heroAt(state, side, slot)?.armorBars ?? 0) + slotEquipBonus(state, side, slot).armorBars;
}

/** Live Armor Bars (tracked count, else the full count). */
export function heroBars(state: GameState, side: Side, slot: SlotId | OppSlotId): number {
  const id = side === 'player' ? state.board[slot as SlotId] : state.opponentBoard[slot as OppSlotId];
  if (!id) return 0;
  return state.currentArmorBars[id as CardId] ?? heroMaxBars(state, side, slot);
}

/** Tankwalker: HP damage from an attacker with no Weapon is reduced. */
export function unarmedReduction(
  state: GameState,
  defSide: Side,
  defSlot: SlotId | OppSlotId,
  attackerSlot: SlotId | OppSlotId,
): number {
  const red = linkedEquipment(state, defSide, defSlot)?.equipStats?.unarmedReduction ?? 0;
  if (!red) return 0;
  const atkSide: Side = defSide === 'player' ? 'opponent' : 'player';
  return linkedEquipment(state, atkSide, attackerSlot)?.subType === 'Weapon' ? 0 : red;
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
 * Effective stats for the A card in `aSlot`: its base hp/dmg/acc plus its
 * linked Equipment's bonuses, any passive stat-auras the controller has active and any activated/turn buffs.
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
  const equip = slotEquipBonus(state, 'player', aSlot);

  const line = (stat: StatKey): StatLine => {
    const aDelta = card ? playerAuraDelta(state, card, stat) : 0;
    const sDelta = (selfBuff?.[stat] ?? 0) + (turnBuff?.[stat] ?? 0);
    const delta = aDelta + sDelta + equip[stat];
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
  const equip = slotEquipBonus(state, 'opponent', oppSlot);
  const line = (stat: StatKey): StatLine => {
    const delta =
      (card ? opponentAuraDelta(state, card, stat) : 0) + (debuff?.[stat] ?? 0) + equip[stat];
    return { value: base[stat] + delta, delta };
  };

  return { hp: line('hp'), dmg: line('dmg'), acc: line('acc') };
}
