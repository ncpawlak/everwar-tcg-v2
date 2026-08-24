/**
 * Passive-aura runtime (Phase 8). Given the Hero cards one side controls, this
 * collects the continuous stat-auras currently active and computes the delta a
 * given Hero receives for a given stat. It is the generic interpreter for
 * `statAura` IR nodes — no per-card code.
 *
 * The combat-stat seam (`combatStats.effectiveStats`) folds these deltas into a
 * Hero's effective stats, so an aura shows on the card overlay AND changes the
 * combat roll from one place.
 */

import type { Card } from '../state/types';
import type { AuraStat, StatAuraEffect } from './abilityIR';
import { parseAbilities } from './parseAbility';

/** A live aura contributed by a Hero on the field. */
export interface ActiveAura {
  /** Id of the Hero card projecting this aura (the one that won any cap). */
  sourceId: string;
  name: string;
  effect: StatAuraEffect;
}

/**
 * Collect the passive stat-auras active for one side from the Hero cards it
 * controls (its A-board occupants). A `maxActiveByName` constraint caps how
 * many same-named auras count (all current auras cap at 1), so a second copy of
 * the same aura contributes nothing. Auras with no cap stack per source.
 */
export function collectAuras(controlledHeroes: Card[]): ActiveAura[] {
  const active: ActiveAura[] = [];
  const counts = new Map<string, number>();

  for (const card of controlledHeroes) {
    for (const ir of parseAbilities(card.abilities)) {
      if (ir.trigger !== 'passive' || ir.effect.kind !== 'statAura') continue;
      const cap = ir.constraints.find((c) => c.kind === 'maxActiveByName');
      if (cap) {
        const seen = counts.get(cap.name) ?? 0;
        if (seen >= cap.max) continue;
        counts.set(cap.name, seen + 1);
      }
      active.push({ sourceId: card.id, name: ir.name, effect: ir.effect });
    }
  }
  return active;
}

/**
 * Ids of the Hero cards currently projecting at least one active passive aura
 * (the winners after cap de-duplication). Drives the on-card "aura active" glow.
 */
export function projectingAuraCardIds(controlledHeroes: Card[]): Set<string> {
  return new Set(collectAuras(controlledHeroes).map((a) => a.sourceId));
}

/**
 * Sum the aura delta a specific Hero receives for one stat. A Hero is affected
 * when its card name contains the aura's family archetype (e.g. an "Echo Assist"
 * aura buffs any Hero whose name includes "Echo").
 */
export function auraStatDelta(auras: ActiveAura[], card: Card, stat: AuraStat): number {
  let delta = 0;
  for (const a of auras) {
    if (a.effect.stat !== stat) continue;
    if (!card.name.includes(a.effect.scope.family)) continue;
    delta += a.effect.amount;
  }
  return delta;
}
