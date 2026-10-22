import { describe, it, expect } from 'vitest';
import { parseAbility, parseAbilities, parseSelector } from './parseAbility';

// Exact v3 catalog strings.
const ECHO_ASSIST =
  'Echo Assist: While this Hero is on your field, all "Echo" Heroes you control gain +10 ACC. Only 1 "Echo Assist" Ability can be active on your field at once.';
const DEVIL_DOG_FOCUS_FIRE =
  'Devil Dog Focus Fire: While this Hero is on your field, all "Devil Dog" Heroes you control gain +10 Armor. Only 1 "Devil Dog Focus Fire" Ability can be active on your field at once.';

describe('P8 ability parser', () => {
  it('parses an ACC stat-gain aura (Echo Assist) into a passive statAura IR', () => {
    const ir = parseAbility(ECHO_ASSIST);
    expect(ir.name).toBe('Echo Assist');
    expect(ir.trigger).toBe('passive');
    expect(ir.effect).toEqual({ kind: 'statAura', stat: 'acc', amount: 10, target: { side: 'ally', family: 'Echo' } });
    expect(ir.conditions).toBeUndefined();
    expect(ir.constraints).toEqual([{ kind: 'maxActiveByName', name: 'Echo Assist', max: 1 }]);
  });

  it('parses an Armor aura (Devil Dog Focus Fire) into an armor statAura IR', () => {
    const ir = parseAbility(DEVIL_DOG_FOCUS_FIRE);
    expect(ir.trigger).toBe('passive');
    expect(ir.effect).toEqual({ kind: 'statAura', stat: 'armor', amount: 10, target: { side: 'ally', family: 'Devil Dog' } });
    expect(ir.constraints).toEqual([{ kind: 'maxActiveByName', name: 'Devil Dog Focus Fire', max: 1 }]);
  });

  it('parses an uncapped aura (Zero Assault) with no constraints', () => {
    const ir = parseAbility('Zero Assault: While this Hero is on your field, all "Zero" Heroes you control gain +20 DMG.');
    expect(ir.effect).toEqual({ kind: 'statAura', stat: 'dmg', amount: 20, target: { side: 'ally', family: 'Zero' } });
    expect(ir.constraints).toEqual([]);
  });

  it('parses an unquoted faction + sub-type scope (Range Finder)', () => {
    const ir = parseAbility(
      'Range Finder: While this Hero is on your field, all Coalition Recon Heroes you control gain +10 ACC. Only 1 "Range Finder" Ability can be active on your field at once.',
    );
    expect(ir.effect).toMatchObject({ target: { side: 'ally', allegiance: 'Coalition', subType: 'Recon' } });
  });

  it('parses an enemy debuff gated on controlling another Hero (Sandstorm Inbound)', () => {
    const ir = parseAbility(
      'Sandstorm Inbound: While you control another "Devil Dog" Hero, enemy Heroes have -10 ACC. Only 1 "Sandstorm Inbound" Ability can be active on your field at once.',
    );
    expect(ir.effect).toEqual({ kind: 'statAura', stat: 'acc', amount: -10, target: { side: 'enemy' } });
    expect(ir.conditions).toEqual([
      { kind: 'controls', selector: { side: 'ally', excludeSelf: true, family: 'Devil Dog' } },
    ]);
  });

  it('parses a conditional self-buff (Proto-Sights)', () => {
    const ir = parseAbility('Proto-Sights: While you control a Dictate Engineer Hero, this Hero gains +20 ACC.');
    expect(ir.effect).toEqual({ kind: 'statAura', stat: 'acc', amount: 20, target: { side: 'ally', self: true } });
    expect(ir.conditions).toEqual([
      { kind: 'controls', selector: { side: 'ally', allegiance: 'Dictate', subType: 'Engineer' } },
    ]);
  });

  it('parses an equipment-class condition with "or" (Oppressive Fire)', () => {
    const ir = parseAbility(
      'Oppressive Fire: While this Hero is equipped with a Suppressive or Assault Weapon, this Hero gains +10 DMG.',
    );
    expect(ir.conditions).toEqual([{ kind: 'equipped', subType: 'Weapon', weaponClasses: ['Suppressive', 'Assault'] }]);
    expect(ir.effect).toMatchObject({ stat: 'dmg', amount: 10, target: { self: true } });
  });

  it('parses a "; while … also" rider that narrows the controls selector (Target Acquired)', () => {
    const ir = parseAbility(
      'Target Acquired: While you control another Coalition Hero, this Hero gains +10 ACC; while that Hero is also "Echo", this Hero gains an additional +10 ACC.',
    );
    expect(ir.riders).toEqual([
      {
        conditions: [
          { kind: 'controls', selector: { side: 'ally', excludeSelf: true, allegiance: 'Coalition', family: 'Echo' } },
        ],
        effect: { kind: 'statAura', stat: 'acc', amount: 10, target: { side: 'ally', self: true } },
      },
    ]);
  });

  it('parses a named-Loadout condition plus a named-card rider (Drone Ops)', () => {
    const ir = parseAbility(
      'Drone Ops: While this Hero is equipped with a "Drone" Loadout, this Hero gains +20 ACC; while you control "Drone Scout", this Hero gains an additional +20 ACC.',
    );
    expect(ir.conditions).toEqual([{ kind: 'equipped', subType: 'Loadout', family: 'Drone' }]);
    expect(ir.riders?.[0].conditions).toEqual([
      { kind: 'controls', selector: { side: 'ally', family: 'Drone Scout' } },
    ]);
  });

  it('parses an Equipment-hosted bearer buff (Medic HP)', () => {
    const ir = parseAbility('While equipped to a Medic Hero, this Hero gains an additional 40 HP.');
    expect(ir.trigger).toBe('passive');
    expect(ir.fromEquipment).toBe(true);
    expect(ir.conditions).toEqual([{ kind: 'equippedTo', selector: { side: 'ally', subType: 'Medic' } }]);
    expect(ir.effect).toMatchObject({ stat: 'hp', amount: 40 });
  });

  it('parses non-stat continuous effects (targeting + opponent restrictions)', () => {
    expect(
      parseAbility(
        'Ballistic Soak: While this Hero is on your field, other "Zero" Heroes you control cannot be targeted for attacks.',
      ).effect,
    ).toEqual({ kind: 'untargetable', target: { side: 'ally', excludeSelf: true, family: 'Zero' } });
    expect(
      parseAbility(
        'Polar Presence: While you control another "Echo" Hero, enemy Heroes can only target this Hero for attacks, if able.',
      ).effect,
    ).toEqual({ kind: 'forceTarget' });
    expect(
      parseAbility('Comm Jam: While this Hero is on your field, your opponent cannot activate Continuous Ability Cards.')
        .effect,
    ).toEqual({ kind: 'opponentRestriction', restriction: 'noContinuousAbilityCards' });
    expect(
      parseAbility(
        'Disconnected Comms: While this Hero is on your field, your opponent can only play 1 Ability Card per turn.',
      ).effect,
    ).toEqual({ kind: 'opponentRestriction', restriction: 'abilityCardsPerTurn', max: 1 });
  });

  it('leaves triggered "While …" lines unimplemented rather than mis-parsing them', () => {
    const ir = parseAbility(
      'Overpower: While this Hero is on your field, each time you activate an Ability Card, this Hero gains +30 ACC until the end of your turn.',
    );
    expect(ir.trigger).toBe('unimplemented');
  });

  it('parseSelector handles the v3 noun phrases', () => {
    expect(parseSelector('this Hero')).toEqual({ side: 'ally', self: true });
    expect(parseSelector('enemy Heroes')).toEqual({ side: 'enemy' });
    expect(parseSelector('another "Dictate" Infantry Hero')).toEqual({
      side: 'ally',
      excludeSelf: true,
      family: 'Dictate',
      subType: 'Infantry',
    });
    expect(parseSelector('"Daybreak Marksman"')).toEqual({ side: 'ally', family: 'Daybreak Marksman' });
    expect(parseSelector('the top card')).toBeNull();
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

  it('parses Bunker Busting Round into an optional, once-per-turn combatHit breakAllArmorBars IR', () => {
    const ir = parseAbility(
      'Bunker Busting Round: Once per turn, if this Hero lands a Successful Hit: you can break all Armor Bars on the target Hero. If you do, no damage is inflicted.',
    );
    expect(ir.name).toBe('Bunker Busting Round');
    expect(ir.trigger).toBe('combatHit');
    expect(ir.oncePerTurn).toBe(true);
    expect(ir.optional).toBe(true);
    expect(ir.effect).toEqual({ kind: 'breakAllArmorBars' });
  });

  it('parses Hidden Finisher into a mandatory combatHit instantEliminate IR', () => {
    const ir = parseAbility(
      'Hidden Finisher: If this Hero lands a Successful Hit against a Normal Hero with less than half HP: eliminate that Hero instantly.',
    );
    expect(ir.name).toBe('Hidden Finisher');
    expect(ir.trigger).toBe('combatHit');
    expect(ir.oncePerTurn).toBeUndefined();
    expect(ir.optional).toBeUndefined();
    expect(ir.effect).toEqual({ kind: 'instantEliminate' });
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
    const irs = parseAbilities([ECHO_ASSIST]);
    expect(irs).toHaveLength(1);
    expect(irs[0].effect.kind).toBe('statAura');
  });
});
