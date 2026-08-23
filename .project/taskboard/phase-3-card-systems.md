# Phase 3 Taskboard — Card Systems

**Phase:** Phase 3  
**Scope:** Advanced card systems on the single-player board: rich card data, click-to-inspect, pile mechanics, destroy/replen/shuffle flows, A-zone stat overlays, C-card support boosts, summon reveal, and B-card abilities. No Player 2, no turn state, no resource system, no real combat damage resolution.  
**Stack:** TypeScript · React + Vite · React Three Fiber + drei · Zustand · @react-spring/three · Vitest.  
**Landed:** commits `2b63640`, `bee4a99`, `47d3c44`, `fbf17bd`, `f15d8fc`. Phase 3 landed with 89 tests green; close-out re-run on the current suite is 127 tests green and `npx tsc --noEmit` clean.

## Story field legend

- **ID:** Stable Phase 3 story identifier.
- **Depends on:** Prerequisite stories that must land first.
- **Acceptance criteria:** Testable checklist mapped to Phase 3 functionality.
- **Test plan:** Unit/regression vs. rendered browser verification.

## Dependency backbone

`P3-S01 → P3-S02 → P3-S03 → P3-S04 → P3-S05 → P3-S06 → P3-S07 → P3-S08 → P3-S09`

---

### P3-S01: Rich card data model and shared card theme

**Depends on:** Phase 2 typed cards  **Status:** ✅ done

**Description:** Expand `Card` from a type-only placeholder into a combat card record with name, cost, rarity, effect, flavor, and type-specific values. Add shared card-theme constants for type/rarity rendering.

**Acceptance criteria:**
- [x] `Card` supports name, cost, rarity, effect, and flavor.
- [x] A cards carry HP/ATK/DEF by the end of Phase 3; B cards carry ability; C cards carry boost information when set.
- [x] `CARD_LIBRARY` defines all 12 deck cards.
- [x] Card face and inspection panel share type/rarity theme values.

**Test plan:** Unit — `cardData.test.ts` validates per-type card profiles. Typecheck ensures optional fields are handled.

---

### P3-S02: Click-to-inspect panel for hand and board cards

**Depends on:** P3-S01  **Status:** ✅ done

**Description:** Add card selection state and a left-side DOM inspection panel. Rewrite input as a click/drag gesture so a click inspects but a drag still plays cards.

**Acceptance criteria:**
- [x] Clicking a hand card opens the left inspection panel.
- [x] Clicking a board card opens the same panel.
- [x] Clicking empty space closes the panel.
- [x] Dragging a hand card still uses the existing placement flow.
- [x] Overlay clicks are ignored by board input via `data-ui-overlay`.

**Test plan:** Unit — `pickMath.test.ts`, `hitTest.test.ts`, `gameStore.test.ts`. Render — user-approved panel behavior.

---

### P3-S03: Rich 3D card faces

**Depends on:** P3-S01  **Status:** ✅ done

**Description:** Render game-relevant card details directly on `CardView`: name band, cost pip, rarity accent, type label, effect text, and type-specific footer.

**Acceptance criteria:**
- [x] Hand and board cards show the same real card identity as the inspection panel.
- [x] A cards show HP/ATK/DEF.
- [x] B cards show their ability label.
- [x] C cards show either a generic boost hint or the rolled boost once set.

**Test plan:** Typecheck and rendered browser approval.

---

### P3-S04: Destroy mechanics and graveyard pile

**Depends on:** P3-S02  **Status:** ✅ done

**Description:** Add temporary controls that destroy occupied A or B zone cards. Destroying A also sends the linked C card to the graveyard. Cards animate into a face-up graveyard stack.

**Acceptance criteria:**
- [x] `graveyard: CardId[]` exists and initializes empty.
- [x] `destroyZoneA()` chooses a random occupied A slot and clears it.
- [x] A destroy also clears/appends the linked C slot when occupied.
- [x] `destroyZoneB()` clears/appends only a B slot.
- [x] Graveyard cards render face-up in a stacked pile at the GRAVE anchor.

**Test plan:** Unit — `gameStore.test.ts`, `layout.test.ts`, `poseSelectors.test.ts`. Render — user-approved destroy buttons.

---

### P3-S05: Pile search modal

**Depends on:** P3-S04  **Status:** ✅ done

**Description:** Add one reusable pop-up for browsing deck, graveyard, and replenish piles in a six-wide, scrollable grid. Pile tiles can be clicked to inspect full card details.

