# Decision Record — Phase 2 · 2026-08-22

**Author:** Senior Coder (end-of-Phase-2 architectural close-out)
**Phase:** Phase 2 — typed multi-zone game board (`1a54534`)
**Build health:** `npm run typecheck` green · `npx vitest run` green (43 tests, 7 files)
**Scope:** the architecturally significant decisions that define Phase 2. Phase 1's D1 (DOM-driven input) and D2 (view-plane fan) remain **permanent** and are untouched; Phase 2 builds on top of them. D3 and D4 below are the new load-bearing decisions; a third note records the deliberate placement-rule scope.

---

## D3 — Slot type is encoded in the slot id (letter+index template union), not stored in a parallel map

### Status
**ADOPTED · PERMANENT PATTERN.** A slot's accepted card type is *derivable* from its id. Do not introduce a parallel `slotId → type` lookup table.

### Context / problem
Phase 1 had three untyped, positional slots (`slotA`/`slotB`/`slotC`) — just occupancy cells with no notion of "what belongs here." Phase 2 needed a typed field: three card families (A/B/C), 12 slots, and a placement rule that only accepts a matching-type card. The naive approach is a second data structure — `const SLOT_TYPES: Record<SlotId, CardType>` — that every consumer (rules, hit-highlight, rendering, tests) reads alongside the board. That invites drift: the id set and the type map can disagree, and adding a slot means editing two places.

### Decision
Encode the type **in the id itself** and derive everything from the leading character:

- `CardType = 'A' | 'B' | 'C'` and `SlotIndex = 1 | 2 | 3 | 4` (`src\state\types.ts:8,11`).
- `SlotId` is a **template-literal union** `` `${CardType}${SlotIndex}` `` → exactly `A1..A4, B1..B4, C1..C4` (`src\state\types.ts:19`). The type system enumerates all 12 legal ids; a typo like `A5` or `D1` fails to compile.
- `slotType(slotId)` reads the first character (`src\state\types.ts:22-24`); `slotTypeLabel` mirrors it for rendering (`src\board\boardConfig.ts:103-105`).
- `Card` now carries `type: CardType` (`src\state\types.ts:29`); the Phase-1 `number: 1..10` field is **gone**.
- `SLOT_IDS` is generated from the families, not hand-listed: `CARD_TYPES.flatMap(...)` (`src\state\cardData.ts:13-15`); `createEmptyBoard()` maps those to nulls (`src\state\cardData.ts:47-49`); `board` is `Record<SlotId, CardId|null>` (`src\state\types.ts:58`).

Every consumer reads the leading letter, never a side table:
- Rules: `slotAcceptsType(slotId, cardType) = slotType(slotId) === cardType` (`src\board\slotRules.ts:16-18`).
- Drop validity: `canDrop` = empty **AND** matching type (`src\board\slotRules.ts:44-51`).
- Highlight scan: `validTargetSlots` filters `SLOT_IDS` by empty + type (`src\board\slotRules.ts:30-37`).
- Render: `SlotView` derives the type label and highlight from the id (`src\render\SlotView.tsx:30-36,56`).

### Why this design (not a parallel map)
- **Single source of truth by construction.** The id *is* the type declaration; there is no second structure to keep in sync. It is impossible for a slot's id and its accepted type to disagree.
- **Compile-time exhaustiveness.** The template union means the 12 ids are known to the type checker. `createEmptyBoard`, `Record<SlotId, …>`, and every switch over slots are checked against the full set — no runtime "unknown slot" path.
- **Uniform derivation.** Rules, hit-testing, highlight, and labels all call the same `slotType`/`slotAcceptsType`, so they can never diverge in how they classify a slot.

