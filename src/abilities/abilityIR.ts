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

/**
 * Which Heroes a clause refers to, relative to the ability's controller. Built
 * from v3 noun phrases, e.g.:
 *  - `all "Echo" Heroes you control`        → { side: 'ally', family: 'Echo' }
 *  - `all Coalition Recon Heroes you control` → { side: 'ally', allegiance, subType }
 *  - `other "Zero" Heroes you control`      → { side: 'ally', family, excludeSelf }
 *  - `enemy Heroes`                         → { side: 'enemy' }
 *  - `this Hero`                            → { side: 'ally', self: true }
 * Quoted words (`family`) match as a substring of the card name, so both
 * archetypes ("Echo") and exact cards ("Drone Scout") use the same field.
 */
export interface HeroSelector {
  side: 'ally' | 'enemy';
  /** "this Hero" — only the ability's own card (or, for Equipment, its bearer). */
  self?: boolean;
  /** "other" / "another" — every match except the ability's own card. */
  excludeSelf?: boolean;
  family?: string;
  allegiance?: string;
  subType?: string;
}

/** A continuous stat modifier: "<selector> gain(s) +N STAT" (or "have -N STAT"
 *  for enemy debuffs). `amount` is signed. */
export interface StatAuraEffect {
  kind: 'statAura';
  stat: AuraStat;
  amount: number;
  target: HeroSelector;
}

/** "<selector> cannot be targeted for attacks." Parsed; not yet enforced. */
export interface UntargetableEffect {
  kind: 'untargetable';
  target: HeroSelector;
}

/** "enemy Heroes can only target this Hero for attacks, if able." Parsed; not
 *  yet enforced. */
export interface ForceTargetEffect {
  kind: 'forceTarget';
}

/** A rule restricting the opponent's Ability Card play. Parsed; not yet
 *  enforced. */
export interface OpponentRestrictionEffect {
  kind: 'opponentRestriction';
  restriction: 'noContinuousAbilityCards' | 'abilityCardsPerTurn';
  max?: number;
}

/** An activated self-buff: "this Hero gains +N STAT" applied to the ability's
 *  own card when the player triggers it. Persists while the Hero is on the field. */
export interface SelfStatBuffEffect {
  kind: 'selfStatBuff';
  stat: AuraStat;
  amount: number;
}

/** An activated buff applied to a chosen target: "select another <sub> Hero you
 *  control; that Hero gains +N STAT". The buff persists while that Hero stays on
 *  the field. */
export interface TargetStatBuffEffect {
  kind: 'targetStatBuff';
  stat: AuraStat;
  amount: number;
  target: HeroSelector;
}

/** "select 1 Hero you control; that Hero recovers N HP" — heal a chosen Hero,
 *  capped at its effective max HP. */
export interface HealTargetEffect {
  kind: 'healTarget';
  amount: number;
  target: HeroSelector;
}

/** "select 1 <Hero|Equipment card> in your GY and send it to Replen". */
export interface RecoverFromGraveyardEffect {
  kind: 'recoverFromGraveyard';
  /** Card type to pick: A = Hero, C = Equipment. */
  cardType: 'A' | 'C';
}

/** "this Hero's Armor Bars cannot be reduced" (Shell Up). Parsed only. */
export interface ArmorBarsLockEffect {
  kind: 'armorBarsLock';
}

/** "select 1 enemy Hero; Heroes you control gain +N STAT when attacking that
 *  Hero" (Holo-Target). Parsed only. */
export interface MarkEnemyEffect {
  kind: 'markEnemy';
  stat: AuraStat;
  amount: number;
}

/** "select up to N enemy Heroes; those Heroes have -M STAT" (Heavy
 *  Suppression). Parsed only. */
