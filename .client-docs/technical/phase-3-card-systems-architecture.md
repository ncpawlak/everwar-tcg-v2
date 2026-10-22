# Technical Doc — Everwar Phase 3: Card Systems Architecture

**Audience:** Coders and Senior Coders  
**Phase:** 3 — Advanced Card Systems  
**Shipped:** 2026-08-22 · commits `2b63640` → `f15d8fc`  
**Stack:** TypeScript · React + Vite · Three.js / React Three Fiber v8 + drei · Zustand (vanilla) · @react-spring/three · Vitest  
**Build health:** `npx vitest run` green (127 tests, 11 files — current suite includes later uncommitted Phase 6 work) · `npx tsc --noEmit` green

---

## Overview

Phase 3 adds card identity, inspection, piles, support buffs, ability cards, and summon feedback on top of the Phase 2 typed board.

The architectural spine remains unchanged:

```text
State (Zustand) → Pose Selectors → Spring Animation → Scene Render
                        ↑
             DOM Input (PointerControls)
```

Most Phase 3 changes are in:

- **State:** richer `Card`, new piles, transient animation flags, mechanic actions.
- **Rules:** C placement gating and effective stat calculation.
- **Render/UI:** DOM inspection/search/control overlays, 3D stat plates, summon ripple.
- **Animation selectors:** new graveyard/replen/shuffle/summon visual zones.

---

## Layer 1: Authoritative Game State (`src\state\`)

### Card model (`types.ts`)

Phase 3 expands cards from type markers into swappable gameplay records:

```typescript
export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';
export type StatKey = 'hp' | 'atk' | 'def';
export type BAbility = 'draw1' | 'graveyardIntoDeck' | 'replenIntoDeck' | 'draw2';

export interface StatBuff {
  stat: StatKey;
  amount: number;
}

export interface Card {
  id: CardId;
  type: CardType;
  name: string;
  cost: number;
  atk?: number;
  def?: number;
  hp?: number;
  rarity: Rarity;
  effect: string;
  flavor: string;
  buff?: StatBuff;
  ability?: BAbility;
}
```

Important convention: the type-specific fields are optional, but the data library uses them by family:

- A cards: `hp`, `atk`, `def`
- B cards: `ability`
- C cards: `buff` only after placement

`B_ABILITY_LABEL` lives next to `BAbility` so UI labels and action dispatch use the same vocabulary.

### Game state additions

```typescript
graveyard: CardId[];
replen: CardId[];
deckSpread: boolean;
selectedCardId: CardId | null;
pileSearch: PileSource | null;
summon: SummonState | null;
```

- `graveyard` and `replen` are ordered piles.
- `deckSpread` drives the temporary two-pile shuffle pose.
- `selectedCardId` drives `InspectionPanel`.
- `pileSearch` drives `PileSearchModal`.
- `summon` drives the summon showcase.

### Store actions (`gameStore.ts`)

Phase 3 store actions fall into four groups:

| Group | Actions |
|---|---|
| Selection/search | `selectCard`, `openPileSearch`, `closePileSearch` |
| Zone-to-pile | `destroyZoneA`, `destroyZoneB`, `replenZoneA`, `disturbDeck` |
| Shuffle/gather | `shuffleDeck`, `replenIntoDeck`, `graveyardIntoDeck`, `handIntoDeck` |
| Placement effects | `dropCard`, `drawStaggered`, `enactBAbility` |

`dropCard` is the most important Phase 3 action:

1. Validates through `canDrop`.
2. If placing a C card, rolls `rollCBuff()` and stores it on that card.
3. Moves the card from hand to board synchronously.
4. Sets transient `summon`.
5. After `SUMMON_SHOWCASE_MS`, clears `summon`.
6. If the card is B-type, resolves `enactBAbility`.

The board state changes immediately; only visual showcase and B ability timing are delayed.

---

## Layer 2: Rules and Pure Mechanics

### Placement rules (`src\board\slotRules.ts`)

Phase 2's empty+type gate became `slotPlaceable`:

```typescript
slotPlaceable(board, slotId, cardType)
```

The policy is:

