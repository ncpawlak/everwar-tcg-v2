# Technical Doc — Everwar Phase 1: Card-Handling Architecture

**Audience:** Coders and Senior Coders  
**Phase:** 1 — Tactile Card Handling Vertical Slice  
**Shipped:** 2026-08-22 · Version 0.2.0  
**Stack:** TypeScript · React + Vite · Three.js / React Three Fiber v8 + drei · Zustand (vanilla) · @react-spring/three · Vitest

---

## Overview

Phase 1 is a motion-only product slice: no game rules, no real card data, no networking.
The goal was to establish a solid, extensible architecture for a 3D card game where
dragging, dealing, and placing cards feel premium. All game rules are explicitly out of
scope.

The result is a four-layer architecture:

```
State (Zustand) → Pose Selectors → Spring Animation → Scene Render
                        ↑
             DOM Input (PointerControls)
```

Each layer has a strict single responsibility and depends only on the layer above it
(toward state), never below it (toward the DOM). This allows any visual detail to change
without touching state, and any state shape change to ripple automatically to visuals.

---

## Layer Decomposition

### Layer 1: Authoritative Game State (`src/state/`)

The Zustand vanilla store is the single source of truth. It never imports from Three.js,
React, or the animation layer. It is pure TypeScript.

**Files:**
- `types.ts` — domain types: `Card`, `CardId`, `SlotId`, `GameState`, `DragState`, `Pose`, `Vec3`
- `cardData.ts` — `createInitialState()` factory; 10 placeholder cards numbered 1–10
- `gameStore.ts` — `createGameStore()` factory; all state transitions as actions
- `useGameStore.ts` — shared singleton + typed `useGameStore` hook for React components

**Actions:**

| Action | Effect |
|---|---|
| `drawCard()` | Pops the top of `deck` into `hand`. No-op if deck is empty. |
| `beginDrag(id)` | Starts a drag for a hand card. Clears `hoveredCardId`. |
| `updateDrag(point)` | Records the board-projected pointer position during a drag. |
| `hoverSlot(id\|null)` | Records the hovered slot ID during a drag (for highlight + drop). |
| `dropCard(id, slotId)` | Valid drop: card moves `hand → board[slotId]`. Invalid: card stays in hand; drag cleared. |
| `returnToHand(id)` | Alias for cancelling a drag without a drop. |
| `hoverCard(id\|null)` | Records which hand card the pointer is over (hover-lift hint). Ignored while dragging. |
| `reset()` | Resets to a fresh initial state (used by tests). |

**State shape:**

```typescript
interface GameState {
  cardsById: Record<CardId, Card>;  // static card definitions
  deck: CardId[];                    // ordered; top card is LAST element
  hand: CardId[];                    // ordered left-to-right
  board: Record<SlotId, CardId | null>;
  dragging: DragState | null;
  hoveredCardId: CardId | null;
}
```

**Test isolation:** `createGameStore()` is a factory; each test creates its own
independent store instance. The shared singleton in `useGameStore.ts` is used only by
the React app.

---

### Layer 2: Board Layout and Pose Math (`src/board/`)

Pure functions mapping state indices/IDs to renderer-neutral target poses. Zero Three.js
scene dependency (though Three.js math types are used internally for the vector
calculations).

**Files:**
- `boardConfig.ts` — all world-space constants: camera position/FOV, card dimensions,
  slot positions, deck anchor, hand anchor, fan tuning parameters
- `layout.ts` — `deckCardPose(indexFromBottom)`, `handCardPoses(count)`, `slotCardPose(slotId)`
- `slotRules.ts` — `canDrop(board, slotId)` pure drop validation; `getValidSlots(board)`
- `hitTest.ts` — `slotAtPoint(point)` maps a projected world-space point to the nearest
  slot within `SLOT_HIT_RADIUS`, or `null`

**Fan math — the critical algorithm:**

Cards in the hand fan are laid out in the camera's *view plane*, not in world space.
The view-plane basis is computed once at module load:

```typescript
const TO_CAMERA = normalize(CAMERA_POSITION - HAND_ANCHOR)
const RIGHT     = normalize(world_up × TO_CAMERA)   // screen-horizontal
const VIEW_UP   = normalize(TO_CAMERA × RIGHT)        // screen-vertical
```

Each card's world position is then:

```
position = HAND_ANCHOR
         + RIGHT    * (offset * spacing)       // horizontal spread
         - VIEW_UP  * (offset² * ARC_DIP)      // arc dip (outward cards lower)
         + TO_CAMERA * (offset * LAYER_STEP)   // depth layer (painter order)
```

