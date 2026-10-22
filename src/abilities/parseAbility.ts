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
  AbilityEffect,
  AbilityIR,
  AbilityRider,
  AuraStat,
  HeroSelector,
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

/**
 * "Once per turn, you can: this Hero gains +<n><STAT>."  (e.g. Combat Focus →
 * activated, once-per-turn, +20 ACC to itself). The player triggers it from the
 * ability popup; the buff persists while the Hero stays on the field.
 */
const SELF_STAT_BUFF_RULE = regexRule(
  /^Once per turn, you can:\s*this Hero gains\s+\+(\d+)\s*(ACC|DMG|HP)\.$/i,
  (m, name, raw) => ({
    name,
    raw,
    trigger: 'activated',
    oncePerTurn: true,
    effect: {
      kind: 'selfStatBuff',
      stat: STAT_WORD[m[2].toUpperCase()],
      amount: Number(m[1]),
    },
    constraints: [],
  }),
);

/**
 * "Once per turn, you can send N card from your Hand to Replen: select another
 *  [<SubType>] Hero you control to gain +M STAT."  (e.g. Quick Reload → send 1,
 *  target another Infantry Hero, +20 ACC). Activated, once-per-turn, with a
 *  hand→replen cost and an ally target. The optional sub-type word restricts the
 *  target family; without it, any other Hero you control is eligible.
 */
const TARGET_STAT_BUFF_RULE = regexRule(
  /^Once per turn, you can send (\d+) card from your Hand to Replen:\s*select another (?:(\w+) )?Hero you control to gain\s+\+(\d+)\s*(ACC|DMG|HP)\.$/i,
  (m, name, raw) => ({
    name,
    raw,
    trigger: 'activated',
    oncePerTurn: true,
    cost: { kind: 'sendHandToReplen', count: Number(m[1]) },
    effect: {
      kind: 'targetStatBuff',
      stat: STAT_WORD[m[4].toUpperCase()],
      amount: Number(m[3]),
      target: { side: 'ally', subType: m[2], excludeSelf: true },
    },
    constraints: [],
  }),
);

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
 * "Once per turn, if this Hero lands a Successful Hit: you can break all Armor
 *  Bars on the target Hero. If you do, no damage is inflicted."  (Snow Viper →
 *  Bunker Busting Round). A `combatHit` trigger, once-per-turn, OPTIONAL ("you
 *  can" → the player is prompted yes/no mid-Resolution). On accept it wipes every
 *  Armor Bar on the struck Hero and inflicts no HP damage, overriding armor math.
 */
const BUNKER_BUSTING_RULE = regexRule(
  /^Once per turn, if this Hero lands a Successful Hit:\s*you can break all Armor Bars on the target Hero\.\s*If you do, no damage is inflicted\.$/i,
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
 * "If this Hero lands a Successful Hit against a Normal Hero with less than half
 *  HP: eliminate that Hero instantly."  (Snow Viper → Hidden Finisher). A
 *  `combatHit` trigger, MANDATORY (no "you can"), NOT once-per-turn. Fires on
 *  every qualifying hit: a Normal Hero (level ≤ 2) already under half HP is sent
 *  straight to the Graveyard, ignoring its armor and Armor Bars.
 */
const HIDDEN_FINISHER_RULE = regexRule(
  /^If this Hero lands a Successful Hit against a Normal Hero with less than half HP:\s*eliminate that Hero instantly\.$/i,
  (_m, name, raw) => ({
    name,
    raw,
    trigger: 'combatHit',
    effect: { kind: 'instantEliminate' },
    constraints: [],
  }),
);

const RULES: ParseRule[] = [PASSIVE_WHILE_RULE, SELF_STAT_BUFF_RULE, TARGET_STAT_BUFF_RULE, ON_SENT_DRAW_RULE, PILE_RETURN_SELF_RULE, BUNKER_BUSTING_RULE, HIDDEN_FINISHER_RULE];

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
