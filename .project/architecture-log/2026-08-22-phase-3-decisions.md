# Decision Record — Phase 3 · 2026-08-22

**Author:** Senior Coder (end-of-Phase-3 architectural close-out)  
**Phase:** Phase 3 — card systems (`2b63640` → `f15d8fc`)  
**Build health:** `npx vitest run` green (127 tests, 11 files — current suite includes later uncommitted Phase 6 work) · `npx tsc --noEmit` green  
**Scope:** architecturally significant decisions added by Phase 3. Phase 1's DOM-driven input/fan decisions and Phase 2's typed-slot/board-scale decisions remain load-bearing. Phase 2 ended at D4; Phase 3 continues with D5.

---

## D5 — Card inspection is a DOM overlay driven by selection state, not an in-canvas 3D panel

### Status
**ADOPTED · PERMANENT PATTERN.** Large informational UI belongs in DOM overlays marked `data-ui-overlay`; the Three scene keeps rendering cards, board, and spatial feedback.

### Context / problem
Phase 3 Slice 1 needed a Master-Duel-style expanded card view when the player clicked a hand or board card. Rendering a large panel inside React Three Fiber would have tied readable UI layout to camera framing, z-order, text scaling, and raycast interaction. It also risked fighting Phase 1's DOM pointer pipeline, where window listeners and manual raycasting own all card input.

### Decision
Add explicit selection state and render the inspection surface as DOM:

- `GameState.selectedCardId` stores the selected card id or `null` (`src\state\types.ts`).
- `gameStore.selectCard(cardId|null)` validates that the card exists, then opens/closes the view (`src\state\gameStore.ts`).
- `PointerControls` uses a press/release gesture model. A movement under `DRAG_THRESHOLD_PX = 6` is a click; crossing the threshold promotes hand-card input into a drag (`src\input\pickMath.ts`, `src\input\PointerControls.tsx`).
- `boardCardAt(point, board)` lets clicks inspect board cards as well as hand cards (`src\input\hitTest.ts`).
- `InspectionPanel` is mounted by `App` as a left-side DOM overlay and carries `data-ui-overlay`, so pointer events on the panel are ignored by game input (`src\ui\InspectionPanel.tsx`, `src\app\App.tsx`).
- The 3D card face was upgraded to the same richer card model by passing the full `Card` into `CardView` through `CardEntity` (`src\cards\CardView.tsx`, `src\render\CardEntity.tsx`).

### Why this design
- **Text and panel layout are browser UI problems.** DOM handles scrolling, layering, readable font sizing, and responsive placement more reliably than in-world meshes.
- **Input stays centralized.** Phase 1's DOM input spine remains the only source of click/drag interpretation; the overlay opts out with `data-ui-overlay`.
- **State remains serializable.** Selection is just a `CardId | null`, not a UI object or scene reference.

### Guardrails
- Future HUDs, modals, and temporary controls should use the same DOM overlay + `data-ui-overlay` contract unless the UI must exist spatially in the board.
- Do not attach R3F pointer handlers to cards for inspection. The project has already established that manual DOM input is the reliable path.

---

## D6 — Piles are ordered `CardId[]` state arrays; layout and browsing are derived views

### Status
**ADOPTED · PERMANENT PATTERN.** Deck, graveyard, replenish, and hand movement operate on ordered id arrays. Pile visuals and search modals derive from those arrays; cards are never cloned into pile-specific data structures.

### Context / problem
Phase 3 added graveyard, replenish, pile search, disturb, shuffle, and return-to-deck operations. These mechanics all ask "which cards are in this pile, and in what order?" while the renderer asks "where should each card appear?" A pile model that stored physical positions or duplicated card data would have entangled rules with presentation.

### Decision
Keep piles as ordered collections in `GameState`:

- `deck`, `graveyard`, `replen`, and `hand` are `CardId[]`; the deck top is the **last** element (`src\state\types.ts`, `src\state\gameStore.ts`).
- `graveyardCardPose(index)` and `replenCardPose(index)` delegate to shared `pileCardPose(anchor, index)`, producing face-up stacked poses from the pile index (`src\board\layout.ts`).
- `selectCardVisual` locates a card by checking board, dragging, hand, graveyard, replenish, then deck, and assigns the corresponding zone/pose/scale (`src\animation\poseSelectors.ts`).
- `PileSearchModal` accepts a `PileSource` (`'deck' | 'graveyard' | 'replen'`) and renders a single reusable six-wide scrollable DOM grid (`src\ui\PileSearchModal.tsx`).
- `DevControls` exposes temporary search/open and pile-operation buttons; the real state lives in the store, not the buttons (`src\ui\DevControls.tsx`).

