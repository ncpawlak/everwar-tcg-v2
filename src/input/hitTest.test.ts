import { describe, it, expect } from 'vitest';
import { slotAtPoint } from './hitTest';
import { SLOT_POSITIONS } from '../board/boardConfig';
import { SLOT_IDS } from '../state/cardData';

describe('P2-S07 slot hit-testing', () => {
  it('returns each of the 12 slots at its center', () => {
    for (const slotId of SLOT_IDS) {
      expect(slotAtPoint(SLOT_POSITIONS[slotId])).toBe(slotId);
    }
  });

  it('returns null when the point is far from every slot', () => {
    expect(slotAtPoint([20, 0, 20])).toBeNull();
  });

  it('returns the nearest slot when between two slots', () => {
    const [ax, , az] = SLOT_POSITIONS.A1;
    const [cx] = SLOT_POSITIONS.C1;
    // slightly left of the A1↔C1 midpoint => nearer A1
    const point: [number, number, number] = [(ax + cx) / 2 - 0.05, 0, az];
    expect(slotAtPoint(point)).toBe('A1');
  });
});
