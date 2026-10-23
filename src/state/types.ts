/**
 * Phase 2 domain types. Pure data — no Three.js, no React.
 * Kept normalized and serializable so future phases (real card data, rules,
 * networking) can extend without reshaping the core.
 */

/** Card/slot type. Phase 2 introduces three typed families: A, B, C. */
export type CardType = 'A' | 'B' | 'C';

/** Card rarity tier, ordered common -> legendary. Drives the panel's accent. */
export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

/** The three combat stats a Hero carries. */
export type StatKey = 'hp' | 'dmg' | 'acc';

/**
 * A B-card's on-play ability id. Indexes the Phase 8 ability registry
 * (`ABILITY_REGISTRY` in `abilities.ts`), which holds the structured timing,
 * activation and effect data. Enacted the moment the card is set in a B slot.
 */
export type BAbilityId = string;

/** Slot column index within a type family (1-based, 4 per family). */
export type SlotIndex = 1 | 2 | 3 | 4;

/** The five sequential phases of a turn. Battle declares attacks; Resolution
 * rolls the dice for them. */
export type Phase = 'draw' | 'main' | 'battle' | 'resolution' | 'end';

/** Phases in the order they advance within a turn. */
export const PHASE_ORDER: readonly Phase[] = ['draw', 'main', 'battle', 'resolution', 'end'];

/** Short display label per phase (shown in the HUD indicator + banner). */
export const PHASE_LABEL: Record<Phase, string> = {
  draw: 'Draw',
  main: 'Main',
  battle: 'Battle',
  resolution: 'Resolution',
  end: 'End',
};

export type CardId = string;

/**
 * Slot identifier: a type family + column index, e.g. `A1`..`A4`, `B1`..`B4`,
 * `C1`..`C4`. The leading letter IS the slot's accepted card type.
 */
export type SlotId = `${CardType}${SlotIndex}`;

/** The card type a slot accepts is encoded in its id's first character. */
export function slotType(slotId: SlotId): CardType {
  return slotId[0] as CardType;
}

/**
 * Opponent Vanguard slot identifier (far row). Four columns, O1..O4. The
 * opponent only fields A-type cards in this simulation, so these have no
 * type-letter prefix like the player's typed slots.
 */
export type OppSlotId = 'O1' | 'O2' | 'O3' | 'O4';

/**
 * Opponent Arcane (B) slot identifier — the opponent's spell/support row.
 * Phase 7: the opponent is a full second player and fields its own B cards.
 */
export type OppBSlotId = 'OB1' | 'OB2' | 'OB3' | 'OB4';

/**
 * Opponent Bulwark (C) slot identifier — the opponent's support/boost row,
 * column-linked to its Vanguard row (OC1 equips O1, etc.). Phase 7.
 */
export type OppCSlotId = 'OC1' | 'OC2' | 'OC3' | 'OC4';

/**
 * A card's full combat profile (Phase 3). Every card carries display + combat
 * data even though the rules that consume ATK/DEF/effect land in later slices.
 */
