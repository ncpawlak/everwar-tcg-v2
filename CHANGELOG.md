# Changelog

## Versioning Scheme

**Format:** `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)

| Position | When to increment | Example |
|----------|-------------------|---------|
| **PATCH** (0.0.X) | Minor revision, bug fix, hot-patch, small change | `0.0.1` → `0.0.2` |
| **MINOR** (0.X.0) | Major feature addition, significant new functionality | `0.1.0` → `0.2.0` |
| **MAJOR** (X.0.0) | Full version release — a component of all accumulated changes, milestone delivery | `0.2.3` → `1.0.0` |

## Ownership

- The **Learner** updates this file after every cycle (Gate 3)
- The **Orchestrator** approves version number increments
- Version bumps are committed alongside learnings and docs

---

## [Unreleased]

## [0.3.0] — 2026-08-22

### Everwar — Phase 2: Game Board Setup ✅

> Phase 2 replaces the 3 generic placement slots with a typed, multi-zone player field and enforces card-type placement rules. Stack unchanged: TypeScript · React + Vite · Three.js / React Three Fiber v8 + drei · Zustand · @react-spring/three · Vitest.

#### Added

- **12-slot typed field** — three card families **A, B, C**, each with 4 column slots. Top row: four `[A | C]` pairs side by side (`A1 C1 … A4 C4`). Bottom row: four `B` slots, each centered on the x-midpoint of its paired A/C columns (`src/board/boardConfig.ts`, `src/state/cardData.ts`).
- **GRAVE and REPLEN placeholder zones** — labeled empty tiles with no behavior yet; rendered via `PLACEHOLDER_ZONES` in `boardConfig.ts` and `SlotView.tsx`.
- **Type-gated placement rule** — `canDrop` (and the new `validTargetSlots`) in `slotRules.ts` now require a card's type to match the target slot's type family. An empty C slot accepts a C card regardless of whether its paired A is filled.
- **Drag-time type highlight** — only matching-type empty slots glow gold during a drag; non-matching and filled slots never highlight (`SlotView.tsx` subscribes to `dragging` card type).
- **`CardType` discriminant in card id** — `SlotId` is a template literal type `` `${CardType}${SlotIndex}` `` so the accepted type is derivable from the id itself (`slotType(slotId)` in `types.ts`), with no parallel type map needed.
- **Card type letter on face** — `CardView.tsx` renders the card's A/B/C type letter instead of a number; cream look preserved.
- **Board/deck card visual scale** — `BOARD_CARD_SCALE = 0.72` in `boardConfig.ts`; `MotionCard.tsx` applies this scale to board- and deck-zone cards so the wide field fits at a Master-Duel-style smaller size while the hand stays full size. Scale is carried in the animation layer, not in the asset.
- **Interleaved 12-card deck** — `createInitialCards()` generates 4 each of A/B/C interleaved (`A,B,C,A,B,C,…`) so the opening hand of 5 is always type-mixed.
- **43 tests green** — new/updated tests cover typed cards, type-gated drops, all 12 slots hit-testing, and board grid geometry (`gameStore.test.ts`, `slotRules.test.ts`, `hitTest.test.ts`, `layout.test.ts`, `cardData.test.ts`, `poseSelectors.test.ts`).

#### Changed

- **Camera and hand anchor retuned** — `CAMERA_POSITION`, `CAMERA_TARGET`, and `HAND_ANCHOR` adjusted for the wider board; hand pushed toward the player so a hover-raised card clears the B row.
- **Row-zone alignment** — the A/C top row is horizontally aligned with the GRAVE zone; the B bottom row aligns with DECK and REPLEN.
- **`slotRules.ts`** — `canDrop` signature extended with a `cardType` parameter; old `getValidSlots` replaced by `validTargetSlots(board, cardType)`.
- **`types.ts`** — `CardType`, `SlotIndex`, `SlotId` added; `Card` gains a `type` field.
- **`cardData.ts`** — `createInitialCards()` produces 12 typed cards; `SLOT_IDS`, `DECK_SIZE`, `OPENING_HAND_SIZE` exported as constants.

---

### Harness

### Added
- **Fleet mode (auto-scaled parallel execution)** — the Orchestrator now automatically decides whether to run a fleet of parallel Coder ↔ Reviewer loops based on the work: engaged for large *and* shardable tasks (codebase deep-dive, large Finalize, broad refactor/migration, test backfill, multi-repo propagation), single-track for small or tightly-coupled work. Uses exclusive per-loop file ownership (conflict prevention by partition), proportional concurrency, and draft-PR-only rails (never merges). New `.agent/skills/fleet.md`, "Fleet Mode" section in `agents.md`, Constraint #25, Orchestrator routing row + "Automatic Fleet Scaling" section, README "Automatic Behaviors", and a fleet-economics note in `model-config.md`.
- `.project/STATE.md` — a live "where are we" snapshot (current gate, in-flight story, branch, last milestone) the Orchestrator maintains and `boot` reads first, so context recovery is instant instead of reconstructed from git log.
- `.agent/tools/harness-check.mjs` — a zero-dependency, cross-platform integrity checker (mode↔routing parity, skill frontmatter, referenced-path existence, contiguous constraint numbering). Wired into Boot and Nightwatch.
- README "Adopt this harness" quickstart — explicit *copy in → run `boot` first → vision → work the flow* onboarding.
- Categorized index over the Constraints list (by theme) without renumbering, so references stay stable as the list grows.

### Changed
- Finalize now treats **security** as a first-class audit dimension (injection, authz, secrets, unsafe deserialization, SSRF/path-traversal, supply-chain, sensitive-data exposure) in both `agents.md` and the Senior Coder role — was a single thin bullet.
- Skill auto-load scan now explicitly **excludes `README.md`** (it documents the format; it is not a loadable skill) in Constraint #4 and the skills README.
- Fixed the stale README structure diagram (removed a dead `.agent/vision/` path; added `.project/vision.md`, `STATE.md`, `backlog/`, and `.agent/tools/`).

## [0.2.0] — 2026-08-22

### Everwar — Phase 1: Card-Handling Vertical Slice ✅

> Phase 1 is the tactile 3D card-handling experience — no game rules, just the pure feel of picking up, dragging, and placing cards. Feel bar: Yu-Gi-Oh Master Duel. Stack: TypeScript · React + Vite · Three.js / React Three Fiber v8 + drei · Zustand · @react-spring/three · Vitest.

#### Added

- **Procedural card deck** — 10 placeholder cards numbered 1–10, rendered as thin beveled 3D meshes with a numbered face and a distinct back face (`src/cards/CardView.tsx`).
- **Opening staggered auto-deal** — on scene load, 5 cards pop off the deck into the hand with a 260 ms stagger per card (`src/render/OpeningDeal.tsx`). Guarded against React StrictMode double-invocation.
- **Camera-facing hand fan** — a fully view-plane-correct fan arc (`src/board/layout.ts`, `src/board/boardConfig.ts`). Each card's position is decomposed into RIGHT (horizontal spread), VIEW_UP (arc dip), and TO_CAMERA (depth layer) vectors — the depth term alone controls painter order, guaranteeing strict right-over-left occlusion with no z-fighting or ghosting. Fan compresses as the hand grows and spreads as it shrinks.
- **Hover-to-raise** — moving the pointer over a hand card lifts it straight up along the VIEW_UP axis by 50% of the card height as a selection hint. Does not affect drag priority or hand state.
- **Click-to-draw** — after the opening deal, clicking the deck draws one remaining card per click until exhausted. Deck click is guarded during an active drag.
- **Click-drag on board plane** — grab a hand card and drag it; the projected pointer position is tracked on the y = 0 board plane and drives the card's world position in real time.
- **Three placement slots with gold highlights** — `slotA`, `slotB`, `slotC` show a gold outline during a drag whenever they are empty. Filled slots never highlight.
- **Valid-drop snap** — releasing over an empty slot snaps the card to the slot pose (place-and-stay). Placed cards cannot be re-dragged in Phase 1. Hand reflows automatically.
- **Invalid-drop spring-back** — releasing over a filled slot, or outside all slots, leaves the card in the hand and springs it back to its fan pose.
- **Interruptible spring animation** — all visual motion is driven by `@react-spring/three` targeting poses derived directly from authoritative state. Retargeting mid-flight (e.g. grabbing a card during a reflow) is smooth by construction (`src/animation/MotionCard.tsx`, `src/animation/motionConfig.ts`).
- **Authoritative game store** — normalized Zustand vanilla store (`src/state/gameStore.ts`) with actions: `drawCard`, `beginDrag`, `updateDrag`, `hoverSlot`, `dropCard`, `returnToHand`, `hoverCard`, `reset`. State is the single source of truth; the animation layer only visualizes it.
- **DOM-driven input pipeline** — R3F's `onPointer*` events are unreliable in embedded canvas runtimes. The fix: `src/input/PointerControls.tsx` attaches `window` pointer listeners, `src/input/pickMath.ts` manually raycasts against authoritative poses using the camera from `src/input/threeAccess.ts` (populated by `src/render/ThreeBridge.tsx`). This is a permanent project constraint.
- **34 unit/regression tests** green (`npx vitest run`) — covering state transitions, draw order, slot rules, layout math, hit-testing, and pose selection.

#### Changed

- Input architecture reworked from attempted R3F `onPointer*` handlers to a fully DOM-driven pipeline. Files `DragLayer.tsx` and `DeckView.tsx` were removed; their responsibilities now live in `PointerControls.tsx`, `pickMath.ts`, `threeAccess.ts`, and `ThreeBridge.tsx`.

---

## [0.1.0] — 2026-08-17

First versioned baseline of the Agent Harness. Backfilled from 40 prior commits
(2026-07-06 → 2026-08-17) that were never logged — see
`.project/learnings/2026-08-17-changelog-gate-skipped.md`.

### Added — Agents & core workflow
- Six-agent gated workflow: Orchestrator, Planner, Senior Coder, Coder, Reviewer, Learner.
- Six flow gates (1 → 1.5 → 2 → 2.5 → 2.75 → 3) with the user as the merge gate (Gates 2.5 & 2.75).
- Per-agent model recommendations tuned for Opus 4.8 (`.agent/model-config.md`).
- Orchestrator personality (chill surf-bro) and the Agent Visibility Protocol (announce every handoff).

### Added — User-invoked modes
- **Boot** — run-first ingestion ritual: deep-read the harness + project, repo-type detection, harness integrity check, self-verifying Boot Report, commit to the workflow.
- **Finalize** — multi-Senior-Coder read-only codebase audit → one prioritized report.
- **Nightwatch** — scheduled trunk guardian: full suite + mutation on unchanged trunk, drafts fixes (never merges, never weakens a test), morning digest.
- **Retro** — process retrospective that mines logs + corrections and curates skills.
- **Grill Me** — Planner deep requirement interrogation.
- **Regroup** — Planner + Senior Coder joint review.
- **Hot-path** — lightweight route for small fixes.

### Added — Enforcement (Constraints #1–#24)
- Auto-engage Senior Coder on any code-related request — the user never prompts for it (#20).
- Regression guardrail — coupled unit + driver suites run green on every code change; opt-in mutation testing for high-risk modules (#21).
- No Orchestrator drift — delegation does not decay over long sessions (#22).
- Corrections are training data — captured automatically and promoted to skills (#23).
- Gate 3 never skipped — every landed change (incl. Orchestrator-direct harness edits) closes with the Learner: CHANGELOG + learnings (#24).
- Documentation-as-blocking-gate, mandatory review-loop logging, Planner proactive questioning, universal request routing, state tracking, "no shortcuts / workflow is law."

### Added — Skills system
- Skills auto-load by frontmatter (`name`/`description`/`load_when`/`upstream`) description match.
- Universal skills upstream to the `agent-harness` source-of-authority branch.
- Skills: `commit-and-push`, `senior-coder-checklist`, `harness-doc-merge`, `mutation-testing`, `nightwatch`, `boot`, `retro`, `changelog-and-learn`.

### Added — Structure
- `.agent/` (agents.md, roles, skills, model-config), `.project/` (vision, spec, planner-tasks, taskboard + architecture-log / reviewer-log / learnings / backlog / planning-sessions), `.client-docs/` (operator + technical).

### Changed
- Flattened `.project/vision/vision.md` → `.project/vision.md` so the three singular planning docs sit flat while folders stay reserved for multi-entry logs.
- Promotion model: `agent-harness` is the source of authority; `master` mirrors it (harness/workflow-only, identical tree).

### Removed
- Stripped the original lane-config application code to make the repo a generic, reusable harness; scrubbed stale untracked build artifacts from the worktree.