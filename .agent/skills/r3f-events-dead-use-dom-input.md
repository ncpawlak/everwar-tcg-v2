---
name: r3f-events-dead-use-dom-input
description: >
  Use when pointer input in a React-Three-Fiber (R3F) scene doesn't work —
  onClick / onPointerDown / onPointerMove handlers on meshes never fire, or fire
  once then die. Covers the DOM-driven input fallback: window listeners + a
  manual THREE.Raycaster against the live camera.
load_when: >
  R3F/three.js pointer picking, drag, hover, or click is dead or unreliable;
  embedded/streamed canvas runtime. Match keywords: react-three-fiber, r3f,
  onPointerDown, onClick not firing, raycast, drag, hover, pointer events dead.
upstream: true
---
# Skill: R3F events dead → drive input from the DOM

## Trigger
R3F's synthetic pointer events (`onClick`, `onPointerDown/Move/Up`, `onPointerOver`)
do not fire, or fire exactly once and then stop. Common in embedded / streamed /
sandboxed canvas runtimes (e.g. an in-app browser panel), and it can also reproduce
in a normal browser depending on how the canvas is mounted. `eventSource` +
`eventPrefix="client"` may make them fire once, then die again — do not rely on it.

## Diagnosis (fast)
- Add a DOM `window.addEventListener('pointerdown', ...)` counter AND an R3F
  `onPointerDown` counter. If the DOM counter increments but R3F never does
  (neither "hit" nor "missed"), R3F's event system is not processing — stop
  debugging R3F and switch to DOM input.
- Rule out StrictMode double-mount and React version first, but do not expect
  either to be the cause.

## The pattern (permanent fix)
Bypass R3F's event system entirely. Drive all input from the DOM and raycast
manually against the **live camera**:

1. **Bridge the camera + canvas out of the Canvas.** A tiny in-Canvas component
   uses `useThree()` to publish `{ camera, gl.domElement }` to a plain module
   (not React state), then renders `null`.
   ```tsx
   function ThreeBridge() {
     const { camera, gl } = useThree();
     useEffect(() => { threeAccess.camera = camera; threeAccess.canvas = gl.domElement; },
       [camera, gl]);
     return null;
   }
   ```
2. **Attach window pointer listeners** in a sibling DOM component (also renders
   `null`). Convert `clientX/Y` → NDC via `canvas.getBoundingClientRect()`.
   ```ts
   const r = canvas.getBoundingClientRect();
   const ndc = { x: ((cx - r.left) / r.width) * 2 - 1, y: -((cy - r.top) / r.height) * 2 + 1 };
   ```
3. **Raycast with a `THREE.Raycaster`** (`setFromCamera(ndc, camera)`) against your
   **logical/authoritative poses**, NOT the animated meshes — picking stays stable
   even while springs are mid-flight, and hit zones don't jump with hover lifts.
4. Drive the authoritative store from the listeners (down = begin/select,
   move = update/hover, up = resolve). State stays authoritative; animation only
   visualizes.

## Why raycast logical poses, not meshes
If you pick against the rendered meshes, a hover-lift or drag animation moves the
hit target and causes flicker/oscillation. Picking against the target poses the
layout math produces keeps selection deterministic and decoupled from animation.

## Gotchas
- Compute NDC from the canvas rect, not `window.innerWidth/Height`, or picks are
  offset when the canvas isn't full-window.
- Set `document.body.style.cursor` yourself (grab / grabbing / auto) — R3F won't.
- Remember to remove the window listeners on unmount.

## Evidence
Everwar Phase 1 (2026-08-22): all three interactions (deck draw, drag, drop) were
dead through R3F; identical DOM listeners + manual raycast fixed all three
immediately. Recorded as a permanent project constraint. Independently surfaced by
both the Senior Coder and Learner close-out agents.
