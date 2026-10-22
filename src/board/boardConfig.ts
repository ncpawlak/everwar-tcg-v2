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
 * Kept centered on x=0 so the hand fan basis stays symmetric. A steeper,
 * more overhead angle (Master-Duel-style) so the billboarded stat tags read
 * as flat labels near the mat instead of skewed standing cards. */
export const CAMERA_POSITION: Vec3 = [0, 9.9, 6.3];
export const CAMERA_TARGET: Vec3 = [0, 0, -0.55];
export const CAMERA_FOV = 46;

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

/** The four opponent Vanguard slot ids, left-to-right (their A-zone). */
export const OPP_SLOT_IDS = ['O1', 'O2', 'O3', 'O4'] as const;

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

/* ------------------------------------------------------------------ *
 *  Opponent field — a 180° mirror of the player's field (Phase 6).
 *
 *  The opponent side is a point-reflection of Player 1's field through a
 *  vertical axis at the board center: x mirrors about 0 and z reflects about
 *  MIRROR_CZ. This is equivalent to rotating the whole player field 180° about
 *  that vertical axis — so the opponent's deck lands top-LEFT (mirror of the
 *  player's bottom-RIGHT deck), their frontline sits directly across from the
 *  player's A/C row, and placed cards read upside-down (as if seen across a
 *  real table). Stat plates are billboarded, so they stay upright/readable.
 * ------------------------------------------------------------------ */

/** Mirror center on z. Picked so the opponent A/C row lands well across from the
 * player's A/C row (-0.3) with a clear no-man's-land gap between the two fields. */
const MIRROR_CZ = -1.25;

/** Point-reflect a board position to the opponent side (x about 0, z about
 * MIRROR_CZ). Height (y) is preserved. */
export function mirrorPoint([x, y, z]: Vec3): Vec3 {
  return [-x, y, 2 * MIRROR_CZ - z];
}

/** All 12 opponent zone centers — the mirror of every player slot. */
export const OPP_FULL_SLOT_POSITIONS: Record<SlotId, Vec3> = Object.fromEntries(
  (Object.keys(SLOT_POSITIONS) as SlotId[]).map((s) => [s, mirrorPoint(SLOT_POSITIONS[s])]),
) as Record<SlotId, Vec3>;

/** The opponent's Vanguard (A-zone) slot centers, used for attack targeting.
 * O1..O4 mirror the player's A1..A4. */
export const OPP_SLOT_POSITIONS: Record<OppSlotId, Vec3> = {
  O1: OPP_FULL_SLOT_POSITIONS.A1,
  O2: OPP_FULL_SLOT_POSITIONS.A2,
  O3: OPP_FULL_SLOT_POSITIONS.A3,
  O4: OPP_FULL_SLOT_POSITIONS.A4,
};

/** Mirrored right-side pile anchors + hand anchor for the opponent field. */
export const OPP_DECK_ANCHOR: Vec3 = mirrorPoint(DECK_ANCHOR);
export const OPP_GRAVEYARD_ANCHOR: Vec3 = mirrorPoint(GRAVEYARD_ANCHOR);
export const OPP_REPLEN_ANCHOR: Vec3 = mirrorPoint(REPLEN_ANCHOR);
export const OPP_HAND_ANCHOR: Vec3 = mirrorPoint(HAND_ANCHOR);

/** Opponent placeholder zones (mirrored grave/replen), for the render layer. */
export const OPP_PLACEHOLDER_ZONES: ZonePlaceholder[] = [
  { label: 'GRAVE', anchor: OPP_GRAVEYARD_ANCHOR },
  { label: 'REPLEN', anchor: OPP_REPLEN_ANCHOR },
];
