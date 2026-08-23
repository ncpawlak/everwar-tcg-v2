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
| **Current phase / gate** | Everwar TCG · **Phase 2 build COMPLETE, user-approved** — running **Gate 3 close-out** (Senior + Learner in parallel). Next: land close-out docs |
| **Active branch** | worktree branch off `main` (Phase 1: `4da6653`, `ca4e7e0`, `fad36b7`; Phase 2 build: `1a54534`) |
| **In-flight** | Senior Coder (architecture-log) + Learner (CHANGELOG/learnings/client-docs) writing Phase 2 close-out docs in parallel |
| **Last milestone** | Phase 2 game board: 12 typed slots (A/B/C×4) — top `[A\|C]` pairs aligned with grave, B row centered under pairs aligned with deck/replen; 12-card typed deck; A/B/C letter faces; board-scale shrink; type-gated placement + highlight. 43 tests green, user-approved feel |
| **Blocked on** | Nothing — finishing close-out. Gate 2.5 remote push still pending user approval |
| **Next up** | Commit close-out docs + classify any surfaced skills; then remind user Gate 2.5 push is available and await Phase 3 direction |
| **Last updated** | 2026-08-22 — Orchestrator |

### Project snapshot
- **What:** Everwar — 3D TCG. Phase 1 = tactile card-handling slice (no rules). Phase 2 = typed multi-zone player field (no rules). Feel bar = Master Duel.
- **Stack:** TypeScript · React + Vite · Three.js / React Three Fiber + drei · Zustand state · @react-spring/three tweens.
- **Locked decisions:** browser-first (desktop later) · angled 3D board · mouse-only · procedural placeholder cards · auto-deal 5 then click-deck to draw · **12 typed slots (A/B/C×4), place-and-stay** · **type-gated placement (empty + matching type only)** · **board cards shrink via per-card visual scale; hand stays full size** · **slot type encoded in the slot id** · camera fixed & centered on x=0 (preserves the frozen fan basis) · motion juice only (no audio/VFX) · invalid drop snaps back to hand.

## Notes
- The Orchestrator owns this file. If it's stale, resumption and `boot` degrade —
  keep it honest.
- For a **harness-authoring repo**, this tracks harness work; for a **downstream
  product repo**, it tracks the product's current cycle.
