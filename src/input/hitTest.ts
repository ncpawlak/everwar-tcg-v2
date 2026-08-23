import type { CardId, OppSlotId, SlotId, Vec3 } from '../state/types';
import { OPP_SLOT_IDS, OPP_SLOT_POSITIONS, SLOT_HIT_RADIUS, SLOT_POSITIONS } from '../board/boardConfig';
import { SLOT_IDS } from '../state/cardData';

/**
 * Pure slot hit-testing: given a point projected onto the board plane, return
 * the nearest slot within hit radius, or null. No Three.js — plain coordinates.
 */

function distanceXZ(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.hypot(dx, dz);
}

export function slotAtPoint(point: Vec3): SlotId | null {
  let best: SlotId | null = null;
  let bestDist = SLOT_HIT_RADIUS;
  for (const slotId of SLOT_IDS) {
    const d = distanceXZ(point, SLOT_POSITIONS[slotId]);
    if (d <= bestDist) {
      best = slotId;
      bestDist = d;
    }
  }
  return best;
}

/** The nearest opponent Vanguard slot within hit radius of `point`, or null.
 * Used during Battle to pick the target of an attack declaration. */
export function oppSlotAtPoint(point: Vec3): OppSlotId | null {
  let best: OppSlotId | null = null;
  let bestDist = SLOT_HIT_RADIUS;
  for (const slotId of OPP_SLOT_IDS) {
    const d = distanceXZ(point, OPP_SLOT_POSITIONS[slotId]);
    if (d <= bestDist) {
      best = slotId;
      bestDist = d;
    }
  }
  return best;
}

/**
 * The id of the card occupying the slot under `point`, or null. Used to inspect
 * a placed board card on click (placed cards don't move yet).
 */
export function boardCardAt(
  point: Vec3,
  board: Record<SlotId, CardId | null>,
): CardId | null {
  const slot = slotAtPoint(point);
  return slot ? board[slot] : null;
}
