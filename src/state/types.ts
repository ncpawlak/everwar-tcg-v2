/**
 * Phase 2 domain types. Pure data — no Three.js, no React.
 * Kept normalized and serializable so future phases (real card data, rules,
 * networking) can extend without reshaping the core.
 */

/** Card/slot type. Phase 2 introduces three typed families: A, B, C. */
export type CardType = 'A' | 'B' | 'C';

/** Card rarity tier, ordered common -> legendary. Drives the panel's accent. */
export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

/** The three combat stats a card carries and a C-card boost can target. */
export type StatKey = 'hp' | 'atk' | 'def';

/**
 * A stat modifier a C card applies to its linked A card. Rolled when the C card
 * is set (random stat + random amount). `amount` is signed: positive raises the
 * stat (shown green), negative lowers it (shown red).
 */
export interface StatBuff {
  stat: StatKey;
  amount: number;
}

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

/**
 * A card's full combat profile (Phase 3). Every card carries display + combat
 * data even though the rules that consume ATK/DEF/effect land in later slices.
 */
export interface Card {
  id: CardId;
  type: CardType;
  /** Display name shown on the card and in the inspection panel. */
  name: string;
  /** Deploy cost (flavor for now; a resource system comes later). */
  cost: number;
  /** Attack value. */
  atk: number;
  /** Defense value. */
  def: number;
  /** Max health. The floating A-zone stat bar reads current/max from here;
   * combat (a later slice) will track a separate current-HP value. */
  hp: number;
  rarity: Rarity;
  /** Rules text — what the card does. */
  effect: string;
  /** Non-mechanical flavor line. */
  flavor: string;
  /**
   * Random stat boost this card grants its linked A card. Only C cards carry
   * one, and only once set in a C slot (rolled at placement). Absent otherwise.
   */
  buff?: StatBuff;
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

/** A browsable pile whose cards can be listed in the search pop-up. */
export type PileSource = 'deck' | 'graveyard' | 'replen';

export interface DragState {
  cardId: CardId;
  origin: DragOrigin;
  /** Pointer projected onto the board drag plane. */
  projectedPoint: Vec3;
  hoveredSlotId: SlotId | null;
}

/**
 * Transient "summon reveal" state. When a card is successfully set into a slot
 * it first pops up large and centered over the field (with a ripple), then flies
 * down into its slot. Purely visual: the card is already placed on the board;
 * this only redirects its pose to the showcase for a brief window.
 */
export interface SummonState {
  cardId: CardId;
  slotId: SlotId;
}

export interface GameState {
  cardsById: Record<CardId, Card>;
  /** Ordered stack; the top of the deck is the LAST element. */
  deck: CardId[];
  /** Ordered left-to-right; drives the hand fan layout. */
  hand: CardId[];
  board: Record<SlotId, CardId | null>;
  /** Discard pile, in the order cards were sent (last = top of the stack). */
  graveyard: CardId[];
  /** Replenish pile (no mechanic yet); searchable like the deck/graveyard. */
  replen: CardId[];
  /** True while the deck is mid-shuffle (cards split into two piles then
   * collapse). Purely visual; drives the spread pose in the animation layer. */
  deckSpread: boolean;
  dragging: DragState | null;
  /** Hand card currently under the pointer (raised for selection), or null. */
  hoveredCardId: CardId | null;
  /** Card whose expanded detail view is open (hand or board), or null. */
  selectedCardId: CardId | null;
  /** Pile whose search pop-up is open (opened by a dev button or by clicking
   * the pile on the board), or null when no pop-up is showing. */
  pileSearch: PileSource | null;
  /** Card currently playing its summon-reveal (showcased over the field before
   * flying to its slot), or null. Purely visual and transient. */
  summon: SummonState | null;
}
