# Phase 5 Taskboard — Dice Combat

**Phase:** Phase 5  
**Scope:** Convert Resolution from a visual dice flourish into a combat system: real HP/DMG/ACC stats, pure D20 outcome rules, opponent targeting during Battle, target-side damage/HP drain, and destruction feedback. Preserve Phase 4's turn flow and existing card-placement rules.  
**Stack:** TypeScript · React + Vite · React Three Fiber + drei · Zustand · @react-spring/three · Vitest.  
**Landed:** commit `6385a1b` — close-out validation green (`npx vitest run`: 127 tests in current Phase-6-bearing tree; `npx tsc --noEmit` clean).

## Story field legend

- **ID:** Stable Phase 5 story identifier.
- **Depends on:** Prerequisite stories that must land first.
- **Acceptance criteria:** Testable checklist mapped to Phase 5 requirements.
- **Test plan:** Unit/regression vs. rendered browser verification.

## Dependency backbone

`P5-S01 → {P5-S02, P5-S03} → P5-S04 → P5-S05 → P5-S06 → P5-S07 → P5-S08 → P5-S09 → P5-S10`

---

### P5-S01: Migrate combat stats to HP/DMG/ACC

**Depends on:** Phase 4 committed state (`7f4063b`)  **Status:** ✅ done

**Description:** Replace placeholder ATK/DEF vocabulary with the actual combat stats: HP, DMG, and ACC. A-cards receive DMG/ACC/HP; C-card boosts can affect any of the three stats; cards, inspection UI, pile UI, and stat overlays render the new names.

**Acceptance criteria:**
- [x] `Card` in `src\state\types.ts` exposes `dmg?`, `acc?`, and `hp?`.
- [x] `StatKey` and `combatStats` use `hp | dmg | acc`.
- [x] A-card data in `src\state\cardData.ts` uses base-10 DMG and ACC ≤ 200.
- [x] `CardView`, `InspectionPanel`, `PileSearchModal`, and `StatOverlay` show DMG/ACC, not ATK/DEF.

**Test plan:** Unit — `cardData.test.ts`, `combatStats.test.ts`. Typecheck confirms no stale `atk`/`def` fields remain.

---

### P5-S02: Pure D20 dice-rules module

**Depends on:** P5-S01  **Status:** ✅ done

**Description:** Add `src\state\diceRules.ts` with the user-confirmed D20 rules: low rolls 1–2 glance, 19–20 crit, normal hits up to `floor(ACC/10)`, misses above the threshold through 18, and high-ACC cards crit when rolling exactly their threshold.

**Acceptance criteria:**
- [x] `classifyRoll(roll, acc)` returns `glancing`, `normal`, `miss`, or `crit`.
- [x] `resolveRoll(roll, dmg, acc)` scales DMG by 0.5/1/0/2.
- [x] ACC only controls thresholds; DMG is the value modified by outcomes.
- [x] Edge cases for ACC 20, 70, 100, 130, and 200 are covered.

**Test plan:** Unit — `diceRules.test.ts`.

---

### P5-S03: Feed Resolution dice into combat results

**Depends on:** P5-S02  **Status:** ✅ done

**Description:** Update `gameStore.beginResolution` so each declared attacker rolls after the Resolution banner delay, settles after the dice animation, resolves through `effectiveStats` + `resolveRoll`, and stores results in `resolutionResults`/`lastRolls`.

**Acceptance criteria:**
- [x] Dice wait for `RESOLUTION_ROLL_DELAY_MS`.
- [x] One roll is created per declared attacker.
- [x] Settled rolls create `RollResult` entries.
- [x] No-attacker Resolution advances to End without dice.

**Test plan:** Unit — fake-timer coverage in `gameStore.test.ts`.

---

### P5-S04: Source-side outcome popups

**Depends on:** P5-S03  **Status:** ✅ done

**Description:** Show an outcome word above each attacking A/C column after dice settle: MISS (grey), HIT (white), GLANCING (cyan), CRITICAL (gold). Keep text within the stat plate width and clear it with the dice.

**Acceptance criteria:**
- [x] `OutcomePopups` reads `outcomePopups` from the store.
- [x] Popups appear after the dice settle/hold, not while rolling.
- [x] Popups and dice clear together after `OUTCOME_POPUP_MS`.
- [x] End does not begin until the popup dwell ends.

