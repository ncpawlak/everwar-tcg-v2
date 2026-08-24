# Learnings — Everwar Phase 7: Two-Sided Turn + Opponent AI

**Date:** 2026-08-23
**Cycle:** Phase 7 — real opponent turn, bidirectional combat, heuristic AI, pacing/inspection polish
**Commits:** `3094c10` → `f396500` (base `19a32c9`)
**Version bump:** 0.7.0 → 0.8.0 (MINOR — significant new product slice)

---

## What Shipped 🎉

Phase 7 turned the mirrored-but-passive opponent into a real second player. The opponent now has its own deck, hand, replen, graveyard, and full A/B/C board, and it takes a genuine turn: after the player ends, `runOpponentTurn()` steps the opponent through Draw → Main → Battle → Resolution → End on timers, then hands control back as the next turn. The player always goes first.

Combat became bidirectional. The opponent declares attacks against the player's A-cards and rolls damage back through the same pure `diceRules` / `combatStats` modules the player uses; destroyed player cards (and their linked C-cards) travel to the player graveyard.

A simple heuristic AI drives the Main phase: it greedily plays one card per type (A → C → B), re-reading state each play so a C-buff can attach to an A summoned earlier the same turn, then focus-fires the player's weakest A-cards at Battle. The opponent hand stays face-down; a set card reveals via the summon showcase and flies in from the hand. Plays are paced one at a time with a real gap so each summon reads individually.

Polish landed alongside: the active player's field is bordered (thin, padded off the stat plates), both players' graveyard/replen piles open the pile popup, opponent A/B/C cards are inspectable, attacks can be declared anywhere in the A-C link column, the opponent deck shrinks truthfully as it draws, and the opponent draws its full hand (not one card). 139 Vitest tests are green and `npx tsc --noEmit` is clean.

---

## What Worked Well

### 1. One rules engine, two players

Promoting the opponent to a full player slice (P7-D1) meant its summons, buffs, deaths, and pile folds all flowed through the existing pure modules (`slotRules`, `diceRules`, `combatStats`) unchanged. Bidirectional combat added new *target state* (`oppAttackTargets`), not new combat *math*.

### 2. Phase entry as the single turn-handoff trigger

Control transfers exactly when the player reaches End (`runOpponentTurn()` is called from the phase transition). There is no scattered web of callbacks; the turn is a deterministic, fake-timer-testable timeline.

### 3. `oppActive()` guard on every timed step

Each scheduled opponent transition re-checks `activePlayer === 'opponent'` before firing. That one cheap guard makes the whole timed turn safe against resets and re-entrancy without any cancellation bookkeeping.

### 4. Re-reading state per play for same-turn dependencies

`opponentPlayStep` re-reads `get()` on each call, so a C-card summoned after an A can see and attach to it. This avoided building a staged "plan the whole turn up front" AI just to get C-on-A ordering right.

### 5. Splitting "attack this column" from "inspect this card"

Two hit-tests — `oppSlotAtPoint` (column → O-slot for targeting) and `oppCardAtPoint` (specific card across O/OB/OC for inspection) — kept both interactions correct instead of overloading one resolver.

---

## Pitfalls Hit and How They Were Resolved

### Pitfall 1: A turn indicator that framed the whole screen

**What happened:** The first turn-ownership cue bordered the entire viewport. The user wanted a per-field border lit for the active side.

**How it was resolved:** Replaced the full-screen frame with a per-side field border keyed to `activePlayer`, then thinned and padded it so it clears the on-card DMG/ACC plates.

**Lesson:** Turn ownership on a two-sided board is spatial — border the active *field*, and respect the stat-plate keep-out zone.

---

### Pitfall 2: The linked C-card didn't die with the player's A-card

**What happened:** When the opponent destroyed a player A-card, the linked C stayed on the board. The player-side destruction path already carried the C; the new opponent-as-attacker path didn't.

**How it was resolved:** The opponent lethal-damage path now sends the A-card and its linked C to the player graveyard (fix `2a0a5b1`).

**Lesson:** Symmetric mechanics need the invariant enforced on BOTH directions. Adding a mirror-direction actor is a prompt to audit every "and its linked card" rule.

