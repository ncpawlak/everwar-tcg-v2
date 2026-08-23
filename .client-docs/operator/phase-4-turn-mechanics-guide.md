# Operator Guide — Everwar Phase 4: Turn Mechanics

**Version:** Phase 4 close-out  
**Date:** 2026-08-23  
**Audience:** Anyone using the app

---

## What's New in Phase 4

Everwar now has a real single-player turn flow:

- **Draw → Main → Battle → Resolution → End**
- A **turn/phase HUD** under the hand shows where you are in the turn
- A **phase banner** slides across the battlefield when phases change
- Drawing happens from the **Draw phase** and card abilities — clicking the deck no longer draws
- **Main** is the only phase where you can set cards
- **Battle** lets you declare A-slot attackers
- **Resolution** rolls one D20 for each declared attacker
- **End** shuffles the replen pile into the deck and sends non-continuous B cards to the graveyard

There is still no Player 2, damage, win/loss state, or enemy turn in Phase 4.

---

## The Turn Flow

```text
Opening Deal
  ↓
Turn 1 Draw  →  Main  →  Battle  →  Resolution  →  End
                                      ↑              ↓
                         dice rolls auto-run     next turn Draw
```

### Opening Deal

The game still begins by dealing five cards into your hand. Once those five cards land, Turn 1 starts with Draw phase.

### Draw Phase

Draw phase is automatic:

- If your hand has fewer than six cards, it draws until you have six.
- If your hand already has six or more cards, it draws one card.
- After a short pause, it advances to Main by itself.

The Next Phase button is disabled during Draw because there is nothing to click.

### Main Phase

Main is where you set cards onto the board. You can set as many legal cards as your hand and slots allow.

Normal placement rules still apply:

- A cards go to A slots.
- B cards go to B slots.
- C cards go to C slots, and the linked A slot must already contain a card.
- For A/C cards, the linked column can highlight as a friendly drop surface, but the card still lands in its own type slot.

If you try to drag a card onto the board outside Main, it returns to your hand.

### Battle Phase

Battle is for declaring attackers. Click an occupied A-slot card to toggle it as an attacker. The linked A/C column glows gold while selected.

You can also click the linked C side of that same column; it resolves to the A card as the attacker. Empty columns and B cards cannot be attackers.

### Resolution Phase

Resolution runs automatically. Every declared attacker rolls a D20 at the same time.

What you will see:

- A die appears over each selected attacker's A/C linked area.
- Dice tumble briefly.
- Each die settles with a face oriented toward the camera.
- The displayed value locks in.
- Resolution then advances to End by itself.

The values are stored by the engine for later combat rules, but Phase 4 does not yet use them for damage.

### End Phase

End effects happen as soon as End begins:

- Replen is shuffled back into the deck.
- Non-continuous B cards on the board go to the graveyard.
- Continuous B cards stay on the board.
- Attack declarations and active dice are cleared.

Click **End Turn** to move to the next turn's Draw phase.

---

## Continuous B Cards

Two B cards are continuous in Phase 4:

- **B3 — Tempest Weaver**
- **B4 — Astral Archon**

Continuous B cards show a `◆ CONTINUOUS ◆` badge on their face and survive End phase. B1 and B2 do not; if they are still on the board when End starts, they move to the graveyard.

---

## What You'll See (Feedback Reference)

| Action | What you see |
|---|---|
| Opening deal finishes | Draw phase banner appears; one more card draws if hand is at five |
| Draw phase | HUD highlights Draw; Next Phase button disabled; phase auto-advances |
| Main phase | HUD highlights Main; cards can be dragged to legal slots |
| Invalid non-Main drop | Card springs back to hand |
| Clicking the deck | Nothing draws; deck drawing is phase/ability controlled |
| Battle phase A-card click | Linked A/C column gains or loses gold attacker outline |
| Resolution phase | Selected attackers roll D20s over their A/C columns |
| Resolution completes | Dice clear and End phase begins automatically |
| End phase starts | Replen folds into deck; non-continuous B cards move to graveyard |
| End Turn button | Advances to next turn's Draw phase |

---

## Troubleshooting

**I clicked the deck and nothing happened.**  
This is expected in Phase 4. Drawing is controlled by Draw phase and card abilities.

**I cannot place a card.**  
Check that you are in Main phase and that the slot is legal for the card type.

**My B card disappeared at End.**  
Non-continuous B cards are temporary and move to the graveyard when End starts. B3 and B4 are continuous and stay.

**I selected an attacker but no dice rolled.**  
Dice roll during Resolution, not Battle. Select attackers in Battle, then click Next Phase.

---

## What's NOT Here Yet (Coming in Later Phases)

- Player 2 / opponent turn
- Damage, defense comparison, or win/loss resolution
- Target selection beyond declaring A-slot attackers
- Using D20 results for combat math
- Turn history / combat log
- Sound effects
- Touch/mobile tuning
