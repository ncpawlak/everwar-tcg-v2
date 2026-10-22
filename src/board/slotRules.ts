import type { Card, CardType, GameState, SlotId, SlotIndex } from '../state/types';
import { slotType } from '../state/types';
import { SLOT_IDS } from '../state/cardData';

/**
 * Pure board rules for Phase 2/3. No React, no Three.js, no store internals —
 * just functions over the board occupancy map. This is the seam future phases
 * extend (re-pickup, per-slot rules, a full rules engine).
 */

export function isSlotEmpty(board: GameState['board'], slotId: SlotId): boolean {
  return board[slotId] === null;
}

/** A slot accepts a card only when their types match. */
export function slotAcceptsType(slotId: SlotId, cardType: CardType): boolean {
  return slotType(slotId) === cardType;
}

/** The A slot linked to a C slot in the same column (C3 -> A3). */
export function linkedASlot(cSlot: SlotId): SlotId {
  return `A${cSlot[1] as unknown as SlotIndex}` as SlotId;
}

/**
 * A and C zones in the same column are a linked pair. When dragging an A or C
 * card, hovering EITHER zone in a column should target the card's own-type slot
 * in that column. Given the raw slot under the pointer and the dragged card's
 * type, resolve to the actual placement slot — or null when placement there is
 * illegal. B cards (and any non-A/C hover) fall back to direct placement.
 */
export function resolveLinkedTarget(
  board: GameState['board'],
  rawSlot: SlotId | null,
  cardType: CardType,
): SlotId | null {
  if (rawSlot === null) return null;
  const zone = slotType(rawSlot);
  if ((cardType === 'A' || cardType === 'C') && (zone === 'A' || zone === 'C')) {
    const target = `${cardType}${rawSlot[1]}` as SlotId;
    return slotPlaceable(board, target, cardType) ? target : null;
  }
  return slotPlaceable(board, rawSlot, cardType) ? rawSlot : null;
}

/**
 * Battle-phase attacker resolution: clicking EITHER zone of a linked column
 * selects that column's A card as the attacker. Returns the column's A slot when
 * it holds a card (only occupied A columns can attack), otherwise null.
 */
export function resolveAttackerSlot(
  board: GameState['board'],
  slot: SlotId | null,
): SlotId | null {
  if (slot === null) return null;
  const zone = slotType(slot);
  if (zone !== 'A' && zone !== 'C') return null;
  const aSlot = `A${slot[1]}` as SlotId;
  return isSlotEmpty(board, aSlot) ? null : aSlot;
}

/**
 * Whether `slotId` should show the gold drag highlight for a dragged `cardType`.
 * For A/C cards the WHOLE linked column (both the A and C zone) lights up when
 * that column can legally receive the card; for B cards only the placeable slot
 * itself lights up.
 */
export function slotHighlighted(
  board: GameState['board'],
  slotId: SlotId,
  cardType: CardType,
): boolean {
  const zone = slotType(slotId);
  if ((cardType === 'A' || cardType === 'C') && (zone === 'A' || zone === 'C')) {
    const target = `${cardType}${slotId[1]}` as SlotId;
    return slotPlaceable(board, target, cardType);
  }
  return slotPlaceable(board, slotId, cardType);
}

/**
 * Phase 3 placement gate: a slot may hold a card only when it is empty, its type
 * matches, AND — for a C slot — its linked A slot is already occupied. C cards
 * are supports that attach to a deployed A card, so they cannot be set on an
 * empty column.
 */
export function slotPlaceable(
  board: GameState['board'],
  slotId: SlotId,
  cardType: CardType,
): boolean {
  if (!isSlotEmpty(board, slotId) || !slotAcceptsType(slotId, cardType)) return false;
  if (slotType(slotId) === 'C') return !isSlotEmpty(board, linkedASlot(slotId));
  return true;
}

/** Slots with no card, in iteration order. */
export function emptySlots(board: GameState['board']): SlotId[] {
  return SLOT_IDS.filter((slotId) => isSlotEmpty(board, slotId));
}

/**
 * Legal drop targets for a card of `cardType` — empty, type-matched, and (for C)
 * with the linked A occupied. Drives both drop validation and the drag-time gold
 * highlight.
 */
export function validTargetSlots(
  board: GameState['board'],
  cardType: CardType,
): SlotId[] {
  return SLOT_IDS.filter((slotId) => slotPlaceable(board, slotId, cardType));
}

