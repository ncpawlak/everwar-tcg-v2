# Reviewer Log — Everwar Phase 7

## 2026-08-23 · R-007-001 · Turn indicator bordered the whole screen instead of each field

**Phase:** Phase 7
**Severity:** Visual / UX for turn ownership
**Found by:** User screenshot review during the turn-loop pass.
**Symptom:** The turn highlight framed the entire screen. The user wanted a border around *each player's field* (like the red/blue circle sketch), lit for whoever's turn it is.

**Root cause:** The first indicator was a single full-viewport frame rather than a per-side field border.

**Introduced by:** Turn-loop field-highlight implementation.

**Fix (verified):** Replaced the full-screen frame with a per-field border keyed to `activePlayer` — the player's border lights on the player's turn, the opponent's during `runOpponentTurn`. User confirmed the turn loop and highlight looked good.

**Resolution status:** RESOLVED.

**Guardrail / learning candidate:** Turn ownership on a two-sided board is spatial — border the active *field*, not the whole screen.

---

## 2026-08-23 · R-007-002 · Field border too thick and overlapping the DMG/ACC plates

**Phase:** Phase 7
**Severity:** Readability
**Found by:** User visual review.
**Symptom:** The field frame was too thick and sat on top of the opponent cards' DMG/ACC stat values.

**Root cause:** Border stroke width and inset were tuned too aggressively; the frame intruded into the stat-plate zone.

**Introduced by:** The R-007-001 fix's first border sizing.

**Fix (verified):** Made the border thinner and padded it away from the board so it clears the on-card stat plates. User approved ("that looks good").

**Resolution status:** RESOLVED.

**Guardrail / learning candidate:** On-card stat plates own a keep-out zone; decorative frames must be padded outside it.

---

## 2026-08-23 · R-007-003 · Graveyard / replen pile popups did not open

**Phase:** Phase 7
**Severity:** Feature gap / blocking for inspection parity
**Found by:** User.
**Symptom:** Neither the player's nor the opponent's graveyard popup opened. The user could view opponent cards on the field, but not the graveyard/replen piles.

**Root cause:** The pile-search inspection was not wired for the opponent piles (`opponentGraveyard`, `opponentReplen`) and both graveyards.

**Introduced by:** Opponent state addition (piles were real state, but not connected to the pile browser).

**Fix (verified):** Wired `PileSource` / `PileSearchModal` for `opponentGraveyard` and `opponentReplen` alongside the player graveyard/replen so both sides' piles open the expected popup. User approved.

**Resolution status:** RESOLVED.

**Guardrail / learning candidate:** When you add a real pile to state, connect it to the pile browser in the same slice, or inspection silently no-ops.

---

## 2026-08-23 · R-007-004 · Linked C-card did not follow the player's A-card to the graveyard

**Phase:** Phase 7
**Severity:** Rules bug
**Found by:** User.
**Symptom:** When the opponent destroyed the player's A-card, the linked C-card in that column stayed on the board instead of going to the graveyard with it.

**Root cause:** Bidirectional combat's opponent-as-attacker death path did not carry the linked C-card, unlike the player-side destruction path.

**Introduced by:** Slice 3 bidirectional combat.

**Fix (verified):** Opponent-inflicted lethal damage now sends the destroyed A-card **and** its linked C-card to the player graveyard (commit `2a0a5b1`). User confirmed ("looks good").

**Resolution status:** RESOLVED.

**Guardrail / learning candidate:** The "A drags its linked C to the grave" invariant must hold on BOTH destruction directions, not just player→opponent.

---

## 2026-08-23 · R-007-005 · Opponent drew only one card, not the draw rule

**Phase:** Phase 7
**Severity:** Rules bug
**Found by:** User.
**Symptom:** At its Draw phase the opponent drew a single card instead of following the player's draw rule (refill toward the hand target).

**Root cause:** `runOpponentTurn` called a single `drawOpponentCard()` at Draw.

**Introduced by:** Slice 2 opponent turn loop.

