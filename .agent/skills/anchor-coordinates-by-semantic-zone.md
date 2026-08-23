---
name: anchor-coordinates-by-semantic-zone
description: >
  Everwar board layout — express a slot row's shared coordinate in terms of a
  named zone anchor (deck/grave/replen) rather than a raw literal, so "align this
  row with that zone" is stated in code and moving the zone auto-realigns the row.
load_when: >
  Editing Everwar board geometry in boardConfig.ts / layout.ts; aligning slot rows
  with deck/grave/replen; the user asks to move a zone or re-align rows.
  Match keywords: TOP_ROW_Z, BOTTOM_ROW_Z, DECK_ANCHOR, GRAVEYARD_ANCHOR,
  align row with zone, board layout, slot positions.
upstream: false
---
# Skill: Anchor row coordinates to semantic zones (Everwar)

## Trigger
A slot row must line up with a fixed feature (the A/C row aligns with GRAVE; the
B row aligns with DECK/REPLEN). Hard-coding each row's z as an unrelated literal
means a later "nudge the grave" request silently breaks the alignment the user
asked for.

## The pattern
Derive the row coordinate from the zone anchor it is meant to match, and name the
intent:

```ts
// the alignment is stated, not coincidental
const TOP_ROW_Z    = GRAVEYARD_ANCHOR[2];  // A/C pairs share grave's z
const BOTTOM_ROW_Z = DECK_ANCHOR[2];       // B row shares deck/replen's z
```

Now moving `GRAVEYARD_ANCHOR` moves the top row with it — the code documents
"these are aligned" and keeps them aligned for free.

## Everwar specifics (as-built, commit 1a54534)
- Columns: `PAIR_CENTERS_X = [-1.698, -0.566, 0.566, 1.698]`, `PAIR_HALF_GAP = 0.253`.
  Top row holds `[A | C]` pairs (A at `cx - halfGap`, C at `cx + halfGap`); B sits
  at the pair center `cx` on the bottom row.
- Anchors: `DECK_ANCHOR = [2.98,0,0.75]`, `GRAVEYARD_ANCHOR = [2.98,0,-0.3]`,
  `REPLEN_ANCHOR = [3.71,0,0.75]`. `HAND_ANCHOR = [0,0.42,2.72]`.
- **Camera must stay centered on x=0** — the hand-fan basis is frozen from
  `CAMERA_POSITION`/`HAND_ANCHOR` at module load; panning x rotates that basis and
  breaks fan symmetry *and* picking. Absorb field asymmetry in the playmat/anchors,
  never by moving the camera. (See skill `billboard-fan-viewplane-layering`.)

## Gotchas
- The 4 x-centers are hand-tuned literals; they won't auto-scale to a mirrored P2
  field or a variable column count without deriving them (open tech-debt).
- After any geometry edit, re-run `npx vitest run` — `layout.test.ts` pins these.

## Evidence
Everwar Phase 2 (2026-08-22): the "align B with deck/replen, A/C with grave" and
"add space between grave column and the field" requests were satisfied by moving
anchors; rows tracked automatically. Surfaced by Learner (project-specific).
