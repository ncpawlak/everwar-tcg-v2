# Operator Guide — Everwar Phase 2: Game Board

**Version:** 0.3.0  
**Date:** 2026-08-22  
**Audience:** Anyone using the app  

---

## What's New in Phase 2

The board just got a lot more interesting! Phase 2 introduces:

- A **full 12-slot player field** with three typed card families (A, B, and C)
- **Cards that know their type** — each card shows its letter (A, B, or C) on its face
- **Type-gated placement** — you can only play a card into a slot that matches its type
- **Smarter drag highlights** — gold slots only light up where your specific card can go
- **Two new zones** on the right side of the board: a graveyard (GRAVE) and replenish
  (REPLEN) placeholder — labeled but not active yet
- **Board cards are smaller** than hand cards, giving the field a Master Duel–style
  compact look while your hand stays big and easy to read

The opening deal, click-to-draw, hover-to-raise, drag, snap, and spring-back all work
exactly as before.

---

## The Board

The playmat now has three distinct sections:

```
  [ A1 C1 ]  [ A2 C2 ]  [ A3 C3 ]  [ A4 C4 ]    ← top row (A and C slots)
  [   B1  ]  [   B2  ]  [   B3  ]  [   B4  ]    ← bottom row (B slots)
                                                    GRAVE  (top-right)
                                                    DECK   (right)
                                                    REPLEN (far right)
```

- **Top row** — four side-by-side A/C pairs. Within each pair, A is on the left and C is
  on the right.
- **Bottom row** — four B slots, each centered under its A/C pair.
- **Right column** — the deck you draw from, a GRAVE placeholder above it, and a REPLEN
  placeholder to its right. GRAVE and REPLEN are labeled tiles but don't do anything yet.

---

## Your Cards

Your deck now has **12 cards**: four type-A, four type-B, and four type-C. Each card
shows its letter on the front face so you always know what it is.

At the start, five cards deal into your hand as before. Because the deck is interleaved,
your opening hand will have a mix of types — you won't get four of the same type all at
once.

---

## How to Play (Step by Step)

### Opening Deal

The game starts automatically. Five cards deal from the deck into your hand, one by one.
Sit back and watch — nothing to do here.

---

### Drawing More Cards

**Click on the deck** (the stack on the right) to draw one card at a time. Each draw pops
the top card into the right end of your hand fan. You can draw all 12 cards total
(5 auto-dealt + 7 by clicking).

---

### Hovering a Card

**Move your mouse over any hand card** to raise it for inspection. It lifts cleanly
above the board — at Phase 2 scale the raised card clears the B-row slots so it doesn't
visually collide with anything. Move away and it settles back.

---

### Dragging a Card to the Board

1. **Click and hold** on any hand card.
2. **Drag toward the board.** The card floats with your pointer.
3. **Watch the slots.** Only slots that match your card's type AND are empty will glow
   gold. A type-A card lights up empty A slots; a type-B card lights up empty B slots;
   and so on. Slots of the wrong type, or already-filled slots, stay dark.
4. **Release over a glowing slot** to play the card there. It shrinks to board scale
   and snaps into position.

**Important:** You cannot place an A card in a B or C slot, even if those slots are
empty. The gold glow is your guide — if no slot is glowing, there is no legal place
for this card right now.

---

### Invalid Drops

If you release a card anywhere other than a matching-type empty slot — over the wrong
type of slot, a filled slot, or open board space — the card **springs back to its place
in the hand** automatically.

---

### Playing All Three Types

Each column has an A slot (top-left), a C slot (top-right), and a B slot (bottom-center).
You can fill them in any order — a C card does not require the paired A to be played first,
and vice versa. Play cards in whatever order suits you.

---

## What You'll See (Feedback Reference)

| Action | What you see |
|---|---|
| App loads | 5 mixed-type cards deal into a fan from the deck |
| Looking at a hand card | Letter (A / B / C) visible on the card face |
| Hovering a hand card | Card rises above the board; clears the B row |
| Starting a drag | Card lifts and follows your pointer; matching-type empty slots glow gold |
| Dragging over a valid slot | Slot glows gold; card trails your pointer |
| Dragging over a wrong-type slot | Slot stays dark — not a legal target |
| Dragging over a filled slot | Slot stays dark — already occupied |
| Valid drop | Card shrinks to board scale and snaps into the matching slot |
| Invalid drop | Card springs back to its original fan position |
| Drawing from the deck | Card pops off the deck and joins the hand at full size |
| GRAVE / REPLEN zones | Labeled placeholder tiles — visible but not interactive yet |

---

## Troubleshooting

**The slot I'm hovering over isn't glowing.**
- Check your card's type letter (the letter on the face). The slot must match that letter
  AND be empty. A-type cards only light up A slots, B-type only B slots, C-type only C slots.

**My card disappeared during a drag.**
- It springs back to your hand after an invalid drop. Look at the fan at the bottom of the
  screen — it'll be there.

**The gold slots are gone before I finish dragging.**
- Make sure you're still holding the mouse button. If you accidentally released, the card
  snapped back to your hand.

**Everything froze.**
- Refresh the page. Phase 2 has no save state — the deck resets and re-deals.

---

## What's NOT Here Yet (Coming in Later Phases)

- Player 2 / opponent field (P2's side is planned; P1 is currently mirrored by design)
- Graveyard (GRAVE) behavior — cards sent there, browsing the graveyard
- Replenish (REPLEN) behavior
- Game rules (attacking, winning, losing)
- Real card art and names
- Sound effects
- Touch / mobile support
- Re-picking a card from the board back to your hand