### Consequences / tradeoffs
- (+) Zero-drift typing; adding/removing a slot family is one edit to `CardType`/`SLOTS_PER_TYPE` and the union follows.
- (+) Layout (`SLOT_POSITIONS`) and iteration order (`SLOT_IDS`) are independent concerns — geometry lives in `boardConfig`, membership in the union — but both are keyed by the same ids.
- (−) **Renaming a family is a type-level change.** Changing `'A'` to something else, or the index arity, touches the `SlotId`/`CardType` unions and everything that pattern-matches the first character. This is intentional friction: the id encodes meaning, so meaning changes are loud. Contrast with Phase 1's positional `slotA/B/C`, which carried no type semantics at all.
- (−) The convention "first char = type" is implicit in string indexing (`slotId[0]`). It is centralized in `slotType`/`slotTypeLabel`, so consumers never re-implement the slice — keep it that way.

### Guardrails for future phases
- Do **not** add a `Record<SlotId, CardType>` or any parallel classification map. If a slot needs richer metadata (owner, adjacency, buffs), extend via id-keyed records that are *generated from* `SLOT_IDS`, not hand-authored.
- New per-type rules go through `slotType`/`slotAcceptsType`; do not re-slice `slotId[0]` at call sites.
- Mirroring the field to Player 2 should extend the id scheme (e.g. a player prefix) rather than duplicating the union by hand.

---

## D4 — Per-card visual scale in the animation layer, not a global card size — and the camera stays centered on x=0

### Status
**ADOPTED · PERMANENT PATTERN.** Board/deck cards shrink via a springable `CardVisual.scale`; the hand fan keeps scale 1 and the camera keeps x=0 so the Phase-1 fan (D2) is preserved exactly.

### Context / problem
The board went from 3 slots to a 12-slot, two-row field spanning roughly ±1.95 in x plus a deck/grave/replen column out at x≈3.7. Full-size hand cards (`CARD_WIDTH 0.62 × 0.9`) placed on that grid overlap their neighbors — the field is too dense. The obvious fix, shrinking `CARD_WIDTH`/`CARD_HEIGHT` globally, would also shrink the **hand fan**, which is the approved, frozen Phase-1 deliverable (D2). Worse, D2's fan basis is baked from `CAMERA_POSITION`/`HAND_ANCHOR` at module load; nudging the camera in x to recenter the wider field would rotate that basis and desymmetrize the fan (and break the layout regression tests).

### Decision
Separate **card footprint** (world geometry, unchanged for the hand) from **board presentation scale** (a per-card uniform mesh scale chosen by zone):

- New constants: `BOARD_CARD_SCALE = 0.72`, with `BOARD_CARD_WIDTH`/`BOARD_CARD_HEIGHT` derived for slot-marker sizing (`src\board\boardConfig.ts:29-31`). Master-Duel-style shrink.
- `CardVisual` gained a `scale` field (`src\animation\poseSelectors.ts:19-20`). `selectCardVisual` assigns it by zone: **board → 0.72** (`:41`), **deck → 0.72** (`:83`), **dragging → 1** (`:55`), **hand → 1** (`:73`).
- `MotionCard` now springs `scale` alongside position/rotation, so a card grows as it leaves the hand into a drag and shrinks as it snaps to a slot — the scale change is animated, not a pop (`src\animation\MotionCard.tsx:23-28,34`).
- Deck-stack and slot-rest heights are scaled to match (`deckCardPose`/`slotCardPose` multiply `CARD_THICKNESS` by `BOARD_CARD_SCALE`, `src\board\layout.ts:83,130`), so shrunk cards don't float.
- **The camera stays centered on x=0** (`CAMERA_POSITION = [0,8.4,7.7]`, `CAMERA_TARGET = [0,0,-0.55]`, fov 44, `src\board\boardConfig.ts:19-21`). It was re-tuned in y/z/fov/target to frame the taller field, but **x was deliberately kept 0**. `HAND_ANCHOR` was pushed toward the player to `[0,0.42,2.72]` (`:74`) so a hover-raised card clears the new B row — again keeping x=0.

