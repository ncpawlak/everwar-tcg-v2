import { describe, it, expect } from 'vitest';
import {
  accThreshold,
  classifyRoll,
  resolveRoll,
  DAMAGE_MULTIPLIER,
} from './diceRules';

describe('diceRules', () => {
  it('accThreshold scales base-10 ACC onto the d20 (÷10)', () => {
    expect(accThreshold(70)).toBe(7);
    expect(accThreshold(130)).toBe(13);
    expect(accThreshold(200)).toBe(20);
    expect(accThreshold(10)).toBe(1);
  });

  it('classifies a mid ACC card (70, t=7) across the full d20', () => {
    const acc = 70;
    // 1-2 always graze for half, even below the normal band.
    expect(classifyRoll(1, acc)).toBe('glancing');
    expect(classifyRoll(2, acc)).toBe('glancing');
    // 3..t normal.
    expect(classifyRoll(3, acc)).toBe('normal');
    expect(classifyRoll(7, acc)).toBe('normal');
    // t+1..18 miss.
    expect(classifyRoll(8, acc)).toBe('miss');
    expect(classifyRoll(18, acc)).toBe('miss');
    // 19-20 crit.
    expect(classifyRoll(19, acc)).toBe('crit');
    expect(classifyRoll(20, acc)).toBe('crit');
  });

  it('gives a high-ACC card (>100) a bonus crit on its exact ACC value', () => {
    const acc = 130; // t = 13, acc > 100
    expect(classifyRoll(12, acc)).toBe('normal');
    expect(classifyRoll(13, acc)).toBe('crit'); // rolling your ACC value crits
    expect(classifyRoll(14, acc)).toBe('miss');
  });

  it('does NOT bonus-crit on the ACC value when ACC is 100 or less', () => {
    const acc = 70; // t = 7, not > 100
    expect(classifyRoll(7, acc)).toBe('normal');
  });

  it('max ACC (200, t=20) never misses', () => {
    const acc = 200;
    expect(classifyRoll(3, acc)).toBe('normal');
    expect(classifyRoll(18, acc)).toBe('normal');
    expect(classifyRoll(19, acc)).toBe('crit');
    // No face in 3..18 is a miss.
    for (let r = 3; r <= 18; r++) expect(classifyRoll(r, acc)).not.toBe('miss');
  });

  it('very low ACC (20, t=2) whiffs everything but a graze or a high crit', () => {
    const acc = 20;
    expect(classifyRoll(1, acc)).toBe('glancing');
    expect(classifyRoll(2, acc)).toBe('glancing');
    for (let r = 3; r <= 18; r++) expect(classifyRoll(r, acc)).toBe('miss');
    expect(classifyRoll(19, acc)).toBe('crit');
  });

  it('resolveRoll scales DMG by the outcome multiplier', () => {
    const dmg = 40;
    const acc = 70;
    expect(resolveRoll(1, dmg, acc)).toEqual({ roll: 1, outcome: 'glancing', damage: 20 });
    expect(resolveRoll(5, dmg, acc)).toEqual({ roll: 5, outcome: 'normal', damage: 40 });
    expect(resolveRoll(10, dmg, acc)).toEqual({ roll: 10, outcome: 'miss', damage: 0 });
    expect(resolveRoll(20, dmg, acc)).toEqual({ roll: 20, outcome: 'crit', damage: 80 });
  });

  it('exposes the expected damage multipliers', () => {
    expect(DAMAGE_MULTIPLIER).toEqual({ glancing: 0.5, normal: 1, miss: 0, crit: 2 });
  });
});
