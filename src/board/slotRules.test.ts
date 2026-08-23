import { describe, it, expect } from 'vitest';
import { canDrop, emptySlots, isSlotEmpty } from './slotRules';
import type { GameState } from '../state/types';

const board = (
  a: GameState['board']['slotA'],
  b: GameState['board']['slotB'],
  c: GameState['board']['slotC'],
): GameState['board'] => ({ slotA: a, slotB: b, slotC: c });

describe('P1-S03 slot rules', () => {
  it('isSlotEmpty reflects occupancy', () => {
    const b = board(null, 'card-1', null);
    expect(isSlotEmpty(b, 'slotA')).toBe(true);
    expect(isSlotEmpty(b, 'slotB')).toBe(false);
  });

  it('emptySlots returns empty slots left-to-right', () => {
    expect(emptySlots(board(null, 'card-1', null))).toEqual(['slotA', 'slotC']);
    expect(emptySlots(board('card-1', 'card-2', 'card-3'))).toEqual([]);
    expect(emptySlots(board(null, null, null))).toEqual(['slotA', 'slotB', 'slotC']);
  });

  it('canDrop is true only for an empty slot', () => {
    const b = board(null, 'card-1', null);
    expect(canDrop(b, 'slotA')).toBe(true);
    expect(canDrop(b, 'slotB')).toBe(false);
    expect(canDrop(b, null)).toBe(false);
  });
});
