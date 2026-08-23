# Reviewer Log — Everwar Phase 6

## 2026-08-23 · R-006-001 · Opponent hand rendered as edge-on slivers

**Phase:** Phase 6  
**Severity:** Visual blocking for opponent-board feature  
**Found by:** User screenshot review during opponent mirror pass.  
**Symptom:** The opponent's face-down hand looked like thin slivers instead of readable card backs.

**Root cause:** The opponent hand used a true mirrored orientation. That was correct for cards lying on the opponent field, but wrong for a hand fan that should remain camera-facing.

**Introduced by:** Opponent mirror implementation.

**Fix (verified):** `src\board\layout.ts` makes `opponentHandPoses(...)` translate the player's camera-facing fan to `OPP_HAND_ANCHOR` instead of mirroring rotation. `src\render\CardBack.tsx` renders the gold back accent on both faces. User moved on after the fix.

**Resolution status:** RESOLVED.

**Guardrail / learning candidate:** Mirror board objects and camera-facing presentation separately; do not assume every opponent element wants mirrored rotation.

---

## 2026-08-23 · R-006-002 · Opponent board too close to player board

**Phase:** Phase 6  
**Severity:** Layout/readability issue  
**Found by:** User visual review.  
**Symptom:** Player and opponent boards felt crowded, leaving too little space between front lines.

**Root cause:** The mirror center did not push the opponent A-row far enough away from the player A/C row.

**Introduced by:** Initial opponent mirror geometry.

**Fix (verified):** `src\board\boardConfig.ts` now uses `MIRROR_CZ = -1.25`, and `src\render\BoardView.tsx` enlarges/recenters the playmat to cover both boards. User proceeded to the next Phase-6 requests.

**Resolution status:** RESOLVED.

**Guardrail / learning candidate:** Mirrored layouts need an explicit "no-man's-land" spacing constant, not only mechanically correct symmetry.

---

## 2026-08-23 · R-006-003 · Stat overlay designs overlapped and skewed

**Phase:** Phase 6  
**Severity:** Visual blocking for combat readability  
**Found by:** User screenshot review.  
**Symptom:** Earlier stat-tag attempts were too wide, stacked/jammed, or overlapped the opponent card art. The user wanted HP on top and DMG/ACC underneath like a Master-Duel-style readout.

**Root cause:** The first redesign compressed all combat data into one strip, then the next pass put HP and DMG/ACC too close together at the same edge. The existing camera angle amplified the skew.

**Introduced by:** Phase-6 stat-tag redesign.

**Fix (verified):** `src\render\StatOverlay.tsx` split the overlay into `HpOverlay` and `DmgAccOverlay`, with HP at `HP_Z_OFFSET = -0.52` and DMG/ACC at `DA_Z_OFFSET = 0.5`. `src\render\AZoneStats.tsx` and `src\render\OpponentBoard.tsx` apply the split on both boards. `src\board\boardConfig.ts` flattens the camera to `[0, 9.9, 6.3]` with FOV 46. User approved: "looks perfect."

**Resolution status:** RESOLVED.

**Guardrail / learning candidate:** Treat on-card text layout as a rendered review gate; tests cannot validate visual overlap or projected readability.

---

## 2026-08-23 · R-006-004 · Level badge was not visible enough on A-card graphics

**Phase:** Phase 6  
**Severity:** Product polish / rule discoverability  
**Found by:** User follow-up after tribute summoning landed.  
**Symptom:** A-card level existed mechanically but was not sufficiently visible on the 3D card face.

**Root cause:** The first level badge placement competed with existing face elements and read too faintly at board scale.

**Introduced by:** A-card summon-level implementation.

**Fix (verified by tests/build; visual approval implied by continued work):** `src\cards\CardView.tsx` places `Lv {level}` centered under the name band with stronger gold styling and adds a separate `★ COMMANDER ★` tag for Commander cards. `src\ui\InspectionPanel.tsx` mirrors level and Commander metadata in the detail popup.

**Resolution status:** RESOLVED in code.

**Guardrail / learning candidate:** Rule-critical metadata must appear in both the 3D face and inspection UI, and it must be positioned against known face anchors rather than squeezed into leftover space.

---

## 2026-08-23 · R-006-005 · End phase shuffled an empty replen pile

**Phase:** Phase 6  
**Severity:** Logic/presentation bug  
**Found by:** User.  
**Symptom:** End phase triggered deck shuffle behavior even when there were no replen cards to fold into the deck.

**Root cause:** `runEndPhase()` always called `replenIntoDeck()` rather than checking whether `replen` contained cards.

**Introduced by:** Earlier turn/pile phase behavior.

**Fix (verified):** `src\state\gameStore.ts` now calls `replenIntoDeck()` only when `get().replen.length > 0`. `src\state\gameStore.test.ts` covers the no-shuffle empty-replen path.

**Resolution status:** RESOLVED — `npx vitest run` green (127 tests).

**Guardrail / learning candidate:** Phase-entry automation should no-op when its input pile/state is empty; otherwise visual effects misrepresent rules.
