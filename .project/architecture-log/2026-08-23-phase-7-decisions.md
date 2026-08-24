# Decision Record — Phase 7 · 2026-08-23

**Author:** Senior Coder (end-of-Phase-7 architectural close-out)
**Phase:** Phase 7 — real opponent turn, two-sided combat, heuristic AI (committed `3094c10` → `f396500`, base `19a32c9`)
**Build health:** `npx tsc --noEmit` green · `npx vitest run` green (139 tests, 11 files)
**Scope:** the architecturally significant Phase-7 decisions only. Phases 1–3 used the plain D-series; phases 4–7 are phase-prefixed. Phase 7 decisions are `P7-D1 … P7-D7` below.

---

## P7-D1 — The opponent is promoted to a full second player with its own parallel state

### Status
**ADOPTED.** The opponent now owns a complete player-shaped state slice and is driven through the same phase machine and the same pure rules modules as the player.

### Context / problem
Through Phase 6 the "opponent" was a passive Vanguard row: a few dummy A-cards seeded into `opponentBoard` (O1–O4) with no deck, no hand, no B/C zones, and no turn. Phase 7's goal was a real two-sided loop where the opponent draws, summons A/B/C, and attacks. A half-real opponent (visual-only hand, fake deck count) could not support that.

### Decision
Give the opponent a real, serializable state slice that mirrors the player's, in `src\state\types.ts`:

- `opponentDeck: CardId[]`, `opponentHand: CardId[]`, `opponentReplen: CardId[]`, `opponentGraveyard: CardId[]`.
- `opponentBoard: Record<OppSlotId, CardId|null>` (A: O1–O4) plus new `opponentBBoard: Record<OppBSlotId,…>` (OB1–OB4) and `opponentCBoard: Record<OppCSlotId,…>` (OC1–OC4).
- Opponent card HP folds into the shared `currentHp` sim; opponent cards live in `opponentCards`/`cardsById`.

`createInitialState()` seeds a real opponent deck from the shared library and **removes the old O1–O3 dummy seeds** — the opponent now starts with an empty field and summons its own cards. The opponent runs the same `Draw→Main→Battle→Resolution→End` machine and reuses `slotRules`, `diceRules`, and `combatStats` unchanged.

### Why this design
- **One rules engine, two players.** No forked combat/placement logic; the opponent obeys the same pure functions the player does.
- **State→selector→spring spine is preserved.** Opponent movement is just state membership changing; poses follow.
- **No half-real state.** Deck size, hand size, and pile contents are authoritative, so visuals (deck shrink, pile search) read real data instead of cosmetic constants.

### Consequences / tradeoffs
- (+) The opponent's summons, buffs, deaths, and pile folds all "just work" through existing rules.
- (+) `OPP_DECK_COUNT` and the visual-only opening hand are gone; the opponent deck stack and hand backs are driven by `opponentDeck.length`.
- (−) `GameState` roughly doubled in size; more fields to keep in sync in `createInitialState()` and `reset()`.
- (−) The board is now three opponent record maps (A/B/C) rather than one; hit-testing and pose selection had to learn all three.

### Guardrails
- Do not re-introduce visual-only opponent state; promote anything the AI touches to real store fields.
- Keep the opponent on the shared pure rules modules — never fork `diceRules`/`combatStats`/`slotRules` "just for the AI."

---

## P7-D2 — Turn alternation is a timed `runOpponentTurn` driver; the player always goes first

### Status
**ADOPTED.** After the player's End phase, `runOpponentTurn()` auto-runs the opponent's full turn on timers, then hands control back as the next turn.

### Context / problem
The player's loop ended at End and folded replen. Phase 7 needed the opponent to take its own turn automatically — stepping through the phases with banners and animations, not instantly — and then return control to the player as a fresh turn.

### Decision
`src\state\gameStore.ts` adds `runOpponentTurn()`, entered when the player reaches End (`if (phase === 'end' && activePlayer === 'player') runOpponentTurn()`). It bumps `turn`, flips `activePlayer` to `'opponent'`, and schedules the phases on timers:

