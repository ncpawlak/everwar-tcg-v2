import type { Card, CardId, CardType, GameState, Rarity, SlotId } from './types';
import { shuffleArray } from './shuffle';

/** The three typed families, in canonical order. */
export const CARD_TYPES: readonly CardType[] = ['A', 'B', 'C'];

/** Semantic word used in generated card ids per family: `card-hero-1`,
 * `card-ability-2`, `card-equipment-3` (and the `opp-deck-*` mirror). The board
 * slot ids stay A/B/C — this only names the card id namespace. */
export const TYPE_ID_WORD: Record<CardType, string> = {
  A: 'hero',
  B: 'ability',
  C: 'equipment',
};

/**
 * Static support-card library. Keyed by `${CardType}${index}` (e.g. `B1`).
 * Holds the display + effect profile for the two support families; the A-row
 * (Heroes) comes from {@link HERO_LIBRARY} instead.
 *
 * Themes: B = Ability (spell/support one-shots), C = Equipment (stat boosts that
 * attach to a linked Hero).
 */
export const CARD_LIBRARY: Record<string, Omit<Card, 'id' | 'type'>> = {
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
    effect: 'Boosts a random stat of its linked Hero when set.',
    flavor: 'None shall pass its vigil.',
  },
  C2: {
    name: 'Bulwark Warden', cost: 3, rarity: 'Rare',
    effect: 'Boosts a random stat of its linked Hero when set.',
    flavor: 'Set your shields; hold the line.',
  },
  C3: {
    name: 'Gilded Aegis', cost: 4, rarity: 'Epic',
    effect: 'Boosts a random stat of its linked Hero when set.',
    flavor: 'Forged to outlast empires.',
  },
  C4: {
    name: 'Everwall Colossus', cost: 7, rarity: 'Legendary',
    effect: 'Boosts a random stat of its linked Hero when set.',
    flavor: 'The last stone standing when the war is done.',
  },
};

/**
 * Phase 8 Hero library. The player's A-row cards are now real Heroes lifted from
 * the "Fractured Front" set (sheet: full Set Table v2 - stat adjust). Each Hero
 * carries the sheet's stats — HP / DMG / ACC / Armor / Armor Bars — plus its
 * SubType, Allegiance, Level, Unique / Commander flags, and up to three ability
 * rules-text lines. The abilities are DATA ONLY for now (rendered on the card and
 * in the inspection panel); the timing/dispatch engine that executes them lands
 * in a later Phase 8 slice.
 *
 * This is a 14-Hero testing selection: 5 Level-1, 4 Level-2, 4 Level-3, 1 Level-4.
 */
export interface HeroData {
  name: string;
  subType: string;
  allegiance: string;
  level: number;
  hp: number;
  dmg: number;
  acc: number;
  armorBars: number;
  armor: number;
  unique: boolean;
  commander: boolean;
  abilities: string[];
}

