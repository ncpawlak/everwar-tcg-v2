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

## [0.7.0] — 2026-08-23

### Everwar — Phase 6: Opponent Board, Combat Polish & Tribute Summoning ✅

> Phase 6 mirrors the field for an opponent, reworks the on-card stat tags and camera to read like Master Duel, and adds the level/tribute summoning system with a Commander card. Stack unchanged: TypeScript · React + Vite · Three.js / React Three Fiber v8 + drei · Zustand · @react-spring/three · Vitest.

#### Added

- **Mirrored opponent board** — the opponent gets the exact same multi-zone field mirrored across the table: deck/replen sit top-left, cards render upside-down, but the HP/DMG/ACC stat tags stay player-relative (right-side-up) so they're always readable. New `OpponentField.tsx`, `OpponentHand.tsx`, and shared `CardBack.tsx` (`src/render/`).
- **Opponent animations** — the opponent plays the same opening draw animation, and destroyed opponent A-cards travel to the opponent graveyard instead of vanishing.
- **Card-A summon levels** — every A-card carries a summon `level` (Ironclad 1, Ashborne 2, Emberfang 2, Warcry 3). Levels 1–2 set freely into any open A slot; **level 3 requires a tribute**.
- **Tribute summoning** — dropping a level-3 A-card opens a material-selection popup (reused pile-search styling) with a live `0/3` counter; you pick board A-cards whose levels sum to exactly 3. Confirming sends the materials **and their linked C-cards** to the replen pile, then summons. If you can't afford it, no gold slots appear and the drag no-ops. New `TributeModal.tsx` (`src/ui/`); rules in `slotRules.ts` (`requiresTribute`, `hasSubsetSum`, `canAffordTribute`, `boardMaterials`, `slotHighlightedForCard`, `canDropCard`); store actions `confirmTributeSummon` / `cancelTributeSummon`.
- **Commander card** — a 5th A-card, *Aurelian Warlord* (A5, Legendary), summoned by the same exactly-3 tribute rule, **but its materials go to the graveyard instead of replen**. Deck is now 13 cards (A:5, B:4, C:4). Level and a `★ COMMANDER ★` tag render on both the 3D card face (`CardView.tsx`) and the big inspection popup (`InspectionPanel.tsx`).

#### Changed

- **On-card stat layout** — the remaining-HP number and health bar now sit on **top** of each A-card with DMG/ACC below, split to opposite edges, matching a Master-Duel-style ATK/DEF read (`AZoneStats.tsx`, `StatOverlay.tsx`).
- **Camera** — flattened the board angle so the stat tags no longer skew or overlap the opponent's cards; added vertical spacing between the two boards (`GameScene.tsx`, `boardConfig.ts`, `layout.ts`).
- **"Shuffle into deck" now routes through replen** — B2's `graveyardIntoDeck` and any "shuffle back into deck" effect move cards (shuffled) into the **replen** pile, which itself folds back into the deck at End phase.
- **End-phase shuffle guard** — the deck only reshuffles at End when the replen pile is non-empty.

#### Tests

- **127 tests green** — added tribute-summon coverage (level rules, popup confirm/cancel, materials→replen, commander materials→graveyard), the graveyard→replen reroute, the empty-replen end-phase guard, and updated card-count assertions to 13 cards / A:5 (`gameStore.test.ts`, `cardData.test.ts`, `slotRules.test.ts`).

---

## [0.6.0] — 2026-08-23

### Everwar — Phase 5: Dice Combat, HP/Damage & Opponent Targeting ✅

> Phase 5 lays the full combat/rules layer on top of the Phase 4 turn loop: dice resolution with outcome bands, HP/DMG/ACC combat stats, damage application with death→graveyard, and player→opponent battle targeting.

#### Added

