import { describe, it, expect } from 'vitest';
import { exceededDragThreshold, DRAG_THRESHOLD_PX } from './pickMath';

describe('P3-S02 click vs drag classification', () => {
  it('treats a still press/release as a click (below threshold)', () => {
    expect(exceededDragThreshold(100, 100, 102, 101)).toBe(false);
  });

  it('treats movement past the threshold as a drag', () => {
    expect(exceededDragThreshold(100, 100, 100 + DRAG_THRESHOLD_PX + 1, 100)).toBe(true);
  });

  it('counts exactly the threshold distance as a drag', () => {
    expect(exceededDragThreshold(0, 0, DRAG_THRESHOLD_PX, 0)).toBe(true);
  });

  it('measures euclidean distance across both axes', () => {
    // 3-4-5 triangle: distance 5, below the default threshold of 6 => click
    expect(exceededDragThreshold(0, 0, 3, 4)).toBe(false);
    // distance ~7.07 => drag
    expect(exceededDragThreshold(0, 0, 5, 5)).toBe(true);
  });
});
