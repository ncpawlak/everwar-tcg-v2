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

  it('parses an activated self-buff (Combat Focus) into an activated, once-per-turn IR', () => {
    const ir = parseAbility('Combat Focus: Once per turn, you can: this Hero gains +20 ACC.');
    expect(ir.name).toBe('Combat Focus');
    expect(ir.trigger).toBe('activated');
    expect(ir.oncePerTurn).toBe(true);
    expect(ir.effect).toEqual({ kind: 'selfStatBuff', stat: 'acc', amount: 20 });
  });

  it('parses a targeted cost ability (Quick Reload) into an activated targetStatBuff with cost', () => {
    const ir = parseAbility(
      'Quick Reload: Once per turn, you can send 1 card from your Hand to Replen: select another Infantry Hero you control to gain +20ACC.',
    );
    expect(ir.name).toBe('Quick Reload');
    expect(ir.trigger).toBe('activated');
    expect(ir.oncePerTurn).toBe(true);
    expect(ir.cost).toEqual({ kind: 'sendHandToReplen', count: 1 });
    expect(ir.effect).toEqual({
      kind: 'targetStatBuff',
      stat: 'acc',
      amount: 20,
      target: { side: 'ally', subType: 'Infantry', excludeSelf: true },
    });
  });

  it('parses a targeted ability with no sub-type restriction (any Hero you control)', () => {
    const ir = parseAbility(
      'Fire Support: Once per turn, you can send 1 card from your Hand to Replen: select another Hero you control to gain +10DMG.',
    );
    expect(ir.effect).toEqual({
      kind: 'targetStatBuff',
      stat: 'dmg',
      amount: 10,
      target: { side: 'ally', subType: undefined, excludeSelf: true },
    });
  });

  it('parses an on-sent pile trigger (Salvage Beacon) into an onSentToPile draw IR', () => {
    const ir = parseAbility('Salvage Beacon: When this Hero is sent to the Graveyard: draw 1 card.');
    expect(ir.name).toBe('Salvage Beacon');
    expect(ir.trigger).toBe('onSentToPile');
    expect(ir.pile).toBe('graveyard');
    expect(ir.effect).toEqual({ kind: 'draw', count: 1 });
  });

  it('parses an in-pile activated ability (Field Cache) into a pileActivated returnSelfToHand IR', () => {
    const ir = parseAbility('Field Cache: While this Hero is in your Replen pile, you can: return it to your Hand.');
    expect(ir.name).toBe('Field Cache');
    expect(ir.trigger).toBe('pileActivated');
    expect(ir.pile).toBe('replen');
    expect(ir.effect).toEqual({ kind: 'returnSelfToHand' });
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