export interface EnemyStatDebuffEffect {
  kind: 'enemyStatDebuff';
  stat: AuraStat;
  amount: number;
  maxTargets: number;
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

/** Conditions on a combat hit that must ALL hold for an `instantEliminate`. */
export interface EliminateGate {
  /** "against a Normal Hero" — target level ≤ 2. */
  targetNormal?: boolean;
  /** "with less than half HP" — checked before this hit's damage. */
  targetBelowHalfHp?: boolean;
  /** "rolls a Critical Hit". */
  critOnly?: boolean;
  /** "against a target with no Armor Bars" — checked before this hit. */
  targetNoArmorBars?: boolean;
}

/** Eliminate the target Hero instantly, ignoring its armor and Armor Bars
 *  (`combatHit`, mandatory). Hidden Finisher: Normal Hero under half HP;
 *  Headhunter: Critical Hit against a target with no Armor Bars. */
export interface InstantEliminateEffect {
  kind: 'instantEliminate';
  gate: EliminateGate;
}

/** "This Hero's Hits ignore Armor Bars." (Anvil) — passive combat modifier: the
 *  hit skips the target's Armor Bars (they are neither consumed nor absorb). */
export interface IgnoreArmorBarsEffect {
  kind: 'ignoreArmorBars';
}

/** Fallback for ability text no rule models yet. Inert at runtime. */
export interface UnimplementedEffect {
  kind: 'unimplemented';
}

export type AbilityEffect =
  | StatAuraEffect
  | UntargetableEffect
  | ForceTargetEffect
  | OpponentRestrictionEffect
  | SelfStatBuffEffect
  | TargetStatBuffEffect
  | HealTargetEffect
  | RecoverFromGraveyardEffect
  | ArmorBarsLockEffect
  | MarkEnemyEffect
  | EnemyStatDebuffEffect
  | DrawEffect
  | ReturnSelfToHandEffect
  | BreakAllArmorBarsEffect
  | InstantEliminateEffect
  | IgnoreArmorBarsEffect
  | UnimplementedEffect;

/** A pile a card can be sent to / activate from. */
export type PileKind = 'graveyard' | 'replen';

/** A cost the player must pay to trigger an activated ability (the clause before
 *  the colon in "you can <cost>: <effect>"). */
export type AbilityCost =
  /** "send N card from your Hand to Replen" */
  | { kind: 'sendHandToReplen'; count: number }
  /** "discard N card [from your Hand]" — Hand → GY */
  | { kind: 'discardHand'; count: number }
  /** "send N card from your Replen to the GY" */
  | { kind: 'sendReplenToGraveyard'; count: number }
  /** "discard the top card of your Deck" — Deck → GY */
  | { kind: 'discardDeckTop'; count: number }
  /** "destroy 1 other Hero you control" */
  | { kind: 'destroyOtherAlly' }
  /** "destroy this Hero" */
  | { kind: 'destroySelf' };

/** How long a one-shot activated effect lasts. */
export type AbilityDuration = 'endOfTurn' | 'opponentNextTurn';

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

/** "While you control <selector>" — at least one Hero on the controller's field
 *  matches the selector. */
export interface ControlsCondition {
  kind: 'controls';
  selector: HeroSelector;
}

/** "While this Hero is equipped with a [<"Family">] <Class> [or <Class>] <SubType>"
 *  — checks the Equipment in this Hero's linked C slot. */
export interface EquippedCondition {
  kind: 'equipped';
  /** Equipment sub-type: Weapon / Armor / Loadout. */
  subType: string;
  /** Allowed weapon classes (any-of), e.g. ["Suppressive", "Assault"]. */
  weaponClasses?: string[];
  /** Quoted name fragment, e.g. "Drone". */
  family?: string;
}

/** "While equipped to a <selector>" — on an Equipment card: its bearer must
 *  match the selector. */
export interface EquippedToCondition {
  kind: 'equippedTo';
  selector: HeroSelector;
}

export type AbilityCondition = ControlsCondition | EquippedCondition | EquippedToCondition;

/** An extra clause joined with "; while …" that adds to the main effect (e.g.
 *  "this Hero gains an additional +10 ACC"). It applies only when BOTH the main
 *  ability's conditions and the rider's own conditions hold. */
export interface AbilityRider {
  conditions: AbilityCondition[];
  effect: AbilityEffect;
}

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
  /** Limited lifetime of an activated effect ("until the end of your turn",
   *  "during your opponent's next turn"). Undefined = persists while on field. */
  duration?: AbilityDuration;
  /** For `onSentToPile` / `pileActivated` triggers: which pile the trigger
   *  concerns (Graveyard or Replen). Undefined for other triggers. */
  pile?: PileKind;
  /** True when a `combatHit` effect is OPTIONAL — the player is prompted yes/no
   *  when it triggers (e.g. Bunker Busting Round's "you can"). Mandatory combat
   *  triggers (e.g. Hidden Finisher) leave this undefined. */
  optional?: boolean;
  /** Conditions that must ALL hold for a passive effect to apply ("While …"). */
  conditions?: AbilityCondition[];
  /** Additional "; while …" clauses layered on the main effect. */
  riders?: AbilityRider[];
  /** True when the line lives on an Equipment card: "this Hero" then means the
   *  Hero the Equipment is attached to. */
  fromEquipment?: boolean;
}
