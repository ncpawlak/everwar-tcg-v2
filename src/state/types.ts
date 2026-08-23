/**
 * Phase 2 domain types. Pure data — no Three.js, no React.
 * Kept normalized and serializable so future phases (real card data, rules,
 * networking) can extend without reshaping the core.
 */

/** Card/slot type. Phase 2 introduces three typed families: A, B, C. */
export type CardType = 'A' | 'B' | 'C';

/** Slot column index within a type family (1-based, 4 per family). */
export type SlotIndex = 1 | 2 | 3 | 4;

export type CardId = string;

/**
 * Slot identifier: a type family + column index, e.g. `A1`..`A4`, `B1`..`B4`,
 * `C1`..`C4`. The leading letter IS the slot's accepted card type.
 */
export type SlotId = `${CardType}${SlotIndex}`;

/** The card type a slot accepts is encoded in its id's first character. */
export function slotType(slotId: SlotId): CardType {
  return slotId[0] as CardType;
}

/** Phase 2 placeholder card — a typed cream card. Real card data comes later. */
export interface Card {
  id: CardId;
  type: CardType;
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