**Fix (verified):** Added `drawOpponentCards()` which refills the opponent hand toward `HAND_TARGET` (minimum one), staggered for animation, matching the player draw rule. User confirmed the draw rule was working.

**Resolution status:** RESOLVED.

**Guardrail / learning candidate:** Give the opponent the SAME rule helper the player uses; do not re-implement a weaker one-off.

---

## 2026-08-23 · R-007-006 · Could only attack from the A-zone, not the whole A-C link

**Phase:** Phase 7
**Severity:** Input ergonomics
**Found by:** User.
**Symptom:** Declaring/aiming an attack at an opponent required clicking the A-card zone specifically; clicking within the A-C link column did nothing.

**Root cause:** `oppSlotAtPoint` only hit-tested the opponent A-row, not the mirrored C-zone of the same column.

**Introduced by:** Opponent targeting hit-test.

**Fix (verified):** `oppSlotAtPoint` now also hit-tests the opponent's mirrored C-zone (`OPP_FULL_SLOT_POSITIONS['C'+n]`) and resolves the whole column to its O-slot, so a click anywhere in the A-C link targets that column. User approved ("the attacks look good").

**Resolution status:** RESOLVED.

**Guardrail / learning candidate:** Targeting should accept the whole logical link column, matching the player-side drop ergonomics.

---

## 2026-08-23 · R-007-007 · Could not inspect opponent B / C cards

**Phase:** Phase 7
**Severity:** Inspection parity
**Found by:** User.
**Symptom:** Opponent A-cards could be clicked to inspect, but B and C cards could not.

**Root cause:** Inspection reused the attack-targeting column hit-test, which only resolves A-row O-slots; there was no per-card hit-test across the B/C zones.

**Introduced by:** Opponent inspection wiring.

**Fix (verified):** Added `oppCardAtPoint(point, boards)` which finds the specific card across the O/OB/OC zones; `PointerControls` keys inspection off `oppCardId` (distinct from the `oppSlot` used for attack targeting). User approved.

**Resolution status:** RESOLVED.

**Guardrail / learning candidate:** "Attack this column" and "inspect this exact card" are different questions — give them separate hit-tests.

---

## 2026-08-23 · R-007-008 · Opponent deck did not shrink visually as it drew

**Phase:** Phase 7
**Severity:** Visual honesty bug
**Found by:** User.
**Symptom:** The opponent kept drawing, but its deck stack stayed the same visual size.

**Root cause:** The opponent deck render used a hard-coded decorative `OPP_DECK_COUNT` stack, unrelated to real state.

**Introduced by:** Phase 6 visual-only opponent deck.

**Fix (verified):** Tied the opponent deck stack render and the hand deck-top origin to the live `opponentDeck.length`; removed `OPP_DECK_COUNT`. User confirmed.

**Resolution status:** RESOLVED.

**Guardrail / learning candidate:** Once a pile is real state, drive its visual from `.length`; never leave a cosmetic count that can lie.

---

## 2026-08-23 · R-007-009 · Opponent laid all its cards down back-to-back

**Phase:** Phase 7
**Severity:** Pacing / feel
**Found by:** User.
**Symptom:** During Main the opponent set every card immediately in sequence, giving no time for each summon animation/ability to read individually.

**Root cause:** Plays were chained at the showcase length only, with no gap between them, inside the general phase-step window.

**Introduced by:** Slice 4b sequential plays.

**Fix (verified):** Added a real gap between plays (`OPP_PLAY_GAP_MS`), chained the next play at `OPP_PLAY_STEP_MS`, and gave Main its own longer window (`OPP_MAIN_DURATION_MS`) while keeping Draw/Battle snappy. Each card now lifts, reveals, settles, then pauses before the next. User approved ("that looks good").

**Resolution status:** RESOLVED — `npx vitest run` green (139 tests).

**Guardrail / learning candidate:** Sequenced AI actions need an explicit inter-action gap, not just the action's own animation length, to feel deliberate.