export interface Card {
  id: CardId;
  type: CardType;
  /** Display name shown on the card and in the inspection panel. */
  name: string;
  /** Deploy cost (flavor for now; a resource system comes later). */
  cost: number;
  /** Summon level (1–3). Only A (Vanguard) cards carry one. Levels 1–2 set
   * freely into any open A slot; a level-3 requires tributing board A-cards whose
   * levels sum to exactly 3 (see the tribute-summon flow). */
  level?: number;
  /** Commander A-cards use the level-3 tribute rules (materials must sum to 3),
   * but the tributed materials are sent to the GRAVEYARD instead of the replen
   * pile. Only meaningful for A cards. */
  commander?: boolean;
  /** Hero role (Phase 8): Infantry / Recon / Heavy / Engineer / Medic. Only A
   * (Hero) cards carry one. Drives future subtype-scoped abilities. */
  subType?: string;
  /** Faction the Hero fights for (Phase 8), e.g. "Coalition". Only A cards. */
  allegiance?: string;
  /** Weapon class of an Equipment (C) card, e.g. "Assault" / "Precision" /
   * "Suppressive" / "Breach". Only Weapon-subtype Equipment carry one. Data only
   * for now; consumed by weapon-scoped abilities in a later slice. */
  weaponClass?: string;
  /** Play-window of an Ability (B) card: "Main" / "Battle" / "Cont." — gates WHEN
   * the card may be activated. Data only for now. Only B cards carry one. */
  timing?: string;
  /** Flat armor value (Phase 8) — a damage-reduction stat layered under HP.
   * Only A (Hero) cards carry one; the combat engine that consumes it lands in a
   * later slice. */
  armor?: number;
  /** Armor Bars (Phase 8) — discrete armor segments some Heroes carry on top of
   * flat Armor. Only A cards; mechanics arrive in a later slice. */
  armorBars?: number;
  /** Whether only one copy of this Hero may be fielded (Phase 8 "Unique" flag).
   * Only A cards. */
  unique?: boolean;
  /** Up to three ability rules-text lines (Phase 8). Only A (Hero) cards carry
   * these. Text only for now — the timing/dispatch engine lands in a later
   * slice. */
  abilities?: string[];
  /** Damage dealt on a normal hit (base-10). Only A (Vanguard) cards carry
   * combat stats. Scaled by the Resolution roll (glancing ×0.5, crit ×2). */
  dmg?: number;
  /** Accuracy (base-10, ≤200). Only A (Vanguard) cards carry combat stats.
   * Sets the hit/miss thresholds on the d20 (threshold = acc / 10). */
  acc?: number;
  /** Max health. Only A (Vanguard) cards carry combat stats. The floating
   * A-zone stat bar reads current/max from here; combat (a later slice) will
   * track a separate current-HP value. */
  hp?: number;
  rarity: Rarity;
  /** Rules text — what the card does. */
  effect: string;
  /** Non-mechanical flavor line. */
  flavor: string;
  /**
   * On-play ability. Only B (Arcane) cards carry one; enacted when the card is
   * set in a B slot. Absent for A/C cards.
   */
  ability?: BAbilityId;
  /**
   * Continuous B cards stay on the field through the End phase instead of being
   * sent to the graveyard. Only meaningful for B cards.
   */
  continuous?: boolean;
}

/** Plain 3-tuple position/rotation, decoupled from THREE.Vector3. */
export type Vec3 = [number, number, number];

/** A visual target pose derived from state by the layout/pose math. */
export interface Pose {
  position: Vec3;
  /** Euler rotation in radians. */
  rotation: Vec3;
}

export type DragOrigin = 'hand';

/** A browsable pile whose cards can be listed in the search pop-up. */
export type PileSource = 'deck' | 'graveyard' | 'replen' | 'opponentGraveyard' | 'opponentReplen';

export interface DragState {
  cardId: CardId;
  origin: DragOrigin;
  /** Pointer projected onto the board drag plane. */
  projectedPoint: Vec3;
  hoveredSlotId: SlotId | null;
}

/**
 * Transient "summon reveal" state. When a card is successfully set into a slot
 * it first pops up large and centered over the field (with a ripple), then flies
 * down into its slot. Purely visual: the card is already placed on the board;
 * this only redirects its pose to the showcase for a brief window.
 */
export interface SummonState {
  cardId: CardId;
  slotId: SlotId;
}

/**
 * A transient activated-ability showcase: the owning Hero pops to the center of
 * the field with an amber ripple to signal the ability fired, then springs back
 * to its slot. Purely visual; cleared after a short window.
 */
export interface AbilityShowcase {
  cardId: CardId;
  abilityName: string;
}

/**
 * An in-progress activated ability that needs player selection to resolve (e.g.
 * Quick Reload). The player first pays the cost (`step: 'cost'` — pick a Hand
 * card to send to Replen), then picks the target (`step: 'target'` — an ally
 * Hero to buff). The staged cost card is not spent until the target is chosen,
 * so cancelling at either step reverts cleanly. Null when no ability is
 * mid-resolution.
 */
