# Reviewer Log — Everwar Phase 4

## 2026-08-23 · R-004 · Manual deck click bypassed Draw phase

**Phase:** Phase 4  
**Severity:** Medium (rules bypass — player could draw outside Draw phase)  
**Found by:** User functional review after the initial turn-HUD slice.  
**Symptom:** Clicking the deck still drew a card during any phase, even though Phase 4 made Draw phase responsible for card intake.

**Fix applied:** Removed the deck-click `drawCard()` branch from `src\input\PointerControls.tsx`. `drawCard()` remains in `src\state\gameStore.ts` for opening deal, Draw phase, and B-card abilities.

**Verified:** User approved the no-manual-draw behavior before the Phase 4 commit.

**Guardrail / learning candidate:** When a rules layer supersedes a prototype affordance, audit every direct input path for bypasses.

---

## 2026-08-23 · R-005 · Battle roll model needed a separate Resolution phase

**Phase:** Phase 4  
**Severity:** Medium (wrong interaction model for combat flow)  
**Found by:** User design review during Battle-phase work.  
**Symptom:** The first implemented concept rolled a D20 immediately from a Battle-phase A-card click. The desired game flow was instead: Battle declares attackers, Resolution rolls only the selected attackers, then End runs cleanup.

**Fix applied:** Replaced immediate battle-roll behavior with:
- `attackers` state and `toggleAttacker()` in `src\state\gameStore.ts`;
- `resolveAttackerSlot()` in `src\board\slotRules.ts`;
- Battle click handling in `src\input\PointerControls.tsx`;
- linked-column attack highlights in `src\render\SlotView.tsx`;
- Resolution auto-roll logic in `beginResolution()`.

**Verified:** The final Phase 4 tests cover attacker toggling, Resolution dice creation, roll value absorption, and auto-advance to End.

**Guardrail / learning candidate:** Combat features should model declaration and resolution as separate states even before full damage rules exist.

---

## 2026-08-23 · R-006 · D20 settle pose could stop between faces

**Phase:** Phase 4  
**Severity:** Low/Medium (visual fidelity issue — result felt unpolished)  
**Found by:** User visual review of the dice animation.  
**Symptom:** The D20 sometimes stopped visually between two faces, making the final roll feel imprecise.

**Fix applied:** `src\render\ResolutionDice.tsx` computes the icosahedron face normal most aligned with the camera when the die settles, then slerps the mesh quaternion so a solid face points toward the viewer. The visible number remains a Billboard locked to the stored roll value.

**Verified:** User approved the shortened, face-forward dice behavior before the Phase 4 commit.

**Guardrail / learning candidate:** Dice/card animations with a discrete result need an authored settle pose, not only random motion plus a timer.
