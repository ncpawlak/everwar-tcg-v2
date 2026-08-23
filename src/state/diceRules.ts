import type { RollOutcome, RollResult } from './types';

/**
 * Phase 5 dice rules — pure combat resolution for a single attacker's D20 roll.
 * Side-effect free so the engine can absorb the result and tests can assert the
 * math directly.
 *
 * A card's ACC is a base-10 value (10..200) that scales onto the d20 by ÷10, so
 * the accuracy THRESHOLD `t = acc / 10` lands in 1..20. Given a roll `r`:
 *
 *   1-2            -> Glancing : half DMG   (a nat-low always at least grazes)
 *   3..t           -> Normal   : full DMG
 *   t+1..18        -> Miss     : no damage
 *   19-20          -> Crit     : double DMG
 *   acc > 100 and r == t -> Crit (rolling your own ACC value crits too)
 *
 * The multiplier applies to DMG only; ACC just sets the thresholds. Crit (19-20
 * or the ACC-value crit) wins over everything; the 1-2 graze wins over a normal
 * hit at the low end. Bands are inclusive.
 */

export const GLANCE_MAX = 2;
export const CRIT_MIN = 19;
/** Highest face that can still be a plain miss (above the accuracy threshold). */
export const MISS_CEILING = 18;

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
export function classifyRoll(roll: number, acc: number): RollOutcome {
  const t = accThreshold(acc);
  // High-roll crit, then the bonus "roll your ACC value" crit for high accuracy.
  if (roll >= CRIT_MIN) return 'crit';
  if (acc > 100 && roll === t) return 'crit';
  // A nat-low always grazes for half, regardless of accuracy.
  if (roll <= GLANCE_MAX) return 'glancing';
  // Normal hit up to the accuracy threshold; everything else up to 18 misses.
  if (roll <= t) return 'normal';
  return 'miss';
}

/**
 * Resolve one attacker's roll into an outcome + damage dealt. `dmg` is the
 * card's base damage; the outcome multiplier scales it (glancing ×0.5, normal
 * ×1, crit ×2, miss ×0).
 */
export function resolveRoll(roll: number, dmg: number, acc: number): RollResult {
  const outcome = classifyRoll(roll, acc);
  return { roll, outcome, damage: dmg * DAMAGE_MULTIPLIER[outcome] };
}

/** Short uppercase label for a roll outcome, shown over the settled die. */
export const OUTCOME_LABEL: Record<RollOutcome, string> = {
  glancing: 'GLANCING',
  normal: 'HIT',
  miss: 'MISS',
  crit: 'CRIT',
};
