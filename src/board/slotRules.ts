import type { GameState, SlotId } from '../state/types';
import { SLOT_IDS } from '../state/cardData';

/**
 * Pure board rules for Phase 1. No React, no Three.js, no store internals —
 * just functions over the board occupancy map. This is the seam future phases
 * extend (e.g. re-pickup, typed slots, rules engine).
 */

export function isSlotEmpty(board: GameState['board'], slotId: SlotId): boolean {
  return board[slotId] === null;
}

/** Slots with no card, in left-to-right order. */
export function emptySlots(board: GameState['board']): SlotId[] {
  return SLOT_IDS.filter((slotId) => isSlotEmpty(board, slotId));
}

/**
 * Phase 1 drop validity: a card may be dropped only onto an empty slot.
 * `null` (no target slot) is never a valid drop.
 */
export function canDrop(board: GameState['board'], slotId: SlotId | null): boolean {
  if (slotId === null) return false;
  return isSlotEmpty(board, slotId);
}