export interface AbilityTargeting {
  sourceCardId: CardId;
  abilityIndex: number;
  abilityName: string;
  step: 'cost' | 'target';
  /** Hand card staged for the cost during the `target` step; null while still
   *  on the `cost` step (or for costless abilities). */
  costCardId: CardId | null;
}

/**
 * A pending on-sent pile ability awaiting the player's yes/no decision. Set when
 * a Hero with a "when sent to <pile>" trigger has just landed in that pile; the
 * player is asked whether to use it. Resolved by `resolveAbilityPrompt`. Null
 * when no such prompt is showing.
 */
export interface AbilityPrompt {
  cardId: CardId;
  abilityIndex: number;
  abilityName: string;
}

/**
 * A paused Resolution awaiting the player's yes/no on Snow Viper's Bunker Busting
 * Round. Raised mid-combat when the attacker lands a Successful Hit on a target
 * that still has ≥1 Armor Bar and the ability is unused this turn (and Hidden
 * Finisher did not already eliminate the target). While set, the combat loop is
 * suspended: accepting wipes all bars / deals no damage, declining applies normal
 * armor math; either way Resolution resumes with the remaining attackers.
 */
export interface CombatPrompt {
  /** The attacker's A-slot. */
  sourceSlot: SlotId;
  /** The struck opponent's A-slot. */
  targetSlot: OppSlotId;
  /** The attacker Hero's card id (owns Bunker Busting). */
  sourceCardId: CardId;
  /** The struck Hero's card id. */
  targetCardId: CardId;
  /** Ability name for the prompt header, e.g. "Bunker Busting Round". */
  abilityName: string;
}

/**
 * A pending level-3 tribute summon. Set when the player drops a level-3+ A card
 * while enough board A-cards exist to tribute: the card is held in hand and the
 * material-selection modal opens. Confirming the materials sends them (plus their
 * linked C-cards) to the replen pile (or graveyard for Commanders) and then hands
 * off to a {@link PendingSummon} slot-selection step; cancel leaves the card in hand.
 */
export interface PendingTribute {
  cardId: CardId;
}

/**
 * A level-3+ summon whose materials have already been consumed and which now
 * awaits the player choosing an open A slot to place it (materials free up
 * slots, so this step happens AFTER the tribute). While set, open A slots light
 * gold and clicking one summons the card there.
 */
export interface PendingSummon {
  cardId: CardId;
  /** Replen Set (materials → Replen) or Commit Set (materials → GY). */
  setKind?: 'replen' | 'commit';
  /** Number of materials used, for "up to the number of materials" effects. */
  materials?: number;
  /** The materials satisfied a "can attack during the turn this Hero is Set"
   *  ability (Shock Deployment). */
  setTurnAttack?: boolean;
}

/**
 * An On-Set ability awaiting the player's pick (e.g. Field Disruption: select 1
 * enemy Equipment; Reclaim Ops: select 1 Ability Card in the GY). The ability
 * is optional, so the player may also skip. Null when no such choice is open.
 */
export interface OnSetChoice {
  sourceCardId: CardId;
  abilityIndex: number;
  abilityName: string;
  /** Legal picks (player or opponent card ids). */
  options: CardId[];
}

/**
 * An Ability (B) card's mandatory Hand cost awaiting the player's pick (e.g.
 * Convoy Incoming: "Send 1 card from your Hand to the GY"). The rest of the
 * spell resolves once the cost is paid. Null when no cost pick is open.
 */
/** A mid-resolution B-card spell step awaiting the player's mandatory pick.
 *  `reveal`: pick 1 of the revealed eligible cards for the Hand (the rest of
 *  `revealed` go to the step's pile). `equipAlly`: pick the ally Hero to equip. */
export interface SpellChoice {
  sourceCardId: CardId;
  stepIndex: number;
  kind: 'reveal' | 'equipAlly';
  prompt: string;
  options: CardId[];
  /** `reveal` only: every card taken off the top of the Deck. */
  revealed?: CardId[];
}

export interface SpellCostChoice {
  sourceCardId: CardId;
  to: 'graveyard' | 'replen';
  /** Hand cards that can pay the cost. */
  options: CardId[];
}