---

### Pitfall 3: Half-real opponent state lied to the UI

**What happened:** The opponent deck used a cosmetic `OPP_DECK_COUNT` and the hand was visual-only, so the deck didn't shrink and piles couldn't be inspected.

**How it was resolved:** Promoted deck/hand/piles to real state (P7-D1/P7-D7), drove the deck stack from `opponentDeck.length`, and wired `opponentGraveyard`/`opponentReplen` into the pile browser.

**Lesson:** Once the AI touches a pile, make it real state in the same slice. A cosmetic count is a bug waiting to be noticed.

---

### Pitfall 4: Back-to-back AI plays felt robotic

**What happened:** The opponent set every card in immediate succession, so individual summons/abilities didn't read.

**How it was resolved:** Added an explicit inter-play gap (`OPP_PLAY_GAP_MS`), chained plays at `OPP_PLAY_STEP_MS`, and gave Main its own longer window (`OPP_MAIN_DURATION_MS`) while keeping Draw/Battle snappy.

**Lesson:** Sequenced AI actions need an explicit gap between actions, not just each action's own animation length, to feel deliberate.

---

### Pitfall 5: The opponent only drew one card

**What happened:** `runOpponentTurn` drew a single card at Draw instead of following the player's refill-to-target rule.

**How it was resolved:** `drawOpponentCards()` refills the opponent hand toward `HAND_TARGET` (min 1), staggered, matching the player rule.

**Lesson:** Give the opponent the same rule helper the player uses; don't re-implement a weaker one-off.

---

## Taskboard Analysis

### Stories Delivered

Phase 7 delivered the opponent full-player state model (S1), the turn loop + field highlight + pile/inspection fixes (S2), bidirectional combat (S3), the heuristic AI with a hidden hand + reveal-on-set (S4), the B/C + multi-A paced expansion with A-C-link targeting, B/C inspection, and a truthful deck (S4b), and this close-out (S5).

### What Changed Mid-Cycle

Slice 4 grew into 4b once the basic AI worked: the user asked for B/C plays, multiple A-cards, the full draw rule, click-anywhere-in-the-link targeting, opponent B/C inspection, a shrinking deck, and — last — deliberate pacing between plays. The turn-highlight and pile-inspection work was interleaved as the user reviewed screenshots.

### Recommendations for the Planner (Phase 8)

1. **Win/loss conditions** are the obvious next gap — the loop currently alternates indefinitely with no end state.
2. **Opponent tribute/Commander** was deferred (free summons only); wire the opponent through the existing tribute gate when depth is wanted.
3. **Fire opponent B-card abilities** — B cards are placed but their on-play effects don't yet resolve for the AI.
4. **Consider a dynamic Main window** — the fixed `OPP_MAIN_DURATION_MS` wastes time when the opponent plays fewer than three cards.
5. **AI depth** — the greedy one-per-type heuristic has no lookahead; a light scoring pass could improve target/summon choice.

---

## Skill / Learning Candidates

| # | Proposed Name | Universal vs. Project-Specific | Rationale |
|---|---|---|---|
| 1 | `one-engine-two-actors` | **Universal** | Add a second actor by giving it a parallel state slice and running it through the SAME pure rules, not a forked copy. |
| 2 | `phase-entry-as-handoff` | **Universal** | Trigger control transfer from a single phase-entry check, not scattered callbacks; guard timed steps with an "is it still my turn" re-check. |
| 3 | `explicit-gap-between-sequenced-actions` | **Universal** | Sequenced/AI actions need an inter-action gap constant, separate from each action's animation length, to feel deliberate. |
| 4 | `real-state-not-cosmetic-count` | **Universal** | Once logic touches a pile/resource, promote it to real state in the same slice; cosmetic counts drift and lie. |
| 5 | `separate-hittests-per-intent` | **Project-specific** | "Target this column" and "inspect this exact card" are different questions — resolve them with different hit-tests. |
| 6 | `audit-invariants-when-adding-a-mirror-actor` | **Universal** | Introducing a mirror-direction actor is a prompt to re-check every "and its linked X" rule on the new direction. |
