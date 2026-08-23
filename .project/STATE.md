# Project State

> **The "where are we right now" file.** The Orchestrator keeps this current so any
> agent — or a fresh session, or a `boot` — can instantly recover context without
> reconstructing it from git log and checkpoints. Update it whenever the workflow
> state changes (gate transition, story start/finish, branch switch, milestone).
>
> This is a live status snapshot, NOT a log. Overwrite fields in place; history
> lives in `architecture-log/`, `reviewer-log/`, and `learnings/`.

| Field | Value |
|-------|-------|
| **Current phase / gate** | Everwar TCG · **Phase 1** — **Gate 2** (TDD build loop in progress) |
| **Active branch** | `npawlakel-tcg-phase-1-card-animations` (worktree; base `main`) |
| **In-flight** | Card-handling vertical slice: scaffold + state + board logic + render + drag/drop all landed; 30 tests green; dev server + preview running |
| **Last milestone** | Playable Phase 1 slice: deck of 10, staggered deal of 5, click-draw, hover-lift, drag, gold slot highlight, snap/return |
| **Blocked on** | User rendered-verification of feel (Constraint #14), then Reviewer full pass → Gate 2.5 push approval |
| **Next up** | Visual review → feel/polish + interruptibility tuning (P1-S17) → full regression → Gate 2.5 |
| **Last updated** | 2026-08-22 — Orchestrator |

### Project snapshot
- **What:** Everwar — 3D TCG. Phase 1 = tactile card-handling vertical slice (no rules). Feel bar = Master Duel.
- **Stack:** TypeScript · React + Vite · Three.js / React Three Fiber + drei · Zustand state · spring/GSAP tweens.
- **Locked decisions:** browser-first (desktop later) · angled 3D board · mouse-only · procedural placeholder cards · auto-deal 5 then click-deck to draw · 3 spots, place-and-stay · motion juice only (no audio/VFX) · invalid drop snaps back to hand.

## Notes
- The Orchestrator owns this file. If it's stale, resumption and `boot` degrade —
  keep it honest.
- For a **harness-authoring repo**, this tracks harness work; for a **downstream
  product repo**, it tracks the product's current cycle.
