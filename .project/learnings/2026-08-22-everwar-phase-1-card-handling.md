# Learnings — Everwar Phase 1: Card-Handling Vertical Slice

**Date:** 2026-08-22  
**Cycle:** Phase 1 — tactile card handling (no game rules)  
**Commit:** `4da6653`  
**Version bump:** 0.1.0 → 0.2.0 (MINOR — significant new product slice)

---

## What Shipped 🎉

Phase 1 delivered a complete tactile 3D card-handling experience: a 10-card deck,
staggered opening deal of 5, a camera-facing hand fan with correct painter ordering,
hover-to-raise, click-drag on the board plane, three gold-highlighted placement slots,
valid-drop snap, invalid-drop spring-back, and 32 green Vitest tests — with NO game
rules anywhere in the codebase. The state-is-authoritative / animation-is-dumb
architecture came through cleanly and will be a great foundation for Phase 2.

The feel-bar target (Yu-Gi-Oh Master Duel) was met for the motion slice: cards have
weight, snapping is satisfying, spring-back is smooth, and interrupting any animation
mid-flight retargets without a visual teleport.

---

## What Worked Well

### 1. State-authoritative architecture from day one
Establishing the Zustand vanilla store (`gameStore.ts`) as the single source of truth
before writing a single render component meant that every animation path was trivially
correct — the spring always interpolates toward the right target because the target
comes directly from state, not from component-local guesses. This paid back immediately
during the DOM-input rework: changing input wiring required zero animation changes.

### 2. Pure pose math as a testable boundary
Keeping `src/board/layout.ts` free of Three.js scene state (and indeed of any
side-effects) meant every layout invariant could be asserted in unit tests before a
single pixel rendered. The fan-basis vectors (`FAN_RIGHT`, `FAN_UP`, `FAN_NORMAL`)
exported from `layout.ts` were directly usable in `poseSelectors.ts` for the hover-lift
direction — a clean cross-module reuse that didn't require any structural change.

### 3. `createGameStore` factory for test isolation
Exporting a factory from `gameStore.ts` and a shared singleton from `useGameStore.ts`
gave tests perfectly isolated state with zero mocking. Every test that touched store
actions called `createGameStore()` directly. No `beforeEach` reset hacks needed.

### 4. View-plane fan math eliminating ghosting
Once the fan layout was expressed as a true orthonormal basis in the camera's view
plane — with depth (painter order) carried exclusively by the TO_CAMERA component —
the z-buffer occlusion became provably correct: each card sits strictly in front of
the card to its left, regardless of arc depth or fan tilt angle. The previous approach
(world-space X spread + world Y dip) created cases where arc outer cards were at the
same camera depth as inner cards, causing intermittent ghosting. The view-plane basis
eliminated this class of bug entirely.

---

## Pitfalls Hit and How They Were Resolved

### Pitfall 1: R3F `onPointer*` events dead in the runtime

**What happened:** After wiring card click/drag through R3F's standard `onPointerDown`,
`onPointerMove`, `onPointerUp` on mesh components, events simply never fired in the
embedded Copilot canvas runtime. Extensive debugging (including checking event
propagation, canvas focus, and R3F version compatibility) confirmed that R3F's
internal synthetic event system does not reliably dispatch in iframes or non-standard
embedded canvases.

**How it was resolved:** The entire input layer was rebuilt as a DOM-level solution
(`PointerControls.tsx`) that attaches `window.addEventListener` for `pointerdown`,
`pointermove`, and `pointerup`. Rather than relying on R3F's scene graph hit-testing,
picks are computed manually in `pickMath.ts` against authoritative poses using a
standard Three.js `Raycaster`. The live camera is passed through a thin bridge:
`ThreeBridge.tsx` (inside the canvas, reads `useThree`) writes the camera reference
to `threeAccess.ts` (a module-level singleton), which `PointerControls.tsx` reads
outside the canvas.

**Permanent constraint:** This is NOT a workaround to remove later. R3F events are
unreliable in this runtime and should never be used for input. All future input work
must go through `PointerControls.tsx` or a successor that uses the same DOM+manual
raycast pattern.

**Files involved:** `src/input/PointerControls.tsx`, `src/input/pickMath.ts`,
`src/input/threeAccess.ts`, `src/render/ThreeBridge.tsx`.

