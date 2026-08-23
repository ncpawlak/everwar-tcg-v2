# Phase 1 Taskboard — Card-Handling Vertical Slice

**Phase:** Phase 1  
**Scope:** Browser-first tactile Everwar card handling only: deck of 10, opening deal of 5, fanned hand, hover lift, mouse drag, three empty placement slots, gold valid-target outlines, snap/drop/return, premium interruptible motion. No game rules, audio, particle VFX, touch, real card data, opponent, or networking.  
**Stack:** TypeScript · React + Vite · React Three Fiber + drei · Zustand · Vitest · `@react-spring/three` or GSAP behind a local animation adapter.

## Story field legend

- **ID:** Stable Phase 1 story identifier.
- **Phase:** Phase in which the story is added/changed/removed. All stories below are **Phase 1**.
- **Depends on:** Prerequisite stories that must land first.
- **Acceptance criteria:** Testable checklist mapped to Phase 1 FRs.
- **Test plan:** What is unit/regression tested vs. what needs rendered browser verification per Constraint #14.
- **Complexity:** S / M / L.

## Dependency backbone

`P1-S01 → P1-S02 → P1-S03/P1-S04/P1-S05/P1-S06 → P1-S07/P1-S08 → P1-S09 → P1-S10/P1-S11 → P1-S12/P1-S13 → P1-S14 → P1-S15 → P1-S16 → P1-S17 → P1-S18 → P1-S19`

---

### P1-S01: Scaffold browser app and test harness

**Phase:** Phase 1  
**Depends on:** None  
**Complexity:** M  

**Description:** Create the Vite React TypeScript application skeleton with R3F/drei, Zustand, selected animation package, and Vitest configured. Do not implement gameplay behavior beyond a mountable empty scene shell.

**Acceptance criteria:**
- [ ] Vite + React + TypeScript app starts in a browser. (Supports FR1-FR10)
- [ ] R3F Canvas can mount without runtime errors. (Supports FR1, FR10)
- [ ] Vitest runs at least one placeholder/smoke test. (Supports testing standing rule)
- [ ] Source folders match the Phase 1 architecture boundaries. (Supports future mutability)

**Test plan:**
- Unit/regression: Vitest scaffold smoke test and TypeScript compile.
- Rendered verification: Browser opens to an empty/placeholder canvas without errors.

---

### P1-S02: Define Phase 1 domain types and initial state

**Phase:** Phase 1  
**Depends on:** P1-S01  
**Complexity:** S  

**Description:** Add pure domain types and initial authoritative state for 10 placeholder cards, deck order, empty hand, three empty slots, and no active drag.

**Acceptance criteria:**
- [ ] State contains 10 generated card IDs with numbers 1-10. (FR1)
- [ ] `deck` is ordered so the top card is the last drawn element. (FR2, FR4)
- [ ] `hand` starts empty before opening deal logic. (FR2, FR3)
- [ ] `board` has exactly three empty slots. (FR7, FR8)
- [ ] `dragging` starts as `null`. (FR6)

**Test plan:**
- Unit/regression: Initial-state tests for deck size/order, card identity, empty slots, and empty drag.
- Rendered verification: Not required; pure logic story.

---

### P1-S03: Implement draw-order and `drawCard`

**Phase:** Phase 1  
**Depends on:** P1-S02  
**Complexity:** S  

**Description:** TDD the pure draw action that moves one top deck card into the right side of the hand and no-ops when the deck is empty.

**Acceptance criteria:**
- [ ] `drawCard()` removes exactly one top card from `deck`. (FR2, FR4)
- [ ] Drawn cards append to `hand` in deterministic left-to-right order. (FR3, FR4)
- [ ] Ten successful draws exhaust the deck without duplicating cards. (FR1, FR4)
- [ ] Drawing from an empty deck is safe and does not mutate hand/board. (FR4)

