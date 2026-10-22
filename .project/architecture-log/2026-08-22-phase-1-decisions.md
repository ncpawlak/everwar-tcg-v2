# Decision Record — Phase 1 · 2026-08-22

**Author:** Senior Coder (end-of-Phase-1 architectural close-out)
**Phase:** Phase 1 — card-handling vertical slice (`4da6653`)
**Scope:** the two architecturally significant decisions that define Phase 1. Both are **permanent project constraints/patterns**, not one-off fixes.

---

## D1 — R3F pointer events are dead in this runtime → DOM-driven input + manual raycaster

### Status
**ADOPTED · PERMANENT CONSTRAINT.** Never rely on React-Three-Fiber `onPointer*` handlers in this project.

### Context / problem
The natural R3F approach is to put `onPointerDown`/`onPointerMove`/`onPointerUp` on meshes (or the `<Canvas>`) and let R3F's built-in raycaster dispatch synthetic pointer events. In this project that **does not work**:

- R3F `onPointer*` handlers **never fire** — observed in BOTH the embedded Copilot browser canvas AND the user's real browser. This is not an embedded-only quirk; it reproduces in a normal browser, so it is treated as a hard environmental constraint.
- Attempting the documented escape hatch — `<Canvas eventSource={...} eventPrefix="client">` to retarget R3F's event source to a DOM element — fired **exactly once and then died**. It is not a reliable workaround.

Because pointer input is the entire point of a *card-handling* slice (draw, grab, drag, drop), a non-firing event system is a blocking, not cosmetic, failure.

### Decision
Bypass R3F's event system entirely and drive input from the DOM with a manually-owned raycaster:

1. **`PointerControls`** (`src\input\PointerControls.tsx`) is a React component that renders `null` and lives **outside** the `<Canvas>` as a DOM sibling (`src\app\App.tsx:26`). On mount it attaches `window` `pointerdown`/`pointermove`/`pointerup` listeners and removes them on unmount (`PointerControls.tsx:74-81`).
2. **`ThreeBridge`** (`src\render\ThreeBridge.tsx`) lives *inside* the `<Canvas>`, reads the live `camera` and `gl.domElement` via `useThree`, and publishes them to a plain mutable module object **`threeAccess`** (`src\input\threeAccess.ts`). It nulls them on unmount.
3. **`pickMath`** (`src\input\pickMath.ts`) owns a single `THREE.Raycaster` (`pickMath.ts:13`). `clientToNdc` converts client pixels to NDC using the canvas rect (`pickMath.ts:17-26`); `pickHandIndex`/`pickDeck` raycast against **card poses recomputed from `layout.ts`** (oriented-rectangle test in `cardRayT`, `pickMath.ts:29-43`); `projectToBoard` intersects the `y=0` board plane for drag position (`pickMath.ts:71-76`).
4. `PointerControls` translates picks into **store actions only** (`beginDrag`/`updateDrag`/`hoverSlot`/`hoverCard`/`dropCard`/`drawCard`), never touching render objects.

### Why this design (not just "add window listeners")
- **Picking targets are authoritative poses, not scene meshes.** `pickHandIndex` recomputes `handCardPoses(hand.length)` and ray-tests the oriented rectangles (`PointerControls.tsx:28-29`, `pickMath.ts:50-62`). This means picking is **immune to in-flight spring matrices** — a card mid-animation is still picked at its logical target, so grab detection never fights the animation layer. It also means input and render can never disagree about where a card is, because both consume `board/layout.ts`.
- **Clean Canvas/DOM seam.** `threeAccess` is the ONE bridge across the React-Three boundary. Everything DOM-side depends on a 2-field object, not on R3F internals.
- **No scene traversal.** Hit-testing is analytic (ray vs. rectangle / ray vs. plane), so there is no dependency on `raycast` flags, layers, or event bubbling.

### Consequences / tradeoffs
- (+) Deterministic, testable picking decoupled from animation; works regardless of R3F event health.
- (+) The math (`pickMath`, `hitTest`) is pure and camera-injectable → unit-testable.
- (−) We re-implement what R3F would normally give for free (NDC conversion, raycasting, front-most selection).
- (−) Pose math is duplicated in *use*: render reads it via `selectCardVisual`, input re-derives it. Mitigated because both import the same `layout.ts` — there is a single source of truth, just two call sites.
- (−) `CardView` still carries a `pickable`/`raycast={()=>null}` prop (`CardView.tsx:10,19`) — vestigial from the R3F-picking assumption; harmless but should be pruned when convenient.

### Guardrails for future phases
- Do **not** add `onPointer*` to meshes/Canvas and assume it fires. If a future R3F/runtime upgrade fixes this, migrating back is a deliberate decision requiring re-verification in the real browser, not a default.
- Any new interactive surface (buttons, board re-pickup, opponent zones) goes through `PointerControls` + `pickMath`, extending the analytic picking, not R3F events.
- Keep `threeAccess` as the sole Canvas↔DOM bridge; do not proliferate globals.

### Skill candidate surfaced
`r3f-events-dead-use-dom-input` (universal): when R3F `onPointer*` won't fire in a runtime, drive input from `window` pointer listeners + a manual `THREE.Raycaster` against the live camera (published out of the Canvas via a small bridge), and raycast against logical poses rather than animated meshes.

---

## D2 — Hand-fan occlusion via parallel camera-facing planes laid out in the view plane

### Status
**ADOPTED · PERMANENT PATTERN.** The fan is laid out in the camera's view plane; depth order is owned solely by the view-normal step.

