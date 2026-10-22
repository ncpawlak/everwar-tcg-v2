import type { RollOutcome } from './types';

/** A defender's current mitigation state at the moment a hit lands. */
export interface DefenderArmor {
  /** Remaining Armor Bars (whole shields that absorb a hit then break). */
  bars: number;
  /** Flat Armor: a static per-hit subtraction applied only to HP damage. */
  armor: number;
}

export interface ArmorHitResult {
  /** Armor Bars remaining after this hit resolves. */
  bars: number;
  /** Damage that actually reaches HP (already floored at 0). */
  hpDamage: number;
  /** How many bars this hit destroyed (0, 1, or 2). */
  barsBroken: number;
}

/**
 * Resolve one attacker's hit against a defender's Armor / Armor Bars.
 *
 * Model (confirmed with the user):
 * - Flat Armor is a static subtraction applied to HP damage only: `max(0, dmg - armor)`.
 * - Armor Bars absorb the FIRST hit(s) entirely, then break — they take 0 HP damage.
 * - Any successful non-crit hit (normal OR glancing) breaks exactly one bar and deals 0 HP damage.
 * - A crit is the exception:
 *     - 2+ bars  -> destroys 2 bars, 0 HP damage.
 *     - exactly 1 bar -> breaks the bar AND leaks a REGULAR (non-doubled) hit: `baseDamage - armor`.
 *     - 0 bars   -> full crit hit: `rawDamage - armor` (rawDamage is already the doubled crit value).
 * - A miss changes nothing (no bar is spent).
 *
 * @param def         Current defender armor state.
 * @param outcome     The roll outcome for this hit.
 * @param rawDamage   Post-outcome damage (glancing 0.5x, normal 1x, crit 2x).
 * @param baseDamage  The attacker's 1x damage (used only for the crit-through-1-bar leak).
 */
export function applyArmorToHit(
  def: DefenderArmor,
  outcome: RollOutcome,
  rawDamage: number,
  baseDamage: number,
): ArmorHitResult {
  const armor = Math.max(0, def.armor);
  const bars = Math.max(0, def.bars);
  const thru = (dmg: number) => Math.max(0, dmg - armor);

  if (outcome === 'miss') {
    return { bars, hpDamage: 0, barsBroken: 0 };
  }

  if (outcome === 'crit') {
    if (bars >= 2) return { bars: bars - 2, hpDamage: 0, barsBroken: 2 };
    if (bars === 1) return { bars: 0, hpDamage: thru(baseDamage), barsBroken: 1 };
    return { bars: 0, hpDamage: thru(rawDamage), barsBroken: 0 };
  }

  // Successful non-crit hit (normal or glancing).
  if (bars >= 1) return { bars: bars - 1, hpDamage: 0, barsBroken: 1 };
  return { bars: 0, hpDamage: thru(rawDamage), barsBroken: 0 };
}
