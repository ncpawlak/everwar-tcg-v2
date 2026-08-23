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

---

# Specification — Everwar TCG · Phase 2 (Game Board Setup)

> Scoped by the Orchestrator after grilling the user; approved before implementation. Builds directly on the Phase 1 slice, reusing its state→selector→spring spine and DOM-driven input. Scope is Player 1's own field only (mirrored to Player 2 in a later phase). Still no game rules/turns.

## 1. Objective

Turn the 3 generic Phase 1 slots into a **typed, multi-zone player field** that reads like a real TCG board, keeping the approved Phase 1 card feel (fan, hover, drag, snap/return) untouched.

## 2. Board Layout

Three card families: **A**, **B**, **C** (4 slots each = 12 typed slots).

```
        A1 C1   A2 C2   A3 C3   A4 C4          [GRAVE]
          B1      B2      B3      B4       [DECK]   [REPLEN]
                     (hand fan below)
```

- **Top row:** four `[A | C]` pairs side by side — C sits immediately right of its paired A. Aligned horizontally with the **GRAVE** zone.
- **Bottom row:** four `B` slots, each centered on the x-midpoint between its paired A and C. Aligned horizontally with the **DECK** + **REPLEN** zones.
- **Right column:** deck (bottom), graveyard (above deck), replen (right of deck). GRAVE + REPLEN are **labeled empty placeholders — no behavior yet**.

## 3. Cards

- Deck = **12 cards**, 4 each of A/B/C, dealt **interleaved** so the opening 5 is a mix of types.
- Face shows the **type letter (A/B/C)** only (no color-coding, no index). Cream look retained.
- Cards **shrink on the board/deck** (Master-Duel-style) while the **hand stays full size**.

## 4. State Model (delta from Phase 1)

```
CardType = 'A' | 'B' | 'C'
SlotId   = `${CardType}${1|2|3|4}`   // A1..A4, B1..B4, C1..C4 (type is derivable from the id)
Card     = { id, type: CardType }    // replaces the Phase-1 number
board    = Record<SlotId, CardId | null>   // 12 typed slots
```

## 5. Functional Requirements

**FR1 — Typed field.** 12 slots render in the layout above; each slot shows its accepted type letter. Deck/graveyard/replen zones render (GRAVE/REPLEN labeled, empty).

**FR2 — Typed deck & deal.** 12-card deck (4×A/B/C), interleaved; auto-deal 5 then click-deck-to-draw is unchanged from Phase 1.

**FR3 — Typed cards.** Each card shows its A/B/C letter and shrinks to board scale when on the board/deck; hand cards stay full size.

**FR4 — Type-gated placement.** A card may be set **only** into an **empty slot whose type matches** the card. Type-gated *only* — a C card does not require its paired A to be filled.

**FR5 — Type-gated highlight.** While dragging, only **matching-type empty slots** show the gold outline.

**FR6 — Invalid drop.** Releasing over a wrong-type, filled, or non-slot target springs the card back to the hand (Phase 1 behavior, now type-aware).

**FR7 — Feel preserved.** The Phase 1 hand fan, hover-raise, drag, snap, and return are visually unchanged. Camera/hand retuned only to frame the wider board and keep a hover-raised card clear of the B row.

## 6. Out of Scope (Phase 2)

Graveyard/replen behavior · Player 2 / opponent field · re-picking placed cards · A–C adjacency or any inter-slot rules · turns/win-conditions · real card data · audio/VFX · networking.

## 7. Acceptance Criteria

Logic (typed slots, type-gated drop rules, board grid geometry, 12-slot hit-testing) covered by unit tests; board layout + card feel confirmed by **rendered browser verification** with user sign-off. Full suite green + typecheck clean.