- **Dice combat rules** — a pure `diceRules.ts` module resolves each D20 roll into GLANCING / normal HIT / MISS / CRITICAL bands driven by the attacker's effective ACC, with a high-ACC auto-crit threshold.
- **Card combat stats (HP / DMG / ACC)** — a pure `combatStats.ts` folds C-card buffs into effective stats; floating HP/DMG/ACC plates render over each A column with an animated, color-banded HP bar.
- **Resolution combat** — each declared attacker rolls over its card, shows a HIT/MISS/GLANCING/CRITICAL outcome pop-up, then applies damage.
- **HP damage & death** — cards drained to 0 HP play a red-slash FX and leave the field; the End banner holds until destroy/travel animations finish.
- **Opponent targeting** — a mirrored opponent Vanguard row; click your A-card to aim (arrow rubber-bands to the cursor), valid opponent targets glow gold, click to lock. Multiple attackers may stack on one target; Resolution rolls per attacker and drains the target, which slashes and vanishes at 0 HP.
- **Double-click quick-place** — double-clicking a hovered hand card in Main auto-places it into the next legal slot for its type.

#### Tests

- Added `diceRules.test.ts` and `combatStats.test.ts` plus resolution/damage coverage in `gameStore.test.ts`.

---

## [0.5.0] — 2026-08-23

### Everwar — Phase 4: Turn Mechanics, Battle Declaration & Resolution Dice ✅

> Phase 4 introduces the turn/phase loop and the combat setup that Phase 5 builds on.

#### Added

- **Phase state machine** — Draw → Main → Battle → Resolution → End with a turn counter, a `TurnHud` strip + Next Phase button, and a `PhaseBanner` that slides in / holds / out on every phase change.
- **Draw & End automation** — Draw auto-draws to 6 (else 1) then advances; End folds the replen pile back into the deck and graveyards non-continuous B cards.
- **Phase-gated placement** — card placement is restricted to Main; manual deck-click draw is disabled.
- **Battle declaration** — click either linked A/C zone to declare that column's A card an attacker (gold outline across the whole column); only occupied A columns can attack.
- **Resolution dice** — each declared attacker rolls a D20 simultaneously in-scene over its A/C link area (face-snaps toward the camera on settle); values absorb into `lastRolls`, then auto-advance to End. Dice wait for the Resolution banner to clear before tumbling.
- **Linked-column drop** — dragging an A/C card highlights and accepts a drop on either zone of its linked column, resolving to the card's correct slot.

---

## [0.4.0] — 2026-08-22

### Everwar — Phase 3: Card Systems — Inspection, Piles, Abilities & Boosts ✅

> Phase 3 fleshes out the card model and the supporting piles: a rich card data model with click-to-inspect, a graveyard/replenish/shuffle pile system, floating A-card stat overlays, C-card boosts, B-card spell abilities, and a summon-reveal showcase. All local-only (no Player 2 yet).

#### Added

- **Card data model + inspection** — a full typed card model with a DOM `InspectionPanel` overlay (kept out of the 3D canvas so effect text stays crisp) and rich procedural card faces.
- **Destroy → graveyard** — occupied board cards travel to a new `graveyard` pile; destroying a Zone-A card also sends its linked Zone-C card in the same column pair.
- **Pile management** — a reusable `PileSearchModal` lists deck / graveyard / replen cards (click a tile to inspect); open it by clicking a pile on the board or via dev buttons (open state lives in the store). Replen mechanics send a random A (+ linked C) to the replenish pile; "disturb" sends the deck's top card to replen.
- **Animated shuffle** — a riffle animation (deck splits into two lifted piles then collapses back randomized) with a pure Fisher-Yates `shuffleArray` (injectable RNG); buttons fold replen, graveyard, or the hand into the deck and reshuffle.
- **A-zone stat overlays** — floating HP-bar / ATK / DEF plates centered over each A/C column pair; HP shown on cards and in the inspection panel.
- **C-card boosts** — C (Bulwark) cards gate on their linked A slot being occupied and roll a random stat boost when set; the overlay recolors grey/green/red by delta. C cards drop atk/def/hp entirely and show only the increase/decrease they grant.
- **B-card abilities** — B (Arcane) cards are spells with no combat stats, each carrying an on-play ability (draw 1, shuffle graveyard/replen into deck, draw 2) enacted after the summon showcase. Multi-card draws stagger (the next card leaves the deck only once the previous passes its flight midpoint).
- **Summon reveal** — a freshly set card pops up big & centered with a gold ripple, then flies into its slot (transient visual-only state).

#### Changed

- **`atk`/`def`/`hp` are now optional and A-only** — card face, inspection panel, and pile-search tiles render type-specific info.

---

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