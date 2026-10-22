# Decision Record — Phase 6 · 2026-08-23

**Author:** Senior Coder (end-of-Phase-6 architectural close-out)  
**Phase:** Phase 6 — opponent mirror, combat-stat presentation, tribute summoning (working tree, uncommitted; base `6385a1b`)  
**Build health:** `npx tsc --noEmit` green · `npx vitest run` green (127 tests, 11 files)  
**Scope:** the architecturally significant Phase-6 decisions only. Earlier phases 1–3 used the plain D-series (`D1`, `D2`, …); Phase 6 decisions are phase-prefixed below as `P6-D1`, `P6-D2`, …

---

## P6-D1 — Opponent field is a mirrored reuse of the player slot geometry, not a second hand-authored board

### Status
**ADOPTED.** The opponent board is generated from the same player-slot coordinate scheme via mirror helpers.

### Context / problem
Phase 5 had targetable opponent A-cards, but not a full opponent-side field. Phase 6 needed the table to read as a real two-sided TCG board: the opponent gets the same multi-zone field, deck/replen land top-left, and their cards lie upside-down from the player's perspective. Duplicating a second coordinate grid would make every player-board spacing fix a two-place edit.

### Decision
Mirror the existing field around the board center instead of authoring a separate layout:

- `src\board\boardConfig.ts` defines `MIRROR_CZ`, `mirrorPoint(...)`, `OPP_FULL_SLOT_POSITIONS`, `OPP_SLOT_POSITIONS`, `OPP_DECK_ANCHOR`, `OPP_GRAVEYARD_ANCHOR`, `OPP_REPLEN_ANCHOR`, `OPP_HAND_ANCHOR`, and `OPP_PLACEHOLDER_ZONES`.
- `src\board\layout.ts` defines `mirrorPose(...)`, `opponentDeckPose(...)`, `opponentSlotCardPose(...)`, `opponentGraveyardCardPose(...)`, and `opponentHandPoses(...)`.
- `src\render\OpponentField.tsx` renders the mirrored 12-zone furniture, mirrored pile placeholders, and the top-left face-down deck.
- `src\render\OpponentBoard.tsx` renders live opponent A-cards through `MotionCard` and `selectOpponentCardVisual(...)`.
- `src\render\CardBack.tsx` extracts a shared card-back mesh used by opponent deck/hand presentation.

### Why this design
- **No coordinate drift.** Player slot changes flow automatically to the opponent field through `mirrorPoint(...)`.
- **The old slot/id scheme stays authoritative.** `OPP_FULL_SLOT_POSITIONS` mirrors `A1..C4`; the combat target ids `O1..O4` are only the opponent A-row targeting facade.
- **Player perspective is preserved.** Opponent cards use mirrored poses, so cards face upside-down across the table, while labels and stat plates are rendered independently and remain readable.

### Consequences / tradeoffs
- (+) Board spacing, pile anchoring, deck travel, and opponent graveyard travel share the same geometry language as the player side.
- (+) `OpponentField` is render-only furniture; opponent combat state remains separate in `opponentCards`, `opponentBoard`, and `opponentGraveyard`.
- (−) The opponent hand is intentionally a special case: `opponentHandPoses(...)` translates the player's camera-facing fan to `OPP_HAND_ANCHOR` instead of mirroring orientation. A true orientation mirror made the card backs read edge-on.

### Guardrails
- Do not hand-author a second set of opponent coordinates when extending B/C opponent behavior; derive from `SLOT_POSITIONS` and mirror helpers.
- Keep stat overlays and targeting plates outside any card-flip transform so they stay player-readable.
- If a future real opponent deck is added, reconcile `OPP_DECK_COUNT` in `src\render\OpponentField.tsx` with player `DECK_SIZE`; currently it is visual-only.

---

## P6-D2 — Opponent card animation is state-to-pose, matching the player pipeline

### Status
**ADOPTED.** Opponent destruction and opening-hand motion reuse the same MotionCard/spring model rather than imperative animation.

### Context / problem
Destroyed opponent cards originally disappeared when `opponentBoard[slot]` was nulled. The user wanted the same physical language as the player board: cards should travel to the graveyard, and the opponent should play an opening draw.

### Decision
Keep opponent card identities alive and let pose selectors drive travel:

- `src\state\types.ts` adds `opponentGraveyard: CardId[]`.
- `src\state\cardData.ts` initializes `opponentGraveyard: []`.
- `src\state\gameStore.ts` moves defeated opponent ids from `opponentBoard` into `opponentGraveyard` after the destruction dwell, then holds Resolution for `GRAVEYARD_TRAVEL_MS`.
- `src\animation\poseSelectors.ts` adds `selectOpponentCardVisual(...)` so each opponent card is either in an opponent slot or the opponent graveyard.
- `src\render\OpponentBoard.tsx` maps all `opponentCards` through `MotionCard`.
- `src\render\OpponentHand.tsx` provides a self-contained, visual-only five-card opening deal from `opponentDeckPose(...)` to `opponentHandPoses(...)`.

