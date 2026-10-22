/**
 * Combat-trigger ability runtime (Phase 8). Pure helpers over the parsed IR of an
 * attacking Hero AND the Equipment in its linked C slot:
 *   - `instantEliminate` (Hidden Finisher, Headhunter): mandatory, gated by
 *      target level / HP / Armor Bars / crit; sends the target straight to the
 *      Graveyard ignoring armor.
 *   - `breakAllArmorBars` (Bunker Busting Round): optional, once-per-turn. The
 *      runtime pauses Resolution and prompts yes/no; on accept it wipes every
 *      Armor Bar on the target and inflicts no HP damage.
 *   - `ignoreArmorBars` (Anvil): passive; the hit bypasses Armor Bars.
 * Kept pure so the store's Resolution loop and any UI read one source of truth.
 */

import type { Card, RollOutcome } from '../state/types';
import type { AbilityIR } from './abilityIR';
import { parseAbilities } from './parseAbility';

/** An attacker's resolved combat abilities, split by effect. */
export interface CombatHitAbilities {
  /** Optional, once-per-turn: wipe all Armor Bars, deal no damage (prompted). */
  breakAllArmorBars?: AbilityIR;
  /** Mandatory instant eliminations (any one whose gate holds fires). */
  instantEliminate: AbilityIR[];
  /** The attacker's Hits skip Armor Bars. */
  ignoreArmorBars: boolean;
}

/** Collect the combat abilities of an attacker and its equipped card. */
export function combatHitAbilities(card: Card | undefined, equipment?: Card): CombatHitAbilities {
  const out: CombatHitAbilities = { instantEliminate: [], ignoreArmorBars: false };
  if (!card) return out;
  const irs = [...parseAbilities(card.abilities), ...(equipment ? parseAbilities(equipment.abilities) : [])];
  for (const ir of irs) {
    if (ir.effect.kind === 'ignoreArmorBars') out.ignoreArmorBars = true;
    if (ir.trigger !== 'combatHit') continue;
    if (ir.effect.kind === 'breakAllArmorBars') out.breakAllArmorBars = ir;
    else if (ir.effect.kind === 'instantEliminate') out.instantEliminate.push(ir);
  }
  return out;
}

/** True when a card carries any `combatHit` ability. */
export function hasCombatHitAbility(card: Card | undefined, equipment?: Card): boolean {
  const a = combatHitAbilities(card, equipment);
  return Boolean(a.breakAllArmorBars || a.instantEliminate.length);
}

/** The hit being resolved, as seen BEFORE its own damage applies. */
export interface HitContext {
  outcome: RollOutcome;
  /** Target's current HP. */
  currentHp: number;
  /** Target's current Armor Bars. */
  bars: number;
}

/** True when any instant-elimination ability fires on this hit. A miss never
 *  triggers. Normal Hero = level ≤ 2; "half HP" is against base max HP. */
export function finisherEliminates(
  abilities: CombatHitAbilities,
  target: Card | undefined,
  hit: HitContext,
): boolean {
  if (!target || hit.outcome === 'miss') return false;
  return abilities.instantEliminate.some((ir) => {
    if (ir.effect.kind !== 'instantEliminate') return false;
    const g = ir.effect.gate;
    if (g.critOnly && hit.outcome !== 'crit') return false;
    if (g.targetNormal && (target.level ?? 1) > 2) return false;
    if (g.targetBelowHalfHp && !(hit.currentHp < (target.hp ?? 0) / 2)) return false;
    if (g.targetNoArmorBars && hit.bars > 0) return false;
    return true;
  });
}
