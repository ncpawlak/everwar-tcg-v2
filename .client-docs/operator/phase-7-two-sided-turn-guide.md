# Operator Guide — Everwar Phase 7: Two-Sided Turn + Opponent AI

**Version:** 0.8.0
**Date:** 2026-08-23
**Audience:** Anyone using the app

---

## What's New in Phase 7

Phase 7 makes the opponent a real player that takes its own turn:

- The opponent **draws, summons, and attacks** on its own turn
- **You always go first**; after you end your turn, the opponent plays automatically
- The opponent has a real **deck, hand, graveyard, and replen** — its deck shrinks as it draws
- The opponent can play **A, B, and C cards**, and more than one A per turn
- A simple **AI** builds a board and focus-fires your weakest cards
- The opponent's **hand is hidden**; each card flips face-up as it's played
- The **active player's field is outlined** so you always know whose turn it is
- You can **inspect the opponent's A/B/C cards** (not their hidden hand)
- Both players' **graveyard and replen piles** open the card-browser popup
- You can declare an attack by clicking **anywhere in an A-C link column**

---

## How a Turn Flows Now

```text
Your turn:   Draw → Main (play cards) → Battle (declare attacks) → Resolution (dice) → End
                                                                                   │
                                                                                   ▼
Opponent turn: Draw → Main (AI plays) → Battle (AI attacks) → Resolution (dice) → End
                                                                                   │
                                                                                   ▼
                                                                          Back to your turn
```

- You play first every game.
- When you reach End, the opponent automatically takes its whole turn.
- The turn counter goes up for the opponent's turn too.
- On turn 1 you'll have no attack targets — the opponent's field is still empty. That's expected.

---

## Whose Turn Is It?

The **active player's field is outlined**. Your field lights up on your turn; the opponent's field lights up while the AI is playing. The outline is thin and padded so it doesn't cover the cards' HP/DMG/ACC numbers.

---

## The Opponent AI

On its Main phase the opponent:

1. Summons an A-card into an open slot.
2. Adds a C-card to boost one of its A-cards.
3. Plays a beneficial B-card.

It plays **one of each type per turn**, one card at a time with a short pause between them so you can see each summon. Then at Battle it **focus-fires your weakest / lowest-HP A-cards**.

This phase the opponent uses **free summons only** — it does not tribute or play a Commander yet.

---

## The Opponent's Hidden Hand

The opponent's hand is **face-down**. You can't see what it's holding. When it plays a card, that card **flips face-up and flies onto the field** with the summon flash, so you see exactly what it summoned as it lands.

---

## Inspecting Opponent Cards

- Click an opponent **A, B, or C card on the field** to open its inspection popup, just like your own cards.
- You **cannot** inspect the opponent's hidden hand.
- Click either side's **graveyard or replen** pile to open the card browser and look through it.

---

## Attacking

- Click **anywhere in one of your A-C link columns** to declare that column's A-card an attacker (you no longer have to click the A-card exactly).
- Valid opponent targets glow gold; click one to lock your attack.
- At Resolution each attacker rolls a die and applies damage. Cards drained to 0 HP are destroyed and travel to the graveyard.

The opponent attacks you the same way on its turn.

---

## When Cards Are Destroyed

- A destroyed A-card travels to its owner's graveyard.
- Its **linked C-card goes to the graveyard with it** — on both your board and the opponent's.

---

## Troubleshooting

**The opponent didn't attack me on turn 1.**
- Correct — you go first, so on turn 1 the opponent has just summoned and may attack from its next turn onward once it has attackers.

**I can't click the opponent's hand.**
- That's intentional. The opponent's hand is hidden; only its played (face-up) cards are inspectable.

**The opponent is playing its cards slowly, one at a time.**
- That's the intended pacing so each summon and its effects read individually.

**My C-card disappeared when my A-card was destroyed.**
- Expected. A linked C-card is destroyed together with its A-card.

**The game never ends.**
- There are no win/loss conditions yet; the turn loop alternates indefinitely for now.

---

## What's NOT Here Yet

- Win / loss conditions
- Opponent tribute summons and Commander plays
- Opponent B-card abilities actually firing
- AI lookahead / combos (the AI is a simple heuristic)
- Touch / mobile tuning
- Final card art
