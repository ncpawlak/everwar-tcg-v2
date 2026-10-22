# Technical Doc — Everwar Phase 6: Opponent Board + Tribute Architecture

**Audience:** Coders and Senior Coders  
**Phase:** 6 — Opponent Mirror, Stat Presentation, Tribute Summoning  
**Shipped:** 2026-08-23 · Version 0.7.0  
**Stack:** TypeScript · React + Vite · Three.js / React Three Fiber v8 + drei · Zustand (vanilla) · @react-spring/three · Vitest

---

## Overview

Phase 6 extends the existing architecture in two directions:

1. **Presentation/board scale:** a mirrored opponent field, opponent animations, stat-tag redesign, and camera/spacing retune.
2. **Rules/state scale:** A-card summon levels, exact-sum tribute summoning, a Commander special case, and replen-routed shuffle semantics.

The same core pipeline remains intact:

```text
State (Zustand) → Pose Selectors → Spring Animation → Scene Render
                        ↑
             DOM Input (PointerControls)
```

No new rendering framework or state framework was introduced.

---

## What Changed Per Layer

### Layer 1: Authoritative Game State (`src\state\`)

#### Card model (`types.ts`)

`Card` now supports A-card summon metadata:

```typescript
interface Card {
  level?: number;
  commander?: boolean;
}
```

- `level` is used by A-cards only.
- Levels 1–2 set freely.
- Level 3 requires tribute materials totaling exactly 3.
- `commander` marks an A-card that uses tribute rules but sends materials to graveyard.

`GameState` adds:

```typescript
pendingTribute: PendingTribute | null;
opponentGraveyard: CardId[];
```

`pendingTribute` is the modal handshake state for level-3/Commander placement. `opponentGraveyard` keeps defeated opponent cards alive so they can travel to the opponent graveyard.

#### Card data (`cardData.ts`)

Phase 6 card data changes:

| Item | Value |
|---|---|
| A-card levels | Ashborne 2, Emberfang 2, Ironclad 1, Warcry 3 |
| Commander id | `card-A5` |
| Commander name | Aurelian Warlord |
| Commander stats | 2600 DMG / 180 ACC / 2500 HP |
| Deck size | 13 |
| Deck composition | A:5, B:4, C:4 |

`COMMANDER_CARD` and `COMMANDER_ID` are exported from `src\state\cardData.ts`. The Commander is appended to the deck, making it part of `createInitialCards()`.

#### Store actions (`gameStore.ts`)

New or changed actions:

| Action | Phase 6 behavior |
|---|---|
| `dropCard(cardId, slotId)` | Uses `canDropCard(...)`; tribute-required cards open `pendingTribute` instead of placing immediately. |
| `autoPlaceCard(cardId)` | Uses the same tribute path as drag/drop. |
| `confirmTributeSummon(materialSlots)` | Revalidates exact-sum A materials, sends selected A + linked C cards to replen or graveyard, clears pending state, then places the summoned card. |
| `cancelTributeSummon()` | Clears pending state; card remains in hand. |
| `graveyardIntoDeck()` | Routes graveyard into replen, shuffled; does not directly mutate deck. |
| `replenIntoDeck()` | Still folds replen into deck and animates shuffle. |
| End-phase entry | Calls `replenIntoDeck()` only when replen is non-empty. |

Opponent destruction now moves defeated opponent ids from `opponentBoard` to `opponentGraveyard` after the outcome/destruction dwell. Resolution holds briefly so the graveyard travel can read before the End banner.

---

### Layer 2: Board Rules and Layout (`src\board\`)

#### Tribute rules (`slotRules.ts`)

Phase 6 adds a card-aware layer over the existing slot rules:

