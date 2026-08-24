import { describe, it, expect } from 'vitest';
import { boardCardAt, slotAtPoint, oppSlotAtPoint, oppCardAtPoint } from './hitTest';
import { OPP_FULL_SLOT_POSITIONS, OPP_SLOT_POSITIONS, SLOT_POSITIONS } from '../board/boardConfig';
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

describe('P7-S4b opponent attack-target hit-testing', () => {
  it('targets the Vanguard from its own A-zone (O-slot) center', () => {
    for (const slotId of ['O1', 'O2', 'O3', 'O4'] as const) {
      expect(oppSlotAtPoint(OPP_SLOT_POSITIONS[slotId])).toBe(slotId);
    }
  });

  it('also targets the Vanguard from its linked C-zone (mirrored C column)', () => {
    // A click over the opponent's linked C-zone resolves to that column's O-slot,
    // mirroring the player's own A/C link when attacking.
    expect(oppSlotAtPoint(OPP_FULL_SLOT_POSITIONS.C1)).toBe('O1');
    expect(oppSlotAtPoint(OPP_FULL_SLOT_POSITIONS.C2)).toBe('O2');
    expect(oppSlotAtPoint(OPP_FULL_SLOT_POSITIONS.C3)).toBe('O3');
    expect(oppSlotAtPoint(OPP_FULL_SLOT_POSITIONS.C4)).toBe('O4');
  });

  it('returns null far from any opponent column', () => {
    expect(oppSlotAtPoint([20, 0, 20])).toBeNull();
  });
});

describe('P7-S4b opponent card inspection hit-testing', () => {
  const boards = {
    opponentBoard: { O1: 'opp-A1', O2: null, O3: null, O4: null },
    opponentBBoard: { OB1: null, OB2: 'opp-B2', OB3: null, OB4: null },
    opponentCBoard: { OC1: 'opp-C1', OC2: null, OC3: null, OC4: null },
  } as const;

  it('inspects the specific opponent card under the pointer across A/B/C zones', () => {
    expect(oppCardAtPoint(OPP_FULL_SLOT_POSITIONS.A1, boards)).toBe('opp-A1');
    expect(oppCardAtPoint(OPP_FULL_SLOT_POSITIONS.C1, boards)).toBe('opp-C1');
    expect(oppCardAtPoint(OPP_FULL_SLOT_POSITIONS.B2, boards)).toBe('opp-B2');
  });

  it('returns null over an empty opponent zone or far away', () => {
    expect(oppCardAtPoint(OPP_FULL_SLOT_POSITIONS.A2, boards)).toBeNull();
    expect(oppCardAtPoint([20, 0, 20], boards)).toBeNull();
  });
});

describe('P3-S02 board-card hit-testing', () => {
  it('returns the card occupying the slot under the point', () => {
    const board = createEmptyBoard();
    board.A1 = 'card-hero-6';
    expect(boardCardAt(SLOT_POSITIONS.A1, board)).toBe('card-hero-6');
  });

  it('returns null over an empty slot', () => {
    const board = createEmptyBoard();
    expect(boardCardAt(SLOT_POSITIONS.B2, board)).toBeNull();
  });

  it('returns null when the point is not over any slot', () => {
    const board = createEmptyBoard();
    board.A1 = 'card-hero-6';
    expect(boardCardAt([20, 0, 20], board)).toBeNull();
  });
});
