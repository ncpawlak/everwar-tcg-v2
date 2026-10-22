/**
 * On-Set trigger helpers. Pure lookups over a Hero's parsed abilities: which
 * `onSet` abilities fire for a given Set kind, which cards a "select 1 …" On-Set
 * effect may pick from, and which enemy Normal Heroes Domination destroys.
 */

import type { Card, CardId } from '../state/types';
import type { AbilityIR, SetKind } from './abilityIR';
import { parseAbilities } from './parseAbility';

export interface OnSetHit {
  abilityIndex: number;
  ir: AbilityIR;
}

/** The card's `onSet` abilities that fire for this Set kind, in printed order. */
export function onSetAbilities(card: Card | undefined, kind: SetKind): OnSetHit[] {
  if (!card || card.type !== 'A') return [];
  return parseAbilities(card.abilities)
    .map((ir, abilityIndex) => ({ abilityIndex, ir }))
    .filter(({ ir }) => ir.trigger === 'onSet' && (ir.setKinds ?? []).includes(kind));
}

/** True when an On-Set effect needs the player to pick a card. */
export function onSetNeedsChoice(ir: AbilityIR): boolean {
  return (
    ir.effect.kind === 'opponentEquipmentToReplen' ||
    (ir.effect.kind === 'recoverFromGraveyard' && ir.effect.to === 'hand')
  );
}

export interface OnSetChoiceZones {
  cardsById: Record<CardId, Card>;
  graveyard: readonly CardId[];
  opponentCards: Record<CardId, Card>;
  opponentEquipment: readonly CardId[];
}

/** Legal picks for a choice-based On-Set effect. */
export function onSetChoiceOptions(ir: AbilityIR, z: OnSetChoiceZones): CardId[] {
  const e = ir.effect;
  if (e.kind === 'opponentEquipmentToReplen') return z.opponentEquipment.filter((id) => z.opponentCards[id]);
  if (e.kind === 'recoverFromGraveyard' && e.to === 'hand') {
    return z.graveyard.filter((id) => z.cardsById[id]?.type === e.cardType);
  }
  return [];
}

/** Domination's victims: enemy Normal Heroes (level ≤ 2; all Heroes count as
 *  Human for now), up to `limit`. When more qualify than the cap allows, the
 *  strongest go first (highest level, then highest current HP). */
export function dominationVictims<T extends string>(
  enemies: readonly { slot: T; card: Card; hp: number }[],
  limit: number,
): T[] {
  return enemies
    .filter((e) => (e.card.level ?? 1) <= 2)
    .sort((a, b) => (b.card.level ?? 1) - (a.card.level ?? 1) || b.hp - a.hp)
    .slice(0, Math.max(0, limit))
    .map((e) => e.slot);
}
