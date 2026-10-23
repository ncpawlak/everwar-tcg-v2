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
  /** Weapon class, e.g. "Suppressive". */
  weaponClass?: string;
}

export type SpellStep =
  | { kind: 'draw'; count: number }
  | { kind: 'tutor'; count: number; select: DeckCardSelector }
  | { kind: 'disturb' }
  /** "Reveal the top N cards of your Deck. Add 1 <X> from among them to your
   *  Hand. Send the remaining cards to Replen." — the player picks. */
  | { kind: 'reveal'; count: number; pick?: DeckCardSelector; restTo?: 'replen' | 'graveyard' }
  /** "If a <X> Hero on your field was destroyed or eliminated last turn, …" —
   *  the rest of the spell only resolves when this held. */
  | { kind: 'requireAllyLostLastTurn'; select: DeckCardSelector }
  /** "Select 1 <X> Hero you control. Equip the top <Y> from your Deck to that
   *  Hero." — the player picks an unequipped matching ally. */
  | { kind: 'equipAlly'; ally: DeckCardSelector; equip?: DeckCardSelector };

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
  const last = ir.steps[ir.steps.length - 1];
  if ((m = t.match(/^If an? (.+?) Hero on your field was destroyed or eliminated last turn, (.+)$/i))) {
    const select = heroSelector(m[1]);
    if (!select) return false;
    ir.steps.push({ kind: 'requireAllyLostLastTurn', select });
    return parseClause(m[2], false, ir);
  }
  if ((m = t.match(/^Reveal the top (\d+) cards of your Deck$/i))) {
    ir.steps.push({ kind: 'reveal', count: +m[1] });
    return true;
  }
  if (last?.kind === 'reveal' && !last.pick && (m = t.match(/^Add 1 (.+?) Hero from among them to your Hand$/i))) {
    const select = heroSelector(m[1]);
    if (!select) return false;
    last.pick = select;
    return true;
  }
  if (last?.kind === 'reveal' && !last.restTo && (m = t.match(/^Send the remaining cards to (the GY|Replen)$/i))) {
    last.restTo = /GY/i.test(m[1]) ? 'graveyard' : 'replen';
    return true;
  }
  if ((m = t.match(/^Select 1 (.+?) Hero you control$/i))) {
    const ally = heroSelector(m[1]);
    if (!ally) return false;
    ir.steps.push({ kind: 'equipAlly', ally });
    return true;
  }
  if (last?.kind === 'equipAlly' && !last.equip && (m = t.match(/^Equip the top (?:(\w+) )?(Weapon|Armor|Loadout) from your Deck to that Hero$/i))) {
    last.equip = { cardType: 'C', subType: m[2], ...(m[1] ? { weaponClass: m[1] } : {}) };
    return true;
  }
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
  const ok =
    clauses.length > 0 &&
    clauses.every((c, i) => parseClause(c, i === 0, ir)) &&
    ir.steps.length > 0 &&
    ir.steps.every((st) => (st.kind === 'reveal' ? st.pick && st.restTo : st.kind === 'equipAlly' ? st.equip : true));
  const out = ok ? ir : null;
  cache.set(text, out);
  return out;
}

export function matchesDeckSelector(card: Card | undefined, sel: DeckCardSelector): boolean {
  if (!card || card.type !== sel.cardType) return false;
  if (sel.family && !card.name.includes(sel.family)) return false;
  if (sel.allegiance && card.allegiance !== sel.allegiance) return false;
  if (sel.subType && (card.subType ?? '').toLowerCase() !== sel.subType.toLowerCase()) return false;
  if (sel.normal && (card.level ?? 1) > 2) return false;
  if (sel.weaponClass && (card.weaponClass ?? '').toLowerCase() !== sel.weaponClass.toLowerCase()) return false;
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
