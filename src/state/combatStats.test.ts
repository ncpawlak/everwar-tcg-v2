import { describe, it, expect } from 'vitest';
import { effectiveStats, linkedCSlot, heroArmor, heroMaxBars, heroBars, unarmedReduction } from './combatStats';
import { createInitialState } from './cardData';
import type { GameState, Card } from './types';

describe('combatStats', () => {
  it('linkedCSlot maps an A slot to its column C slot', () => {
    expect(linkedCSlot('A1')).toBe('C1');
    expect(linkedCSlot('A4')).toBe('C4');
  });

  it('effectiveStats returns base values with zero deltas when no C card is linked', () => {
    const base = createInitialState();
    const state: GameState = { ...base, board: { ...base.board, A1: 'card-hero-6' } };
    const card = state.cardsById['card-hero-6'];
    const eff = effectiveStats(state, 'A1');
    expect(eff.dmg).toEqual({ value: card.dmg, delta: 0 });
    expect(eff.acc).toEqual({ value: card.acc, delta: 0 });
    expect(eff.hp).toEqual({ value: card.hp, delta: 0 });
  });

  it('a linked C card adds its printed Equipment stats to the Hero', () => {
    const base = createInitialState();
    const equip = base.cardsById['card-equipment-1'];
    const state: GameState = { ...base, board: { ...base.board, A1: 'card-hero-6', C1: 'card-equipment-1' } };
    const eff = effectiveStats(state, 'A1');
    const e = equip.equipStats ?? {};
    expect([eff.hp.delta, eff.dmg.delta, eff.acc.delta]).toEqual([e.hp ?? 0, e.dmg ?? 0, e.acc ?? 0]);
  });

  it('Equipment armor / bars / Medic HP / Tankwalker reduction', () => {
    const base = createInitialState();
    const hero = { ...base.cardsById['card-hero-6'], armor: 10, armorBars: 1, subType: 'Medic' } as Card;
    const vest = { ...base.cardsById['card-equipment-1'], subType: 'Armor', equipStats: { hp: 40, medicHp: 40, armor: 20, armorBars: 1, unarmedReduction: 20 } } as Card;
    const state: GameState = {
      ...base,
      cardsById: { ...base.cardsById, [hero.id]: hero, [vest.id]: vest },
      board: { ...base.board, A1: hero.id, C1: vest.id },
    };
    expect(effectiveStats(state, 'A1').hp.delta).toBe(80);
    expect(heroArmor(state, 'player', 'A1')).toBe(30);
    expect(heroMaxBars(state, 'player', 'A1')).toBe(2);
    expect(heroBars(state, 'player', 'A1')).toBe(2);
    expect(heroBars({ ...state, currentArmorBars: { [hero.id]: 1 } }, 'player', 'A1')).toBe(1);
    // Attacker O1 has no Weapon -> reduced; non-Medic gets no medic bonus.
    expect(unarmedReduction(state, 'player', 'A1', 'O1')).toBe(20);
    const nonMedic = { ...state, cardsById: { ...state.cardsById, [hero.id]: { ...hero, subType: 'Assault' } as Card } };
    expect(effectiveStats(nonMedic, 'A1').hp.delta).toBe(40);
  });

  it('P8: an Echo Assist source on the board raises ACC of every Echo Hero, itself included', () => {
    const base = createInitialState();
    // card-hero-3 = Echo Reserve (carries Echo Assist, base acc 60);
    // card-hero-26 = Echo Demolitions (Echo, base acc 80, no ability of its own).
    const echoSource = base.cardsById['card-hero-3'];
    const echoAlly = base.cardsById['card-hero-26'];
    const state: GameState = { ...base, board: { ...base.board, A1: 'card-hero-3', A2: 'card-hero-26' } };
    // The aura source buffs itself...
    expect(effectiveStats(state, 'A1').acc).toEqual({ value: echoSource.acc! + 10, delta: 10 });
    // ...and its Echo ally.
    expect(effectiveStats(state, 'A2').acc).toEqual({ value: echoAlly.acc! + 10, delta: 10 });
    // Non-ACC stats untouched.
    expect(effectiveStats(state, 'A1').dmg.delta).toBe(0);
  });

  it('P8: Echo Assist ignores non-Echo Heroes and reverts when its source leaves the board', () => {
    const base = createInitialState();
    // card-hero-1 = Tundra Rifleman (not an Echo Hero).
    const scout = base.cardsById['card-hero-1'];
    const withAura: GameState = { ...base, board: { ...base.board, A1: 'card-hero-3', A2: 'card-hero-1' } };
    expect(effectiveStats(withAura, 'A2').acc).toEqual({ value: scout.acc!, delta: 0 });
    // Remove the Echo Assist source: the aura is board-derived, so it vanishes.
    const echoSelf = base.cardsById['card-hero-3'];
    const withoutSource: GameState = { ...withAura, board: { ...withAura.board, A1: null } };
    expect(effectiveStats(withoutSource, 'A2').acc.delta).toBe(0);
    // And re-adding a lone Echo source with no ally still self-buffs.
    const soloSource: GameState = { ...base, board: { ...base.board, A3: 'card-hero-3' } };
    expect(effectiveStats(soloSource, 'A3').acc).toEqual({ value: echoSelf.acc! + 10, delta: 10 });
  });
});
