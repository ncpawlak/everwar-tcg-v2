/**
 * Pile-ability runtime (Phase 8). Pure helpers over a card's parsed IR for the
 * two pile-related triggers:
 *   - `onSentToPile`: fires when the owning Hero is SENT to a pile — the store
 *      prompts the player to use it once the send animation lands.
 *   - `pileActivated`: an ability the player can trigger WHILE the Hero sits in
 *      a pile — drives the amber pile glow, the amber tile in the pile-search
 *      pop-up, and the activation action.
 * Kept pure so the store action, the board glow, and the pop-up all read one
 * source of truth.
 */

import type { Card, CardId } from '../state/types';
import type { AbilityIR, PileKind } from './abilityIR';
import { parseAbilities } from './parseAbility';

/** One matched pile ability on a specific card. */
export interface PileAbilityHit {
  cardId: CardId;
  abilityIndex: number;
  ir: AbilityIR;
}

/** The first `onSentToPile` ability on a card that fires for the given pile,
 *  or null. */
export function onSentAbilityFor(card: Card, pile: PileKind): PileAbilityHit | null {
  const irs = parseAbilities(card.abilities);
  const index = irs.findIndex((ir) => ir.trigger === 'onSentToPile' && ir.pile === pile);
  return index === -1 ? null : { cardId: card.id, abilityIndex: index, ir: irs[index] };
}

/** Every on-sent trigger among the just-sent cards for the given pile, in order. */
export function onSentAbilities(
  sentIds: readonly CardId[],
  pile: PileKind,
  cardsById: Record<CardId, Card>,
): PileAbilityHit[] {
  const hits: PileAbilityHit[] = [];
  for (const id of sentIds) {
    const card = cardsById[id];
    if (!card) continue;
    const hit = onSentAbilityFor(card, pile);
    if (hit) hits.push(hit);
  }
  return hits;
}

/** The first `pileActivated` ability on a card that activates from the given
 *  pile, or null. */
export function pileActivatedAbilityFor(card: Card, pile: PileKind): PileAbilityHit | null {
  const irs = parseAbilities(card.abilities);
  const index = irs.findIndex((ir) => ir.trigger === 'pileActivated' && ir.pile === pile);
  return index === -1 ? null : { cardId: card.id, abilityIndex: index, ir: irs[index] };
}

/** True when a card sitting in `pile` has a pile-activated ability the player
 *  could trigger from it. */
export function cardHasPileActivated(card: Card | undefined, pile: PileKind): boolean {
  return Boolean(card && pileActivatedAbilityFor(card, pile));
}

/** True when any card in the pile carries a pile-activated ability (drives the
 *  amber pile-edge glow). */
export function pileHasActivatable(
  pileIds: readonly CardId[],
  pile: PileKind,
  cardsById: Record<CardId, Card>,
): boolean {
  return pileIds.some((id) => cardHasPileActivated(cardsById[id], pile));
}
