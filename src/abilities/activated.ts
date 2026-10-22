/**
 * Activated-ability runtime (Phase 8). Turns a Hero's parsed ability IR into the
 * per-ability view the UI needs: which lines are activated abilities, whether
 * each can be triggered right now (player's Main phase, on the player's board,
 * not already used this turn, cost payable, a legal target exists), and which
 * are inert. Pure so the glow, the ability popup, the selection modal and the
 * store action all read one source of truth.
 */

import type { Card, CardId, GameState, SlotId } from '../state/types';
import { parseAbilities } from './parseAbility';
import type { AbilityIR } from './abilityIR';
import { matchesSelector } from './auras';

/** Snapshot of the zones an activated ability can draw costs / targets from. */
export interface AbilityZones {
  /** Number of cards in the player's Hand. */
  handCount: number;
  /** Number of cards in the player's Replen pile. */
  replenCount: number;
  /** Number of cards in the player's Deck. */
  deckCount: number;
  /** Heroes on the player's own A-board. */
  allyBoard: readonly Card[];
  /** Cards in the player's Graveyard. */
  graveyard: readonly Card[];
}

/** Context the caller supplies about the current game moment. */
export interface ActivationContext extends Partial<AbilityZones> {
  /** True when it is the player's turn AND the Main phase. */
  isPlayerMain: boolean;
  /** True when the card sits on the player's own A-board. */
  onPlayerBoard: boolean;
  /** Ability names this card has already used this turn (once-per-turn gate). */
  usedNames: readonly string[];
}

const A_SLOTS: SlotId[] = ['A1', 'A2', 'A3', 'A4'];

/** The Heroes on the player's own A-board. */
export function playerBoardHeroes(state: Pick<GameState, 'board' | 'cardsById'>): Card[] {
  return A_SLOTS.map((slot) => state.board[slot])
    .filter((id): id is CardId => Boolean(id))
    .map((id) => state.cardsById[id])
    .filter((c): c is Card => Boolean(c));
}

/** Build the zone snapshot from game state. */
export function abilityZones(
  state: Pick<GameState, 'board' | 'cardsById' | 'hand' | 'replen' | 'deck' | 'graveyard'>,
): AbilityZones {
  return {
    handCount: state.hand.length,
    replenCount: state.replen.length,
    deckCount: state.deck.length,
    allyBoard: playerBoardHeroes(state),
    graveyard: state.graveyard.map((id) => state.cardsById[id]).filter((c): c is Card => Boolean(c)),
  };
}

/** Effects the runtime actually applies. Parsed-only effects (forceTarget,
 *  armorBarsLock, markEnemy, enemyStatDebuff) stay non-activatable so a cost is
 *  never paid for nothing. */
const ENFORCED_EFFECTS = new Set(['selfStatBuff', 'targetStatBuff', 'healTarget', 'recoverFromGraveyard']);
const ENFORCED_COSTS = new Set(['sendHandToReplen', 'discardHand', 'sendReplenToGraveyard', 'discardDeckTop']);

/** True when the runtime can fully resolve this activated ability. */
export function isEnforcedActivated(ir: AbilityIR): boolean {
  if (ir.trigger !== 'activated') return false;
  if (!ENFORCED_EFFECTS.has(ir.effect.kind)) return false;
  if (ir.cost) {
    if (!ENFORCED_COSTS.has(ir.cost.kind)) return false;
    if ('count' in ir.cost && ir.cost.count !== 1) return false;
  }
  return true;
}

/** Zone the player picks a cost card from, or null when the cost needs no pick
 *  (no cost, or an automatic one like discarding the top of the Deck). */
export function costPickZone(ir: AbilityIR): 'hand' | 'replen' | null {
  switch (ir.cost?.kind) {
    case 'sendHandToReplen':
    case 'discardHand':
      return 'hand';
    case 'sendReplenToGraveyard':
      return 'replen';
    default:
      return null;
  }
}

/** True when the ability's cost (if any) can currently be paid. */
export function costPayable(ir: AbilityIR, zones: Pick<AbilityZones, 'handCount' | 'replenCount' | 'deckCount'>): boolean {
  const cost = ir.cost;
  if (!cost) return true;
  switch (cost.kind) {
    case 'sendHandToReplen':
    case 'discardHand':
      return zones.handCount >= cost.count;
    case 'sendReplenToGraveyard':
      return zones.replenCount >= cost.count;
    case 'discardDeckTop':
      return zones.deckCount >= cost.count;
    default:
      return false;
  }
}

/** True when the ability requires the player to pick a target. */
export function abilityNeedsTarget(ir: AbilityIR): boolean {
  const k = ir.effect.kind;
  return k === 'targetStatBuff' || k === 'healTarget' || k === 'recoverFromGraveyard';
}

/** Legal targets for a targeting ability. Empty for non-targeting abilities. */
export function abilityTargetOptions(
  ir: AbilityIR,
  zones: Pick<AbilityZones, 'allyBoard' | 'graveyard'>,
  sourceId: CardId,
): Card[] {
  const e = ir.effect;
  if (e.kind === 'targetStatBuff' || e.kind === 'healTarget') {
    return zones.allyBoard.filter((c) => matchesSelector(c, e.target, 'ally', sourceId));
  }
  if (e.kind === 'recoverFromGraveyard') {
    return zones.graveyard.filter((c) => c.type === e.cardType);
  }
  return [];
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

/** Feasibility of one activated ability given the zones (ignores phase/board). */
export function activationFeasible(ir: AbilityIR, zones: AbilityZones, sourceId: CardId): boolean {
  if (!isEnforcedActivated(ir)) return false;
  if (!costPayable(ir, zones)) return false;
  return !abilityNeedsTarget(ir) || abilityTargetOptions(ir, zones, sourceId).length > 0;
}

/** Build the per-ability views for a card in the current context. */
export function activatedAbilityViews(card: Card, ctx: ActivationContext): ActivatedAbilityView[] {
  const irs = parseAbilities(card.abilities);
  const zones: AbilityZones = {
    handCount: ctx.handCount ?? 0,
    replenCount: ctx.replenCount ?? 0,
    deckCount: ctx.deckCount ?? 0,
    allyBoard: ctx.allyBoard ?? [],
    graveyard: ctx.graveyard ?? [],
  };
  return irs.map((ir, index) => {
    const isActivated = ir.trigger === 'activated';
    const used = ir.oncePerTurn === true && ctx.usedNames.includes(ir.name);
    const activatable =
      isActivated && ctx.isPlayerMain && ctx.onPlayerBoard && !used && activationFeasible(ir, zones, card.id);
    return { index, name: ir.name, text: ir.raw, ir, isActivated, used, activatable };
  });
}

/** True when the card has at least one ability the player can trigger now
 *  (drives the on-card "activatable" glow). */
export function hasAvailableActivated(card: Card, ctx: ActivationContext): boolean {
  return activatedAbilityViews(card, ctx).some((v) => v.activatable);
}
