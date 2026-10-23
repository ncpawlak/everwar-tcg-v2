import { describe, it, expect } from 'vitest';
import type { Card } from '../state/types';
import {
  activatedAbilityViews,
  costPickZone,
  hasAvailableActivated,
  isEnforcedActivated,
  type ActivationContext,
} from './activated';
import { parseAbility } from './parseAbility';

const WASTELAND_DEADEYE =
  'Wasteland Deadeye: Once per turn, you can discard 1 card from your Hand: this Hero gains +30 ACC until the end of your turn.';
const ECHO_ASSIST =
  'Echo Assist: While this Hero is on your field, all "Echo" Heroes you control gain +10 ACC. Only 1 "Echo Assist" Ability can be active on your field at once.';
const QUICK_RELOAD =
  'Quick Reload: Once per turn, you can send 1 card from your Hand to Replen: select another Infantry Hero you control; that Hero gains +20 ACC.';
const URGENT_TREATMENT =
  'Urgent Treatment: Once per turn, you can send 1 card from your Replen to the GY: select 1 Hero you control; that Hero recovers 30 HP.';
const EQUIPMENT_RETRIEVAL =
  'Equipment Retrieval: Once per turn, you can select 1 Equipment card in your GY and send it to Replen.';
const SHELL_UP =
  "Shell Up: Once per turn, you can discard 1 card from your Hand: this Hero's Armor Bars cannot be reduced during your opponent's next turn.";

function card(id: string, type: 'A' | 'C', subType: string | undefined, abilities: string[] = []): Card {
  return { id, name: id, type, cost: 1, rarity: 'Common', effect: '', flavor: '', subType, abilities } as unknown as Card;
}
const hero = (abilities: string[]) => card('h1', 'A', 'Recon', abilities);

const READY: ActivationContext = { isPlayerMain: true, onPlayerBoard: true, usedNames: [], handCount: 1 };

describe('P8 activated-ability views', () => {
  it('marks an activated ability activatable during the player Main phase on-board', () => {
    const views = activatedAbilityViews(hero([WASTELAND_DEADEYE]), READY);
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ index: 0, name: 'Wasteland Deadeye', isActivated: true, activatable: true, used: false });
    expect(hasAvailableActivated(hero([WASTELAND_DEADEYE]), READY)).toBe(true);
  });

  it('is not activatable off the player board', () => {
    expect(hasAvailableActivated(hero([WASTELAND_DEADEYE]), { ...READY, onPlayerBoard: false })).toBe(false);
  });

  it('is not activatable outside the player Main phase', () => {
    expect(activatedAbilityViews(hero([WASTELAND_DEADEYE]), { ...READY, isPlayerMain: false })[0].activatable).toBe(false);
  });

  it('is locked when the Hand cannot pay the discard cost', () => {
    expect(activatedAbilityViews(hero([WASTELAND_DEADEYE]), { ...READY, handCount: 0 })[0].activatable).toBe(false);
  });

  it('a once-per-turn ability already used is spent, not activatable', () => {
    const view = activatedAbilityViews(hero([WASTELAND_DEADEYE]), { ...READY, usedNames: ['Wasteland Deadeye'] })[0];
    expect(view.used).toBe(true);
    expect(view.activatable).toBe(false);
  });

  it('passive auras are never activatable', () => {
    const view = activatedAbilityViews(hero([ECHO_ASSIST]), READY)[0];
    expect(view.isActivated).toBe(false);
    expect(view.activatable).toBe(false);
  });

  it('parsed-but-unenforced activated effects stay locked so no cost is wasted', () => {
    expect(isEnforcedActivated(parseAbility(SHELL_UP))).toBe(false);
    const view = activatedAbilityViews(hero([SHELL_UP]), READY)[0];
    expect(view.isActivated).toBe(true);
    expect(view.activatable).toBe(false);
  });
});

describe('P8 activated-ability targeting feasibility', () => {
  const source = card('src', 'A', 'Infantry', [QUICK_RELOAD]);
  const ally = card('ally', 'A', 'Infantry');
  const recon = card('recon', 'A', 'Recon');

  it('is activatable with a payable cost and a legal target', () => {
    expect(activatedAbilityViews(source, { ...READY, allyBoard: [source, ally] })[0].activatable).toBe(true);
  });

  it('is locked when the Hand cannot pay the cost', () => {
    expect(activatedAbilityViews(source, { ...READY, handCount: 0, allyBoard: [source, ally] })[0].activatable).toBe(false);
  });

  it('is locked when no legal target exists (only self / wrong sub-type)', () => {
    expect(activatedAbilityViews(source, { ...READY, allyBoard: [source, recon] })[0].activatable).toBe(false);
  });

  it('Replen-cost heals need a Replen card and any Hero you control (self included)', () => {
    const medic = card('medic', 'A', 'Medic', [URGENT_TREATMENT]);
    expect(costPickZone(parseAbility(URGENT_TREATMENT))).toBe('replen');
    expect(activatedAbilityViews(medic, { ...READY, replenCount: 0, allyBoard: [medic] })[0].activatable).toBe(false);
    expect(activatedAbilityViews(medic, { ...READY, replenCount: 1, allyBoard: [medic] })[0].activatable).toBe(true);
  });

  it('GY recovery needs a matching card type in the Graveyard', () => {
    const eng = card('eng', 'A', 'Engineer', [EQUIPMENT_RETRIEVAL]);
    const deadHero = card('dead', 'A', 'Infantry');
    const deadGun = card('gun', 'C', 'Weapon');
    expect(activatedAbilityViews(eng, { ...READY, graveyard: [deadHero] })[0].activatable).toBe(false);
    expect(activatedAbilityViews(eng, { ...READY, graveyard: [deadHero, deadGun] })[0].activatable).toBe(true);
  });
});
