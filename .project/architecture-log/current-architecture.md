# Current Architecture — Everwar

**Current phase:** Phase 6 — Opponent board mirror, combat/stat-tag polish, and level/tribute summoning (full turn loop + dice combat + opponent targeting in place)
**Landed:** commits `1a54534` (P2) → `f15d8fc` (P3) → `7f4063b` (P4) → `6385a1b` (P5); **Phase 6 uncommitted** in the working tree
**Last architecture close-out:** 2026-08-23 (back-propagated close-out for phases 3–6)
**Build health at close-out:** `npx tsc --noEmit` green · `npx vitest run` green (**127 tests, 11 files**), working tree at Phase 6

Everwar's vision is mutable. This is a living architecture log and evolves per phase. Every feature addition, change, or removal updates the phase history below and the affected seams. This document reflects the **actual, as-built** architecture through Phase 6. The Phase 1/2 sections below are preserved for the load-bearing decisions (D1–D4); the **layered-architecture spine and the state→selector→spring data flow are preserved intact** across all phases and remain the pattern every later phase built on. Per-phase architecturally-significant decisions live in the dated decision records alongside this file (`2026-08-22-phase-1-decisions.md`, `2026-08-22-phase-2-decisions.md`, and the `…phase-3/4/5/6-decisions.md` records).

## Phase history

| Phase | Change type | Summary |
|---|---:|---|
| Phase 1 | Added | Browser-first tactile card-handling slice: 10-card deck, auto-dealt opening hand of 5, camera-facing hand fan, drag-to-place into 3 board slots, invalid-drop return, procedural cards, state-driven interruptible spring animation. **Input is DOM-driven (not R3F events)** and picking uses a manual raycaster against the live camera. |
| Phase 2 | Changed / Added | Typed multi-zone field. The 3 untyped slots became **12 typed slots** (`A1..A4, B1..B4, C1..C4`); `SlotId` is now a template-literal union whose leading letter IS the accepted type. Cards gained a `type: CardType` (A/B/C) and the old `number` field was removed. Deck grew to **12 cards** (4 each, interleaved). Board geometry is a two-row grid (four `[A\|C]` pairs on top, four `B` centered below) plus labeled deck/graveyard/replen anchors. **Placement is type-gated** (empty + matching type). Board/deck cards **shrink** via a springable per-card `scale`; the approved hand fan is visually unchanged (hand scale 1, camera still centered on x=0). Camera re-tuned for the wider field. **34 → 43 tests.** |
| Phase 3 | Added | Card systems. A rich card data model with a **DOM `InspectionPanel`** overlay (kept outside the canvas for crisp text) + procedural rich faces. New **`graveyard`** pile with a destroy→grave flow (A drags its linked C). Pile management: reusable **`PileSearchModal`**, a **`replen`** pile, "disturb", and an **animated riffle shuffle** with a pure Fisher-Yates `shuffle.ts` (injectable RNG). Floating **A-zone stat overlays**; **C-cards** gate on their linked A and roll a stat boost (boost-only display); **B-cards** become spells carrying an on-play ability (draw/shuffle) enacted after a **summon-reveal showcase**; `atk/def/hp` become optional and A-only. |
| Phase 4 | Added | Turn/phase loop. **Phase state machine Draw→Main→Battle→Resolution→End** with a turn counter, `TurnHud`, Next-Phase button, and a sliding `PhaseBanner`. Draw auto-draws to 6/1 then advances; End folds replen into the deck and graveyards non-continuous B cards; placement gated to Main. **Battle declaration** (click a linked A/C column to declare its A as attacker); **Resolution dice** (each attacker rolls a D20 in-scene, values into `lastRolls`) then auto-advances to End. |
| Phase 5 | Added | Dice combat + rules layer. Pure **`diceRules.ts`** (D20 → GLANCING/HIT/MISS/CRITICAL bands from effective ACC + auto-crit) and **`combatStats.ts`** (HP/DMG/ACC with C-card buffs folded into effective stats). Resolution shows outcome pop-ups then applies damage; cards drained to 0 HP play a slash FX and travel to graveyard (End holds for the animation). **Player→opponent targeting**: a mirrored opponent Vanguard row, aim arrows that rubber-band to the cursor, gold valid targets, stackable attackers. Double-click quick-place in Main. |
| Phase 6 | Changed / Added | Opponent board + summoning depth. **Full mirrored opponent board** reusing the slot/id scheme (upside-down cards, but HP/DMG/ACC tags kept player-relative), with opponent draw/destroy animations and increased board spacing. **On-card stat redesign** (remaining-HP + bar on top, DMG/ACC below) and a **flattened camera**. **Card-A summon levels (1/2/2/3)** with **tribute summoning**: level-3 needs board A-cards summing to exactly 3, chosen via a subset-sum popup (`TributeModal`), materials + linked C → replen. **Commander card** (A5, deck now 13) summons the same way but sends materials → graveyard. **"Shuffle into deck" reroutes through the replen pile**; End only reshuffles when replen is non-empty. **→ 127 tests.** |

