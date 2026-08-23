import { Euler, Quaternion, Vector3 } from 'three';
import type { Pose, SlotId, OppSlotId, Vec3 } from '../state/types';
import {
  BOARD_CARD_SCALE,
  CAMERA_POSITION,
  CARD_THICKNESS,
  DECK_ANCHOR,
  GRAVEYARD_ANCHOR,
  REPLEN_ANCHOR,
  HAND_ANCHOR,
  HAND_ARC_DIP,
  HAND_CARD_SPACING,
  HAND_LAYER_STEP,
  HAND_MAX_HALF_WIDTH,
  HAND_TILT_PER_CARD,
  SLOT_POSITIONS,
  mirrorPoint,
  OPP_HAND_ANCHOR,
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
 * Transient shuffle pose: the deck splits into two lifted piles (even indices
 * left, odd indices right), each stacking upward. Springing between this and
 * `deckCardPose` produces a riffle-shuffle motion. Stays face-down.
 */
export function deckSpreadPose(indexFromBottom: number): Pose {
  const [x, y, z] = DECK_ANCHOR;
  const side = indexFromBottom % 2 === 0 ? -1 : 1;
  const tier = Math.floor(indexFromBottom / 2);
  return {
    position: [
      x + side * 0.44,
      y + 0.16 + tier * CARD_THICKNESS * BOARD_CARD_SCALE * 3,
      z,
    ],
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
 * World position of the summon showcase — where a freshly set card pops up big
 * and centered over the field before flying to its slot. Sits above the board
 * and closer to the camera than the hand fan so it reads as floating in front of
 * everything.
 */
export const SUMMON_SHOWCASE_POSITION: Vec3 = [0, 3.4, 3.6];

/** Uniform scale of the showcased card (much larger than a hand card). */
export const SUMMON_SHOWCASE_SCALE = 2.4;

/** Euler rotation that turns the showcased card to face the camera head-on. */
const SUMMON_SHOWCASE_ROTATION: Vec3 = (() => {
  const dir = new Vector3(
    CAMERA_POSITION[0] - SUMMON_SHOWCASE_POSITION[0],
    CAMERA_POSITION[1] - SUMMON_SHOWCASE_POSITION[1],
    CAMERA_POSITION[2] - SUMMON_SHOWCASE_POSITION[2],
  ).normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), dir);
  const e = new Euler().setFromQuaternion(q, 'XYZ');
  return [e.x, e.y, e.z];
})();

/** Pose of a card during its summon showcase (big, centered, facing camera). */
export function summonShowcasePose(): Pose {
  return {
    position: [...SUMMON_SHOWCASE_POSITION] as Vec3,
    rotation: [...SUMMON_SHOWCASE_ROTATION] as Vec3,
  };
}

/**
 * Pose of a card in a face-up pile (graveyard or replen) by its index from the
 * bottom (0 = first sent). Cards lie face-up and stack upward, with a small
 * planar drift per card so the pile reads as a loose stack, not one card.
 */
function pileCardPose(anchor: Vec3, indexFromBottom: number): Pose {
  const [x, y, z] = anchor;
  return {
    position: [
      x + indexFromBottom * 0.016,
      y + (indexFromBottom + 1) * CARD_THICKNESS * BOARD_CARD_SCALE,
      z - indexFromBottom * 0.011,
    ],
    rotation: [...FLAT_ROTATION] as Vec3,
  };
}

/** Pose of a card in the graveyard pile by its index from the bottom. */
export function graveyardCardPose(indexFromBottom: number): Pose {
  return pileCardPose(GRAVEYARD_ANCHOR, indexFromBottom);
}

/** Pose of a card in the replenish pile by its index from the bottom. */
export function replenCardPose(indexFromBottom: number): Pose {
  return pileCardPose(REPLEN_ANCHOR, indexFromBottom);
}

/* --- Opponent side: 180°-mirrored poses (Phase 6, purely visual) --- */

/** Rotate an orientation 180° about world-up, matching the positional mirror
 * (point-reflection through the vertical board-center axis). */
const Y180 = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);

/** Mirror a pose to the opponent side: reflect the position through the board
 * center and spin the orientation 180° about world-up (so a laid-flat card ends
 * up upside-down, a deck card stays face-down, etc). */
export function mirrorPose(pose: Pose): Pose {
  const q = new Quaternion().setFromEuler(
    new Euler(pose.rotation[0], pose.rotation[1], pose.rotation[2], 'XYZ'),
  );
  const m = Y180.clone().multiply(q);
  const e = new Euler().setFromQuaternion(m, 'XYZ');
  return { position: mirrorPoint(pose.position), rotation: [e.x, e.y, e.z] };
}

/** Fanned opponent hand poses: the player's camera-facing fan translated up to
 * the opponent's hand anchor. We deliberately DON'T mirror the orientation —
 * the cards must stay flat-on to the camera (showing their backs) rather than
 * rotating edge-on. Positions mirror (via the anchor) so the fan sits at the
 * top of the screen. */
const OPP_HAND_OFFSET: Vec3 = [
  OPP_HAND_ANCHOR[0] - HAND_ANCHOR[0],
  OPP_HAND_ANCHOR[1] - HAND_ANCHOR[1],
  OPP_HAND_ANCHOR[2] - HAND_ANCHOR[2],
];

export function opponentHandPoses(count: number): Pose[] {
  return handCardPoses(count).map((p) => ({
    position: [
      p.position[0] + OPP_HAND_OFFSET[0],
      p.position[1] + OPP_HAND_OFFSET[1],
      p.position[2] + OPP_HAND_OFFSET[2],
    ],
    rotation: [...p.rotation] as Vec3,
  }));
}

/** Opponent deck-stack pose by index from the bottom (mirror of the player's). */
export function opponentDeckPose(indexFromBottom: number): Pose {
  return mirrorPose(deckCardPose(indexFromBottom));
}

/** Opponent A-card resting in a far-row slot — the mirror of the matching
 * player slot pose, so it lies flat but upside-down on the opponent's side.
 * O1..O4 mirror A1..A4. */
export function opponentSlotCardPose(oppSlotId: OppSlotId): Pose {
  const playerSlot = `A${oppSlotId.slice(1)}` as SlotId;
  return mirrorPose(slotCardPose(playerSlot));
}

/** Opponent graveyard pile pose by index from the bottom (mirror of the
 * player's graveyard stack, so it stacks at the opponent's grave anchor). */
export function opponentGraveyardCardPose(indexFromBottom: number): Pose {
  return mirrorPose(graveyardCardPose(indexFromBottom));
}
