# Phase 2 Taskboard — Game Board Setup

**Phase:** Phase 2
**Scope:** Player 1's typed multi-zone field. Replace the 3 untyped Phase-1 slots with 12 typed slots (A/B/C × 4): a top row of `[A|C]` pairs, a B row centered under each pair, and labeled deck/graveyard/replen zones. Cards gain a type + letter face and shrink on the board; placement is type-gated; the drag highlight lights only valid targets. No graveyard/replen behavior, no P2 field, no re-pickup, no turns/rules.
**Stack:** TypeScript · React + Vite · React Three Fiber + drei · Zustand · @react-spring/three · Vitest.
**Landed:** commit `1a54534` — 43 tests green, `npm run typecheck` clean, user-approved feel.

## Story field legend

- **ID:** Stable Phase 2 story identifier.
- **Depends on:** Prerequisite stories that must land first.
- **Acceptance criteria:** Testable checklist mapped to Phase 2 FRs.
- **Test plan:** Unit/regression vs. rendered browser verification.

## Dependency backbone

`P2-S01 → {P2-S02, P2-S03, P2-S04} → P2-S05 → P2-S06 → P2-S07 → P2-S08`
(S02/S03/S04 need S01; S05 needs S02+S04; S06 needs S05; S07 needs S03+S05; S08 needs S06+S07.)

---

### P2-S01: Typed domain model — CardType, 12 typed slots, typed deck

**Depends on:** None (Phase 1 state layer)  **Status:** ✅ done

**Description:** Introduce `CardType='A'|'B'|'C'`, retype `SlotId` to the template union `` `${CardType}${1|2|3|4}` `` with a `slotType()` helper, give `Card` a `type` (drop the Phase-1 `number`/`CardNumber`), and rebuild the deck as 12 interleaved cards (4 each). Add `createEmptyBoard()`.

**Acceptance criteria:**
- [x] `SlotId` covers exactly `A1..A4,B1..B4,C1..C4`; `slotType(id)` returns the leading letter. (FR1)
- [x] `Card` carries a `CardType`; deck has 12 cards, 4 of each type. (FR2, FR3)
- [x] Deck order is interleaved so the opening 5 draws mixed types. (FR2)
- [x] `board` is a 12-key `Record<SlotId, CardId|null>`, all null at start. (FR1)

**Test plan:** Unit — `cardData.test.ts` (12 cards, 4-each counts, 12 slot ids, empty board, interleave). No render.

---

### P2-S02: Board grid geometry + zone anchors

**Depends on:** P2-S01  **Status:** ✅ done

**Description:** Replace the 3-slot `SLOT_POSITIONS` with a computed 12-slot grid: top row `[A|C]` pairs (A left, C right) aligned with the graveyard; B row centered on each pair's x-midpoint, aligned with deck+replen. Add deck/graveyard/replen anchors, `PLACEHOLDER_ZONES`, `BOARD_CARD_SCALE` + `BOARD_CARD_WIDTH/HEIGHT`, and retune the camera/hand anchor for the wider board.

**Acceptance criteria:**
- [x] Each C slot sits right of its paired A on the same row depth. (FR1)
- [x] Each B slot is centered on the x-midpoint between its A and C, on the bottom row. (FR1)
- [x] A/C row shares the graveyard's z; B row shares the deck/replen z. (FR1)
- [x] Deck/graveyard/replen anchors defined with a clear gap from the A/B/C sections. (FR1)

**Test plan:** Unit — `layout.test.ts` grid block (A/C pairing, B midpoint, distinct rows, left-to-right order). Render — board layout screenshot sign-off (S06).

---

### P2-S03: Type-gated placement rules

**Depends on:** P2-S01  **Status:** ✅ done

**Description:** Add `slotAcceptsType`, `validTargetSlots(board,cardType)`, and make `canDrop(board, slotId, cardType)` require empty AND matching type (type-gated only). Thread the dragged card's type into `gameStore.dropCard`.

**Acceptance criteria:**
- [x] `canDrop` true only for an empty, matching-type slot; false for wrong-type/filled/null. (FR4)
- [x] A C card can set even when its paired A is empty. (FR4)
- [x] `validTargetSlots` returns the matching-type empty slots (drives the highlight). (FR5)
- [x] `dropCard` on a wrong-type/filled slot returns the card to hand. (FR6)