## As-built `src\` module layout

```text
src\
  main.tsx                     # React entry; mounts <App/>
  app\
    App.tsx                    # Shell: R3F <Canvas> (fixed angled camera) + <GameScene/> + <PointerControls/> (DOM sibling, OUTSIDE Canvas)
  state\                       # Authoritative, serializable domain state — no Three.js, no React in the core
    types.ts                   # CardType(A/B/C), SlotIndex, SlotId (template union `${CardType}${1|2|3|4}`), slotType(), Card{type}, Vec3, Pose, DragState, GameState
    cardData.ts                # CARD_TYPES, SLOTS_PER_TYPE=4, SLOT_IDS (12), DECK_SIZE=12, OPENING_HAND_SIZE=5, createEmptyBoard(), createInitialState() (interleaved deck)
    gameStore.ts               # createGameStore() factory (zustand/vanilla) + GameActions
    useGameStore.ts            # Shared app store instance `gameStore` + useGameStore(selector) hook
  board\                       # Pure constants, rules, and layout math — no React/Three components
    boardConfig.ts             # Camera framing, card footprint, BOARD_CARD_SCALE, 12-slot grid geometry, deck/grave/replen anchors, placeholder zones, fan tuning
    slotRules.ts               # isSlotEmpty / slotAcceptsType / emptySlots / validTargetSlots / canDrop (empty AND matching type)
    layout.ts                  # deckCardPose / handCardPoses / slotCardPose + fan basis (FAN_RIGHT/UP/NORMAL); board/deck poses scaled by BOARD_CARD_SCALE
  cards\
    CardView.tsx               # Procedural beveled card mesh (RoundedBox + type letter A/B/C + gold back). Render-only. Local faces: front=+Z, back=-Z
  animation\                   # Maps state -> visual target, then interpolates
    poseSelectors.ts           # selectCardVisual(state, id, hoveredId) -> { pose, faceUp, zone, config, scale } (board/deck scale<1, hand/drag=1)
    motionConfig.ts            # SPRING presets, DRAG_LIFT, OPENING_DEAL_STAGGER_MS (phase-tagged feel)
    MotionCard.tsx             # @react-spring/three wrapper; interruptible retarget of position/rotation/scale
  input\                       # DOM-driven picking + raycast (NOT R3F onPointer*)
    threeAccess.ts             # Mutable bridge object { camera, canvas } shared Canvas <-> DOM
    PointerControls.tsx        # Window pointerdown/move/up listeners -> store actions. Renders null
    pickMath.ts                # clientToNdc, cardRayT, pickHandIndex, pickDeck, projectToBoard (THREE.Raycaster)
    hitTest.ts                 # Pure slotAtPoint(point) nearest of 12 slots within radius (no Three.js)
  render\                      # R3F scene composition, presentational only
    GameScene.tsx              # Lights + BoardView + SlotView + one CardEntity per card + OpeningDeal + ThreeBridge
    ThreeBridge.tsx            # Publishes live camera + gl.domElement to threeAccess. Renders null
    CardEntity.tsx             # Per-card: selectCardVisual -> MotionCard (pose+scale) -> CardView(type)
    BoardView.tsx              # Playmat plane (shadow catcher), resized/shifted for the wider field
    SlotView.tsx               # 12 typed slot markers (+GRAVE/REPLEN labels); gold outline on EMPTY matching-type slots while dragging
    OpeningDeal.tsx            # Mounts once, staggers 5 drawCard() calls; guarded against StrictMode double-deal
```