### Why this design
- **Same mental model as player cards.** State membership decides the target pose; `MotionCard` handles spring travel.
- **No transient "flying card" bookkeeping.** The card remains the same keyed React entity when it leaves the board for `opponentGraveyard`.
- **Opening hand remains scoped.** Because there is no real opponent deck/hand state yet, `OpponentHand` uses local staggered state to animate backs only.

### Consequences / tradeoffs
- (+) Destroyed opponent A-cards now visibly travel to the mirrored graveyard instead of vanishing.
- (+) The opponent opening draw reads like the player's opening deal without adding a half-implemented opponent turn engine.
- (−) Opponent hand/deck are still visual-only. Future AI/opponent-turn work should promote them to real store state instead of building more local animation state.

---

## P6-D3 — Stat tags stay player-relative while opponent cards flip

### Status
**ADOPTED.** Card orientation and stat readability are deliberately separated.

### Context / problem
The opponent board needed to read as a mirror: opponent cards upside-down across the table. Combat stat tags, however, are player-facing UI, not printed card art; flipping them with the opponent cards would make HP/DMG/ACC hard to read.

### Decision
Render card bodies with mirrored/upside-down poses, but render stat tags as upright billboards:

- `src\render\StatOverlay.tsx` exports `HpOverlay`, `DmgAccOverlay`, `HP_Z_OFFSET`, and `DA_Z_OFFSET`.
- `src\render\AZoneStats.tsx` places player HP above each occupied A-card and DMG/ACC below it.
- `src\render\OpponentBoard.tsx` applies the same player-relative overlay offsets from `OPP_SLOT_POSITIONS` while opponent cards themselves come from `selectOpponentCardVisual(...)`.
- The stat tags are `Billboard` components, so their text remains right-side-up from the camera.

### Why this design
- **Card art obeys table perspective; HUD data obeys player readability.**
- **One overlay implementation serves both boards.** Player and opponent use the same `HpOverlay` / `DmgAccOverlay` components and offsets.
- **The stat redesign is contained.** Effective stat calculation remains in `src\state\combatStats.ts`; only placement/presentation changed.

### Consequences / tradeoffs
- (+) HP is now a compact remaining/max number plus draining bar at the top edge; DMG/ACC reads as a short split value below, closer to a Master-Duel ATK/DEF plate.
- (+) Opponent stat cards no longer inherit the card flip.
- (−) The overlay positions are tuned visually, not derived from text bounding boxes. Camera or card-scale changes need screenshot verification.

---

## P6-D4 — Tribute summoning is a pure subset-sum rules gate plus a store/modal handshake

### Status
**ADOPTED.** Level-3 A-card placement is a two-step state transition: legal drop opens `pendingTribute`; modal confirmation commits placement.

### Context / problem
Phase 6 added summon levels to A-cards. Levels 1–2 set normally, but level 3 requires tributing board A-cards whose levels sum to exactly 3. This needed to affect highlights, drag drops, double-click auto-place, material selection, and linked C-card disposal without scattering rules across UI and store.

### Decision
Centralize the affordability and exact-sum rule in `src\board\slotRules.ts`:

- `requiresTribute(card)` identifies A-card tribute summons, including commanders.
- `boardMaterials(board, cardsById)` enumerates currently set A-card materials and their levels.
- `hasSubsetSum(values, target)` proves whether any material subset sums exactly to the required level.
- `canAffordTribute(...)` wraps the exact-sum check.
- `slotHighlightedForCard(...)` and `canDropCard(...)` suppress legal targets when tribute cannot be afforded.

The store/UI handshake is:

1. `dropCard(...)` or `autoPlaceCard(...)` sees a tribute-required card and sets `pendingTribute: { cardId, slotId }` instead of placing it.
2. `src\ui\TributeModal.tsx` opens, lists `boardMaterials(...)`, and shows a live `sum/need` counter.
3. `confirmTributeSummon(materialSlots)` validates exact sum and occupied A-materials again in the store, sends materials plus linked C-cards to the correct pile, clears `pendingTribute`, then calls normal placement.
4. `cancelTributeSummon()` clears the pending state and leaves the card in hand.

### Why this design
- **Rules are pure and testable.** Highlighting and drop validation share the same functions.
- **UI cannot bypass authority.** The modal computes a friendly selection state, but `confirmTributeSummon(...)` revalidates before mutating the board.
- **The hand remains stable during selection.** The card is not removed from hand until the final confirmed placement.

