import { describe, it, expect } from 'vitest';
import { applyArmorToHit } from './armorCombat';

describe('applyArmorToHit — flat Armor (no bars)', () => {
  it('subtracts flat armor from a normal hit that reaches HP', () => {
    // 50 launched at 10 armor -> 40 to HP (the user's worked example).
    const r = applyArmorToHit({ bars: 0, armor: 10 }, 'normal', 50, 50);
    expect(r).toEqual({ bars: 0, hpDamage: 40, barsBroken: 0 });
  });

  it('floors HP damage at 0 when armor exceeds the hit', () => {
    const r = applyArmorToHit({ bars: 0, armor: 100 }, 'normal', 50, 50);
    expect(r.hpDamage).toBe(0);
  });

  it('applies flat armor to a glancing hit too', () => {
    const r = applyArmorToHit({ bars: 0, armor: 10 }, 'glancing', 25, 50);
    expect(r.hpDamage).toBe(15);
  });

  it('a crit against 0 bars deals the full (doubled) hit minus armor', () => {
    // base 50 -> crit raw 100, armor 10 -> 90.
    const r = applyArmorToHit({ bars: 0, armor: 10 }, 'crit', 100, 50);
    expect(r).toEqual({ bars: 0, hpDamage: 90, barsBroken: 0 });
  });
});

describe('applyArmorToHit — Armor Bars', () => {
  it('a normal hit breaks exactly one bar and deals no HP damage', () => {
    const r = applyArmorToHit({ bars: 2, armor: 10 }, 'normal', 50, 50);
    expect(r).toEqual({ bars: 1, hpDamage: 0, barsBroken: 1 });
  });

  it('a glancing hit also breaks one bar for no HP damage', () => {
    const r = applyArmorToHit({ bars: 1, armor: 0 }, 'glancing', 25, 50);
    expect(r).toEqual({ bars: 0, hpDamage: 0, barsBroken: 1 });
  });

  it('a crit against 2+ bars destroys two bars for no HP damage', () => {
    const r = applyArmorToHit({ bars: 3, armor: 10 }, 'crit', 100, 50);
    expect(r).toEqual({ bars: 1, hpDamage: 0, barsBroken: 2 });
  });

  it('a crit against exactly one bar breaks it AND leaks a regular hit', () => {
    // The user's worked example: crit 50->100, defender 1 bar + 10 armor,
    // damage that lands is the REGULAR hit 50 - 10 = 40.
    const r = applyArmorToHit({ bars: 1, armor: 10 }, 'crit', 100, 50);
    expect(r).toEqual({ bars: 0, hpDamage: 40, barsBroken: 1 });
  });

  it('the crit-through-one-bar leak also floors at 0', () => {
    const r = applyArmorToHit({ bars: 1, armor: 100 }, 'crit', 100, 50);
    expect(r.hpDamage).toBe(0);
    expect(r.barsBroken).toBe(1);
    expect(r.bars).toBe(0);
  });

  it('a miss changes nothing — no bar is spent', () => {
    const r = applyArmorToHit({ bars: 2, armor: 10 }, 'miss', 0, 50);
    expect(r).toEqual({ bars: 2, hpDamage: 0, barsBroken: 0 });
  });
});