**Test plan:**
- Unit/regression: Draw order, no duplicates, deck exhaustion, empty-deck no-op.
- Rendered verification: Not required; pure logic story.

---

### P1-S04: Implement drag state actions

**Phase:** Phase 1  
**Depends on:** P1-S02  
**Complexity:** M  

**Description:** TDD `beginDrag`, `updateDrag`, `hoverSlot`, and `returnToHand` state transitions for hand-origin dragging only.

**Acceptance criteria:**
- [ ] `beginDrag(id)` succeeds only for cards currently in hand. (FR6, FR8)
- [ ] Beginning drag records the active card and origin without removing unrelated state. (FR6)
- [ ] `updateDrag(pointer)` updates projected drag coordinates only when a drag is active. (FR6)
- [ ] `hoverSlot(id|null)` records hovered slot during drag and clears it when needed. (FR7)
- [ ] `returnToHand(id)` clears drag and preserves hand order. (FR9)
- [ ] Board-placed cards cannot begin drag in Phase 1. (FR8)

**Test plan:**
- Unit/regression: Valid/invalid begin-drag, pointer update, hover clear, return preservation, board-card no-pickup.
- Rendered verification: Not required; pure logic story.

---

### P1-S05: Implement board slot occupancy and valid-drop rules

**Phase:** Phase 1  
**Depends on:** P1-S02, P1-S04  
**Complexity:** M  

**Description:** TDD pure rules for empty-slot highlighting, valid drop detection, filled-slot rejection, and board occupancy.

**Acceptance criteria:**
- [ ] Only empty slots are valid drop targets. (FR7, FR8, FR9)
- [ ] Filled slots never highlight as valid targets. (FR7)
- [ ] Dropping on `null` or outside any slot is invalid. (FR9)
- [ ] Dropping on a filled slot is invalid. (FR9)
- [ ] Successful drop occupies exactly one slot with exactly one card. (FR8)

**Test plan:**
- Unit/regression: Empty/filled validity matrix, highlightable slot list, single occupancy, invalid target cases.
- Rendered verification: Not required; pure logic story.

---

### P1-S06: Implement fan, deck-stack, slot, and drag target-pose math

**Phase:** Phase 1  
**Depends on:** P1-S02  
**Complexity:** M  

**Description:** TDD pure layout functions returning renderer-neutral target poses for hand fan, deck stack offsets, board slots, and lifted dragging pose.

**Acceptance criteria:**
- [ ] Hand cards produce a stable fan/arc based on hand order. (FR3)
- [ ] Fan layout smoothly recenters when cards are added/removed. (FR3)
- [ ] Deck stack returns small positional/rotational offsets for physical depth. (FR1)
- [ ] Slot poses align with three board placement spots. (FR7, FR8)
- [ ] Drag pose uses projected pointer position with lifted depth/orientation. (FR6)

**Test plan:**
- Unit/regression: Snapshot/approximate numeric tests for fan symmetry, order, reflow, deck offsets, slot anchors, drag pose.
- Rendered verification: Later visual confirmation in scene stories.

---

### P1-S07: Build angled 3D board scene shell

**Phase:** Phase 1  
**Depends on:** P1-S01, P1-S06  
**Complexity:** M  

**Description:** Add the R3F scene shell with fixed perspective camera tilted down at a playmat, lighting, shadows, deck zone, and three board slot locations.

**Acceptance criteria:**
- [ ] Camera reads as an angled Master-Duel-style board. (FR10)
- [ ] Playmat, deck zone, and three placement spots are visible. (FR1, FR7)
- [ ] Lighting/shadows support premium depth without authored art. (FR10)
- [ ] Scene consumes layout constants/selectors instead of hardcoded component-only positions. (Architecture rule)

**Test plan:**
- Unit/regression: Type/check tests for config exports if practical.
- Rendered verification: Required; browser screenshot/manual review for camera, board readability, and lighting.

---

### P1-S08: Build procedural beveled card prefab

