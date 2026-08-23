import { describe, it, expect } from 'vitest';
import { Euler, Vector3 } from 'three';
import { deckCardPose, handCardPoses, slotCardPose, FAN_UP, FAN_NORMAL } from './layout';
import { HAND_ANCHOR, HAND_MAX_HALF_WIDTH, SLOT_POSITIONS } from './boardConfig';

/** Screen-space tilt of a card's local up-vector (x component after rotation). */
function upTiltX(rotation: [number, number, number]): number {
  const up = new Vector3(0, 1, 0).applyEuler(new Euler(rotation[0], rotation[1], rotation[2]));
  return up.x;
}

/** Project a card position onto a fan-basis axis, relative to the hand anchor. */
function projectOnAxis(position: [number, number, number], axis: [number, number, number]): number {
  return (
    (position[0] - HAND_ANCHOR[0]) * axis[0] +
    (position[1] - HAND_ANCHOR[1]) * axis[1] +
    (position[2] - HAND_ANCHOR[2]) * axis[2]
  );
}

describe('P1-S04 layout math', () => {
  it('returns one pose per hand card', () => {
    expect(handCardPoses(0)).toHaveLength(0);
    expect(handCardPoses(5)).toHaveLength(5);
  });

  it('centers the hand fan symmetrically on the anchor x', () => {
    const poses = handCardPoses(5);
    const xs = poses.map((p) => p.position[0]);
    // middle card sits on the anchor
    expect(xs[2]).toBeCloseTo(HAND_ANCHOR[0], 5);
    // symmetric spread
    expect(xs[0]).toBeCloseTo(-xs[4], 5);
    expect(xs[1]).toBeCloseTo(-xs[3], 5);
    // strictly increasing left-to-right
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });

  it('splays the fan symmetrically (roll mirrors left vs right)', () => {
    const poses = handCardPoses(5);
    const left = upTiltX(poses[0].rotation);
    const right = upTiltX(poses[4].rotation);
    expect(left).toBeCloseTo(-right, 5);
    expect(Math.abs(left)).toBeGreaterThan(1e-3);
    expect(upTiltX(poses[2].rotation)).toBeCloseTo(0, 5);
  });

  it('arcs outer cards downward (in the view plane)', () => {
    const poses = handCardPoses(5);
    // Dip is measured along the view-up axis: center highest, ends lower.
    const dips = poses.map((p) => projectOnAxis(p.position, FAN_UP));
    expect(dips[2]).toBeGreaterThan(dips[0]);
    expect(dips[2]).toBeGreaterThan(dips[4]);
  });

  it('orders hand depth so each righter card sits in front along the view normal', () => {
    const poses = handCardPoses(5);
    // Occlusion between the parallel, camera-facing cards is decided by their
    // offset along the view normal — strictly increasing left→right guarantees
    // each card draws on top of the one to its left, whatever the arc does.
    const depth = poses.map((p) => projectOnAxis(p.position, FAN_NORMAL));
    for (let i = 1; i < depth.length; i++) expect(depth[i]).toBeGreaterThan(depth[i - 1]);
  });

  it('compresses a large fan to stay within the max half-width', () => {
    const poses = handCardPoses(10);
    const xs = poses.map((p) => p.position[0]);
    const maxAbs = Math.max(...xs.map((x) => Math.abs(x - HAND_ANCHOR[0])));
    expect(maxAbs).toBeLessThanOrEqual(HAND_MAX_HALF_WIDTH + 1e-6);
  });

  it('stacks deck cards upward by thickness', () => {
    const bottom = deckCardPose(0);
    const above = deckCardPose(3);
    expect(above.position[1]).toBeGreaterThan(bottom.position[1]);
  });

  it('places a slot card at its configured slot', () => {
    const pose = slotCardPose('slotC');
    expect(pose.position[0]).toBeCloseTo(SLOT_POSITIONS.slotC[0], 5);
    expect(pose.position[2]).toBeCloseTo(SLOT_POSITIONS.slotC[2], 5);
  });
});
