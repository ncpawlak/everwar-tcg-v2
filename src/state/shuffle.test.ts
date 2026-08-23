import { describe, it, expect } from 'vitest';
import { shuffleArray } from './shuffle';

describe('shuffleArray', () => {
  it('returns a permutation (same multiset) of the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffleArray(input);
    expect(out).toHaveLength(input.length);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it('does not mutate the input array', () => {
    const input = ['a', 'b', 'c'];
    const copy = [...input];
    shuffleArray(input);
    expect(input).toEqual(copy);
  });

  it('is deterministic for a fixed rng', () => {
    const seq = [0.1, 0.9, 0.4, 0.7, 0.2];
    let i = 0;
    const rand = () => seq[i++ % seq.length];
    const a = shuffleArray([1, 2, 3, 4, 5], rand);
    i = 0;
    const b = shuffleArray([1, 2, 3, 4, 5], rand);
    expect(a).toEqual(b);
  });
});
