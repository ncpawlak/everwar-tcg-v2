import { describe, it, expect } from 'vitest';

/**
 * P1-S01 smoke test: proves the Vitest harness runs and the toolchain is wired.
 * Real logic tests arrive with the state/rules stories (P1-S02+).
 */
describe('toolchain smoke test', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
