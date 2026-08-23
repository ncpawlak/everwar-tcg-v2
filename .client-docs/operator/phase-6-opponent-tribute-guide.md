# Operator Guide — Everwar Phase 6: Opponent Board + Tribute Summoning

**Version:** 0.7.0  
**Date:** 2026-08-23  
**Audience:** Anyone using the app

---

## What's New in Phase 6

Phase 6 adds a true table-opponent feel and a new way to summon powerful A-cards:

- A **mirrored opponent board** across the table
- Opponent deck/replen/grave zones on the top-left side
- Opponent cards that lie **upside-down**, while HP/DMG/ACC tags stay readable
- Opponent opening draw animation
- Destroyed opponent cards now travel to the opponent graveyard
- A-card **summon levels**
- A **tribute-summon popup** for level-3 A-cards
- A new level-3 Commander card: **Aurelian Warlord**
- HP bars on top of A-cards, with DMG/ACC underneath
- "Shuffle into deck" effects now route cards through replen
- End phase only shuffles the deck when replen has cards

---

## The Two-Sided Board

The player board remains closest to you. The opponent board is mirrored across the table:

```text
Opponent side
  Deck / Grave / Replen at top-left
  Mirrored A/C and B zones across the top half
  Opponent A-cards are upside-down

Player side
  Your A/C and B zones
  Your Grave / Deck / Replen at bottom-right
  Your hand at the bottom
```

The opponent's field has the same zone language as yours. At Phase 6, the opponent's A-row is the active combat target area; the rest of the mirrored slots are visible board structure.

---

## Opponent Animations

### Opening Draw

When the app starts, the opponent also deals five face-down cards from their deck into their hand. This is visual only for now; the opponent does not yet take turns or play from that hand.

### Destroyed Opponent Cards

When you deal lethal damage to an opponent A-card:

1. Damage lands during Resolution.
2. The target plays the destruction slash effect.
3. The defeated card travels to the opponent graveyard pile.
4. The game then continues to End phase.

The card should no longer simply vanish.

---

## Reading A-Card Stats

Each occupied A-card shows two stat tags:

| Tag | Location | Meaning |
|---|---|---|
| HP number + bar | Top of the A-card | Current HP / Max HP and health remaining |
| DMG/ACC | Bottom of the A-card | Damage and accuracy |

The HP bar changes color as health drops:

- Green: healthy
- Yellow: wounded
- Red: low HP

If a linked C-card boosts a stat, the stat readout updates and recolors.

---

## A-Card Summon Levels

Your A-cards now have summon levels:

| Card | Level | Notes |
|---|---:|---|
| Ironclad Lancer | 1 | Free summon |
| Ashborne Vanguard | 2 | Free summon |
| Emberfang Reaver | 2 | Free summon |
| Warcry Commander | 3 | Requires tribute |
| Aurelian Warlord | 3 | Commander; requires tribute |

Level 1 and level 2 A-cards can be set into any legal open A slot during Main phase.

Level 3 A-cards require a tribute summon.

---

## Tribute Summoning

To play a level-3 A-card:

1. You must already control board A-cards whose levels can add up to exactly 3.
2. Drag or quick-place the level-3 A-card into an open A slot.
3. The tribute popup opens.
4. Select A-card materials until the counter reads exactly `3/3`.
5. Confirm to summon the level-3 card.

Valid material examples:

- Level 1 + Level 2 = 3
- Level 1 + Level 1 + Level 1 = 3

Invalid examples:

- Level 2 alone = 2
- Level 2 + Level 2 = 4
- No A-cards on board = cannot afford tribute

If you cannot afford the tribute, no gold A-slot highlights appear and dropping the card does nothing.

---

## What Happens to Tribute Materials

When you tribute an A-card, its linked C-card in the same column goes with it.

| Summoned card | Where materials go |
|---|---|
| Ordinary level-3 A-card, such as Warcry Commander | Replen |
| Commander, Aurelian Warlord | Graveyard |

The summoned card itself moves from your hand to the chosen A slot after you confirm.

---

## Commander Card

**Aurelian Warlord** is the new fifth A-card:

- Type: A
- Rarity: Legendary
- Level: 3
- Commander: yes
- Stats: 2600 DMG / 180 ACC / 2500 HP

It follows the same exact-3 tribute rule as Warcry Commander, but its materials are sent to the graveyard instead of replen. Its level and `★ COMMANDER ★` tag appear on both the 3D card face and inspection popup.

---

## Replen and "Shuffle Into Deck"

"Shuffle into deck" now has a two-step meaning:

1. The effect sends cards into **replen**.
2. Replen folds back into the deck during End phase.

This means a card like Runescribe Oracle can clear your graveyard, but those cards first appear in replen instead of immediately joining the deck.

End phase only shuffles if replen has cards. If replen is empty, the deck stays still.

---

## Troubleshooting

**My level-3 A-card shows no gold slots.**
- You do not currently have board A-card materials that can sum exactly to 3, or there is no open legal A slot.

**The tribute confirm button is disabled.**
- The selected material levels do not equal the required total. For current level-3 summons, make the counter read `3/3`.

**A linked C-card disappeared when I tributed its A-card.**
- That's expected. Linked C-cards leave with their A-card material.

**Aurelian Warlord sent my materials to graveyard instead of replen.**
- That's expected. Commander tribute materials go to graveyard.

**The deck did not shuffle at End.**
- Replen was empty. Phase 6 intentionally skips empty End-phase shuffles.

---

## What's NOT Here Yet

- Real opponent turns / AI
- Real opponent deck and hand state
- Opponent B/C card behavior
- Win/loss conditions
- Touch/mobile tuning
- Final card art