- Draw at 0 (`drawOpponentCards()`), Main at `OPP_PHASE_STEP_MS`, Battle at `OPP_PHASE_STEP_MS + OPP_MAIN_DURATION_MS`, Resolution at `OPP_PHASE_STEP_MS * 2 + OPP_MAIN_DURATION_MS`.
- Every timed step is guarded by `oppActive()` (`activePlayer === 'opponent'`) so a reset or a re-entrant call cannot fire stale transitions.
- Resolution runs the real bidirectional combat engine and hands control back to the player when it finishes.

The player always moves first; on turn 1 the player simply has no attack targets (empty enemy field), which is expected.

### Why this design
- **Phase entry is the single trigger.** Control transfer is a property of reaching End, not a scattered set of callbacks.
- **`oppActive()` idempotency guard.** Timed transitions are cheap to make safe by re-checking whose turn it is at fire time.
- **Deterministic timeline.** Fixed offsets make the turn scriptable and testable with fake timers.

### Consequences / tradeoffs
- (+) The opponent turn is fully automatic and reads phase-by-phase with the shared HUD/banner.
- (−) A fixed Main window (see P7-D6) means some dead air when the opponent plays fewer than three cards. Accepted for now.

---

## P7-D3 — Combat is generalized to bidirectional; the opponent is a first-class attacker

### Status
**ADOPTED.** The Phase 5 one-directional targeting became a symmetric engine: the opponent declares attacks against player A-cards and applies damage back.

### Context / problem
Phase 5/6 combat only flowed player → opponent (`attackTargets: SlotId → OppSlotId`, `damageByOppSlot`). For a real turn the opponent must attack the player's board and destroy player cards.

### Decision
Add the mirror-direction combat state and engine in `types.ts` + `gameStore.ts`:

- `oppAttackTargets: Partial<Record<OppSlotId, SlotId>>` (opponent O-slot → the player A-slot it attacks).
- `declareOpponentAttacks()` (focus-fire target selection at Battle) and `beginOpponentResolution()` (rolls per attacker via `diceRules`, applies damage via `combatStats`).
- Lethal damage to a player A-card sends it to the **player** `graveyard`, and its linked C-card falls with it (the same rule the player side already had — see the Phase-7 fix commit `2a0a5b1`).

### Why this design
- **Same dice/stat math, opposite direction.** No new combat rules; only new target state and a resolver that reads the opponent as attacker.
- **Symmetry keeps death/travel consistent.** Player and opponent destruction share the "A drags its linked C to the grave" invariant.

### Consequences / tradeoffs
- (+) A genuine two-sided fight: both boards can lose cards.
- (−) Two parallel target maps (`attackTargets` and `oppAttackTargets`) and two damage aggregates now coexist; naming discipline matters.

---

## P7-D4 — Turn ownership is shown as a per-field border on the active side, not a full-screen frame

### Status
**ADOPTED.** Each player's field gets its own thin border; the active player's border is highlighted.

### Context / problem
The first turn-indicator attempt bordered the whole screen, which the user rejected — they wanted the red/blue "circle" idea: a frame around *each* field, lit for whoever's turn it is. The first field frame was also too thick and overlapped the on-card DMG/ACC plates.

### Decision
Render a per-side field border keyed to `activePlayer`, made thin and padded away from the board so it clears the stat plates. The player border lights on the player's turn; the opponent border lights during `runOpponentTurn`.

### Why this design
- **Turn ownership is spatial, not global.** Bordering the active field reads instantly and matches the two-sided board.
- **Presentation-only.** No rules depend on it; it's a pure read of `activePlayer`.

### Consequences / tradeoffs
- (+) Clear, glanceable turn ownership on the correct side.
- (−) Border thickness/padding is a tuned visual value — a rendered review gate, not a unit test.

---

## P7-D5 — Opponent AI is a greedy, re-reading heuristic in pure-ish play steps

### Status
**ADOPTED.** The AI plays one card per type per Main phase via `opponentPlayStep`, re-reading state each play so dependent cards resolve correctly.

### Context / problem
The opponent needs to build a board (A summons, C boosts on its A's, beneficial B's) and then attack, without a full search AI. It also must let a C-card attach to an A that it summoned earlier in the *same* Main phase.

