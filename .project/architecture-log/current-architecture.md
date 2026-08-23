# Current Architecture — Everwar Phase 1 Baseline

**Phase:** Phase 1 — Card-handling vertical slice  
**Baseline date:** 2026-08-22  
**Status:** Approved Gate 1 architecture record for Gate 1.5 planning  

Everwar's vision is mutable. This document is a living architecture log and must evolve per phase. Each future feature addition, change, or removal should update the phase history below and the affected seams.

## Phase history

| Phase | Change type | Summary |
|---|---:|---|
| Phase 1 | Added | Baseline browser-first tactile card-handling architecture: deck, hand, dragging, three placement slots, procedural cards, state-driven animation, mouse input only. |

## Architectural principles

- **State is authoritative; animation only visualizes state.** Domain state decides where cards belong. Animation interpolates render transforms toward target poses.
- **Keep layers replaceable.** State, layout math, rendering, animation, and input/raycasting are separate modules with narrow interfaces.
- **Favor normalized data.** Cards, zones, slots, and transient interaction state should be represented by IDs and plain serializable objects, not renderer objects.
- **Write tests first for pure logic.** Draw order, valid-drop rules, slot occupancy, drag state transitions, and fan-layout math are unit/regression tested before render work.
- **Phase-tag everything.** Features and docs must record the phase in which behavior was added, changed, or removed.

## Proposed `src\` module layout

```text
src\
  app\
    App.tsx                 # Phase 1 app shell, providers, scene mount
  state\
    gameStore.ts            # Zustand store; authoritative deck/hand/board/dragging state
    actions.ts              # Pure/action helpers where practical
    selectors.ts            # Derived state for render/input, no Three.js imports
    types.ts                # Domain types: CardId, SlotId, Zone, DragState
  cards\
    cardData.ts             # Phase 1 generated placeholder cards 1-10
    CardView.tsx            # Mesh composition for a card, render-only
    cardGeometry.ts         # Procedural beveled card geometry/material helpers
  board\
    boardConfig.ts          # Slot IDs, board/deck/hand anchor positions, plane constants
    slotRules.ts            # Pure valid-drop and occupancy rules
    layout.ts               # Pure deck stack, hand fan, slot target-pose math
  scene\
    GameScene.tsx           # R3F scene composition
    BoardView.tsx           # Playmat, slot markers, deck zone visuals
    DeckView.tsx            # Deck stack rendering and deck click target
    HandView.tsx            # Hand card views driven by layout selectors
    SlotView.tsx            # Board slot visual/highlight rendering
    camera.ts               # Phase 1 fixed angled camera/light presets
  animation\
    MotionCard.tsx          # Tween/spring wrapper around target card poses
    motionConfig.ts         # Timing/easing constants
    poseSelectors.ts        # Maps state + layout to visual target poses
  input\
    PointerController.tsx   # Pointer event wiring; converts picks to actions
    dragPlane.ts            # Ray-to-board-plane projection helpers
    hitTest.ts              # Pure slot hit-testing from projected point
  tests\
    ...                     # Unit/regression tests colocated or mirrored by module
```

## Layer responsibilities and boundaries

