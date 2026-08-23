import { describe, it, expect } from 'vitest';
import { slotAtPoint } from './hitTest';
import { SLOT_POSITIONS } from '../board/boardConfig';

describe('P1-S07 slot hit-testing', () => {
  it('returns the slot when the point is on its center', () => {
    expect(slotAtPoint(SLOT_POSITIONS.slotA)).toBe('slotA');
    expect(slotAtPoint(SLOT_POSITIONS.slotB)).toBe('slotB');
    expect(slotAtPoint(SLOT_POSITIONS.slotC)).toBe('slotC');
  });

  it('returns null when the point is far from every slot', () => {
    expect(slotAtPoint([10, 0, 10])).toBeNull();
  });

  it('returns the nearest slot when between two slots', () => {
    const [ax, , az] = SLOT_POSITIONS.slotA;
    const [bx] = SLOT_POSITIONS.slotB;
    // slightly left of the midpoint => nearer slotA
    const point: [number, number, number] = [(ax + bx) / 2 - 0.1, 0, az];
    expect(slotAtPoint(point)).toBe('slotA');
  });
});
