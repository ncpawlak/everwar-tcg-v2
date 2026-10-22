# Phase 6 Taskboard — Opponent Board + Tribute Summoning

**Phase:** Phase 6  
**Scope:** Mirror the player's multi-zone board for an opponent, animate opponent opening/death movement, redesign A-card stat tags for readability, flatten/space the camera, add A-card summon levels with exact-sum tribute summoning, add a Commander A-card, route "shuffle into deck" through replen, and guard End-phase shuffling.  
**Stack:** TypeScript · React + Vite · React Three Fiber + drei · Zustand · @react-spring/three · Vitest.  
**Landed:** working tree, uncommitted (base `6385a1b`) — 127 tests green, `npx tsc --noEmit` clean.

## Story field legend

- **ID:** Stable Phase 6 story identifier.
- **Depends on:** Prerequisite stories that must land first.
- **Acceptance criteria:** Testable checklist mapped to Phase 6 requirements.
- **Test plan:** Unit/regression vs. rendered browser verification.

## Dependency backbone

`P6-S01 → P6-S02 → P6-S03 → P6-S04 → P6-S05 → P6-S06 → P6-S07 → P6-S08`

---

### P6-S01: Mirrored opponent field geometry

**Depends on:** Phase 5 opponent targeting base  **Status:** ✅ done

**Description:** Add a 180° mirrored opponent field using the same player slot geometry. Opponent deck/replen appear top-left, all 12 mirrored A/B/C zone outlines render, and the shared playmat grows to span both fields.

**Acceptance criteria:**
- [x] Opponent slot anchors derive from `SLOT_POSITIONS` via `mirrorPoint(...)`.
- [x] Opponent deck, graveyard, replen, and hand anchors mirror the player's anchors.
- [x] Opponent full-zone furniture renders without creating a second hand-authored board grid.
- [x] Board spacing increases between player and opponent front lines.

**Test plan:** Unit/layout — existing layout tests continue to pass. Render — screenshot review for opponent field placement and spacing.

---

### P6-S02: Opponent cards and readable target/stat presentation

**Depends on:** P6-S01  **Status:** ✅ done

**Description:** Render opponent A-cards on the mirrored A-row, upside-down across the table, while targeting outlines and stat tags remain readable to the player.

**Acceptance criteria:**
- [x] `OpponentBoard` renders seeded opponent A-cards from `opponentBoard`.
- [x] Opponent card bodies use mirrored/upside-down poses.
- [x] Gold targeting outlines appear on occupied opponent cards while the player is choosing a target.
- [x] HP/DMG/ACC overlays remain right-side-up and player-readable.

**Test plan:** Regression — combat/targeting tests still pass. Render — user screenshot review.

---

### P6-S03: Opponent animations

**Depends on:** P6-S02  **Status:** ✅ done

**Description:** Make opponent movement obey the same physical animation language as player cards: opening hand backs deal from the opponent deck, and destroyed opponent A-cards travel to the mirrored opponent graveyard.

**Acceptance criteria:**
- [x] `opponentGraveyard` exists in state and initializes empty.
- [x] Lethal Resolution damage moves defeated opponent ids from `opponentBoard` to `opponentGraveyard`.
- [x] `selectOpponentCardVisual(...)` returns slot or graveyard poses for opponent cards.
- [x] Opponent opening draw animates five card backs from deck to hand.

**Test plan:** Unit — opponent death test asserts graveyard membership. Render — user-approved animation feel.

---

### P6-S04: Stat-tag redesign + camera/spacing pass

**Depends on:** P6-S01, P6-S02  **Status:** ✅ done

**Description:** Replace the older stat strip with split on-card stat tags: remaining HP number + health bar on top of each A-card and DMG/ACC below. Flatten camera angle and space the boards so the tags do not skew or overlap.

**Acceptance criteria:**
- [x] `StatOverlay.tsx` exports separate `HpOverlay` and `DmgAccOverlay`.
- [x] Player A-card overlays are positioned by `AZoneStats.tsx`.
- [x] Opponent overlays use the same components in `OpponentBoard.tsx`.
- [x] Camera x remains 0 while y/z/FOV are retuned for readability.
- [x] User approved the final placement.

**Test plan:** Render — screenshot approval. Regression — `npx vitest run`.

---

### P6-S05: A-card summon levels and exact-sum tribute rule

**Depends on:** Phase 3 card model + Phase 4 Main-phase placement  **Status:** ✅ done

**Description:** Add levels to A-cards and enforce tribute summoning for level-3 cards. Levels 1–2 place normally; level 3 requires board A-card materials whose levels sum exactly to 3.

**Acceptance criteria:**
- [x] A-card levels are assigned: Ironclad 1, Ashborne 2, Emberfang 2, Warcry 3.
- [x] `requiresTribute(...)` identifies level-3 A-cards.
- [x] `hasSubsetSum(...)` and `canAffordTribute(...)` enforce exact-sum affordability.
- [x] Unaffordable level-3 cards show no gold drop targets.
- [x] Affordable level-3 drops open a pending tribute flow instead of placing immediately.

**Test plan:** Unit — `slotRules.test.ts` and `gameStore.test.ts` tribute coverage.

---

### P6-S06: Tribute material-selection modal

**Depends on:** P6-S05  **Status:** ✅ done

**Description:** Add a popup for tribute material selection with a live `sum/need` counter. Confirming exact-sum materials sends selected A-cards and their linked C-cards away, then places the pending card; cancel leaves the hand unchanged.

**Acceptance criteria:**
- [x] `pendingTribute` opens the modal.
- [x] `TributeModal.tsx` lists eligible board A-cards from `boardMaterials(...)`.
- [x] Counter shows live selected level total, such as `0/3`.
- [x] Confirm enables only at exact sum.
- [x] `confirmTributeSummon(...)` revalidates selection before mutating state.
- [x] `cancelTributeSummon(...)`, Escape, and backdrop close without placement.

**Test plan:** Unit — store confirm/cancel tests. Render — user-approved modal interaction.

---

### P6-S07: Commander card

**Depends on:** P6-S05, P6-S06  **Status:** ✅ done

**Description:** Add *Aurelian Warlord* as a fifth A-card and Commander. It uses the same level-3 exact tribute requirement but sends materials and linked C-cards to graveyard instead of replen.

**Acceptance criteria:**
- [x] `COMMANDER_CARD` and `COMMANDER_ID` define `card-A5` as Aurelian Warlord.
- [x] Deck size is 13 cards: A:5, B:4, C:4.
- [x] Commander is type A, Legendary, level 3, and `commander: true`.
- [x] Commander tribute materials go to graveyard, not replen.
- [x] Level and Commander tag appear on `CardView` and `InspectionPanel`.

**Test plan:** Unit — card-data count tests and commander tribute destination test.

---

### P6-S08: Replen reroute, End guard, and validation

**Depends on:** P6-S03, P6-S07  **Status:** ✅ done

**Description:** Route "shuffle graveyard into deck" effects through replen, preserve replen→deck as the End fold, avoid empty End shuffles, and run the full validation pass.

**Acceptance criteria:**
- [x] `graveyardIntoDeck()` sends shuffled graveyard cards into `replen` and clears `graveyard`.
- [x] `replenIntoDeck()` remains the deck-fold shuffle path.
- [x] End phase only calls `replenIntoDeck()` when replen is non-empty.
- [x] Full Vitest suite passes.
- [x] TypeScript check passes.
- [x] Phase 6 close-out docs created.

**Test plan:** Unit/regression — `npx vitest run` (127 tests, 11 files). Typecheck — `npx tsc --noEmit`.
