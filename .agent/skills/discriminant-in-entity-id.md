---
name: discriminant-in-entity-id
description: >
  Use when an entity has a category/type/kind that partitions its behavior and
  you're tempted to store it in a parallel lookup map (id → type). Instead encode
  the discriminant into the id itself via a template-literal union and derive it
  with a tiny helper — the two can never drift and types narrow automatically.
load_when: >
  Modeling ids for slots/zones/cards/tiles/entities that have a type or family;
  choosing between a template-literal id union and a parallel id→type map.
  Match keywords: template literal type, discriminated id, slot type, id→type map,
  parallel map, derive type from id.
upstream: true
---
# Skill: Encode the discriminant in the entity id

## Trigger
An entity id needs an associated category (a slot's accepted card type, a tile's
terrain, an item's rarity). The obvious move is a second map `Record<Id, Type>`.
That map is a drift hazard: add an id, forget the map entry, ship a bug the type
system never caught.

## The pattern
Make the type a *component of the id* using a template-literal union, then derive
it everywhere with one pure helper:

```ts
type CardType = 'A' | 'B' | 'C';
type SlotIndex = 1 | 2 | 3 | 4;
type SlotId = `${CardType}${SlotIndex}`;      // 'A1' … 'C4' — 12 exact members

const slotType = (id: SlotId): CardType => id[0] as CardType;
```

- The set of valid ids is now *exhaustively checked* by the compiler.
- `slotType`, label helpers, acceptance rules, and highlight logic all read the
  same single source (the id), so they cannot disagree.
- Adding/renaming a family is a loud, type-level change that fails the build
  until every switch/consumer is updated — exactly what you want.

## Gotchas
- **Indexing a `Record<SlotId, T>` with an interpolated string needs a cast:**
  `board[`${t}${i}` as SlotId]` — TS widens the interpolation to `string`.
- Keep the derive helper total and pure (no throw for in-union input); it's the
  choke point every consumer trusts.
- Only encode a discriminant that is genuinely intrinsic and immutable for that
  id. If the category can change at runtime, it's state, not identity.

## Evidence
Everwar Phase 2 (2026-08-22): slot type moved from a positional `slotA/B/C`
scheme to `SlotId = \`${CardType}${1|2|3|4}\``. `slotType`, `slotAcceptsType`,
gold-highlight, and labels all derive from the leading letter — no parallel map,
no drift. Surfaced independently by Senior Coder (decision D3) and Learner.