### Consequences / tradeoffs
- (+) "If you can't afford it, no gold slots appear" is enforced at the same gate as actual dropping.
- (+) Double-click quick-place and drag/drop share the same tribute path.
- (−) `hasSubsetSum` is brute-force. That is correct for four A-slots; revisit only if material pools grow significantly.

---

## P6-D5 — Material destination is a rule branch: ordinary level-3 to replen, Commander to graveyard

### Status
**ADOPTED.** Commander summoning shares tribute affordability but differs at material disposal.

### Context / problem
The new *Aurelian Warlord* Commander is also a level-3 A-card and must use the same exactly-3 tribute requirement, but its materials are a cost paid to the graveyard rather than a recycle path through replen.

### Decision
Model Commander as card metadata and branch only at the disposal sink:

- `src\state\types.ts` adds `commander?: boolean`.
- `src\state\cardData.ts` adds `COMMANDER_CARD`, `COMMANDER_ID`, and appends `card-A5` to the deck. `DECK_SIZE` is now 13.
- `src\board\slotRules.ts` treats `card.commander === true` as tribute-required.
- `src\state\gameStore.ts` uses `card.commander === true` in `confirmTributeSummon(...)` to send selected A-materials and linked C-cards to `graveyard` instead of `replen`.
- `src\cards\CardView.tsx` and `src\ui\InspectionPanel.tsx` expose the level and commander tag.

### Why this design
- **Commander is a card property, not a new card type.** It remains Type A and uses A slots, A stats, A targeting, and A tribute rules.
- **Only the destination changes.** Affordability, modal selection, exact-sum validation, and placement are shared with ordinary level-3 summons.

### Consequences / tradeoffs
- (+) Future special A-cards can branch through metadata without introducing a fourth slot family.
- (+) Tests can isolate the important invariant: ordinary tribute materials go to `replen`; Commander materials go to `graveyard`.
- (−) The visible deck count increased to 13 for the player deck, while the opponent visual deck remains a fixed cosmetic stack.

---

## P6-D6 — "Shuffle into deck" routes through replen; End only shuffles when replen is non-empty

### Status
**ADOPTED.** "Back into deck" effects now stage cards in replen first.

### Context / problem
Earlier phases had direct pile-to-deck shuffle helpers. Phase 6 clarified that "shuffle back into deck" should mean "send to replen now; replen folds into deck at End." At the same time, End was triggering shuffle presentation even when replen was empty.

### Decision
- `src\state\gameStore.ts` changes `graveyardIntoDeck()` to shuffle `graveyard` into `replen` and clear `graveyard`, without invoking `beginShuffle(...)`.
- `replenIntoDeck()` remains the true deck-fold/shuffle path.
- `runEndPhase()` calls `replenIntoDeck()` only when `get().replen.length > 0`.

### Why this design
- **Replen becomes the universal "return later" staging pile.**
- **End phase is quieter and semantically cleaner.** Empty replen no longer causes an unnecessary deck spread/shuffle.

### Consequences / tradeoffs
- (+) B2-style "shuffle graveyard into deck" effects and any future "shuffle back" language now share one indirection.
- (+) Deck order stays untouched at End when there is no replen work.
- (−) Some flavor text and developer labels still say "deck"; that remains acceptable because the effect is intentionally routed through replen under the hood.

---

## P6-D7 — Camera angle was renegotiated while preserving the D4 x-axis invariant

### Status
**ADOPTED WITH NOTE.** Phase 6 changes the camera's height/depth/FOV to flatten labels, but keeps camera x centered at 0.

### Context / problem
Phase 2's `D4` recorded a load-bearing invariant: keep the camera centered on x=0 so the hand fan basis remains symmetric. Phase 6's mirrored board and stat tags made the existing angle too skewed; tags overlapped and read like tilted billboards.

### Decision
Retune camera presentation without panning horizontally:

- `src\board\boardConfig.ts` sets `CAMERA_POSITION` to `[0, 9.9, 6.3]`, `CAMERA_TARGET` to `[0, 0, -0.55]`, and `CAMERA_FOV` to `46`.
- `src\render\BoardView.tsx` centers/enlarges the playmat around the mirror center to span both boards.
- Board separation increases through `MIRROR_CZ = -1.25`.

### Relationship to Phase-2 D4
This **respects** the D4 camera-x invariant. Phase 6 renegotiates the pitch/framing to support stat readability and the mirrored field, but it does not move camera x off 0. The Phase-1/2 hand-fan basis remains symmetric.

### Guardrails
- Future camera changes may adjust height/depth/FOV, but horizontal camera panning still requires a deliberate fan-basis refactor and visual regression pass.
- Any stat-tag relocation remains a rendered verification item; unit tests do not prove text readability on the canvas.
