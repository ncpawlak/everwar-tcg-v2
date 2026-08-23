import type { CardType, OppSlotId, SlotId, Vec3 } from '../state/types';

/**
 * Phase 2 board constants. Pure data used by layout math, hit-testing, and the
 * scene. Positions are in world units on an angled playmat; the board surface
 * lies on the y = BOARD_Y plane (the drag plane).
 *
 * Player 1's field (mirrored to P2 in a later phase):
 *   Top row:    four [A | C] pairs side by side  (A1 C1 | A2 C2 | A3 C3 | A4 C4)
 *   Bottom row: four B slots, column-aligned under the A slots
 *   Right side: deck (bottom), graveyard (above deck), replen (right of deck)
 */

/** The playmat surface / drag plane height. */
export const BOARD_Y = 0;

/** Fixed camera framing (single source of truth for App + layout math).
 * Kept centered on x=0 so the hand fan basis stays symmetric. */
export const CAMERA_POSITION: Vec3 = [0, 8.4, 7.7];
export const CAMERA_TARGET: Vec3 = [0, 0, -0.55];
export const CAMERA_FOV = 44;

/** Card footprint (world units) at hand scale. Thin beveled card (~59:86). */
export const CARD_WIDTH = 0.62;
export const CARD_HEIGHT = 0.9;
export const CARD_THICKNESS = 0.018;

/** Cards shrink on the board (Master-Duel-style) so the wide field fits. */
export const BOARD_CARD_SCALE = 0.72;
export const BOARD_CARD_WIDTH = CARD_WIDTH * BOARD_CARD_SCALE;
export const BOARD_CARD_HEIGHT = CARD_HEIGHT * BOARD_CARD_SCALE;

/** Row depths (world z). The A/C row lines up with the graveyard; the B row
 * lines up with the deck + replen, so each row shares a clean horizontal line
 * with its right-side zones. */
const TOP_ROW_Z = -0.3;
const BOTTOM_ROW_Z = 0.75;

/** Horizontal center of each of the four column-pairs, left-to-right. */
const PAIR_CENTERS_X = [-1.698, -0.566, 0.566, 1.698] as const;
/** Half the A↔C separation within a pair (A sits left, C sits right). */
const PAIR_HALF_GAP = 0.253;

function buildSlotPositions(): Record<SlotId, Vec3> {
  const positions = {} as Record<SlotId, Vec3>;
  PAIR_CENTERS_X.forEach((cx, k) => {
    const i = (k + 1) as 1 | 2 | 3 | 4;
    const aX = cx - PAIR_HALF_GAP;
    const cX = cx + PAIR_HALF_GAP;
    positions[`A${i}` as SlotId] = [aX, BOARD_Y, TOP_ROW_Z];
    positions[`C${i}` as SlotId] = [cX, BOARD_Y, TOP_ROW_Z];
    // B sits on the bottom row, centered on the x-midpoint between A and C.
    positions[`B${i}` as SlotId] = [cx, BOARD_Y, BOTTOM_ROW_Z];
  });
  return positions;
}

/** World-space center of each of the 12 typed placement slots. */
export const SLOT_POSITIONS: Record<SlotId, Vec3> = buildSlotPositions();

/** Depth (world z) of the opponent's Vanguard row, across the field from the
 * player's A/C row (which sits at TOP_ROW_Z = -0.3). Far enough back to read as
 * the enemy side, still comfortably inside the camera framing. */
const OPP_ROW_Z = -1.62;

/** The four opponent Vanguard slot ids, left-to-right. */
export const OPP_SLOT_IDS = ['O1', 'O2', 'O3', 'O4'] as const;

/** World-space center of each opponent Vanguard slot — one per column-pair
 * center, mirrored across the field on the opponent row. */
export const OPP_SLOT_POSITIONS: Record<OppSlotId, Vec3> = {
  O1: [PAIR_CENTERS_X[0], BOARD_Y, OPP_ROW_Z],
  O2: [PAIR_CENTERS_X[1], BOARD_Y, OPP_ROW_Z],
  O3: [PAIR_CENTERS_X[2], BOARD_Y, OPP_ROW_Z],
  O4: [PAIR_CENTERS_X[3], BOARD_Y, OPP_ROW_Z],
};

/** Radius (world units) around a slot center that counts as a hover/drop hit. */
export const SLOT_HIT_RADIUS = 0.34;

/** Deck stack, bottom-right of the field near the player. Nudged right to leave
 * a clear gap between the A/B/C sections and the deck/grave/replen column. */
export const DECK_ANCHOR: Vec3 = [2.98, BOARD_Y, 0.75];
/** Graveyard placeholder, above the deck. */
export const GRAVEYARD_ANCHOR: Vec3 = [2.98, BOARD_Y, -0.3];
/** Replenish placeholder, right of the deck. */
export const REPLEN_ANCHOR: Vec3 = [3.71, BOARD_Y, 0.75];

/** Anchor (center) of the fanned hand, near the bottom of the view. Pushed
 * toward the player so a hover-raised card clears the B row. */
export const HAND_ANCHOR: Vec3 = [0, 0.42, 2.72];

/** Fan layout tuning. */
/** Spacing used for a small hand (cards spread out). */
export const HAND_CARD_SPACING = 0.5;
/** The fan compresses so the whole hand stays within ±this half-width (world).
 * As the hand grows the cards pack tighter; as it shrinks they spread back out. */
export const HAND_MAX_HALF_WIDTH = 1.22;
/** Downward dip of outer cards, producing the arc (middle sits highest). */
export const HAND_ARC_DIP = 0.006;
/** Per-step roll (radians) of the fan splay, about the camera (view) axis so
 * cards stay coplanar-facing and never interpenetrate. */
export const HAND_TILT_PER_CARD = 0.025;
/** Depth layering (world units) per card along the camera axis. Kept just large
 * enough to exceed card thickness so each card sorts strictly in front of its
 * left neighbour (right-over-left) without visibly drifting the fan on screen. */
export const HAND_LAYER_STEP = 0.02;

/** Labeled placeholder zones (no behavior yet) for the render layer. */
export interface ZonePlaceholder {
  label: string;
  anchor: Vec3;
}
export const PLACEHOLDER_ZONES: ZonePlaceholder[] = [
  { label: 'GRAVE', anchor: GRAVEYARD_ANCHOR },
  { label: 'REPLEN', anchor: REPLEN_ANCHOR },
];

/** Human label for a slot's accepted type, e.g. slot `A3` → `A`. */
export function slotTypeLabel(slotId: SlotId): CardType {
  return slotId[0] as CardType;
}
