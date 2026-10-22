# Decision Record — Phase 4 · 2026-08-23

**Author:** Senior Coder (retroactive end-of-Phase-4 architectural close-out)  
**Phase:** Phase 4 — turn mechanics, battle declaration, and Resolution dice (`7f4063b`)  
**Build health:** `npx tsc --noEmit` green · `npx vitest run` green (127 tests, 11 files, current tree includes later uncommitted Phase 6 work)  
**Scope:** the architecturally significant decisions that define Phase 4. Earlier phases used the plain D-series (`D1`, `D2`, ...); this retroactive Phase 4 record uses phase-prefixed ids (`P4-D1`, `P4-D2`, ...) to avoid colliding with unseen Phase 3 numbering.

---

## P4-D1 — The turn engine is a single-sided phase state machine in `gameStore`, not a scheduler outside state

### Status
**ADOPTED · PERMANENT PATTERN.** Phase transitions and phase-entry effects are centralized in `src\state\gameStore.ts`.

### Context / problem
Phase 3 ended with pile management, B-card abilities, C-card buffs, and summon reveal animation, but the app still behaved like a sandbox: cards could be set at any time, deck clicks drew manually, and there was no turn identity. Phase 4 needed an explicit flow while still remaining single-sided: opening deal, Draw, Main, Battle, Resolution, End, then next turn.

### Decision
Add a minimal phase model in `src\state\types.ts`:

- `Phase = 'draw' | 'main' | 'battle' | 'resolution' | 'end'`.
- `PHASE_ORDER` and `PHASE_LABEL` provide display order and labels for the HUD/banner.
- `GameState.turn`, `GameState.phase`, and `GameState.phaseAnnounce` make the current turn and phase authoritative state.

The state machine lives in `createGameStore`:

- `beginDrawPhase()` enters Draw.
- `advancePhase()` handles the manual progression: Main → Battle → Resolution, and End → next turn's Draw.
- Draw and Resolution are auto-advance phases; `advancePhase()` deliberately ignores clicks during them.
- Internal `goToPhase()` updates phase state, increments `phaseAnnounce`, optionally increments the turn, and runs phase-entry effects.

### Why this design
- **One source of truth.** UI and input ask the store what phase is active; they do not infer it from animations or local component state.
- **Entry effects stay atomic.** Draw, Resolution, and End all mutate real game state when the phase is entered, which keeps timers and rules in one file instead of scattering them across render components.
- **Single-player today, multiplayer-compatible later.** Phase 4 intentionally avoids `activePlayer`; adding Player 2 later can extend the state machine instead of requiring a UI-first rewrite.

### Consequences / tradeoffs
- (+) Tests can drive the phase machine with fake timers in `src\state\gameStore.test.ts`.
- (+) The HUD, banner, placement gate, and battle click handling all consume the same `phase`.
- (−) Timers in the store are now part of game behavior. Future cancellation/reset work must clear or guard any scheduled transition; Phase 4 uses current-phase guards before auto-advancing.

### Guardrails for future phases
- Keep all phase transitions behind `goToPhase()` / store actions. Do not set `phase` directly from components.
- If Player 2 is added, extend the turn model in `src\state\types.ts` and `src\state\gameStore.ts`; do not fork separate P1/P2 schedulers.

---

## P4-D2 — Battle declares A-slot attackers first; Resolution consumes that declaration later

### Status
**ADOPTED · PERMANENT PATTERN.** Battle is declaration; Resolution is execution.

### Context / problem
The user initially described a battle click as a D20 roll, then refined the model: Battle should mark selected A cards as attackers, and a new Resolution phase should roll only for those selected cards. That requires a stable declaration record independent of pointer clicks and animation timing.

### Decision
Store declared attackers as A-slot ids:

- `GameState.attackers: SlotId[]` in `src\state\types.ts`.
- `toggleAttacker(slotId)` in `src\state\gameStore.ts` only works during Battle, only for occupied A slots.
- `resolveAttackerSlot(board, slot)` in `src\board\slotRules.ts` maps either zone of a linked A/C column back to the column's A slot.
- `src\input\PointerControls.tsx` records the board slot under the pointer and, during Battle, clicks either the occupied A zone or its linked C zone to toggle the A attacker.
- `src\render\SlotView.tsx` highlights both the A and C zones of any declared attacker during Battle and Resolution.

### Why this design
- **Slot id is the battle identity.** Existing board state is slot-keyed; using A-slot ids avoids a second mapping from card id to battlefield position.
- **Declaration is visibly persistent.** The gold linked-column outline stays on until End, so the user can see which cards will roll before Resolution begins.
- **The A/C link rule is centralized.** `resolveAttackerSlot` reuses the same column-index convention as C-card support rules instead of duplicating pointer-specific logic in the input layer.

### Consequences / tradeoffs
- (+) Multiple attackers are naturally represented as an array of A slots and can roll simultaneously.
- (+) Clicking a C side of the linked zone feels forgiving without changing the real attacker identity.
- (−) Only A-slot cards can attack. That is correct for Phase 4 but should be revisited if B/C cards later gain attack roles.

### Guardrails for future phases
- Keep attacker declarations as stable battlefield references until combat damage exists.
- If card movement/removal can happen during Battle, validate `attackers` before Resolution and drop stale A-slot ids.

---