/**
 * Phase 3 drop validity: the target slot must be placeable for the card's type
 * (empty + type-matched, plus the C→linked-A rule). `null` is never valid.
 */
export function canDrop(
  board: GameState['board'],
  slotId: SlotId | null,
  cardType: CardType,
): boolean {
  if (slotId === null) return false;
  return slotPlaceable(board, slotId, cardType);
}

/* ─────────────────────────── Tribute summon (levels) ─────────────────────────
 * A-cards carry a summon level. Levels 1–2 set freely into any open A slot. A
 * level ≥ TRIBUTE_LEVEL card must be tribute-summoned: the player sends board
 * A-cards whose levels sum to EXACTLY the card's level to the replen pile (and
 * their linked C-cards along with them). The gold highlight/drop only opens for
 * such a card when a valid material subset exists on the board.
 */

/** A-cards at or above this level require a tribute summon (levels 1–2 are free). */
export const TRIBUTE_LEVEL = 3;

/** Whether a card must be tribute-summoned — a level-3+ A card, or a Commander
 * (Commanders use the same level-3 tribute rules but tribute to the graveyard). */
export function requiresTribute(card: Card): boolean {
  return card.type === 'A' && ((card.level ?? 1) >= TRIBUTE_LEVEL || card.commander === true);
}

/** Summon levels of the A-cards currently on the player's board — the pool of
 * tribute materials, keyed by their A-slot id. */
export function boardMaterials(
  board: GameState['board'],
  cardsById: Record<string, Card>,
): { slotId: SlotId; cardId: string; level: number }[] {
  const out: { slotId: SlotId; cardId: string; level: number }[] = [];
  for (const slotId of SLOT_IDS) {
    if (slotType(slotId) !== 'A') continue;
    const cardId = board[slotId];
    if (!cardId) continue;
    const card = cardsById[cardId];
    if (!card) continue;
    out.push({ slotId, cardId, level: card.level ?? 1 });
  }
  return out;
}

/** Does some subset of `values` sum EXACTLY to `target`? Brute force — the pool
 * is at most four A-cards, so cost is negligible. */
export function hasSubsetSum(values: number[], target: number): boolean {
  const walk = (i: number, remaining: number): boolean => {
    if (remaining === 0) return true;
    if (i >= values.length || remaining < 0) return false;
    return walk(i + 1, remaining - values[i]) || walk(i + 1, remaining);
  };
  return walk(0, target);
}

/** Can a tribute-summon card be summoned right now — i.e. do the board A-cards
 * hold a subset whose levels sum exactly to the card's level? */
export function canAffordTribute(
  board: GameState['board'],
  cardsById: Record<string, Card>,
  card: Card,
): boolean {
  const target = card.level ?? 0;
  const levels = boardMaterials(board, cardsById).map((m) => m.level);
  return hasSubsetSum(levels, target);
}

/**
 * Card-aware drag highlight. Behaves like {@link slotHighlighted} for ordinary
 * cards. A tribute-summon card lights nothing until a valid material subset
 * exists on the board; once it does, EVERY A/C column lights up (occupied
 * included) because dropping on any of them opens material selection — the
 * materials free up the slot, so the target slot is chosen afterward.
 */
export function slotHighlightedForCard(
  board: GameState['board'],
  cardsById: Record<string, Card>,
  slotId: SlotId,
  card: Card,
): boolean {
  if (requiresTribute(card)) {
    if (!canAffordTribute(board, cardsById, card)) return false;
    const zone = slotType(slotId);
    return zone === 'A' || zone === 'C';
  }
  return slotHighlighted(board, slotId, card.type);
}

/**
 * Card-aware drop validity. Like {@link canDrop} but a tribute-summon card is
 * droppable onto ANY A/C column (even a full board) when it can afford its
 * tribute; the drop opens the material-selection modal rather than placing.
 */
export function canDropCard(
  board: GameState['board'],
  cardsById: Record<string, Card>,
  slotId: SlotId | null,
  card: Card,
): boolean {
  if (requiresTribute(card)) {
    if (slotId === null || !canAffordTribute(board, cardsById, card)) return false;
    const zone = slotType(slotId);
    return zone === 'A' || zone === 'C';
  }
  return canDrop(board, slotId, card.type);
}
