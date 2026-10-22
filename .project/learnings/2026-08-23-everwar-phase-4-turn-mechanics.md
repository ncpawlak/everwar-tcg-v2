# Learnings — Everwar Phase 4: Turn Mechanics

**Date:** 2026-08-23  
**Cycle:** Phase 4 — turn engine, battle declaration, Resolution dice  
**Commit:** `7f4063b`  
**Version bump:** Not recorded in `package.json` / `CHANGELOG.md` at this commit; Phase 4 documentation was written retroactively.

---

## What Shipped 🎉

Phase 4 turned Everwar from a free-play board sandbox into a single-sided turn loop:

`Draw → Main → Battle → Resolution → End → next turn Draw`

The opening deal still deals five cards, then Turn 1's Draw phase draws the sixth card and auto-advances to Main. Main is the only phase that allows setting cards. Battle lets the player toggle occupied A-slot cards as attackers; Resolution rolls one D20 per selected attacker simultaneously over that attacker's A/C column, stores the rolled values in the engine, and auto-advances to End. End immediately shuffles the replen pile into the deck and discards non-continuous B cards, while B3 and B4 remain because they are now marked continuous.

The phase system also added a bottom `TurnHud`, a right-to-left `PhaseBanner`, linked A/C drag targeting and highlights, disabled manual deck-click drawing, and an in-scene `ResolutionDice` renderer.

Validation on the current tree: `npx vitest run` green (127 tests, 11 files) and `npx tsc --noEmit` green. This count includes later uncommitted Phase 6 work, not just Phase 4.

---

## What Worked Well

### 1. A phase-entry helper kept timing logic coherent

`src\state\gameStore.ts` uses an internal `goToPhase()` helper so every transition increments `phaseAnnounce`, updates `phase`, and runs the phase's entry effects from one place. Draw schedules its own auto-advance after `DRAW_PHASE_DWELL_MS + draw-count stagger`; Resolution schedules dice start, settle, and End transition; End runs cleanup. This avoided a common bug where the HUD says one phase while state effects belong to another.

### 2. Declaration and resolution were split cleanly

Battle stores intent in `attackers`; Resolution consumes it into `resolutionRolls` and `lastRolls`. That made the user's mid-cycle refinement easy: the old "click A to roll immediately" idea could be replaced by "click A to declare, then roll selected attackers in Resolution" without changing card data or board occupancy.

### 3. Linked-zone helpers prevented pointer/render drift

`resolveLinkedTarget`, `resolveAttackerSlot`, and `slotHighlighted` in `src\board\slotRules.ts` centralize A/C column behavior. Pointer hover, pointer click, and slot highlight all use the same concept: an A/C column is a linked interaction surface, but the actual game target remains the card's own-type slot or the occupied A slot.

### 4. Dice outcomes were made state-first

`beginResolution()` chooses D20 values and writes them to `lastRolls` when the roll begins. `src\render\ResolutionDice.tsx` only visualizes `resolutionRolls`. This is the right seam: future combat math can use stored roll values even if the dice art, timing, or camera-facing settle animation changes.

---

## Pitfalls Hit and How They Were Resolved

### Pitfall 1: Phase mechanics invalidated an old affordance

**What happened:** Phase 1's deck-click draw remained possible after turn phases were added. That bypassed Draw-phase cadence and let the user draw during any phase.

**How it was resolved:** `src\input\PointerControls.tsx` removed the deck-click `drawCard()` branch. Drawing remains available to the engine through opening deal, Draw phase, and B abilities.

**Lesson:** When a prototype affordance becomes a rules bypass, remove it from input first; keep the underlying action if game rules still need it.

---

### Pitfall 2: Battle click-to-roll was too eager for the final model

**What happened:** The first battle implementation treated clicking an A card as the roll itself. The user clarified that Battle should declare attackers and a separate Resolution phase should roll the selected attackers.

**How it was resolved:** The final commit stores `attackers` during Battle and moves dice creation into `beginResolution()` in `src\state\gameStore.ts`. `src\render\SlotView.tsx` shows the pending declaration with a gold linked-column outline.

**Lesson:** For combat systems, separate "declare intent" from "resolve outcome" early. It creates a durable seam for interrupts, reactions, targeting, damage assignment, and logs.

---

### Pitfall 3: Dice settle needed geometric correction, not just shorter timing

**What happened:** Shortening the D20 animation made the end state more noticeable, and the die could appear stopped between faces.

**How it was resolved:** `src\render\ResolutionDice.tsx` computes the visible icosahedron face normal nearest the camera on settle and slerps the die so that face is flat-on. The display number is a Billboard and locks to the stored value.

**Lesson:** For 3D affordances with discrete "result" states, visual final orientation matters as much as the random value. Plan a settle pose, not just a tumble duration.

---

## Taskboard Analysis

### Stories Delivered

Phase 4 delivered the state-machine slice, UI overlays, input gating, battle declaration, Resolution dice, and End cleanup as one coherent commit. The dependency chain was correct: types/state first, then phase entry effects, then input/UI, then dice rendering/tests.

### What Changed Mid-Cycle

The battle roll concept changed materially. The user first asked for a Battle-phase D20 click, then introduced Resolution as the proper execution phase. The final code reflects the later model, but the checkpoint history still contains references to the deleted intermediate `DiceOverlay` approach.

### Checkpoint-vs-Code Discrepancies

- `009-resolution-phase-with-attack-d.md` says Phase 4 was still uncommitted and unverified; the final source of truth is commit `7f4063b`, and this close-out re-verified the current tree.
- The same checkpoint mentions the deleted intermediate `DiceOverlay` / `rollDice` path. The committed Phase 4 code uses `src\render\ResolutionDice.tsx`, `resolutionRolls`, `lastRolls`, and `beginResolution()` instead.
- The checkpoint's important-files note lists `DIE_RADIUS=0.42`; the committed `ResolutionDice` constant is `DIE_RADIUS = 0.34`.
- The checkpoint paraphrases `SlotView` attack highlighting as `attackers.includes(slotId)`; the committed code highlights either A or C zone by checking `attackers.includes(\`A${slotId[1]}\`)`.

### Recommendations for the Planner (Phase 5+)

1. **Write combat stories as declaration → resolution → cleanup.** Even if a phase is simple now, naming the seam prevents immediate-roll rewrites.
2. **Treat old prototype input as suspect once rules arrive.** Deck-click draw survived until the user noticed it. Future phase gates should include an audit of all direct input actions.
3. **Centralize UI timing constants.** `RESOLUTION_ROLL_DELAY_MS` matches `PhaseBanner`'s local `ANIM_MS`; future work should move shared phase animation timing into a common config.
4. **Define roll lifetime semantics.** `lastRolls` currently persists after End as absorbed engine state. Before damage or history UI ships, decide whether rolls are per-resolution, per-turn, or permanent combat log entries.

---

## Skill / Learning Candidates (for Orchestrator classification)

| # | Proposed Name | Universal vs. Project-Specific | Rationale |
|---|---|---|---|
| 1 | `phase-entry-effects-in-store` | **Universal** | Put stateful phase transitions and their entry effects behind one store/state-machine helper so UI, timers, and rules cannot diverge. |
| 2 | `declare-then-resolve-combat` | **Universal** | Store battle intent separately from outcome generation; it supports previews, reactions, and deterministic resolution. |
| 3 | `state-first-random-animation` | **Universal** | Generate random outcomes in authoritative state and let animation reveal them, never derive rules from visual components. |
| 4 | `audit-prototype-input-on-rules` | **Universal** | When a formal rules phase is introduced, re-check every old direct-manipulation input for bypasses. |
