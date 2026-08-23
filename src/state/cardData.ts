import type { Card, CardId, CardType, GameState, OppSlotId, SlotId } from './types';
import { shuffleArray } from './shuffle';

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
    name: 'Ashborne Vanguard', cost: 3, level: 2, dmg: 1800, acc: 130, hp: 1900, rarity: 'Rare',
    effect: 'When this card is set, it gains +200 DMG for each other Vanguard you control.',
    flavor: 'First through the breach, last to fall.',
  },
  A2: {
    name: 'Emberfang Reaver', cost: 4, level: 2, dmg: 2100, acc: 150, hp: 1700, rarity: 'Epic',
    effect: "Once per turn: discard a card to raise this card's DMG by 500 until end of turn.",
    flavor: 'It hungers for the clash of steel.',
  },
  A3: {
    name: 'Ironclad Lancer', cost: 2, level: 1, dmg: 1500, acc: 100, hp: 2000, rarity: 'Common',
    effect: 'This card cannot be destroyed by the first attack it faces each turn.',
    flavor: 'A wall that marches.',
  },
  A4: {
    name: 'Warcry Commander', cost: 5, level: 3, dmg: 2400, acc: 170, hp: 2300, rarity: 'Legendary',
    effect: 'All Vanguard cards you control gain +300 DMG. When summoned, draw one card.',
    flavor: 'Follow the banner, and fear nothing.',
  },
  B1: {
    name: 'Whisperwind Adept', cost: 2, rarity: 'Common', ability: 'draw1',
    effect: 'When set: draw 1 card.',
    flavor: 'The wind carries every secret.',
  },
  B2: {
    name: 'Runescribe Oracle', cost: 3, rarity: 'Rare', ability: 'graveyardIntoDeck',
    effect: 'When set: shuffle your graveyard into your deck.',
    flavor: 'She reads the pages before they are written.',
  },
  B3: {
    name: 'Tempest Weaver', cost: 4, rarity: 'Epic', ability: 'replenIntoDeck', continuous: true,
    effect: 'Continuous. When set: shuffle your replen into your deck.',
    flavor: 'Storms answer to her hands.',
  },
  B4: {
    name: 'Astral Archon', cost: 6, rarity: 'Legendary', ability: 'draw2', continuous: true,
    effect: 'Continuous. When set: draw 2 cards.',
    flavor: 'Between the stars, it judges all.',
  },
  C1: {
    name: 'Stonewatch Sentry', cost: 2, rarity: 'Common',
    effect: 'Boosts a random stat of its linked A card when set.',
    flavor: 'None shall pass its vigil.',
  },
  C2: {
    name: 'Bulwark Warden', cost: 3, rarity: 'Rare',
    effect: 'Boosts a random stat of its linked A card when set.',
    flavor: 'Set your shields; hold the line.',
  },
  C3: {
    name: 'Gilded Aegis', cost: 4, rarity: 'Epic',
    effect: 'Boosts a random stat of its linked A card when set.',
    flavor: 'Forged to outlast empires.',
  },
  C4: {
    name: 'Everwall Colossus', cost: 7, rarity: 'Legendary',
    effect: 'Boosts a random stat of its linked A card when set.',
    flavor: 'The last stone standing when the war is done.',
  },
};

/**
 * The Commander card — a 5th A-card that joins the deck on top of the 4/4/4 base.
 * It uses the level-3 tribute rules (materials must sum to 3), but as a Commander
 * its tributed materials are sent to the GRAVEYARD rather than the replen pile.
 */
export const COMMANDER_CARD: Omit<Card, 'id' | 'type'> = {
  name: 'Aurelian Warlord', cost: 6, level: 3, commander: true,
  dmg: 2600, acc: 180, hp: 2500, rarity: 'Legendary',
  effect: 'Commander. Tribute materials totaling level 3 (they are sent to the graveyard).',
  flavor: 'Where the Warlord walks, empires kneel.',
};

/** Card id of the Commander card added to the deck. */
export const COMMANDER_ID: CardId = 'card-A5';

/** Slots per type family. */
export const SLOTS_PER_TYPE = 4;

/**
 * All 12 slot ids. Grouped by type family (A1..A4, B1..B4, C1..C4). Order here
 * only affects iteration (empty-slot listing, highlight scans), not layout.
 */
export const SLOT_IDS: readonly SlotId[] = CARD_TYPES.flatMap((t) =>
  Array.from({ length: SLOTS_PER_TYPE }, (_, i) => `${t}${i + 1}` as SlotId),
);

/** Phase 2 deck size: 4 of each of the 3 types, plus the single Commander card. */
export const DECK_SIZE = CARD_TYPES.length * SLOTS_PER_TYPE + 1;

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
  // The Commander joins on top of the deck (drawn early so it's easy to field).
  cardsById[COMMANDER_ID] = { id: COMMANDER_ID, type: 'A', ...COMMANDER_CARD };
  deck.push(COMMANDER_ID);
  return { cardsById, deck };
}

/** A fresh empty board: all 12 typed slots unoccupied. */
export function createEmptyBoard(): GameState['board'] {
  return Object.fromEntries(SLOT_IDS.map((id) => [id, null])) as GameState['board'];
}

/**
 * Static opponent Vanguard library for the combat simulation. Dummy A-cards the
 * player targets and destroys. Their HP is set well above the player's per-hit
 * DMG so a single target usually needs several attacks to fall — which is what
 * makes stacking multiple attackers onto one opponent meaningful.
 */
