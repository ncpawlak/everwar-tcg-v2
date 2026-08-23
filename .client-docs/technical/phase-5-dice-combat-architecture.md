# Technical Doc — Everwar Phase 5: Dice Combat Architecture

**Audience:** Coders and Senior Coders  
**Phase:** 5 — Dice Combat, HP/Damage, and Opponent Targeting  
**Shipped:** 2026-08-23 · commit `6385a1b`  
**Stack:** TypeScript · React + Vite · Three.js / React Three Fiber v8 + drei · Zustand (vanilla) · @react-spring/three · Vitest

---

## Overview

Phase 5 converts the Phase 4 Battle/Resolution flow into a combat loop. The most important
architectural change is that combat is state/rules driven, while visuals are projections of
that state:

```text
State (Zustand) → Pure combat rules → Timed Resolution state → Rendered feedback
       ↑                  ↑                       ↑
 DOM Pointer Input   combatStats.ts          dice/popups/arrows
```

No source file under `src\` should be changed by this close-out doc pass. The source of truth
for Phase 5 is commit `6385a1b`.

---

## What Changed Per Layer

### Layer 1: Authoritative Game State (`src\state\`)

#### Combat stats and roll result types (`types.ts`)

Phase 5's combat vocabulary is:

```typescript
export type StatKey = 'hp' | 'dmg' | 'acc';
export type RollOutcome = 'glancing' | 'normal' | 'miss' | 'crit';

export interface RollResult {
  roll: number;
  outcome: RollOutcome;
  damage: number;
}
```

`Card` now carries optional `dmg`, `acc`, and `hp` fields for Vanguard cards. `GameState`
adds:

| Field | Purpose |
|---|---|
| `opponentCards` | Dummy opponent Vanguard card records, separate from player `cardsById` |
| `opponentBoard` | `O1..O4` far-row occupancy |
| `attackTargets` | Player A-slot → opponent slot declaration map |
| `targeting` | Player A-slot currently waiting for a target click |
| `aimPoint` | Live board-plane point for the rubber-band arrow |
| `resolutionResults` | Settled `RollResult`s for the current Resolution |
| `outcomePopups` | Source-side outcome words |
| `damagePopups` | Target-side aggregated red damage numbers |
| `currentHp` | Damaged card current HP; absent means full HP |
| `destroying` | Opponent slots currently showing destruction slash FX |

#### Card data (`cardData.ts`)

A-card profiles were migrated to DMG/ACC/HP. Example values in `CARD_LIBRARY` include
`Ashborne Vanguard` (`dmg 1800`, `acc 130`, `hp 1900`) and `Warcry Commander`
(`dmg 2400`, `acc 170`, `hp 2300`).

Opponent simulation data is intentionally separate:

- `OPPONENT_LIBRARY` defines `O1..O4` dummy Vanguard profiles.
- `opponentCardId(slot)` returns ids like `opp-O1`.
- `createInitialOpponents()` seeds O1–O3 and leaves O4 empty.
- `createInitialState()` initializes opponent fields plus all combat transient records.

#### Dice rules (`diceRules.ts`)

`src\state\diceRules.ts` is pure:

| Symbol | Purpose |
|---|---|
| `accThreshold(acc)` | `floor(acc / 10)` |
| `classifyRoll(roll, acc)` | Maps a D20 face to `glancing`, `normal`, `miss`, or `crit` |
| `resolveRoll(roll, dmg, acc)` | Returns `RollResult` with outcome-scaled damage |
| `DAMAGE_MULTIPLIER` | `glancing: .5`, `normal: 1`, `miss: 0`, `crit: 2` |
| `OUTCOME_LABEL` | Short labels for die/result display |

#### Effective stats (`combatStats.ts`)

`effectiveStats(state, aSlot)` combines the A-card base stats with its linked C-card boost.
Resolution uses this to resolve damage; `StatOverlay` uses the same object to render effective
HP/DMG/ACC and colored deltas.

---

### Layer 2: Board geometry and hit-testing

#### Opponent row (`boardConfig.ts`)

Phase 5 adds the opponent row without changing the player slot ids:

```typescript
export const OPP_SLOT_IDS = ['O1', 'O2', 'O3', 'O4'] as const;
export const OPP_SLOT_POSITIONS: Record<OppSlotId, Vec3> = { ... };
```

Opponent cards sit at the four existing pair centers, on `OPP_ROW_Z = -1.62`, which reads as
the far side of the board while remaining inside the existing camera framing.

#### Hit-testing (`hitTest.ts`)

`oppSlotAtPoint(point)` mirrors `slotAtPoint(point)` for `OPP_SLOT_IDS` and is used only for
target selection. Player board hit-testing remains unchanged.

#### Linked-column helpers (`slotRules.ts`)

Phase 5 continues to rely on earlier linked A/C helpers:

- `resolveLinkedTarget` resolves drag hover across A/C pairs.
- `resolveAttackerSlot` lets Battle clicks on either A or C side of a column choose the
  occupied A slot as the attacker.
- `slotHighlighted` keeps drag and attack highlights rule-driven.

---

### Layer 3: Store actions and Resolution timing (`gameStore.ts`)

#### Attack declaration

The public action surface for targeting:

| Action | Behavior |
|---|---|
| `aimAttack(slotId)` | Battle-only; starts aiming from an occupied A slot and clears its previous target |
| `assignTarget(oppSlot)` | Battle-only; commits current `targeting` source to an occupied opponent slot |
| `cancelTargeting()` | Clears `targeting`/`aimPoint` |
| `setAimPoint(point)` | Updates live arrow tip while aiming |

`attackTargets` replaces the earlier plain attacker list. Resolution treats the keys as the
attacker set and the values as damage destinations.

#### Resolution timeline

`beginResolution` is the single entry effect:

1. Clear stale roll/popup state.
2. If no `attackTargets`, wait briefly after the banner and advance to End.
3. After `RESOLUTION_ROLL_DELAY_MS`, create `resolutionRolls`.
4. After `DICE_ROLL_MS`, settle dice and compute `resolutionResults` with
   `effectiveStats` + `resolveRoll`.
5. After `DICE_HOLD_MS`, snapshot `outcomePopups`, aggregate damage by target, drain
   `currentHp`, set `damagePopups`, and mark lethal slots in `destroying`.
6. After `OUTCOME_POPUP_MS`, clear dice/popups/results and remove zero-HP opponent cards.
7. If anything was destroyed, wait `GRAVEYARD_TRAVEL_MS`; then enter End.

End clears `attackTargets`, `targeting`, and `aimPoint`, then runs the existing End-phase
cleanup for player B cards and replen.

---

### Layer 4: Render and UI (`src\render\`, `src\cards\`, `src\input\`)

#### `PointerControls.tsx`

Input remains DOM-driven:

- Press detection now includes kind `'opp'`.
- `oppSlotAtPoint` detects opponent clicks.
- Battle click routing performs aim/assign/cancel before normal inspect behavior.
- `dblclick` on a hand card calls `autoPlaceCard` for Main-phase quick placement.

#### Combat render components

| Component | Role |
|---|---|
| `OpponentBoard` | Renders far-row opponent cards, stat plates, and gold target outlines while aiming |
| `TargetingArrows` | Draws faint gold committed arrows and the live rubber-band aiming arrow |
| `ResolutionDice` | Shows one D20 per attacker over the source A/C pair |
| `OutcomePopups` | Shows source-side MISS/HIT/GLANCING/CRITICAL words |
| `DamagePopups` | Shows target-side red aggregated damage |
| `DestructionFx` | Shows red X-slash over lethal opponent cards |
| `StatOverlay` | Shows current/max HP, DMG, ACC; animates HP bar fill/color |

`GameScene` mounts these components in scene order after the board/slot/card surfaces.

---

## File Structure Changes (Phase 5 additions/modifications)

```text
src\
  state\
    types.ts              ← CHANGED: HP/DMG/ACC, RollResult, opponent/targeting/damage fields
    cardData.ts           ← CHANGED: DMG/ACC A-cards, opponent library/initialization
    combatStats.ts        ← CHANGED: effective hp/dmg/acc stats
    diceRules.ts          ← NEW: pure D20 outcome and damage math
    diceRules.test.ts     ← NEW: dice-rule matrix tests
    gameStore.ts          ← CHANGED: Resolution combat timeline, targeting actions, HP/damage
    gameStore.test.ts     ← CHANGED: targeting, Resolution, damage, death tests
  board\
    boardConfig.ts        ← CHANGED: opponent row positions
    slotRules.ts          ← CHANGED: linked targeting helpers used by Battle
  input\
    hitTest.ts            ← CHANGED: opponent slot hit-test
    PointerControls.tsx   ← CHANGED: aim/assign/cancel routing, double-click auto-place
  render\
    OpponentBoard.tsx     ← NEW: far-row opponent cards + stats
    TargetingArrows.tsx   ← NEW: faint source→target arrows
    DamagePopups.tsx      ← NEW: opponent-side red damage numbers
    OutcomePopups.tsx     ← NEW: source-side outcome words
    DestructionFx.tsx     ← NEW: red slash destruction FX
    ResolutionDice.tsx    ← CHANGED: smaller source-side dice, value-only display
    StatOverlay.tsx       ← CHANGED: animated HP bar + DMG/ACC rows
    SlotView.tsx          ← CHANGED: attack declaration highlights
    AZoneStats.tsx        ← CHANGED: passes current HP
    GameScene.tsx         ← CHANGED: mounts combat render surfaces
  cards\
    CardView.tsx          ← CHANGED: DMG/ACC card face text, non-pickable opponent cards
