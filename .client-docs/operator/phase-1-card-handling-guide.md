# Operator Guide — Everwar Phase 1: Card Handling

**Version:** 0.2.0  
**Date:** 2026-08-22  
**Audience:** Anyone using the app  

---

## What's New in Phase 1

Everwar Phase 1 introduces the tactile 3D card experience. You can now:

- Watch your opening hand deal itself out from the deck
- Draw additional cards by clicking the deck
- Hover over a card to raise it for a closer look
- Drag a card from your hand and drop it onto the board
- See the board slots light up gold to tell you where you can play

There are **no game rules yet** — Phase 1 is purely about how the cards feel in your
hands. Think of it as the satisfying shuffle and deal before the game begins.

---

## The Board

When you open the app you'll see a dark playmat viewed from a slight angle above, like
looking down at a card table. You'll notice:

- **The deck** — a stack of face-down cards on the right side of the board
- **Three empty slots** — in the center of the playmat, where cards can be placed
- **Your hand** — a fan of cards along the bottom of the view

---

## How to Play Around (Step by Step)

### Opening Deal

The game starts automatically. Five cards deal themselves from the deck into your hand
one by one, each one fanning out a little further. You don't need to do anything — just
watch.

After the deal, your hand has 5 cards and the deck has 5 remaining.

---

### Drawing More Cards

**Click on the deck** (the stack of face-down cards on the right) to draw one card at
a time. Each drawn card pops off the top of the deck and joins the right end of your
hand fan.

- You can draw until the deck is empty (10 draws total, including the opening 5)
- Clicking an empty deck does nothing

---

### Hovering a Card

**Move your mouse over any card in your hand.** The card will rise straight up slightly,
like picking it off the table to look at it. This is just a visual hint — nothing is
selected or committed yet. Move your mouse away and the card settles back into the fan.

---

### Dragging a Card to the Board

1. **Click and hold** on any hand card. Your cursor changes to a grabbing hand 👆.
2. **Drag toward the center of the board.** The card follows your pointer, floating
   slightly above the playmat.
3. As you move over the board, the **empty slots glow gold** — those are valid places
   to play your card. Already-filled slots do not glow.
4. **Release the mouse** over a glowing slot to place the card there. It snaps into
   position with a satisfying click.

The placed card stays on the board permanently (for this session). You can't pick it
back up.

---

### Invalid Drops (Snap-Back)

If you release a card in the wrong place — over empty board space, over a slot that's
already filled, or anywhere off the playmat — the card **springs back to its place in
your hand** automatically. Your hand reflows around it as if nothing happened.

---

## What You'll See (Feedback Reference)

| Action | What you see |
|---|---|
| App loads | 5 cards deal from the deck into a fan, one by one |
| Hovering a hand card | Card rises upward; cursor becomes a pointer hand |
| Starting a drag | Card lifts off and follows your pointer; empty slots glow gold |
| Dragging over an empty slot | Slot glows gold (already showing); card trails your pointer |
| Valid drop | Card snaps into the slot with a spring; hand reflows |
| Invalid drop | Card springs back to its original fan position |
| Drawing from the deck | Card pops off the deck top and joins the hand |
| Deck is empty | Clicking the deck does nothing |

---

## Troubleshooting

**The cards don't move when I click.**
- Make sure you're clicking directly on a card face, not on the empty board. The click
  area matches the card's visible face.
- Try clicking a little more toward the center of the card.

**My card disappeared during a drag.**
- It snapped back to your hand after an invalid drop. Scroll your view to the hand fan
  at the bottom of the screen — it should be there.

**The hover lift isn't showing.**
- Make sure you're hovering over a hand card (in the fan at the bottom), not a deck
  card or a board card. Only hand cards respond to hover.

**Everything froze.**
- Refresh the page. Phase 1 has no save state — the deck will reset and re-deal.

---

## What's NOT Here Yet (Coming in Later Phases)

- Game rules (playing cards, attacking, winning)
- Real card art and names
- Sound effects
- Opponent cards
- Touch / mobile support
- Animations for placing cards back from the board to the hand
