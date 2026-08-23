# Specification — Everwar TCG · Phase 1 (Card-Handling Vertical Slice)

> Written by the **Planner** after grilling the user, with **Senior Coder** feasibility input. Approved by the user before implementation begins. Scope is Phase 1 ONLY — the tactile card experience. No game rules.

## 1. Objective

A browser-based, angled-3D-board vertical slice that nails the *feel* of drawing and placing 3D-object cards, benchmarked against YuGiOh: Master Duel (animation quality / fluidity only). Success = it looks and feels premium and fluid, verified by rendered review.

## 2. Tech Stack (Senior Coder confirmed for browser-first)

- **Language:** TypeScript
- **Rendering:** Three.js via **React Three Fiber (R3F)** + **drei** helpers
- **App shell:** React + Vite
- **State:** lightweight store (e.g. Zustand) holding authoritative deck/hand/board state; animations *visualize* state, they don't own it
- **Animation:** tween/spring layer (e.g. `@react-spring/three` or GSAP) driving position/rotation/scale, with **interruptible** transitions
- **Input:** pointer events + raycasting for card picking; drag projected onto a board plane
- **Delivery:** browser first; desktop later via a wrapper (Tauri/Electron) — no rewrite

## 3. Scene / Visuals

- **Camera:** perspective, tilted down at an angled playmat (Master-Duel-style). Fixed in Phase 1 (no camera moves required).
- **Board:** a playmat surface with a **deck zone** (right/side) and **3 placement spots** in a row.
- **Cards:** procedural thin beveled mesh (rounded corners), distinct **front** (with a number 1–10) and **back** texture; casts shadows; subtle specular. No authored glTF art in Phase 1.
- **Lighting:** basic key + fill + soft shadows, tuned for a premium look.

## 4. Card Lifecycle & State Model

Zones: `Deck → Hand → Dragging → Board`. Authoritative state:

```
deck:      cardId[]              // ordered stack, top = last drawn from
hand:      cardId[]              // ordered left→right, drives fan layout
board:     { slotA: id|null, slotB: id|null, slotC: id|null }
dragging:  cardId | null
```

Actions: `drawCard()`, `beginDrag(id)`, `updateDrag(pointer)`, `hoverSlot(id|null)`, `dropCard(id, slotId|null)`, `returnToHand(id)`.

## 5. Functional Requirements

**FR1 — Deck.** 10 cards render stacked with small positional/rotational offsets so it reads as a physical deck.

**FR2 — Opening draw.** On start, **5 cards auto-deal** in a **staggered sequence**: each top card pops off the deck and animates along an arc into the hand.

**FR3 — Hand layout.** Cards in hand arrange in a **fan/arc**, re-flowing smoothly as cards are added/removed.

**FR4 — Draw more.** After the opening 5, **clicking the deck** draws the next card (one per click) into the hand, until the deck is empty (10 total).

**FR5 — Hover lift.** Hovering a hand card **lifts/scales** it slightly for readability (mouse).

**FR6 — Drag.** **Click-and-hold** on a hand card begins a drag; the card follows the pointer (projected to a drag plane) with a natural lifted orientation/depth.

**FR7 — Valid-target highlight.** While dragging, every **empty** board spot shows a **gold outline**. Filled spots do not highlight.

**FR8 — Drop success.** Releasing over an empty spot **snaps** the card into that spot; it **stays put** (no re-pickup in Phase 1). The spot is now filled.

**FR9 — Drop fail.** Releasing anywhere invalid (not over a spot, or over a filled spot) **smoothly animates the card back** to its position in the hand.

**FR10 — Feel.** All transitions use easing and are **interruptible** (e.g. grabbing a card mid-layout doesn't break). Target smooth 60 FPS on a typical desktop browser.

## 6. Out of Scope (Phase 1)

Game rules/turns/win-conditions · real card data & abilities · re-picking placed cards · multiplayer/networking · accounts · audio · particle VFX · touch/mobile · multiple players/opponent · deck building.

## 7. Acceptance Criteria

Maps 1:1 to Success Criteria in `vision.md` + FR1–FR10. Logic (state transitions, fan-layout math, valid-drop rules) covered by unit tests; feel/animation quality confirmed by **rendered browser verification** (Constraint #14). No blocking issues; Senior + Reviewer sign-off.

## 8. Open Questions

**None.** Grill complete — spec is locked pending user approval (Gate 1).