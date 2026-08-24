/**
 * Activated-ability runtime (Phase 8). Turns a Hero's parsed ability IR into the
 * per-ability view the UI needs: which lines are activated abilities, whether
 * each can be triggered right now (player's Main phase, on the player's board,
 * not already used this turn), and which are inert. Pure so the glow, the
 * ability popup, and the store action all read one source of truth.
 */

import type { Card } from '../state/types';
import { parseAbilities } from './parseAbility';
import type { AbilityIR } from './abilityIR';

/** Context the caller supplies about the current game moment. */
export interface ActivationContext {
  /** True when it is the player's turn AND the Main phase. */
  isPlayerMain: boolean;
  /** True when the card sits on the player's own A-board. */
  onPlayerBoard: boolean;
  /** Ability names this card has already used this turn (once-per-turn gate). */
  usedNames: readonly string[];
}

/** One ability line as the UI should present it. */
export interface ActivatedAbilityView {
  /** Index into the card's `abilities` array. */
  index: number;
  name: string;
  /** Full rules text. */
  text: string;
  ir: AbilityIR;
  /** This line is an activated (player-triggered) ability. */
  isActivated: boolean;
  /** A once-per-turn ability already spent this turn. */
  used: boolean;
  /** Can be clicked to trigger right now. */
  activatable: boolean;
}

/** Build the per-ability views for a card in the current context. */
export function activatedAbilityViews(card: Card, ctx: ActivationContext): ActivatedAbilityView[] {
  const irs = parseAbilities(card.abilities);
  return irs.map((ir, index) => {
    const isActivated = ir.trigger === 'activated';
    const used = ir.oncePerTurn === true && ctx.usedNames.includes(ir.name);
    const activatable = isActivated && ctx.isPlayerMain && ctx.onPlayerBoard && !used;
    return { index, name: ir.name, text: ir.raw, ir, isActivated, used, activatable };
  });
}

/** True when the card has at least one ability the player can trigger now
 *  (drives the on-card "activatable" glow). */
export function hasAvailableActivated(card: Card, ctx: ActivationContext): boolean {
  return activatedAbilityViews(card, ctx).some((v) => v.activatable);
}
