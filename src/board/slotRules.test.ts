import { describe, it, expect } from 'vitest';
import {
  canDrop,
  emptySlots,
  isSlotEmpty,
  slotAcceptsType,
  validTargetSlots,
} from './slotRules';
import { createEmptyBoard } from '../state/cardData';
import type { GameState } from '../state/types';

const withCards = (occupied: Partial<GameState['board']>): GameState['board'] => ({
  ...createEmptyBoard(),
  ...occupied,
});

describe('P2-S03 slot rules', () => {
  it('isSlotEmpty reflects occupancy', () => {
    const b = withCards({ A1: 'card-A1' });
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
    expect(emptySlots(withCards({ A1: 'card-A1' }))).not.toContain('A1');
  });

  it('validTargetSlots are empty slots of the matching type', () => {
    const targets = validTargetSlots(withCards({ A1: 'card-A1' }), 'A');
    expect(targets).toEqual(['A2', 'A3', 'A4']);
    expect(validTargetSlots(createEmptyBoard(), 'B')).toEqual(['B1', 'B2', 'B3', 'B4']);
  });

  it('canDrop requires an empty slot whose type matches the card', () => {
    const b = withCards({ A1: 'card-A1' });
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
    const b = withCards({ A2: 'card-A2' });
    expect(canDrop(b, 'C2', 'C')).toBe(true);
    expect(canDrop(b, 'C1', 'C')).toBe(false);
    expect(validTargetSlots(b, 'C')).toEqual(['C2']);
  });
});
