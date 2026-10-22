# Decision Record — Phase 5 · 2026-08-23

**Author:** Senior Coder (end-of-Phase-5 architectural close-out)  
**Phase:** Phase 5 — dice combat, HP/damage, and opponent targeting (`6385a1b`)  
**Build health:** `npx vitest run` green (127 tests, 11 files, current tree includes uncommitted Phase 6 work) · `npx tsc --noEmit` clean  
**Scope:** architecturally significant decisions introduced by Phase 5. Phases 1–3 used a plain `D-series` numbering scheme; Phase 5 records its additions as `P5-D1`, `P5-D2`, etc. to avoid colliding with earlier decision ids.

---

## P5-D1 — Dice combat is a pure DMG/ACC/HP resolution model, not a render-side effect

### Status
**ADOPTED · PERMANENT RULES SEAM.** Combat rolls resolve through pure functions in `src\state\diceRules.ts`; rendering displays results but does not decide them.

### Context / problem
Phase 4 established Battle → Resolution timing and in-scene D20 animation, but the roll value did not affect game state. Phase 5 needed the first real combat rules: A-cards carry `HP`, `DMG`, and `ACC`; a D20 roll becomes MISS/HIT/GLANCING/CRIT; damage drains health; and lethal targets leave the board.

### Decision
Model one roll as a pure transformation:

- `Card` now carries `dmg?`, `acc?`, and `hp?` in `src\state\types.ts`; the earlier placeholder `atk`/`def` naming is gone.
- `StatKey` is `hp | dmg | acc`, so C-card buffs and A-zone overlays use the same stat vocabulary.
- `RollOutcome` is `glancing | normal | miss | crit`; `RollResult` carries `{ roll, outcome, damage }`.
- `src\state\diceRules.ts` owns `accThreshold`, `classifyRoll`, `resolveRoll`, `DAMAGE_MULTIPLIER`, and `OUTCOME_LABEL`.
- `ACC` is base-10 and maps to the D20 by `floor(acc / 10)`.
- `DMG` is the only value scaled by outcome: glancing ×0.5, normal ×1, miss ×0, crit ×2.

### Why this design
- **Rules are deterministic and testable.** `diceRules.test.ts` covers roll classification, high-ACC bonus crits, max/low ACC edge cases, and damage multipliers without touching React, timers, or Three.js.
- **The store absorbs results, the renderer observes.** `gameStore.beginResolution` picks dice values and stores `resolutionResults`; `ResolutionDice`, `OutcomePopups`, and `DamagePopups` only read state.
- **Future rules have a stable payload.** Later mechanics can consume `RollResult` directly instead of re-reading dice state or parsing UI labels.

### Guardrails
- Do not compute hit/miss/crit behavior in render components.
- Add new dice outcomes or damage rules in `diceRules.ts` first, then update store/tests/render labels.
- Keep `ACC` as threshold input and `DMG` as damage input; do not let accuracy scale damage.

---

## P5-D2 — Effective combat stats stay in `combatStats`, separated from dice rules

### Status
**ADOPTED · PERMANENT MODULE BOUNDARY.**

### Context / problem
A-card values are not just base card data: linked C cards can buff a random stat. Combat resolution needs the effective `DMG`/`ACC`, while the floating stat plate needs effective `HP`/`DMG`/`ACC` plus colored deltas.

### Decision
Keep effective stat math in `src\state\combatStats.ts`:

- `STAT_KEYS` is `['hp', 'dmg', 'acc']`.
- `rollCBuff` chooses a stat and amount from `BUFF_AMOUNTS`.
- `effectiveStats(state, aSlot)` reads the A card plus its linked C slot and returns `EffectiveStats`.
- `gameStore.beginResolution` calls `effectiveStats` before `resolveRoll`.
- `StatOverlay` receives an `EffectiveStats` object and optional `currentHp`.

### Why this design
- **One source of truth for buffs.** Combat and UI cannot disagree about whether a C-card modified DMG, ACC, or HP.
- **Pure modules compose cleanly.** `combatStats` answers "what are this card's stats now?"; `diceRules` answers "what does this roll do with those stats?"
- **Tests stay narrow.** `combatStats.test.ts` covers buff math; `diceRules.test.ts` covers roll math; `gameStore.test.ts` covers timeline/state integration.

### Guardrails
- Do not duplicate C-card boost math in `gameStore` or render components.
- If future effects alter stats temporarily, extend `effectiveStats` rather than patching display and combat separately.

---

## P5-D3 — Resolution is a timed state-machine sequence that holds End until visuals finish

### Status
**ADOPTED · IMPORTANT UX CONTRACT.** Resolution owns its full dice/result/damage/destruction dwell before advancing to End.

### Context / problem
Early Phase 5 iterations let the End phase banner collide with dice, hit pop-ups, damage numbers, and destruction travel. The user explicitly wanted the dice to wait until the Resolution banner cleared, the roll value and popup to disappear together, and End to wait until destruction visuals completed.

### Decision
`gameStore.beginResolution` is the single timed entry effect for the Resolution phase:

1. Clear stale `outcomePopups`, `resolutionRolls`, `resolutionResults`, and `damagePopups`.
2. Wait `RESOLUTION_ROLL_DELAY_MS` so the phase banner leaves the screen.
3. Pick one D20 per declared attacker and set `resolutionRolls`.
4. After `DICE_ROLL_MS`, settle dice and compute `resolutionResults`.
5. After `DICE_HOLD_MS`, show source outcome popups and apply target damage.
6. Keep phase as `resolution` through `OUTCOME_POPUP_MS`.
7. Clear dice/popups, remove dead targets, then hold `GRAVEYARD_TRAVEL_MS` when destruction occurred before entering End.

