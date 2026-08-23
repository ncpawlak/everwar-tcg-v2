import type { Card, CardId, CardType, GameState, SlotId } from './types';

/** The three typed families, in canonical order. */
export const CARD_TYPES: readonly CardType[] = ['A', 'B', 'C'];

/**
 * Static card library. Keyed by `${CardType}${index}` (e.g. `A1`), matching the
 * generated card ids. Holds every card's display + combat profile. Content is
 * placeholder-but-themed; rules that read ATK/DEF/effect arrive in later slices.
 *
 * Themes: A = Vanguard (aggressive front line), B = Arcane (spell/support),
 * C = Bulwark (defensive walls).
 */
export const CARD_LIBRARY: Record<string, Omit<Card, 'id' | 'type'>> = {
  A1: {
    name: 'Ashborne Vanguard', cost: 3, atk: 1800, def: 1200, hp: 1900, rarity: 'Rare',
    effect: 'When this card is set, it gains +200 ATK for each other Vanguard you control.',
    flavor: 'First through the breach, last to fall.',
  },
  A2: {
    name: 'Emberfang Reaver', cost: 4, atk: 2100, def: 1000, hp: 1700, rarity: 'Epic',
    effect: "Once per turn: discard a card to raise this card's ATK by 500 until end of turn.",
    flavor: 'It hungers for the clash of steel.',
  },
  A3: {
    name: 'Ironclad Lancer', cost: 2, atk: 1500, def: 1300, hp: 2000, rarity: 'Common',
    effect: 'This card cannot be destroyed by the first attack it faces each turn.',
    flavor: 'A wall that marches.',
  },
  A4: {
    name: 'Warcry Commander', cost: 5, atk: 2400, def: 1600, hp: 2300, rarity: 'Legendary',
    effect: 'All Vanguard cards you control gain +300 ATK. When summoned, draw one card.',
    flavor: 'Follow the banner, and fear nothing.',
  },
  B1: {
    name: 'Whisperwind Adept', cost: 2, atk: 900, def: 900, hp: 1400, rarity: 'Common',
    effect: 'When set, look at the top two cards of your deck and rearrange them.',
    flavor: 'The wind carries every secret.',
  },
  B2: {
    name: 'Runescribe Oracle', cost: 3, atk: 1200, def: 1500, hp: 1600, rarity: 'Rare',
    effect: 'Once per turn: draw a card, then place a card from your hand on top of your deck.',
    flavor: 'She reads the pages before they are written.',
  },
  B3: {
    name: 'Tempest Weaver', cost: 4, atk: 1600, def: 1400, hp: 1800, rarity: 'Epic',
    effect: 'When this card resolves an effect, deal 300 damage to the opposing card in its column.',
    flavor: 'Storms answer to her hands.',
  },
  B4: {
    name: 'Astral Archon', cost: 6, atk: 2000, def: 2000, hp: 2200, rarity: 'Legendary',
    effect: 'Once per turn you may return a card you control to your hand to negate an opposing effect.',
    flavor: 'Between the stars, it judges all.',
  },
  C1: {
    name: 'Stonewatch Sentry', cost: 2, atk: 800, def: 1800, hp: 2400, rarity: 'Common',
    effect: 'While face-up, adjacent cards you control cannot be targeted by effects.',
    flavor: 'None shall pass its vigil.',
  },
  C2: {
    name: 'Bulwark Warden', cost: 3, atk: 1000, def: 2100, hp: 2600, rarity: 'Rare',
    effect: 'This card takes 500 less damage from every attack.',
    flavor: 'Set your shields; hold the line.',
  },
  C3: {
    name: 'Gilded Aegis', cost: 4, atk: 1300, def: 2400, hp: 2800, rarity: 'Epic',
    effect: 'Once per turn, prevent battle damage to one card you control.',
    flavor: 'Forged to outlast empires.',
  },
  C4: {
    name: 'Everwall Colossus', cost: 7, atk: 2200, def: 3000, hp: 3400, rarity: 'Legendary',
    effect: 'Cannot be destroyed by battle. At the start of your turn, restore 500 DEF to a card you control.',
    flavor: 'The last stone standing when the war is done.',
  },
};

/** Slots per type family. */
export const SLOTS_PER_TYPE = 4;

/**
 * All 12 slot ids. Grouped by type family (A1..A4, B1..B4, C1..C4). Order here
 * only affects iteration (empty-slot listing, highlight scans), not layout.
 */
export const SLOT_IDS: readonly SlotId[] = CARD_TYPES.flatMap((t) =>
  Array.from({ length: SLOTS_PER_TYPE }, (_, i) => `${t}${i + 1}` as SlotId),
);

/** Phase 2 deck size: 4 of each of the 3 types. */
export const DECK_SIZE = CARD_TYPES.length * SLOTS_PER_TYPE;

/** Cards drawn automatically on start. */
export const OPENING_HAND_SIZE = 5;

/**
 * Build the Phase 2 deck: 12 cards, 4 each of A/B/C.
 *
 * Deck order is bottom-to-top (last element = top = drawn first). The types are
 * interleaved (A,B,C,A,B,C,...) so the opening hand of 5 comes out mixed rather
 * than four of one type in a row.
 */
export function createInitialCards(): {
  cardsById: Record<CardId, Card>;
  deck: CardId[];
} {
  const cardsById: Record<CardId, Card> = {};
  const deck: CardId[] = [];
  for (let i = 1; i <= SLOTS_PER_TYPE; i++) {
    for (const type of CARD_TYPES) {
      const key = `${type}${i}`;
      const id: CardId = `card-${key}`;
      const profile = CARD_LIBRARY[key];
      cardsById[id] = { id, type, ...profile };
      deck.push(id);
    }
  }
  return { cardsById, deck };
}

/** A fresh empty board: all 12 typed slots unoccupied. */
export function createEmptyBoard(): GameState['board'] {
  return Object.fromEntries(SLOT_IDS.map((id) => [id, null])) as GameState['board'];
}

/** A fresh Phase 2 game state: full deck, empty hand, empty board, no drag. */
export function createInitialState(): GameState {
  const { cardsById, deck } = createInitialCards();
  return {
    cardsById,
    deck,
    hand: [],
    board: createEmptyBoard(),
    graveyard: [],
    replen: [],
    deckSpread: false,
    dragging: null,
    hoveredCardId: null,
    selectedCardId: null,
    pileSearch: null,
    summon: null,
  };
}