/**
 * Transient D20 dice-roll state. The `value` is chosen immediately when the roll
 * starts; the animation merely reveals it. `rolling` is true while the die
 * tumbles and false once it has settled on `value`.
 */
export interface DiceState {
  value: number;
  rolling: boolean;
}

/** How a Resolution d20 roll landed against a card's accuracy. */
export type RollOutcome = 'glancing' | 'normal' | 'miss' | 'crit';

/** The resolved combat result of one attacker's Resolution roll. */
export interface RollResult {
  /** The d20 face (1-20). */
  roll: number;
  outcome: RollOutcome;
  /** Damage this roll deals (DMG scaled by the outcome; 0 on a miss). */
  damage: number;
}

export interface GameState {
  cardsById: Record<CardId, Card>;
  /** Ordered stack; the top of the deck is the LAST element. */
  deck: CardId[];
  /** Ordered left-to-right; drives the hand fan layout. */
  hand: CardId[];
  board: Record<SlotId, CardId | null>;
  /** Discard pile, in the order cards were sent (last = top of the stack). */
  graveyard: CardId[];
  /** Replenish pile (no mechanic yet); searchable like the deck/graveyard. */
  replen: CardId[];
  /** True while the deck is mid-shuffle (cards split into two piles then
   * collapse). Purely visual; drives the spread pose in the animation layer. */
  deckSpread: boolean;
  dragging: DragState | null;
  /** Hand card currently under the pointer (raised for selection), or null. */
  hoveredCardId: CardId | null;
  /** Card whose expanded detail view is open (hand or board), or null. */
  selectedCardId: CardId | null;
  /** Pile whose search pop-up is open (opened by a dev button or by clicking
   * the pile on the board), or null when no pop-up is showing. */
  pileSearch: PileSource | null;
  /** Card currently playing its summon-reveal (showcased over the field before
   * flying to its slot), or null. Purely visual and transient. */
  summon: SummonState | null;
  /** An activated ability currently playing its showcase (the owning card pops to
   * center with the amber ripple), or null. Purely visual and transient. */
  abilityShowcase: AbilityShowcase | null;
  /** An activated ability mid-resolution awaiting cost/target selection, or null. */
  abilityTargeting: AbilityTargeting | null;
  /** A just-sent Hero's on-sent pile ability awaiting the player's yes/no
   *  decision, or null. */
  abilityPrompt: AbilityPrompt | null;
  /** An On-Set ability awaiting the player's card pick (or skip), or null. */
  onSetChoice: OnSetChoice | null;
  spellCost: SpellCostChoice | null;
  /** Turn number each on-field Hero (either side) was Set on. A Hero may only
   *  attack on its Set turn if a Weapon is equipped to it (or `setTurnAttack`). */
  heroSetTurn: Record<CardId, number>;
  /** Heroes whose Set satisfied an "attack during the turn this Hero is Set"
   *  ability (Goliath's Shock Deployment). */
  setTurnAttack: Record<CardId, true>;
  /** Counters on field cards (either side). Removed when the card leaves. */
  counters: Record<CardId, number>;
  /** An optional counter-threshold ability awaiting the player's yes/no
   *  (Devil Dog Reinforcement), or null. */
  counterPrompt: { cardId: CardId; abilityName: string } | null;
  /** Stat debuffs the player placed on enemy Heroes that last through the
   *  opponent's next turn (Heavy Suppression). */
  enemyStatDebuffs: Record<CardId, Partial<Record<StatKey, number>>>;
  /** Player Hero enemy attacks must target during the opponent's next turn, if
   *  able (Iron Wall), or null. */
  forcedTarget: CardId | null;
  /** A B-card spell paused on a pick (reveal / equip target), or null. */
  spellChoice: SpellChoice | null;
  /** Player Heroes destroyed/eliminated on the field, with the turn it happened
   *  (Man Down! checks "last turn"). */
  playerHeroLosses: { cardId: CardId; turn: number }[];
  /** A paused Resolution awaiting the player's yes/no on Snow Viper's Bunker
   *  Busting Round, or null when combat is not paused for it. */
  combatPrompt: CombatPrompt | null;
  /** The attacker A-slots still to resolve after a Bunker Busting pause, or null
   *  when Resolution is not mid-pause. Consumed by `resolveCombatPrompt`. */
  pendingCombatQueue: SlotId[] | null;
  /** An in-progress level-3 tribute summon awaiting material selection, or null.
   * While set, the material-selection modal is open and the card sits in hand. */
  pendingTribute: PendingTribute | null;
  /** A level-3+ summon awaiting slot selection: its tribute materials are already
   * consumed and the player must click an open A slot to place it. Null when no
   * such summon is in progress. */
  pendingSummon: PendingSummon | null;
  /** Current turn number (1-based). Increments on every turn handoff — the
   * player takes odd turns, the opponent even turns (Phase 7). */
  turn: number;
  /** Whose turn it is. The player always goes first; after the player's End the
   * opponent auto-plays a full turn, then control returns to the player. Drives
   * the field-border turn highlight and gates player interaction (Phase 7). */
  activePlayer: 'player' | 'opponent';
  /** The active phase within the current turn. */
  phase: Phase;
  /** Monotonic counter bumped on every phase entry. Drives the phase-transition
   * banner: the announcement re-plays whenever this changes. */
  phaseAnnounce: number;
  /** The opponent's Vanguard (A) cards for this simulation, keyed by card id.
   * Separate from `cardsById` so the player's deck/hand/graveyard machinery is
   * untouched. Pre-seeded across the far row; the target of the player's attacks. */
  opponentCards: Record<CardId, Card>;
  /** Which opponent A-card occupies each far-row slot (O1..O4), or null. A card
   * whose HP hits 0 is removed (set to null) — it slashes and vanishes. */
  opponentBoard: Record<OppSlotId, CardId | null>;
  /** Opponent cards that have been destroyed (HP hit 0), oldest first. They
   * travel from their slot to the mirrored opponent graveyard pile so the death
   * reads as a move, not a vanish (mirrors the player's graveyard). */
  opponentGraveyard: CardId[];
  /** The opponent's draw pile (Phase 7). Top of the deck is the LAST element,
   * mirroring the player's `deck`. Seeded with a full 13-card deck so the
   * opponent can summon its own Vanguard/Arcane/Bulwark cards on its turn. */
  opponentDeck: CardId[];
  /** The opponent's hand (Phase 7). Held face-down; a card reveals via the
   * summon showcase as it hits the field. Ordered left-to-right. */
  opponentHand: CardId[];
  /** The opponent's replenish pile (Phase 7), mirroring the player's `replen`. */
  opponentReplen: CardId[];
  /** The opponent's Arcane (B) row (Phase 7): which card occupies each OB slot,
   * or null. Mirrors the player's B slots on the opponent's side of the field. */
  opponentBBoard: Record<OppBSlotId, CardId | null>;
  /** The opponent's Bulwark (C) row (Phase 7): which card occupies each OC slot,
   * or null. Column-linked to the opponent Vanguard row. */
  opponentCBoard: Record<OppCSlotId, CardId | null>;
  /** Attack declarations made during Battle: each of the player's attacking
   * A-slots mapped to the opponent slot it is aiming at. An A-card attacks only
   * if it has an entry here; its rolled damage lands on that target. Cleared at
   * End. Multiple sources may point at the same opponent slot. */
  attackTargets: Partial<Record<SlotId, OppSlotId>>;
  /** The player's A-slot currently "aiming" (awaiting a target click) during
   * Battle, or null. While set, the opponent row is selectable as the target. */
  targeting: SlotId | null;
  /** Live board-plane point the aiming arrow's tip follows while `targeting` is
   * set (updated as the pointer moves during Battle), or null. Lets the arrow
   * rubber-band from the attacker to the cursor until a target is locked. */
  aimPoint: Vec3 | null;
  /** Active per-attacker D20 rolls during the Resolution phase, keyed by the
   * attacking A-slot id. Each die is shown over that card's A/C link area. Empty
   * outside Resolution. */
  resolutionRolls: Record<string, DiceState>;
  /** The most recent Resolution results absorbed into the engine, keyed by
   * A-slot id (1..20). Unused by rules for now; kept for later Battle logic. */
  lastRolls: Record<string, number>;
  /** The resolved combat outcome per attacker for the current Resolution (hit
   * type + damage), keyed by the attacking A-slot id. Shown over each die once it
   * settles; cleared entering End. */
  resolutionResults: Record<string, RollResult>;
  /** Outcome-announcement pop-ups, keyed by the attacking A-slot id. Populated
   * the instant the dice disappear so a big HIT / MISS / GLANCING / CRITICAL
   * label pops in above each of YOUR attackers, then self-clears. */
  outcomePopups: Record<string, RollResult>;
  /** Aggregated incoming damage per opponent slot for the current Resolution
   * (summed across every attacker aiming at it), keyed by opponent slot id.
   * Drives the red `-{n}` pop-up over each damaged opponent card. Cleared with
   * the dice/outcome pop-ups. */
  damagePopups: Partial<Record<OppSlotId, number>>;
  /** Current HP per card, keyed by card id (opponent cards in this sim). A card
   * absent from this map is at full health (its max HP); an entry is written the
   * first time the card takes damage. Drives the animated HP bar fill + color. */
  currentHp: Record<CardId, number>;
  /** Current Armor Bars per card, keyed by card id. A card absent from this map
   * still has all its bars (its `armorBars` stat); an entry is written the first
   * time a bar is consumed. Bars absorb a full hit then break (see armorCombat)
   * and do not regenerate during the duel. */
  currentArmorBars: Record<CardId, number>;
  /** Persistent stat buffs granted by a Hero's own activated abilities (Phase 8),
   * keyed by card id then stat. Folded into `effectiveStats` on top of base /
   * C-buff / aura, and cleared when the card leaves the field. Player-only. */
  activatedStatBuffs: Record<CardId, Partial<Record<StatKey, number>>>;
  /** Stat buffs from activated abilities that last "until the end of your
   * turn" (e.g. Wasteland Deadeye). Folded into `effectiveStats` like
   * `activatedStatBuffs`, and wiped when the player's turn ends. */
  turnStatBuffs: Record<CardId, Partial<Record<StatKey, number>>>;
  /** Activated ability names each card has already used this turn (once-per-turn
   * gate), keyed by card id. Reset at the start of the player's turn. */
  usedActivatedAbilities: Record<CardId, string[]>;
  /** Opponent slots whose card is being destroyed this Resolution (HP hit 0).
   * Set the instant lethal damage is applied and cleared when the cards vanish;
   * drives the red slash destruction FX drawn over each doomed opponent card. */
  destroying: OppSlotId[];