**The key property:** Because `RIGHT` and `VIEW_UP` are both perpendicular to
`TO_CAMERA`, spreading and arcing a card moves it purely within the screen plane and
does NOT change its camera distance. Depth (which card draws on top) is controlled
solely by the `TO_CAMERA * LAYER_STEP` term. This guarantees strict right-over-left
occlusion — the card to the right is always in front of the card to its left — at any
hand size, arc depth, or camera angle.

**Fan rotation:** Each card faces the camera via `FACE_CAMERA_Q` (a quaternion from
+Z to TO_CAMERA), then rolls about the view axis by `−offset * HAND_TILT_PER_CARD` so
the splay stays visually in-plane. Because every card is a plane facing the camera,
layering them along the view axis produces clean stack overlap.

---

### Layer 3: Pose Selectors and Spring Animation (`src/animation/`)

**Files:**
- `poseSelectors.ts` — `selectCardVisual(state, cardId, hoveredCardId)`: the single
  function that maps game state to a card's visual target (pose + faceUp + zone + spring config)
- `MotionCard.tsx` — a `@react-spring/three` wrapper that interpolates toward a target
  `Pose` with a given spring config
- `motionConfig.ts` — centralized spring configs (`SPRING.hand/draw/drag/snap`) and
  scalar constants (`DRAG_LIFT`, `OPENING_DEAL_STAGGER_MS`)

**Pose selector priority (in order):**
1. **Board** — card occupies a slot → `slotCardPose(slotId)`, face up, `SPRING.snap`
2. **Dragging** — card is the active drag → pointer's projected point at `DRAG_LIFT` height, `SPRING.drag`
3. **Hand** — card is in hand → `handCardPoses(count)[index]` ± hover lift, `SPRING.hand`
4. **Deck** — fallback → `deckCardPose(deckIndex)`, face down, `SPRING.draw`

**Hover lift:** When `hoveredCardId === cardId`, the hand pose is offset by
`FAN_UP * CARD_HEIGHT * 0.5`. `FAN_UP` (= `VIEW_UP` exported from `layout.ts`) ensures
the lift is straight up on screen, not in world Y, regardless of fan tilt.

**Interruptibility:** `@react-spring/three`'s `useSpring` retargets on any prop change.
Changing the target pose (e.g., grabbing a card mid-reflow) smoothly interpolates from
the current animated position to the new target — no teleport, no visual glitch.

**Spring profiles (in `motionConfig.ts`):**

| Profile | Mass | Tension | Friction | Used for |
|---|---|---|---|---|
| `hand` | 1 | 190 | 24 | Reflow, settle in hand |
| `draw` | 1 | 130 | 18 | Pop off deck (looser, heavier) |
| `drag` | 0.6 | 420 | 30 | Following pointer (snappy) |
| `snap` | 1 | 320 | 26 | Drop into slot / return to hand |

---

### Layer 4: Scene and Render (`src/render/`, `src/cards/`, `src/app/`)

**Files:**
- `App.tsx` — R3F Canvas shell with fixed perspective camera; mounts `GameScene` and
  `PointerControls` (the latter is outside the canvas, in DOM space)
- `GameScene.tsx` — R3F scene composition: lights, `BoardView`, `SlotView`, one
  `CardEntity` per card, `OpeningDeal`, `ThreeBridge`
- `CardEntity.tsx` — purely presentational; reads state → calls `selectCardVisual` →
  renders `MotionCard > CardView`; no pointer handlers
- `CardView.tsx` — procedural beveled card mesh (thin box, rounded impression, front
  number, distinct back)
- `BoardView.tsx` — playmat mesh
- `SlotView.tsx` — renders the three slot indicators; subscribes to `dragging` and
  `board` state to show/hide gold outlines
- `OpeningDeal.tsx` — `useEffect` that fires 5 staggered `drawCard()` calls on mount
  (450 ms initial delay, 260 ms stagger); guarded against StrictMode double-invocation
- `ThreeBridge.tsx` — in-canvas component; reads `useThree` and writes `camera` and
  `gl.domElement` to `threeAccess.ts` for the DOM input layer

---

## DOM Input Architecture (Permanent Project Constraint)

**R3F's `onPointer*` synthetic events do not fire reliably in the Copilot embedded
canvas runtime. Do not use them. This is a permanent project constraint.**

Instead, all input goes through:

```
window.pointerdown/move/up
       ↓
PointerControls.tsx    (DOM component, outside the canvas)
       ↓
pickMath.ts            (pure raycast helpers)
       ↑
threeAccess.ts ← ThreeBridge.tsx (inside canvas, reads useThree)
       ↓
gameStore actions      (state transitions only)
```

**`PointerControls.tsx`** — mounts in `App.tsx` as a sibling to the R3F `Canvas`. Uses
`window.addEventListener` for `pointerdown`, `pointermove`, `pointerup`. Renders `null`.

