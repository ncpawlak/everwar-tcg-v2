# Learnings — Everwar Phase 3: Card Systems

**Date:** 2026-08-22  
**Cycle:** Phase 3 — advanced card systems  
**Commits:** `2b63640`, `bee4a99`, `47d3c44`, `fbf17bd`, `f15d8fc`  
**Version bump:** no recorded version bump in the Phase 3 commits  
**Build health:** `npx vitest run` green (127 tests, 11 files — current suite includes later uncommitted Phase 6 work) · `npx tsc --noEmit` green

---

## What Shipped 🎉

Phase 3 turned the typed board into an interactive card-system prototype:

- Rich cards with name, cost, rarity, effect, flavor, and type-specific mechanics.
- A left-side click-to-inspect panel for hand, board, and pile cards.
- Real 3D card faces showing the same information as the panel.
- Destroy mechanics that send occupied A/B zones to the graveyard, with A destroying its linked C support.
- A replenish pile plus disturb and pile-to-deck shuffle actions.
- Search pop-ups for deck, graveyard, and replenish.
- Riffle-style shuffle animation and staggered multi-draws.
- Floating A-zone HP/ATK/DEF overlays.
- C cards as support-only boosts with linked-A placement gating.
- B cards as ability cards: draw 1, draw 2, graveyard-to-deck shuffle, replenish-to-deck shuffle.
- A summon reveal: a newly set card pops up large, ripples, then flies to its slot.

Phase 3 landed with 89 tests passing at `f15d8fc`. The close-out verification was run against the current working tree, which includes later Phase 6 changes: 127 Vitest tests across 11 files passed, and `npx tsc --noEmit` was clean.

---

## What Worked Well

### 1. DOM overlays stayed the right answer for readable UI

`InspectionPanel`, `DevControls`, and `PileSearchModal` are DOM surfaces marked with `data-ui-overlay`. That kept text-heavy UI out of the Three scene and let `PointerControls` ignore overlay clicks. The pattern scaled from one panel to many temporary mechanics without reopening the Phase 1 input architecture.

### 2. Id-array pile state gave every mechanic the same movement primitive

Graveyard, replenish, deck, and hand are all ordered `CardId[]` locations. Destroy, disturb, replenish, shuffle, pile search, and B-card pile abilities all became array transitions. `selectCardVisual` and the pose helpers then made the animation automatic.

### 3. C-card support was reversible because boosts are derived live

The C card stores its rolled `buff`, but `effectiveStats(state, aSlot)` applies it only if the linked C slot is occupied. That means removing or moving the C card reverts the A overlay without any cleanup code. This was the cleanest possible seam for future support cards.

### 4. Transient state worked for nontrivial animation timing

`deckSpread` and `summon` showed that timed animations can stay declarative: set a short-lived state flag, let pose selectors retarget springs, then clear the flag with a guarded timeout. This avoided mesh refs and imperative animation scripts.

### 5. Ability labels and dispatch shared one vocabulary

`BAbility` plus `B_ABILITY_LABEL` made B-card display and behavior stay aligned. `CardView`, `InspectionPanel`, `PileSearchModal`, and `gameStore.enactBAbility` all speak the same small enum.

---

## Pitfalls Hit and How They Were Resolved

### Pitfall 1: Vite served stale code after tool edits on Windows

**What happened:** Twice, the browser appeared broken even though disk code and tests were correct: inspection did not appear, and later destroy buttons looked nonfunctional. Fetching transformed Vite modules showed the dev server was still serving old code.

**How it was resolved:** Restart the detached Vite server after code changes, fetch-verify a real transformed identifier, then reload the canvas. The workflow was captured as `.agent\skills\vite-windows-watcher-restart.md`.

**Lesson:** Passing tests and typecheck prove disk health, not browser freshness. On Windows, rendered verification must include a Vite restart/fetch-verification step.

---

### Pitfall 2: Click-to-inspect initially conflicted with drag

**What happened:** Clicking a hand card picked it up instead of opening inspection because the existing input model began drag on pointer down.

