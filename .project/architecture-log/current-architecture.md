# Current Architecture — Everwar

**Current phase:** Phase 1 — Card-handling vertical slice (tactile handling, no game rules)
**Landed:** commit `4da6653`
**Last architecture close-out:** 2026-08-22 (Senior Coder, end-of-Phase-1)
**Build health at close-out:** `npm run typecheck` green · `npx vitest run` green (34 tests, 7 files)

Everwar's vision is mutable. This is a living architecture log and evolves per phase. Every feature addition, change, or removal updates the phase history below and the affected seams. This document now reflects the **actual, as-built** Phase 1 architecture (superseding the Gate-1 proposal that preceded implementation).

## Phase history

| Phase | Change type | Summary |
|---|---:|---|
| Phase 1 | Added | Browser-first tactile card-handling slice: 10-card deck, auto-dealt opening hand of 5, camera-facing hand fan, drag-to-place into 3 board slots, invalid-drop return, procedural cards, state-driven interruptible spring animation. **Input is DOM-driven (not R3F events)** and picking uses a manual raycaster against the live camera. |

## As-built `src\` module layout

```text
src\
  main.tsx                     # React entry; mounts <App/>
  app\
    App.tsx                    # Shell: R3F <Canvas> (fixed angled camera) + <GameScene/> + <PointerControls/> (DOM sibling, OUTSIDE Canvas)
  state\                       # Authoritative, serializable domain state — no Three.js, no React in the core
    types.ts                   # CardId, SlotId, Card, Vec3, Pose, DragState, GameState
    cardData.ts                # SLOT_IDS, DECK_SIZE=10, OPENING_HAND_SIZE=5, createInitialState()
    gameStore.ts               # createGameStore() factory (zustand/vanilla) + GameActions
    useGameStore.ts            # Shared app store instance `gameStore` + useGameStore(selector) hook
  board\                       # Pure constants, rules, and layout math — no React/Three components
    boardConfig.ts             # Camera framing, card footprint, slot/deck/hand anchors, fan tuning constants
    slotRules.ts               # isSlotEmpty / emptySlots / canDrop (drop validity)
    layout.ts                  # deckCardPose / handCardPoses / slotCardPose + fan basis (FAN_RIGHT/UP/NORMAL)
  cards\
    CardView.tsx               # Procedural beveled card mesh (RoundedBox + number Text + back accent). Render-only. Local faces: front=+Z, back=-Z
  animation\                   # Maps state -> visual target, then interpolates
    poseSelectors.ts           # selectCardVisual(state, id, hoveredId) -> { pose, faceUp, zone, config }
    motionConfig.ts            # SPRING presets, DRAG_LIFT, OPENING_DEAL_STAGGER_MS (phase-tagged feel)
    MotionCard.tsx             # @react-spring/three wrapper; interruptible retarget of position/rotation
  input\                       # DOM-driven picking + raycast (NOT R3F onPointer*)
    threeAccess.ts             # Mutable bridge object { camera, canvas } shared Canvas <-> DOM
    PointerControls.tsx        # Window pointerdown/move/up listeners -> store actions. Renders null
    pickMath.ts                # clientToNdc, cardRayT, pickHandIndex, pickDeck, projectToBoard (THREE.Raycaster)
    hitTest.ts                 # Pure slotAtPoint(point) nearest-slot-within-radius (no Three.js)
  render\                      # R3F scene composition, presentational only
    GameScene.tsx              # Lights + BoardView + SlotView + one CardEntity per card + OpeningDeal + ThreeBridge
    ThreeBridge.tsx            # Publishes live camera + gl.domElement to threeAccess. Renders null
    CardEntity.tsx             # Per-card: selectCardVisual -> MotionCard -> CardView
    BoardView.tsx              # Playmat plane (shadow catcher)
    SlotView.tsx               # 3 slot markers; gold outline on EMPTY slots while dragging
    OpeningDeal.tsx            # Mounts once, staggers 5 drawCard() calls; guarded against StrictMode double-deal
```

Tests are colocated (`*.test.ts`) next to the pure modules they lock down: `state\gameStore`, `state\cardData`, `board\slotRules`, `board\layout`, `input\hitTest`, `animation\poseSelectors`, plus `smoke`.

## Layered decomposition & boundaries

