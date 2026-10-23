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
import type { AbilityCondition, AbilityIR, AuraStat, HeroSelector, StatAuraEffect } from './abilityIR';
import { parseAbilities } from './parseAbility';

/** A live aura contributed by a Hero on the field. */
export interface ActiveAura {
  /** Id of the Hero projecting this aura (the one that won any cap). For an
   *  Equipment ability this is the Hero the Equipment is attached to. */
  sourceId: string;
  name: string;
  effect: StatAuraEffect;
}

/**
 * One side's field as the aura runtime sees it: the Heroes it controls and,
 * optionally, a lookup for the Equipment attached to each Hero (its linked C
 * slot). Without the lookup, equipment conditions never hold.
 */
export interface SideField {
  heroes: Card[];
  equipmentOf?: (heroId: string) => Card | undefined;
}

function toField(field: SideField | Card[]): SideField {
  return Array.isArray(field) ? { heroes: field } : field;
}

/** Does `card` match `sel`? `relation` is the card's side relative to the
 *  ability's controller; `sourceId` resolves "this Hero" / "other". */
export function matchesSelector(card: Card, sel: HeroSelector, relation: 'ally' | 'enemy', sourceId: string): boolean {
  if (sel.side !== relation) return false;
  if (sel.self && card.id !== sourceId) return false;
  if (sel.excludeSelf && card.id === sourceId) return false;
  if (sel.family && !card.name.includes(sel.family)) return false;
  if (sel.allegiance && card.allegiance !== sel.allegiance) return false;
  if (sel.subType && card.subType !== sel.subType) return false;
  return true;
}

function conditionHolds(cond: AbilityCondition, source: Card, field: SideField): boolean {
  switch (cond.kind) {
    case 'controls':
      return field.heroes.some((h) => matchesSelector(h, cond.selector, 'ally', source.id));
    case 'equipped': {
      const eq = field.equipmentOf?.(source.id);
      if (!eq || eq.subType !== cond.subType) return false;
      if (cond.weaponClasses && !cond.weaponClasses.includes(eq.weaponClass ?? '')) return false;
      if (cond.family && !eq.name.includes(cond.family)) return false;
      return true;
    }
    case 'equippedTo':
      return matchesSelector(source, cond.selector, 'ally', source.id);
  }
}

const allHold = (conds: AbilityCondition[] | undefined, source: Card, field: SideField) =>
  (conds ?? []).every((c) => conditionHolds(c, source, field));

/**
 * Collect the passive stat-auras active for one side. Sources are the side's
 * Heroes plus the Equipment attached to them. Each ability's `While …`
 * conditions must hold; riders add their effect when their own conditions
 * also hold. A `maxActiveByName` constraint caps how many same-named auras
 * count, so a second copy of a capped aura contributes nothing.
 */
export function collectAuras(fieldOrHeroes: SideField | Card[]): ActiveAura[] {
  const field = toField(fieldOrHeroes);
  const active: ActiveAura[] = [];
  const counts = new Map<string, number>();

  const consider = (source: Card, ir: AbilityIR) => {
    if (ir.trigger !== 'passive' || !allHold(ir.conditions, source, field)) return;
    const effects: StatAuraEffect[] = [];
    if (ir.effect.kind === 'statAura') effects.push(ir.effect);
    for (const r of ir.riders ?? []) {
      if (r.effect.kind === 'statAura' && allHold(r.conditions, source, field)) effects.push(r.effect);
    }
    if (!effects.length) return;
    const cap = ir.constraints.find((c) => c.kind === 'maxActiveByName');
    if (cap) {
      const seen = counts.get(cap.name) ?? 0;
      if (seen >= cap.max) return;
      counts.set(cap.name, seen + 1);
    }
    for (const effect of effects) active.push({ sourceId: source.id, name: ir.name, effect });
  };

  for (const hero of field.heroes) {
    for (const ir of parseAbilities(hero.abilities)) consider(hero, ir);
    const eq = field.equipmentOf?.(hero.id);
    // Equipment abilities speak for their bearer ("this Hero" = the bearer).
    if (eq) for (const ir of parseAbilities(eq.abilities)) consider(hero, ir);
  }
  return active;
}

/**
 * Ids of the Hero cards currently projecting at least one active passive aura
 * (the winners after cap de-duplication). Drives the on-card "aura active" glow.
 */
export function projectingAuraCardIds(field: SideField | Card[]): Set<string> {
  return new Set(collectAuras(field).map((a) => a.sourceId));
}

/**
 * Sum the aura delta a specific Hero receives for one stat from `auras`.
 * `relation` is the Hero's side relative to the auras' controller: pass
 * `'ally'` for the controller's own Heroes and `'enemy'` for the opposing
 * side's (e.g. Sandstorm Inbound's "enemy Heroes have -10 ACC").
 */
export function auraStatDelta(
  auras: ActiveAura[],
  card: Card,
  stat: AuraStat,
  relation: 'ally' | 'enemy' = 'ally',
): number {
  let delta = 0;
  for (const a of auras) {
    if (a.effect.stat !== stat) continue;
    if (!matchesSelector(card, a.effect.target, relation, a.sourceId)) continue;
    delta += a.effect.amount;
  }
  return delta;
}
