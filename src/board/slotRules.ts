import type { CardType, GameState, SlotId } from '../state/types';
import { slotType } from '../state/types';
import { SLOT_IDS } from '../state/cardData';

/**
 * Pure board rules for Phase 2. No React, no Three.js, no store internals —
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

/** Slots with no card, in iteration order. */
export function emptySlots(board: GameState['board']): SlotId[] {
  return SLOT_IDS.filter((slotId) => isSlotEmpty(board, slotId));
}

/**
 * Empty slots whose type matches `cardType` — the only legal drop targets for a
 * card of that type. Drives both drop validation and the drag-time gold
 * highlight.
 */
export function validTargetSlots(
  board: GameState['board'],
  cardType: CardType,
): SlotId[] {
  return SLOT_IDS.filter(
    (slotId) => isSlotEmpty(board, slotId) && slotAcceptsType(slotId, cardType),
  );
}

/**
 * Phase 2 drop validity: a card may be dropped only onto an EMPTY slot whose
 * type matches the card's type (type-gated only — a C card does not require its
 * paired A to be filled). `null` (no target slot) is never a valid drop.
 */
export function canDrop(
  board: GameState['board'],
  slotId: SlotId | null,
  cardType: CardType,
): boolean {
  if (slotId === null) return false;
  return isSlotEmpty(board, slotId) && slotAcceptsType(slotId, cardType);
}
