/**
 * Ability text parser (Phase 8). Turns a Hero's rules-text line into an
 * `AbilityIR` node using a small table of grammar rules. This is a CONTROLLED
 * grammar — it matches the consistent sentence shapes the set is authored in,
 * not free English. Anything no rule recognizes returns an `unimplemented`
 * node so the card still displays and future slices can add a rule for it.
 *
 * Adding support for a new ability pattern = add one entry to `RULES`.
 */

import type {
  AbilityCondition,
  AbilityConstraint,
  AbilityCost,
  AbilityDuration,
  AbilityEffect,
  AbilityIR,
  AbilityRider,
  EliminateGate,
  AuraStat,
  HeroSelector,
  SetKind,
} from './abilityIR';

/** Rules-text stat words → IR stat keys. */
const STAT_WORD: Record<string, AuraStat> = {
  ACC: 'acc',
  DMG: 'dmg',
  HP: 'hp',
  ARMOR: 'armor',
};

/** A parse rule: given the ability BODY (text after the name colon), return the
 *  IR, or null when the rule does not apply. */
interface ParseRule {
  parse: (body: string, name: string, raw: string) => AbilityIR | null;
}

/** Adapt a single whole-sentence regex + builder into a {@link ParseRule}. */
function regexRule(
  match: RegExp,
  build: (m: RegExpMatchArray, name: string, raw: string) => AbilityIR,
): ParseRule {
  return {
    parse: (body, name, raw) => {
      const m = body.match(match);
      return m ? build(m, name, raw) : null;
    },
  };
}

// ---------------------------------------------------------------------------
// v3 clause sub-parsers. Each turns one fragment of a sentence into IR, or
// returns null so the caller can fall through to the `unimplemented` node.
// ---------------------------------------------------------------------------

const ALLEGIANCES = 'Coalition|Dictate';
const HERO_SUBTYPES = 'Infantry|Recon|Heavy|Engineer|Medic';

const SELECTOR_RE = new RegExp(
  '^(all|other|another|a|an)?\\s*(enemy)?\\s*' +
    '(?:"([^"]+)"\\s*)?' +
    `(?:(${ALLEGIANCES})\\s+)?` +
    `(?:(${HERO_SUBTYPES})\\s+)?` +
    '(Heroes|Hero)?(\\s+you control)?$',
  'i',
);

/**
 * Parse a Hero noun phrase ("all "Echo" Heroes you control", "enemy Heroes",
 * "another Coalition Hero", "this Hero", ""Drone Scout"") into a selector.
 */
export function parseSelector(phrase: string): HeroSelector | null {
  const p = phrase.trim();
  if (/^this Hero$/i.test(p)) return { side: 'ally', self: true };
  const m = p.match(SELECTOR_RE);
  if (!m) return null;
  const [, quant, enemy, family, allegiance, subType, heroWord] = m;
  // A bare quoted name ("Drone Scout") is fine; otherwise the Hero noun is required.
  if (!heroWord && !family) return null;
  const sel: HeroSelector = { side: enemy ? 'enemy' : 'ally' };
  if (quant && /^(other|another)$/i.test(quant)) sel.excludeSelf = true;
  if (family) sel.family = family;
  if (allegiance) sel.allegiance = allegiance;
  if (subType) sel.subType = subType;
  return sel;
}

/** Parse the condition of a "While <condition>, …" clause. Returns `[]` for the
 *  always-true "this Hero is on your field", null when unrecognized. */
export function parseCondition(text: string): AbilityCondition[] | null {
  const t = text.trim();
  if (/^this Hero is on your field$/i.test(t)) return [];

  const controls = t.match(/^you control (.+)$/i);
  if (controls) {
    const selector = parseSelector(controls[1]);
    return selector ? [{ kind: 'controls', selector }] : null;
  }

  const equipped = t.match(
    /^this Hero is equipped with an? (?:"([^"]+)"\s+)?((?:\w+)(?:\s+or\s+\w+)*\s+)?(Weapon|Armor|Loadout)$/i,
  );
  if (equipped) {
    const cond: AbilityCondition = { kind: 'equipped', subType: equipped[3] };
    if (equipped[1]) cond.family = equipped[1];
    if (equipped[2]) cond.weaponClasses = equipped[2].trim().split(/\s+or\s+/i);
    return [cond];
  }

  const equippedTo = t.match(/^equipped to an? (.+)$/i);
  if (equippedTo) {
    const selector = parseSelector(equippedTo[1]);
    return selector ? [{ kind: 'equippedTo', selector }] : null;
  }
  return null;
}

