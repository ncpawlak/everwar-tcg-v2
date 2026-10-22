# Learnings — Everwar Phase 2: Game Board Setup

**Date:** 2026-08-22  
**Cycle:** Phase 2 — typed multi-zone player field  
**Commit:** `1a54534`  
**Version bump:** 0.2.0 → 0.3.0 (MINOR — significant new product slice)

---

## What Shipped 🎉

Phase 2 replaced the three placeholder slots with a complete typed 12-slot player field:
four columns of **[A | C]** pairs in the top row and four **B** slots in the bottom row,
plus labeled GRAVE and REPLEN placeholder zones. Cards gained a type (A, B, or C), display
their letter on the face, and are subject to type-gated placement rules — you can only drop
an A card into an empty A slot. Drag highlighting now intelligently shows only matching-type
empty slots. Cards on the board and in the deck shrink to a Master-Duel-style compact size
while the hand stays full scale. The camera and hand anchor were retuned for the wider field.
43 Vitest tests are green and `npm run typecheck` is clean.

The architecture from Phase 1 absorbed every change cleanly: no layer boundary was violated,
no spring animation was rearchitected, and the DOM input pipeline required zero changes.
Phase 1's foundation genuinely carried the weight.

---

## What Worked Well

### 1. Discriminant encoded in the entity id

`SlotId` is a TypeScript template literal type `` `${CardType}${SlotIndex}` `` (e.g. `"A3"`,
`"B1"`). The accepted card type is derivable by reading `slotId[0]` — no parallel lookup map,
no risk of map drift, and TypeScript narrows the string to a `CardType` at the call site.
`slotType(slotId)` is a two-line helper in `types.ts` that the entire codebase shares. This
same pattern applies whenever a discriminant (type, family, category) needs to be associated
with a uniquely-identified entity: encode it in the id and derive it, rather than storing it
in a separate record.

### 2. Visual scale in the animation layer, not in the asset

Board and deck cards needed to be ~72% the size of hand cards so the wider field fit
comfortably on screen. The sizing was applied as `BOARD_CARD_SCALE` in `motionConfig.ts` /
`MotionCard.tsx` — not by changing the canonical `CARD_WIDTH`/`CARD_HEIGHT` constants or the
`CardView` geometry. Because the Phase 1 slot positions and hit-test radii were expressed in
terms of `BOARD_CARD_WIDTH` = `CARD_WIDTH * BOARD_CARD_SCALE`, the layout math adapted
automatically. Had the scale been baked into the asset constants, every downstream consumer
(hit-test radius, slot spacing, hand fan) would have needed recalibration. Separating "what
the card is" from "how big it looks in this zone" is the right seam.

### 3. Layout alignment by semantic zone, not by arbitrary coordinates

The A/C top row was locked to `TOP_ROW_Z = GRAVEYARD_ANCHOR.z` and the B bottom row to
`BOTTOM_ROW_Z = DECK_ANCHOR.z`. This means each row visually shares a horizontal scan-line
with its paired right-side zone — a design constraint that was easy to verify by inspection
and easy to maintain: moving the GRAVE zone automatically realigns the A/C row. Expressing
coordinates in terms of semantic anchors, not raw numbers, makes layout intent readable
and change-safe.

### 4. `validTargetSlots` as the single type-aware policy gate

Both the drag-time highlight (`SlotView.tsx`) and the drop validation (`canDrop`) delegate
to `validTargetSlots(board, cardType)` in `slotRules.ts`. There is exactly one place in the
codebase that answers "which slots are legal right now?" — the UI and the store cannot
disagree. Centralizing the policy into a pure function made both consumers trivially testable
and will be the right extension point for Phase 3+ rule elaboration (per-slot ownership,
zone locks, etc.).

---

## Pitfalls Hit and How They Were Resolved

### Pitfall 1: Slot hit-test radius used hand-scale card dimensions

**What happened:** `SLOT_HIT_RADIUS` was originally sized to match hand-scale card geometry.
With 12 tightly spaced board slots, a radius tuned for full-size cards caused adjacent
slots to overlap their hit areas, producing incorrect drop targets near column boundaries.

**How it was resolved:** `SLOT_HIT_RADIUS` was recalibrated to `0.34` world units, derived
from `BOARD_CARD_WIDTH * 0.55` (the board scale, not the hand scale). All 12 hit-test cases
in `hitTest.test.ts` were updated to reflect the corrected geometry, and a matrix test was
added confirming no adjacent-slot bleed.

**Lesson:** When entity geometry changes zones (hand → board = 72% scale), every derived
constant — hit radius, spacing, arc — must be re-derived from the zone-local scale, not the
global asset constant.

---

### Pitfall 2: Type-gating highlight required dragging card type in state

