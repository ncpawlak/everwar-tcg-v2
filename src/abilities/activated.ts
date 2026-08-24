/**
 * Activated-ability runtime (Phase 8). Turns a Hero's parsed ability IR into the
 * per-ability view the UI needs: which lines are activated abilities, whether
 * each can be triggered right now (player's Main phase, on the player's board,
 * not already used this turn), and which are inert. Pure so the glow, the
 * ability popup, and the store action all read one source of truth.
 */

import type { Card, CardId } from '../state/types';
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
  /** Cards in the player's hand — used to check payable costs. Defaults to 0. */
  handCount?: number;
  /** Hero cards currently on the player's own A-board — used to check whether a
   *  targeting ability has any legal target. Defaults to none. */
  allyBoard?: readonly Card[];
}

/** Legal targets for a targeting ability, given the player's board Heroes. Empty
 *  for non-targeting abilities. */
export function abilityValidTargets(
  ir: AbilityIR,
  allyBoard: readonly Card[],
  sourceId: CardId,
): Card[] {
  if (ir.effect.kind !== 'targetStatBuff') return [];
  const t = ir.effect.target;
  return allyBoard.filter((c) => {
    if (t.excludeSelf && c.id === sourceId) return false;
    if (t.subType && c.subType !== t.subType) return false;
    return true;
  });
}

/** True when the ability requires the player to pick a target. */
export function abilityNeedsTarget(ir: AbilityIR): boolean {
  return ir.effect.kind === 'targetStatBuff';
}

/** True when the ability's cost (if any) can currently be paid. */
function costPayable(ir: AbilityIR, handCount: number): boolean {
  if (!ir.cost) return true;
  if (ir.cost.kind === 'sendHandToReplen') return handCount >= ir.cost.count;
  return true;
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
  const handCount = ctx.handCount ?? 0;
  const allyBoard = ctx.allyBoard ?? [];
  return irs.map((ir, index) => {
    const isActivated = ir.trigger === 'activated';
    const used = ir.oncePerTurn === true && ctx.usedNames.includes(ir.name);
    // Feasible only if the cost is payable and, for targeting abilities, at
    // least one legal target exists.
    const feasible =
      costPayable(ir, handCount) &&
      (!abilityNeedsTarget(ir) || abilityValidTargets(ir, allyBoard, card.id).length > 0);
    const activatable = isActivated && ctx.isPlayerMain && ctx.onPlayerBoard && !used && feasible;
    return { index, name: ir.name, text: ir.raw, ir, isActivated, used, activatable };
  });
}

/** True when the card has at least one ability the player can trigger now
 *  (drives the on-card "activatable" glow). */
export function hasAvailableActivated(card: Card, ctx: ActivationContext): boolean {
  return activatedAbilityViews(card, ctx).some((v) => v.activatable);
}
