# Learnings — Everwar Phase 5: Dice Combat

**Date:** 2026-08-23  
**Cycle:** Phase 5 — dice combat, HP/damage, and opponent targeting  
**Commit:** `6385a1b`  
**Validation:** `npx vitest run` green (127 tests, 11 files, current tree includes uncommitted Phase 6 work) · `npx tsc --noEmit` clean

---

## What Shipped 🎉

Phase 5 turned the Phase 4 Resolution spectacle into a real combat loop. A-cards now use
`HP`, `DMG`, and `ACC`; Resolution rolls a D20 per declared attacker; rolls classify as
MISS, HIT, GLANCING, or CRITICAL; damage is applied to targeted opponent Vanguard cards;
HP bars animate down through green/yellow/red thresholds; lethal opponents receive a red
slash effect and leave the far row before End begins.

The player can now declare attacks in Battle by clicking one of their A-card columns,
then clicking an occupied opponent A-card. Faint gold arrows show committed targets, and
multiple attackers can stack onto the same opponent. The dice still roll over the player's
attacking cards; the outcome word appears over the source, while red damage and HP drain
appear over the target.

---

## What Worked Well

### 1. Pure dice rules were easy to validate and evolve

Putting `accThreshold`, `classifyRoll`, and `resolveRoll` in `src\state\diceRules.ts`
kept combat math independent from timers and rendering. The user clarified that crit/half
modifies DMG, not ACC; the pure module made that rule precise and testable immediately.
`diceRules.test.ts` now locks glancing lows, normal hits, misses, natural 19–20 crits,
the high-ACC exact-threshold crit, and the damage multipliers.

### 2. `combatStats` remained the right seam for C-card buffs

The stat migration from `atk/def` to `dmg/acc` did not require a new buff system.
`src\state\combatStats.ts` already calculated effective values from an A card and its
linked C-card boost, so Resolution could call `effectiveStats` and feed the result into
`resolveRoll`. The same data drives `StatOverlay`, which prevents UI/combat drift.

### 3. Timed Resolution state made visual sequencing controllable

The final sequence is store-led: banner delay, dice roll, settle, outcome/damage dwell,
destruction clear, then End. Earlier iterations collided with the End banner or removed
cards while the phase transition was already happening. Centralizing the sequence in
`gameStore.beginResolution` made the user-requested timing fixes small and testable.

### 4. Source→target mapping simplified combat targeting

Replacing a plain attacker list with `attackTargets: source A-slot → opponent slot` made
the final Battle model straightforward. Resolution's attacker set is simply the record's
keys, and multiple sources can point at one target without any special data structure.
Damage aggregation per `OppSlotId` falls naturally out of that shape.

### 5. Opponent state stayed intentionally isolated

The opponent row uses `opponentCards`/`opponentBoard`, not the player's `cardsById`/`board`.
That prevented a simulation-only target row from leaking into deck draw, pile search, card
poses, or player graveyard behavior. It also documents the future work: a real Player 2
system should generalize this boundary, not silently merge it into Player 1 state.

---

## Pitfalls Hit and How They Were Resolved

### Pitfall 1: The dice result UI tried to do too much in one place

**What happened:** An early iteration displayed both outcome and damage around the die,
which cluttered the area and overlapped the HP/DMG/ACC plate.

**How it was resolved:** The result was split by meaning:
- `ResolutionDice` shows only the die and value.
- `OutcomePopups` shows the source-side word (MISS/HIT/GLANCING/CRITICAL).
- `DamagePopups` shows red incoming damage over the opponent target.

**Lesson:** Combat feedback should be placed at the semantic owner: source result near the
attacker, incoming damage near the defender.

---

### Pitfall 2: End phase timing collided with combat feedback

**What happened:** End began while dice, popups, or destruction movement were still visible.
The user called out the collision directly.

**How it was resolved:** Resolution now stays active through `OUTCOME_POPUP_MS`, clears the
combat visuals, then waits `GRAVEYARD_TRAVEL_MS` when a destruction occurred before calling
`goToPhase('end')`.

**Lesson:** Animation-heavy state transitions need an explicit ownership phase. Do not let
the next game phase start until the previous phase's important visual confirmation has ended.

---

### Pitfall 3: The first HP/damage simulation targeted the player's own A-card

**What happened:** Before opponent cards existed, damage was simulated by applying each
attacker's rolled damage back to itself. That was useful for testing HP bars and death, but
it was not the final combat model.

**How it was resolved:** The final Phase 5 commit adds a seeded opponent Vanguard row and
routes damage through `attackTargets`. Opponent HP drains; lethal opponent cards slash and
vanish. The old self-damage idea is only reflected in checkpoints, not the final target-flow.

**Lesson:** When a placeholder simulation is expected to be superseded, call it out in the
checkpoint and close-out docs so future readers do not mistake it for intended rules.

---

### Pitfall 4: Targeting needed both click state and live pointer state

**What happened:** A committed arrow is easy once a target exists, but the "select target"
mode also needed visible feedback before the target click.

**How it was resolved:** The store tracks `targeting` plus `aimPoint`. `PointerControls`
updates `aimPoint` while aiming, and `TargetingArrows` renders both committed arrows and a
temporary rubber-band arrow.

**Lesson:** Multi-click gestures should model both durable decisions and transient intent.

---

## Taskboard Analysis

### Stories Delivered

Phase 5 delivered the combat stat migration, pure dice rules, Resolution integration,
outcome/damage feedback, animated HP bars, destruction FX, double-click auto-place, and
opponent targeting. The work landed as one commit (`6385a1b`) after several interactive
visual-adjustment loops.

### What Changed Mid-Cycle

The scope evolved from "dice value feeds rules" to "damage a visible target." In between,
the code briefly supported self-damage and death-to-graveyard for player A/C columns. The
final commit changed the active combat target to opponent cards and changed lethal target
cleanup to slash-and-vanish because there is no opponent graveyard yet.

### Recommendations for the Planner (Phase 6+)

1. **Separate rule math, target model, and feedback stories.** They are independent seams and
   easier to review when each has its own acceptance criteria.
2. **Name placeholder simulations explicitly.** "Self-damage until opponent row exists" should
   be marked temporary in the story text.
3. **Plan visual timing as first-class AC.** Include banner delay, dice dwell, popup dwell, and
   destruction completion before phase transition.
4. **Decide opponent lifecycle before adding real Player 2.** Current opponent cards vanish;
   a real opponent graveyard will require state and UI.
5. **Review balance now that HP is live.** Player DMG and opponent HP were tuned so stacking
   attackers matters, but C-card ACC/DMG buffs can still swing outcomes sharply.

---

## Skill / Learning Candidates (for Orchestrator classification)

| # | Proposed Name | Universal vs. Project-Specific | Rationale |
|---|---|---|---|
| 1 | `pure-rules-rendered-feedback` | **Universal** | Keep combat/result math in pure functions and make render components display stored results only. |
| 2 | `phase-owned-animation-dwell` | **Universal** | Let a gameplay phase own all important feedback timing before advancing to the next phase. |
| 3 | `source-target-map-attacks` | **Universal** | Model declarations as source→target mappings instead of parallel attacker/target lists. |
| 4 | `simulation-state-isolation` | **Project-specific** | Keep temporary opponent simulation data separate from Player 1 deck/board machinery until full multiplayer state is designed. |

