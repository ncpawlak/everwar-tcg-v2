# Technical Doc — Everwar Phase 2: Game Board Architecture

**Audience:** Coders and Senior Coders  
**Phase:** 2 — Typed Multi-Zone Game Board Setup  
**Shipped:** 2026-08-22 · Version 0.3.0  
**Stack:** TypeScript · React + Vite · Three.js / React Three Fiber v8 + drei · Zustand (vanilla) · @react-spring/three · Vitest

---

## Overview

Phase 2 replaces the three generic placement slots with a typed 12-slot player field and
introduces card-type placement rules. No new rendering technology was added; the Phase 1
four-layer architecture absorbed all changes cleanly.

```
State (Zustand) → Pose Selectors → Spring Animation → Scene Render
                        ↑
             DOM Input (PointerControls)
```

The primary changes were in **Layer 1** (types, deck, drop rules) and **Layer 4** (slot
rendering, card scale), with minimal surface area touched in Layers 2 and 3.

---

## What Changed Per Layer

### Layer 1: Authoritative Game State (`src/state/`)

#### New domain types (`types.ts`)

```typescript
/** Card/slot type family. */
export type CardType = 'A' | 'B' | 'C';

/** Column index within a type family (1-based, 4 per family). */
export type SlotIndex = 1 | 2 | 3 | 4;

/**
 * Slot identifier — template literal so the accepted type is derivable from
 * the id itself. No parallel type map needed.
 */
export type SlotId = `${CardType}${SlotIndex}`;

/** Derive the accepted card type from a slot id (reads [0]). */
export function slotType(slotId: SlotId): CardType {
  return slotId[0] as CardType;
}

/** Phase 2 placeholder card — a typed cream card. */
export interface Card {
  id: CardId;
  type: CardType;  // NEW in Phase 2
}
```

**Key design:** `SlotId` is a discriminated template literal. `slotType('A3')` returns `'A'`
without a lookup table. TypeScript's type narrowing confirms the result is a `CardType`.

#### Deck generation (`cardData.ts`)

| Constant | Value | Purpose |
|---|---|---|
| `CARD_TYPES` | `['A','B','C']` | Canonical type order |
| `SLOTS_PER_TYPE` | `4` | Slots/cards per family |
| `DECK_SIZE` | `12` | Total cards (4 × 3) |
| `OPENING_HAND_SIZE` | `5` | Cards auto-dealt on load |
| `SLOT_IDS` | All 12 slot ids | Iteration order for rules/highlights |

`createInitialCards()` generates cards interleaved (`A1,B1,C1,A2,B2,C2,…`) so the top 5
of the deck form a mixed-type opening hand, not four of one type.

`createEmptyBoard()` produces `{ A1: null, …, C4: null }` — all 12 slots null.

#### Store actions (`gameStore.ts`)

The `GameState.board` record shape changed from `Record<'slotA'|'slotB'|'slotC', CardId|null>`
to `Record<SlotId, CardId|null>` (12 keys). All store actions that reference `board` were
updated accordingly. No new actions were needed; the type system enforced the change.

---

### Layer 2: Board Layout and Slot Rules (`src/board/`)

#### Board geometry (`boardConfig.ts`)

```
Player field layout (world-space top view, z increases toward player):

  A1  C1 | A2  C2 | A3  C3 | A4  C4    ← TOP_ROW_Z = -0.3  (aligns with GRAVE)
     B1  |    B2  |    B3  |    B4      ← BOTTOM_ROW_Z = 0.75 (aligns with DECK/REPLEN)

                                          GRAVE   (2.98, 0, -0.3)
                                          DECK    (2.98, 0,  0.75)
                                          REPLEN  (3.71, 0,  0.75)
```

Four `PAIR_CENTERS_X` values equally space the columns. Within each pair:
- `A` sits at `center − PAIR_HALF_GAP` (0.253 world units left)
- `C` sits at `center + PAIR_HALF_GAP` (0.253 world units right)
- `B` sits at `center` in the bottom row

**Zone alignment rule:** `TOP_ROW_Z` equals `GRAVEYARD_ANCHOR[2]`; `BOTTOM_ROW_Z` equals
`DECK_ANCHOR[2]`. Moving either right-side anchor automatically realigns its row.

**Board card scale:**

```typescript
export const BOARD_CARD_SCALE = 0.72;
export const BOARD_CARD_WIDTH  = CARD_WIDTH  * BOARD_CARD_SCALE;
export const BOARD_CARD_HEIGHT = CARD_HEIGHT * BOARD_CARD_SCALE;
```

All board-space derivatives (slot positions, hit radius) use `BOARD_CARD_*` constants, not
the hand-scale `CARD_*` constants.

**Placeholder zones:**

```typescript
export const PLACEHOLDER_ZONES: ZonePlaceholder[] = [
  { label: 'GRAVE',  anchor: GRAVEYARD_ANCHOR },
  { label: 'REPLEN', anchor: REPLEN_ANCHOR    },
];
```

These are render-only; no state or rules reference them yet.

#### Slot rules (`slotRules.ts`)

Phase 2 replaces the single `canDrop(board, slotId)` with a richer rule set:

| Function | Signature | Purpose |
|---|---|---|
| `isSlotEmpty` | `(board, slotId) → bool` | Occupancy check |
| `slotAcceptsType` | `(slotId, cardType) → bool` | Type-match check (uses `slotType`) |
| `emptySlots` | `(board) → SlotId[]` | All unoccupied slots |
| `validTargetSlots` | `(board, cardType) → SlotId[]` | Empty + type-matching — used by both highlight and drop validation |
| `canDrop` | `(board, slotId\|null, cardType) → bool` | Full validity check (delegates to above) |

