import { describe, it, expect } from 'vitest';
import { parseAbility, parseAbilities } from './parseAbility';

describe('P8 ability parser', () => {
  it('parses an ACC stat-gain aura (Echo Assist) into a passive statAura IR', () => {
    const ir = parseAbility(
      'Echo Assist: All "Echo" Heroes you control gain +10ACC. Only 1 "Echo Assist" Ability can be active on your field at once.',
    );
    expect(ir.name).toBe('Echo Assist');
    expect(ir.trigger).toBe('passive');
    expect(ir.effect).toEqual({
      kind: 'statAura',
      stat: 'acc',
      amount: 10,
      scope: { controller: 'self', family: 'Echo' },
    });
    expect(ir.constraints).toEqual([{ kind: 'maxActiveByName', name: 'Echo Assist', max: 1 }]);
  });

  it('parses an Armor aura (Roaming Armor) into an armor statAura IR', () => {
    const ir = parseAbility(
      'Roaming Armor: All "Bobcat" Heroes you control have +10 Armor. Only 1 "Roaming Armor" Ability can be active on your field at once.',
    );
    expect(ir.name).toBe('Roaming Armor');
    expect(ir.trigger).toBe('passive');
    expect(ir.effect).toEqual({
      kind: 'statAura',
      stat: 'armor',
      amount: 10,
      scope: { controller: 'self', family: 'Bobcat' },
    });
    expect(ir.constraints).toEqual([{ kind: 'maxActiveByName', name: 'Roaming Armor', max: 1 }]);
  });

  it('keeps the ability name but marks unrecognized text as unimplemented (inert, still displays)', () => {
    const ir = parseAbility(
      'Pink Mist: Once per turn, if this Hero inflicts damage with a Critical Hit: this Hero can attack again.',
    );
    expect(ir.name).toBe('Pink Mist');
    expect(ir.trigger).toBe('unimplemented');
    expect(ir.effect).toEqual({ kind: 'unimplemented' });
    expect(ir.raw).toContain('Pink Mist');
  });

  it('gives text with no name colon an empty name', () => {
    const ir = parseAbility('No special ability.');
    expect(ir.name).toBe('');
    expect(ir.effect.kind).toBe('unimplemented');
  });

  it('parseAbilities maps a list and tolerates undefined', () => {
    expect(parseAbilities(undefined)).toEqual([]);
    const irs = parseAbilities([
      'Echo Assist: All "Echo" Heroes you control gain +10ACC. Only 1 "Echo Assist" Ability can be active on your field at once.',
    ]);
    expect(irs).toHaveLength(1);
    expect(irs[0].effect.kind).toBe('statAura');
  });
});
