import { describe, it, expect } from 'vitest';
import { collectAuras, auraStatDelta, projectingAuraCardIds } from './auras';
import type { Card } from '../state/types';

const ECHO_ASSIST =
  'Echo Assist: While this Hero is on your field, all "Echo" Heroes you control gain +10 ACC. Only 1 "Echo Assist" Ability can be active on your field at once.';
const DEVIL_DOG_FOCUS_FIRE =
  'Devil Dog Focus Fire: While this Hero is on your field, all "Devil Dog" Heroes you control gain +10 Armor. Only 1 "Devil Dog Focus Fire" Ability can be active on your field at once.';
const SANDSTORM =
  'Sandstorm Inbound: While you control another "Devil Dog" Hero, enemy Heroes have -10 ACC. Only 1 "Sandstorm Inbound" Ability can be active on your field at once.';
const PROTO_SIGHTS = 'Proto-Sights: While you control a Dictate Engineer Hero, this Hero gains +20 ACC.';
const OPPRESSIVE_FIRE =
  'Oppressive Fire: While this Hero is equipped with a Suppressive or Assault Weapon, this Hero gains +10 DMG.';
const TARGET_ACQUIRED =
  'Target Acquired: While you control another Coalition Hero, this Hero gains +10 ACC; while that Hero is also "Echo", this Hero gains an additional +10 ACC.';
const MEDIC_HP = 'While equipped to a Medic Hero, this Hero gains an additional 40 HP.';

/** Minimal Hero card factory for aura tests. */
function hero(id: string, name: string, abilities: string[] = [], extra: Partial<Card> = {}): Card {
  return {
    id, type: 'A', name, cost: 1, rarity: 'Common', effect: '', flavor: '',
    hp: 100, dmg: 50, acc: 80, level: 1, abilities, ...extra,
  } as Card;
}

/** Minimal Equipment card factory. */
function equipment(id: string, name: string, subType: string, extra: Partial<Card> = {}): Card {
  return { id, type: 'C', name, cost: 1, rarity: 'Rare', effect: '', flavor: '', subType, ...extra } as Card;
}

describe('P8 aura runtime', () => {
  it('collects an active Echo Assist aura from an Echo Hero on the field', () => {
    const auras = collectAuras([hero('h1', 'Echo Reserve', [ECHO_ASSIST])]);
    expect(auras).toHaveLength(1);
    expect(auras[0]).toEqual({
      sourceId: 'h1',
      name: 'Echo Assist',
      effect: { kind: 'statAura', stat: 'acc', amount: 10, target: { side: 'ally', family: 'Echo' } },
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

  it('models armor auras (Devil Dog Focus Fire)', () => {
    const auras = collectAuras([hero('d1', 'Devil Dog Breacher', [DEVIL_DOG_FOCUS_FIRE])]);
    expect(auraStatDelta(auras, hero('d2', 'Devil Dog Gunner'), 'armor')).toBe(10);
    expect(auraStatDelta(auras, hero('e1', 'Echo Reserve'), 'armor')).toBe(0);
  });

  it('applies enemy debuffs only to the opposing side, and only while the condition holds', () => {
    const alone = collectAuras([hero('d1', 'Devil Dog Scout', [SANDSTORM])]);
    expect(alone).toEqual([]); // needs ANOTHER Devil Dog
    const auras = collectAuras([hero('d1', 'Devil Dog Scout', [SANDSTORM]), hero('d2', 'Devil Dog Gunner')]);
    const foe = hero('x1', 'Echo Reserve');
    expect(auraStatDelta(auras, foe, 'acc', 'enemy')).toBe(-10);
    expect(auraStatDelta(auras, foe, 'acc', 'ally')).toBe(0);
    expect(auraStatDelta(auras, hero('d2', 'Devil Dog Gunner'), 'acc', 'ally')).toBe(0);
  });

  it('applies a conditional self-buff only to its own card (Proto-Sights)', () => {
    const zero = hero('z1', 'Zero-Head', [PROTO_SIGHTS], { allegiance: 'Dictate', subType: 'Recon' });
    expect(auraStatDelta(collectAuras([zero]), zero, 'acc')).toBe(0);
    const eng = hero('e1', 'Drone Engineer', [], { allegiance: 'Dictate', subType: 'Engineer' });
    const auras = collectAuras([zero, eng]);
    expect(auraStatDelta(auras, zero, 'acc')).toBe(20);
    expect(auraStatDelta(auras, eng, 'acc')).toBe(0);
  });

  it('gates on the equipped Weapon class (Oppressive Fire)', () => {
    const h = hero('h1', 'Dictate Gunner', [OPPRESSIVE_FIRE]);
    const withGear = (gear: Card | undefined) =>
      auraStatDelta(collectAuras({ heroes: [h], equipmentOf: () => gear }), h, 'dmg');
    expect(withGear(undefined)).toBe(0);
    expect(withGear(equipment('w1', 'CCR', 'Weapon', { weaponClass: 'Assault' }))).toBe(10);
    expect(withGear(equipment('w2', 'LMG', 'Weapon', { weaponClass: 'Suppressive' }))).toBe(10);
    expect(withGear(equipment('w3', 'Sniper', 'Weapon', { weaponClass: 'Precision' }))).toBe(0);
  });

  it('stacks a rider on the main clause when both conditions hold (Target Acquired)', () => {
    const t = hero('t1', 'Arctic Spotter', [TARGET_ACQUIRED], { allegiance: 'Coalition' });
    const plain = hero('c1', 'Tundra Rifleman', [], { allegiance: 'Coalition' });
    const echo = hero('c2', 'Echo Reserve', [], { allegiance: 'Coalition' });
    expect(auraStatDelta(collectAuras([t]), t, 'acc')).toBe(0);
    expect(auraStatDelta(collectAuras([t, plain]), t, 'acc')).toBe(10);
    expect(auraStatDelta(collectAuras([t, echo]), t, 'acc')).toBe(20);
  });

  it('applies Equipment-hosted buffs to the bearer when it matches (Medic HP)', () => {
    const vest = equipment('v1', 'Medi-Gel Vest', 'Armor', { abilities: [MEDIC_HP] });
    const medic = hero('m1', 'Field Medic', [], { subType: 'Medic' });
    const grunt = hero('g1', 'Tundra Rifleman', [], { subType: 'Infantry' });
    const onMedic = collectAuras({ heroes: [medic], equipmentOf: () => vest });
    expect(auraStatDelta(onMedic, medic, 'hp')).toBe(40);
    const onGrunt = collectAuras({ heroes: [grunt], equipmentOf: () => vest });
    expect(auraStatDelta(onGrunt, grunt, 'hp')).toBe(0);
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