- slot must be empty
- slot type must match card type
- if the target is a C slot, the linked A slot must be occupied

`validTargetSlots` and `canDrop` both delegate to `slotPlaceable`, so drag highlight and store validation still cannot disagree.

### Combat stat calculation (`src\state\combatStats.ts`)

`combatStats.ts` is the pure rule module for A/C support:

| Symbol | Purpose |
|---|---|
| `STAT_KEYS` | legal boost targets: HP, ATK, DEF |
| `BUFF_AMOUNTS` | allowed boost magnitudes |
| `linkedCSlot(aSlot)` | maps A slot to linked C slot |
| `rollCBuff(rand)` | rolls stat + amount for a C card |
| `effectiveStats(state, aSlot)` | returns `{ hp, atk, def }` with `{ value, delta }` |

The important design is presence-derived application: a C card may carry a `buff`, but it affects an A card only while that C card is currently in the linked C slot.

### Shuffle (`src\state\shuffle.ts`)

`shuffleArray<T>(input, rand = Math.random)` is a pure Fisher-Yates shuffle helper. Store actions call it after the short `deckSpread` animation window.

---

## Layer 3: Pose Selectors and Animation

### Visual zones (`src\animation\poseSelectors.ts`)

`CardVisualZone` now includes:

```typescript
'deck' | 'hand' | 'dragging' | 'board' | 'graveyard' | 'replen' | 'summon'
```

Selector priority:

1. `summon`
2. board
3. dragging
4. hand
5. graveyard
6. replenish
7. deck

This order is load-bearing. During a summon reveal, the card is already on the board in state, but the summon branch wins first; once the timer clears, the same card falls through to the board branch and springs to its slot.

### Layout additions (`src\board\layout.ts`)

| Function / constant | Purpose |
|---|---|
| `pileCardPose(anchor, index)` | shared face-up stack pose |
| `graveyardCardPose(index)` | GRAVE pile pose |
| `replenCardPose(index)` | REPLEN pile pose |
| `deckSpreadPose(index)` | temporary split-pile shuffle pose |
| `SUMMON_SHOWCASE_POSITION` | centered showcase card position |
| `SUMMON_SHOWCASE_SCALE` | large reveal scale (`2.4`) |
| `summonShowcasePose()` | showcase pose facing the camera |

`motionConfig.ts` adds `SPRING.summon` plus `MULTI_DRAW_STAGGER_MS = 200`.

### Timed animation pattern

Phase 3 established this pattern:

1. Set transient store state (`deckSpread`, `summon`).
2. Pose selector chooses a special pose.
3. Spring animates to that pose.
4. A guarded `setTimeout` clears the transient state.
5. Selector falls through to the normal pose.

This is used for shuffle and summon reveal.

---

## Layer 4: Scene Render and DOM UI

### 3D card face (`src\cards\CardView.tsx`)

`CardView` now receives the full `Card` object.

Footer behavior:

- A: HP, ATK, DEF
- B: `B_ABILITY_LABEL[card.ability]`
- C: rolled boost text if present, otherwise generic boost hint

`src\cards\cardTheme.ts` holds shared type/rarity colors.

### Stat overlays

`AZoneStats` scans `A1..A4`. For each occupied A slot it:

- computes the midpoint between the A slot and linked C slot
- calls `effectiveStats`
- renders `StatOverlay`
- suppresses the overlay while that A card is in summon reveal

`StatOverlay` is a drei `Billboard` with an HP bar and stacked ATK/DEF text. Neutral values are grey; boosted values are green; reduced values are red.

### Summon ripple

`SummonRipple` renders only while `state.summon` is non-null. It places two delayed gold rings at `SUMMON_SHOWCASE_POSITION`, animated with `useSpring`.

### DOM overlays

| Component | Purpose |
|---|---|
| `InspectionPanel` | left-side card detail panel |
| `DevControls` | temporary mechanic buttons |
| `PileSearchModal` | reusable deck/graveyard/replen browser |

All are DOM UI and carry `data-ui-overlay` so `PointerControls` ignores their events.

---

## Input Layer (`src\input\`)