Tests are colocated (`*.test.ts`) next to the pure modules they lock down: `state\gameStore`, `state\cardData`, `state\diceRules`, `state\combatStats`, `state\shuffle`, `board\slotRules`, `board\layout`, `input\hitTest`, `input\pickMath`, `animation\poseSelectors`, plus `smoke` — **127 tests / 11 files** at Phase 6.

### Modules added since Phase 2 (phases 3–6)

The layout above is the Phase-2 baseline; the layered spine is unchanged, but these modules were added. See each phase's `client-docs\technical\phase-N-*-architecture.md` for detail.

```text
state\
  shuffle.ts                   # (P3) pure Fisher-Yates shuffleArray with injectable RNG
  diceRules.ts                 # (P5) pure D20 → GLANCING/HIT/MISS/CRITICAL bands from effective ACC (+ auto-crit)
  combatStats.ts               # (P5) pure effective HP/DMG/ACC = base + folded C-card buffs
  gameStore.ts                 # (P3–P6) grew: graveyard/replen piles, pile-search, shuffle, phase state machine,
                               #   battle declaration, resolution dice, damage/death, opponent targeting,
                               #   tribute summoning (pendingTribute), commander routing
  types.ts                     # gained: graveyard/replen, phase/turn, combat stats (optional, A-only),
                               #   level?/commander?, PendingTribute, targeting + roll state
cards\
  cardTheme.ts                 # (P3) TYPE_ACCENT / TYPE_LABEL / RARITY_COLOR shared card theming
render\                        # (P3–P6) presentational R3F views, all state-driven
  AZoneStats.tsx / StatOverlay.tsx   # floating HP-bar / DMG / ACC plates over A columns (P3, redesigned P6)
  SummonRipple.tsx             # (P3) summon-reveal showcase pop + gold ripple
  ResolutionDice.tsx           # (P4/P5) in-scene D20 tumble over each attacker
  OutcomePopups.tsx / DamagePopups.tsx  # (P5) HIT/MISS/CRIT + damage number pop-ups
  DestructionFx.tsx            # (P5) red-slash death FX + travel to graveyard
  TargetingArrows.tsx          # (P5) rubber-band aim arrows to the cursor / locked targets
  OpponentBoard.tsx / OpponentField.tsx / OpponentHand.tsx / CardBack.tsx  # (P5/P6) mirrored opponent side
ui\                            # DOM overlays (outside the Canvas, crisp text)
  InspectionPanel.tsx          # (P3) big card inspector; (P6) shows Level + COMMANDER tag
  PileSearchModal.tsx          # (P3) reusable deck/graveyard/replen browser
  DevControls.tsx              # (P3) temp dev buttons (destroy/pile/shuffle) — no Player 2 yet
  PhaseBanner.tsx / TurnHud.tsx  # (P4) phase banner + turn HUD / Next-Phase button
  TributeModal.tsx             # (P6) subset-sum material picker with a 0/N counter
```

## Layered decomposition & boundaries

| Layer | Single responsibility | Must NOT know about | Boundary |
|---|---|---|---|
| `state\` | Authoritative game/interaction state + actions. Immediate, deterministic transitions. | Three.js, springs, DOM events. | Plain IDs / `Vec3` / `Pose`; action calls; selectors. |
| `board\` | Pure constants, drop rules, and pose/layout math. | React, zustand internals, animation lib. | Pure functions -> occupancy, validity, `Pose`. |
| `cards\` | Placeholder card visual. | Rules, state, slot validity. | `type` (A/B/C) + `pickable` props. |
| `animation\` | State -> visual target (pose + scale), then interruptible interpolation. | Business/legal decisions. | `selectCardVisual` output; `MotionCard` target pose+scale. |
| `input\` | Pointer picking, raycast projection, slot hover — DOM-driven. | State internals beyond the public action API. | Reads `threeAccess`; calls `beginDrag/updateDrag/hoverSlot/hoverCard/dropCard/drawCard`. |
| `render\` | Compose R3F scene; subscribe to selectors; publish camera bridge. | Mutating state except via the action layer. | Subscribes to store; renders target views. |
| tests | Lock pure behavior + layout invariants. | Browser feel judgments. | Vitest over pure modules. |

**Principles (unchanged, now enforced in code):** state is authoritative and animation only visualizes it; layers are replaceable behind narrow interfaces; data is normalized/serializable (IDs + plain tuples, never renderer objects in state); pure logic is unit-tested; everything is phase-tagged.

## Core data flow: authoritative state → pose selector → spring visual

This is the spine of the whole slice and the pattern Phase 2 must preserve.

```
gameStore (authoritative)                     poseSelectors                 animation                render
  deck[] / hand[] / board{12} / dragging --> selectCardVisual(state,id) --> MotionCard(pose,scale,cfg) --> CardView(type)
  hoveredCardId                               = { pose, faceUp, zone, config, scale }   (springs)          (mesh)
        ^                                                                                                
        |  actions (beginDrag/updateDrag/hoverSlot/hoverCard/dropCard/drawCard)                          
   PointerControls (DOM) <--- threeAccess.camera/canvas <--- ThreeBridge (inside Canvas)                 
        ^                                                                                                
   window pointer events + THREE.Raycaster (pickMath) + slotAtPoint (hitTest, 12 slots)                  
