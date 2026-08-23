# Vision

> **This is the whiteboard in the middle of the office.** Every agent checks this document when they have a question about what we're building, why, and how the user wants things done. This is the source of truth for project direction and user preferences.

> This file is created collaboratively between the **Planner** and the **User** at the start of every new project.

## What is this project?

**Everwar** — a 3D trading-card game (TCG). The bar for animation quality, fluidity, and tactile feel is **YuGiOh: Master Duel** (feel only, not its rules or scale). The game is built in **phases**, and **every release must be stable**.

## Goals

- Deliver a premium, physical-feeling card experience: 3D-object cards, weighty draw animations, click-and-hold drag, satisfying placement.
- Ship in stable, incremental phases. Prove the *feel* before layering on rules, data, and networking.
- **Phase 1 (current):** the tactile card-handling vertical slice — animations, flow, fluidity, and setup. No game rules yet.

## Non-Goals

- **Phase 1 explicitly excludes:** game rules, turn logic, win conditions, real card data/abilities, multiplayer/networking, accounts, audio, particle VFX, and touch/mobile input.
- Not chasing AAA/Unreal-tier visuals — placeholder cards are fine while we nail the motion.

## Success Criteria

Phase 1 is done when, in a browser, a player can:
1. See a deck of 10 3D cards stacked like a real deck on an angled 3D board.
2. Watch 5 cards auto-deal — each pops off the top of the deck and animates into a fanned hand (staggered).
3. Click the deck to draw remaining cards one at a time.
4. Hover a card in hand to see it lift.
5. Click-and-hold to drag a card around the screen; the 3 valid empty board spots show a **gold outline**.
6. Drop on a valid spot → the card snaps in and stays; drop anywhere invalid → it smoothly snaps back to its place in hand.
7. …and the whole thing *feels* fluid and premium (Master-Duel-like), verified by rendered review.

## User Preferences & Conventions

- **Delivery:** Browser-first. Desktop app is a later bookmark (wrap the web app; no rewrite).
- **Stack (Senior-recommended, browser-first):** Web-native 3D — **Three.js + React Three Fiber (+ drei)**, TypeScript.
- **Phasing:** Build in phases; each release must be stable. Don't over-build future phases' architecture, but don't paint us into a corner either.
- **Camera:** Angled 3D board (tilted, looking down at the playmat) — Master Duel-style depth.
- **Input:** Mouse/desktop only in Phase 1. Touch comes later.
- **Cards (Phase 1):** Clean procedural beveled placeholder cards — simple front/back texture + numbers. Focus 100% on feel.
- **Juice (Phase 1):** Motion only — hover-lift, easing, snap, gold valid-drop outline. **No audio, no particle VFX.**
- **Feel is the product.** Animation timing/easing/interruptibility matter more than geometry or content.
- **Workflow:** The user runs the agent harness — gates, Senior auto-engage, docs-with-code, user is the merge gate.
- **Phase-tagged documentation (STANDING RULE).** All documentation — spec, taskboard, `.client-docs/`, `CHANGELOG.md`, architecture-log — must clearly state **which phase** a feature was **added / changed / removed** in. We keep a concise, honest history so we can always tell when and why something entered or left the product.
- **The vision is mutable (STANDING RULE).** What's captured here reflects *current* intent, not a contract. Features are liable to change or be dropped across phases — agents must not treat vision items as immovable, and architecture must assume change.
- **Normalized, decoupled architecture (STANDING RULE).** The Senior Coder designs for change: clear module boundaries, separation of state / rendering / animation / input, no tangled coupling. Adding, changing, or removing a feature should be a localized edit, not a rewrite. Favor small, composable, single-responsibility modules.
- **Testing + regression testing are mandatory (STANDING RULE, reinforces Constraint #21).** Every change runs its own tests AND the coupled/regression suites green before it's done. Feel/UI is additionally verified by rendered review (Constraint #14).