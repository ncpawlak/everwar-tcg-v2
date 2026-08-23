import { Euler, Quaternion, Vector3 } from 'three';
import type { Pose, SlotId, Vec3 } from '../state/types';
import {
  BOARD_CARD_SCALE,
  CAMERA_POSITION,
  CARD_THICKNESS,
  DECK_ANCHOR,
  GRAVEYARD_ANCHOR,
  HAND_ANCHOR,
  HAND_ARC_DIP,
  HAND_CARD_SPACING,
  HAND_LAYER_STEP,
  HAND_MAX_HALF_WIDTH,
  HAND_TILT_PER_CARD,
  SLOT_POSITIONS,
} from './boardConfig';

/**
 * Pure pose math: maps state (deck index, hand index, slot id) to visual target
 * poses. Deterministic and side-effect free so the animation layer can tween
 * toward these targets and tests can assert layout invariants.
 */

/** Card lying flat on the playmat faces up toward the tilted camera. */
const FLAT_ROTATION: Vec3 = [-Math.PI / 2, 0, 0];

/** Card lying flat but face-DOWN (used for the deck stack). */
const FACE_DOWN_ROTATION: Vec3 = [Math.PI / 2, 0, 0];

/** Unit vector from the hand anchor toward the camera (fan faces this way). */
const TO_CAMERA = (() => {
  const v = new Vector3(
    CAMERA_POSITION[0] - HAND_ANCHOR[0],
    CAMERA_POSITION[1] - HAND_ANCHOR[1],
    CAMERA_POSITION[2] - HAND_ANCHOR[2],
  );
  return v.normalize();
})();

/** Base orientation that turns a card's local +Z to face the camera. */
const FACE_CAMERA_Q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), TO_CAMERA);

/**
 * Orthonormal fan basis expressed in the camera's *view plane* so the fan can be
 * laid out in screen space:
 *   - RIGHT  : screen-horizontal (fan spreads left/right along this)
 *   - VIEW_UP: screen-vertical (the arc dips cards DOWN along this)
 *   - TO_CAMERA (the plane normal): depth toward the camera (painter order)
 *
 * The key property: RIGHT and VIEW_UP are both perpendicular to TO_CAMERA, so
 * spreading and arcing move cards purely within the screen plane and do NOT
 * change their distance to the camera. Depth (which card draws on top) is then
 * controlled solely by the TO_CAMERA layer step, guaranteeing strict
 * left-under-right ordering no matter how deep the arc is.
 */
const RIGHT = new Vector3().crossVectors(new Vector3(0, 1, 0), TO_CAMERA).normalize();
const VIEW_UP = new Vector3().crossVectors(TO_CAMERA, RIGHT).normalize();

/**
 * The fan's orthonormal basis, exported as plain tuples for tests to project
 * card positions onto (spread along RIGHT, dip along VIEW_UP, depth/painter
 * order along NORMAL toward the camera).
 */
export const FAN_RIGHT: Vec3 = [RIGHT.x, RIGHT.y, RIGHT.z];
export const FAN_UP: Vec3 = [VIEW_UP.x, VIEW_UP.y, VIEW_UP.z];
export const FAN_NORMAL: Vec3 = [TO_CAMERA.x, TO_CAMERA.y, TO_CAMERA.z];

/**
 * Euler rotation for a hand card: face the camera, then roll about the *view
 * axis* by `roll` so the splay stays in-plane. Because every hand card is thus a
 * parallel plane facing the camera, layering them along the view axis stacks
 * them cleanly with no interpenetration.
 */
function handRotation(roll: number): Vec3 {
  const q = new Quaternion().setFromAxisAngle(TO_CAMERA, roll).multiply(FACE_CAMERA_Q);
  const e = new Euler().setFromQuaternion(q, 'XYZ');
  return [e.x, e.y, e.z];
}

/** Pose of a deck card by its index from the bottom (0 = bottom). */
export function deckCardPose(indexFromBottom: number): Pose {
  const [x, y, z] = DECK_ANCHOR;
  return {
    position: [x, y + indexFromBottom * CARD_THICKNESS * BOARD_CARD_SCALE, z],
    rotation: [...FACE_DOWN_ROTATION] as Vec3,
  };
}

/**
 * Poses for every card in a hand of `count` cards, left-to-right.
 *
 * The fan faces the camera (billboard-style) and is centered on HAND_ANCHOR,
 * with outer cards dipping + rolling in-plane to form the arc. Successive cards
 * are layered along the camera axis so each card sits strictly in front of the
 * one to its left and behind the one to its right — the overlap is always
 * right-over-left, which removes ghosting. The fan compresses as the hand grows
 * and spreads back out as it shrinks.
 */
export function handCardPoses(count: number): Pose[] {
  const poses: Pose[] = [];
  if (count <= 0) return poses;
  const [ax, ay, az] = HAND_ANCHOR;
  const center = (count - 1) / 2;
  const spacing =
    center > 0 ? Math.min(HAND_CARD_SPACING, HAND_MAX_HALF_WIDTH / center) : HAND_CARD_SPACING;
  for (let i = 0; i < count; i++) {
    const offset = i - center;
    // Build the position in the camera's view plane:
    //  - RIGHT  * spread : horizontal fan (no depth change)
    //  - VIEW_UP * -dip  : arc dips outer cards DOWN on screen (no depth change)
    //  - TO_CAMERA * layer: the ONLY depth term → strict left-under-right order
    const spread = offset * spacing;
    const dip = offset * offset * HAND_ARC_DIP;
    const layer = offset * HAND_LAYER_STEP;
    poses.push({
      position: [
        ax + RIGHT.x * spread - VIEW_UP.x * dip + TO_CAMERA.x * layer,
        ay + RIGHT.y * spread - VIEW_UP.y * dip + TO_CAMERA.y * layer,
        az + RIGHT.z * spread - VIEW_UP.z * dip + TO_CAMERA.z * layer,
      ],
      rotation: handRotation(-offset * HAND_TILT_PER_CARD),
    });
  }
  return poses;
}

/** Pose of a card resting in a board slot. */
export function slotCardPose(slotId: SlotId): Pose {
  const [x, y, z] = SLOT_POSITIONS[slotId];
  return {
    position: [x, y + CARD_THICKNESS * BOARD_CARD_SCALE, z],
    rotation: [...FLAT_ROTATION] as Vec3,
  };
}

/**
 * Pose of a card in the graveyard pile by its index from the bottom (0 = first
 * sent). Cards lie face-up and stack upward, with a small planar drift per card
 * so the pile reads as a loose stack rather than a single card.
 */
export function graveyardCardPose(indexFromBottom: number): Pose {
  const [x, y, z] = GRAVEYARD_ANCHOR;
  return {
    position: [
      x + indexFromBottom * 0.016,
      y + (indexFromBottom + 1) * CARD_THICKNESS * BOARD_CARD_SCALE,
      z - indexFromBottom * 0.011,
    ],
    rotation: [...FLAT_ROTATION] as Vec3,
  };
}
