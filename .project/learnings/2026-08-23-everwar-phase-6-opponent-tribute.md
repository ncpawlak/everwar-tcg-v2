# Learnings — Everwar Phase 6: Opponent Board + Tribute Summoning

**Date:** 2026-08-23  
**Cycle:** Phase 6 — opponent mirror, stat-tag polish, levels/tribute, Commander  
**Commit:** working tree, uncommitted (base `6385a1b`)  
**Version bump:** 0.6.0 → 0.7.0 (MINOR — significant new product slice)

---

## What Shipped 🎉

Phase 6 turned the single-player table into a two-sided battlefield and added the first summon-cost mechanic.

The opponent now has a mirrored field using the same multi-zone structure as the player board: deck/replen are top-left, the opponent A-row is targetable, and opponent cards render upside-down across the table while labels and HP/DMG/ACC stay readable to the player. Destroyed opponent A-cards travel to an opponent graveyard instead of disappearing, and a visual opponent opening hand deals from the mirrored deck.

The combat-stat presentation was redesigned. Each A-card now shows remaining HP plus a health bar above the card, with DMG/ACC below it, split away from the card body so it reads like a compact Master-Duel ATK/DEF treatment. The camera and board spacing were retuned to reduce skew and prevent overlap.

The player A-card system now has summon levels. Ironclad Lancer is level 1, Ashborne Vanguard and Emberfang Reaver are level 2, Warcry Commander is level 3, and the new fifth A-card, *Aurelian Warlord*, is a level-3 Commander. Level 1–2 A-cards set freely. Level 3 requires choosing board A-cards whose levels sum to exactly 3 in a tribute popup; ordinary level-3 materials and linked C-cards go to replen, while Commander materials and linked C-cards go to graveyard. The player deck is now 13 cards (A:5, B:4, C:4).

Finally, "shuffle into deck" effects now route through replen, and End only reshuffles when replen contains cards. 127 Vitest tests are green and `npx tsc --noEmit` is clean.

---

## What Worked Well

### 1. Mirroring the board instead of duplicating coordinates

`mirrorPoint(...)` in `src\board\boardConfig.ts` and `mirrorPose(...)` in `src\board\layout.ts` let the opponent side reuse the same slot grid, pile anchors, card scale, and animation language as the player side. This avoided a second hand-maintained coordinate system. The opponent deck, graveyard, replen, full 12-slot furniture, and A-row combat targets all derive from player board geometry.

### 2. Separating card orientation from UI readability

Opponent cards are upside-down because their poses are mirrored. Stat overlays are separate billboarded UI elements (`HpOverlay`, `DmgAccOverlay`) and remain player-readable. That distinction is important: card art belongs to table perspective; HP/DMG/ACC are gameplay HUD information.

### 3. Reusing the state → pose → spring pipeline

Destroyed opponent cards now animate by changing state membership (`opponentBoard` → `opponentGraveyard`) and letting `selectOpponentCardVisual(...)` choose the new pose. No special "animate this one card" imperative path was needed.

### 4. Tribute rules as pure functions

The tribute mechanic landed cleanly because affordability and exact-sum logic live in `src\board\slotRules.ts`: `requiresTribute`, `boardMaterials`, `hasSubsetSum`, `canAffordTribute`, `slotHighlightedForCard`, and `canDropCard`. Highlighting, dropping, and auto-place all call the same rules.

### 5. Modal as handshake, not authority

`TributeModal` gives the player a clear `sum/need` counter and selection UI, but the store action `confirmTributeSummon(...)` revalidates everything before changing state. This keeps React UI helpful but not authoritative.

---

## Pitfalls Hit and How They Were Resolved

### Pitfall 1: A true mirrored hand orientation made card backs look edge-on

**What happened:** Mirroring opponent hand poses by orientation made the fanned backs visually collapse into slivers from the player camera.

**How it was resolved:** `opponentHandPoses(...)` translates the player's camera-facing fan to `OPP_HAND_ANCHOR` instead of mirroring rotation. `CardBackMesh` also renders the gold back accent on both faces.

