import type { Card, CardId } from '../state/types';
import type { AbilityIR, CounterEffect } from './abilityIR';
import { parseAbilities } from './parseAbility';

/** A card's counter ability (Devil Dog Reinforcement, Zero Guide), if any. */
export function counterAbility(card: Card | undefined): { ir: AbilityIR; effect: CounterEffect; index: number } | null {
  const irs = parseAbilities(card?.abilities);
  const index = irs.findIndex((ir) => ir.effect.kind === 'counter');
  if (index < 0) return null;
  const ir = irs[index];
  return { ir, effect: ir.effect as CounterEffect, index };
}

/** Index of the top-most (deck end = top) Special Hero (level ≥ 3) whose name
 *  contains `family`, or -1. */
export function topSpecialOfFamily(deck: readonly CardId[], lookup: Record<CardId, Card>, family: string): number {
  for (let i = deck.length - 1; i >= 0; i--) {
    const c = lookup[deck[i]];
    if (c?.type === 'A' && (c.level ?? 1) >= 3 && c.name.includes(family)) return i;
  }
  return -1;
}