**Test plan:** Unit — store timing tests; Render — user screenshot/feel approval.

---

### P5-S05: Animated HP damage simulation

**Depends on:** P5-S03, P5-S04  **Status:** ✅ done

**Description:** Introduce `currentHp` and animate HP bar drain. The stat overlay displays current/max HP and recolors by threshold: green above half, yellow/amber at half, red below 25%.

**Acceptance criteria:**
- [x] `currentHp` stores damaged cards by id; absent means full HP.
- [x] Damage clamps at zero.
- [x] `StatOverlay` animates the HP fill width.
- [x] HP fill recolors using the expected thresholds.

**Test plan:** Unit — `gameStore.test.ts`; Render — user visual approval.

---

### P5-S06: Death/destruction feedback and phase hold

**Depends on:** P5-S05  **Status:** ✅ done

**Description:** When a card hits zero HP, show a red destruction slash and hold Resolution until the destruction visual finishes before entering End.

**Acceptance criteria:**
- [x] Lethal damage flags a slot in `destroying`.
- [x] The red X-slash effect appears via `DestructionFx`.
- [x] Dead targets are removed only after the dwell.
- [x] End phase waits for `GRAVEYARD_TRAVEL_MS` when destruction occurs.

**Test plan:** Unit — lethal-damage fake-timer test; Render — user visual approval.

---

### P5-S07: Main-phase double-click auto-place

**Depends on:** Existing placement rules  **Status:** ✅ done

**Description:** Let a player double-click a hand card during Main to quick-set it into the first legal slot for its type. Do nothing outside Main, while dragging, or when no legal target exists.

**Acceptance criteria:**
- [x] `autoPlaceCard` uses `validTargetSlots` and shared placement commit logic.
- [x] A cards fill the next legal A slot in board order.
- [x] C cards do nothing when their linked A prerequisite is missing.
- [x] The action is blocked outside Main.

**Test plan:** Unit — `gameStore.test.ts`; Input — `PointerControls` dblclick path.

---

### P5-S08: Opponent Vanguard row

**Depends on:** P5-S05  **Status:** ✅ done

**Description:** Add a far-side opponent row with four potential `OppSlotId`s and three seeded dummy A-cards. Render each occupied opponent card face-up with HP/DMG/ACC stats and an animated HP bar.

**Acceptance criteria:**
- [x] `OppSlotId`, `opponentCards`, and `opponentBoard` are part of `GameState`.
- [x] `OPP_SLOT_IDS`/`OPP_SLOT_POSITIONS` define the far row.
- [x] `createInitialOpponents` seeds O1–O3 and leaves O4 empty.
- [x] `OpponentBoard` renders occupied opponents without adding them to player `cardsById`.

**Test plan:** Unit — initial-state tests; Render — visual verification.

---

### P5-S09: Battle-phase opponent targeting

**Depends on:** P5-S08  **Status:** ✅ done

**Description:** Replace selected attackers with explicit source→target declarations. In Battle, clicking a player A/C column starts aiming that column's A-card; clicking an occupied opponent card commits the target; arrows persist through Resolution.

**Acceptance criteria:**
- [x] `attackTargets` maps player A-slot to opponent slot.
- [x] `aimAttack`, `assignTarget`, `cancelTargeting`, and `setAimPoint` drive the interaction.
- [x] Empty A-slots, B-slots, empty opponent slots, and non-Battle phases are ignored.
- [x] Multiple attackers can target the same opponent.
- [x] `TargetingArrows` draws committed and live rubber-band arrows.

**Test plan:** Unit — store action tests; Input — `oppSlotAtPoint` and `PointerControls`; Render — user verification.

---

### P5-S10: Target-side damage and opponent removal

**Depends on:** P5-S09  **Status:** ✅ done

**Description:** During Resolution, aggregate each attacker's resolved damage onto its targeted opponent, show one red `-{total}` popup per damaged opponent, drain that opponent's HP bar, and remove any opponent reduced to zero after the slash dwell.

**Acceptance criteria:**
- [x] Damage sums by `OppSlotId`.
- [x] `DamagePopups` appears over the opponent target, not the attacking source.
- [x] Lethal opponents vanish from `opponentBoard`.
- [x] Attack declarations clear on End; `lastRolls` persists for later inspection.

**Test plan:** Unit — resolution target-damage and death tests; Render — user verification.

