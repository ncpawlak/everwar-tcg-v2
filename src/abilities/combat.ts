/**
 * Combat-trigger ability runtime (Phase 8). Pure helpers over a Hero's parsed IR
 * for `combatHit` abilities — those that fire when the owning Hero lands a
 * Successful Hit (glancing / normal / crit; a miss never triggers them):
 *   - `instantEliminate` (Snow Viper's Hidden Finisher): mandatory. The runtime
 *      gates it on the target being a Normal Hero (level ≤ 2) already under half
 *      HP, then sends it straight to the Graveyard ignoring armor.
 *   - `breakAllArmorBars` (Snow Viper's Bunker Busting Round): optional and
 *      once-per-turn. The runtime pauses Resolution and prompts yes/no; on accept
 *      it wipes every Armor Bar on the target and inflicts no HP damage.
 * Kept pure so the store's Resolution loop and any UI read one source of truth.
 */

import type { Card } from '../state/types';
import type { AbilityIR } from './abilityIR';
import { parseAbilities } from './parseAbility';

/** A Hero's resolved `combatHit` abilities, split by effect. */
export interface CombatHitAbilities {
  /** Optional, once-per-turn: wipe all Armor Bars, deal no damage (prompted). */
  breakAllArmorBars?: AbilityIR;
  /** Mandatory: instantly eliminate a low-HP Normal Hero. */
  instantEliminate?: AbilityIR;
}

/** Parse a card's `combatHit` abilities into their effect buckets. Returns an
 *  empty object for cards with no such abilities (or no card). */
export function combatHitAbilities(card: Card | undefined): CombatHitAbilities {
  const out: CombatHitAbilities = {};
  if (!card) return out;
  for (const ir of parseAbilities(card.abilities)) {
    if (ir.trigger !== 'combatHit') continue;
    if (ir.effect.kind === 'breakAllArmorBars') out.breakAllArmorBars = ir;
    else if (ir.effect.kind === 'instantEliminate') out.instantEliminate = ir;
  }
  return out;
}

/** True when a card carries any `combatHit` ability. */
export function hasCombatHitAbility(card: Card | undefined): boolean {
  const a = combatHitAbilities(card);
  return Boolean(a.breakAllArmorBars || a.instantEliminate);
}

/** True when Hidden Finisher would eliminate the target right now: the attacker
 *  has an `instantEliminate` ability, the target is a Normal Hero (level ≤ 2),
 *  and its current HP is already below half its maximum (checked BEFORE the hit's
 *  own damage). `maxHp` is the target's base HP; `currentHp` its live HP. */
export function finisherEliminates(
  abilities: CombatHitAbilities,
  target: Card | undefined,
  currentHp: number,
): boolean {
  if (!abilities.instantEliminate || !target) return false;
  const isNormalHero = (target.level ?? 1) <= 2;
  const maxHp = target.hp ?? 0;
  return isNormalHero && currentHp < maxHp / 2;
}