/** Parse a continuous effect phrase (no trailing period). */
export function parseContinuousEffect(text: string): AbilityEffect | null {
  const t = text.trim();

  const stat = t.match(/^(.+?) (?:gains?|ha(?:ve|s)) (?:an additional )?([+-]?)(\d+)\s*(ACC|DMG|HP|Armor)$/i);
  if (stat) {
    const target = parseSelector(stat[1]);
    if (!target) return null;
    const sign = stat[2] === '-' ? -1 : 1;
    return { kind: 'statAura', stat: STAT_WORD[stat[4].toUpperCase()], amount: sign * Number(stat[3]), target };
  }

  const untargetable = t.match(/^(.+?) cannot be targeted for attacks$/i);
  if (untargetable) {
    const target = parseSelector(untargetable[1]);
    return target ? { kind: 'untargetable', target } : null;
  }

  if (/^enemy Heroes can only target this Hero for attacks, if able$/i.test(t)) {
    return { kind: 'forceTarget' };
  }
  if (/^your opponent cannot activate Continuous Ability Cards$/i.test(t)) {
    return { kind: 'opponentRestriction', restriction: 'noContinuousAbilityCards' };
  }
  const perTurn = t.match(/^your opponent can only play (\d+) Ability Cards? per turn$/i);
  if (perTurn) {
    return { kind: 'opponentRestriction', restriction: 'abilityCardsPerTurn', max: Number(perTurn[1]) };
  }
  return null;
}

const ONLY_N_ACTIVE_RE = /\s*Only (\d+) "([^"]+)" Ability can be active on your field at once\.$/i;

/**
 * Passive "While <condition>, <effect>[; while <condition>, <effect>]. [Only N
 * "X" Ability can be active on your field at once.]" — the v3 continuous-ability
 * shape (Echo Assist, Zero Assault, Sandstorm Inbound, Dictate Squaddie,
 * Oppressive Fire, Target Acquired, Drone Ops, Ballistic Soak, …).
 *
 * A "; while that Hero is also "X"" rider narrows the main clause's
 * `you control …` selector by family (Target Acquired).
 */
const PASSIVE_WHILE_RULE: ParseRule = {
  parse: (body, name, raw) => {
    let text = body;
    const constraints: AbilityConstraint[] = [];
    const cap = text.match(ONLY_N_ACTIVE_RE);
    if (cap) {
      constraints.push({ kind: 'maxActiveByName', name: cap[2], max: Number(cap[1]) });
      text = text.slice(0, cap.index);
    }
    text = text.trim().replace(/\.$/, '');

    const [head, ...riderTexts] = text.split(/;\s*(?=while\b)/i);
    const main = head.match(/^While (.+?), (.+)$/i);
    if (!main) return null;
    const conditions = parseCondition(main[1]);
    const effect = parseContinuousEffect(main[2]);
    if (!conditions || !effect) return null;

    const riders: AbilityRider[] = [];
    for (const rt of riderTexts) {
      const r = rt.match(/^while (.+?), (.+)$/i);
      if (!r) return null;
      let riderConds: AbilityCondition[] | null;
      const also = r[1].match(/^that Hero is also "([^"]+)"$/i);
      const prev = conditions.find((c) => c.kind === 'controls');
      if (also && prev && prev.kind === 'controls') {
        riderConds = [{ kind: 'controls', selector: { ...prev.selector, family: also[1] } }];
      } else {
        riderConds = parseCondition(r[1]);
      }
      const riderEffect = parseContinuousEffect(r[2]);
      if (!riderConds || !riderEffect) return null;
      riders.push({ conditions: riderConds, effect: riderEffect });
    }

    const ir: AbilityIR = { name, raw, trigger: 'passive', effect, constraints };
    if (conditions.length) ir.conditions = conditions;
    if (riders.length) ir.riders = riders;
    if (conditions.some((c) => c.kind === 'equippedTo')) ir.fromEquipment = true;
    return ir;
  },
};

