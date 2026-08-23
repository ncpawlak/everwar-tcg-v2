# Operator Guide — Everwar Phase 5: Dice Combat

**Version:** Phase 5 close-out  
**Date:** 2026-08-23  
**Audience:** Anyone using the app

---

## What's New in Phase 5

Phase 5 adds the first playable combat loop:

- A-cards now have **HP**, **DMG**, and **ACC**
- The **Resolution** phase rolls D20 dice and turns each roll into MISS, HIT, GLANCING, or CRITICAL
- The opponent now has a far-side row of Vanguard cards with their own HP bars
- During **Battle**, you choose which opponent card each of your A-cards attacks
- Faint gold arrows show your declared attack targets
- During Resolution, damage lands on the targeted opponent card
- Opponent HP bars drain and change color as health drops
- Destroyed opponents get a red slash effect and vanish before End begins
- Double-clicking a hand card in Main quick-places it into its next legal slot

---

## The Combat Stats

Each Vanguard (A-card) displays:

| Stat | Meaning |
|---|---|
| HP | Health. The card is destroyed at 0. |
| DMG | Damage dealt on a normal hit. |
| ACC | Accuracy. Higher ACC improves the D20 hit threshold. |

The floating stat plate above a Vanguard shows current HP and the card's effective DMG/ACC.
If a linked C-card boosts a stat, the overlay updates automatically.

---

## Dice Outcomes

When an attacking A-card rolls in Resolution:

| D20 roll | Result | Damage |
|---|---|---|
| 1–2 | GLANCING | Half DMG |
| 3 through ACC threshold | HIT | Full DMG |
| Above threshold through 18 | MISS | No damage |
| 19–20 | CRITICAL | Double DMG |
| Exact ACC threshold, when ACC > 100 | CRITICAL | Double DMG |

ACC is shown as a base-10 value. For example, ACC 130 means a D20 threshold of 13.

---

## How to Attack

### 1. Set an A-card

During **Main**, drag an A-card into an A slot or double-click it in your hand to quick-place
it into the first legal A slot.

### 2. Enter Battle

Use **Next Phase** until the HUD reaches **Battle**.

### 3. Choose an attacker

Click one of your occupied A-card columns. The column highlights gold and an aiming arrow can
follow your pointer.

### 4. Choose a target

Click an occupied opponent card in the far row. A faint gold arrow remains from your A-card to
that opponent. You can repeat this for each of your A-cards, and multiple attackers may target
the same opponent card.

### 5. Resolve

Advance from Battle to **Resolution**. Each declared attacker rolls a D20 over your card. Once
the dice settle:

- MISS/HIT/GLANCING/CRITICAL appears over your attacker
- Red damage appears over the opponent target
- The opponent HP bar drains
- Destroyed opponents get a red X-slash and vanish

The End phase waits until this feedback finishes.

---

## What You'll See

| Action | What you see |
|---|---|
| Main-phase double-click on a hand card | The card quick-sets into its first legal slot, if one exists |
| Battle click on your occupied A column | The column highlights and aiming begins |
| Battle click on an opponent while aiming | A faint gold arrow locks in from attacker to target |
| Multiple attackers target one opponent | Multiple arrows converge; damage stacks |
| Resolution begins | Dice wait until the Resolution banner clears |
| Dice settle | The die value locks in; outcome appears over your attacker |
| Damage applies | Red `-damage` appears over the opponent and its HP bar drains |
| Opponent reaches 0 HP | Red slash appears; the opponent card vanishes before End |

---

## Troubleshooting

**I clicked my card in Battle but no arrow appeared.**
- Only occupied A-card columns can attack. B cards and empty A columns cannot declare attacks.

**I clicked an opponent but it did not target.**
- You must first click one of your occupied A-card columns to enter targeting mode. Empty opponent slots cannot be selected.

**Can two of my cards attack the same opponent?**
- Yes. Their damage is summed into one red damage popup on that opponent.

**Why did End not start immediately after the dice?**
- Resolution waits for dice, result popups, HP drain, and destruction effects to finish so the combat moment is readable.

---

## What's NOT Here Yet

- Full Player 2 turns, hand, deck, or graveyard
- Opponent graveyard browsing
- Win/loss conditions
- Manual retargeting UI beyond clicking the source again
- Card art, sound effects, and mobile/touch tuning