export const OPPONENT_LIBRARY: Record<OppSlotId, Omit<Card, 'id' | 'type'>> = {
  O1: {
    name: 'Dread Harbinger', cost: 4, dmg: 1600, acc: 120, hp: 4200, rarity: 'Epic',
    effect: 'An omen of the coming ruin.', flavor: 'It marches ahead of the storm.',
  },
  O2: {
    name: 'Void Sentinel', cost: 6, dmg: 1900, acc: 140, hp: 5400, rarity: 'Legendary',
    effect: 'Guards the rift between worlds.', flavor: 'Nothing passes. Nothing returns.',
  },
  O3: {
    name: 'Gloom Warden', cost: 3, dmg: 1400, acc: 110, hp: 3600, rarity: 'Rare',
    effect: 'Keeper of the black watchfires.', flavor: 'Its lantern burns without light.',
  },
  O4: {
    name: 'Ashen Revenant', cost: 5, dmg: 2000, acc: 150, hp: 4800, rarity: 'Epic',
    effect: 'Risen from the cinders of a fallen host.', flavor: 'Death was only an intermission.',
  },
};

/** Opponent card id for a given opponent slot. */
export function opponentCardId(slot: OppSlotId): CardId {
  return `opp-${slot}`;
}

/**
 * Build the opponent's field for the simulation: three seeded Vanguard cards
 * (O1–O3 occupied, O4 left empty to show a gap), plus the full card lookup.
 */
export function createInitialOpponents(): {
  opponentCards: Record<CardId, Card>;
  opponentBoard: GameState['opponentBoard'];
} {
  const opponentCards: Record<CardId, Card> = {};
  const opponentBoard: GameState['opponentBoard'] = { O1: null, O2: null, O3: null, O4: null };
  const seeded: OppSlotId[] = ['O1', 'O2', 'O3'];
  for (const slot of seeded) {
    const id = opponentCardId(slot);
    opponentCards[id] = { id, type: 'A', ...OPPONENT_LIBRARY[slot] };
    opponentBoard[slot] = id;
  }
  return { opponentCards, opponentBoard };
}

/** Card id for a card in the opponent's own deck (Phase 7). Distinct namespace
 * from the player's `card-*` ids and the seeded `opp-O*` target ids. */
export function opponentDeckCardId(key: string): CardId {
  return `opp-deck-${key}`;
}

/**
 * Build the opponent's own 13-card deck (Phase 7): a mirror of the player's
 * library (4×A/B/C + Commander) under the `opp-deck-*` id namespace, shuffled.
 * Returned cards are merged into the opponent card lookup so the same rendering
 * and rules machinery can read them. The deck is where the opponent's future
 * summons come from; the pre-seeded O-row targets remain separate for now.
 */
export function createOpponentDeck(rand: () => number = Math.random): {
  cards: Record<CardId, Card>;
  deck: CardId[];
} {
  const cards: Record<CardId, Card> = {};
  const deck: CardId[] = [];
  for (let i = 1; i <= SLOTS_PER_TYPE; i++) {
    for (const type of CARD_TYPES) {
      const key = `${type}${i}`;
      const id = opponentDeckCardId(key);
      cards[id] = { id, type, ...CARD_LIBRARY[key] };
      deck.push(id);
    }
  }
  const commanderId = opponentDeckCardId('A5');
  cards[commanderId] = { id: commanderId, type: 'A', ...COMMANDER_CARD };
  deck.push(commanderId);
  return { cards, deck: shuffleArray(deck, rand) };
}

/** A fresh empty opponent Arcane (B) row: all four OB slots unoccupied. */
export function createEmptyOppBBoard(): GameState['opponentBBoard'] {
  return { OB1: null, OB2: null, OB3: null, OB4: null };
}

/** A fresh empty opponent Bulwark (C) row: all four OC slots unoccupied. */
export function createEmptyOppCBoard(): GameState['opponentCBoard'] {
  return { OC1: null, OC2: null, OC3: null, OC4: null };
}

/** A fresh Phase 2 game state: full deck, empty hand, empty board, no drag. */
export function createInitialState(): GameState {
  const { cardsById, deck } = createInitialCards();
  const { opponentCards, opponentBoard } = createInitialOpponents();
  const oppDeck = createOpponentDeck();
  const allOpponentCards = { ...opponentCards, ...oppDeck.cards };
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
    pendingTribute: null,
    turn: 1,
    phase: 'draw',
    activePlayer: 'player',
    phaseAnnounce: 0,
    opponentCards: allOpponentCards,
    opponentBoard,
    opponentGraveyard: [],
    opponentDeck: oppDeck.deck,
    opponentHand: [],
    opponentReplen: [],
    opponentBBoard: createEmptyOppBBoard(),
    opponentCBoard: createEmptyOppCBoard(),
    attackTargets: {},
    targeting: null,
    aimPoint: null,
    resolutionRolls: {},
    lastRolls: {},
    resolutionResults: {},
    outcomePopups: {},
    damagePopups: {},
    currentHp: {},
    destroying: [],
    oppAttackTargets: {},
    oppResolutionRolls: {},
    oppResolutionResults: {},
    oppOutcomePopups: {},
    oppDamagePopups: {},
    oppDestroying: [],
  };
}

