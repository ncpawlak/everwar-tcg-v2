import { describe, it, expect } from 'vitest';
import { collectAuras, auraStatDelta, projectingAuraCardIds } from './auras';
import type { Card } from '../state/types';

const ECHO_ASSIST =
  'Echo Assist: All "Echo" Heroes you control gain +10ACC. Only 1 "Echo Assist" Ability can be active on your field at once.';
const ROAMING_ARMOR =
  'Roaming Armor: All "Bobcat" Heroes you control have +10 Armor. Only 1 "Roaming Armor" Ability can be active on your field at once.';

/** Minimal Hero card factory for aura tests. */
function hero(id: string, name: string, abilities: string[] = []): Card {
  return {
    id, type: 'A', name, cost: 1, rarity: 'Common', effect: '', flavor: '',
    hp: 100, dmg: 50, acc: 80, level: 1, abilities,
  } as Card;
}

describe('P8 aura runtime', () => {
  it('collects an active Echo Assist aura from an Echo Hero on the field', () => {
    const auras = collectAuras([hero('h1', 'Echo Reserve', [ECHO_ASSIST])]);
    expect(auras).toHaveLength(1);
    expect(auras[0]).toEqual({
      sourceId: 'h1',
      name: 'Echo Assist',
      effect: { kind: 'statAura', stat: 'acc', amount: 10, scope: { controller: 'self', family: 'Echo' } },
    });
  });

  it('caps "only 1 active" auras: two Echo Assist sources still count once', () => {
    const auras = collectAuras([
      hero('h1', 'Echo Reserve', [ECHO_ASSIST]),
      hero('h2', 'Echo Demolitions', [ECHO_ASSIST]),
    ]);
    expect(auras).toHaveLength(1);
  });

  it('applies +10 ACC to Heroes whose name contains the family, including the source', () => {
    const auras = collectAuras([hero('h1', 'Echo Reserve', [ECHO_ASSIST])]);
    expect(auraStatDelta(auras, hero('h1', 'Echo Reserve'), 'acc')).toBe(10);
    expect(auraStatDelta(auras, hero('h2', 'Echo Demolitions'), 'acc')).toBe(10);
  });

  it('does not touch Heroes outside the family or other stats', () => {
    const auras = collectAuras([hero('h1', 'Echo Reserve', [ECHO_ASSIST])]);
    expect(auraStatDelta(auras, hero('h9', 'Duneside Scout'), 'acc')).toBe(0);
    expect(auraStatDelta(auras, hero('h1', 'Echo Reserve'), 'dmg')).toBe(0);
  });

  it('models armor auras (Roaming Armor) in the runtime ahead of armor combat', () => {
    const auras = collectAuras([hero('b1', 'Bobcat Convoy Escort', [ROAMING_ARMOR])]);
    expect(auraStatDelta(auras, hero('b2', 'Bobcat Air Trooper'), 'armor')).toBe(10);
    expect(auraStatDelta(auras, hero('e1', 'Echo Reserve'), 'armor')).toBe(0);
  });

  it('ignores Heroes with no auras', () => {
    expect(collectAuras([hero('h1', 'Duneside Scout')])).toEqual([]);
  });

  it('projectingAuraCardIds returns only the winning source (one of two duplicate sources)', () => {
    const ids = projectingAuraCardIds([
      hero('h1', 'Echo Reserve', [ECHO_ASSIST]),
      hero('h2', 'Echo Demolitions', [ECHO_ASSIST]),
    ]);
    expect(ids.size).toBe(1);
    expect(ids.has('h1')).toBe(true);
    expect(ids.has('h2')).toBe(false);
  });
});