| Function | Purpose |
|---|---|
| `requiresTribute(card)` | True for level-3+ A-cards and Commanders. |
| `boardMaterials(board, cardsById)` | Lists occupied board A-cards with their slot ids and levels. |
| `hasSubsetSum(values, target)` | Exact-sum check for tribute affordability. |
| `canAffordTribute(board, cardsById, card)` | True when material levels can sum exactly to `card.level`. |
| `slotHighlightedForCard(board, cardsById, slotId, card)` | Highlight gate; unaffordable tribute cards show no legal targets. |
| `canDropCard(board, cardsById, slotId, card)` | Drop gate; unaffordable tribute cards cannot be dropped. |

The exact-sum search is brute-force because the current material pool is at most four A-cards.

#### Opponent mirror (`boardConfig.ts`, `layout.ts`)

`boardConfig.ts` adds mirrored opponent geometry:

```typescript
mirrorPoint([x, y, z]) => [-x, y, 2 * MIRROR_CZ - z]
```

Derived opponent constants:

- `OPP_FULL_SLOT_POSITIONS`
- `OPP_SLOT_POSITIONS`
- `OPP_DECK_ANCHOR`
- `OPP_GRAVEYARD_ANCHOR`
- `OPP_REPLEN_ANCHOR`
- `OPP_HAND_ANCHOR`
- `OPP_PLACEHOLDER_ZONES`

`layout.ts` adds:

- `mirrorPose(...)`
- `opponentDeckPose(...)`
- `opponentSlotCardPose(...)`
- `opponentGraveyardCardPose(...)`
- `opponentHandPoses(...)`

Important exception: `opponentHandPoses(...)` translates the player's camera-facing fan instead of mirroring rotation, so opponent hand backs remain visible rather than edge-on.

#### Camera and spacing

`CAMERA_POSITION` is `[0, 9.9, 6.3]`, `CAMERA_TARGET` is `[0, 0, -0.55]`, and `CAMERA_FOV` is `46`. Camera x remains 0, preserving the Phase-2 D4 hand-fan symmetry invariant while flattening the board angle for stat readability.

---

### Layer 3: Pose Selectors and Spring Animation (`src\animation\`)

`src\animation\poseSelectors.ts` adds:

```typescript
selectOpponentCardVisual(state, cardId)
```

It returns:

- `opponentSlotCardPose(slot)` when the card is in `opponentBoard`
- `opponentGraveyardCardPose(index)` when the card is in `opponentGraveyard`
- `null` if the card is not in either location

`src\render\OpponentBoard.tsx` renders each opponent card through `MotionCard`, so state movement produces spring movement.

`src\render\OpponentHand.tsx` uses `MotionCard` with local `dealt` state to animate five visual card backs from `opponentDeckPose(...)` to `opponentHandPoses(...)`.

---

### Layer 4: Scene and Render (`src\render\`, `src\cards\`, `src\ui\`)

#### Opponent field

New files:

```text
src\render\CardBack.tsx
src\render\OpponentField.tsx
src\render\OpponentHand.tsx
```

`OpponentField` renders mirrored furniture: 12 slots, grave/replen placeholders, and a visual deck stack. `OpponentHand` renders the opening draw animation. `OpponentBoard` renders live opponent A-cards, target outlines, and stat overlays.

`GameScene.tsx` mounts:

```text
OpponentField
OpponentHand
OpponentBoard
```

before player card entities and combat overlays.

#### Stat overlays

`src\render\StatOverlay.tsx` now exposes:

- `HpOverlay`
- `DmgAccOverlay`
- `HP_Y_OFFSET`
- `HP_Z_OFFSET`
- `DA_Y_OFFSET`
- `DA_Z_OFFSET`

`AZoneStats.tsx` uses these for player A-cards. `OpponentBoard.tsx` uses the same components for opponent cards. Both are billboarded.

#### Tribute modal

New file:

```text
src\ui\TributeModal.tsx
```

The modal:

- Opens when `pendingTribute` is non-null
- Reads `boardMaterials(...)`
- Tracks selected A-slots locally
- Shows `sum/need`
- Enables confirm only at exact sum
- Calls `confirmTributeSummon(...)`
- Cancels via button, backdrop, or Escape