**Lesson:** Mirrored gameplay surfaces and camera-facing UI/card-back presentation are different problems. Mirror positions; do not blindly mirror every orientation.

---

### Pitfall 2: Stat overlays became crowded before the camera/layout pass

**What happened:** Early stat-tag layouts put too much information into one strip or placed HP and DMG/ACC too close together, especially on the far opponent cards.

**How it was resolved:** `StatOverlay.tsx` split the readout into `HpOverlay` and `DmgAccOverlay`. `AZoneStats.tsx` and `OpponentBoard.tsx` now place HP at a negative z offset and DMG/ACC at a positive z offset from each A-card. The camera was raised/flattened and board spacing increased.

**Lesson:** Text-on-3D-board readability is a presentation problem that needs live screenshot approval. Unit tests can protect math, not visual legibility.

---

### Pitfall 3: "Shuffle into deck" had hidden timing semantics

**What happened:** The literal implementation of `graveyardIntoDeck()` moved cards directly into the deck and started the deck shuffle. Phase 6 clarified that this should route through replen, with replen folding into deck at End.

**How it was resolved:** `graveyardIntoDeck()` now shuffles graveyard contents into `replen`. `replenIntoDeck()` remains the only true deck-fold operation, and `runEndPhase()` calls it only when replen is non-empty.

**Lesson:** Zone names in card text may describe player-facing intent, but the engine needs a precise lifecycle: immediate pile → staging pile → End-phase deck fold.

---

### Pitfall 4: Commander looked like a new type, but should not be one

**What happened:** A Commander has special cost destination, but it still occupies A slots, carries A combat stats, and follows level-3 tribute affordability.

**How it was resolved:** Commander is `commander?: boolean` metadata on an A-card, not a new `CardType`. Only `confirmTributeSummon(...)` branches the material sink to graveyard.

**Lesson:** Add new card taxonomies only when they change placement topology. If the board/rules surface is shared, metadata is enough.

---

## Taskboard Analysis

### Stories Delivered

Phase 6 delivered the mirrored opponent board, opponent animations, stat-tag redesign, camera/spacing pass, A-card level rules, tribute modal, Commander card, "shuffle to replen" reroute, and End-phase shuffle guard.

### What Changed Mid-Cycle

The opponent board began as static visual mirroring and grew into animated opponent destruction plus a visual opening hand. The stat overlay design changed twice before landing on the split HP-top / DMG-ACC-bottom treatment. The summon-level mechanic expanded after approval to include the Commander special case and the replen reroute.

### Recommendations for the Planner (Phase 7)

1. **Separate visual-only opponent assets from future real opponent state.** `OpponentHand` is intentionally local/visual. If Phase 7 adds opponent turns, promote deck/hand to store state instead of extending local animation state.
2. **Treat rendered readability as an explicit acceptance gate.** Stat tags, camera pitch, and mirrored board spacing all need screenshot review.
3. **Keep cost/payment logic in store actions.** UI can display legal choices, but material validation and destination branching belong in `gameStore.ts`.
4. **Audit user-facing card text against engine semantics.** B2 still says "shuffle graveyard into deck" while the engine routes through replen. That may be okay as shorthand, but future docs/cards should be explicit if players find it confusing.

---

## Skill / Learning Candidates

| # | Proposed Name | Universal vs. Project-Specific | Rationale |
|---|---|---|---|
| 1 | `mirror-derived-layout` | **Universal** | Generate mirrored board/UI geometry from one canonical coordinate source instead of maintaining duplicate coordinates. |
| 2 | `readability-over-object-transform` | **Universal** | Keep gameplay HUD overlays player-facing even when the underlying board object is flipped or mirrored. |
| 3 | `modal-handshake-state-machine` | **Universal** | Represent multi-step UI confirmation as pending store state, then revalidate on confirm before mutation. |
| 4 | `small-pool-subset-sum-rule` | **Universal** | For tiny material pools, brute-force subset-sum is clearer and safer than over-engineering. |
| 5 | `replen-as-return-buffer` | **Project-specific** | Route "shuffle back" effects through replen so End owns the actual deck fold. |