**Phase:** Phase 1  
**Depends on:** P1-S01  
**Complexity:** M  

**Description:** Create the render-only placeholder card component: thin beveled mesh/shape, rounded corners, front number 1-10, distinct back, subtle material response, shadow support.

**Acceptance criteria:**
- [ ] Cards render as 3D objects, not flat DOM-only elements. (FR1, FR10)
- [ ] Front face clearly shows card number 1-10. (FR1)
- [ ] Back face is visually distinct. (FR1, FR2)
- [ ] Mesh has thin physical depth and beveled/rounded impression. (FR10)
- [ ] Component receives data/pose props and does not mutate state. (Architecture rule)

**Test plan:**
- Unit/regression: Component smoke/type test if available.
- Rendered verification: Required; verify front/back readability, depth, shadows, and placeholder quality.

---

### P1-S09: Render physical deck stack

**Phase:** Phase 1  
**Depends on:** P1-S03, P1-S06, P1-S07, P1-S08  
**Complexity:** M  

**Description:** Render the authoritative deck as a stack of card backs with small offsets and a pointer target for future draw clicks.

**Acceptance criteria:**
- [ ] A deck of 10 cards renders stacked at startup. (FR1)
- [ ] Stack depth/offsets make it read as a physical deck. (FR1)
- [ ] Rendering follows `deck` state count/order. (FR1, FR4)
- [ ] Deck pointer target is present but does not bypass state actions. (FR4)

**Test plan:**
- Unit/regression: Selector test maps deck count to deck poses.
- Rendered verification: Required; verify visible 10-card stack impression and click target alignment.

---

### P1-S10: Implement single card pointer pick and drag-plane projection

**Phase:** Phase 1  
**Depends on:** P1-S04, P1-S06, P1-S07, P1-S08  
**Complexity:** L  

**Description:** Wire mouse pointer down/move/up for one hand card using R3F raycasting and projection onto the board drag plane.

**Acceptance criteria:**
- [ ] Click-and-hold on a hand card starts drag. (FR6)
- [ ] Dragged card follows pointer on the board plane. (FR6)
- [ ] Drag pose has lifted orientation/depth. (FR6)
- [ ] Pointer logic calls state actions rather than mutating render state directly. (Architecture rule)
- [ ] Releasing without slot integration safely returns to hand state for now. (FR9)

**Test plan:**
- Unit/regression: Pure drag-plane projection tests and state-action tests.
- Rendered verification: Required; manually verify mouse pickup and follow behavior in browser.

---

### P1-S11: Render slots, hit-test, and gold valid-target highlight

**Phase:** Phase 1  
**Depends on:** P1-S05, P1-S06, P1-S10  
**Complexity:** M  

**Description:** Add slot hit-testing and visual gold outlines for every empty placement spot while a hand card is dragging.

**Acceptance criteria:**
- [ ] Three empty board spots show gold outlines while dragging. (FR7)
- [ ] No slot outlines show when not dragging. (FR7)
- [ ] Filled slots do not show gold outlines. (FR7)
- [ ] Hovered slot is derived through hit-testing, not renderer-local assumptions. (FR7, FR8)

**Test plan:**
- Unit/regression: Slot hit-test boundaries, empty-only highlight selector, filled-slot exclusion.
- Rendered verification: Required; verify gold outlines appear/disappear correctly while dragging.

---

### P1-S12: Implement successful drop snap and placed-card lock

**Phase:** Phase 1  
**Depends on:** P1-S05, P1-S10, P1-S11  
**Complexity:** M  

**Description:** Complete valid drop behavior: releasing over an empty slot removes the card from hand, fills the slot, animates/snap-targets the card into the slot, and prevents re-pickup in Phase 1.