  /* --- Phase 7: opponent-as-attacker combat (mirror of the player fields
   * above, populated only during the opponent's turn). --- */
  /** Opponent attacker O-slot -> the player A-slot it is striking this turn. */
  oppAttackTargets: Partial<Record<OppSlotId, SlotId>>;
  /** Opponent Resolution D20 rolls, keyed by the attacking O-slot. */
  oppResolutionRolls: Record<string, DiceState>;
  /** Opponent Resolution results, keyed by the attacking O-slot. */
  oppResolutionResults: Record<string, RollResult>;
  /** Outcome-announcement word over each opponent attacker, keyed by O-slot. */
  oppOutcomePopups: Record<string, RollResult>;
  /** Aggregated incoming damage per struck player A-slot (summed across every
   * opponent attacker aiming at it), keyed by player A-slot id. */
  oppDamagePopups: Partial<Record<SlotId, number>>;
  /** Player A-slots whose card the opponent is destroying this Resolution (HP
   * hit 0); drives the red slash FX over the doomed player card. */
  oppDestroying: SlotId[];
  /** An in-progress opponent summon reveal (Phase 7 Slice 4): the card the
   * opponent just set and the O-slot it landed on. While set, that card is
   * showcased face-up center-screen (its "reveal") before it springs down to
   * its slot; self-clears after the showcase. Null when the opponent isn't
   * mid-summon. */
  oppSummon: { cardId: CardId; slotId: OppSlotId | OppBSlotId | OppCSlotId } | null;
}