export const HERO_LIBRARY: readonly HeroData[] = [
  // ── Level 1 (5) ──
  { name: 'Duneside Scout', subType: 'Recon', allegiance: 'Coalition', level: 1, hp: 80, dmg: 50, acc: 60, armorBars: 0, armor: 0, unique: false, commander: false, abilities: [] },
  { name: 'Echo Reserve', subType: 'Infantry', allegiance: 'Coalition', level: 1, hp: 90, dmg: 60, acc: 60, armorBars: 0, armor: 0, unique: false, commander: false, abilities: ['Echo Assist: All "Echo" Heroes you control gain +10ACC. Only 1 "Echo Assist" Ability can be active on your field at once.'] },
  { name: 'Bobcat Convoy Escort', subType: 'Infantry', allegiance: 'Coalition', level: 1, hp: 70, dmg: 50, acc: 70, armorBars: 0, armor: 10, unique: false, commander: false, abilities: ['Roaming Armor: All "Bobcat" Heroes you control have +10 Armor. Only 1 "Roaming Armor" Ability can be active on your field at once.'] },
  { name: 'Munitions Specialist', subType: 'Heavy', allegiance: 'Coalition', level: 1, hp: 70, dmg: 40, acc: 60, armorBars: 0, armor: 10, unique: false, commander: false, abilities: [] },
  { name: 'Tundra Rifleman', subType: 'Infantry', allegiance: 'Coalition', level: 1, hp: 100, dmg: 40, acc: 80, armorBars: 0, armor: 10, unique: false, commander: false, abilities: [] },
  // ── Level 2 (4) ──
  { name: 'Devil Dog Rifleman', subType: 'Infantry', allegiance: 'Coalition', level: 2, hp: 100, dmg: 70, acc: 70, armorBars: 0, armor: 20, unique: false, commander: false, abilities: ['Devil Dog Reinforcement: At the end of your turn, place 1 counter on this Hero. When this Hero reaches 3 counters: if possible, you can Replen this Hero to Normal Set the top "Devil Dog" Special Hero in your Deck, then disturb your Deck.'] },
  { name: 'Bobcat Air Trooper', subType: 'Infantry', allegiance: 'Coalition', level: 2, hp: 100, dmg: 80, acc: 90, armorBars: 0, armor: 0, unique: false, commander: false, abilities: ['Bobcat Hot Drop: The first time this Hero is used as material to Replen Set a "Bobcat" Hero: return this Hero to your Hand instead. This Hero cannot be Normal Set the same turn this is used.'] },
  { name: 'Suppressive Gunner', subType: 'Heavy', allegiance: 'Coalition', level: 2, hp: 100, dmg: 70, acc: 70, armorBars: 1, armor: 0, unique: false, commander: false, abilities: [] },
  { name: 'Echo Demolitions', subType: 'Heavy', allegiance: 'Coalition', level: 2, hp: 120, dmg: 50, acc: 80, armorBars: 0, armor: 10, unique: false, commander: false, abilities: [] },
  // ── Level 3 (4) ──
  { name: 'Echo 1: Hill', subType: 'Recon', allegiance: 'Coalition', level: 3, hp: 140, dmg: 100, acc: 110, armorBars: 0, armor: 10, unique: true, commander: false, abilities: ['Echo Lead: If you control another "Echo" Hero, this Hero can attack twice per turn. If this Hero is not equipped with a Weapon, the second attack has -20ACC.'] },
  { name: 'Devil Dog 1: Sandman', subType: 'Infantry', allegiance: 'Coalition', level: 3, hp: 130, dmg: 80, acc: 100, armorBars: 0, armor: 20, unique: true, commander: false, abilities: ['Troop Lead: This Hero can be Replen Set with 1 Infantry Hero.', 'Stay Armed: When this Hero is Replen Set, if it is unequipped: equip it with the top Weapon card from your Deck, then disturb your Deck.'] },
  { name: 'Echo 4: Riko', subType: 'Infantry', allegiance: 'Coalition', level: 3, hp: 140, dmg: 80, acc: 100, armorBars: 0, armor: 10, unique: true, commander: false, abilities: ['Rapid Deployment: This Hero can be Normal Set.', 'Quick Reload: Once per turn, you can send 1 card from your Hand to Replen: select another Infantry Hero you control to gain +20ACC.'] },
  { name: 'Trained Combat Doctor', subType: 'Medic', allegiance: 'Coalition', level: 3, hp: 130, dmg: 70, acc: 90, armorBars: 0, armor: 10, unique: false, commander: false, abilities: ["Frontline Medic: If a Hero you control was eliminated during your opponent's previous turn, you can send 1 Hero from your Hand to Replen. If you do, Normal Set 1 Hero from your Graveyard on your field with half of its maximum HP.", 'Endurance Training: If equipped with a Weapon, this hero heals 10HP per turn.'] },
  // ── Level 4 (1) ──
  { name: 'Snow Viper', subType: 'Recon', allegiance: 'Coalition', level: 4, hp: 180, dmg: 90, acc: 140, armorBars: 0, armor: 20, unique: true, commander: true, abilities: ['Bunker Busting Round: Once per turn, if this Hero lands a Successful Hit: you can break all Armor Bars on the target Hero. If you do, no damage is inflicted.', 'Pink Mist: Once per turn, if this Hero inflicts damage with a Critical Hit: this Hero can attack again.', 'Hidden Finisher: If this Hero lands a Successful Hit against a Normal Hero with less than half HP: eliminate that Hero instantly.'] },
];

