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

  it('parses a self-buff with a discard cost and turn duration (Wasteland Deadeye)', () => {
    const ir = parseAbility(
      'Wasteland Deadeye: Once per turn, you can discard 1 card from your Hand: this Hero gains +30 ACC until the end of your turn.',
    );
    expect(ir.name).toBe('Wasteland Deadeye');
    expect(ir.trigger).toBe('activated');
    expect(ir.oncePerTurn).toBe(true);
    expect(ir.cost).toEqual({ kind: 'discardHand', count: 1 });
    expect(ir.duration).toBe('endOfTurn');
    expect(ir.effect).toEqual({ kind: 'selfStatBuff', stat: 'acc', amount: 30 });
  });

  it('parses a targeted cost ability (Quick Reload) into an activated targetStatBuff with cost', () => {
    const ir = parseAbility(
      'Quick Reload: Once per turn, you can send 1 card from your Hand to Replen: select another Infantry Hero you control; that Hero gains +20 ACC.',
    );
    expect(ir.trigger).toBe('activated');
    expect(ir.cost).toEqual({ kind: 'sendHandToReplen', count: 1 });
    expect(ir.effect).toEqual({
      kind: 'targetStatBuff',
      stat: 'acc',
      amount: 20,
      target: { side: 'ally', subType: 'Infantry', excludeSelf: true },
    });
  });

  it('parses heals with Replen, discard and no cost (Urgent Treatment / First Aid Kit / First Aid Patch)', () => {
    const urgent = parseAbility(
      'Urgent Treatment: Once per turn, you can send 1 card from your Replen to the GY: select 1 Hero you control; that Hero recovers 30 HP.',
    );
    expect(urgent.cost).toEqual({ kind: 'sendReplenToGraveyard', count: 1 });
    expect(urgent.effect).toEqual({ kind: 'healTarget', amount: 30, target: { side: 'ally' } });
    const kit = parseAbility(
      'First Aid Kit: Once per turn, you can discard 1 card: select 1 Hero you control; that Hero recovers 30 HP.',
    );
    expect(kit.cost).toEqual({ kind: 'discardHand', count: 1 });
    const patch = parseAbility('First Aid Patch: Once per turn, select 1 Hero you control; that Hero recovers 20 HP.');
    expect(patch.trigger).toBe('activated');
    expect(patch.cost).toBeUndefined();
    expect(patch.effect).toEqual({ kind: 'healTarget', amount: 20, target: { side: 'ally' } });
  });

  it('parses Graveyard recovery for Heroes and Equipment', () => {
    const jackal = parseAbility(
      'Jackal Reinforcement: Once per turn, you can discard 1 card from your Hand: select 1 Hero in your GY and send that Hero to Replen.',
    );
    expect(jackal.effect).toEqual({ kind: 'recoverFromGraveyard', cardType: 'A' });
    const retrieval = parseAbility(
      'Equipment Retrieval: Once per turn, you can select 1 Equipment card in your GY and send it to Replen.',
    );
    expect(retrieval.trigger).toBe('activated');
    expect(retrieval.cost).toBeUndefined();
    expect(retrieval.effect).toEqual({ kind: 'recoverFromGraveyard', cardType: 'C' });
  });

  it("parses opponent-next-turn effects (Iron Wall, Armored Aggro, Shell Up, Heavy Suppression)", () => {
    const iron = parseAbility(
      "Iron Wall: Once per turn, you can discard the top card of your Deck: enemy Heroes can only target this Hero for attacks, if able, during your opponent's next turn.",
    );
    expect(iron.cost).toEqual({ kind: 'discardDeckTop', count: 1 });
    expect(iron.effect).toEqual({ kind: 'forceTarget' });
    expect(iron.duration).toBe('opponentNextTurn');
    const aggro = parseAbility(
      "Armored Aggro: Once per turn, you can destroy 1 other Hero you control: enemy Heroes can only target this Hero for attacks, if able, during your opponent's next turn.",
    );
    expect(aggro.cost).toEqual({ kind: 'destroyOtherAlly' });
    const shell = parseAbility(
      "Shell Up: Once per turn, you can discard 1 card from your Hand: this Hero's Armor Bars cannot be reduced during your opponent's next turn.",
    );
    expect(shell.effect).toEqual({ kind: 'armorBarsLock' });
    const supp = parseAbility(
      "Heavy Suppression: Once per turn, select up to 2 enemy Heroes; those Heroes have -20 ACC during your opponent's next turn.",
    );
    expect(supp.effect).toEqual({ kind: 'enemyStatDebuff', stat: 'acc', amount: -20, maxTargets: 2 });
    expect(supp.duration).toBe('opponentNextTurn');
  });

  it('parses an enemy mark (Holo-Target)', () => {
    const ir = parseAbility(
      'Holo-Target: Once per turn, select 1 enemy Hero; Heroes you control gain +30 ACC when attacking that Hero.',
    );
    expect(ir.effect).toEqual({ kind: 'markEnemy', stat: 'acc', amount: 30 });
  });

  it('leaves triggered "Once per turn, when ..." lines to other rules', () => {
    const ir = parseAbility(
      "Make An Example: Once per turn, when this Hero inflicts damage on an enemy Hero, that Hero cannot attack during your opponent's next turn.",
    );
    expect(ir.trigger).toBe('unimplemented');
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
      'Bunker Busting Round: Once per turn, when this Hero lands a Successful Hit, you can break all Armor Bars on the target Hero; if you do, no damage is inflicted.',
    );
    expect(ir.name).toBe('Bunker Busting Round');
    expect(ir.trigger).toBe('combatHit');
    expect(ir.oncePerTurn).toBe(true);
    expect(ir.optional).toBe(true);
    expect(ir.effect).toEqual({ kind: 'breakAllArmorBars' });
  });

  it('parses Hidden Finisher into a mandatory combatHit instantEliminate IR', () => {
    const ir = parseAbility(
      'Hidden Finisher: When this Hero lands a Successful Hit against a Normal Hero with less than half HP, eliminate that Hero.',
    );
    expect(ir.name).toBe('Hidden Finisher');
    expect(ir.trigger).toBe('combatHit');
    expect(ir.oncePerTurn).toBeUndefined();
    expect(ir.optional).toBeUndefined();
    expect(ir.effect).toEqual({ kind: 'instantEliminate', gate: { targetNormal: true, targetBelowHalfHp: true } });
  });

  it('parses Headhunter (equipment, no name) into a crit + no-Armor-Bars instantEliminate', () => {
    const ir = parseAbility('When this Hero rolls a Critical Hit against a target with no Armor Bars, eliminate that Hero.');
    expect(ir.trigger).toBe('combatHit');
    expect(ir.effect).toEqual({ kind: 'instantEliminate', gate: { critOnly: true, targetNoArmorBars: true } });
  });

  it("parses Anvil's \"This Hero's Hits ignore Armor Bars.\" as a passive ignoreArmorBars", () => {
    const ir = parseAbility("This Hero's Hits ignore Armor Bars.");
    expect(ir.trigger).toBe('passive');
    expect(ir.effect).toEqual({ kind: 'ignoreArmorBars' });
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

describe('P8 parser: On-Set + used-as-material triggers (v3)', () => {
  const cases: [string, object][] = [
    ["Supply Disruption: When this Hero is Normal Set, randomly select 1 card from your opponent's Hand and send that card to Replen.",
      { trigger: 'onSet', setKinds: ['normal'], effect: { kind: 'opponentHandToReplen', count: 1 } }],
    ['Forward Intel: When this Hero is Normal Set, look at the top 3 cards of your Deck, then return them to the top of your Deck in any order.',
      { trigger: 'onSet', setKinds: ['normal'], effect: { kind: 'peekDeckTop', count: 3 } }],
    ["Field Disruption: When this Hero is Normal Set or Replen Set, you can select 1 Equipment on your opponent's field and send that Equipment to Replen.",
      { trigger: 'onSet', setKinds: ['normal', 'replen'], optional: true, effect: { kind: 'opponentEquipmentToReplen' } }],
    ['Extra Baggage: When this Hero is Replen Set, draw 1 card.',
      { trigger: 'onSet', setKinds: ['replen'], effect: { kind: 'draw', count: 1 } }],
    ['Stay Armed: When this Hero is Replen Set, if this Hero is unequipped, equip this Hero with the top Weapon card from your Deck, then Disturb your Deck.',
      { trigger: 'onSet', setKinds: ['replen'], effect: { kind: 'equipFromDeck', subType: 'Weapon', disturb: true } }],
    ["Domination: When this Hero is Commit Set, destroy Human Normal Heroes on your opponent's field, up to the number of materials used to Commit Set this Hero.",
      { trigger: 'onSet', setKinds: ['commit'], effect: { kind: 'destroyEnemyNormalHeroes', upToMaterials: true } }],
    ['Reclaim Ops: When this Hero is Commit Set, you can select 1 Ability Card in your GY and add that card to your Hand.',
      { trigger: 'onSet', setKinds: ['commit'], optional: true, effect: { kind: 'recoverFromGraveyard', cardType: 'B', to: 'hand' } }],
    ['Shadow Hack: When this Hero is used as material to Replen Set a "Jackal" Hero, you can send this Hero to the GY, then send the top card of your opponent\'s Deck to Replen.',
      { trigger: 'usedAsMaterial', setKinds: ['replen'], materialFor: { side: 'ally', family: 'Jackal' }, optional: true, selfToGraveyard: true,
        effect: { kind: 'opponentDeckTopToReplen', count: 1 } }],
  ];
  it.each(cases)('parses %s', (text, expected) => {
    expect(parseAbility(text)).toMatchObject(expected);
  });
});