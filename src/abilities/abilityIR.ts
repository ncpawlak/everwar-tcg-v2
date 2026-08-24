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

/** An activated self-buff: "this Hero gains +N STAT" applied to the ability's
 *  own card when the player triggers it. Persists while the Hero is on the field. */
export interface SelfStatBuffEffect {
  kind: 'selfStatBuff';
  stat: AuraStat;
  amount: number;
}

/** Which cards an activated ability may target when the player triggers it.
 *  `ally` = a Hero on the player's own A-board. `subType` (optional) restricts to
 *  a Hero sub-type (e.g. "Infantry"). `excludeSelf` drops the ability's owner
 *  ("another … Hero"). */
export interface TargetSpec {
  side: 'ally';
  subType?: string;
  excludeSelf: boolean;
}

/** An activated buff applied to a chosen target: "select another <sub> Hero you
 *  control to gain +N STAT". The buff persists while that Hero stays on the field. */
export interface TargetStatBuffEffect {
  kind: 'targetStatBuff';
  stat: AuraStat;
  amount: number;
  target: TargetSpec;
}

/** Fallback for ability text no rule models yet. Inert at runtime. */
export interface UnimplementedEffect {
  kind: 'unimplemented';
}

export type AbilityEffect =
  | StatAuraEffect
  | SelfStatBuffEffect
  | TargetStatBuffEffect
  | UnimplementedEffect;

/** A cost the player must pay to trigger an activated ability. Modeled kinds so
 *  far: send N cards from the Hand to the Replen pile. */
export interface SendHandToReplenCost {
  kind: 'sendHandToReplen';
  count: number;
}

export type AbilityCost = SendHandToReplenCost;

/** When an ability's effect is evaluated. `passive` (continuous) auras and
 *  `activated` (player-triggered, Main phase) abilities are modeled; more
 *  triggers (on-set, when-destroyed, on-hit, …) arrive with later slices. */
export type AbilityTrigger = 'passive' | 'activated' | 'unimplemented';

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
  /** True when an activated ability may only be triggered once per turn. */
  oncePerTurn?: boolean;
  /** Cost the player must pay to trigger an activated ability, if any. */
  cost?: AbilityCost;
}