| Layer | Single responsibility | Must NOT know about | Boundary |
|---|---|---|---|
| `state\` | Authoritative game/interaction state + actions. Immediate, deterministic transitions. | Three.js, springs, DOM events. | Plain IDs / `Vec3` / `Pose`; action calls; selectors. |
| `board\` | Pure constants, drop rules, and pose/layout math. | React, zustand internals, animation lib. | Pure functions -> occupancy, validity, `Pose`. |
| `cards\` | Placeholder card visual. | Rules, state, slot validity. | `number` + `pickable` props. |
| `animation\` | State -> visual target, then interruptible interpolation. | Business/legal decisions. | `selectCardVisual` output; `MotionCard` target pose. |
| `input\` | Pointer picking, raycast projection, slot hover — DOM-driven. | State internals beyond the public action API. | Reads `threeAccess`; calls `beginDrag/updateDrag/hoverSlot/hoverCard/dropCard/drawCard`. |
| `render\` | Compose R3F scene; subscribe to selectors; publish camera bridge. | Mutating state except via the action layer. | Subscribes to store; renders target views. |
| tests | Lock pure behavior + layout invariants. | Browser feel judgments. | Vitest over pure modules. |

**Principles (unchanged, now enforced in code):** state is authoritative and animation only visualizes it; layers are replaceable behind narrow interfaces; data is normalized/serializable (IDs + plain tuples, never renderer objects in state); pure logic is unit-tested; everything is phase-tagged.

## Core data flow: authoritative state → pose selector → spring visual

This is the spine of the whole slice and the pattern Phase 2 must preserve.

```
gameStore (authoritative)                     poseSelectors                 animation                render
  deck[] / hand[] / board{} / dragging  --->  selectCardVisual(state,id) --> MotionCard(pose,cfg) --> CardView
  hoveredCardId                               = { pose, faceUp, zone, config }   (springs)            (mesh)
        ^                                                                                                
        |  actions (beginDrag/updateDrag/hoverSlot/hoverCard/dropCard/drawCard)                          
   PointerControls (DOM) <--- threeAccess.camera/canvas <--- ThreeBridge (inside Canvas)                 
        ^                                                                                                
   window pointer events + THREE.Raycaster (pickMath) + slotAtPoint (hitTest)                            
