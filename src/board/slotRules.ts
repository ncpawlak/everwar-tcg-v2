import type { CardType, GameState, SlotId, SlotIndex } from '../state/types';
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
