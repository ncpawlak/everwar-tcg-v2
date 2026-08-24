/**
 * Ability IR (Phase 8) — the structured, engine-readable form of a Hero's
 * rules text. The parser (`parseAbility.ts`) turns each ability line into one
 * of these nodes; the runtime interprets the node generically instead of
 * hand-coding every card. Text that no rule recognizes yet becomes an
 * `unimplemented` node: inert at runtime but preserved for display and for a
 * future slice to model.
 */

/** Stat an aura can modify. Superset of the combat `StatKey` so armor auras can
 *  be modeled ahead of the armor-combat slice that will consume them. */
export type AuraStat = 'hp' | 'dmg' | 'acc' | 'armor';

/** Who an aura targets. `self` = the ability owner's own cards ("you control");
 *  `family` is an archetype name matched against a Hero's card name (e.g. "Echo"). */
export interface AuraScope {
  controller: 'self';
  family: string;
}

/** A continuous stat aura: "+N STAT to all <family> Heroes you control". */
export interface StatAuraEffect {
  kind: 'statAura';
  stat: AuraStat;
  amount: number;
  scope: AuraScope;
}

/** Fallback for ability text no rule models yet. Inert at runtime. */
export interface UnimplementedEffect {
  kind: 'unimplemented';
}

export type AbilityEffect = StatAuraEffect | UnimplementedEffect;

/** When an ability's effect is evaluated. Only `passive` (continuous) auras are
 *  modeled in this slice; more triggers (on-set, when-destroyed, on-hit, …)
 *  arrive with later slices. */
export type AbilityTrigger = 'passive' | 'unimplemented';

/** "Only 1 <name> Ability can be active on your field at once." */
export interface MaxActiveConstraint {
  kind: 'maxActiveByName';
  name: string;
  max: number;
}

export type AbilityConstraint = MaxActiveConstraint;

/** Parsed, structured form of one ability rules-text line. */
export interface AbilityIR {
  /** Ability name — the text before the first colon, e.g. "Echo Assist". */
  name: string;
  /** Original rules text, kept verbatim for display + future re-parsing. */
  raw: string;
  trigger: AbilityTrigger;
  effect: AbilityEffect;
  constraints: AbilityConstraint[];
}