### Why this design
- **No visual collision.** End does not start until the combat moment has fully resolved.
- **State drives animation lifetime.** Components mount/unmount from explicit store fields instead of private timers scattered across render files.
- **The no-attacker path is still deterministic.** If there are no attack targets, Resolution simply waits a short beat after the banner and advances to End.

### Guardrails
- Do not call `goToPhase('end')` directly from render components.
- New Resolution visuals must join this dwell sequence rather than adding independent End-phase timers.
- Keep timer constants exported so tests can advance fake timers precisely.

---

## P5-D4 — Opponent combat state is separate from player deck/board state

### Status
**ADOPTED FOR THE PHASE-5 SIMULATION.**

### Context / problem
Phase 5 needed something for the player's A-cards to attack, but a full Player 2 turn/deck/hand system was out of scope. Reusing the player's `cardsById` and `board` for dummy enemies would have polluted deck, graveyard, pose selectors, and pile search behavior.

### Decision
Represent the opponent as a small, separate Vanguard row:

- `OppSlotId = 'O1' | 'O2' | 'O3' | 'O4'` in `src\state\types.ts`.
- `opponentCards` and `opponentBoard` live alongside player state but do not enter `cardsById`, `deck`, `hand`, `graveyard`, or `replen`.
- `OPPONENT_LIBRARY`, `opponentCardId`, and `createInitialOpponents` live in `src\state\cardData.ts`.
- `OPP_SLOT_IDS` and `OPP_SLOT_POSITIONS` live in `src\board\boardConfig.ts`.
- `OpponentBoard` renders opponent cards and stat plates; player `CardEntity` still only iterates player cards.

### Why this design
- **No accidental Player 2 rules.** The opponent is a target row, not a second player.
- **Player systems stay stable.** Hand fan, deck draw, graveyard/replen search, and board placement did not need a second owner dimension.
- **Easy future migration.** The separate fields make it explicit what must become generalized when real two-player state arrives.

### Tradeoff
Opponent lethal damage currently slashes and removes the card from `opponentBoard`; there is no opponent graveyard yet. The earlier Phase-5 self-damage checkpoint described player A+C death-to-graveyard, but the final targeting model superseded that combat path.

---

## P5-D5 — Attack declarations are explicit source→target mappings

### Status
**ADOPTED · CURRENT BATTLE DECLARATION MODEL.**

### Context / problem
Phase 4 used a simple selected-attacker list. Phase 5 targeting needed to know both "which player A-card attacks" and "which opponent card receives damage," including multiple player A-cards aiming at the same opponent.

### Decision
Replace attacker selection with targeting state:

- `attackTargets: Partial<Record<SlotId, OppSlotId>>` maps player A-slots to opponent slots.
- `targeting: SlotId | null` records the source currently awaiting a target.
- `aimPoint: Vec3 | null` lets the live arrow rubber-band to the pointer.
- `aimAttack(slotId)`, `assignTarget(oppSlot)`, `cancelTargeting()`, and `setAimPoint(point)` are store actions.
- `beginResolution` iterates `Object.keys(attackTargets)` as the attacker set and aggregates damage by target.

### Why this design
- **One record answers both questions.** An A-card attacks only if it has an `attackTargets` entry.
- **Stacking is natural.** Multiple keys may point at the same `OppSlotId`; the store sums their damage into one red target popup.
- **Retargeting is explicit.** Clicking a source again clears its old arrow until a new target is chosen.

### Guardrails
- Do not reintroduce an independent `attackers: SlotId[]` list; it can drift from targets.
- Store only valid occupied opponent slots in `attackTargets`; `assignTarget` should continue to reject empty opponent slots.

---

## P5-D6 — Targeting feedback is rendered as gold outlines plus faint arrows

### Status
**ADOPTED · UX PATTERN FOR DECLARED ATTACKS.**

### Context / problem
The user requested a Battle flow where clicking a player A-card asks for an opponent target and shows a faint arrow from source to target. The interaction also needed a clear "valid target" cue on opponent cards.

### Decision
Keep Battle input DOM-driven and add three small render surfaces:

- `PointerControls` detects opponent hits with `oppSlotAtPoint` from `src\input\hitTest.ts`.
- `SlotView` highlights the attacking A/C column during Battle and Resolution from `attackTargets`/`targeting`.
- `OpponentBoard` shows a gold outline on occupied opponent cards while the player is aiming.
- `TargetingArrows` draws faint gold source→target arrows during Battle and Resolution.
- `DamagePopups` shows red aggregated `-{damage}` numbers over opponent slots.

### Why this design
- **Input remains centralized.** No R3F pointer handlers were added to individual cards.
- **UI is explanatory before commit.** The live `aimPoint` arrow shows intent while choosing, and committed arrows persist into Resolution.
- **Different feedback lives where it belongs.** Source gets HIT/MISS/GLANCING/CRITICAL; target gets red damage and HP drain.

### Guardrails
- New targetable surfaces should go through hit-test helpers and store actions, not direct mesh callbacks.
- Keep arrows faint; they are intent indicators, not combat effects.
