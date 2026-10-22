---
name: billboard-fan-viewplane-layering
description: >
  Use when laying out a fan or stack of camera-facing (billboard) cards/tiles
  under a tilted/overhead 3D camera and they ghost, interpenetrate, cascade in a
  diagonal "staircase," or the wrong one draws on top. Covers a view-plane basis
  layout that guarantees clean, order-correct occlusion.
load_when: >
  Fanning/stacking cards or sprites in three.js/R3F; ghosting, z-fighting,
  interpenetration, wrong overlap order, or staircase artifacts under an angled
  camera. Match keywords: hand fan, card stack, billboard, ghosting, z-fighting,
  painter order, overlap, occlusion.
upstream: true
---
# Skill: Billboard fan/stack via a view-plane basis

## Problem
You want overlapping camera-facing cards (a hand fan, a stacked pile) where each
card is cleanly under the next, with no ghosting/interpenetration. Naive attempts
fail under a tilted camera:
- **Arc by moving cards in world-Y** → under an overhead camera, lower Y = farther
  from the camera, so the *middle* card ends up nearest and draws on top of the
  ends. The arc silently controls depth order.
- **Layer cards along world-Z** → they cascade in a diagonal "staircase" (farther-Z
  reads as higher + smaller on screen).
- **Roll splay via `rotation.z` (world axis)** → tips camera-facing cards out of the
  view plane so overlapping cards interpenetrate (ghosting).

## The pattern
Build the layout in the **camera's view plane** using an orthonormal basis, and
carry depth (painter order) on the view-normal axis ONLY.

1. **Basis** (recompute from the *live* camera if the camera can move):
   - `NORMAL` = unit vector from the anchor toward the camera (cards face this).
   - `RIGHT`  = `normalize(worldUp × NORMAL)` — screen-horizontal.
   - `VIEW_UP` = `normalize(NORMAL × RIGHT)` — screen-vertical.
2. **Position** each item `i` (offset from center) as:
   `pos = anchor + RIGHT*(offset*spacing) + VIEW_UP*(-dip) + NORMAL*(offset*layerStep)`
   - `RIGHT * spread` → horizontal fan (no depth change).
   - `VIEW_UP * -dip` (e.g. `dip = offset² * k`) → arc dips ends DOWN on screen,
     purely in-plane, so it can NEVER change draw order.
   - `NORMAL * (offset*layerStep)` → the ONLY depth term. Monotonic in `offset`, so
     each righter item is strictly nearer the camera → wins the z-buffer at every
     overlap. Guarantees strict "each item under the one to its right."
3. **Rotation**: face the card's local +Z to `NORMAL` (quaternion
   `setFromUnitVectors(+Z, NORMAL)`), then roll the splay **about the NORMAL axis**
   (`setFromAxisAngle(NORMAL, roll)`). Rolling about the plane normal keeps every
   card a plane *parallel* to the others → offset planes never interpenetrate.
4. **layerStep** only needs to slightly exceed card thickness — keep it small so it
   doesn't visibly drift the fan on screen (movement along NORMAL is ~along the view
   ray, so it's nearly invisible except for depth).

## Why occlusion is correct by construction
For opaque cards, occlusion is decided per-pixel by the depth buffer, not draw
order. All cards are parallel planes; item `i+1`'s plane is offset one `layerStep`
toward the camera along the shared normal, so it is nearer *everywhere* they
overlap. The arc/roll live entirely in the plane and cannot flip this.

## Testing invariants (robust, camera-agnostic)
Don't assert raw world-Y or center-distance — assert the basis decomposition:
- spread `dot(pos-anchor, RIGHT)` strictly increasing left→right,
- dip `dot(pos-anchor, VIEW_UP)`: center highest, ends lower,
- depth `dot(pos-anchor, NORMAL)` strictly increasing left→right (painter order).
- For the roll, apply the Euler to a reference up-vector and check its screen tilt
  mirrors left vs right.

## Adaptive spacing
Compress as the set grows, spread as it shrinks:
`spacing = min(baseSpacing, maxHalfWidth / center)` where `center = (count-1)/2`.

## Watch out
If the basis is frozen to a fixed camera, moving/orbiting the camera later breaks
BOTH the fan and any picking that raycasts these poses. Make the basis a function
of the live camera before adding camera motion.

## Evidence
Everwar Phase 1 (2026-08-22): eliminated hand-fan ghosting, staircase, and
middle-on-top under an overhead angled camera. Independently surfaced by both the
Senior Coder and Learner close-out agents.