**How it was resolved:** `PointerControls` was rewritten around a press/release gesture. Sub-threshold movement is a click; crossing `DRAG_THRESHOLD_PX` starts a drag. `pickMath.test.ts` locks the threshold behavior.

**Lesson:** In a DOM-driven canvas game, click and drag must share one classifier. Do not let separate handlers race on pointer down.

---

### Pitfall 3: Stat overlays needed player-readable placement, not just correctness

**What happened:** The first stat plate was too small and not aligned to the linked A/C pair, so HP was hard to read and the plate felt attached only to the A card.

**How it was resolved:** `StatOverlay` was enlarged into three stacked rows; `AZoneStats` centers each plate between `A_i` and `C_i` and raises it above the pair. Neutral ATK/DEF text is grey; modified values are green/red.

**Lesson:** Combat telemetry is UX, not just data. The correct anchor is the semantic pair midpoint, not the individual A-card mesh.

---

### Pitfall 4: Timed effects needed fake-timer tests

**What happened:** Shuffle, summon reveal, and draw-two all use `setTimeout`. Without fake timers, tests would either miss post-timer state or become slow/flaky.

**How it was resolved:** Store tests use fake timers for `SHUFFLE_SPREAD_MS`, `SUMMON_SHOWCASE_MS`, and `MULTI_DRAW_STAGGER_MS`. They assert both immediate state and post-timeout state.

**Lesson:** Every new transient animation flag should ship with a fake-timer test for "set immediately" and "clears/resolves later."

---

### Pitfall 5: Draw-two felt wrong when both cards popped at once

**What happened:** B4's draw-two ability originally resolved two draws simultaneously.

**How it was resolved:** Added `drawStaggered(n)` with `MULTI_DRAW_STAGGER_MS = 200`, so multi-draw effects animate one card after the prior card is past the midpoint.

**Lesson:** Card-game feedback often needs sequencing even when the state transition could be batched.

---

## Taskboard Analysis

Phase 3 was implemented as user-approved slices rather than a single prewritten phase taskboard. The dependency order was sound in practice:

1. Rich card model and inspection first.
2. Zone-to-pile movement next.
3. Search/replen/shuffle once piles existed.
4. Stat overlays and C support after A/C linkage was concrete.
5. Summon reveal and B abilities after placement had enough meaning.

The main mid-cycle expansion was that "card use" became two families: A/C stat interaction and B-card ability dispatch. The code handled this by making stats optional and type-specific, rather than forcing all card types through one combat schema.

### Recommendations for Phase 4

1. **Plan turn timing before adding more abilities.** B abilities currently resolve after summon reveal. Phase 4 should decide whether there is a formal effect window/phase stack.
2. **Turn gating should compose with `slotPlaceable`.** Placement legality already lives in one policy function; phase/turn restrictions should not be reimplemented in UI.
3. **Model current HP separately from max HP if damage arrives.** Phase 3 shows max HP only; `StatOverlay` accepts `currentHp` but no damage state exists yet.
4. **Replace temp dev buttons with phase-aware controls gradually.** `DevControls` is useful, but Phase 4 should introduce real turn HUD/actions rather than piling every mechanic into temporary buttons.

---

## Skill / Learning Candidates (for Orchestrator classification)

| # | Proposed Name | Universal vs. Project-Specific | Rationale |
|---|---|---|---|
| 1 | `dom-overlay-input-exclusion` | **Universal** | Text-heavy UI in a canvas app can stay in DOM if every overlay opts out of game input through one marker such as `data-ui-overlay`. |
| 2 | `transient-state-animation` | **Universal** | One-shot animations can be modeled as temporary state plus selector priority and guarded timers, avoiding imperative mesh control. |
| 3 | `id-array-pile-model` | **Universal** | Ordered piles should store ids, not cloned entities or physical poses; views derive order and position from the ids. |
| 4 | `presence-derived-buffs` | **Universal** | Store the support effect on the source object, but apply it through live relationship queries so removing the source naturally reverts the effect. |
| 5 | `vite-windows-watcher-restart` | **Project-specific / environment** | This repo's Vite server on Windows can serve stale transformed modules after tool edits; restart and fetch-verify before visual review. |
