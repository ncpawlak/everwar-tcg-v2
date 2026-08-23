---
name: zone-scale-in-animation-layer
description: >
  Use when pieces must appear at different sizes in different zones (small on the
  board, full-size in hand) but an existing layout/fan is already approved and
  must not shift. Apply per-item visual scale in the motion/animation wrapper —
  never in the canonical asset geometry or layout math.
load_when: >
  Resizing entities per zone/context while preserving an approved layout, fan,
  hit radius, or coordinate math. Match keywords: card scale, board scale,
  per-zone size, shrink on board, preserve fan, visual scale vs geometry.
upstream: true
---
# Skill: Put per-zone scale in the animation layer, not the geometry

## Trigger
Board/deck pieces should be smaller than hand pieces, but the hand fan (spacing,
angles, layering) is already dialed-in and user-approved. Changing the base card
width/height, or scaling in the layout function, would ripple into the fan math,
hit radii, and every constant tuned against the old size.

## The pattern
Treat scale as a *visual, springable property selected per pose*, computed
alongside position/rotation and consumed only by the render/motion wrapper:

```ts
// pose selector — one place decides scale by context
function selectCardVisual(card): CardVisual {
  const scale = (zone === 'board' || zone === 'deck') ? BOARD_CARD_SCALE : 1;
  return { position, rotation, scale };
}
// motion wrapper springs it like any other channel
const { scale } = useSpring({ scale: visual.scale, ... });
<a.group scale={scale}> ...card mesh... </a.group>
```

- Layout math, fan basis, and hit-test radii keep operating on the **canonical
  size** (scale 1) — the approved hand fan stays byte-for-byte identical.
- Only zones that opt in shrink; everything else is untouched.
- Because scale is a spring channel, size changes tween for free (deal, return).

## Gotchas
- Hit-testing should raycast the **logical poses at canonical size**, not the
  scaled mesh, so picking doesn't drift when a piece is visually smaller.
- If a zone's layout genuinely needs tighter *spacing* to match the smaller art,
  change that zone's spacing constant explicitly — don't let scale masquerade as
  spacing.
- Keep the scale decision in the selector (one source), not scattered in mesh JSX.

## Evidence
Everwar Phase 2 (2026-08-22): `BOARD_CARD_SCALE = 0.72` applied via
`CardVisual.scale` in `poseSelectors.ts` + `MotionCard.tsx`. Board/deck shrank;
the Phase-1 hand fan (scale 1) stayed pixel-identical and all fan tests passed
unchanged. Senior Coder decision D4; also surfaced by Learner.
