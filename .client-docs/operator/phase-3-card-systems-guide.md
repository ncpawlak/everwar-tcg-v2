# Operator Guide — Everwar Phase 3: Card Systems

**Version:** Phase 3 close-out  
**Date:** 2026-08-22  
**Audience:** Anyone using the app  
**Build health:** Current suite verified with `npx vitest run` (127 tests, 11 files; includes later Phase 6 work) and `npx tsc --noEmit`.

---

## What's New in Phase 3

Phase 3 makes cards feel like real game pieces:

- Click a card to open a large inspection panel on the left.
- Cards in hand, on board, and in pile-search windows can be inspected.
- Card faces now show name, cost, rarity, type, effect, and type-specific info.
- Destroyed cards move to the GRAVE pile.
- Replenish and disturb mechanics move cards into the REPLEN pile.
- Deck, Graveyard, and Replenish can be searched in a pop-up grid.
- Shuffle buttons animate the deck splitting and collapsing.
- A-zone cards show floating HP / ATK / DEF overlays.
- C cards boost linked A cards.
- B cards trigger simple on-play abilities.
- A played card now gets a summon reveal before it flies into its slot.

---

## Inspecting Cards

**Click a card** in your hand or on the board to open the left inspection panel.

The panel shows:

- Card name
- Type family
- Cost
- Rarity
- Effect text
- Flavor text
- Type-specific details:
  - **A cards:** HP, ATK, DEF
  - **B cards:** ability
  - **C cards:** boost text

Click another card to inspect it instead. Click empty board space to close the panel.

Dragging still works: click-and-hold, move the card, then release over a legal slot.

---

## Card Types in Phase 3

### A Cards — Combat Units

A cards are the main combat bodies. When an A card is placed in an A slot, a floating stat plate appears above its linked A/C pair.

The plate shows:

- HP bar and HP number
- ATK
- DEF

### C Cards — Support Boosts

C cards are no longer combat bodies. They support a linked A card.

Rules:

- A C card can only be placed if its linked A slot is already occupied.
- `C1` supports `A1`, `C2` supports `A2`, and so on.
- When placed, the C card rolls a boost to HP, ATK, or DEF.
- The floating stat plate updates immediately.
- Grey text means unchanged, green means boosted, and red means reduced.

### B Cards — Abilities

B cards are ability cards. When set into a B slot, they reveal, land, and then trigger:

| Card | Ability |
|---|---|
| B1 | Draw 1 card |
| B2 | Shuffle graveyard into deck |
| B3 | Shuffle replenish into deck |
| B4 | Draw 2 cards, staggered |

---

## Temporary Control Buttons

Phase 3 still uses temporary developer buttons for mechanics that will later become turn/phase actions.

### Destroy

- **Destroy — Zone A → Grave**: picks an occupied A slot at random, sends that A card to GRAVE, and also sends its linked C card if one is present.
- **Destroy — Zone B → Grave**: picks an occupied B slot at random and sends that card to GRAVE.

### Replenish and Disturb

- **Replen — Zone A → Replen**: picks an occupied A slot at random and sends that A card plus linked C card to REPLEN.
- **Disturb — Deck top → Replen**: moves the top card of the deck into REPLEN.

### Shuffle

- **Shuffle Deck**: splits the deck into two lifted piles, then collapses it in randomized order.
- **Replen → Deck + Shuffle**: moves all REPLEN cards into the deck, then shuffles.
- **Grave → Deck + Shuffle**: moves all GRAVE cards into the deck, then shuffles.
- **Hand → Deck + Shuffle**: returns the hand to the deck, then shuffles.

### Search

- **Search — Deck**
- **Search — Graveyard**
- **Search — Replen**

Each opens the same pop-up grid. Cards in the grid are clickable; clicking one opens it in the inspection panel.

---

## What You'll See (Feedback Reference)

| Action | What you see |
|---|---|
| Click a card | Left inspection panel slides in |
| Drag a card | Card follows the pointer; legal slots highlight |
| Valid drop | Card pops up large, gold ripple plays, then card flies to its slot |
| Set an A card | Stat plate appears above its A/C pair after the reveal |
| Set a C card | Linked A stat plate updates; boosted stat turns green |
| Try to set C with no linked A | C slot does not highlight; invalid drop springs back |
| Set a B card | Ability resolves after the reveal |
| Destroy Zone A | A card and linked C card move to GRAVE |
| Disturb deck | Top deck card moves to REPLEN |
| Shuffle deck | Deck splits into two stacks, then recombines |
| Search a pile | Pop-up grid opens; cards can be inspected |

---

## Troubleshooting

**A C slot is not glowing.**
- Its linked A slot must be occupied first. Example: `C3` only accepts a C card when `A3` has a card.

**The stat plate did not appear immediately.**
- During summon reveal, the A card is showcased first. The stat plate appears once it lands.

**A B card did not show ATK/DEF.**
- Correct for Phase 3. B cards are ability cards now.

**Draw 2 looks staggered, not simultaneous.**
- Correct. Phase 3 intentionally draws one card first, then the next shortly after.

**The buttons feel temporary.**
- They are. Phase 4 is planned for turn mechanics, which should replace many temporary controls with proper phase-aware actions.

---

## What's NOT Here Yet

- Turn structure / phases
- Player 2
- Real combat damage and current HP tracking
- Resource costs
- Real target selection for destroy/replen effects
- A formal ability stack or chain system
- Save/load state
- Touch/mobile tuning