**Acceptance criteria:**
- [x] Search Deck, Search Graveyard, and Search Replen buttons open the same modal component with different source data.
- [x] The modal closes from backdrop, close button, or Escape.
- [x] Cards in piles can be selected into `InspectionPanel`.
- [x] The inspection panel layers above the modal when needed.

**Test plan:** Store selection tests; rendered browser approval.

---

### P3-S06: Replenish, disturb, and shuffle mechanics

**Depends on:** P3-S04, P3-S05  **Status:** ✅ done

**Description:** Add the replenish pile and temp actions: send A(+linked C) to replenish, disturb deck top to replenish, shuffle deck, return replen/graveyard/hand to deck then shuffle.

**Acceptance criteria:**
- [x] `replen: CardId[]` exists and initializes empty.
- [x] `replenZoneA()` mirrors A destroy but targets replenish.
- [x] `disturbDeck()` moves the deck top (last array item) to replenish.
- [x] `shuffleDeck()` randomizes the deck after a split-pile animation.
- [x] `replenIntoDeck()`, `graveyardIntoDeck()`, and `handIntoDeck()` gather cards then shuffle.
- [x] Multi-card draw/gather behavior avoids simultaneous unreadable pops where needed.

**Test plan:** Unit — `shuffle.test.ts`, `gameStore.test.ts`, `layout.test.ts`. Render — user-approved pile/search/shuffle flow.

---

### P3-S07: A-zone stat overlays

**Depends on:** P3-S01, P3-S03  **Status:** ✅ done

**Description:** Show a floating, billboarded combat plate for every occupied A slot. The plate is centered between the linked A/C pair and shows HP, ATK, and DEF.

**Acceptance criteria:**
- [x] Only occupied A slots show stat overlays.
- [x] Overlay is centered between linked `A_i` and `C_i`.
- [x] HP appears as a readable bar plus text.
- [x] ATK/DEF are stacked as separate rows.
- [x] Overlay suppresses while that A card is in summon reveal, then appears after landing.

**Test plan:** Unit — `combatStats.test.ts` for values; render — user-approved placement/readability.

---

### P3-S08: C-card support boosts and placement gating

**Depends on:** P3-S07  **Status:** ✅ done

**Description:** Rework C cards into boost-only support cards. They can be placed only in a C slot whose linked A slot is occupied, then roll a random HP/ATK/DEF boost that updates the A overlay.

**Acceptance criteria:**
- [x] `slotPlaceable` rejects C-slot drops when linked A is empty.
- [x] Drag highlights use the same C placement gate as store validation.
- [x] `dropCard` rolls and stores a C `buff` on valid C placement.
- [x] `effectiveStats` applies the buff only while the linked C card is on board.
- [x] C card face/modal/panel show boost-only information, not HP/ATK/DEF.

**Test plan:** Unit — `slotRules.test.ts`, `combatStats.test.ts`, `gameStore.test.ts`. Render — user-approved C-card graphics and overlay color changes.

---

### P3-S09: Summon reveal and B-card abilities

**Depends on:** P3-S06, P3-S08  **Status:** ✅ done

**Description:** Add a summon showcase for valid drops, then resolve B-card on-play abilities after the showcase. B cards become ability-only cards.

**Acceptance criteria:**
- [x] Valid drops set transient `summon` state.
- [x] Revealing card appears large and centered with a gold ripple.
- [x] When reveal clears, the same card springs to its board slot.
- [x] B abilities resolve after the reveal, not before.
- [x] B1 draws 1, B2 shuffles graveyard into deck, B3 shuffles replenish into deck, B4 draws 2 staggered.
- [x] B cards no longer display combat stats.

**Test plan:** Unit — `gameStore.test.ts` with fake timers; render — user approved "that feels great."

---

### P3-S10: Full Phase 3 regression and close-out

**Depends on:** P3-S01…P3-S09  **Status:** ✅ done

**Description:** Validate Phase 3 behavior and write the missing close-out documentation set.

**Acceptance criteria:**
- [x] Historical Phase 3 commits identified: `2b63640` → `f15d8fc`.
- [x] Source checkpoints reviewed.
- [x] Current suite re-run: 127 Vitest tests passed in 11 files.
- [x] TypeScript re-run: `npx tsc --noEmit` clean.
- [x] Six close-out docs created without modifying `src\`, `CHANGELOG.md`, `.project\STATE.md`, or `.project\architecture-log\current-architecture.md`.

**Test plan:** Documentation review against commits/checkpoints/templates plus the current validation commands.