```

1. **State is the single source of truth.** A card's zone is wherever the store says it is: `board[slot]===id` → board; `dragging.cardId===id` → dragging; `hand.indexOf(id)>=0` → hand; else deck. No zone flag is stored; zone is *derived*.
2. **`selectCardVisual` is the one and only place** that turns state into a drawable target (`pose` + `faceUp` + `zone` + spring `config` + `scale`). The scene is otherwise "dumb." Board→`slotCardPose` (scale 0.72), dragging→projected pointer + `DRAG_LIFT` (scale 1), hand→`handCardPoses[idx]` (+ optional hover lift along `FAN_UP`, scale 1), deck→`deckCardPose(index)` (scale 0.72).
3. **`MotionCard` interpolates** toward that target with an interruptible `@react-spring/three` spring over position, rotation, AND scale. Retargeting mid-flight (grab during reflow, grow on pickup, shrink on snap) is automatic — the target simply changes and the spring re-aims. No imperative tween bookkeeping.
4. **Input is a closed loop back into state.** `PointerControls` (DOM) raycasts via `pickMath` against poses recomputed from the same layout math, calls actions, state changes, selectors recompute, springs re-aim. Picking never traverses the animated scene graph — it recomputes authoritative poses, so it is immune to in-flight spring matrices.

## Integration points (the seams that bind the layers)

- **`state/useGameStore.ts` `gameStore`** — the shared vanilla store. React reads via `useGameStore(selector)`; DOM input and `OpeningDeal` read/write via `gameStore.getState()`. Single instance; tests use `createGameStore()` for isolation.
- **`input/threeAccess.ts`** — the ONLY bridge between the R3F world (inside `<Canvas>`) and the DOM world (outside it). `ThreeBridge` (in-scene) writes `camera`/`canvas`; `PointerControls` (DOM) reads them. Nulled on unmount.
- **`board/boardConfig.ts`** — single source of truth for camera framing (`CAMERA_POSITION [0,8.4,7.7]`/`CAMERA_TARGET [0,0,-0.55]`/`CAMERA_FOV 44`, consumed by both `App` and `layout.ts`), card footprint, `BOARD_CARD_SCALE`, the 12-slot grid geometry (`buildSlotPositions` → `SLOT_POSITIONS`), deck/graveyard/replen anchors, placeholder zones, and fan tuning. Layout math, hit-testing, picking, and the scene all read these same constants — no duplicated magic numbers. **Camera x is kept 0** so the fan basis stays symmetric (see D4).
- **`board/layout.ts`** — pose math shared by BOTH render (`selectCardVisual`) and input (`PointerControls` recomputes `handCardPoses`/`deckCardPose` to raycast against). This shared use is why picking and rendering can never disagree about where a card "is."
- **`CAMERA_POSITION`/`CAMERA_TARGET`** are baked into the fan basis at module load (`TO_CAMERA`). The fan is only correct for a **fixed, x=0-centered** camera. Phase 2 re-tuned the camera (y/z/fov/target) for the wider field but deliberately kept x=0, so the basis is still valid — this is now load-bearing (D4). Any future camera motion breaks it — see the quality pass (debt #2).

## Phase 2 authoritative state model (as built)

```ts
cardsById: Record<CardId, { id: CardId; type: 'A'|'B'|'C' }>   // fixed after init (stable ref — see R-001)
deck:   CardId[]   // bottom..top; top = last element. 12 cards, types interleaved A,B,C,A,B,C,...
hand:   CardId[]   // left..right; drives the fan
board:  Record<SlotId, CardId | null>   // 12 typed slots: A1..A4, B1..B4, C1..C4
dragging: { cardId; origin: 'hand'; projectedPoint: Vec3; hoveredSlotId: SlotId | null } | null
hoveredCardId: CardId | null            // hand hover-raise hint
```

`SlotId` is the template-literal union `` `${CardType}${1|2|3|4}` `` and `slotType(slotId)` derives the accepted type from the leading letter — there is no parallel slot→type map (see D3). The Phase-1 `Card.number` field is gone.

### Action API (as built, `gameStore.ts`)

`drawCard` · `beginDrag(id)` · `updateDrag(point)` · `hoverSlot(id|null)` · `hoverCard(id|null)` · `dropCard(id, slotId|null)` · `returnToHand(id)` · `reset()`. Transitions are immediate and deterministic. `dropCard` now looks up the dragged card's `type` and consults `canDrop(board, slotId, cardType)` — valid only on an **empty slot whose type matches** (type-gated only; no A–C adjacency requirement) — otherwise it silently returns the card to hand order. Animation makes those instantaneous transitions *look* like draws, snaps, grows/shrinks, and reflows.

## Architecturally significant decisions

Phase 1 defined two **permanent** decisions (D1, D2); Phase 2 added two more (D3, D4) plus a deliberate placement-scope note. Later phases record their decisions in dated records alongside this file (**`…phase-3/4/5/6-decisions.md`**); phases 4–6 use a phase-prefixed numbering (P4-Dx, P5-Dx, P6-Dx) while phases 1–3 use the plain D-series. The load-bearing D1–D4 remain in force through Phase 6 and are summarized below; the newer phases' key patterns are listed in the rollup that follows.

### D1 — R3F pointer events are dead in this runtime → DOM-driven input + manual raycaster (PERMANENT CONSTRAINT)

R3F `onPointer*` handlers do **not** fire reliably here — in both the embedded Copilot canvas and the user's real browser. `eventSource` + `eventPrefix="client"` fired exactly once then died. **Never rely on R3F `onPointer*` in this project.** The as-built input path is: `PointerControls` (`src\input\PointerControls.tsx`, a DOM sibling *outside* `<Canvas>` in `App.tsx:26`) attaches `window` pointer listeners and drives the store; it raycasts with a manual `THREE.Raycaster` (`src\input\pickMath.ts:13`) against the live camera published through `ThreeBridge` (`src\render\ThreeBridge.tsx`) → `threeAccess` (`src\input\threeAccess.ts`). Picking targets are poses recomputed from `layout.ts`, not scene meshes, so input is decoupled from the animated graph. See D1 in the Phase-1 decision record. **Unchanged in Phase 2.**

### D2 — Hand-fan occlusion via parallel camera-facing planes laid out in the view plane (PERMANENT PATTERN)

The fan is laid out in the camera's **view plane** using an orthonormal basis (`FAN_RIGHT` = screen-horizontal spread, `FAN_UP` = screen-vertical arc dip, `FAN_NORMAL`/`TO_CAMERA` = depth), `src\board\layout.ts:55-65`. Every card faces the camera and splay roll is applied **about the view normal** (`handRotation`, `layout.ts:73-77`) so all cards stay **parallel planes**. Depth is controlled *solely* by a per-card step along the view normal (`HAND_LAYER_STEP`, `boardConfig.ts:90`; `layout.ts:113,116-118`). **Anti-patterns (do not reintroduce):** dipping cards in world-Y and layering along world-Z. See D2 in the Phase-1 decision record. **Preserved intact in Phase 2** — the fan runs at scale 1 and the camera x stayed 0, so the frozen basis is byte-for-byte the same (see D4).

### D3 — Slot type encoded in the slot id (template-literal union), not a parallel map (Phase 2, PERMANENT PATTERN)

`SlotId = `${CardType}${1|2|3|4}`` (`src\state\types.ts:19`) enumerates all 12 slots at the type level; `slotType(slotId)` reads the leading letter (`types.ts:22-24`). A slot's accepted type is therefore *derivable*, not stored — rules (`slotAcceptsType`, `slotRules.ts:16-18`), the drag highlight (`SlotView.tsx:30-36`), and labels (`slotTypeLabel`, `boardConfig.ts:103-105`) all read the same character. `SLOT_IDS` is generated from the families (`cardData.ts:13-15`). Trade-off: renaming a family is a type-level change touching the union — deliberate, loud friction. Contrast Phase 1's positional, type-less `slotA/B/C`. See D3 in the Phase-2 decision record.

### D4 — Per-card visual scale in the animation layer, camera kept centered on x=0 (Phase 2, PERMANENT PATTERN)

Board/deck cards shrink via a springable `CardVisual.scale` (`BOARD_CARD_SCALE = 0.72`, `boardConfig.ts:29`; assigned per zone in `poseSelectors.ts:41,55,73,83`; sprung in `MotionCard.tsx:23-28`), leaving the approved hand fan at scale 1. **Card footprint (world geometry) and board presentation scale are intentionally separate.** The camera was re-tuned for the taller field but **kept at x=0** (`boardConfig.ts:19-21`) because moving camera x rotates D2's load-bearing fan basis and breaks the fan-symmetry tests; the field's asymmetry is absorbed by shifting the playmat/anchors instead. This keeps D2 intact while fitting a much wider board. See D4 in the Phase-2 decision record.

### Placement rule scope (Phase 2)

`canDrop` = empty **AND** matching type, type-gated **only** (`slotRules.ts:44-51`) — a C card does **not** require its paired A to be filled. This is a deliberate scope choice; relational/adjacency rules are deferred to a future `rules\` layer. `slotRules.test.ts` locks "C-without-A allowed" so tightening it later is a conscious change. **(Phase 6 layered the level/tribute gate on top of this — see the rollup below — without replacing the type gate.)**

### Rollup — key load-bearing patterns added in phases 3–6

Full reasoning lives in each dated decision record; this is the orientation summary.

- **DOM overlays for text-heavy UI (P3).** Card inspection, pile search, dev controls, phase/turn HUD, and the tribute modal are React DOM siblings *outside* `<Canvas>` (marked `data-ui-overlay`), so text stays crisp and they never fight the 3D picking loop (consistent with D1's DOM-driven input). Open state that board input and buttons share lives in the store (e.g. `pileSearch`, `pendingTribute`).
- **Pure, injectable-RNG rules modules (P3/P5).** `shuffle.ts` (Fisher-Yates), `diceRules.ts` (D20 bands), and `combatStats.ts` (effective stats = base + folded C buffs) are side-effect-free and unit-tested; the store composes them. This is the seed of the long-anticipated `rules\` layer.
- **Phase state machine as the turn spine (P4).** `Draw→Main→Battle→Resolution→End` gates every action (placement Main-only, declaration Battle-only, dice Resolution-only). Timed transitions wait on banner/animation completion rather than racing them.
- **State→selector→spring extended to combat & opponent (P5/P6).** New visuals (stat plates, dice, outcome/damage pop-ups, death FX, targeting arrows, the whole opponent side) are all state-driven views; the opponent board **reuses the same `SlotId` scheme/pose math**, flipping card orientation while keeping HP/DMG/ACC plates player-relative. This realized the "opponent field / mirrored P2 zones" seam.
- **Subset-sum tribute gate + modal handshake (P6).** Level-3/Commander A-cards require board materials whose levels sum to exactly the level (`hasSubsetSum`/`canAffordTribute` in `slotRules.ts`). Dropping such a card sets `pendingTribute` (card stays in hand) rather than committing; `TributeModal` collects the selection and `confirmTributeSummon` validates the sum, routes materials + linked C to **replen** (or **graveyard** for `commander`), then commits. The type gate (D3) is untouched — this is an *additional* gate.
- **"Shuffle into deck" indirection through replen (P6).** Effects that say "shuffle into deck" move cards into the replen pile (which folds into the deck at End), keeping the deck-riffle animation reserved for genuine deck reshuffles. End only reshuffles when replen is non-empty.
- **Camera note (P6).** The board angle was flattened for readable stat tags. **Camera x is still 0** (D4's load-bearing invariant for the fan basis is respected); the change is in pitch/height/target, not x.

## Architectural quality pass — tech debt, coupling, tests (actionable, for Phase 3)

### Coupling / debt

1. **`CardEntity` subscribes to the WHOLE store** — `useGameStore((s) => s)` (`src\render\CardEntity.tsx:14`). Every card re-runs `selectCardVisual` on *any* state change. With Phase 2's 12-card deck this is now **12 cards recomputing per `updateDrag`** (i.e. per pointer-move during a drag), up from 10. Still fine at this scale; the coupling is unchanged but the constant grew. **Recommendation (Phase 3):** subscribe narrowly (memoized per-card selector, or split `dragging`/`hand`/`board` subscriptions) before card counts (opponent field, larger decks) or per-frame rate grow.

2. **Fan basis is frozen at module load to the fixed camera** — `TO_CAMERA`/`RIGHT`/`VIEW_UP` are computed once from `CAMERA_POSITION`/`HAND_ANCHOR` (`src\board\layout.ts:30-56`). **Still correct in Phase 2 because the camera stayed fixed AND centered on x=0** — this is now a *load-bearing invariant* (see D4), not just an incidental one: the wider field was framed by re-tuning y/z/fov/target and shifting the playmat, deliberately leaving camera x at 0 so the fan stays symmetric. If Phase 3 introduces any camera movement or an off-axis view, the billboard fan and the picking that recomputes it both break silently. **Recommendation:** when the camera stops being fixed/centered, make the fan basis a function of the live camera and add a test that the fan re-billboards for a second camera pose.

3. **`SlotView` now also subscribes to `board` + `dragging` + the dragged card's type** — three selectors (`src\render\SlotView.tsx:22-26`) so the gold highlight lights only matching-type empty slots. This recomputes the 12-slot highlight map on every drag update. Cheap and correct today; noted because the render layer's live subscriptions grew in Phase 2 (previously slot highlight keyed off empty-only). **Recommendation:** fine as-is; revisit only if slot count or highlight logic grows.

4. **`projectedPoint` is a board-plane hit only** — `projectToBoard` intersects `y=0` (`src\input\pickMath.ts:14,71-76`), while the dragged card floats at `DRAG_LIFT`. The card visually leads/lags the cursor in screen space. Acceptable now; **recommendation:** if drag precision matters in Phase 3, project onto a plane at the lift height (or offset the ray).

5. **`returnToHand` action is unused** — defined in `gameStore.ts:96-100` but `dropCard` handles invalid drops inline and `PointerControls` never calls it. **Recommendation:** either route invalid drops through it or delete it. Low priority — carried over from Phase 1.

6. **Two overlapping "hover" concepts** — `hoverCard`/`hoveredCardId` (hand raise) and `dragging.hoveredSlotId` (slot highlight). **Recommendation:** keep, but document the distinction at the type site (`state\types.ts`) if Phase 3 adds more hover states. Carried over from Phase 1.

7. **Magic depth-bias offsets in render are scattered** — `BoardView` at `BOARD_Y-0.011`, slot planes at `y-0.009`, card front text at `+0.002` (`BoardView.tsx:7`, `SlotView.tsx:38`, `CardView.tsx:26`). **Recommendation:** centralize in `boardConfig.ts` if layering bugs recur. Carried over from Phase 1.

8. **Grid geometry uses hand-tuned literal x-centers** — `PAIR_CENTERS_X` and `PAIR_HALF_GAP` are magic constants (`boardConfig.ts:40-42`) rather than derived from a column count + pitch. Fine for a fixed 4-pair field; **recommendation:** if the field becomes configurable (variable columns, mirrored P2 field) derive these from a pitch/anchor so the layout scales without re-tuning 4 literals. `layout.test.ts` locks the A/C pairing and B-midpoint invariants, so a derivation refactor is safe to attempt.

### Missing / thin test coverage

9. **No test covers the DOM input orchestration** — `dropCard` on a filled/wrong-type/`null` slot is unit-tested in `gameStore.test.ts`, but `PointerControls` (the pickdown→drag→drop loop) has **zero coverage** and is the largest untested surface. **Recommendation:** inject `threeAccess`/camera into the handlers and unit-test the loop against a stub camera. Carried over, still open.

10. **`pickMath`/`cardRayT` has no direct test** — the raycast-vs-oriented-rectangle math (`pickMath.ts:29-43`) underpins *all* picking and is untested. **Recommendation:** add a Vitest with a fixed camera + known pose asserting a hit inside the rect and a miss just outside. Carried over, still open.

11. **`OpeningDeal` timing guard is untestable as written** — real `setTimeout` + module-level `gameStore`. **Recommendation:** lift the guarded "deal N" into a pure sequencer driven by fake timers if the deal logic grows. Carried over, still open.

12. **Layout + rules tests are the D2/D3/D4 regression anchors** — `board\layout.test.ts` (11 tests) guards D2's fan invariants AND Phase 2's grid geometry (A/C pairing, B centered on the A/C x-midpoint, distinct rows); `board\slotRules.test.ts` (6) guards D3's type gating (`validTargetSlots`, wrong-type rejection, C-without-A allowed); `animation\poseSelectors.test.ts` (5) guards D4 (board scale < 1); `state\cardData.test.ts` (5) guards the 12-typed-card interleave; `input\hitTest.test.ts` (3) covers all 12 slots; `state\gameStore.test.ts` (12) covers typed drops + wrong-type-returns-to-hand. Keep them; add the second-camera billboard test (item 2) when the camera moves.

## Future extension seams

> **Realized since Phase 2:** the *turn/rules engine* (P4 phase machine + P5 pure `diceRules`/`combatStats`), *opponent field / mirrored zones* (P5/P6), *graveyard / replenish behavior* (P3), and *real card data depth* (P3–P6 combat stats, levels, commander, abilities/boosts) are now built. The table keeps them for context and marks what remains. **Still open:** a true second-player *turn* (the loop is one-directional player→opponent; no P2 turn or win/loss yet), camera movement, re-pickup of placed cards, configurable field size, touch/mobile, and networking.

| Future capability | Seam to extend | Expected localized change |
|---|---|---|
| Turn/rules engine, relational placement (A→C, B unlock) | New `rules\` layer between input intents and `slotRules`/store | Validate/transform moves before committing. `canDrop` already isolates drop legality; grow it or wrap it. |
| Opponent field / mirrored P2 zones | `state\types.ts` (`SlotId` scheme), `board\boardConfig.ts` (`buildSlotPositions`), `render\` | Extend the id scheme (player prefix) + generate a mirrored grid; compose more views. Keep state→selector→spring spine. |
| Camera movement / multiple views | `board\layout.ts` fan basis, `input\pickMath.ts` | Make fan basis + picking a function of the live camera (see debt #2). **Camera x=0 is currently load-bearing (D4).** |
| Re-pickup placed cards | `gameStore.ts`, `board\slotRules.ts`, `input\PointerControls.tsx` | Allow `beginDrag` from board; clear/refill slot. Render stays state-driven. |
| Configurable/variable field size | `board\boardConfig.ts` (`PAIR_CENTERS_X`, `PAIR_HALF_GAP`) | Derive column centers from a pitch/anchor instead of literals (see debt #8). |
| Touch/mobile | `input\PointerControls.tsx` | Pointer events already unify mouse/touch; verify + tune `SLOT_HIT_RADIUS`. |
| Real card data / art | `state\types.ts`, `cards\CardView.tsx` | Extend `Card` beyond `type`; swap procedural mesh behind type/face props. |
| Graveyard / replenish behavior | `board\boardConfig.ts` (`PLACEHOLDER_ZONES`), `state\`, `render\SlotView.tsx` | Placeholders are labeled-only today; give them occupancy + rules when needed. |
| Networking | Store action dispatch boundary | Route intents through a sync adapter; render/input stay transport-unaware. |

## Tech stack

React 18 + Vite + TypeScript · Three.js via @react-three/fiber v8 + drei · Zustand (vanilla store) · @react-spring/three · Vitest. Rationale unchanged from Gate 1: fast browser iteration + typing, tactile 3D with React composition, a small explicit testable store, interruptible premium motion behind a local `MotionCard` abstraction, and Vitest for pure-logic TDD.