`src\app\App.tsx` mounts the modal in the DOM UI layer.

#### Card face and inspection

`src\cards\CardView.tsx` now renders `Lv {level}` for A-cards and `★ COMMANDER ★` for Commander cards.

`src\ui\InspectionPanel.tsx` mirrors the same metadata in the larger inspection popup.

---

## File Structure Changes (Phase 6 additions/modifications)

```text
src\
  animation\
    poseSelectors.ts      ← CHANGED: selectOpponentCardVisual
  app\
    App.tsx               ← CHANGED: mounts TributeModal
  board\
    boardConfig.ts        ← CHANGED: camera, mirror constants, opponent anchors
    layout.ts             ← CHANGED: mirrored opponent poses
    slotRules.ts          ← CHANGED: tribute rules and card-aware drop/highlight
    slotRules.test.ts     ← CHANGED: tribute rule coverage
  cards\
    CardView.tsx          ← CHANGED: level badge + Commander tag
  render\
    AZoneStats.tsx        ← CHANGED: split stat-overlay placement
    BoardView.tsx         ← CHANGED: larger two-sided playmat
    CardBack.tsx          ← NEW: shared card-back mesh
    GameScene.tsx         ← CHANGED: mounts opponent field/hand/board
    OpponentBoard.tsx     ← CHANGED: MotionCard opponent cards + upright overlays
    OpponentField.tsx     ← NEW: mirrored opponent furniture/deck
    OpponentHand.tsx      ← NEW: visual opponent opening deal
    SlotView.tsx          ← CHANGED: card-aware tribute highlighting
    StatOverlay.tsx       ← CHANGED: HpOverlay + DmgAccOverlay
  state\
    cardData.ts           ← CHANGED: levels, Commander, 13-card deck
    cardData.test.ts      ← CHANGED: 13-card assertions
    gameStore.ts          ← CHANGED: pending tribute, commander sink, replen reroute
    gameStore.test.ts     ← CHANGED: tribute/commander/replen/end tests
    types.ts              ← CHANGED: level, commander, pendingTribute, opponentGraveyard
  ui\
    InspectionPanel.tsx   ← CHANGED: level + Commander detail
    TributeModal.tsx      ← NEW: material-selection popup
```

---

## Testing Patterns

**127 tests total, 11 files, all in Vitest.**

Key Phase 6 coverage:

| File | Coverage |
|---|---|
| `cardData.test.ts` | 13-card deck, A:5/B:4/C:4 composition |
| `slotRules.test.ts` | Tribute requirement, subset-sum affordability, card-aware highlight/drop |
| `gameStore.test.ts` | Pending tribute flow, confirm/cancel, linked C disposal, Commander materials to graveyard, graveyard→replen reroute, End empty-replen guard, opponent graveyard travel |

Validation run:

```text
npx vitest run      → 127 passed (11 files)
npx tsc --noEmit   → clean
```

---

## Known Limitations and Tech Debt

| # | Issue | Severity | Notes |
|---|---|---|
| 1 | Opponent hand/deck are visual-only | Medium for future AI | `OpponentHand` uses local animation state; promote to store state when opponent turns exist. |
| 2 | Opponent B/C slots are furniture only | By design | The full mirrored board is visible, but opponent behavior is still A-row combat only. |
| 3 | Stat-tag readability remains a manual visual gate | Low | Overlay offsets and camera pitch should be screenshot-checked after visual changes. |
| 4 | "Shuffle into deck" text may hide replen routing | Low | Engine routes through replen; consider copy updates if players are confused. |
| 5 | Commander is metadata, not a new type | Watch item | Correct now; avoid adding a new slot family unless board topology changes. |
| 6 | Camera x is still load-bearing | Low | Phase 6 preserved x=0; horizontal camera pan requires fan-basis refactor. |
