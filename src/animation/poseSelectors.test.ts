import { describe, it, expect } from 'vitest';
import { selectCardVisual } from './poseSelectors';
import { createInitialState } from '../state/cardData';
import type { GameState } from '../state/types';

describe('P1-S06/S12 card visual selection', () => {
  it('shows deck cards face down', () => {
    const s = createInitialState();
    const v = selectCardVisual(s, s.deck[0]);
    expect(v.zone).toBe('deck');
    expect(v.faceUp).toBe(false);
  });

  it('shows hand cards face up in the fan', () => {
    const s = createInitialState();
    const cardId = s.deck.at(-1)!;
    const inHand: GameState = { ...s, deck: s.deck.slice(0, -1), hand: [cardId] };
    const v = selectCardVisual(inHand, cardId);
    expect(v.zone).toBe('hand');
    expect(v.faceUp).toBe(true);
  });

  it('lifts the hovered hand card higher than its resting pose', () => {
    const s = createInitialState();
    const cardId = s.deck.at(-1)!;
    const inHand: GameState = { ...s, deck: s.deck.slice(0, -1), hand: [cardId] };
    const resting = selectCardVisual(inHand, cardId, null);
    const lifted = selectCardVisual(inHand, cardId, cardId);
    expect(lifted.pose.position[1]).toBeGreaterThan(resting.pose.position[1]);
  });

  it('follows the projected point while dragging', () => {
    const s = createInitialState();
    const cardId = s.deck.at(-1)!;
    const dragging: GameState = {
      ...s,
      deck: s.deck.slice(0, -1),
      hand: [cardId],
      dragging: { cardId, origin: 'hand', projectedPoint: [1.5, 0, 0.5], hoveredSlotId: null },
    };
    const v = selectCardVisual(dragging, cardId);
    expect(v.zone).toBe('dragging');
    expect(v.pose.position[0]).toBeCloseTo(1.5, 5);
    expect(v.pose.position[2]).toBeCloseTo(0.5, 5);
    expect(v.pose.position[1]).toBeGreaterThan(0); // lifted off the board
  });

  it('places a card resting in its board slot', () => {
    const s = createInitialState();
    const cardId = s.deck.at(-1)!;
    const placed: GameState = {
      ...s,
      deck: s.deck.slice(0, -1),
      board: { ...s.board, B1: cardId },
    };
    const v = selectCardVisual(placed, cardId);
    expect(v.zone).toBe('board');
    expect(v.faceUp).toBe(true);
    expect(v.scale).toBeLessThan(1); // shrinks on the board
  });
});
