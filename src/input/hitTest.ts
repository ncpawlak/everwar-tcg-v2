import type { SlotId, Vec3 } from '../state/types';
import { SLOT_HIT_RADIUS, SLOT_POSITIONS } from '../board/boardConfig';
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
