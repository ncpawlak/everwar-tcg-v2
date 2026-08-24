import { describe, expect, it, vi } from 'vitest';
import {
  ABILITY_REGISTRY,
  abilityById,
  abilityLabel,
  runEffect,
  type EffectContext,
} from './abilities';

const makeCtx = () => {
  const ctx = {
    draw: vi.fn(),
    shuffleZoneIntoDeck: vi.fn(),
  } satisfies EffectContext;
  return ctx;
};

describe('ability registry', () => {
  it('exposes the four migrated B-card on-set abilities', () => {
    expect(Object.keys(ABILITY_REGISTRY).sort()).toEqual(
      ['draw1', 'draw2', 'graveyardIntoDeck', 'replenIntoDeck'].sort(),
    );
    for (const ability of Object.values(ABILITY_REGISTRY)) {
      expect(ability.timing).toBe('on-set');
      expect(ability.activation).toBe('auto');
    }
  });

  it('abilityById / abilityLabel resolve known ids and tolerate absent ones', () => {
    expect(abilityById('draw1')?.name).toBe('Draw 1 card');
    expect(abilityById(undefined)).toBeUndefined();
    expect(abilityById('nope')).toBeUndefined();
    expect(abilityLabel('draw2')).toBe('Draw 2 cards');
    expect(abilityLabel(undefined)).toBe('');
    expect(abilityLabel('nope')).toBe('');
  });
});

describe('runEffect dispatcher', () => {
  it('draw effect calls draw with its count', () => {
    const ctx = makeCtx();
    runEffect({ kind: 'draw', count: 2 }, ctx);
    expect(ctx.draw).toHaveBeenCalledWith(2);
    expect(ctx.shuffleZoneIntoDeck).not.toHaveBeenCalled();
  });

  it('shuffleZoneIntoDeck effect passes the zone through', () => {
    const ctx = makeCtx();
    runEffect({ kind: 'shuffleZoneIntoDeck', zone: 'graveyard' }, ctx);
    expect(ctx.shuffleZoneIntoDeck).toHaveBeenCalledWith('graveyard');
    runEffect({ kind: 'shuffleZoneIntoDeck', zone: 'replen' }, ctx);
    expect(ctx.shuffleZoneIntoDeck).toHaveBeenCalledWith('replen');
  });

  it('runs each registered ability effect through the dispatcher', () => {
    const ctx = makeCtx();
    runEffect(ABILITY_REGISTRY.draw1.effect, ctx);
    runEffect(ABILITY_REGISTRY.replenIntoDeck.effect, ctx);
    expect(ctx.draw).toHaveBeenCalledWith(1);
    expect(ctx.shuffleZoneIntoDeck).toHaveBeenCalledWith('replen');
  });
});