### Consequences / tradeoffs
- (+) Moving a card between piles is a pure array transition; the spring layer animates the visual move automatically.
- (+) Search is reusable because all piles share the same id-array shape.
- (−) Pile order is now semantic. Every action must respect the project's "top = last element" convention.
- (−) `selectCardVisual` has an explicit zone priority. New zones must be inserted deliberately, or a card can be rendered in the wrong place if it temporarily exists in two arrays.

### Guardrails
- Do not copy card objects into piles. Store ids only and resolve through `cardsById`.
- Keep new pile browsing surfaces source-parameterized like `PileSearchModal`; avoid one modal per pile.
- Preserve the top-of-deck convention unless the whole draw/disturb/shuffle test set is updated.

---

## D7 — Destroy and replenish are zone-to-pile transfers, with A/C linkage by slot index

### Status
**ADOPTED FOR PHASE 3 TEMP MECHANICS.** The current buttons are development controls, but the underlying movement semantics are real and should be preserved.

### Context / problem
The first mechanic after inspection was "destroy": send an occupied Zone-A card to graveyard and also send its linked Zone-C card if present. Later replenish used the same linkage but sent cards to `replen`. The board already encodes the pair relationship visually as `A1↔C1`, `A2↔C2`, etc.

### Decision
Model destruction/replenishment as board-slot clearing plus pile append:

- `destroyZoneA()` chooses a random occupied A slot, appends that A card to `graveyard`, and appends the matching C card if occupied (`src\state\gameStore.ts`).
- `destroyZoneB()` chooses a random occupied B slot and appends only that B card to `graveyard`; B has no linked support slot.
- `replenZoneA()` mirrors the A+C transfer but appends to `replen`.
- The linkage is the shared column index (`A${i}` ↔ `C${i}`), matching Phase 2's slot id convention.
- No card is deleted from `cardsById`; only zone membership changes.

### Why this design
The `cardsById` table remains the durable identity and data source. Board/pile arrays are just location indexes. That made destroy, replenish, search, and later shuffle all compatible with the same rendering and inspection paths.

### Guardrails
- If future rules need "destroy target choice," replace only the random occupied-slot selection; keep the movement semantics.
- Linked C behavior belongs in one helper/policy location if it grows beyond the current slot-index convention.

---

## D8 — C-card boosts are instance-local buffs evaluated through effective stats

### Status
**ADOPTED · PERMANENT PATTERN.** A C card carries the rolled boost; the A card's displayed combat values are derived from live board state.

### Context / problem
C cards changed from regular statted cards into support cards: they may be placed only next to an occupied A slot, and they boost one of that A card's HP/ATK/DEF values. The boost must revert if the C card leaves the linked slot.

### Decision
Represent the boost on the C card instance and compute the A card's live numbers when needed:

- `StatKey`, `StatBuff`, and optional `Card.buff` were added to the domain model (`src\state\types.ts`).
- `rollCBuff(rand)` chooses a stat and amount from `BUFF_AMOUNTS`; `dropCard` assigns the rolled buff when a C card is set (`src\state\combatStats.ts`, `src\state\gameStore.ts`).
- `slotPlaceable(board, slotId, cardType)` requires linked A occupancy for C slots and powers both highlights and drop validation (`src\board\slotRules.ts`, `src\render\SlotView.tsx`).
- `effectiveStats(state, aSlot)` reads the linked C slot live and returns value+delta for HP/ATK/DEF (`src\state\combatStats.ts`).
- `AZoneStats` renders those effective values centered between linked A/C slots (`src\render\AZoneStats.tsx`).
- C card faces and pile tiles show boost-only text, not HP/ATK/DEF (`src\cards\CardView.tsx`, `src\ui\PileSearchModal.tsx`).

