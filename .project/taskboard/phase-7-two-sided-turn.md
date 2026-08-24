# Phase 7 Taskboard — Two-Sided Turn + Opponent AI

**Phase:** Phase 7
**Scope:** Promote the opponent to a full second player (deck/hand/A-B-C board/graveyard/replen), run it through the same phase machine, make combat bidirectional, add a simple heuristic AI with a hidden hand, and polish turn ownership / inspection / pacing.
**Stack:** TypeScript · React + Vite · React Three Fiber + drei · Zustand · @react-spring/three · Vitest.
**Landed:** committed `3094c10` → `f396500` (base `19a32c9`) — 139 tests green, `npx tsc --noEmit` clean.

## Story field legend

- **ID:** Stable Phase 7 story identifier.
- **Depends on:** Prerequisite stories that must land first.
- **Acceptance criteria:** Testable checklist mapped to Phase 7 requirements.
- **Test plan:** Unit/regression vs. rendered browser verification.

## Dependency backbone

`P7-S1 → P7-S2 → P7-S3 → P7-S4 → P7-S4b → P7-S5`

---

### P7-S1: Opponent full-player state model

**Depends on:** Phase 6 opponent mirror  **Status:** ✅ done

**Description:** Give the opponent real state that mirrors the player: deck, hand, replen, graveyard, and full A/B/C board. Remove the dummy O1–O3 seeds so the opponent starts empty and summons its own cards.

**Acceptance criteria:**
- [x] `opponentDeck`, `opponentHand`, `opponentReplen`, `opponentGraveyard` exist in state.
- [x] `opponentBoard` (O1–O4), `opponentBBoard` (OB1–OB4), `opponentCBoard` (OC1–OC4) exist.
- [x] Opponent HP folds into the shared `currentHp` sim.
- [x] `createInitialState()` seeds a real opponent deck and no longer seeds O1–O3.
- [x] Typecheck + full suite green.

**Test plan:** Unit — opponent state init/shape tests. Regression — `npx vitest run`.

---

### P7-S2: Turn loop, field highlight, pile/inspection fixes

**Depends on:** P7-S1  **Status:** ✅ done

**Description:** Alternate turns via `runOpponentTurn`, with the player first. Border the active player's field. Fix graveyard/replen pile popups for both sides and end phases auto-advancing.

**Acceptance criteria:**
- [x] Reaching the player's End triggers `runOpponentTurn()`; opponent steps Draw→Main→Battle→Resolution→End on timers, then control returns.
- [x] `turn` increments on the opponent's turn as well as the player's.
- [x] The active player's field is bordered (thin, padded away from stat plates).
- [x] End phase auto-advances to the next player's Draw.
- [x] Both players' graveyard and replen piles open the pile popup.
- [x] Opponent A-cards are inspectable.

**Test plan:** Unit — turn alternation + phase timing with fake timers. Render — user screenshot approval.

---

### P7-S3: Bidirectional combat (opponent as attacker)

**Depends on:** P7-S2  **Status:** ✅ done

**Description:** Generalize combat so the opponent declares attacks against the player's A-cards and applies damage back, reusing `diceRules`/`combatStats`. Destroyed player cards travel to the player graveyard.

**Acceptance criteria:**
- [x] `oppAttackTargets` maps opponent O-slot → player A-slot.
- [x] `declareOpponentAttacks()` selects targets; `beginOpponentResolution()` rolls per attacker and applies damage.
- [x] Lethal damage sends the player A-card to the player graveyard.
- [x] A destroyed A-card carries its linked C-card to the graveyard (fix `2a0a5b1`).

**Test plan:** Unit — opponent resolution/damage/death tests. Render — user-approved combat feel.

---

### P7-S4: Opponent AI — real hand + summoning

**Depends on:** P7-S3  **Status:** ✅ done

**Description:** Add a simple heuristic AI that draws a real hand (hidden/face-down), summons free A-cards, and attacks. A set card reveals via the summon showcase.

**Acceptance criteria:**
- [x] Opponent draws to `HAND_TARGET` (min 1), staggered.
- [x] `opponentPlayStep`/`opponentMainPhase` summon free A-cards from the real hand.
- [x] Opponent hand renders face-down; a set card reveals on the field.
- [x] Battle focus-fires the player's weakest/lowest-HP A-cards.
- [x] Summon fly-in animation (card flies from hand, not a pop).

**Test plan:** Unit — draw rule, play-step, targeting. Render — user-approved summon animation.

---

### P7-S4b: Opponent plays B/C + multiple A, paced

**Depends on:** P7-S4  **Status:** ✅ done

**Description:** Expand the AI to play B and C cards and more than one A per turn (one per type), attach C-buffs to same-turn A summons, and pace plays with a gap so each reads individually. Add A-C-link attack targeting, opponent B/C inspection, and a truthful shrinking deck.

**Acceptance criteria:**
- [x] AI plays A→C→B, one per type per turn; C rolls a buff and attaches to a same-turn A.
- [x] Plays are paced one at a time (`OPP_PLAY_GAP_MS` / `OPP_PLAY_STEP_MS`) inside a dedicated Main window (`OPP_MAIN_DURATION_MS`).
- [x] Attack targeting accepts a click anywhere in the A-C link column.
- [x] Opponent B and C cards are inspectable (`oppCardAtPoint`).
- [x] Opponent deck stack shrinks with `opponentDeck.length` (`OPP_DECK_COUNT` removed).

**Test plan:** Unit — B/C play, paced-timing advances, hit-test targeting/inspection. Render — user-approved pacing.

---

### P7-S5: Docs + tests + commit Phase 7

**Depends on:** P7-S4b  **Status:** ✅ done

**Description:** Close out Phase 7: CHANGELOG 0.8.0, the six-doc close-out set, STATE.md + current-architecture.md refresh, and commit.

**Acceptance criteria:**
- [x] CHANGELOG `[0.8.0]` entry grouped Added/Changed/Fixed/Tests.
- [x] Phase 7 architecture-log decisions (P7-D1…D7), learnings, reviewer-log, taskboard, and client-docs (operator + technical) created.
- [x] STATE.md and current-architecture.md updated to Phase 7.
- [x] Full Vitest suite (139) + `npx tsc --noEmit` green.

**Test plan:** Unit/regression — `npx vitest run` (139 tests, 11 files). Typecheck — `npx tsc --noEmit`.
