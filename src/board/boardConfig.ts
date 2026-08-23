import type { SlotId, Vec3 } from '../state/types';

/**
 * Phase 1 board constants. Pure data used by layout math, hit-testing, and the
 * scene. Positions are in world units on an angled playmat; the board surface
 * lies on the y = BOARD_Y plane (the drag plane).
 */

/** The playmat surface / drag plane height. */
export const BOARD_Y = 0;

/** Fixed camera framing (single source of truth for App + layout math). */
export const CAMERA_POSITION: Vec3 = [0, 6.8, 6.6];
export const CAMERA_TARGET: Vec3 = [0, 0, -0.8];
export const CAMERA_FOV = 42;

/** Card footprint (world units). Thin beveled card (~ real 59:86 ratio). */
export const CARD_WIDTH = 0.62;
export const CARD_HEIGHT = 0.9;
export const CARD_THICKNESS = 0.018;

/** World-space center of each placement slot, left-to-right (mid-board). */
export const SLOT_POSITIONS: Record<SlotId, Vec3> = {
  slotA: [-1.05, BOARD_Y, -0.5],
  slotB: [0, BOARD_Y, -0.5],
  slotC: [1.05, BOARD_Y, -0.5],
};

/** Radius (world units) around a slot center that counts as a hover/drop hit. */
export const SLOT_HIT_RADIUS = 0.55;

/** Anchor for the deck stack (right side, near the player). */
export const DECK_ANCHOR: Vec3 = [2.15, BOARD_Y, 1.35];

/** Anchor (center) of the fanned hand, near the bottom of the view. */
export const HAND_ANCHOR: Vec3 = [0, 0.42, 2.35];

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
