import type { RollOutcome, RollResult } from './types';

/**
 * Dice rules — pure combat resolution for a single attacker's D20 roll.
 * Side-effect free so the engine can absorb the result and tests can assert the
 * math directly.
 *
 * A card's ACC is a base-10 value that scales onto the d20 by ÷10, so the hit
 * THRESHOLD is `t = acc / 10` (ACC 70 hits on 7 or less). Given a roll `r`:
 *
 *   20                          -> Crit     : double DMG (always, regardless of ACC)
 *   r == t on a Special Hero    -> Crit     : double DMG (L3–4 "exact ACC" crit)
 *   1                           -> Glancing : half DMG
 *   2..t                        -> Normal   : full DMG
 *   otherwise                   -> Miss     : no damage
 *
 * A "Hit" is any of glancing / normal / crit. The multiplier applies to DMG only.
 */

export const GLANCE_ROLL = 1;
export const CRIT_ROLL = 20;

export const DAMAGE_MULTIPLIER: Record<RollOutcome, number> = {
  glancing: 0.5,
  normal: 1,
  miss: 0,
  crit: 2,
};

/** Accuracy threshold on the d20 scale (acc 10..200 -> 1..20). */
export function accThreshold(acc: number): number {
  return Math.floor(acc / 10);
}

/** Classify a d20 roll against a card's accuracy into a hit outcome. */
export function classifyRoll(roll: number, acc: number, special = false): RollOutcome {
  const t = accThreshold(acc);
  if (roll === CRIT_ROLL) return 'crit';
  if (special && roll === t) return 'crit';
  if (roll === GLANCE_ROLL) return 'glancing';
  if (roll <= t) return 'normal';
  return 'miss';
}

/** Special Hero = level 3–4; they get the exact-ACC crit. */
export function isSpecialHero(card: { level?: number } | undefined): boolean {
  return (card?.level ?? 1) >= 3;
}

/**
 * Resolve one attacker's roll into an outcome + damage dealt. `dmg` is the
 * card's base damage; the outcome multiplier scales it (glancing ×0.5, normal
 * ×1, crit ×2, miss ×0). `special` enables the Special Hero exact-ACC crit.
 */
export function resolveRoll(roll: number, dmg: number, acc: number, special = false): RollResult {
  const outcome = classifyRoll(roll, acc, special);
  return { roll, outcome, damage: dmg * DAMAGE_MULTIPLIER[outcome] };
}

/** Short uppercase label for a roll outcome, shown over the settled die. */
export const OUTCOME_LABEL: Record<RollOutcome, string> = {
  glancing: 'GLANCING',
  normal: 'HIT',
  miss: 'MISS',
  crit: 'CRIT',
};
