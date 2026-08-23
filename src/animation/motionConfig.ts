import type { SpringConfig } from '@react-spring/three';

/**
 * Phase 1 motion tuning. Phase-tagged so feel changes are tracked here without
 * touching business logic. All springs are interruptible by construction.
 */

export const SPRING: Record<string, SpringConfig> = {
  /** Hand reflow / general settle. */
  hand: { mass: 1, tension: 190, friction: 24 },
  /** Draw pop-off from the deck — a touch looser for weight. */
  draw: { mass: 1, tension: 130, friction: 18 },
  /** Card following the pointer — snappy. */
  drag: { mass: 0.6, tension: 420, friction: 30 },
  /** Snap into a slot / return to hand. */
  snap: { mass: 1, tension: 320, friction: 26 },
};

/** Height a dragged card floats above the board. */
export const DRAG_LIFT = 0.55;

/** Delay between each of the opening 5 auto-dealt cards. */
export const OPENING_DEAL_STAGGER_MS = 260;