**Deleted files (correcting the old CHANGELOG draft):** `DragLayer.tsx` and
`DeckView.tsx` were written during the R3F-events attempt and deleted during the rework.
They do not exist in the final codebase.

---

### Pitfall 2: Hand-fan ghosting and staircase layering

**What happened:** The initial hand fan used world-space X for horizontal spread and
world-space Y (or local Z) for depth. Under the angled perspective camera this created
a "staircase" effect where outer cards were perceived as either behind or at equal depth
to inner cards, causing z-buffer ghosting (cards flickering through each other).

**How it was resolved:** The fan math was refactored to construct an orthonormal basis
in the camera's view plane:
- `RIGHT = normalize(world_up × TO_CAMERA)` — screen-horizontal, no depth change
- `VIEW_UP = normalize(TO_CAMERA × RIGHT)` — screen-vertical, no depth change
- `TO_CAMERA` — the only depth axis; layering along this guarantees strict painter order

Each card's position is then: `spread * RIGHT - dip * VIEW_UP + layer * TO_CAMERA`.
Because only the `layer * TO_CAMERA` term affects camera distance, the z-buffer gives
perfectly clean right-over-left occlusion regardless of arc depth or camera angle.

**Key insight:** Fan ghosting in a 3D card game is almost always a painter-order problem,
not an art problem. The fix is geometric, not a material/rendering tweak.

---

### Pitfall 3: Zustand selector returning fresh arrays causing infinite re-render loops

**What happened:** An early version of `CardEntity` used a selector like
`useGameStore(s => s.hand.map(...))` which returns a new array reference on every call.
Zustand's default equality check is reference equality, so the component re-rendered
every store update even when the hand didn't change — in the worst case creating a
re-render loop that could spike CPU.

**How it was resolved:** Two approaches were adopted as project standards:
1. **Subscribe to primitives or stable references, not derived arrays.** `CardEntity`
   subscribes to `s` (the whole state), computes the visual locally with `selectCardVisual`,
   and relies on the fact that the store is a single normalized object whose reference
   changes only on actual mutations.
2. **Selectors that must return arrays use stable references or `useShallow`.** Any
   selector producing a new array per call should be wrapped with Zustand's `useShallow`
   comparator.

**Rule:** Never return `array.map(...)`, `array.filter(...)`, or object literals from a
Zustand selector without either `useShallow` or memoization. The re-render cost shows
up immediately with animated components.

---

## Taskboard Analysis

### Stories Delivered as Scoped

All 19 Phase 1 stories (P1-S01 through P1-S19) were delivered. The dependency backbone
was accurate; no story had a hidden dependency that wasn't captured in the taskboard.

| Story | Verdict |
|---|---|
| P1-S01 Scaffold | Delivered as scoped. |
| P1-S02 Domain types | Delivered as scoped. |
| P1-S03 drawCard | Delivered as scoped. |
| P1-S04 Drag state actions | Delivered; `hoverCard` action added (not originally listed) for hover-lift state. |
| P1-S05 Slot rules | Delivered as scoped. |
| P1-S06 Fan/pose math | Delivered, but significantly reworked mid-cycle (view-plane basis). |
| P1-S07 Scene shell | Delivered as scoped. |
| P1-S08 Card prefab | Delivered as scoped. |
| P1-S09 Deck stack render | Delivered as scoped. |
| P1-S10 Pointer pick + drag | **Significantly changed mid-cycle.** Original AC specified R3F raycasting; final implementation is DOM-level `PointerControls` + manual raycast. AC was technically met (pointer picks and projects correctly) but through a completely different mechanism than planned. |
| P1-S11 Slot hit-test + highlight | Delivered as scoped; `hitTest.ts` / `slotAtPoint` matches AC. |
| P1-S12 Valid drop snap | Delivered as scoped. |
| P1-S13 Invalid drop return | Delivered as scoped. |
| P1-S14 Single draw animation | Delivered as scoped (same spring path as hand reflow). |
| P1-S15 Opening deal | Delivered; extra guard against StrictMode double-invocation was added beyond original AC. |
| P1-S16 Hand reflow + hover lift | Delivered; hover lift uses VIEW_UP direction (from fan basis), not a naive Y-up, per the corrected fan math. |
| P1-S17 Click-deck draw | Delivered as scoped. |
| P1-S18 Feel + polish | Delivered; `motionConfig.ts` centralizes all spring/easing constants. |
| P1-S19 Full regression pass | Delivered; 32 tests green. Count increased from original "30" estimate. |