| Layer | Single responsibility | Must not know about | Interface boundary |
|---|---|---|---|
| `state\` | Authoritative game/interaction state and actions. | Three.js meshes, springs, DOM events. | Plain IDs, positions, action calls, selectors. |
| `board\` | Pure board constants, slot rules, and layout math. | React components, Zustand internals, animation library. | Pure functions returning occupancy, validity, and target poses. |
| `cards\` | Phase 1 placeholder card visuals/data. | Rules engine, network, slot validity. | `CardId` + render props such as face/back and pose. |
| `scene\` | Compose R3F board, deck, hand, slots, camera, lighting. | Mutation of domain state except through input callbacks/actions. | Subscribe to selectors and render target views. |
| `animation\` | Interruptible interpolation of visual transforms. | Business rules and final state decisions. | Receives target poses, emits only optional visual callbacks. |
| `input\` | Mouse pointer picking, drag-plane projection, slot hover detection. | State mutation details beyond public action API. | Converts pointer events to `beginDrag`, `updateDrag`, `hoverSlot`, `dropCard`. |
| tests | Lock down pure behavior and regression cases. | Browser-only feel judgments. | Vitest for pure modules; rendered verification for R3F feel. |

## Phase 1 authoritative state model

The store should stay serializable and normalized. Phase 1 can expose the spec's simple model while keeping room for richer cards later:

```ts
cardsById: Record<CardId, { id: CardId; number: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 }>
deck: CardId[] // ordered stack, top = last element
hand: CardId[] // ordered left-to-right; drives fan layout
board: Record<SlotId, CardId | null> // slotA, slotB, slotC
dragging: {
  cardId: CardId
  origin: 'hand'
  projectedPoint: Vec3Like
  hoveredSlotId: SlotId | null
} | null
```

### Phase 1 action API

- `drawCard()` — moves the current top deck card into hand; no-op when empty.
- `beginDrag(id)` — starts dragging only for a card currently in hand.
- `updateDrag(pointer)` — records the projected drag position for the active card.
- `hoverSlot(id | null)` — records the currently hovered slot while dragging.
- `dropCard(id, slotId | null)` — if the slot is empty, moves card from hand to board and fills the slot; otherwise routes to return behavior.
- `returnToHand(id)` — cancels drag and leaves the card in its hand order.

State transitions happen immediately and deterministically. The animation layer is responsible for making those transitions look like pop-off draws, snap-ins, smooth returns, and hand reflows.

## Animation approach

**Phase:** Phase 1  

- Use an adapter around `@react-spring/three` or GSAP so components depend on a local motion abstraction, not a global animation API.
- Derive each card's target pose from state via selectors:
  - deck card pose from deck index;
  - hand card pose from fan-layout math;
  - dragging card pose from projected pointer position;
  - board card pose from occupied slot.
- All tweens/springs must be **interruptible**. If a card is grabbed during a reflow, the active card's target switches to dragging pose and the previous tween is cancelled/replaced.
- Motion config lives in `animation\motionConfig.ts` and is phase-tagged so feel changes are tracked without changing business logic.
- Animation must not decide legality. It may request a visual return path after an invalid drop, but state remains the source of the card's zone.

## Input and raycasting approach

**Phase:** Phase 1 — mouse only  

- R3F pointer events identify deck/card meshes by domain IDs stored in render props.
- `PointerController` owns pointer-down/move/up orchestration and calls the public state action API.
- Dragging projects the pointer ray onto a fixed board drag plane from `input\dragPlane.ts`; the projected point is stored as plain coordinates.
- Slot detection uses pure hit-testing against configured slot bounds from `board\boardConfig.ts`.
- Empty-slot highlighting is state/layout driven: when `dragging !== null`, render gold outlines only for slots where `board[slotId] === null`.
- Filled board cards do not register Phase 1 drag-start behavior. Re-pickup is intentionally out of scope.

## Future extension seams

| Future phase capability | Phase 1 seam to extend | Expected localized change |
|---|---|---|
| Re-pickup placed cards | `state\actions.ts`, `board\slotRules.ts`, `input\PointerController.tsx` | Allow `beginDrag` from board origins and clear/refill slots; render stays state-driven. |
| Touch/mobile input | `input\` layer | Add a touch/pointer adapter while preserving action API and hit-test/layout modules. |
| Real card data | `cards\cardData.ts` and `state\types.ts` | Replace generated numbers with loaded card records; `CardView` receives face data without changing zone state. |
| Authored models/art | `cards\CardView.tsx` / `cardGeometry.ts` | Swap procedural mesh for glTF/material assets behind the same `CardId + pose` props. |
| Rules/turn engine | New `rules\` layer between UI intents and state actions | Validate/transform requested moves before committing store mutations. |
| Opponent/multiple zones | `board\boardConfig.ts`, `state\types.ts`, `layout.ts` | Add zone/slot definitions and selectors; scene composes more views. |
| Networking/multiplayer | Store action dispatch boundary | Send intents/events through a sync adapter; keep render/input unaware of transport. |
| Desktop wrapper | App shell/build layer | Wrap Vite app with Tauri/Electron; no state/render rewrite. |
| Audio or particle VFX | New `effects\` layer subscribing to state/action events | Add optional side effects without coupling animation/state. |

## Tech-stack rationale

**Phase:** Phase 1  

- **React + Vite + TypeScript** gives fast browser iteration, typing, and an easy desktop-wrapper path later.
- **Three.js via R3F + drei** supports tactile 3D cards with React composition and practical pointer/raycast integration.
- **Zustand** keeps the authoritative state small, explicit, and easy to test.
- **`@react-spring/three` or GSAP behind an adapter** supports premium, interruptible card motion while remaining replaceable.
- **Vitest** is the natural TDD runner for Vite/TypeScript pure logic and regression tests.

## Key risks and recommended de-risking order

1. **State correctness risk:** draw order, zone transitions, slot occupancy, and invalid-drop behavior. De-risk first with pure Vitest tests.
2. **Layout/math risk:** hand fan and slot hit-testing must be deterministic and independent of rendering. De-risk with pure tests before R3F components.
3. **3D input risk:** pointer ray projection and slot hit-testing can feel off. De-risk with a single draggable card on the board plane.
4. **Animation interruptibility risk:** reflow/draw/drag transitions may fight each other. De-risk with a single card, then hand reflow, then opening deal.
5. **Performance/feel risk:** 60 FPS and premium motion require rendered review. De-risk last with browser verification after the core flow exists.
