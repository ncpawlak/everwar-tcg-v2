import { describe, it, expect } from 'vitest';
import { combatHitAbilities, hasCombatHitAbility, finisherEliminates } from './combat';
import type { Card } from '../state/types';

const BUNKER =
  'Bunker Busting Round: Once per turn, if this Hero lands a Successful Hit: you can break all Armor Bars on the target Hero. If you do, no damage is inflicted.';
const FINISHER =
  'Hidden Finisher: If this Hero lands a Successful Hit against a Normal Hero with less than half HP: eliminate that Hero instantly.';

function card(over: Partial<Card>): Card {
  return { id: 'x', type: 'A', name: 'T', cost: 1, hp: 100, dmg: 50, acc: 70, ...over } as unknown as Card;
}

describe('P8 combat-trigger helpers', () => {
  it('combatHitAbilities buckets both Snow Viper combat abilities by effect', () => {
    const a = combatHitAbilities(card({ abilities: [BUNKER, FINISHER] }));
    expect(a.breakAllArmorBars?.name).toBe('Bunker Busting Round');
    expect(a.instantEliminate?.name).toBe('Hidden Finisher');
  });

  it('combatHitAbilities ignores non-combat abilities and undefined cards', () => {
    const a = combatHitAbilities(card({ abilities: ['Combat Focus: Once per turn, you can: this Hero gains +20 ACC.'] }));
    expect(a.breakAllArmorBars).toBeUndefined();
    expect(a.instantEliminate).toBeUndefined();
    expect(combatHitAbilities(undefined)).toEqual({});
  });

  it('hasCombatHitAbility is true only when a combatHit ability is present', () => {
    expect(hasCombatHitAbility(card({ abilities: [FINISHER] }))).toBe(true);
    expect(hasCombatHitAbility(card({ abilities: [] }))).toBe(false);
  });

  it('finisherEliminates fires for a Normal Hero (level <= 2) under half HP', () => {
    const abilities = combatHitAbilities(card({ abilities: [FINISHER] }));
    const target = card({ level: 2, hp: 100 });
    expect(finisherEliminates(abilities, target, 40)).toBe(true); // 40 < 50
  });

  it('finisherEliminates does NOT fire at or above half HP', () => {
    const abilities = combatHitAbilities(card({ abilities: [FINISHER] }));
    const target = card({ level: 1, hp: 100 });
    expect(finisherEliminates(abilities, target, 50)).toBe(false); // exactly half
    expect(finisherEliminates(abilities, target, 80)).toBe(false);
  });

  it('finisherEliminates does NOT fire against a non-Normal Hero (level >= 3)', () => {
    const abilities = combatHitAbilities(card({ abilities: [FINISHER] }));
    const target = card({ level: 3, hp: 100 });
    expect(finisherEliminates(abilities, target, 10)).toBe(false);
  });

  it('finisherEliminates is false when the attacker lacks the ability', () => {
    const abilities = combatHitAbilities(card({ abilities: [BUNKER] }));
    const target = card({ level: 1, hp: 100 });
    expect(finisherEliminates(abilities, target, 10)).toBe(false);
  });
});