**Acceptance criteria:**
- [ ] Releasing over an empty spot moves the card to that board slot. (FR8)
- [ ] Card snaps into the slot pose and stays there. (FR8)
- [ ] Hand order reflows after the removed card. (FR3, FR8)
- [ ] The filled slot stops highlighting for subsequent drags. (FR7, FR8)
- [ ] Placed cards cannot be picked up again in Phase 1. (FR8)

**Test plan:**
- Unit/regression: Drop success, hand removal, board occupancy, no re-pickup, highlight exclusion.
- Rendered verification: Required; verify snap-in, persistence, and no placed-card dragging.

---

### P1-S13: Implement invalid drop smooth return

**Phase:** Phase 1  
**Depends on:** P1-S05, P1-S10, P1-S11  
**Complexity:** M  

**Description:** Complete invalid drop behavior: releasing outside slots or over filled slots clears drag and visually returns the card to its hand fan position.

**Acceptance criteria:**
- [ ] Release outside any slot returns the card to hand. (FR9)
- [ ] Release over a filled slot returns the card to hand. (FR9)
- [ ] Hand membership/order is unchanged after invalid drop. (FR9)
- [ ] Return animation is smooth and follows the current hand target pose. (FR9, FR10)

**Test plan:**
- Unit/regression: Invalid outside-slot and filled-slot returns; hand order unchanged.
- Rendered verification: Required; verify smooth return path and no visual jump.

---

### P1-S14: Implement single deck-to-hand draw animation

**Phase:** Phase 1  
**Depends on:** P1-S03, P1-S06, P1-S09  
**Complexity:** L  

**Description:** Animate one drawn card from deck top to hand: pop off the deck, travel on an arc, flip/present as needed, then settle into fan pose. State remains authoritative; animation visualizes the draw.

**Acceptance criteria:**
- [ ] One draw moves the correct top card from deck to hand. (FR4)
- [ ] Drawn card visually pops off the deck and travels along an arc. (FR2, FR4, FR10)
- [ ] Card settles into the hand fan target pose. (FR3, FR4)
- [ ] Deck stack visibly decreases by one. (FR4)
- [ ] Animation can be interrupted safely by later drag/reflow work. (FR10)

**Test plan:**
- Unit/regression: Draw action and target-pose transition selectors.
- Rendered verification: Required; verify arc, timing, deck decrement, and final hand placement.

---

### P1-S15: Implement opening staggered auto-deal of five

**Phase:** Phase 1  
**Depends on:** P1-S03, P1-S14  
**Complexity:** L  

**Description:** On Phase 1 scene start, auto-deal exactly five cards in a staggered sequence using the same draw action and animation path as single draws.

**Acceptance criteria:**
- [ ] Startup auto-deals exactly 5 cards. (FR2)
- [ ] Cards deal from the top of the 10-card deck in deterministic order. (FR2)
- [ ] Each card pops off the deck and staggers into the hand. (FR2, FR10)
- [ ] After opening deal, deck has 5 remaining and hand has 5. (FR2, FR4)
- [ ] Auto-deal does not run repeatedly on rerenders. (FR2)

**Test plan:**
- Unit/regression: Deal-sequence scheduler/action tests, final deck/hand counts, idempotent start behavior.
- Rendered verification: Required; verify stagger timing, path, and final 5-card fan.

---

### P1-S16: Implement hand reflow and hover lift

**Phase:** Phase 1  
**Depends on:** P1-S06, P1-S12, P1-S13, P1-S15  
**Complexity:** M  

**Description:** Complete hand presentation: cards fan/reflow smoothly as cards are added/removed, and hovering a hand card lifts/scales it for readability without changing domain zone state.

**Acceptance criteria:**
- [ ] Hand cards remain arranged in a fan/arc. (FR3)
- [ ] Fan reflows smoothly after draw, successful drop, and invalid return. (FR3, FR9)
- [ ] Hovering a hand card lifts/scales it slightly. (FR5)
- [ ] Hover lift applies only to hand cards, not deck or board cards. (FR5, FR8)
- [ ] Hover/drag interactions do not fight each other. (FR5, FR6, FR10)

