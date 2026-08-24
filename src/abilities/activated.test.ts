import { describe, it, expect } from 'vitest';
import type { Card } from '../state/types';
import { activatedAbilityViews, hasAvailableActivated, type ActivationContext } from './activated';

const COMBAT_FOCUS = 'Combat Focus: Once per turn, you can: this Hero gains +20 ACC.';
const ECHO_ASSIST =
  'Echo Assist: All "Echo" Heroes you control gain +10ACC. Only 1 "Echo Assist" Ability can be active on your field at once.';

/** Minimal Hero card factory. */
function hero(abilities: string[]): Card {
  return {
    id: 'h1',
    name: 'Duneside Scout',
    type: 'A',
    cost: 1,
    rarity: 'Common',
    effect: '',
    flavor: '',
    abilities,
  } as unknown as Card;
}

const READY: ActivationContext = { isPlayerMain: true, onPlayerBoard: true, usedNames: [] };

describe('P8 activated-ability views', () => {
  it('marks an activated ability activatable during the player Main phase on-board', () => {
    const views = activatedAbilityViews(hero([COMBAT_FOCUS]), READY);
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ index: 0, name: 'Combat Focus', isActivated: true, activatable: true, used: false });
    expect(hasAvailableActivated(hero([COMBAT_FOCUS]), READY)).toBe(true);
  });

  it('is not activatable off the player board', () => {
    const ctx: ActivationContext = { ...READY, onPlayerBoard: false };
    expect(hasAvailableActivated(hero([COMBAT_FOCUS]), ctx)).toBe(false);
  });

  it('is not activatable outside the player Main phase', () => {
    const ctx: ActivationContext = { ...READY, isPlayerMain: false };
    expect(activatedAbilityViews(hero([COMBAT_FOCUS]), ctx)[0].activatable).toBe(false);
  });

  it('a once-per-turn ability already used is spent, not activatable', () => {
    const ctx: ActivationContext = { ...READY, usedNames: ['Combat Focus'] };
    const view = activatedAbilityViews(hero([COMBAT_FOCUS]), ctx)[0];
    expect(view.used).toBe(true);
    expect(view.activatable).toBe(false);
  });

  it('passive auras are never activatable', () => {
    const view = activatedAbilityViews(hero([ECHO_ASSIST]), READY)[0];
    expect(view.isActivated).toBe(false);
    expect(view.activatable).toBe(false);
    expect(hasAvailableActivated(hero([ECHO_ASSIST]), READY)).toBe(false);
  });
});
