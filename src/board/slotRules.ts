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
