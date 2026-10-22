# Reviewer Log — Everwar Phase 5

## 2026-08-23 · R-005 · Dice combat, HP damage, and opponent targeting

**Phase:** Phase 5  
**Commit:** `6385a1b` — `Phase 5: dice combat, HP/damage, and opponent targeting`  
**Severity:** Mixed; all resolved before close-out  
**Found by:** User visual review + coder test/typecheck pass  

---

## Issue 1 — Dice started before the Resolution banner cleared

**Symptom:** Resolution dice competed visually with the phase banner.

**Root cause:** The Phase 4 dice flow began immediately on entering Resolution.

**Fix (verified):** Added `RESOLUTION_ROLL_DELAY_MS` in `src\state\gameStore.ts` and delayed the dice spawn inside `beginResolution`. Tests advance fake timers through the banner delay before asserting dice exist.

**Resolution status:** RESOLVED — user approved the timing.

---

## Issue 2 — Outcome/damage text around the die was crowded

**Symptom:** Damage text appeared in the same visual area as the die result, collided with the HP/DMG/ACC plate, and made GLANCING/CRITICAL hard to distinguish.

**Root cause:** The first UI path used `ResolutionDice` as the only result surface.

**Fix (verified):** Removed damage banners from `ResolutionDice`; created `OutcomePopups` for source-side result words and `DamagePopups` for target-side red damage. GLANCING uses cyan and CRITICAL uses gold.

**Resolution status:** RESOLVED — user approved the final size/color/placement.

---

## Issue 3 — End phase began before combat feedback finished

**Symptom:** The End-phase animation/banner could start while dice, popups, or destruction travel were still active.

**Root cause:** Resolution advanced too early after rolls settled.

**Fix (verified):** `beginResolution` now stays in Resolution through `DICE_HOLD_MS`, `OUTCOME_POPUP_MS`, and (when destruction occurs) `GRAVEYARD_TRAVEL_MS` before calling `goToPhase('end')`.

**Resolution status:** RESOLVED — tests cover the held Resolution phase and user confirmed the visual sequencing.

---

## Issue 4 — Early HP simulation damaged the attacker, not a target

**Symptom:** Before opponent targeting existed, damage reduced the attacking A-card's own HP and lethal self-damage sent the A card plus linked C card to the graveyard.

**Root cause:** There was no opponent board yet, so the first HP/death slice used self-damage as a temporary simulation path.

**Fix (verified):** Added `opponentCards`, `opponentBoard`, `attackTargets`, `targeting`, and opponent hit-testing. Final Resolution aggregates damage onto targeted opponent slots; lethal opponents are slashed and removed from `opponentBoard`.

**Resolution status:** RESOLVED in final Phase 5 commit. Note: the checkpoint history still describes the temporary self-damage/death-to-graveyard model.

---

## Issue 5 — Attack declaration needed clearer target intent

**Symptom:** A simple selected-attacker outline did not communicate which opponent would receive damage.

**Root cause:** The Phase 4 attacker model was just a list of selected A-slots.

**Fix (verified):** Replaced it with `attackTargets: Partial<Record<SlotId, OppSlotId>>`, `targeting`, and `aimPoint`. `TargetingArrows` draws faint gold arrows, `OpponentBoard` outlines valid targets while aiming, and `PointerControls` routes Battle clicks through `aimAttack`/`assignTarget`/`cancelTargeting`.

**Resolution status:** RESOLVED — included in `6385a1b`.

---

## Final validation

- `npx vitest run` — 127 tests passed in the current tree (includes uncommitted Phase 6 work).
- `npx tsc --noEmit` — passed.