/** Rarity accent chosen by Hero level so higher-level Heroes read as rarer. */
const RARITY_BY_LEVEL: Record<number, Rarity> = { 1: 'Common', 2: 'Rare', 3: 'Epic', 4: 'Legendary' };

/**
 * Expand a {@link HeroData} row into the full card profile the game consumes.
 * `effect` is the joined ability text (so the existing card-face + panel effect
 * blocks render it); the structured `abilities` array drives richer display.
 */
export function heroProfile(h: HeroData): Omit<Card, 'id' | 'type'> {
  return {
    name: h.name,
    cost: h.level,
    level: h.level,
    ...(h.commander ? { commander: true } : {}),
    dmg: h.dmg,
    acc: h.acc,
    hp: h.hp,
    subType: h.subType,
    allegiance: h.allegiance,
    armor: h.armor,
    armorBars: h.armorBars,
    ...(h.unique ? { unique: true } : {}),
    ...(h.abilities.length ? { abilities: h.abilities } : {}),
    rarity: RARITY_BY_LEVEL[h.level] ?? 'Common',
    effect: h.abilities.length ? h.abilities.join('\n\n') : 'No special ability.',
    flavor: `${h.allegiance} · ${h.subType}`,
  };
}

/** The support families that remain index-built from {@link CARD_LIBRARY}: the
 * A-row is now supplied by {@link HERO_LIBRARY} instead. */
export const SUPPORT_TYPES: readonly CardType[] = ['B', 'C'];

/** Slots per type family. */
export const SLOTS_PER_TYPE = 4;

/**
 * All 12 slot ids. Grouped by type family (A1..A4, B1..B4, C1..C4). Order here
 * only affects iteration (empty-slot listing, highlight scans), not layout.
 */
export const SLOT_IDS: readonly SlotId[] = CARD_TYPES.flatMap((t) =>
  Array.from({ length: SLOTS_PER_TYPE }, (_, i) => `${t}${i + 1}` as SlotId),
);

/** Phase 8 deck size: 14 Heroes (A) plus 4 B + 4 C support cards. */
export const DECK_SIZE = HERO_LIBRARY.length + SUPPORT_TYPES.length * SLOTS_PER_TYPE;

/** Cards drawn automatically on start. */
export const OPENING_HAND_SIZE = 5;

/** Build the 8 support (Ability/Equipment) cards for a deck. `makeId` maps a
 * semantic suffix (e.g. `ability-1`) to the full id under the deck's namespace. */
function buildSupportCards(makeId: (suffix: string) => CardId): {
  cards: Record<CardId, Card>;
  deck: CardId[];
} {
  const cards: Record<CardId, Card> = {};
  const deck: CardId[] = [];
  for (let i = 1; i <= SLOTS_PER_TYPE; i++) {
    for (const type of SUPPORT_TYPES) {
      const key = `${type}${i}`;
      const id = makeId(`${TYPE_ID_WORD[type]}-${i}`);
      cards[id] = { id, type, ...CARD_LIBRARY[key] };
      deck.push(id);
    }
  }
  return { cards, deck };
}

/**
 * Build the Phase 8 player deck: 14 Heroes (A-row) + 4 Ability + 4 Equipment
 * support cards. Ids are semantic: `card-hero-N`, `card-ability-N`,
 * `card-equipment-N`.
 *
 * Deck order is bottom-to-top (last element = top = drawn first). Support cards
 * sit at the bottom; Heroes are stacked on top ordered by level DESCENDING so the
 * top of the deck — and therefore the opening hand — holds the low-level Heroes
 * that can be Normal Set without a tribute.
 */
