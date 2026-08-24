import type { CardId, OppBSlotId, OppCSlotId, OppSlotId, SlotId, Vec3 } from '../state/types';
import { OPP_FULL_SLOT_POSITIONS, OPP_SLOT_IDS, OPP_SLOT_POSITIONS, SLOT_HIT_RADIUS, SLOT_POSITIONS } from '../board/boardConfig';
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

/** The opponent Vanguard slot whose linked column `point` falls in, or null.
 * Used during Battle to pick the target of an attack declaration. A click on
 * either the opponent's A-zone (O-slot) or its linked C-zone below it counts as
 * targeting that column's Vanguard, mirroring the player's own A/C link. */
export function oppSlotAtPoint(point: Vec3): OppSlotId | null {
  let best: OppSlotId | null = null;
  let bestDist = SLOT_HIT_RADIUS;
  for (const slotId of OPP_SLOT_IDS) {
    const col = slotId.slice(1); // O3 -> "3"
    // Both the A-zone (mirror of A{col}) and the linked C-zone (mirror of
    // C{col}) resolve to the same Vanguard slot.
    const zones: Vec3[] = [OPP_SLOT_POSITIONS[slotId], OPP_FULL_SLOT_POSITIONS[`C${col}` as SlotId]];
    for (const zone of zones) {
      const d = distanceXZ(point, zone);
      if (d <= bestDist) {
        best = slotId;
        bestDist = d;
      }
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

/**
 * The id of the opponent card under `point` across ALL of its zones — Vanguard
 * (O), Arcane (OB) and Bulwark (OC) — or null. Unlike `oppSlotAtPoint` (which
 * resolves a whole column to its Vanguard for attack targeting), this returns
 * the specific card actually clicked, so the player can inspect the opponent's
 * B and C cards too, not just its A row.
 */
export function oppCardAtPoint(
  point: Vec3,
  boards: {
    opponentBoard: Record<OppSlotId, CardId | null>;
    opponentBBoard: Record<OppBSlotId, CardId | null>;
    opponentCBoard: Record<OppCSlotId, CardId | null>;
  },
): CardId | null {
  let best: CardId | null = null;
  let bestDist = SLOT_HIT_RADIUS;
  const consider = (pos: Vec3, id: CardId | null) => {
    if (!id) return;
    const d = distanceXZ(point, pos);
    if (d <= bestDist) {
      best = id;
      bestDist = d;
    }
  };
  for (let n = 1; n <= 4; n++) {
    consider(OPP_FULL_SLOT_POSITIONS[`A${n}` as SlotId], boards.opponentBoard[`O${n}` as OppSlotId]);
    consider(OPP_FULL_SLOT_POSITIONS[`B${n}` as SlotId], boards.opponentBBoard[`OB${n}` as OppBSlotId]);
    consider(OPP_FULL_SLOT_POSITIONS[`C${n}` as SlotId], boards.opponentCBoard[`OC${n}` as OppCSlotId]);
  }
  return best;
}