## P4-D3 — Dice values are chosen and absorbed by the store; `ResolutionDice` is visual-only

### Status
**ADOPTED · PERMANENT PATTERN.** Random outcomes enter state when Resolution starts; rendering only reveals them.

### Context / problem
Resolution needed a D20 animation per selected attacker, with all dice rolling simultaneously over each card's A/C link area. The eventual combat engine needs the values even though Phase 4 does not yet spend them for damage.

### Decision
`src\state\gameStore.ts` owns dice timing and values:

- `DICE_SIDES = 20`.
- `RESOLUTION_ROLL_DELAY_MS = 1700`, aligned with `PhaseBanner`'s `ANIM_MS`, so dice wait for the Resolution banner to clear.
- `DICE_ROLL_MS = 800` and `DICE_HOLD_MS = 600` control tumble and settle visibility.
- Internal `beginResolution()` rolls once per declared attacker, writes `resolutionRolls`, immediately merges values into `lastRolls`, settles `rolling: false`, then auto-advances to End.
- With no attackers, Resolution still waits briefly after the banner and then enters End.

`src\render\ResolutionDice.tsx` reads `resolutionRolls` and renders in-scene D20s. It positions each die at the midpoint between the A slot and linked C slot using `SLOT_POSITIONS`, cycles the displayed number while `rolling`, then locks to the stored value.

### Why this design
- **Game outcome is not animation-derived.** A roll value exists before the visual tumble completes, so future battle rules can consume deterministic state rather than scraping UI state.
- **Animation is replaceable.** `ResolutionDice` can be restyled or replaced without changing how combat outcomes are produced.
- **Banner and dice do not visually compete.** The explicit `RESOLUTION_ROLL_DELAY_MS` records the sequencing contract with `PhaseBanner`.

### Consequences / tradeoffs
- (+) Tests can assert `lastRolls` immediately after the roll starts and independent of rendered frames.
- (+) Multiple dice roll in parallel because `resolutionRolls` is keyed by attacker slot.
- (−) `lastRolls` persists after End. That is intentional "absorbed into the engine" state for future rules, but later phases should decide whether it is turn-scoped or combat-log-scoped.

### Guardrails for future phases
- Do not generate dice values inside `ResolutionDice`.
- If PhaseBanner timing changes, update `RESOLUTION_ROLL_DELAY_MS` or introduce a shared timing constant.
- If combat damage is added, consume `lastRolls` from the store and keep the die component presentational.

---

## P4-D4 — End-phase cleanup runs on entering End, with continuous B cards as an explicit card property

### Status
**ADOPTED · PERMANENT PATTERN.** End effects are entry effects, not a delayed "end turn" button side effect.

### Context / problem
The user chose: on entering End, shuffle replen into deck, discard non-continuous B cards, show End, then the player clicks to advance to the next turn's Draw. Phase 3 already had B abilities and pile-shuffle actions, but no persistence distinction among B cards.

### Decision
Add `Card.continuous?: boolean` in `src\state\types.ts`; mark B3 (`Tempest Weaver`) and B4 (`Astral Archon`) continuous in `src\state\cardData.ts`. `src\cards\CardView.tsx` renders a `◆ CONTINUOUS ◆` badge for those B cards.

`runEndPhase()` in `src\state\gameStore.ts` fires when `goToPhase('end')` runs:

- calls `replenIntoDeck()` so the replen pile folds back into deck with the existing shuffle behavior;
- scans B1–B4 on the board;
- sends any non-continuous B cards to `graveyard`;
- leaves continuous B cards in place.

### Why this design
- **Cleanup timing matches the operator model.** By the time the End banner/HUD is visible, the end-of-turn effects have already happened.
- **Continuity belongs to the card profile.** Whether a B card survives End is a property of that card, not of the slot or the phase machine.
- **Existing pile mechanics are reused.** End phase delegates to `replenIntoDeck()` instead of adding a second shuffle path.

### Consequences / tradeoffs
- (+) B-card persistence is testable and visible.
- (+) Future B cards can opt into persistence with one data flag.
- (−) End cleanup currently hard-codes the four B slots. That is acceptable for the Phase 2 board shape but should become slot-set driven if slot counts change.

### Guardrails for future phases
- Keep "on entering phase" effects idempotent or guarded, especially when timers can fire after reset.
- Add future persistent/temporary effects as card metadata or rule metadata, not as one-off UI flags.

---

## P4-D5 — Manual deck-click draw is disabled; drawing is now phase/rule driven

### Status
**ADOPTED.** The deck remains renderable and drawable by store actions, but user deck clicks no longer draw.

### Context / problem
Phase 1 allowed click-to-draw as a tactile interaction. Once Phase 4 introduced Draw phase rules, manual deck click became a rules bypass: it could draw during Main, Battle, Resolution, or End.

### Decision
Remove the deck-click draw branch from `src\input\PointerControls.tsx`. `drawCard()` remains in `src\state\gameStore.ts` because it is still used by `OpeningDeal`, `beginDrawPhase()`, and B-card draw abilities.

### Consequences / tradeoffs
- (+) Card flow is controlled by phases and abilities only.
- (+) The old interaction is not removed from the engine, only from direct pointer input.
- (−) The deck is no longer directly interactive for normal play; future UX should make this explicit enough that users do not think deck clicks are broken.