```

1. **State is the single source of truth.** A card's zone is wherever the store says it is: `board[slot]===id` → board; `dragging.cardId===id` → dragging; `hand.indexOf(id)>=0` → hand; else deck. No zone flag is stored; zone is *derived*.
2. **`selectCardVisual` is the one and only place** that turns state into a drawable target (`pose` + `faceUp` + `zone` + spring `config`). The scene is otherwise "dumb." Board→`slotCardPose`, dragging→projected pointer + `DRAG_LIFT`, hand→`handCardPoses[idx]` (+ optional hover lift along `FAN_UP`), deck→`deckCardPose(index)`.
3. **`MotionCard` interpolates** toward that target with an interruptible `@react-spring/three` spring. Retargeting mid-flight (grab during reflow) is automatic — the target simply changes and the spring re-aims. No imperative tween bookkeeping.
4. **Input is a closed loop back into state.** `PointerControls` (DOM) raycasts via `pickMath` against poses recomputed from the same layout math, calls actions, state changes, selectors recompute, springs re-aim. Picking never traverses the animated scene graph — it recomputes authoritative poses, so it is immune to in-flight spring matrices.

## Integration points (the seams that bind the layers)

- **`state/useGameStore.ts` `gameStore`** — the shared vanilla store. React reads via `useGameStore(selector)`; DOM input and `OpeningDeal` read/write via `gameStore.getState()`. Single instance; tests use `createGameStore()` for isolation.
- **`input/threeAccess.ts`** — the ONLY bridge between the R3F world (inside `<Canvas>`) and the DOM world (outside it). `ThreeBridge` (in-scene) writes `camera`/`canvas`; `PointerControls` (DOM) reads them. Nulled on unmount.
- **`board/boardConfig.ts`** — single source of truth for camera framing (`CAMERA_POSITION/TARGET/FOV`, consumed by both `App` and `layout.ts`), card footprint, anchors, and fan tuning. Layout math, hit-testing, picking, and the scene all read these same constants — no duplicated magic numbers.
- **`board/layout.ts`** — pose math shared by BOTH render (`selectCardVisual`) and input (`PointerControls` recomputes `handCardPoses`/`deckCardPose` to raycast against). This shared use is why picking and rendering can never disagree about where a card "is."
- **`CAMERA_POSITION`/`CAMERA_TARGET`** are baked into the fan basis at module load (`TO_CAMERA`). The fan is only correct for the fixed Phase 1 camera — see Phase-2 risks.

## Phase 1 authoritative state model (as built)

```ts
cardsById: Record<CardId, { id: CardId; number: 1..10 }>   // fixed after init (stable ref — see R-001)
deck:   CardId[]   // bottom..top; top = last element
hand:   CardId[]   // left..right; drives the fan
board:  Record<SlotId, CardId | null>   // slotA/slotB/slotC
dragging: { cardId; origin: 'hand'; projectedPoint: Vec3; hoveredSlotId: SlotId | null } | null
hoveredCardId: CardId | null            // hand hover-raise hint
```

### Action API (as built, `gameStore.ts`)

`drawCard` · `beginDrag(id)` · `updateDrag(point)` · `hoverSlot(id|null)` · `hoverCard(id|null)` · `dropCard(id, slotId|null)` · `returnToHand(id)` · `reset()`. Transitions are immediate and deterministic; `dropCard` consults `canDrop` (empty-slot only) and otherwise silently returns the card to hand order. Animation makes those instantaneous transitions *look* like draws, snaps, and reflows.

## Architecturally significant decisions (Phase 1)

Two decisions define this phase. Both are recorded in full, with reasoning and file:line references, in the dated decision record **`2026-08-22-phase-1-decisions.md`** alongside this file. Summary:

### D1 — R3F pointer events are dead in this runtime → DOM-driven input + manual raycaster (PERMANENT CONSTRAINT)

R3F `onPointer*` handlers do **not** fire reliably here — in both the embedded Copilot canvas and the user's real browser. `eventSource` + `eventPrefix="client"` fired exactly once then died. **Never rely on R3F `onPointer*` in this project.** The as-built input path is: `PointerControls` (`src\input\PointerControls.tsx`, a DOM sibling *outside* `<Canvas>` in `App.tsx:26`) attaches `window` pointer listeners and drives the store; it raycasts with a manual `THREE.Raycaster` (`src\input\pickMath.ts:13`) against the live camera published through `ThreeBridge` (`src\render\ThreeBridge.tsx`) → `threeAccess` (`src\input\threeAccess.ts`). Picking targets are poses recomputed from `layout.ts`, not scene meshes, so input is decoupled from the animated graph. See D1 in the decision record.

### D2 — Hand-fan occlusion via parallel camera-facing planes laid out in the view plane (PERMANENT PATTERN)

The fan is laid out in the camera's **view plane** using an orthonormal basis (`FAN_RIGHT` = screen-horizontal spread, `FAN_UP` = screen-vertical arc dip, `FAN_NORMAL`/`TO_CAMERA` = depth), `src\board\layout.ts:54-64`. Every card faces the camera and splay roll is applied **about the view normal** (`handRotation`, `layout.ts:72-76`) so all cards stay **parallel planes**. Depth (which card wins an overlap) is controlled *solely* by a per-card step along the view normal (`HAND_LAYER_STEP`, `boardConfig.ts:52`; `layout.ts:112,115-117`), giving strict "each card under the card to its right" with zero interpenetration/ghosting. Crucially, arc dip moves cards only *within* the view plane, so it can **never** flip depth order. **Anti-patterns (do not reintroduce):** dipping cards in world-Y (end cards fell behind the middle under the overhead camera) and layering along world-Z (produced a diagonal "staircase"). See D2 in the decision record.

## Architectural quality pass — tech debt, coupling, tests (actionable, for Phase 2)

### Coupling / debt

1. **`CardEntity` subscribes to the WHOLE store** — `useGameStore((s) => s)` (`src\render\CardEntity.tsx:14`). Every card re-runs `selectCardVisual` on *any* state change (every `updateDrag` during a drag = 10 cards recompute per pointer-move). Fine at 10 cards; will not scale. **Recommendation (Phase 2):** subscribe narrowly (derive per-card visual via a memoized selector, or split `dragging`/`hand`/`board` subscriptions) before card counts or per-frame update rate grow.

2. **Fan basis is frozen at module load to the fixed camera** — `TO_CAMERA`/`RIGHT`/`VIEW_UP` are computed once from `CAMERA_POSITION`/`HAND_ANCHOR` (`src\board\layout.ts:29-55`). If Phase 2 introduces any camera movement (orbit, zoom, per-player views), the billboard fan and the picking that recomputes it both break silently. **Recommendation:** when the camera stops being fixed, make the fan basis a function of the live camera (compute from `threeAccess.camera` / passed-in camera), and add a test that the fan re-billboards for a second camera pose.

3. **`projectedPoint` is a board-plane hit only** — `projectToBoard` intersects `y=0` (`src\input\pickMath.ts:14,71-76`), while the dragged card floats at `DRAG_LIFT=0.55`. The card visually leads/lags the cursor in screen space because the pick point is on the mat, not the lift plane. Acceptable now; **recommendation:** if drag precision matters in Phase 2, project onto a plane at the lift height (or offset the ray) so the card tracks the cursor exactly.

4. **`returnToHand` action is unused** — defined in `gameStore.ts:95-99` but `dropCard` handles invalid drops inline and `PointerControls` never calls it. **Recommendation:** either route invalid drops through it (single responsibility for "end drag, keep in hand") or delete it to avoid dead API surface. Low priority.

5. **Two overlapping "hover" concepts** — `hoverCard`/`hoveredCardId` (hand raise) and `dragging.hoveredSlotId` (slot highlight). Names are close enough to invite confusion as interactions grow. **Recommendation:** keep, but document the distinction at the type site (`state\types.ts`) if Phase 2 adds more hover states.

6. **Magic depth-bias offsets in render are scattered** — `BoardView` at `BOARD_Y-0.011`, slot planes at `y-0.009`, card front text at `+0.002` (`BoardView.tsx:7`, `SlotView.tsx:22`, `CardView.tsx:27`). These hand-tuned z-fight nudges live across components. **Recommendation:** if layering bugs recur, centralize these offsets in `boardConfig.ts` like the fan constants.

### Missing / thin test coverage

7. **No test covers the DOM input orchestration** — `dropCard` on a filled/`null` slot is unit-tested in `gameStore.test.ts`, but `PointerControls` (the pickdown→drag→drop loop) has **zero coverage** and is the largest untested surface and the one most likely to regress. **Recommendation:** inject `threeAccess`/camera into the handlers (they're nearly pure already) and unit-test the loop against a stub camera.

8. **`pickMath`/`cardRayT` has no direct test** — the raycast-vs-oriented-rectangle math (`pickMath.ts:29-43`) underpins *all* picking and is untested. **Recommendation:** add a Vitest with a fixed camera + known pose asserting a hit inside the rect and a miss just outside `CARD_WIDTH/2`.

9. **`OpeningDeal` timing guard is untestable as written** — real `setTimeout` + module-level `gameStore` (`OpeningDeal.tsx`). **Recommendation:** if the deal logic grows, lift the guarded "deal N" into a pure sequencer the test can drive with fake timers.

10. **Layout tests are the D2 regression anchor** — `board\layout.test.ts` covers centering, splay symmetry, in-plane arc, strict view-normal depth ordering, and compression, directly guarding D2's anti-patterns. Keep them; add the second-camera billboard test (item 2) when the camera moves.

## Future extension seams

| Future capability | Seam to extend | Expected localized change |
|---|---|---|
| Game-board setup (Phase 2) | `board\boardConfig.ts`, `state\types.ts`, `render\` | Add zones/slots + selectors; compose more views. Keep state→selector→spring spine. |
| Camera movement / multiple views | `board\layout.ts` fan basis, `input\pickMath.ts` | Make fan basis + picking a function of the live camera (see debt #2). |
| Re-pickup placed cards | `gameStore.ts`, `board\slotRules.ts`, `input\PointerControls.tsx` | Allow `beginDrag` from board; clear/refill slot. Render stays state-driven. |
| Touch/mobile | `input\PointerControls.tsx` | Pointer events already unify mouse/touch; verify + tune hit radius. |
| Real card data / art | `state\types.ts`, `cards\CardView.tsx` | Extend `Card`; swap procedural mesh behind `number`/face props. |
| Rules / turn engine | New `rules\` layer between input intents and store actions | Validate/transform moves before committing. |
| Networking | Store action dispatch boundary | Route intents through a sync adapter; render/input stay transport-unaware. |

## Tech stack

React 18 + Vite + TypeScript · Three.js via @react-three/fiber v8 + drei · Zustand (vanilla store) · @react-spring/three · Vitest. Rationale unchanged from Gate 1: fast browser iteration + typing, tactile 3D with React composition, a small explicit testable store, interruptible premium motion behind a local `MotionCard` abstraction, and Vitest for pure-logic TDD.
