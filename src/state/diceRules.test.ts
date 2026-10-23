import { describe, it, expect } from 'vitest';
import { accThreshold, classifyRoll, resolveRoll, isSpecialHero, DAMAGE_MULTIPLIER } from './diceRules';

describe('diceRules', () => {
  it('accThreshold scales base-10 ACC onto the d20 (÷10)', () => {
    expect(accThreshold(70)).toBe(7);
    expect(accThreshold(130)).toBe(13);
    expect(accThreshold(200)).toBe(20);
    expect(accThreshold(10)).toBe(1);
  });

  it('classifies a Normal Hero with ACC 70 (hits on 7 or less) across the full d20', () => {
    const acc = 70;
    expect(classifyRoll(1, acc)).toBe('glancing');
    for (let r = 2; r <= 7; r++) expect(classifyRoll(r, acc)).toBe('normal');
    for (let r = 8; r <= 19; r++) expect(classifyRoll(r, acc)).toBe('miss');
    expect(classifyRoll(20, acc)).toBe('crit');
  });

  it('a natural 20 always crits, even when above ACC/10', () => {
    expect(classifyRoll(20, 30)).toBe('crit');
    expect(classifyRoll(19, 30)).toBe('miss');
  });

  it('a Special Hero crits on its exact ACC/10, at any ACC', () => {
    expect(classifyRoll(11, 110, true)).toBe('crit');
    expect(classifyRoll(10, 110, true)).toBe('normal');
    expect(classifyRoll(12, 110, true)).toBe('miss');
    expect(classifyRoll(9, 90, true)).toBe('crit');
    // A Normal Hero does not.
    expect(classifyRoll(11, 110)).toBe('normal');
    expect(classifyRoll(9, 90)).toBe('normal');
  });

  it('isSpecialHero is level 3+', () => {
    expect(isSpecialHero({ level: 2 })).toBe(false);
    expect(isSpecialHero({ level: 3 })).toBe(true);
    expect(isSpecialHero({ level: 4 })).toBe(true);
    expect(isSpecialHero(undefined)).toBe(false);
  });

  it('resolveRoll scales DMG by the outcome multiplier', () => {
    const dmg = 40;
    const acc = 70;
    expect(resolveRoll(1, dmg, acc)).toEqual({ roll: 1, outcome: 'glancing', damage: 20 });
    expect(resolveRoll(5, dmg, acc)).toEqual({ roll: 5, outcome: 'normal', damage: 40 });
    expect(resolveRoll(10, dmg, acc)).toEqual({ roll: 10, outcome: 'miss', damage: 0 });
    expect(resolveRoll(20, dmg, acc)).toEqual({ roll: 20, outcome: 'crit', damage: 80 });
    expect(resolveRoll(7, dmg, acc, true)).toEqual({ roll: 7, outcome: 'crit', damage: 80 });
  });

  it('exposes the expected damage multipliers', () => {
    expect(DAMAGE_MULTIPLIER).toEqual({ glancing: 0.5, normal: 1, miss: 0, crit: 2 });
  });
});
