# Technical Doc — Everwar Phase 7: Two-Sided Turn + Opponent AI Architecture

**Audience:** Coders and Senior Coders
**Phase:** 7 — Real Opponent Turn, Bidirectional Combat, Heuristic AI
**Shipped:** 2026-08-23 · Version 0.8.0
**Stack:** TypeScript · React + Vite · Three.js / React Three Fiber v8 + drei · Zustand (vanilla) · @react-spring/three · Vitest

---

## Overview

Phase 7 extends the architecture along one axis: **the opponent becomes a full second player**. There is no new rendering or state framework, and the pure rules modules (`slotRules`, `diceRules`, `combatStats`) are reused unchanged. The work is:

1. **State scale:** a complete opponent state slice (deck/hand/replen/graveyard + A/B/C board).
2. **Turn scale:** a timed `runOpponentTurn` driver invoked at the player's End phase.
3. **Combat scale:** bidirectional targeting/resolution (opponent as attacker).
4. **AI scale:** a small greedy heuristic play/attack policy.
5. **Presentation/input polish:** active-field border, hidden-hand reveal-on-set, paced plays, split hit-tests for targeting vs. inspection, truthful deck shrink.

The spine is unchanged:

```text
State (Zustand) → Pose Selectors → Spring Animation → Scene Render
                        ↑
             DOM Input (PointerControls)
```

---

## What Changed Per Layer

### Layer 1: Authoritative Game State (`src\state\`)

#### Types (`types.ts`)

The opponent gains a player-shaped slice:

```typescript
opponentDeck: CardId[];
opponentHand: CardId[];
opponentReplen: CardId[];
opponentGraveyard: CardId[];
opponentBoard:  Record<OppSlotId,  CardId | null>;   // O1..O4  (A)
opponentBBoard: Record<OppBSlotId, CardId | null>;   // OB1..OB4 (B)
opponentCBoard: Record<OppCSlotId, CardId | null>;   // OC1..OC4 (C)

oppAttackTargets: Partial<Record<OppSlotId, SlotId>>; // opponent O-slot → player A-slot
oppSummon: { cardId: CardId; slotId: OppSlotId | OppBSlotId | OppCSlotId } | null;
```

`PileSource` grows `'opponentGraveyard' | 'opponentReplen'` so both sides' piles use the shared browser. Opponent card HP folds into the existing `currentHp` sim.

#### Store (`gameStore.ts`)

New constants (top of file):

| Constant | Value | Meaning |
|---|---|---|
| `HAND_TARGET` | 6 | Opponent draw refill target (shared with player rule) |
| `OPP_PHASE_STEP_MS` | 1800 | Snappy Draw/Battle step spacing |
| `OPP_PLAY_SHOWCASE_MS` | 800 | Per-card reveal/showcase length |
| `OPP_PLAY_GAP_MS` | 650 | Pause between consecutive plays |
| `OPP_PLAY_STEP_MS` | `SHOWCASE + GAP` (1450) | Spacing between one play and the next |
| `OPP_MAIN_DURATION_MS` | `3 * OPP_PLAY_STEP_MS` (4350) | Dedicated Main window |

New / changed actions:

| Action | Phase 7 behavior |
|---|---|
| `runOpponentTurn()` | Invoked at the player's End; bumps `turn`, flips `activePlayer`, schedules Draw→Main→Battle→Resolution on timers. |
| `drawOpponentCards()` | Refills the opponent hand toward `HAND_TARGET` (min 1), staggered. |
| `opponentMainPhase()` | Chains `opponentPlayStep` at `OPP_PLAY_STEP_MS` (paced), one card per type. |
| `opponentPlayStep(playedTypes)` | Greedy A→C→B; re-reads `get()` each call; setting a C rolls `rollCBuff()`; reveals the set card. |
| `declareOpponentAttacks()` | Focus-fire target selection against the player's weakest A-cards. |
| `beginOpponentResolution()` | Rolls per attacker (`diceRules`), applies damage (`combatStats`); lethal → player graveyard (+ linked C). |
| `revealOppCard(cardId)` | Flips a played opponent card face-up via the summon showcase. |
| `oppActive()` | `activePlayer === 'opponent'` guard used by every timed step. |

The opponent turn timeline (relative to turn start):

```text
0                         → Draw   (drawOpponentCards)
OPP_PHASE_STEP_MS         → Main   (opponentMainPhase; plays paced at OPP_PLAY_STEP_MS)
+ OPP_MAIN_DURATION_MS    → Battle (declareOpponentAttacks)
+ OPP_PHASE_STEP_MS again → Resolution (beginOpponentResolution → returns control)
```

`createInitialState()` seeds a real opponent deck and **no longer seeds O1–O3 dummies** — the opponent starts empty.

---

### Layer 2: Board Rules and Layout (`src\board\`)

No rules forks. The opponent reuses `slotRules` for placement legality. `boardConfig.ts` already exposed `OPP_FULL_SLOT_POSITIONS` (all 12 mirrored zones); Phase 7 leans on it for both B/C rendering and hit-testing. `layout.ts` adds opponent B/C and fly-in poses:

- `opponentBSlotCardPose(...)`, `opponentCSlotCardPose(...)` — mirrored B/C board poses.
- `opponentSummonFromPose()` — the hand-center origin a played card flies in from.