const DURATION_SUFFIXES: [RegExp, AbilityDuration][] = [
  [/,?\s+until the end of your turn$/i, 'endOfTurn'],
  [/,?\s+during your opponent's next turn$/i, 'opponentNextTurn'],
];

/** Parse the cost clause of "you can <cost>: <effect>". */
export function parseCost(text: string): AbilityCost | null {
  const t = text.trim();
  let m = t.match(/^send (\d+) cards? from your Hand to Replen$/i);
  if (m) return { kind: 'sendHandToReplen', count: Number(m[1]) };
  m = t.match(/^send (\d+) cards? from your Replen to the GY$/i);
  if (m) return { kind: 'sendReplenToGraveyard', count: Number(m[1]) };
  m = t.match(/^discard (\d+) cards?(?: from your Hand)?$/i);
  if (m) return { kind: 'discardHand', count: Number(m[1]) };
  if (/^discard the top card of your Deck$/i.test(t)) return { kind: 'discardDeckTop', count: 1 };
  if (/^destroy 1 other Hero you control$/i.test(t)) return { kind: 'destroyOtherAlly' };
  if (/^destroy this Hero$/i.test(t)) return { kind: 'destroySelf' };
  return null;
}

/** Parse "select <quantity> <selector>" into a selector + max picks. */
function parseSelect(text: string): { target: HeroSelector; max: number } | null {
  const m = text.match(/^select (?:(1|up to (\d+)) )?(.+)$/i);
  if (!m) return null;
  const target = parseSelector(m[3]);
  if (!target) return null;
  return { target, max: m[2] ? Number(m[2]) : 1 };
}

/** Parse the one-shot effect of an activated ability (no trailing period,
 *  duration suffix already stripped). */
export function parseActivatedEffect(text: string): AbilityEffect | null {
  const t = text.trim();

  const self = t.match(/^this Hero gains \+(\d+) (ACC|DMG|HP)$/i);
  if (self) return { kind: 'selfStatBuff', stat: STAT_WORD[self[2].toUpperCase()], amount: Number(self[1]) };

  const gy = t.match(/^(?:you can )?select 1 (Hero|Equipment card) in your GY and send (?:that Hero|it) to Replen$/i);
  if (gy) return { kind: 'recoverFromGraveyard', cardType: /^hero$/i.test(gy[1]) ? 'A' : 'C' };

  if (/^this Hero's Armor Bars cannot be reduced$/i.test(t)) return { kind: 'armorBarsLock' };

  const [selectText, rest] = t.split(/;\s*/, 2);
  if (rest !== undefined) {
    const sel = parseSelect(selectText);
    if (!sel) return null;
    const heal = rest.match(/^that Hero recovers (\d+) HP$/i);
    if (heal && sel.target.side === 'ally') {
      return { kind: 'healTarget', amount: Number(heal[1]), target: sel.target };
    }
    const buff = rest.match(/^that Hero gains \+(\d+) (ACC|DMG|HP)$/i);
    if (buff && sel.target.side === 'ally') {
      return { kind: 'targetStatBuff', stat: STAT_WORD[buff[2].toUpperCase()], amount: Number(buff[1]), target: sel.target };
    }
    const mark = rest.match(/^Heroes you control gain \+(\d+) (ACC|DMG) when attacking that Hero$/i);
    if (mark && sel.target.side === 'enemy') {
      return { kind: 'markEnemy', stat: STAT_WORD[mark[2].toUpperCase()], amount: Number(mark[1]) };
    }
    const debuff = rest.match(/^those Heroes have -(\d+) (ACC|DMG)$/i);
    if (debuff && sel.target.side === 'enemy') {
      return { kind: 'enemyStatDebuff', stat: STAT_WORD[debuff[2].toUpperCase()], amount: -Number(debuff[1]), maxTargets: sel.max };
    }
    return null;
  }

  const continuous = parseContinuousEffect(t);
  return continuous && continuous.kind === 'forceTarget' ? continuous : null;
}

/**
 * Activated "Once per turn, [you can] [<cost>:] <effect>[ <duration>]." The v3
 * player-triggered shape (Quick Reload, Wasteland Deadeye, First Aid Kit,
 * Urgent Treatment, Jackal Reinforcement, Equipment Retrieval, Shell Up, Iron
 * Wall, Armored Aggro, Holo-Target, Heavy Suppression, ...). Triggered lines
 * ("when this Hero ...") fall through because their effect does not parse.
 */
const ACTIVATED_RULE: ParseRule = {
  parse: (body, name, raw) => {
    const m = body.match(/^Once per turn, (you can )?(.+)\.$/i);
    if (!m) return null;
    let rest = m[2];
    let cost: AbilityCost | undefined;
    const colon = rest.indexOf(': ');
    if (colon >= 0) {
      if (!m[1]) return null;
      const parsed = parseCost(rest.slice(0, colon));
      if (!parsed) return null;
      cost = parsed;
      rest = rest.slice(colon + 2);
    } else if (m[1]) {
      // "you can <effect>" with no cost: only the GY-recovery shape uses it.
      rest = `you can ${rest}`;
    }
    let duration: AbilityDuration | undefined;
    for (const [re, d] of DURATION_SUFFIXES) {
      if (re.test(rest)) {
        duration = d;
        rest = rest.replace(re, '');
        break;
      }
    }
    const effect = parseActivatedEffect(rest);
    if (!effect) return null;
    const ir: AbilityIR = { name, raw, trigger: 'activated', oncePerTurn: true, effect, constraints: [] };
    if (cost) ir.cost = cost;
    if (duration) ir.duration = duration;
    return ir;
  },
};

/**
 * "When this Hero is sent to the <Graveyard|Replen>: draw N card(s)."  (e.g.
 *  Salvage Beacon → draw 1). A triggered ability: on conclusion of the send the
 *  runtime prompts the player to use it. The pile word selects which pile the
 *  send must land in for the trigger to fire.
 */
const ON_SENT_DRAW_RULE = regexRule(
  /^When this Hero is sent to the (Graveyard|Replen):\s*draw (\d+) cards?\.$/i,
  (m, name, raw) => ({
    name,
    raw,
    trigger: 'onSentToPile',
    pile: m[1].toLowerCase() === 'replen' ? 'replen' : 'graveyard',
    effect: { kind: 'draw', count: Number(m[2]) },
    constraints: [],
  }),
);

/**
 * "While this Hero is in your <Replen|Graveyard> pile, you can: return it to
 *  your Hand."  (e.g. Field Cache). An in-pile activated ability: the pile glows
 *  amber and the card can be activated from the pile-search pop-up to move it
 *  back to the Hand. The pile word selects which pile it activates from.
 */
const PILE_RETURN_SELF_RULE = regexRule(
  /^While this Hero is in your (Replen|Graveyard) pile, you can:\s*return it to your Hand\.$/i,
  (m, name, raw) => ({
    name,
    raw,
    trigger: 'pileActivated',
    pile: m[1].toLowerCase() === 'graveyard' ? 'graveyard' : 'replen',
    effect: { kind: 'returnSelfToHand' },
    constraints: [],
  }),
);

/**
 * "Once per turn, when this Hero lands a Successful Hit, you can break all Armor
 *  Bars on the target Hero; if you do, no damage is inflicted."  (Snow Viper ->
 *  Bunker Busting Round). A `combatHit` trigger, once-per-turn, OPTIONAL ("you
 *  can" -> the player is prompted yes/no mid-Resolution). On accept it wipes every
 *  Armor Bar on the struck Hero and inflicts no HP damage.
 */
const BUNKER_BUSTING_RULE = regexRule(
  /^Once per turn, when this Hero lands a Successful Hit, you can break all Armor Bars on the target Hero; if you do, no damage is inflicted\.$/i,
  (_m, name, raw) => ({
    name,
    raw,
    trigger: 'combatHit',
    oncePerTurn: true,
    optional: true,
    effect: { kind: 'breakAllArmorBars' },
    constraints: [],
  }),
);

/**
 * Mandatory combat eliminations:
 *  - "When this Hero lands a Successful Hit against a Normal Hero with less than
 *    half HP, eliminate that Hero."  (Snow Viper -> Hidden Finisher)
 *  - "When this Hero rolls a Critical Hit against a target with no Armor Bars,
 *    eliminate that Hero."  (Headhunter Weapon)
 */
const INSTANT_ELIMINATE_RULE = regexRule(
  /^When this Hero (lands a Successful Hit|rolls a Critical Hit) against (a Normal Hero with less than half HP|a target with no Armor Bars), eliminate that Hero\.$/i,
  (m, name, raw) => {
    const gate: EliminateGate = {};
    if (/critical/i.test(m[1])) gate.critOnly = true;
    if (/normal hero/i.test(m[2])) {
      gate.targetNormal = true;
      gate.targetBelowHalfHp = true;
    } else {
      gate.targetNoArmorBars = true;
    }
    return { name, raw, trigger: 'combatHit', effect: { kind: 'instantEliminate', gate }, constraints: [] };
  },
);

/** "This Hero's [Normal ]Hits ignore Armor Bars." (Anvil Weapon) — passive combat modifier. */
const IGNORE_ARMOR_BARS_RULE = regexRule(/^This Hero's (Normal )?Hits ignore Armor Bars\.$/i, (m, name, raw) => ({
  name,
  raw,
  trigger: 'passive',
  effect: m[1] ? { kind: 'ignoreArmorBars', normalOnly: true } : { kind: 'ignoreArmorBars' },
  constraints: [],
}));