**`threeAccess.ts`** — module-level singleton: `{ camera: Camera|null, canvas: HTMLCanvasElement|null }`. Populated by `ThreeBridge` on mount, cleared on unmount.

**`ThreeBridge.tsx`** — zero-render R3F component inside the scene. Reads `useThree(s => s.camera)` and `useThree(s => s.gl)`, writes them to `threeAccess` in a `useEffect`.

**`pickMath.ts`** — pure raycast helpers:
- `clientToNdc(x, y, canvas)` — client pixels → NDC
- `pickHandIndex(ndc, camera, handPoses)` — returns the front-most hand card index under the pointer, or −1
- `pickDeck(ndc, camera, deckTopPose)` — boolean deck hit
- `projectToBoard(ndc, camera)` — ray → board plane (y = 0) intersection

All picks are computed against **authoritative poses** (from `layout.ts`), not against
live Three.js scene graph object matrices. This means picks are always in sync with state,
never with partially-animated visual positions.

---

## File Structure

```
src/
  app/
    App.tsx                  Canvas shell + PointerControls mount
  board/
    boardConfig.ts           World-space constants (camera, card dims, slots, fan tuning)
    layout.ts                Pure pose math (deck, hand, slot)
    layout.test.ts
    slotRules.ts             Pure drop validation
    slotRules.test.ts
  cards/
    CardView.tsx             Beveled card mesh (presentational only)
  input/
    PointerControls.tsx      DOM-level window listeners → store actions
    pickMath.ts              Raycast helpers (NDC, card pick, board projection)
    threeAccess.ts           Camera/canvas bridge singleton
    hitTest.ts               Slot hit-testing (point → slotId | null)
    hitTest.test.ts
  animation/
    MotionCard.tsx           @react-spring/three pose interpolation wrapper
    motionConfig.ts          Spring configs + scalar constants (phase-tagged)
    poseSelectors.ts         State → CardVisual mapping (the "where should this card be?" function)
    poseSelectors.test.ts
  render/
    GameScene.tsx            R3F scene composition
    BoardView.tsx            Playmat mesh
    SlotView.tsx             Slot outlines (gold when valid drag target)
    CardEntity.tsx           One card: reads state → MotionCard > CardView
    OpeningDeal.tsx          Staggered opening draw effect
    ThreeBridge.tsx          Publishes camera+canvas to threeAccess
  state/
    types.ts                 Domain types (pure TS)
    cardData.ts              createInitialState(), card generation
    cardData.test.ts
    gameStore.ts             Zustand vanilla store + actions
    gameStore.test.ts
    useGameStore.ts          Shared singleton + useGameStore hook
  main.tsx                   React entry point
  smoke.test.ts              Module-level smoke test
```

---

## Testing Patterns

**32 tests total, all in Vitest.**

- **State tests** (`gameStore.test.ts`) — call `createGameStore()` directly for
  isolation; assert state shape after each action
- **Layout tests** (`layout.test.ts`) — assert numeric invariants (fan symmetry,
  spacing compression, layer ordering, slot positions)
- **Rule tests** (`slotRules.test.ts`) — exhaustive valid/invalid drop matrix
- **Hit-test tests** (`hitTest.test.ts`) — point-in-radius, edge cases, null returns
- **Pose selector tests** (`poseSelectors.test.ts`) — zone routing, hover lift delta
- **Smoke test** (`smoke.test.ts`) — basic module-load sanity

**No rendered/integration tests** — rendered verification is manual browser review per
the Phase 1 taskboard (P1-S19). Vitest runs in a Node environment without a real DOM
or WebGL context; anything requiring scene rendering is out of scope for the unit suite.

---

## Known Limitations and Tech Debt

| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | **Placed cards cannot be re-dragged** | Low (Phase 1 intentional) | Phase 1 scope decision; re-drag will need `beginDrag` to accept board-origin cards. |
| 2 | **Raycasting against authoritative poses, not animated positions** | Low | Picks are computed against the *target* pose, which may differ from the visually animated position during a spring. For most cases this is imperceptible; fast drags immediately after a reflow could feel slightly off. |
| 3 | **`CardEntity` subscribes to the whole state** | Low | `useGameStore(s => s)` will re-render on any state change. Acceptable for 10 cards; needs `useShallow` or per-field selectors if the state shape grows significantly. |
| 4 | **No touch/mobile input** | Low (Phase 1 scope) | `PointerControls` uses Pointer Events API which works for touch, but the hit areas and UX are not tuned for touch. |
| 5 | **No real card data, art, or rules** | By design | Phase 1 is placeholder-only. |
| 6 | **`CardView` is a primitive box mesh** | By design | Placeholder geometry; Phase 2+ will introduce real card art. |
