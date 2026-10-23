import type { Card, CardId, Difficulty, GameState, OppCSlotId, OppSlotId, SlotId } from '../state/types';
import { requiresTribute, tributeSetKind } from '../board/slotRules';
import type { SetKind } from '../abilities/abilityIR';
import { OPP_SLOT_IDS } from '../board/boardConfig';

/**
 * Pure CPU decision helpers. The store executes the chosen plays; everything
 * here only reads state so it can be unit tested in isolation.
 */

/** Rough Hero strength used to rank plays, tributes and targets. */
export function heroValue(card: Card | undefined): number {
  if (!card || card.type !== 'A') return 0;
  return (
    (card.hp ?? 0) +
    2 * (card.dmg ?? 0) +
    0.5 * (card.acc ?? 0) +
    2 * (card.armor ?? 0) +
    8 * (card.armorBars ?? 0) +
    5 * (card.level ?? 1)
  );
}

/** Rough Equipment strength (its stat bonuses). */
export function equipValue(card: Card | undefined): number {
  const e = card?.equipStats;
  if (!e) return 0;
  return (e.hp ?? 0) + 2 * (e.dmg ?? 0) + 0.5 * (e.acc ?? 0) + 2 * (e.armor ?? 0) + 8 * (e.armorBars ?? 0);
}

/** Should the CPU send its opening hand back? Easy never does; Normal when it
 *  holds no free (non-tribute) Hero; Hard when it holds fewer than two. */
export function shouldMulligan(hand: readonly CardId[], cards: Record<CardId, Card>, difficulty: Difficulty): boolean {
  if (difficulty === 'easy') return false;
  const free = hand.filter((id) => {
    const c = cards[id];
    return c?.type === 'A' && !requiresTribute(c);
  }).length;
  return difficulty === 'hard' ? free < 2 : free === 0;
}

export interface TributePlan {
  cardId: CardId;
  materials: OppSlotId[];
  kind: SetKind;
}

/**
 * The cheapest legal tribute Set for a tribute Hero in the CPU hand, or null.
 * Materials are any subset of the CPU's field Heroes that `tributeSetKind`
 * accepts; the lowest-value subset wins. Hard only tributes into an upgrade.
 */
export function planTribute(s: GameState, difficulty: Difficulty): TributePlan | null {
  if (difficulty === 'easy') return null;
  const field = OPP_SLOT_IDS.flatMap((o) => {
    const id = s.opponentBoard[o];
    const c = id ? s.opponentCards[id] : undefined;
    return id && c ? [{ slot: o, card: c }] : [];
  });
  if (field.length === 0) return null;
  const candidates = s.opponentHand
    .map((id) => s.opponentCards[id])
    .filter((c): c is Card => !!c && c.type === 'A' && requiresTribute(c))
    .filter((c) => !(c.unique && field.some((f) => f.card.name === c.name)))
    .sort((a, b) => heroValue(b) - heroValue(a));
  for (const card of candidates) {
    let best: { slots: OppSlotId[]; kind: SetKind; cost: number } | null = null;
    for (let mask = 1; mask < 1 << field.length; mask++) {
      const picked = field.filter((_, i) => mask & (1 << i));
      const kind = tributeSetKind(card, picked.map((p) => p.card));
      if (!kind) continue;
      const cost = picked.reduce((acc, p) => acc + heroValue(p.card), 0);
      if (!best || cost < best.cost) best = { slots: picked.map((p) => p.slot), kind, cost };
    }
    if (!best) continue;
    if (difficulty === 'hard' && heroValue(card) <= best.cost * 0.85) continue;
    return { cardId: card.id, materials: best.slots, kind: best.kind };
  }
  return null;
}

/** The free Hero the CPU should Set next (Easy: first in hand; else strongest). */
export function pickFreeHero(s: GameState, difficulty: Difficulty): CardId | null {
  const onField = new Set(
    OPP_SLOT_IDS.flatMap((o) => {
      const id = s.opponentBoard[o];
      return id ? [s.opponentCards[id]?.name] : [];
    }),
  );
  const free = s.opponentHand.filter((id) => {
    const c = s.opponentCards[id];
    return !!c && c.type === 'A' && !requiresTribute(c) && !(c.unique && onField.has(c.name));
  });
  if (free.length === 0) return null;
  if (difficulty === 'easy') return free[0];
  return free.reduce((a, b) => (heroValue(s.opponentCards[b]) > heroValue(s.opponentCards[a]) ? b : a));
}

export interface EquipPlan {
  cardId: CardId;
  slot: OppCSlotId;
}

/**
 * Which Equipment to play and where. Easy: first C onto the first equippable
 * column. Normal: the best C onto the strongest unequipped Hero. Hard: a Weapon
 * goes first to a Hero Set this turn (so it can attack), else like Normal.
 */
