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

/** Draw N cards from the top of the deck. Used by on-sent pile triggers
 *  (e.g. "When this Hero is sent to the Graveyard: draw 1 card."). */
export interface DrawEffect {
  kind: 'draw';
  count: number;
}

/** Return the ability's own card from the pile it sits in back to the Hand.
 *  Used by in-pile activated abilities (e.g. "While this Hero is in your Replen
 *  pile, you can: return it to your Hand."). */
export interface ReturnSelfToHandEffect {
  kind: 'returnSelfToHand';
}

/** Break ALL Armor Bars on the target Hero and inflict no HP damage. Used by
 *  Snow Viper's Bunker Busting Round (`combatHit`, optional, once-per-turn). */
export interface BreakAllArmorBarsEffect {
  kind: 'breakAllArmorBars';
}

/** Eliminate the target Hero instantly, ignoring its armor and Armor Bars. Used
 *  by Snow Viper's Hidden Finisher (`combatHit`, mandatory). The runtime gates it
 *  on the target being a Normal Hero (level ≤ 2) at less than half HP. */
export interface InstantEliminateEffect {
  kind: 'instantEliminate';
}

/** Fallback for ability text no rule models yet. Inert at runtime. */
export interface UnimplementedEffect {
  kind: 'unimplemented';
}

export type AbilityEffect =
  | StatAuraEffect
  | SelfStatBuffEffect
  | TargetStatBuffEffect
  | DrawEffect
  | ReturnSelfToHandEffect
  | BreakAllArmorBarsEffect
  | InstantEliminateEffect
  | UnimplementedEffect;

/** A pile a card can be sent to / activate from. */
export type PileKind = 'graveyard' | 'replen';

/** A cost the player must pay to trigger an activated ability. Modeled kinds so
 *  far: send N cards from the Hand to the Replen pile. */
export interface SendHandToReplenCost {
  kind: 'sendHandToReplen';
  count: number;
}

export type AbilityCost = SendHandToReplenCost;

/** When an ability's effect is evaluated. `passive` (continuous) auras,
 *  `activated` (player-triggered, Main phase), `onSentToPile` (fires when the
 *  owning Hero is sent to a pile), and `pileActivated` (player-triggered while
 *  the Hero sits in a pile) are modeled; more triggers arrive with later slices. */
export type AbilityTrigger =
  | 'passive'
  | 'activated'
  | 'onSentToPile'
  | 'pileActivated'
  | 'combatHit'
  | 'unimplemented';

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
  /** For `onSentToPile` / `pileActivated` triggers: which pile the trigger
   *  concerns (Graveyard or Replen). Undefined for other triggers. */
  pile?: PileKind;
  /** True when a `combatHit` effect is OPTIONAL — the player is prompted yes/no
   *  when it triggers (e.g. Bunker Busting Round's "you can"). Mandatory combat
   *  triggers (e.g. Hidden Finisher) leave this undefined. */
  optional?: boolean;
}