### Why this design
The buff is stable once rolled because it is stored on the support card; the application of the buff is reversible because it is derived from board occupancy. No cleanup action is required when a C card moves away — `effectiveStats` simply stops seeing it in the linked C slot.

### Guardrails
- Do not mutate A-card base stats to apply support effects.
- Add future support effects to the effective-stat calculation path instead of scattering arithmetic across UI components.
- Keep C placement legality behind `slotPlaceable` so highlight and store validation cannot diverge.

---

## D9 — B-card abilities are data-driven labels plus a store dispatch, resolved after summon reveal

### Status
**ADOPTED FOR PHASE 3.** B cards are ability cards, not combat bodies.

### Context / problem
The final Phase 3 card-family pass removed B-card HP/ATK/DEF and gave each B card a simple on-play ability. The implementation needed to stay swappable as real card data arrives and avoid hard-coding UI text in several places.

### Decision
Add a small ability vocabulary:

- `BAbility = 'draw1' | 'graveyardIntoDeck' | 'replenIntoDeck' | 'draw2'` and `B_ABILITY_LABEL` live in `src\state\types.ts`.
- `Card.ability?: BAbility`; A cards keep optional `hp/atk/def`, C cards keep optional `buff`.
- `CARD_LIBRARY` assigns one ability to each B card (`src\state\cardData.ts`).
- `enactBAbility(ability)` in `gameStore` dispatches to existing actions: draw, graveyard-to-deck shuffle, replenish-to-deck shuffle, or staggered draw-two (`src\state\gameStore.ts`).
- The ability resolves from the summon timer after `SUMMON_SHOWCASE_MS`, so the card reads as activating once it lands.
- `drawStaggered(n)` uses `MULTI_DRAW_STAGGER_MS = 200` so multi-draws leave the deck sequentially (`src\animation\motionConfig.ts`, `src\state\gameStore.ts`).

### Consequences / tradeoffs
- (+) Ability text and behavior share one enum vocabulary.
- (+) Existing pile and draw actions are reused instead of duplicated in B-card code.
- (−) The ability system is still a switch, not a general rules engine. That is acceptable at four abilities but should be revisited when real card scripts expand.

### Guardrails
- Add B abilities by extending `BAbility`, `B_ABILITY_LABEL`, and `enactBAbility` together.
- Keep the current "resolve after reveal" timing unless a future turn/rules phase introduces a formal effect stack.

---

## D10 — Summon reveal is transient store state that takes priority in the pose selector

### Status
**ADOPTED · ANIMATION PATTERN.** Timed one-shot animations are represented as transient state plus selector priority, not imperative mesh manipulation.

### Context / problem
The user wanted a just-set card to pop up large over the game, ripple, then disappear and animate down to the chosen slot. The existing animation architecture springs cards to one target pose at a time; there is no timeline engine.

### Decision
Reuse the project's transient-state pattern:

- `SummonState { cardId, slotId }` and `GameState.summon` track the active reveal (`src\state\types.ts`).
- `dropCard` performs the board placement synchronously, sets `summon`, then clears it after `SUMMON_SHOWCASE_MS = 800` if the same card is still revealing (`src\state\gameStore.ts`).
- `selectCardVisual` checks `state.summon` before board/hand/deck and returns `summonShowcasePose()`, `SUMMON_SHOWCASE_SCALE = 2.4`, and `SPRING.summon` (`src\animation\poseSelectors.ts`, `src\board\layout.ts`, `src\animation\motionConfig.ts`).
- When `summon` clears, the same card falls through to its board pose and springs from showcase position to slot.
- `SummonRipple` renders two delayed gold rings at `SUMMON_SHOWCASE_POSITION` (`src\render\SummonRipple.tsx`).
- `AZoneStats` suppresses the stat plate for an A card while it is revealing, then shows it once the card lands (`src\render\AZoneStats.tsx`).

### Why this design
The card remains one entity with one pose selector. There is no duplicate hidden "summon card" mesh and no imperative animation callback. The store states *why* the card should be elsewhere; the existing spring layer handles motion.

### Guardrails
- For future one-shot animations, prefer transient flags plus selector priority over imperative refs.
- Guard timeouts by matching the active card/id before clearing state; otherwise overlapping animations can clear the wrong reveal.
