/**
 * Ability text parser (Phase 8). Turns a Hero's rules-text line into an
 * `AbilityIR` node using a small table of grammar rules. This is a CONTROLLED
 * grammar — it matches the consistent sentence shapes the set is authored in,
 * not free English. Anything no rule recognizes returns an `unimplemented`
 * node so the card still displays and future slices can add a rule for it.
 *
 * Adding support for a new ability pattern = add one entry to `RULES`.
 */

import type { AbilityIR, AuraStat } from './abilityIR';

/** Rules-text stat words → IR stat keys. */
const STAT_WORD: Record<string, AuraStat> = {
  ACC: 'acc',
  DMG: 'dmg',
  HP: 'hp',
  ARMOR: 'armor',
};

/** A parse rule: a regex over the ability BODY (text after the name colon) plus
 *  a builder that produces the IR from the captured groups. */
interface ParseRule {
  match: RegExp;
  build: (m: RegExpMatchArray, name: string, raw: string) => AbilityIR;
}

/**
 * "All "<Family>" Heroes you control gain +<n><STAT>. Only 1 "<X>" Ability can
 *  be active on your field at once."  (e.g. Echo Assist → +10 ACC)
 */
const STAT_GAIN_AURA: ParseRule = {
  match:
    /^All\s+"([^"]+)"\s+Heroes you control gain\s+\+(\d+)\s*(ACC|DMG|HP)\.\s*Only 1\s+"([^"]+)"\s+Ability can be active on your field at once\.$/i,
  build: (m, name, raw) => ({
    name,
    raw,
    trigger: 'passive',
    effect: {
      kind: 'statAura',
      stat: STAT_WORD[m[3].toUpperCase()],
      amount: Number(m[2]),
      scope: { controller: 'self', family: m[1] },
    },
    constraints: [{ kind: 'maxActiveByName', name: m[4], max: 1 }],
  }),
};

/**
 * "All "<Family>" Heroes you control have +<n> Armor. Only 1 "<X>" Ability can
 *  be active on your field at once."  (e.g. Roaming Armor → +10 Armor)
 */
const ARMOR_AURA: ParseRule = {
  match:
    /^All\s+"([^"]+)"\s+Heroes you control have\s+\+(\d+)\s+Armor\.\s*Only 1\s+"([^"]+)"\s+Ability can be active on your field at once\.$/i,
  build: (m, name, raw) => ({
    name,
    raw,
    trigger: 'passive',
    effect: {
      kind: 'statAura',
      stat: 'armor',
      amount: Number(m[2]),
      scope: { controller: 'self', family: m[1] },
    },
    constraints: [{ kind: 'maxActiveByName', name: m[3], max: 1 }],
  }),
};

/**
 * "Once per turn, you can: this Hero gains +<n><STAT>."  (e.g. Combat Focus →
 * activated, once-per-turn, +20 ACC to itself). The player triggers it from the
 * ability popup; the buff persists while the Hero stays on the field.
 */
const SELF_STAT_BUFF_RULE: ParseRule = {
  match:
    /^Once per turn, you can:\s*this Hero gains\s+\+(\d+)\s*(ACC|DMG|HP)\.$/i,
  build: (m, name, raw) => ({
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
};

const RULES: ParseRule[] = [STAT_GAIN_AURA, ARMOR_AURA, SELF_STAT_BUFF_RULE];

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
    const m = body.match(rule.match);
    if (m) {
      ir = rule.build(m, name, text);
      break;
    }
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
