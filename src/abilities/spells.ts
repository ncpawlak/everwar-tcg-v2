import type { Card, CardId } from '../state/types';

/**
 * Ability (B) card "spell" text → a small sequential IR. Covers the
 * hand-cost + deck-search family, e.g. Convoy Incoming:
 *   "Send 1 card from your Hand to the GY. Draw the top "Devil Dog" Hero from
 *    your Deck. Disturb your Deck."
 * Any clause no rule understands makes the whole text unparsed (null), so a
 * card is either fully enforced or inert.
 */

/** Which Deck cards a "draw the top <X>" clause takes. */
export interface DeckCardSelector {
  cardType: 'A' | 'C';
  /** Quoted name fragment, e.g. "Devil Dog". */
  family?: string;
  allegiance?: string;
  subType?: string;
  /** "Normal" Hero = level ≤ 2. */
  normal?: boolean;
}

export type SpellStep =
  | { kind: 'draw'; count: number }
  | { kind: 'tutor'; count: number; select: DeckCardSelector }
  | { kind: 'disturb' };

export interface SpellIR {
  /** Mandatory Hand cost paid first: the player picks the card. */
  cost?: { to: 'graveyard' | 'replen'; heroOnly: boolean };
  steps: SpellStep[];
}

const ALLEGIANCES = ['Coalition', 'Dictate'];
const HERO_ROLES = ['Infantry', 'Recon', 'Heavy', 'Engineer', 'Medic'];

/** `"Devil Dog"` / `Dictate` / `Heavy` / `Normal` / `Coalition Medic` → selector. */
function heroSelector(desc: string): DeckCardSelector | null {
  const sel: DeckCardSelector = { cardType: 'A' };
  let rest = desc.trim();
  const quoted = rest.match(/^"([^"]+)"\s*(.*)$/);
  if (quoted) {
    sel.family = quoted[1];
    rest = quoted[2];
  }
  for (const word of rest.split(/\s+/).filter(Boolean)) {
    const w = word.toLowerCase();
    const alleg = ALLEGIANCES.find((a) => a.toLowerCase() === w);
    const role = HERO_ROLES.find((r) => r.toLowerCase() === w);
    if (alleg) sel.allegiance = alleg;
    else if (role) sel.subType = role;
    else if (w === 'normal') sel.normal = true;
    else return null;
  }
  return sel;
}

function parseClause(clause: string, first: boolean, ir: SpellIR): boolean {
  const t = clause.trim();
  let m: RegExpMatchArray | null;
  if (first && (m = t.match(/^Send 1 (card|Hero card) from your Hand to (the GY|Replen)$/i))) {
    ir.cost = { to: /GY/i.test(m[2]) ? 'graveyard' : 'replen', heroOnly: /hero/i.test(m[1]) };
    return true;
  }
  if ((m = t.match(/^draw (\d+) cards?(?: from your Deck)?$/i))) {
    ir.steps.push({ kind: 'draw', count: +m[1] });
    return true;
  }
  if ((m = t.match(/^draw the top (?:(\d+) )?(Weapon|Armor|Loadout) cards? from your Deck$/i))) {
    ir.steps.push({ kind: 'tutor', count: m[1] ? +m[1] : 1, select: { cardType: 'C', subType: m[2] } });
    return true;
  }
  if ((m = t.match(/^draw the top (?:(\d+) )?(.+?) Heroe?s? from your Deck$/i))) {
    const select = heroSelector(m[2]);
    if (!select) return false;
    ir.steps.push({ kind: 'tutor', count: m[1] ? +m[1] : 1, select });
    return true;
  }
  if (/^Disturb your Deck$/i.test(t)) {
    ir.steps.push({ kind: 'disturb' });
    return true;
  }
  return false;
}

const cache = new Map<string, SpellIR | null>();

/** Parse a B card's rules text, or null when any clause is unsupported. */
export function parseSpell(text: string | undefined): SpellIR | null {
  if (!text) return null;
  if (cache.has(text)) return cache.get(text)!;
  const clauses = text
    .replace(/\.\s*$/, '')
    .split(/\.\s+|,\s+then\s+/i)
    .filter(Boolean);
  const ir: SpellIR = { steps: [] };
  const ok = clauses.length > 0 && clauses.every((c, i) => parseClause(c, i === 0, ir)) && ir.steps.length > 0;
  const out = ok ? ir : null;
  cache.set(text, out);
  return out;
}

export function matchesDeckSelector(card: Card, sel: DeckCardSelector): boolean {
  if (card.type !== sel.cardType) return false;
  if (sel.family && !card.name.includes(sel.family)) return false;
  if (sel.allegiance && card.allegiance !== sel.allegiance) return false;
  if (sel.subType && (card.subType ?? '').toLowerCase() !== sel.subType.toLowerCase()) return false;
  if (sel.normal && (card.level ?? 1) > 2) return false;
  return true;
}

/** The topmost `count` matching Deck cards (deck end = top), top first. */
export function tutorPicks(
  deck: readonly CardId[],
  lookup: Record<CardId, Card>,
  sel: DeckCardSelector,
  count: number,
): CardId[] {
  const out: CardId[] = [];
  for (let i = deck.length - 1; i >= 0 && out.length < count; i--) {
    const c = lookup[deck[i]];
    if (c && matchesDeckSelector(c, sel)) out.push(deck[i]);
  }
  return out;
}

/** Hand cards that can pay a spell's cost (the spell itself already left the Hand). */
export function spellCostOptions(ir: SpellIR, hand: readonly CardId[], lookup: Record<CardId, Card>): CardId[] {
  if (!ir.cost) return [];
  return hand.filter((id) => !ir.cost!.heroOnly || lookup[id]?.type === 'A');
}
