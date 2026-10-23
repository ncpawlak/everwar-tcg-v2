import { describe, it, expect } from 'vitest';
import { parseSpell, tutorPicks } from './spells';
import { ABILITY_LIBRARY, createInitialState } from '../state/cardData';

const text = (name: string) => ABILITY_LIBRARY.find((a) => a.name === name)!.text;

describe('parseSpell', () => {
  it('parses the hand-cost + deck-search family', () => {
    expect(parseSpell(text('Convoy Incoming'))).toEqual({
      cost: { to: 'graveyard', heroOnly: false },
      steps: [{ kind: 'tutor', count: 1, select: { cardType: 'A', family: 'Devil Dog' } }, { kind: 'disturb' }],
    });
    expect(parseSpell(text('Dictate Reinforcement'))?.steps[0]).toMatchObject({ select: { cardType: 'A', allegiance: 'Dictate' } });
    expect(parseSpell(text('Heavy Loadout Swap'))?.cost).toEqual({ to: 'replen', heroOnly: true });
    expect(parseSpell(text('Black Duffle Bag'))?.steps[0]).toEqual({ kind: 'tutor', count: 2, select: { cardType: 'C', subType: 'Weapon' } });
    expect(parseSpell(text('Radio The Troops'))?.steps[0]).toMatchObject({ select: { cardType: 'A', normal: true } });
    expect(parseSpell(text('The Armory'))).toEqual({ steps: [{ kind: 'draw', count: 2 }] });
  });

  it('parses reveal / last-turn-loss condition / equip-ally spells', () => {
    expect(parseSpell(text('Snowmobile Transport'))).toEqual({
      steps: [{ kind: 'reveal', count: 5, pick: { cardType: 'A', family: 'Echo' }, restTo: 'replen' }],
    });
    expect(parseSpell(text('Man Down!'))?.steps).toEqual([
      { kind: 'requireAllyLostLastTurn', select: { cardType: 'A', allegiance: 'Coalition' } },
      { kind: 'tutor', count: 1, select: { cardType: 'A', allegiance: 'Coalition', subType: 'Medic' } },
      { kind: 'disturb' },
    ]);
    expect(parseSpell(text('Big Weapon Drop'))?.steps).toEqual([
      {
        kind: 'equipAlly',
        ally: { cardType: 'A', subType: 'Heavy' },
        equip: { cardType: 'C', subType: 'Weapon', weaponClass: 'Suppressive' },
      },
      { kind: 'disturb' },
    ]);
  });

  it('returns null for wording it does not understand', () => {
    expect(parseSpell(text('Disarm'))).toBeNull();
    expect(parseSpell('Reveal the top 5 cards of your Deck.')).toBeNull();
    expect(parseSpell('')).toBeNull();
  });
});

describe('tutorPicks', () => {
  it('takes the topmost matching cards (deck end = top)', () => {
    const { cardsById, deck } = createInitialState();
    const weapons = deck.filter((id) => cardsById[id].type === 'C' && /Weapon/.test(cardsById[id].subType ?? ''));
    expect(weapons.length).toBeGreaterThan(1);
    const picks = tutorPicks(deck, cardsById, { cardType: 'C', subType: 'Weapon' }, 2);
    expect(picks).toEqual([weapons[weapons.length - 1], weapons[weapons.length - 2]]);
  });
});