export function createInitialCards(): {
  cardsById: Record<CardId, Card>;
  deck: CardId[];
} {
  const { cards: cardsById, deck } = buildSupportCards((suffix) => `card-${suffix}` as CardId);
  const heroOrder = HERO_LIBRARY.map((h, i) => ({ h, i })).sort((a, b) => b.h.level - a.h.level);
  for (const { h, i } of heroOrder) {
    const id: CardId = `card-hero-${i + 1}`;
    cardsById[id] = { id, type: 'A', ...heroProfile(h) };
    deck.push(id);
  }
  return { cardsById, deck };
}

/** A fresh empty board: all 12 typed slots unoccupied. */
export function createEmptyBoard(): GameState['board'] {
  return Object.fromEntries(SLOT_IDS.map((id) => [id, null])) as GameState['board'];
}

/**
 * Build the opponent's field for the simulation. Phase 7 Slice 4: the opponent
 * now starts with an EMPTY board and summons its own cards from its hand over
 * the course of its turns (the old pre-seeded O1–O3 dummy Heroes are retired).
 * The `opponentCards` lookup is populated entirely by {@link createOpponentDeck}.
 */
export function createInitialOpponents(): {
  opponentBoard: GameState['opponentBoard'];
} {
  return { opponentBoard: { O1: null, O2: null, O3: null, O4: null } };
}

/** Card id for a card in the opponent's own deck (Phase 7). Distinct namespace
 * from the player's `card-*` ids and the seeded `opp-O*` target ids. */
export function opponentDeckCardId(suffix: string): CardId {
  return `opp-deck-${suffix}`;
}

/**
 * Build the opponent's own deck (Phase 8): a mirror of the player's deck — the
 * same 14 Heroes + 4 Ability + 4 Equipment — under the `opp-deck-*` id namespace,
 * shuffled. Returned cards are merged into the opponent card lookup so the same
 * rendering and rules machinery can read them.
 */
export function createOpponentDeck(rand: () => number = Math.random): {
  cards: Record<CardId, Card>;
  deck: CardId[];
} {
  const { cards, deck } = buildSupportCards((suffix) => opponentDeckCardId(suffix));
  HERO_LIBRARY.forEach((h, i) => {
    const id = opponentDeckCardId(`hero-${i + 1}`);
    cards[id] = { id, type: 'A', ...heroProfile(h) };
    deck.push(id);
  });
  return { cards, deck: shuffleArray(deck, rand) };
}

/** A fresh empty opponent Ability (B) row: all four OB slots unoccupied. */
export function createEmptyOppBBoard(): GameState['opponentBBoard'] {
  return { OB1: null, OB2: null, OB3: null, OB4: null };
}

/** A fresh empty opponent Equipment (C) row: all four OC slots unoccupied. */
export function createEmptyOppCBoard(): GameState['opponentCBoard'] {
  return { OC1: null, OC2: null, OC3: null, OC4: null };
}

/** A fresh Phase 2 game state: full deck, empty hand, empty board, no drag. */
export function createInitialState(): GameState {
  const { cardsById, deck } = createInitialCards();
  const { opponentBoard } = createInitialOpponents();
  const oppDeck = createOpponentDeck();
  // Deal the opponent its opening hand off the top of its own deck (mirror of
  // the player's opening five). The remaining cards stay in the draw pile.
  const opponentDeck = [...oppDeck.deck];
  const opponentHand = opponentDeck.splice(opponentDeck.length - OPENING_HAND_SIZE, OPENING_HAND_SIZE).reverse();
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
    pendingSummon: null,
    turn: 1,
    phase: 'draw',
    activePlayer: 'player',
    phaseAnnounce: 0,
    opponentCards: oppDeck.cards,
    opponentBoard,
    opponentGraveyard: [],
    opponentDeck,
    opponentHand,
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
    currentArmorBars: {},
    destroying: [],
    oppAttackTargets: {},
    oppResolutionRolls: {},
    oppResolutionResults: {},
    oppOutcomePopups: {},
    oppDamagePopups: {},
    oppDestroying: [],
    oppSummon: null,
  };
}