**Test plan:** Unit — `slotRules.test.ts` (gating matrix, C-without-A) + `gameStore.test.ts` (typed drop, wrong-type return). No render.

---

### P2-S04: Typed card visual (A/B/C letter) + board scale

**Depends on:** P2-S01  **Status:** ✅ done

**Description:** `CardView` renders the card's type letter instead of a number. Add a `scale` to `CardVisual` (board/deck = `BOARD_CARD_SCALE`, hand/dragging = 1) and animate it in `MotionCard`.

**Acceptance criteria:**
- [x] Card face shows its A/B/C letter; cream body + gold back retained. (FR3)
- [x] Board/deck cards render smaller than hand cards; hand feel unchanged. (FR3, FR7)
- [x] Scale animates via the spring (no popping). (FR7)

**Test plan:** Unit — `poseSelectors.test.ts` (board scale < 1). Render — visual sign-off (S06).

---

### P2-S05: Render 12 slots, zones, resized playmat

**Depends on:** P2-S02, P2-S04  **Status:** ✅ done

**Description:** `SlotView` renders all 12 typed slots with type labels plus the GRAVE/REPLEN labeled placeholders; `BoardView` playmat resized/shifted for the wider field. Deck renders via existing face-down card poses at the new anchor.

**Acceptance criteria:**
- [x] 12 slots render in the correct grid with type labels. (FR1)
- [x] GRAVE + REPLEN render as labeled empty placeholders. (FR1)
- [x] Deck stack renders at its repositioned anchor; playmat covers the field. (FR1)

**Test plan:** Render — screenshot sign-off (S06).

---

### P2-S06: Camera + card-size framing pass (user sign-off)

**Depends on:** P2-S05  **Status:** ✅ done

**Description:** Retune camera position/target/fov and board card scale so the whole field frames cleanly; iterate on user screenshots. Included the approved follow-ups: A/C aligned with grave & B with deck/replen, B centered between A/C, a gap between the sections and the deck column, and the hand pushed toward the player so a hover-raised card clears the B row.

**Acceptance criteria:**
- [x] Whole field (12 slots + deck/grave/replen) fits without cutoff. (FR7)
- [x] Rows align with their right-side zones; B centered between A/C. (FR1)
- [x] Hover-raised hand card clears the B row. (FR7)
- [x] User approved the framing/feel. (FR7)

**Test plan:** Render — live browser screenshots, user-approved. Fan-basis symmetry preserved by keeping camera centered on x=0 (guards `layout.test.ts`).

---

### P2-S07: Type-gated drag highlight + 12-slot picking

**Depends on:** P2-S03, P2-S05  **Status:** ✅ done

**Description:** During a drag, only matching-type empty slots show the gold outline (`SlotView` subscribes to board + dragged card's type). Slot hit-testing covers all 12 slots.

**Acceptance criteria:**
- [x] Only matching-type empty slots highlight while dragging; others stay dim. (FR5)
- [x] No highlights when not dragging. (FR5)
- [x] `slotAtPoint` resolves each of the 12 slots (nearest-within-radius). (FR4)

**Test plan:** Unit — `hitTest.test.ts` (all 12 slots, nearest tie-break). Render — highlight sign-off.

---

### P2-S08: Full Phase 2 regression + rendered verification

**Depends on:** P2-S06, P2-S07  **Status:** ✅ done

**Description:** Run the full validation pass: unit/regression suite + typecheck + rendered browser verification of the board and card feel.

**Acceptance criteria:**
- [x] FR1 typed field + zones verified.
- [x] FR2 typed deck + deal verified.
- [x] FR3 typed cards + board shrink verified.
- [x] FR4 type-gated placement verified.
- [x] FR5 type-gated highlight verified.
- [x] FR6 invalid drop return verified.
- [x] FR7 Phase 1 feel preserved verified.
- [x] Full Vitest suite (43 tests) + `npm run typecheck` green.
- [x] Phase 2 docs/changelog/client notes updated before handoff.

**Test plan:** Unit/regression — full `npx vitest run`. Render — user-approved board + feel.