### Context / problem
A premium hand fan must satisfy three things at once under a **fixed overhead-ish camera** (`CAMERA_POSITION = [0, 6.8, 6.6]` looking at `[0,0,-0.8]`):
1. cards splay outward like a real hand,
2. the fan arcs (middle highest, ends dip), and
3. overlap is **strictly** "each card under the card to its right" with **no interpenetration or ghosting**.

Two earlier approaches failed, and both are recorded here as anti-patterns:

- **Anti-pattern A — arc dip in world-Y.** Dipping the outer cards downward along world-Y changed each card's distance to the *overhead* camera. Under this camera, world-Y is largely "toward camera," so end cards ended up **behind** the middle card in depth → the middle card drew on top of its neighbors, breaking the left-under-right order.
- **Anti-pattern B — depth layering along world-Z.** Offsetting successive cards along world-Z to force overlap order produced a diagonal **"staircase"**: because world-Z is not aligned with the camera's view direction, stepping along it also slid cards across the screen, so the "stack" sheared diagonally instead of layering cleanly.

The root cause of both: **mixing world axes with screen/depth intent.** Under a tilted camera, world-Y and world-Z each carry a mix of on-screen motion and toward-camera depth, so using them for "arc" or "layer" contaminates depth ordering.

### Decision
Lay the entire fan out in the **camera's view plane** using an orthonormal basis derived from the fixed camera, and make depth a single dedicated axis:

- `TO_CAMERA` = normalized (`CAMERA_POSITION − HAND_ANCHOR`) — the view normal (`layout.ts:29-36`).
- `RIGHT = up × TO_CAMERA` — screen-horizontal (`layout.ts:54`).
- `VIEW_UP = TO_CAMERA × RIGHT` — screen-vertical (`layout.ts:55`).
- Exported as `FAN_RIGHT` / `FAN_UP` / `FAN_NORMAL` (`layout.ts:62-64`) for tests and the hover-lift.

Each hand card position (`handCardPoses`, `layout.ts:104-121`) is:
```
pos = HAND_ANCHOR
    + RIGHT     * spread   // offset * spacing            — horizontal fan (NO depth change)
    - VIEW_UP   * dip      // offset^2 * HAND_ARC_DIP      — arc dips ends DOWN on screen (NO depth change)
    + TO_CAMERA * layer    // offset * HAND_LAYER_STEP     — the ONLY depth term
```
Orientation (`handRotation`, `layout.ts:72-76`): face the camera (`FACE_CAMERA_Q`, turning local +Z toward the camera) then apply splay **roll about `TO_CAMERA`** via quaternion. Rolling about the view normal keeps every card a **plane parallel** to all the others — they differ only by an in-plane rotation, so stacking them along the view normal never causes interpenetration.

### Why this is correct by construction
- `RIGHT` and `VIEW_UP` are both perpendicular to `TO_CAMERA`, so **spread and dip move cards purely within the screen plane and cannot change distance to the camera.** Arc can therefore *never* flip depth order (kills anti-pattern A).
- Depth is owned **solely** by the `TO_CAMERA * layer` term, which is aligned with the view direction, so stepping along it layers cards without sliding them across the screen (kills anti-pattern B — no staircase).
- `HAND_LAYER_STEP = 0.02` (`boardConfig.ts:52`) is kept just larger than `CARD_THICKNESS = 0.018` so each righter card wins the z-buffer over its left neighbor — strict right-over-left — while the on-screen drift is imperceptible.
- Because all cards are parallel camera-facing planes offset only along their shared normal, the z-buffer resolves every overlap cleanly: **zero ghosting, zero interpenetration.**

### Tuning constants (single source of truth: `boardConfig.ts`)
- `HAND_CARD_SPACING = 0.5`, compressed by `HAND_MAX_HALF_WIDTH = 1.22` (`layout.ts:102-103`) so the fan packs tighter as the hand grows and spreads back as it shrinks.
- `HAND_ARC_DIP = 0.006` (quadratic in offset → parabolic arc).
- `HAND_TILT_PER_CARD = 0.025` rad (splay roll).
- `HAND_LAYER_STEP = 0.02` (depth step, > card thickness).

### Regression protection
`board\layout.test.ts` asserts the invariants that would catch a regression to either anti-pattern:
- arc dip measured **along `FAN_UP`** (in-plane), center highest (`layout.test.ts:48-54`);
- depth **strictly increasing along `FAN_NORMAL`** left→right, "whatever the arc does" (`layout.test.ts:56-63`);
- symmetric centering, symmetric splay roll, and max-half-width compression.

### Consequences / tradeoffs
- (+) Occlusion is guaranteed by geometry, not by tuning; the arc can be as deep as desired without breaking order.
- (+) Layout math is pure and fully unit-tested.
- (−) The basis is **computed once at module load from the fixed camera** (`layout.ts:29-55`). This is correct only while the camera is fixed. **Any Phase-2 camera movement breaks the fan silently** — the basis must then become a function of the live camera, and picking (which recomputes `handCardPoses`) inherits the same constraint. Flagged in the architecture quality pass (debt #2).

### Skill candidate surfaced
`billboard-fan-viewplane-layering` (universal): to fan/stack camera-facing cards with strict, ghost-free overlap under an arbitrary (esp. tilted) camera, build an orthonormal basis from the view normal (`right`, `view-up`, `to-camera`); spread and arc **within** the view plane, apply splay roll **about the view normal** so all cards stay parallel planes, and reserve one dedicated along-normal step for painter/z-order. Never use world-Y for arc or world-Z for layering under a tilted camera.