`PointerControls` was rewritten from pointer-down drag to a gesture model:

- on pointer down: record possible target
- on move: if movement exceeds `DRAG_THRESHOLD_PX`, begin drag
- on pointer up under threshold: treat as click
- on pointer up after drag: call `dropCard`

New helpers:

- `exceededDragThreshold()` in `pickMath.ts`
- `boardCardAt()` in `hitTest.ts`

This enables click-to-inspect without breaking drag-to-place.

---

## File Structure Changes (Phase 3 additions/modifications)

```text
src/
  animation/
    motionConfig.ts       ← CHANGED: summon spring, multi-draw stagger
    poseSelectors.ts      ← CHANGED: graveyard/replen/summon/deckSpread zones
  app/
    App.tsx               ← CHANGED: mounts inspection panel and dev controls
  board/
    layout.ts             ← CHANGED: pile poses, deck spread, summon pose
    slotRules.ts          ← CHANGED: C linked-A placement gate
  cards/
    CardView.tsx          ← CHANGED: rich type-specific card face
    cardTheme.ts          ← ADDED: shared type/rarity colors
  input/
    PointerControls.tsx   ← CHANGED: click-vs-drag gesture model
    hitTest.ts            ← CHANGED: board-card picking
    pickMath.ts           ← ADDED: drag threshold helper
  render/
    AZoneStats.tsx        ← ADDED: occupied A-slot stat overlays
    StatOverlay.tsx       ← ADDED: HP/ATK/DEF billboard plate
    SummonRipple.tsx      ← ADDED: summon reveal ripple
    CardEntity.tsx        ← CHANGED: passes full Card
    GameScene.tsx         ← CHANGED: mounts stat/ripple overlays
    SlotView.tsx          ← CHANGED: highlight uses slotPlaceable
  state/
    cardData.ts           ← CHANGED: full card library and new initial state
    combatStats.ts        ← ADDED: C boost + effective stat rules
    gameStore.ts          ← CHANGED: Phase 3 actions and transient timers
    shuffle.ts            ← ADDED: pure shuffle helper
    types.ts              ← CHANGED: card schema, piles, summon/search state
  ui/
    DevControls.tsx       ← ADDED: temporary mechanic controls
    InspectionPanel.tsx   ← ADDED: card detail overlay
    PileSearchModal.tsx   ← ADDED: reusable pile browser
```

Test files were added/expanded for card data, pick math, hit testing, slot rules, layout, pose selectors, combat stats, shuffle, and store behavior.

---

## Testing Patterns

Phase 3's historical close checkpoint recorded **89 passing tests** at `f15d8fc`.

Close-out verification was intentionally run against the current worktree:

- `npx vitest run` — **127 tests passed** across **11 files**
- `npx tsc --noEmit` — clean

The larger current count reflects later uncommitted Phase 6 changes.

Notable Phase 3 test patterns:

| Area | Pattern |
|---|---|
| Click vs drag | threshold math tested independently in `pickMath.test.ts` |
| Piles | store actions assert source/destination arrays |
| Shuffle | fake timers assert spread state and post-timeout randomization |
| C boosts | pure `combatStats.test.ts` covers rolls and effective stats |
| Summon | fake timers assert transient state clears |
| B abilities | fake timers assert delayed/staggered ability resolution |

---

## Known Limitations and Tech Debt

| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | No turn/phase model | High for next phase | Phase 3 mechanics are driven by temp buttons and can be used anytime. Phase 4 should introduce turn structure. |
| 2 | No current HP/damage state | Medium | A cards have max HP; `StatOverlay` accepts `currentHp`, but damage does not exist yet. |
| 3 | B abilities are a switch, not a rules engine | Medium | Fine for four abilities; future card scripts need a better effect model. |
| 4 | Destroy/replen target choice is random | Low | Temporary mechanic controls choose random occupied slots. Real gameplay will need target selection. |
| 5 | Vite watcher can serve stale modules on Windows | Medium | Use the documented restart/fetch-verify workflow before browser review. |
| 6 | Single-player only | By design | No opponent/player ownership exists yet; Phase 4/5 must account for it. |
