import { describe, it, expect } from 'vitest';
import {
  canDrop,
  canDropCard,
  canAffordTribute,
  emptySlots,
  hasSubsetSum,
  isSlotEmpty,
  requiresTribute,
  resolveAttackerSlot,
  resolveLinkedTarget,
  slotAcceptsType,
  slotHighlighted,
  slotHighlightedForCard,
  validTargetSlots,
} from './slotRules';
import { createEmptyBoard, createInitialState } from '../state/cardData';
import type { GameState } from '../state/types';

const withCards = (occupied: Partial<GameState['board']>): GameState['board'] => ({
  ...createEmptyBoard(),
  ...occupied,
});

describe('P2-S03 slot rules', () => {
  it('isSlotEmpty reflects occupancy', () => {
    const b = withCards({ A1: 'card-hero-6' });
    expect(isSlotEmpty(b, 'A1')).toBe(false);
    expect(isSlotEmpty(b, 'A2')).toBe(true);
  });

  it('slotAcceptsType matches on the slot type letter only', () => {
    expect(slotAcceptsType('A1', 'A')).toBe(true);
    expect(slotAcceptsType('A1', 'B')).toBe(false);
    expect(slotAcceptsType('C4', 'C')).toBe(true);
  });

  it('emptySlots returns all unoccupied slots', () => {
    expect(emptySlots(createEmptyBoard())).toHaveLength(12);
    expect(emptySlots(withCards({ A1: 'card-hero-6' }))).not.toContain('A1');
  });

  it('validTargetSlots are empty slots of the matching type', () => {
    const targets = validTargetSlots(withCards({ A1: 'card-hero-6' }), 'A');
    expect(targets).toEqual(['A2', 'A3', 'A4']);
    expect(validTargetSlots(createEmptyBoard(), 'B')).toEqual(['B1', 'B2', 'B3', 'B4']);
  });

  it('canDrop requires an empty slot whose type matches the card', () => {
    const b = withCards({ A1: 'card-hero-6' });
    expect(canDrop(b, 'A2', 'A')).toBe(true); // empty + matching
    expect(canDrop(b, 'A1', 'A')).toBe(false); // occupied
    expect(canDrop(b, 'B1', 'A')).toBe(false); // wrong type
    expect(canDrop(b, 'C1', 'A')).toBe(false); // wrong type
    expect(canDrop(b, null, 'A')).toBe(false);
  });

  it('a C card can only set when its linked A slot is occupied', () => {
    // Empty board: no A cards, so no C slot is placeable.
    expect(canDrop(createEmptyBoard(), 'C1', 'C')).toBe(false);
    // A2 occupied -> only C2 becomes a legal C target.
    const b = withCards({ A2: 'card-hero-7' });
    expect(canDrop(b, 'C2', 'C')).toBe(true);
    expect(canDrop(b, 'C1', 'C')).toBe(false);
    expect(validTargetSlots(b, 'C')).toEqual(['C2']);
  });

  it('resolveLinkedTarget maps either linked zone to the card own-type slot', () => {
    const empty = createEmptyBoard();
    // Dragging an A card: hovering A2 or its linked C2 both target A2.
    expect(resolveLinkedTarget(empty, 'A2', 'A')).toBe('A2');
    expect(resolveLinkedTarget(empty, 'C2', 'A')).toBe('A2');
    // Dragging a C card needs the linked A occupied.
    expect(resolveLinkedTarget(empty, 'A2', 'C')).toBe(null); // A2 empty -> illegal
    const withA2 = withCards({ A2: 'card-hero-7' });
    expect(resolveLinkedTarget(withA2, 'A2', 'C')).toBe('C2'); // hover occupied A -> C2
    expect(resolveLinkedTarget(withA2, 'C2', 'C')).toBe('C2');
    // An occupied A column is not a valid target for another A card.
    expect(resolveLinkedTarget(withA2, 'C2', 'A')).toBe(null);
    // B cards fall back to direct placement, no linking.
    expect(resolveLinkedTarget(empty, 'B1', 'B')).toBe('B1');
    expect(resolveLinkedTarget(empty, null, 'A')).toBe(null);
  });

  it('slotHighlighted lights the whole linked column for A/C drags', () => {    const withA2 = withCards({ A2: 'card-hero-7' });
    // Dragging a C card with A2 set: both A2 and C2 highlight.
    expect(slotHighlighted(withA2, 'A2', 'C')).toBe(true);
    expect(slotHighlighted(withA2, 'C2', 'C')).toBe(true);
    // Column 1 has no A card, so its C zone can't take a C card.
    expect(slotHighlighted(withA2, 'C1', 'C')).toBe(false);
    // Dragging an A card: an empty column's A and C zones both highlight.
    const empty = createEmptyBoard();
    expect(slotHighlighted(empty, 'A1', 'A')).toBe(true);
    expect(slotHighlighted(empty, 'C1', 'A')).toBe(true);
    // B highlights only its own placeable slot.
    expect(slotHighlighted(empty, 'B1', 'B')).toBe(true);
    expect(slotHighlighted(empty, 'A1', 'B')).toBe(false);
  });

  it('resolveAttackerSlot picks the column A card from either linked zone', () => {
    const withA2 = withCards({ A2: 'card-hero-7' });
    // Clicking the occupied A zone or its linked C zone both select A2.
    expect(resolveAttackerSlot(withA2, 'A2')).toBe('A2');
    expect(resolveAttackerSlot(withA2, 'C2')).toBe('A2');
    // A column with no A card cannot attack from either zone.
    expect(resolveAttackerSlot(withA2, 'A1')).toBe(null);
    expect(resolveAttackerSlot(withA2, 'C1')).toBe(null);
    // B zones and null never resolve to an attacker.
    expect(resolveAttackerSlot(withA2, 'B1')).toBe(null);
    expect(resolveAttackerSlot(withA2, null)).toBe(null);
  });
});

