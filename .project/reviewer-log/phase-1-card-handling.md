# Reviewer Log — Everwar Phase 1

## 2026-08-22 · R-001 · Blank screen after initial flash (Gate 2, pre-review)

**Phase:** Phase 1
**Severity:** Blocking (app unusable — black screen)
**Found by:** User rendered-verification (Constraint #14) during first preview.
**Symptom:** A flash of the board on load, then black. Nothing interactive.

**Root cause:** `GameScene` subscribed with `useGameStore((s) => Object.keys(s.cardsById))`. The selector returns a **new array reference every render**, so Zustand's `useSyncExternalStore` snapshot never stabilized → infinite re-render loop → React unmounted the tree (black screen). Classic Zustand v5 "getSnapshot should be cached" pitfall.

**Introduced by:** Coder, in the render-layer story (GameScene composition).

**Fix (verified):** Select the stable `cardsById` object and derive `Object.keys(...)` in the render body instead of inside the selector. `useGameStore((s) => s.cardsById)` returns a stable reference (cards never change after init), breaking the loop. User confirmed the scene renders and all cards are visible.

**Resolution status:** RESOLVED — user confirmed render.

**Guardrail / learning candidate (for Retro):** Never return a freshly-allocated array/object/derived value from a Zustand selector. Select stable references (or primitives) and derive in render, or use `useShallow`. Candidate skill: `zustand-selector-stability`.
