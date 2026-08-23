import { describe, it, expect } from 'vitest';
import { boardCardAt, slotAtPoint } from './hitTest';
import { SLOT_POSITIONS } from '../board/boardConfig';
import { SLOT_IDS } from '../state/cardData';
import { createEmptyBoard } from '../state/cardData';

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

describe('P3-S02 board-card hit-testing', () => {
  it('returns the card occupying the slot under the point', () => {
    const board = createEmptyBoard();
    board.A1 = 'card-A1';
    expect(boardCardAt(SLOT_POSITIONS.A1, board)).toBe('card-A1');
  });

  it('returns null over an empty slot', () => {
    const board = createEmptyBoard();
    expect(boardCardAt(SLOT_POSITIONS.B2, board)).toBeNull();
  });

  it('returns null when the point is not over any slot', () => {
    const board = createEmptyBoard();
    board.A1 = 'card-A1';
    expect(boardCardAt([20, 0, 20], board)).toBeNull();
  });
});