/** "Normal Set" / "Replen Set" / "Commit Set" → SetKind. */
function setKindOf(word: string): SetKind {
  const w = word.toLowerCase();
  return w.startsWith('replen') ? 'replen' : w.startsWith('commit') ? 'commit' : 'normal';
}

/** One On-Set effect clause → effect (+ "you can" optionality), or null. */
function parseOnSetEffect(text: string): { effect: AbilityEffect; optional?: boolean } | null {
  let t = text.trim();
  let optional: boolean | undefined;
  const can = t.match(/^you can (.+)$/i);
  if (can) {
    optional = true;
    t = can[1];
  }
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^draw (\d+) cards?$/i))) return { effect: { kind: 'draw', count: +m[1] }, optional };
  if ((m = t.match(/^randomly select (\d+) cards? from your opponent's Hand and send that card to Replen$/i)))
    return { effect: { kind: 'opponentHandToReplen', count: +m[1] }, optional };
  if ((m = t.match(/^look at the top (\d+) cards of your Deck, then return them to the top of your Deck in any order$/i)))
    return { effect: { kind: 'peekDeckTop', count: +m[1] }, optional };
  if (/^select 1 Equipment on your opponent's field and send that Equipment to Replen$/i.test(t))
    return { effect: { kind: 'opponentEquipmentToReplen' }, optional };
  if ((m = t.match(/^if this Hero is unequipped, equip this Hero with the top (Weapon|Armor|Loadout) card from your Deck(, then Disturb your Deck)?$/i)))
    return { effect: { kind: 'equipFromDeck', subType: m[1], disturb: Boolean(m[2]) }, optional };
  if (/^destroy Human Normal Heroes on your opponent's field, up to the number of materials used to Commit Set this Hero$/i.test(t))
    return { effect: { kind: 'destroyEnemyNormalHeroes', upToMaterials: true }, optional };
  if (/^destroy all Human Normal Heroes on your opponent's field$/i.test(t))
    return { effect: { kind: 'destroyEnemyNormalHeroes', upToMaterials: false }, optional };
  if (/^select 1 Ability Card in your GY and add that card to your Hand$/i.test(t))
    return { effect: { kind: 'recoverFromGraveyard', cardType: 'B', to: 'hand' }, optional };
  return null;
}

const SET_WORD = '(Normal Set|Replen Set|Commit Set|Set)';

/**
 * On-Set triggers: "When this Hero is <Kind> Set[ or <Kind> Set], <effect>."
 * (Supply Disruption, Forward Intel, Field Disruption, Extra Baggage, Stay Armed,
 * Domination, Reclaim Ops).
 */
const ON_SET_RULE: ParseRule = {
  parse: (body, name, raw) => {
    const m = body.match(new RegExp(`^When this Hero is ${SET_WORD}(?: or ${SET_WORD})?, (.+)\\.$`, 'i'));
    if (!m) return null;
    const parsed = parseOnSetEffect(m[3]);
    if (!parsed) return null;
    // A bare "is Set" fires on every Set kind (Reclaim Ops).
    const words = [m[1], m[2]].filter(Boolean);
    const setKinds: SetKind[] = words.some((w) => /^Set$/i.test(w))
      ? ['normal', 'replen', 'commit']
      : words.map(setKindOf);
    const ir: AbilityIR = { name, raw, trigger: 'onSet', setKinds, effect: parsed.effect, constraints: [] };
    if (parsed.optional) ir.optional = true;
    return ir;
  },
};

/**
 * "When this Hero is used as material to Replen Set a "Jackal" Hero, you can send
 *  this Hero to the GY, then send the top card of your opponent's Deck to
 *  Replen." (Shadow Hack). Parsed only for now.
 */
const USED_AS_MATERIAL_RULE = regexRule(
  new RegExp(
    `^When this Hero is used as material to ${SET_WORD} an? "([^"]+)" Hero, you can send this Hero to the GY, then send the top (\\d+)? ?cards? of your opponent's Deck to Replen\\.$`,
    'i',
  ),
  (m, name, raw) => ({
    name,
    raw,
    trigger: 'usedAsMaterial',
    setKinds: [setKindOf(m[1])],
    materialFor: { side: 'ally', family: m[2] },
    optional: true,
    selfToGraveyard: true,
    effect: { kind: 'opponentDeckTopToReplen', count: m[3] ? +m[3] : 1 },
    constraints: [],
  }),
);

/**
 * Set permissions: "This Hero can be Normal Set." (Rapid Deployment) and
 * "This Hero can be Replen Set with 1 Infantry Hero." (Troop Lead).
 */
const SET_PERMISSION_RULE = regexRule(
  new RegExp(`^This Hero can be ${SET_WORD}(?: with (\\d+) (?:(\\w+) )?Heroe?s?)?\\.$`, 'i'),
  (m, name, raw) => {
    const effect: Extract<AbilityEffect, { kind: 'setPermission' }> = { kind: 'setPermission', setKind: setKindOf(m[1]) };
    if (m[2]) effect.materials = m[3] ? { count: +m[2], subType: m[3] } : { count: +m[2] };
    return { name, raw, trigger: 'setPermission', effect, constraints: [] };
  },
);

const RULES: ParseRule[] = [PASSIVE_WHILE_RULE, ACTIVATED_RULE, ON_SENT_DRAW_RULE, PILE_RETURN_SELF_RULE, BUNKER_BUSTING_RULE, INSTANT_ELIMINATE_RULE, IGNORE_ARMOR_BARS_RULE, ON_SET_RULE, USED_AS_MATERIAL_RULE, SET_PERMISSION_RULE];

/** Split "<Name>: <body>" into its parts. No colon → empty name, whole text is body. */
function splitNameBody(text: string): { name: string; body: string } {
  const idx = text.indexOf(':');
  if (idx === -1) return { name: '', body: text.trim() };
  return { name: text.slice(0, idx).trim(), body: text.slice(idx + 1).trim() };
}

/** Memoize by text so repeated parses (every combat/overlay pass) are cheap. */
const cache = new Map<string, AbilityIR>();

/** Parse one ability rules-text line into structured IR. */
export function parseAbility(text: string): AbilityIR {
  const cached = cache.get(text);
  if (cached) return cached;

  const { name, body } = splitNameBody(text);
  let ir: AbilityIR | undefined;
  for (const rule of RULES) {
    ir = rule.parse(body, name, text) ?? undefined;
    if (ir) break;
  }
  if (!ir) {
    ir = { name, raw: text, trigger: 'unimplemented', effect: { kind: 'unimplemented' }, constraints: [] };
  }
  cache.set(text, ir);
  return ir;
}

/** Parse a card's ability lines (may be undefined) into IR nodes. */
export function parseAbilities(texts: string[] | undefined): AbilityIR[] {
  return (texts ?? []).map(parseAbility);
}