export function planEquip(s: GameState, difficulty: Difficulty): EquipPlan | null {
  const hand = s.opponentHand.filter((id) => s.opponentCards[id]?.type === 'C');
  if (hand.length === 0) return null;
  const open = OPP_SLOT_IDS.filter((o) => s.opponentBoard[o] && !s.opponentCBoard[`OC${o[1]}` as OppCSlotId]);
  if (open.length === 0) return null;
  const toSlot = (o: OppSlotId) => `OC${o[1]}` as OppCSlotId;
  if (difficulty === 'easy') return { cardId: hand[0], slot: toSlot(open[0]) };
  const heroOf = (o: OppSlotId) => s.opponentCards[s.opponentBoard[o]!];
  const best = [...hand].sort((a, b) => equipValue(s.opponentCards[b]) - equipValue(s.opponentCards[a]));
  if (difficulty === 'hard') {
    const weapon = best.find((id) => s.opponentCards[id]?.subType === 'Weapon');
    const fresh = open.filter((o) => s.heroSetTurn?.[s.opponentBoard[o]!] === s.turn);
    if (weapon && fresh.length) {
      const target = fresh.reduce((a, b) => (heroValue(heroOf(b)) > heroValue(heroOf(a)) ? b : a));
      return { cardId: weapon, slot: toSlot(target) };
    }
  }
  const target = open.reduce((a, b) => (heroValue(heroOf(b)) > heroValue(heroOf(a)) ? b : a));
  return { cardId: best[0], slot: toSlot(target) };
}

/** Lowest-value card the CPU can spare from its hand (for hand costs). */
export function cheapestHandCard(
  s: GameState,
  exclude: CardId,
  filter: (c: Card) => boolean = () => true,
): CardId | null {
  const pool = s.opponentHand.filter((id) => id !== exclude && !!s.opponentCards[id] && filter(s.opponentCards[id]));
  if (pool.length === 0) return null;
  const val = (id: CardId) => cardValue(s.opponentCards[id]);
  return pool.reduce((a, b) => (val(b) < val(a) ? b : a));
}

/** Any card's rough worth (Heroes by stats, Equipment by bonuses, Abilities flat). */
export function cardValue(c: Card | undefined): number {
  if (!c) return 0;
  return c.type === 'A' ? heroValue(c) : c.type === 'C' ? equipValue(c) + 10 : 15;
}

export interface AttackInputs {
  /** CPU attackers with their effective DMG. */
  attackers: { slot: OppSlotId; dmg: number }[];
  /** Targetable player Heroes with live HP, Armor Bars and level. */
  targets: { slot: SlotId; hp: number; bars: number; level: number }[];
  forced: SlotId | null;
  difficulty: Difficulty;
  rand?: () => number;
}

/**
 * Assign each CPU attacker a player Hero.
 * - Easy: same column, else random (the original behaviour).
 * - Normal: a Hero it can finish this hit, else the lowest-HP Hero.
 * - Hard: focus fire — strongest hitters first, each picks the best kill
 *   (weighted by the level's points), tracking the HP/bars earlier attackers
 *   already removed.
 */
export function planAttacks(inp: AttackInputs): Partial<Record<OppSlotId, SlotId>> {
  const out: Partial<Record<OppSlotId, SlotId>> = {};
  const rand = inp.rand ?? Math.random;
  if (inp.targets.length === 0) return out;
  if (inp.forced) {
    for (const a of inp.attackers) out[a.slot] = inp.forced;
    return out;
  }
  if (inp.difficulty === 'easy') {
    for (const a of inp.attackers) {
      const same = `A${a.slot[1]}` as SlotId;
      out[a.slot] = inp.targets.some((t) => t.slot === same)
        ? same
        : inp.targets[Math.floor(rand() * inp.targets.length)].slot;
    }
    return out;
  }
  const live = inp.targets.map((t) => ({ ...t }));
  const order = inp.difficulty === 'hard' ? [...inp.attackers].sort((a, b) => b.dmg - a.dmg) : inp.attackers;
  for (const a of order) {
    const alive = live.filter((t) => t.hp > 0);
    const pool = alive.length ? alive : live;
    let pick = pool[0];
    let bestScore = -Infinity;
    for (const t of pool) {
      const kills = t.bars === 0 && a.dmg >= t.hp;
      const score =
        inp.difficulty === 'hard'
          ? (kills ? 1000 + t.level * 100 : 0) - (t.bars > 0 ? 50 : 0) - t.hp + t.level * 5
          : (kills ? 1000 : 0) - t.hp - (t.bars > 0 ? 50 : 0);
      if (score > bestScore) {
        bestScore = score;
        pick = t;
      }
    }
    out[a.slot] = pick.slot;
    if (pick.bars > 0) pick.bars -= 1;
    else pick.hp -= a.dmg;
  }
  return out;
}