---

### Layer 3: Pose Selectors + Animation (`src\animation\`)

`poseSelectors.ts` — `selectOpponentCardVisual(...)` gains OB/OC branches so opponent B/C cards resolve to their mirrored board poses (in addition to the existing summon/board/graveyard branches).

`MotionCard.tsx` — adds an optional `from?: Pose` prop. When present it seeds the spring's `from` on mount only, so a freshly-mounted card flies in from that pose instead of popping. `OpponentBoard` passes `from={visual.zone === 'summon' ? opponentSummonFromPose() : undefined}`, giving the reveal-on-set fly-in.

---

### Layer 4: Scene, Render, Input (`src\render\`, `src\input\`)

#### Opponent rendering

- `OpponentBoard.tsx` maps `opponentCards` through `selectOpponentCardVisual` + `MotionCard`; A-plates use `opponentEffectiveStats(state, slot)` so C-buffs show.
- `OpponentField.tsx` — the deck stack is driven by `useGameStore((s) => s.opponentDeck.length)`; `OPP_DECK_COUNT` removed.
- `OpponentHand.tsx` — hand backs and the deck-top origin come from `opponentDeck.length`.

#### Input / hit-testing (`hitTest.ts`, `PointerControls.tsx`)

Two distinct opponent hit-tests:

| Function | Resolves | Used for |
|---|---|---|
| `oppSlotAtPoint(point)` | Whole A-C link **column** → its O-slot (hits A and mirrored C zones) | Attack targeting |
| `oppCardAtPoint(point, boards)` | The **specific** card across O/OB/OC zones | Inspection |

`PointerControls` extends `Press` with `oppCardId`; onDown detects `oppSlot || oppCardId`, onUp routes attack targeting off `oppSlot` and inspection off `oppCardId` (`selectCard(press.oppCardId ?? …)`).

#### Turn / field presentation

The active player's field is bordered (thin, padded off the stat plates), keyed to `activePlayer` — a pure read of state, no rules coupling.

---

## File Structure Changes (Phase 7 additions/modifications)

```text
src\
  animation\
    MotionCard.tsx        ← CHANGED: optional `from` fly-in prop
    poseSelectors.ts      ← CHANGED: OB/OC branches in selectOpponentCardVisual
  board\
    layout.ts             ← CHANGED: opponent B/C poses + opponentSummonFromPose
  input\
    hitTest.ts            ← CHANGED: oppSlotAtPoint (A+C→O) + oppCardAtPoint
    hitTest.test.ts       ← CHANGED: P7 targeting + inspection coverage
    PointerControls.tsx   ← CHANGED: Press.oppCardId; targeting vs. inspect routing
  render\
    OpponentBoard.tsx     ← CHANGED: effective stats + summon fly-in
    OpponentField.tsx     ← CHANGED: deck stack from opponentDeck.length
    OpponentHand.tsx      ← CHANGED: hand/deck-top from opponentDeck.length
  state\
    types.ts              ← CHANGED: opponent deck/hand/replen + B/C boards, oppAttackTargets, oppSummon widened
    gameStore.ts          ← CHANGED: runOpponentTurn, drawOpponentCards, opponentMainPhase/PlayStep, bidirectional combat, pacing constants
    gameStore.test.ts     ← CHANGED: turn-loop, combat, AI, paced-timing tests
```

(Slices 1–3 also touched `cardData.ts` for the opponent deck seed and combat state init.)

---

## Testing Patterns

**139 tests total, 11 files, all in Vitest.**

Key Phase 7 coverage in `gameStore.test.ts`:

- Turn alternation and phase timing driven with fake timers (`vi.advanceTimersByTime`), using the exported `OPP_PHASE_STEP_MS`, `OPP_PLAY_STEP_MS`, `OPP_PLAY_SHOWCASE_MS`, `OPP_MAIN_DURATION_MS`.
- Bidirectional resolution: opponent attacks apply damage; lethal sends the player card (+ linked C) to graveyard.
- AI play-step: one-per-type A→C→B, C-buff on a same-turn A, plays-nothing when the hand is empty.

`hitTest.test.ts` covers A-C-link column targeting and specific-card inspection.

Validation run:

```text
npx vitest run     → 139 passed (11 files)
npx tsc --noEmit  → clean
```

---

## Known Limitations and Tech Debt

| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | No win/loss conditions | High for product | The loop alternates indefinitely; add an end state next. |
| 2 | Fixed Main window wastes time | Low | `OPP_MAIN_DURATION_MS` is constant; dead air when the opponent plays < 3 cards. Make dynamic if it annoys. |
| 3 | Opponent B-card abilities don't fire | Medium | B cards are placed but on-play effects aren't resolved for the AI yet. |
| 4 | No opponent tribute/Commander | By design | Free summons only this phase; route the opponent through the tribute gate later. |
| 5 | AI has no lookahead | Watch item | Greedy one-per-type heuristic; a scoring pass would improve choices. |
| 6 | Two target maps + two hit-tests | Low | `attackTargets`/`oppAttackTargets` and `oppSlotAtPoint`/`oppCardAtPoint` must stay in sync as zones evolve. |
| 7 | `GameState` size roughly doubled | Low | More fields to keep synced in `createInitialState()`/`reset()`. |
