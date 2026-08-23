import { Euler, Plane, Raycaster, Vector2, Vector3, type Camera } from 'three';
import type { Pose, Vec3 } from '../state/types';
import { CARD_HEIGHT, CARD_WIDTH } from '../board/boardConfig';

/**
 * Pure-ish raycast helpers for the DOM-driven input layer. Given a pointer in
 * client coordinates and the live camera, these compute what the pointer is
 * over (a hand card, the deck) and where it projects on the board plane. All
 * geometry is derived from authoritative poses, so no scene traversal (and no
 * dependency on animated matrices) is required.
 */

const raycaster = new Raycaster();
const boardPlane = new Plane(new Vector3(0, 1, 0), 0);

/** Convert client pixel coords to normalized device coords for the canvas. */
export function clientToNdc(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
): Vector2 {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((clientY - rect.top) / rect.height) * 2 + 1;
  return new Vector2(x, y);
}

/** Distance along the ray at which it hits a card's oriented rectangle, or null. */
function cardRayT(pose: Pose): number | null {
  const center = new Vector3(pose.position[0], pose.position[1], pose.position[2]);
  const euler = new Euler(pose.rotation[0], pose.rotation[1], pose.rotation[2]);
  const u = new Vector3(1, 0, 0).applyEuler(euler);
  const v = new Vector3(0, 1, 0).applyEuler(euler);
  const n = new Vector3(0, 0, 1).applyEuler(euler);
  const plane = new Plane().setFromNormalAndCoplanarPoint(n, center);
  const hit = new Vector3();
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;
  const d = hit.clone().sub(center);
  const cu = d.dot(u);
  const cv = d.dot(v);
  if (Math.abs(cu) > CARD_WIDTH / 2 || Math.abs(cv) > CARD_HEIGHT / 2) return null;
  return raycaster.ray.origin.distanceTo(hit);
}

/**
 * Pick the front-most hand card under the pointer. `handPoses` is the ordered
 * list of hand-card world poses (index matches the hand array). Returns the hand
 * index, or -1 if none hit.
 */
export function pickHandIndex(ndc: Vector2, camera: Camera, handPoses: Pose[]): number {
  raycaster.setFromCamera(ndc, camera);
  let best = -1;
  let bestT = Infinity;
  for (let i = 0; i < handPoses.length; i++) {
    const t = cardRayT(handPoses[i]);
    if (t !== null && t < bestT) {
      bestT = t;
      best = i;
    }
  }
  return best;
}

/** True when the pointer is over the deck's top card (its face-down pose). */
export function pickDeck(ndc: Vector2, camera: Camera, deckTopPose: Pose): boolean {
  raycaster.setFromCamera(ndc, camera);
  return cardRayT(deckTopPose) !== null;
}

/** Project the pointer onto the board plane (y = 0). Returns [x, 0, z] or null. */
export function projectToBoard(ndc: Vector2, camera: Camera): Vec3 | null {
  raycaster.setFromCamera(ndc, camera);
  const hit = new Vector3();
  if (!raycaster.ray.intersectPlane(boardPlane, hit)) return null;
  return [hit.x, 0, hit.z];
}
