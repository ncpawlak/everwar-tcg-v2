---
name: policy-gate-as-pure-function
description: >
  Use when the same "is this action legal right now?" question is asked in two
  places — e.g. the UI that highlights valid targets and the store that validates
  the commit. Centralize the rule in ONE pure predicate both call, so the preview
  and the enforcement can never disagree, and the rule is trivially unit-tested.
load_when: >
  Validity/legality shared between a highlight/preview path and a commit/mutation
  path (drag targets, move legality, enable/disable). Match keywords: canDrop,
  valid targets, highlight vs validation, single source of truth rule, pure
  predicate, policy gate.
upstream: true
---
# Skill: One pure predicate drives both the highlight and the commit

## Trigger
Two code paths ask the same legality question:
- the **UI** ("which targets glow gold while dragging?")
- the **store/reducer** ("is this drop actually allowed on release?")

If each implements the rule, they drift: things glow that can't be dropped, or
vice-versa — a classic, maddening bug.

## The pattern
Write the rule once as a **pure function of state**, and have both callers use it:

```ts
// slotRules.ts — the single gate
export const canDrop = (board: Board, slot: SlotId, type: CardType): boolean =>
  board[slot] == null && slotType(slot) === type;

export const validTargetSlots = (board: Board, type: CardType): SlotId[] =>
  SLOT_IDS.filter(s => canDrop(board, s, type));

// UI highlight path
const targets = new Set(validTargetSlots(board, dragType));   // glow these

// store commit path
dropCard(cardId, slot) { if (!canDrop(board, slot, card.type)) return snapBack(); ... }
```

- The highlight is *literally* "the set of slots `canDrop` accepts" — it cannot
  show a target the commit will reject.
- The predicate is pure → unit tests are one-liners over hand-built states.
- New rules (adjacency, cost, ownership) go in **one** place and both paths inherit.

## Notes
- Keep the gate free of side effects and framework types — pass plain state in,
  get a boolean out. Selectors/handlers adapt it to their world.
- Beware selector identity: derive the highlight set from primitives and rebuild
  it in the component, don't return a fresh array from a memoized store selector
  every render (infinite-loop / churn risk).
- Scope the rule deliberately and lock the scope with a test (e.g. "type-gated
  only, no prerequisite slots yet") so a future tightening is a conscious change.

## Evidence
Everwar Phase 2 (2026-08-22): `canDrop` is the sole legality gate; `SlotView`
highlights exactly `validTargetSlots(...)` and `gameStore.dropCard` validates with
the same `canDrop`. Preview and enforcement are provably identical. Surfaced by
Learner; consistent with Senior Coder's placement-scope note.