**What happened:** The drag-highlight logic in `SlotView.tsx` originally checked only whether
a slot was empty. To highlight only matching-type slots during a drag, the component needed
to know the dragged card's type. The initial pass read `dragging.cardId` and looked up the
type from `cardsById` inside the component — a selector that returned a new derived value
on every render.

**How it was resolved:** `poseSelectors.ts` / the store subscription in `SlotView.tsx` was
revised to derive `dragging.cardType` at the selector boundary and pass it as a stable
primitive. The component subscribes to `(s.dragging?.hoveredSlotId, dragCardType)` — two
primitives — rather than to the whole `dragging` object, avoiding fresh-reference re-render
loops (the Phase 1 Zustand selector pitfall).

**Rule reinforced:** Derive discriminant values at the selector boundary; never compute them
inline in the component body. Pass primitives, not objects/arrays, to avoid reference-equality
churn.

---

### Pitfall 3: Camera/hand retuning required iterative screen-review, not unit tests

**What happened:** Moving the hand anchor toward the player (so raised cards clear the B row)
and widening the camera framing for the 12-slot field required several rounds of screenshot
review. The correct anchor was not predictable from math alone because "clearing the B row
with a hover-raised card" depends on the projected card height at the perspective camera
angle — a quantity that's easy to verify visually but hard to write as a unit assertion.

**How it was resolved:** Constants (`CAMERA_POSITION`, `HAND_ANCHOR`) were tuned iteratively
via live browser preview and approved via screenshots. No unit test covers "raised card does
not visually overlap the B row" — it remains a manual visual gate.

**Lesson for the Planner:** Camera + hand layout ACs for Phase 3 should include an explicit
visual verification step ("approved via screenshot at the review stage"). Don't try to unit-
test perspective clearance; it's a human-eye check.

---

## Taskboard Analysis

### Stories Delivered

Phase 2 comprised the board-setup work scoped by the Planner. All stories covering the typed
slot system, card type rendering, placement rules, drag highlights, zone placeholders, deck
generation, and camera retuning were delivered. The dependency chain (types → deck → rules →
render → camera) was accurate and caused no blocking surprises.

### What Changed Mid-Cycle

**Hit-test radius** was not flagged as a dependent-on-scale constant in the planning stories.
The radius correction (Pitfall 1 above) was a small unplanned fix discovered during the 12-slot
hit-test test pass. For future phases: any story that changes entity scale should have an
explicit AC item "recalibrate hit-test radius for new zone scale."

**Zustand selector precision** (Pitfall 2) was a known pitfall from Phase 1 but still required
an intra-cycle correction. The Phase 1 recommendation to add a project-wide selector constraint
to the architecture doc was not yet actioned. This should be a blocking item before Phase 3
stories begin.

### Recommendations for the Planner (Phase 3)

1. **Add "recalibrate derived constants" to any scale-change story.** Any story that modifies
   zone scale or adds a new zone must enumerate which downstream constants (hit radius, spacing,
   arc) are derived from that scale and require re-derivation.

2. **Add visual verification AC to camera/layout stories.** "Camera framing approved via
   screenshot" is the right acceptance criterion for any story that moves an anchor or changes
   FOV. Don't try to unit-test it.

3. **Enforce the Zustand selector constraint project-wide.** Add to `architecture-log`:
   "All Zustand selectors that expose non-primitive values must use `useShallow` or be
   pre-derived to a primitive before the component boundary." This pitfall has now hit twice.

4. **Pre-plan placeholder zone interactions.** GRAVE and REPLEN are labeled tiles with no
   behavior. Phase 3 will add behavior to them. Plan the store state fields and actions for
   graveyard/replen logic up front to avoid mid-cycle `types.ts` surgery.

---

## Skill / Learning Candidates (for Orchestrator classification)

| # | Proposed Name | Universal vs. Project-Specific | Rationale |
|---|---|---|---|
| 1 | `discriminant-in-entity-id` | **Universal** | Encode a discriminant (type, family, category) in the entity id as a template literal type so it's derivable rather than stored in a parallel map — eliminates map-drift bugs and narrows types automatically at the call site. |
| 2 | `zone-scale-in-animation-layer` | **Universal** | Apply per-zone visual scale in the animation/motion layer rather than changing the canonical asset dimensions — preserves the layout math and hit-test radii for other zones and makes "this card looks smaller on the board" a render concern, not a domain concern. |
| 3 | `policy-gate-as-pure-function` | **Universal** | Centralize placement/interaction validity (e.g. "which slots are legal?") in a single pure function consumed by both the UI highlight path and the store drop path — the two can never disagree, and the function is trivially unit-tested. |
| 4 | `anchor-coordinates-by-semantic-zone` | **Project-specific** | Express row/slot z-coordinates in terms of named zone anchors (e.g. `TOP_ROW_Z = GRAVEYARD_ANCHOR[2]`) so layout intent is self-documenting and moving a zone automatically realigns the row that references it. |
