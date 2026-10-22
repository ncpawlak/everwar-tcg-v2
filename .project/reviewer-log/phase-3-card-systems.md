# Reviewer Log — Everwar Phase 3

## 2026-08-22 · R-003-001 · Click-to-inspect started a drag instead

**Phase:** Phase 3  
**Severity:** Blocking for Slice 1 (requested inspection interaction unusable)  
**Found by:** User rendered-verification.  
**Symptom:** Clicking a card picked it up for dragging and no left-side inspection panel appeared.

**Root cause:** The Phase 2 input model began drag behavior on pointer down. Phase 3 needed click-vs-drag disambiguation, but the initial browser run was also stale due to Vite watcher failure.

**Fix (verified):** Added `DRAG_THRESHOLD_PX` and a press/release classifier in `src\input\pickMath.ts` and `src\input\PointerControls.tsx`. Clicks select cards; drags begin only after movement exceeds the threshold. Restarted Vite and fetch-verified served modules. User confirmed the panel looked good.

**Resolution status:** RESOLVED — user approved Slice 1.

---

## 2026-08-22 · R-003-002 · Vite served stale modules after code edits

**Phase:** Phase 3  
**Severity:** High (browser behavior did not match source code)  
**Found by:** User rendered-verification and manual transformed-module fetch.  
**Symptom:** Destroy buttons appeared nonfunctional after the code had been renamed from attack to destroy.

**Root cause:** On Windows, Vite's watcher missed file changes made by tooling. The dev server kept serving cached transformed modules.

**Fix (verified):** Restarted the detached Vite server, fetched transformed modules to confirm identifiers such as `destroyZoneA` were present, then reloaded the canvas. Captured the guardrail in `.agent\skills\vite-windows-watcher-restart.md`.

**Resolution status:** RESOLVED — user confirmed the buttons worked.

---

## 2026-08-22 · R-003-003 · Stat plate was too small and not centered on the linked pair

**Phase:** Phase 3  
**Severity:** Medium (mechanic correct, readability poor)  
**Found by:** User rendered-verification.  
**Symptom:** HP was hard to see, and the overlay did not read as belonging to the linked A/C zone pair.

**Root cause:** The first overlay was sized/anchored for a single card rather than the semantic A+C pair.

**Fix (verified):** Reworked `src\render\StatOverlay.tsx` into a larger three-row plate (HP bar/text, ATK, DEF) and updated `src\render\AZoneStats.tsx` to center at the midpoint between `A_i` and `C_i`, raised above the board.

**Resolution status:** RESOLVED — user approved the revised overlay.

---

## 2026-08-22 · R-003-004 · Broken test edit orphaned an `it` block

**Phase:** Phase 3  
**Severity:** Medium (test suite compile failure)  
**Found by:** Typecheck/test run.  
**Symptom:** esbuild reported an unexpected closing brace in a test file during the C-card support pass.

**Root cause:** A block replacement dropped the `it('dropCard with no slot...')` declaration while leaving the body.

**Fix (verified):** Restored the test declaration and reran the suite. Phase 3 later closed with 89 tests passing at `f15d8fc`.

**Resolution status:** RESOLVED.

---

## 2026-08-22 · R-003-005 · Draw-two resolved both draws at once

**Phase:** Phase 3  
**Severity:** Low/Medium (mechanic worked, animation feel failed)  
**Found by:** User rendered-verification.  
**Symptom:** B4's draw-two effect popped both cards from the deck at the same time.

**Root cause:** The initial B ability implementation performed two `drawCard()` calls synchronously.

**Fix (verified):** Added `drawStaggered(n)` and `MULTI_DRAW_STAGGER_MS = 200` so subsequent cards draw on delayed timers. Fake-timer tests cover the stagger.

**Resolution status:** RESOLVED — user accepted Phase 3 close-out.

---

## Close-out verification

The requested close-out validation was run from the current worktree after later uncommitted Phase 6 changes:

- `npx vitest run` — 127 tests passed across 11 files.
- `npx tsc --noEmit` — clean.

These numbers are current-suite health, not the historical Phase 3 landing count. The Phase 3 checkpoint records 89 passing tests at `f15d8fc`.