**The policy is:** a card may be placed only in an empty slot whose type letter matches the
card's type. There is no adjacency or dependency requirement between A and C in the same column,
and no requirement to fill any slot before another in the same family.

Both `SlotView` (drag highlight) and `gameStore.dropCard` call `validTargetSlots` / `canDrop`.
They cannot disagree.

---

### Layer 3: Pose Selectors and Spring Animation (`src/animation/`)

#### Board card scale (`MotionCard.tsx`)

The scale is applied in the animation layer, not in `CardView` or the store:

```typescript
// MotionCard.tsx (simplified)
const scale = zone === 'board' || zone === 'deck'
  ? BOARD_CARD_SCALE
  : 1;
```

`CardView` geometry is authored at hand scale. `MotionCard` wraps it in a `<group scale={scale}>`.
This preserves the approved hand layout and means scale changes require touching only one file.

#### Pose selector update (`poseSelectors.ts`)

`selectCardVisual` now returns a `zone` discriminant (`'hand' | 'deck' | 'board' | 'drag'`)
alongside the `Pose`. `MotionCard` reads `zone` to select the correct scale. No other changes
to the pose selector priority logic.

---

### Layer 4: Scene and Render (`src/render/`, `src/cards/`)

#### `SlotView.tsx`

Completely rewritten for Phase 2:
- Renders 12 typed slot rings (one per `SLOT_ID`) instead of 3 fixed rings
- Subscribes to `dragging` to derive the dragged card's type
- Calls `validTargetSlots(board, dragCardType)` to compute which slots to highlight
- Renders GRAVE and REPLEN placeholder tiles from `PLACEHOLDER_ZONES` with text labels

**Highlight logic:**

```typescript
// During a drag, only empty slots whose type matches the dragged card glow gold.
const highlightedIds = dragging
  ? new Set(validTargetSlots(board, dragCardType))
  : new Set<SlotId>();
```

#### `CardView.tsx`

The face now renders the card's type letter (`card.type`: `'A'`, `'B'`, or `'C'`) instead of
a numeric id. Cream material and bevel geometry unchanged.

---

## File Structure Changes (Phase 2 additions/modifications)

```
src/
  state/
    types.ts          ← CHANGED: CardType, SlotIndex, SlotId, slotType(), Card.type
    cardData.ts       ← CHANGED: 12-card typed deck, SLOT_IDS, DECK_SIZE constants
    gameStore.ts      ← CHANGED: board typed as Record<SlotId,…>
  board/
    boardConfig.ts    ← CHANGED: 12 slot positions, BOARD_CARD_SCALE, PLACEHOLDER_ZONES
    slotRules.ts      ← CHANGED: validTargetSlots, canDrop(cardType), slotAcceptsType
    slotRules.test.ts ← CHANGED: 12-slot type-gated test matrix
    layout.test.ts    ← CHANGED: 12-slot grid geometry assertions
  animation/
    poseSelectors.ts  ← CHANGED: zone discriminant added to CardVisual
    MotionCard.tsx    ← CHANGED: per-zone scale (BOARD_CARD_SCALE for board/deck)
  render/
    SlotView.tsx      ← CHANGED: 12-slot ring render + type-aware highlight + placeholders
    CardEntity.tsx    ← CHANGED: passes card.type to CardView
  cards/
    CardView.tsx      ← CHANGED: renders type letter on face (was number)
  input/
    hitTest.test.ts   ← CHANGED: 12-slot hit test matrix at board scale
```

No files were added or deleted in Phase 2.

---

## Testing Patterns

**43 tests total (up from 34), all in Vitest.**

New/updated coverage:

| File | New tests |
|---|---|
| `cardData.test.ts` | `SLOT_IDS` completeness, 12-card deck composition, interleaved order |
| `slotRules.test.ts` | Type-gated drop matrix (all 12 slots × all 3 card types), `validTargetSlots` shape |
| `hitTest.test.ts` | All 12 slot centers hit, board-scale radius boundary, adjacent-slot no-bleed |
| `layout.test.ts` | Top-row z = `GRAVEYARD_ANCHOR[2]`, bottom-row z = `DECK_ANCHOR[2]`, pair-center symmetry |
| `poseSelectors.test.ts` | Zone discriminant returned correctly for board/deck/hand/drag |
| `gameStore.test.ts` | Type-mismatched drop rejected, type-matched drop accepted, all 12 slots fillable |

All Phase 1 tests continue to pass unchanged. The `slotRules.test.ts` matrix was the largest
change: exhaustive valid/invalid type combinations for all 12 slots replace the old 3-slot
matrix.

---

## Known Limitations and Tech Debt

| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | **GRAVE and REPLEN have no behavior** | Low (Phase 2 intentional) | Placeholder render only. Phase 3 will add graveyard discard and replen draw actions. |
| 2 | **Placed cards cannot be re-dragged** | Low (Phase 1 carry-over) | `beginDrag` still only accepts hand-origin cards. |
| 3 | **No P2 / opponent mirror** | By design | Phase 2 scopes only Player 1's side. The board config is designed to be mirrored: negate x and z to get P2 positions. |
| 4 | **`CardEntity` still subscribes to the whole state** | Low | Acceptable for 12 cards; will need `useShallow` selectors at 30+ entity scale. |
| 5 | **Camera clearance is a manual visual gate** | Low | "Hand-raised card clears the B row" is verified by screenshot, not by a unit assertion. A snapshot/rendered test could formalize this in Phase 3. |
| 6 | **Touch/mobile input not tuned** | Low (Phase 1 carry-over) | Hit areas sized for pointer; touch UX not validated. |