### Why this design (not a global resize or a camera pan)
- **D2 is preserved by construction.** The hand fan runs at scale 1 with the identical basis; because the camera's x is still 0, `TO_CAMERA`/`RIGHT`/`VIEW_UP` (`src\board\layout.ts:30-56`) resolve to the same symmetric basis as Phase 1. The frozen fan is visually unchanged — its regression tests (`layout.test.ts`) still pass untouched.
- **Scale is a visual concern, so it lives in the visual layer.** Shrink is a rendering decision (fit the field), not a domain fact — cards don't "become smaller" in game terms. Putting `scale` in `CardVisual` keeps state/geometry honest (a card's footprint is one number) and makes the shrink springable for free.
- **Zone-driven, so transitions animate.** Because scale is selected per zone by the same pure selector that picks pose/face/feel, hand→drag→board naturally interpolates size through `MotionCard` with no imperative bookkeeping — consistent with the Phase-1 state→selector→spring spine.

### Why the camera x stayed 0 (recorded because it's a real constraint, not an aesthetic whim)
Moving the camera in x to "center" the asymmetric field (field center is ~x=0.6 once the deck column is included) would recompute D2's fan basis off-axis. That rotates `RIGHT`/`VIEW_UP`, so the fan would no longer spread symmetrically about `HAND_ANCHOR`, and `layout.test.ts`'s symmetric-centering / symmetric-splay assertions would fail. The field asymmetry is instead absorbed by shifting the **playmat** (`BoardView` plane centered at `[0.6, …]`, `src\render\BoardView.tsx:7`) and the anchors, never the camera x. **If a future phase needs camera motion, D2's basis must first be made a function of the live camera (see architecture debt #2) — until then, camera x is load-bearing at 0.**

### Consequences / tradeoffs
- (+) Board fits comfortably; hand stays exactly as approved; the size change reads as a premium grow/shrink animation.
- (+) One knob (`BOARD_CARD_SCALE`) tunes the whole board population; slot markers derive from it so highlights track card size.
- (−) `scale` is a new axis of visual state the selector must set for every zone; forgetting it defaults to `MotionCard`'s `scale = 1`, which would silently full-size a board card. Covered by `poseSelectors.test.ts` asserting board scale < 1.
- (−) Camera x is now an implicit invariant tied to D2. It is documented here and in the quality pass, but it is a coupling: "you may not pan the camera in x without refactoring the fan basis."

### Guardrails for future phases
- Keep the hand at scale 1 and camera x at 0 unless/until the fan basis is made camera-relative. Any change to camera x requires re-verifying the fan symmetry tests.
- New zones that place cards on the mat (opponent field, extra rows) should reuse `BOARD_CARD_SCALE`, not invent their own size.
- Do not fold `scale` back into `CARD_WIDTH`/`CARD_HEIGHT`; footprint and presentation scale are intentionally separate.

---

## Note — Placement is type-gated ONLY (no A–C adjacency requirement yet)

### Status
**DELIBERATE SCOPE CHOICE**, recorded so it isn't mistaken for an omission.

Phase 2's `canDrop` returns true iff the target slot is **empty AND its type matches the card's type** (`src\board\slotRules.ts:44-51`). Notably, a **C card can be placed with no requirement that its paired A slot is filled** — there is no adjacency/prerequisite rule between the A and C halves of a column pair, even though they are laid out as visual pairs (`buildSlotPositions`, `src\board\boardConfig.ts:44-56`). This is intentional: Phase 2 establishes the typed field and the type gate; relational placement rules (A must precede C, B unlocks on a full pair, etc.) are a future rules-engine concern. `gameStore.dropCard` looks up the dragged card's type and delegates the decision entirely to `canDrop` (`src\state\gameStore.ts:83-84`), so tightening the rule later is a one-function change behind an unchanged store/render surface. The test `slotRules.test.ts` explicitly locks "C-without-A allowed" so a future adjacency rule is a conscious, test-breaking change rather than an accident.

This is the natural seam for the eventual `rules\` layer noted in the architecture doc's future-seams table.
