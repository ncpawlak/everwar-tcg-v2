# Phase 4 Taskboard — Turn Mechanics

**Phase:** Phase 4  
**Scope:** Single-sided turn loop for Player 1: opening deal into Draw, Main placement, Battle attacker declaration, Resolution dice, End cleanup. No Player 2, no combat damage/win condition, no new card art.  
**Stack:** TypeScript · React + Vite · React Three Fiber + drei · Zustand · @react-spring/three · Vitest.  
**Landed:** commit `7f4063b` — `npx vitest run` green (127 tests, 11 files on current later tree), `npx tsc --noEmit` clean.

## Story field legend

- **ID:** Stable Phase 4 story identifier.
- **Depends on:** Prerequisite stories that must land first.
- **Acceptance criteria:** Testable checklist mapped to Phase 4 rules/UI.
- **Test plan:** Unit/regression vs. rendered browser/user verification.

## Dependency backbone

`P4-S01 → P4-S02 → {P4-S03, P4-S04} → P4-S05 → P4-S06 → P4-S07 → P4-S08`

---

### P4-S01: Turn and phase domain model

**Depends on:** Phase 3 state layer  **Status:** ✅ done

**Description:** Add the core turn state to `src\state\types.ts` and initial state in `src\state\cardData.ts`: `Phase`, `PHASE_ORDER`, `PHASE_LABEL`, `turn`, `phase`, `phaseAnnounce`, `attackers`, `resolutionRolls`, and `lastRolls`. Add `Card.continuous?` and mark two B cards continuous.

**Acceptance criteria:**
- [x] Phase order is Draw → Main → Battle → Resolution → End.
- [x] Initial game state starts at turn 1, phase Draw, with no phase announcement until opening deal triggers the first Draw.
- [x] B3 and B4 are continuous and visibly distinguishable in `CardView`.
- [x] Dice roll state can represent a stored value plus rolling/settled status.

**Test plan:** Unit — `gameStore.test.ts` initial-state and phase-flow coverage; `cardData.test.ts` current suite verifies card data shape.

---

### P4-S02: Draw phase and opening-deal handoff

**Depends on:** P4-S01  **Status:** ✅ done

**Description:** Implement `beginDrawPhase()` and phase-entry Draw behavior in `src\state\gameStore.ts`. Draw fills to `HAND_TARGET = 6` if below target, otherwise draws exactly one. After a dwell, Draw auto-advances to Main. `src\render\OpeningDeal.tsx` triggers Turn 1 Draw after the five-card opening deal completes.

**Acceptance criteria:**
- [x] Opening deal still deals five cards first.
- [x] Turn 1 Draw draws one additional card to reach six.
- [x] Later Draw phases fill to six if below target, otherwise draw one.
- [x] Draw auto-advances to Main without button input.

**Test plan:** Unit — fake-timer Draw tests in `gameStore.test.ts`; rendered verification by user during Phase 4.

---

### P4-S03: Phase HUD and transition banner

**Depends on:** P4-S01, P4-S02  **Status:** ✅ done

**Description:** Add DOM overlays mounted from `src\app\App.tsx`: `src\ui\TurnHud.tsx` shows turn number, phase progression, and a Next Phase / End Turn button; `src\ui\PhaseBanner.tsx` slides the current phase label from right to left over the battlefield.

**Acceptance criteria:**
- [x] HUD is hidden during the opening deal and appears once the first phase begins.
- [x] Current phase is highlighted in white; other phases are greyed.
- [x] Draw and Resolution disable the button because they auto-advance.
- [x] Each phase entry increments `phaseAnnounce` and replays the banner.

**Test plan:** Store tests assert `phaseAnnounce` changes; rendered behavior was user-approved.

---

### P4-S04: Main-phase placement gate and no manual deck draw

**Depends on:** P4-S02, P4-S03  **Status:** ✅ done

**Description:** Restrict `dropCard()` in `src\state\gameStore.ts` so cards can only be set during Main. Remove direct deck-click drawing from `src\input\PointerControls.tsx`; Draw phase and B abilities remain the only draw sources after opening deal.

**Acceptance criteria:**
- [x] Valid card drops succeed in Main.
- [x] Drops outside Main return the card to hand without mutating board state.
- [x] Clicking the deck no longer draws in any phase.
- [x] B-card draw abilities and Draw phase still call the store draw path.

**Test plan:** Unit — `gameStore.test.ts` verifies non-Main drops are blocked. User explicitly verified deck clicking no longer draws.

---

### P4-S05: Battle attacker declaration

**Depends on:** P4-S04  **Status:** ✅ done

**Description:** Add Battle-only attacker toggling. A click on an occupied A slot, or its linked C zone, resolves through `resolveAttackerSlot()` and toggles that A slot in `attackers`. `SlotView` highlights the whole A/C linked column for declared attackers.

**Acceptance criteria:**
- [x] Battle clicks on occupied A-slot cards select/deselect attackers.
- [x] Clicking the linked C zone of an occupied A column selects the same A attacker.
- [x] Empty A columns, B slots, and non-Battle phases do not select attackers.
- [x] Declared attackers show a persistent gold linked-column outline in Battle and Resolution.

**Test plan:** Unit — `slotRules.test.ts` covers attacker-slot resolution; `gameStore.test.ts` covers `toggleAttacker`.

---

### P4-S06: Resolution dice

**Depends on:** P4-S05  **Status:** ✅ done

**Description:** Add Resolution phase as the execution step. `beginResolution()` rolls one D20 per declared attacker after the banner delay, stores values in `lastRolls`, marks dice settled after `DICE_ROLL_MS`, and auto-advances to End after `DICE_HOLD_MS`. `src\render\ResolutionDice.tsx` renders in-scene dice above each attacker's A/C link area.

**Acceptance criteria:**
- [x] Only declared attackers roll.
- [x] Multiple attackers roll simultaneously.
- [x] Roll values are 1–20 and are absorbed into `lastRolls`.
- [x] Dice settle face-forward and display the stored value.
- [x] Resolution with no attackers rolls nothing and still advances to End.

**Test plan:** Unit — fake-timer Resolution tests in `gameStore.test.ts`; rendered dice behavior was user-approved.

---

### P4-S07: End-phase cleanup

**Depends on:** P4-S06  **Status:** ✅ done

**Description:** On entering End, run cleanup immediately: shuffle `replen` into `deck`, send non-continuous B cards on the board to `graveyard`, leave continuous B cards in place, and clear attacker/dice transient state.

**Acceptance criteria:**
- [x] Replen pile folds back into deck on End.
- [x] Non-continuous B cards leave the board and enter graveyard on End.
- [x] Continuous B cards stay on board.
- [x] `attackers` and `resolutionRolls` clear when entering End; `lastRolls` persists.

**Test plan:** Unit — End-phase tests in `gameStore.test.ts` cover B cleanup and replen shuffle.

---

### P4-S08: Phase 4 regression and close-out

**Depends on:** P4-S01 through P4-S07  **Status:** ✅ done

**Description:** Run full validation and produce the retroactive Phase 4 documentation set.

**Acceptance criteria:**
- [x] `npx vitest run` green — observed 127 tests across 11 files on the current tree.
- [x] `npx tsc --noEmit` green.
- [x] Documentation records checkpoint-vs-code discrepancies for Phase 4.
- [x] No files under `src\` changed during documentation close-out.

**Test plan:** Full Vitest suite and TypeScript no-emit typecheck.