describe('tribute-summon rules (level-3 A cards)', () => {
  const cardsById = createInitialState().cardsById; // card-hero-1=Lv1, card-hero-17=Lv2, card-hero-40=Lv3

  it('hasSubsetSum finds exact-sum subsets only', () => {
    expect(hasSubsetSum([1, 2], 3)).toBe(true);
    expect(hasSubsetSum([1, 1, 1], 3)).toBe(true);
    expect(hasSubsetSum([2, 2], 3)).toBe(false);
    expect(hasSubsetSum([2], 3)).toBe(false);
    expect(hasSubsetSum([], 3)).toBe(false);
  });

  it('requiresTribute is true only for level-3+ A cards', () => {
    expect(requiresTribute(cardsById['card-hero-40'])).toBe(true); // Lv3
    expect(requiresTribute(cardsById['card-hero-1'])).toBe(false); // Lv1
    expect(requiresTribute(cardsById['card-hero-17'])).toBe(false); // Lv2
  });

  it('canAffordTribute needs board A-levels summing exactly to the card level', () => {
    const a4 = cardsById['card-hero-40']; // needs 3
    expect(canAffordTribute(withCards({ A1: 'card-hero-1', A2: 'card-hero-17' }), cardsById, a4)).toBe(true); // 1+2
    expect(canAffordTribute(withCards({ A1: 'card-hero-17' }), cardsById, a4)).toBe(false); // 2
    expect(canAffordTribute(withCards({ A1: 'card-hero-17', A2: 'card-hero-21' }), cardsById, a4)).toBe(false); // 2+2
    expect(canAffordTribute(createEmptyBoard(), cardsById, a4)).toBe(false);
  });

  it('slotHighlightedForCard / canDropCard gate a level-3 card on affordable tribute', () => {
    const a4 = cardsById['card-hero-40'];
    const noMats = createEmptyBoard();
    expect(slotHighlightedForCard(noMats, cardsById, 'A2', a4)).toBe(false);
    expect(canDropCard(noMats, cardsById, 'A2', a4)).toBe(false);

    const withMats = withCards({ A1: 'card-hero-1', A2: 'card-hero-17' }); // 1+2 = 3
    expect(slotHighlightedForCard(withMats, cardsById, 'A3', a4)).toBe(true); // empty A slot lights
    expect(canDropCard(withMats, cardsById, 'A3', a4)).toBe(true);
    // A tribute card can be dropped onto ANY A/C column (even an occupied one) —
    // materials free a slot and the target is chosen afterward.
    expect(slotHighlightedForCard(withMats, cardsById, 'A1', a4)).toBe(true);
    expect(canDropCard(withMats, cardsById, 'A1', a4)).toBe(true);
    // B zones are never a tribute drop target.
    expect(canDropCard(withMats, cardsById, 'B1', a4)).toBe(false);
  });
});