### Decision
`opponentMainPhase()` drives `opponentPlayStep(playedTypes)` greedily in A→C→B order, at most one card per type per turn:

- Each call re-reads `get()`, so a C summoned after an A can see and attach to that A; setting a C rolls `rollCBuff()`.
- Battle uses focus-fire: `declareOpponentAttacks()` aims the opponent's attackers at the player's weakest/lowest-HP A-cards.
- **Free summons only** — no opponent tribute/Commander this phase (deferred).

### Why this design
- **Re-reading state per play** is the simplest correct way to let same-turn dependencies (C-on-A) resolve without a staged plan.
- **Greedy, one-per-type** keeps the turn legible and bounded while still filling a real board.

### Consequences / tradeoffs
- (+) The opponent visibly builds a coherent board and presses the player's weak points.
- (−) No lookahead; it won't hold cards or set up combos. Acceptable — depth is a later phase.
- (−) B-card abilities are placed but not yet fired for the opponent this slice.

---

## P7-D6 — Hidden hand, reveal-on-set fly-in, and a dedicated paced Main window

### Status
**ADOPTED.** The opponent hand is face-down; a played card reveals via the summon showcase, flies in from the hand, and plays are spaced one at a time inside a longer Main window.

### Context / problem
The opponent hand must stay hidden (face-down backs) and each set card should "flash and settle" like a summon. The user also rejected cards being laid down back-to-back — each play needs breathing room so its animation/abilities read individually.

### Decision
- The opponent hand renders as `CardBack` backs; a set card is revealed through `revealOppCard(cardId)` and animates with `MotionCard`'s new `from?` prop (`opponentSummonFromPose()` → flies in from hand center instead of popping).
- Plays are paced: `opponentMainPhase` chains the next play at `OPP_PLAY_STEP_MS` (`= OPP_PLAY_SHOWCASE_MS + OPP_PLAY_GAP_MS`), and Draw/Battle stay snappy at `OPP_PHASE_STEP_MS` while Main gets its own `OPP_MAIN_DURATION_MS = 3 * OPP_PLAY_STEP_MS` window in `runOpponentTurn`.

### Why this design
- **Reveal-on-set matches the player's summon language** without leaking the hand.
- **A dedicated Main window** decouples per-play pacing from the snappy Draw/Battle steps, so pacing can be tuned in one place.

### Consequences / tradeoffs
- (+) Each opponent play lifts, reveals, settles, then pauses — deliberate and readable.
- (−) The fixed Main window wastes time when the opponent plays < 3 cards (dead air). Make it dynamic only if it becomes annoying.

---

## P7-D7 — Opponent piles/board are real state, so inspection and visuals read live data

### Status
**ADOPTED.** Opponent deck/graveyard/replen and B/C board are inspectable and visually driven by authoritative state; attack targeting and card inspection are split hit-tests.

### Context / problem
The user wanted to click opponent A/B/C cards to inspect them (but not the hidden hand), to open both players' graveyard/replen pile popups, and expected the opponent deck to shrink as it draws. Previously several of these were cosmetic or missing.

### Decision
- Pile inspection is wired for `opponentGraveyard` and `opponentReplen` (and both graveyards) through the existing `PileSearchModal`/`PileSource`.
- Hit-testing is split in `src\input\hitTest.ts`: `oppSlotAtPoint` resolves a whole A-C **column** to its O-slot (attack targeting can be clicked anywhere in the link), while `oppCardAtPoint` finds a **specific** card across O/OB/OC zones (inspection). `PointerControls` keys battle targeting off `oppSlot` and inspection off `oppCardId`.
- The opponent deck stack and hand backs render from `opponentDeck.length`.

### Why this design
- **Two different intents, two hit-tests.** "Attack this column" and "inspect this exact card" are separate questions with separate resolvers.
- **Real state → honest visuals.** Removing `OPP_DECK_COUNT` means the deck can't lie about its size.

### Consequences / tradeoffs
- (+) Symmetric inspection/pile UX for both sides; the deck shrinks truthfully.
- (+) Clicking anywhere in an A-C link declares/aims, matching the player-side ergonomics.
- (−) Two opponent hit-tests to keep in sync as zones evolve.
