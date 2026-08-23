# Technical Doc — Everwar Phase 4: Turn Mechanics Architecture

**Audience:** Coders and Senior Coders  
**Phase:** 4 — Turn Mechanics, Battle Declaration, Resolution Dice  
**Shipped:** 2026-08-23 · commit `7f4063b`  
**Stack:** TypeScript · React + Vite · Three.js / React Three Fiber v8 + drei · Zustand (vanilla) · @react-spring/three · Vitest

---

## Overview

Phase 4 adds a single-sided turn state machine on top of the Phase 3 card/pile mechanics.

```text
State (Zustand) → Pose / Rules Selectors → Spring / Timed Animation → Scene + DOM Render
       ↑                         ↑
       └──────── DOM Input (PointerControls)
```

The primary changes are in **Layer 1** (`src\state\`) and **Layer 2** (`src\board\slotRules.ts`), with new presentational overlays in `src\ui\` and `src\render\`.

---

## What Changed Per Layer

### Layer 1: Authoritative Game State (`src\state\`)

#### Turn and phase types (`types.ts`)

```typescript
export type Phase = 'draw' | 'main' | 'battle' | 'resolution' | 'end';

export const PHASE_ORDER: readonly Phase[] = [
  'draw',
  'main',
  'battle',
  'resolution',
  'end',
];

export const PHASE_LABEL: Record<Phase, string> = {
  draw: 'Draw',
  main: 'Main',
  battle: 'Battle',
  resolution: 'Resolution',
  end: 'End',
};
```

`GameState` gained:

| Field | Purpose |
|---|---|
| `turn` | 1-based turn counter |
| `phase` | current `Phase` |
| `phaseAnnounce` | monotonic counter used to replay `PhaseBanner` |
| `attackers` | A-slot ids declared during Battle |
| `resolutionRolls` | transient D20 display state during Resolution |
| `lastRolls` | stored roll results, keyed by attacker A-slot |

`DiceState` is `{ value: number; rolling: boolean }`. The roll value is chosen by the store; render only reveals it.

#### Initial state (`cardData.ts`)

`createInitialState()` starts with:

- `turn: 1`
- `phase: 'draw'`
- `phaseAnnounce: 0`
- empty `attackers`, `resolutionRolls`, and `lastRolls`

`phaseAnnounce` starts at zero so the HUD/banner remain hidden during the opening deal. `src\render\OpeningDeal.tsx` calls `beginDrawPhase()` after the five-card opening deal completes.

`Card.continuous?: boolean` was added, with B3 (`Tempest Weaver`) and B4 (`Astral Archon`) marked continuous in `CARD_LIBRARY`.

#### Store constants and actions (`gameStore.ts`)

| Symbol | Value / role |
|---|---|
| `HAND_TARGET` | 6 cards |
| `DRAW_PHASE_DWELL_MS` | 900 ms after Draw entry/draw animation before Main |
| `DICE_SIDES` | 20 |
| `DICE_ROLL_MS` | 800 ms tumble |
| `DICE_HOLD_MS` | 600 ms settled display |
| `RESOLUTION_ROLL_DELAY_MS` | 1700 ms, matched to the phase banner duration |
| `beginDrawPhase()` | enters Draw and starts the Draw entry effect |
| `advancePhase()` | Main→Battle→Resolution, End→next Draw |
| `toggleAttacker(slotId)` | Battle-only A-slot attacker selection |

Internal helpers:

- `goToPhase(next, incTurn)` centralizes phase mutation, `phaseAnnounce`, turn increment, and entry effects.
- `beginResolution()` rolls one D20 per attacker and schedules settle/End.
- `runEndPhase()` shuffles replen into deck and discards non-continuous B cards.

#### Phase behavior

| Phase | Entry behavior | Exit behavior |
|---|---|---|
| Draw | Draw until hand has 6, or draw 1 if already 6+ | Auto-advances to Main |
| Main | None | User clicks Next Phase to Battle |
| Battle | None | User clicks Next Phase to Resolution |
| Resolution | After banner delay, roll all declared attackers | Auto-advances to End |
| End | Replen→deck; non-continuous B cards→graveyard; clear attackers/dice | User clicks End Turn to next Draw and increments turn |

`dropCard()` now requires `s.phase === 'main'` in addition to existing placement rules.

---

### Layer 2: Board Rules and Pointer Resolution (`src\board\slotRules.ts`)

Phase 4 added three rule helpers:

| Function | Purpose |
|---|---|
| `resolveLinkedTarget(board, rawSlot, cardType)` | For A/C drags, hovering either A or C side of a column resolves to the dragged card's own-type slot if legal |
| `resolveAttackerSlot(board, slot)` | For Battle clicks, either A or C side of a linked column resolves to the occupied A slot |
| `slotHighlighted(board, slotId, cardType)` | For drag highlighting, lights a whole A/C column when that column can receive the dragged A/C card |

These preserve Phase 3's C-link rule while making interaction forgiving: users can hover/click the linked column, but the authoritative slot remains explicit.

---

### Layer 3: Input (`src\input\PointerControls.tsx`)

The pointer pipeline remains DOM-driven from Phase 1, but Phase 4 records more information per press:

- `Press.slotId` stores the board slot under pointer-down, even for empty-slot presses.
- During drag, `resolveLinkedTarget()` converts the raw hovered A/C zone into the true placement slot.
- During Battle click release, `resolveAttackerSlot()` converts either side of an occupied A/C column into an A-slot attacker.
- The old deck-click draw branch is removed. Deck drawing is now controlled by Draw phase and card abilities.

Placed cards still cannot be dragged back from the board.

---

### Layer 4: Render and UI

#### `TurnHud.tsx`

DOM overlay mounted from `src\app\App.tsx`. Shows:

- turn number;
- ordered phase list from `PHASE_ORDER`;
- active phase using `PHASE_LABEL`;
- Next Phase / End Turn button.

The button is disabled during Draw and Resolution because both auto-advance.

#### `PhaseBanner.tsx`

DOM overlay mounted from `src\app\App.tsx`. It keys the banner by `phaseAnnounce`, so each phase entry remounts the animated element. The CSS animation slides right → center hold → left over 1700 ms.

#### `SlotView.tsx`

Slot highlight now combines:

- drag-time placement highlight from `slotHighlighted()`;
- attack declaration highlight for A/C linked columns whose A slot is in `attackers`.

Attack highlights show during Battle and Resolution and clear on End.

#### `ResolutionDice.tsx`

R3F scene component mounted from `src\render\GameScene.tsx`.

For each key in `resolutionRolls`:

1. Find the attacker's A slot in `SLOT_POSITIONS`.
2. Find the linked C slot by column index.
3. Place the die at the A/C midpoint with a small y/z offset.
4. While `rolling`, spin an icosahedron and cycle the visible number.
5. When settled, slerp the die so the face most aligned with the camera direction becomes flat-on.
6. Display the stored value with a drei `Billboard` text label.

---

## File Structure Changes (Phase 4 additions/modifications)

```text
src/
  state/
    types.ts            ← CHANGED: Phase, PHASE_ORDER/LABEL, DiceState, turn fields, attackers, rolls, Card.continuous
    cardData.ts         ← CHANGED: B3/B4 continuous; initial turn/phase/roll state
    gameStore.ts        ← CHANGED: phase machine, Draw/Resolution/End entry effects, Main-only drops, attacker toggling
    gameStore.test.ts   ← CHANGED: phase, End cleanup, attacker, and Resolution tests
  board/
    slotRules.ts        ← CHANGED: linked A/C drag/attack helpers
    slotRules.test.ts   ← CHANGED: linked target/highlight/attacker rules
  input/
    PointerControls.tsx ← CHANGED: linked drag target, Battle attacker click, no deck-click draw
  render/
    GameScene.tsx       ← CHANGED: mounts ResolutionDice
    OpeningDeal.tsx     ← CHANGED: triggers first Draw phase after opening deal
    ResolutionDice.tsx  ← NEW: in-scene per-attacker D20 renderer
    SlotView.tsx        ← CHANGED: attack highlights plus drag highlights
  cards/
    CardView.tsx        ← CHANGED: continuous B-card badge
  ui/
    PhaseBanner.tsx     ← NEW: phase transition DOM overlay
    TurnHud.tsx         ← NEW: turn/phase HUD and phase advance button
  app/
    App.tsx             ← CHANGED: mounts TurnHud and PhaseBanner
```

---

## Testing Patterns

Phase 4 expanded fake-timer store coverage in `src\state\gameStore.test.ts`:

- Draw phase fills to six and auto-advances.
- Draw phase draws exactly one if already at/above target.
- `advancePhase()` steps Main → Battle → Resolution → End and End → next Draw.
- Draw is a no-op for manual `advancePhase()`.
- End discards non-continuous B cards and keeps continuous B cards.
- End shuffles replen into deck.
- Drops outside Main are blocked.
- `toggleAttacker()` selects/deselects only occupied A slots during Battle.
- Resolution rolls one value per attacker, writes `lastRolls`, settles, clears transient dice/attackers on End.
- Resolution with no attackers still advances to End.

`src\board\slotRules.test.ts` covers:

- `resolveLinkedTarget()` for A/C drag surfaces;
- `slotHighlighted()` for whole-column A/C highlights;
- `resolveAttackerSlot()` for Battle clicks.

Current validation after docs:

- `npx vitest run` — 127 tests passed, 11 files passed.
- `npx tsc --noEmit` — clean.

---

## Known Limitations and Tech Debt

| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | **No Player 2 / active player** | By design | Turn engine is single-sided; add active-player ownership before mirrored combat. |
| 2 | **Dice rolls do not affect combat yet** | By design | `lastRolls` records values for future rules; no damage/win state consumes them in Phase 4. |
| 3 | **Roll history lifetime is undefined** | Medium | `lastRolls` persists after End. Decide whether future rules clear it per Resolution, per turn, or keep a combat log. |
| 4 | **Banner timing is duplicated by convention** | Low | `RESOLUTION_ROLL_DELAY_MS` in `gameStore.ts` matches `ANIM_MS` in `PhaseBanner.tsx`; a shared constant would remove drift risk. |
| 5 | **End cleanup hard-codes B1–B4** | Low | Fine for the current 12-slot board; derive from `SLOT_IDS` if slot families/indices expand. |
| 6 | **Placed cards still cannot be re-dragged** | Phase 1 carry-over | `PointerControls` supports board click inspection/declaration, not board-origin dragging. |
| 7 | **Touch/mobile input not tuned** | Phase 1 carry-over | Pointer interactions are mouse-first. |
