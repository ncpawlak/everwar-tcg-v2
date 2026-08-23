/**
 * Phase 1 domain types. Pure data — no Three.js, no React.
 * Kept normalized and serializable so future phases (real card data, rules,
 * networking) can extend without reshaping the core.
 */

export type CardNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type CardId = string;

export type SlotId = 'slotA' | 'slotB' | 'slotC';

/** Phase 1 placeholder card. Later phases extend this with real card data. */
export interface Card {
  id: CardId;
  number: CardNumber;
}

/** Plain 3-tuple position/rotation, decoupled from THREE.Vector3. */
export type Vec3 = [number, number, number];

/** A visual target pose derived from state by the layout/pose math. */
export interface Pose {
  position: Vec3;
  /** Euler rotation in radians. */
  rotation: Vec3;
}

export type DragOrigin = 'hand';

export interface DragState {
  cardId: CardId;
  origin: DragOrigin;
  /** Pointer projected onto the board drag plane. */
  projectedPoint: Vec3;
  hoveredSlotId: SlotId | null;
}

export interface GameState {
  cardsById: Record<CardId, Card>;
  /** Ordered stack; the top of the deck is the LAST element. */
  deck: CardId[];
  /** Ordered left-to-right; drives the hand fan layout. */
  hand: CardId[];
  board: Record<SlotId, CardId | null>;
  dragging: DragState | null;
  /** Hand card currently under the pointer (raised for selection), or null. */
  hoveredCardId: CardId | null;
}
