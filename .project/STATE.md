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
| **Current phase / gate** | Everwar TCG · **Phase 6 build COMPLETE, user-approved** — running **Gate 3 close-out** (back-propagating docs for phases 3–6). Next: commit the Phase 6 batch + docs, then Phase 7 |
| **Active branch** | worktree branch off `main`. Landed: Phase 1 (`4da6653`, `ca4e7e0`, `fad36b7`), Phase 2 (`1a54534`, `37d7944`), Phase 3 (`2b63640`, `bee4a99`, `47d3c44`, `fbf17bd`, `f15d8fc`), Phase 4 (`7f4063b`), Phase 5 (`6385a1b`). Phase 6 is **uncommitted** in the working tree |
| **In-flight** | Doc back-propagation for phases 3–6 (architecture-log, learnings, reviewer-log, taskboard, client-docs) + CHANGELOG 0.4.0–0.7.0 + this snapshot + current-architecture refresh |
| **Last milestone** | Phase 6: mirrored opponent board (upside-down cards, player-relative stat tags, opponent draw/destroy animations), on-card HP-top / DMG-ACC-bottom stat redesign, flattened camera + board spacing, card-A **summon levels (1/2/2/3)** with **tribute summoning** (subset-sum popup, materials→replen), **Commander card** (materials→graveyard), and "shuffle into deck"→replen rerouting. 127 tests green, user-approved feel |
| **Blocked on** | Nothing — finishing close-out. Remote push still pending user approval (unavailable in this environment) |
| **Next up** | Commit Phase 6 code + all back-propagated docs; then take Phase 7 direction from the user (turn loop is still one-directional player→opponent; no P2 turn or win/loss yet) |
| **Last updated** | 2026-08-23 — Orchestrator |

### Project snapshot
- **What:** Everwar — 3D TCG. Phase 1 = tactile card-handling slice. Phase 2 = typed multi-zone field. Phase 3 = card systems (inspection, piles, stat overlays, B/C abilities & boosts). Phase 4 = turn/phase loop + battle declaration + resolution dice. Phase 5 = dice combat rules, HP/DMG/ACC stats, damage/death, player→opponent targeting. Phase 6 = mirrored opponent board, stat-tag/camera polish, level/tribute summoning + Commander. Feel bar = Master Duel.
- **Stack:** TypeScript · React + Vite · Three.js / React Three Fiber + drei · Zustand state · @react-spring/three tweens · Vitest.
- **Locked decisions:** browser-first (desktop later) · angled 3D board (flattened in Phase 6 for readable stat tags) · mouse-only · procedural placeholder cards · auto-deal 5 then click-deck to draw · **12 typed slots per side (A/B/C×4), place-and-stay** · **type-gated placement (empty + matching type only)** · **board cards shrink via per-card visual scale; hand stays full size** · **slot type encoded in the slot id** · camera centered on x=0 (preserves the frozen fan basis) · **phase state machine Draw→Main→Battle→Resolution→End** · **pure `diceRules`/`combatStats` rules modules** · **subset-sum tribute rule for level-3/Commander summons** · **"shuffle into deck" routes through the replen pile** · motion juice only (no audio/VFX) · invalid drop snaps back to hand.

## Notes
- The Orchestrator owns this file. If it's stale, resumption and `boot` degrade —
  keep it honest.
- For a **harness-authoring repo**, this tracks harness work; for a **downstream
  product repo**, it tracks the product's current cycle.