**Test plan:**
- Unit/regression: Fan layout tests already cover order/reflow; hover selector tests for eligible zones.
- Rendered verification: Required; verify hover lift readability, reflow smoothness, and interaction priority.

---

### P1-S17: Implement click-deck-to-draw remaining cards

**Phase:** Phase 1  
**Depends on:** P1-S14, P1-S15, P1-S16  
**Complexity:** M  

**Description:** After opening deal, clicking the deck draws one remaining card per click until the deck is empty, using the same state action and draw animation.

**Acceptance criteria:**
- [ ] Each deck click after opening deal draws exactly one card. (FR4)
- [ ] Cards draw in remaining deck order with no duplicates. (FR4)
- [ ] Hand fan reflows after each new card. (FR3, FR4)
- [ ] Empty deck click is safe/no-op and does not create visuals. (FR4)
- [ ] Deck click does not trigger while a card drag should own the pointer interaction. (FR4, FR6)

**Test plan:**
- Unit/regression: Remaining draw order, no duplicates, empty-deck no-op, click guard while dragging.
- Rendered verification: Required; manually click through remaining 5 cards and verify deck exhaustion.

---

### P1-S18: Feel, polish, and interruptibility pass

**Phase:** Phase 1  
**Depends on:** P1-S12, P1-S13, P1-S14, P1-S15, P1-S16, P1-S17  
**Complexity:** L  

**Description:** Tune timing, easing, depth, shadows, hover, snap, return, and draw paths to meet the Master-Duel-like feel bar for Phase 1 motion-only juice.

**Acceptance criteria:**
- [ ] Draw, deal, hover, drag, snap, return, and reflow use premium easing. (FR10)
- [ ] Animations are interruptible without broken state or visual teleporting. (FR10)
- [ ] Target browser feels smooth at roughly 60 FPS on a typical desktop. (FR10)
- [ ] No audio or particle VFX are introduced. (Out-of-scope)
- [ ] Motion constants remain centralized and phase-tagged. (Architecture rule)

**Test plan:**
- Unit/regression: Existing action/layout tests remain green; add regression tests for any interruptibility guards.
- Rendered verification: Required; Senior/Reviewer browser pass for feel, frame smoothness, and interruption cases.

---

### P1-S19: Full Phase 1 regression and rendered verification

**Phase:** Phase 1  
**Depends on:** P1-S01, P1-S02, P1-S03, P1-S04, P1-S05, P1-S06, P1-S07, P1-S08, P1-S09, P1-S10, P1-S11, P1-S12, P1-S13, P1-S14, P1-S15, P1-S16, P1-S17, P1-S18  
**Complexity:** M  

**Description:** Run the complete Phase 1 validation pass: unit/regression suite, type/build checks, and rendered browser verification against every FR and acceptance criterion.

**Acceptance criteria:**
- [ ] FR1 deck stack verified.
- [ ] FR2 opening staggered auto-deal verified.
- [ ] FR3 hand fan and reflow verified.
- [ ] FR4 click deck to draw remaining cards verified.
- [ ] FR5 hover lift verified.
- [ ] FR6 click-and-hold drag verified.
- [ ] FR7 empty-slot gold highlight verified.
- [ ] FR8 valid drop snap/stay/no re-pickup verified.
- [ ] FR9 invalid drop smooth return verified.
- [ ] FR10 smooth/interruptible 60-FPS-feeling motion verified.
- [ ] All pure logic regression tests pass, including draw order, valid-drop rules, slot occupancy, and fan-layout math.
- [ ] Phase 1 docs/changelog/client-facing notes are updated with phase tags before handoff.

**Test plan:**
- Unit/regression: Full Vitest suite and TypeScript/build checks.
- Rendered verification: Required; browser manual verification checklist or captured review notes for FR1-FR10.
