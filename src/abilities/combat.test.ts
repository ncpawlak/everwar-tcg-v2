import { describe, it, expect } from 'vitest';
import { combatHitAbilities, hasCombatHitAbility, finisherEliminates } from './combat';
import type { Card } from '../state/types';

const BUNKER =
  'Bunker Busting Round: Once per turn, when this Hero lands a Successful Hit, you can break all Armor Bars on the target Hero; if you do, no damage is inflicted.';
const FINISHER =
  'Hidden Finisher: When this Hero lands a Successful Hit against a Normal Hero with less than half HP, eliminate that Hero.';
const HEADHUNTER = 'When this Hero rolls a Critical Hit against a target with no Armor Bars, eliminate that Hero.';
const ANVIL = "This Hero's Hits ignore Armor Bars.";

function card(over: Partial<Card>): Card {
  return { id: 'x', type: 'A', name: 'T', cost: 1, hp: 100, dmg: 50, acc: 70, ...over } as unknown as Card;
}
const equip = (abilities: string[]) => card({ id: 'eq', type: 'C', abilities });

describe('P8 combat-trigger helpers (v3 wording)', () => {
  it('buckets both Snow Viper combat abilities by effect', () => {
    const a = combatHitAbilities(card({ abilities: [BUNKER, FINISHER] }));
    expect(a.breakAllArmorBars?.name).toBe('Bunker Busting Round');
    expect(a.breakAllArmorBars?.optional).toBe(true);
    expect(a.breakAllArmorBars?.oncePerTurn).toBe(true);
    expect(a.instantEliminate.map((i) => i.name)).toEqual(['Hidden Finisher']);
    expect(a.ignoreArmorBars).toBe(false);
  });

  it('ignores non-combat abilities and undefined cards', () => {
    const a = combatHitAbilities(card({ abilities: ['Combat Focus: Once per turn, you can: this Hero gains +20 ACC.'] }));
    expect(a.breakAllArmorBars).toBeUndefined();
    expect(a.instantEliminate).toEqual([]);
    expect(combatHitAbilities(undefined)).toEqual({ instantEliminate: [], ignoreArmorBars: false });
  });

  it('folds in the equipped Weapon (Headhunter, Anvil)', () => {
    const a = combatHitAbilities(card({ abilities: [] }), equip([HEADHUNTER]));
    expect(a.instantEliminate).toHaveLength(1);
    expect(combatHitAbilities(card({ abilities: [] }), equip([ANVIL])).ignoreArmorBars).toBe(true);
  });

  it('hasCombatHitAbility is true only when a combatHit ability is present', () => {
    expect(hasCombatHitAbility(card({ abilities: [FINISHER] }))).toBe(true);
    expect(hasCombatHitAbility(card({ abilities: [] }))).toBe(false);
    expect(hasCombatHitAbility(card({ abilities: [] }), equip([HEADHUNTER]))).toBe(true);
  });

  describe('Hidden Finisher gate', () => {
    const abilities = combatHitAbilities(card({ abilities: [FINISHER] }));
    const normal = card({ level: 2, hp: 100 });
    it('fires for a Normal Hero (level <= 2) under half HP', () => {
      expect(finisherEliminates(abilities, normal, { outcome: 'normal', currentHp: 40, bars: 2 })).toBe(true);
    });
    it('does NOT fire at or above half HP', () => {
      expect(finisherEliminates(abilities, normal, { outcome: 'normal', currentHp: 50, bars: 0 })).toBe(false);
      expect(finisherEliminates(abilities, normal, { outcome: 'crit', currentHp: 80, bars: 0 })).toBe(false);
    });
    it('does NOT fire against a non-Normal Hero (level >= 3) or on a miss', () => {
      expect(finisherEliminates(abilities, card({ level: 3, hp: 100 }), { outcome: 'normal', currentHp: 10, bars: 0 })).toBe(false);
      expect(finisherEliminates(abilities, normal, { outcome: 'miss', currentHp: 10, bars: 0 })).toBe(false);
    });
    it('is false when the attacker lacks the ability', () => {
      const none = combatHitAbilities(card({ abilities: [BUNKER] }));
      expect(finisherEliminates(none, normal, { outcome: 'normal', currentHp: 10, bars: 0 })).toBe(false);
    });
  });

  describe('Headhunter gate', () => {
    const abilities = combatHitAbilities(card({ abilities: [] }), equip([HEADHUNTER]));
    const target = card({ level: 5, hp: 300 });
    it('fires on a crit against a target with no Armor Bars, any level / HP', () => {
      expect(finisherEliminates(abilities, target, { outcome: 'crit', currentHp: 300, bars: 0 })).toBe(true);
    });
    it('does NOT fire on a non-crit or when the target has Armor Bars', () => {
      expect(finisherEliminates(abilities, target, { outcome: 'normal', currentHp: 300, bars: 0 })).toBe(false);
      expect(finisherEliminates(abilities, target, { outcome: 'crit', currentHp: 300, bars: 1 })).toBe(false);
    });
  });
});
