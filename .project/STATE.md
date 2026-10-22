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
| **Current phase / gate** | Everwar TCG · **Phase 7 build COMPLETE, user-approved & committed** — running **Gate 3 close-out** (docs for Phase 7). Next: commit the Phase 7 doc set, then take Phase 8 direction |
| **Active branch** | worktree branch off `main`. Landed: Phase 1 (`4da6653`, `ca4e7e0`, `fad36b7`), Phase 2 (`1a54534`, `37d7944`), Phase 3 (`2b63640`→`f15d8fc`), Phase 4 (`7f4063b`), Phase 5 (`6385a1b`), Phase 6 (`19a32c9`), Phase 7 (`3094c10`, `58efc39`, `674ec66`, `2a0a5b1`, `20e802b`, `f396500`). Phase 7 **code committed**; only the doc set is uncommitted |
| **In-flight** | Phase 7 close-out docs (architecture-log P7 decisions, learnings, reviewer-log, taskboard, client-docs) + CHANGELOG 0.8.0 + this snapshot + current-architecture refresh |
| **Last milestone** | Phase 7: opponent promoted to a **full second player** (real deck/hand/replen/graveyard + A/B/C board), **auto-run opponent turn** (`runOpponentTurn`, player-first, `oppActive()`-guarded), **bidirectional combat** (opponent attacks player A-cards; death + linked C → player graveyard), **heuristic AI** (greedy one-per-type A→C→B, focus-fire), **hidden hand + reveal-on-set fly-in**, **paced plays** (`OPP_PLAY_GAP_MS`/`OPP_MAIN_DURATION_MS`), per-field turn border, full opponent inspection + pile popups, truthful shrinking deck. 139 tests green, user-approved feel |
| **Blocked on** | Nothing — finishing close-out. Remote push still pending user approval (unavailable in this environment) |
| **Next up** | Commit the Phase 7 doc set; then take Phase 8 direction from the user. **No win/loss yet** (loop alternates indefinitely); opponent tribute/Commander and B-card ability firing deferred |
| **Last updated** | 2026-08-23 — Orchestrator |

### Project snapshot
- **What:** Everwar — 3D TCG. Phase 1 = tactile card-handling slice. Phase 2 = typed multi-zone field. Phase 3 = card systems (inspection, piles, stat overlays, B/C abilities & boosts). Phase 4 = turn/phase loop + battle declaration + resolution dice. Phase 5 = dice combat rules, HP/DMG/ACC stats, damage/death, player→opponent targeting. Phase 6 = mirrored opponent board, stat-tag/camera polish, level/tribute summoning + Commander. Phase 7 = opponent as a full second player (real deck/hand/board), auto-run opponent turn, bidirectional combat, heuristic AI, hidden-hand reveal + paced plays. Feel bar = Master Duel.
- **Stack:** TypeScript · React + Vite · Three.js / React Three Fiber + drei · Zustand state · @react-spring/three tweens · Vitest.
- **Locked decisions:** browser-first (desktop later) · angled 3D board (flattened in Phase 6 for readable stat tags) · mouse-only · procedural placeholder cards · auto-deal 5 then click-deck to draw · **12 typed slots per side (A/B/C×4), place-and-stay** · **type-gated placement (empty + matching type only)** · **board cards shrink via per-card visual scale; hand stays full size** · **slot type encoded in the slot id** · camera centered on x=0 (preserves the frozen fan basis) · **phase state machine Draw→Main→Battle→Resolution→End** · **pure `diceRules`/`combatStats` rules modules** · **subset-sum tribute rule for level-3/Commander summons** · **"shuffle into deck" routes through the replen pile** · motion juice only (no audio/VFX) · invalid drop snaps back to hand.

## Notes
- The Orchestrator owns this file. If it's stale, resumption and `boot` degrade —
  keep it honest.
- For a **harness-authoring repo**, this tracks harness work; for a **downstream
  product repo**, it tracks the product's current cycle.