```

---

## Testing Patterns

Close-out validation was run on the current worktree:

- `npx vitest run` — 127 tests passed across 11 files.
- `npx tsc --noEmit` — clean.

Important Phase 5 coverage:

| File | Coverage |
|---|---|
| `diceRules.test.ts` | D20 classification, high-ACC bonus crit, damage multipliers |
| `combatStats.test.ts` | HP/DMG/ACC effective stats and C-card buffs |
| `cardData.test.ts` | A-card combat profile shape and opponent initial state |
| `gameStore.test.ts` | Resolution timers, targeting actions, damage aggregation, opponent death/removal, auto-place |
| `hitTest.test.ts` | Player slot hit-testing plus opponent slot hit-testing |
| `slotRules.test.ts` | Linked A/C targeting and placeability rules |

---

## Known Limitations and Tech Debt

| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | **Opponent is a simulation row, not Player 2** | Medium | No opponent deck, hand, turn, graveyard, or AI. |
| 2 | **Lethal opponents vanish instead of entering an opponent graveyard** | Medium | Intentional final Phase 5 behavior; earlier checkpoints mention self-damage/death-to-graveyard before targeting superseded it. |
| 3 | **Balance remains provisional** | Medium | Player DMG, ACC, C-card buffs, and opponent HP need tuning after more playtesting. |
| 4 | **Target removal is click-based only** | Low | Retarget by clicking the source again; no dedicated cancel/clear UI. |
| 5 | **Resolution timing uses chained timers** | Low | Tests cover it, but a future animation scheduler/state machine may be easier to extend. |
| 6 | **No win/loss condition** | By design | Destroying opponents currently has no match-ending consequence. |