### Stories That Changed Mid-Cycle

**P1-S10 (Pointer pick and drag)** changed the most. The AC was scoped around R3F
raycasting, which turned out to be impossible in the runtime. The entire mechanism was
rebuilt. The AC's *intent* (pointer picks the right card, projects onto the board plane)
was met, but the implementation was a fundamental architecture change — not a detail.

**P1-S06 (Fan/pose math)** was completed once and then reworked. The first implementation
was numerically correct but produced ghosting artifacts under the angled camera. The
view-plane-basis rework fixed it. The AC's "stable fan/arc" criterion wasn't specific
enough to catch this until a rendered browser pass.

**P1-S04 (Drag state actions)** required adding `hoverCard` / `hoveredCardId` to the
state, which was not in the original story. It's a small addition but shows that hover
state was under-specified in the planning phase.

### Were Acceptance Criteria Clear Enough?

**Mostly yes for pure-logic stories.** Stories S02–S05 had crisp, testable ACs and
shipped without surprises. TDD worked well here.

**Less so for rendering/input stories.** Three issues:
1. **S10's AC assumed R3F events would work** — the "pointer logic calls state actions
   rather than mutating render state directly" rule was correct in intent, but the
   implementation mechanism (R3F vs. DOM) was underspecified. The AC should have included
   a constraint about runtime compatibility.
2. **S06's "stable fan/arc" AC was too vague** — it didn't require the stronger property
   of "strict right-over-left occlusion regardless of camera angle," which is what
   actually matters. A rendered verification step caught it, but the unit test wouldn't
   have.
3. **S16's "hover lift applies only to hand cards"** was clear, but the *direction* of
   the lift (VIEW_UP vs. world Y) wasn't specified. The correct direction (VIEW_UP from
   the fan basis) was found by inspection, not from the AC.

### Recommendations for the Planner (Phase 2: Game Board Setup)

1. **Add a "runtime constraint" row to input stories.** Any story touching pointer/mouse
   input must include an explicit constraint: "Input MUST use DOM-level window listeners
   via `PointerControls.tsx`; R3F `onPointer*` events are forbidden." This prevents a
   repeat of the S10 architecture rework.

2. **Tighten rendering ACs with visual invariants, not just behaviors.** "Cards show a
   fan arc" is not as useful as "each hand card must be strictly in front of its
   left-adjacent neighbor from the camera's perspective, at all hand sizes." Specify the
   property, not just the appearance.

3. **Add an explicit `hoverCard`-style state field to any new interaction story.** Hover
   lift was an emergent need in S04/S16. For Phase 2 interactions (e.g. targeting,
   selection, zone highlight), plan the Zustand state fields for UI-only state (hover,
   selection highlight) alongside the domain actions.

4. **Scope the Zustand selector pitfall as a project-wide constraint.** Add to the
   project spec or architecture doc: "Selectors that return arrays/objects must use
   `useShallow` or stable references." This prevents the re-render loop pitfall from
   reappearing as the Phase 2 scene becomes more complex.

---

## Skill / Learning Candidates (for Orchestrator classification)

| # | Proposed Name | Universal vs. Project-Specific | Description |
|---|---|---|---|
| 1 | `dom-input-over-r3f` | **Project-specific** (permanent constraint) | R3F `onPointer*` events are dead in this embedded runtime. All input must use `PointerControls.tsx` (window listeners + manual Raycaster). Never wire input through R3F's event system. |
| 2 | `view-plane-fan-layout` | **Project-specific** | Hand fan layout uses an orthonormal basis in the camera's view plane; the TO_CAMERA component is the only depth term, guaranteeing strict painter order without ghosting. |
| 3 | `zustand-selector-no-fresh-arrays` | **Universal** | Returning a new array/object from a Zustand selector on every call causes infinite re-renders. Use `useShallow`, stable references, or subscribe to the whole state and derive locally. |
| 4 | `state-authoritative-animation-dumb` | **Universal** | Spring animations should target poses derived entirely from authoritative state. The animation layer interpolates; it never owns data. This makes mid-flight interruptions correct by construction. |
| 5 | `factory-store-for-test-isolation` | **Universal** | Export a store factory (`createGameStore`) separately from the app singleton so tests get isolated instances with no shared state and no reset hacks. |
