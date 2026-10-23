import type { Card, CardId, CardType, GameState, Rarity, SlotId } from './types';
import { shuffleArray } from './shuffle';

/** The three typed families, in canonical order. A = Hero, B = Ability, C = Equipment. */
export const CARD_TYPES: readonly CardType[] = ['A', 'B', 'C'];

/** Semantic word used in generated card ids per family: `card-hero-1`,
 * `card-ability-2`, `card-equipment-3` (and the `opp-deck-*` mirror). */
export const TYPE_ID_WORD: Record<CardType, string> = {
  A: 'hero',
  B: 'ability',
  C: 'equipment',
};

/**
 * Phase 8 "Fractured Front" set (sheet: full Set Table v3 - stat adjust). The
 * full card catalog now lives in code as three libraries — Heroes (A), Equipment
 * (C) and Ability cards (B) — 59 + 20 + 20 = 99 cards. Abilities/effects are DATA
 * ONLY for now (rendered on the card + in the inspection panel); the timing and
 * dispatch engine that executes them lands in a later Phase 8 slice.
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

/** Equipment (C) card row. `weaponClass` is set only for Weapon-subtype gear. */
export interface EquipmentData {
  name: string;
  subType: string; // Weapon | Armor | Loadout
  weaponClass: string; // Assault | Precision | Suppressive | Breach | '' (non-Weapon)
  unique: boolean;
  abilities: string[];
}

/** Ability (B) card row. `timing` gates the play window: Main | Battle | Cont. */
export interface AbilityCardData {
  name: string;
  timing: string;
  text: string;
}

/** One line of a decklist: a catalog card name plus how many copies it contributes. */
export interface DeckEntry {
  name: string;
  count: number;
}

export const HERO_LIBRARY: readonly HeroData[] = [
  { name: "Tundra Rifleman", subType: "Infantry", allegiance: "Coalition", level: 1, hp: 100, dmg: 40, acc: 80, armorBars: 0, armor: 10, unique: false, commander: false, abilities: [] },
  { name: "Snowline Trooper", subType: "Infantry", allegiance: "Coalition", level: 1, hp: 100, dmg: 60, acc: 60, armorBars: 0, armor: 0, unique: false, commander: false, abilities: [] },
  { name: "Echo Reserve", subType: "Infantry", allegiance: "Coalition", level: 1, hp: 90, dmg: 60, acc: 60, armorBars: 0, armor: 0, unique: false, commander: false, abilities: ["Echo Assist: While this Hero is on your field, all \"Echo\" Heroes you control gain +10 ACC. Only 1 \"Echo Assist\" Ability can be active on your field at once."] },
  { name: "Wasteland Soldier", subType: "Infantry", allegiance: "Dictate", level: 1, hp: 80, dmg: 50, acc: 70, armorBars: 0, armor: 10, unique: false, commander: false, abilities: [] },
  { name: "Devil Dog Rear Guard", subType: "Infantry", allegiance: "Coalition", level: 1, hp: 80, dmg: 50, acc: 70, armorBars: 0, armor: 10, unique: false, commander: false, abilities: ["Sandstorm Inbound: While you control another \"Devil Dog\" Hero, enemy Heroes have -10 ACC. Only 1 \"Sandstorm Inbound\" Ability can be active on your field at once."] },
  { name: "Back Alley Patrolman", subType: "Infantry", allegiance: "Dictate", level: 1, hp: 70, dmg: 60, acc: 70, armorBars: 0, armor: 0, unique: false, commander: false, abilities: [] },
  { name: "Zero Path Escort", subType: "Infantry", allegiance: "Dictate", level: 1, hp: 80, dmg: 60, acc: 60, armorBars: 0, armor: 0, unique: false, commander: false, abilities: ["Zero Guide: Each time this Hero inflicts damage on an enemy Hero, place 1 counter on this Hero. When this Hero reaches 3 counters, send this Hero to the GY, then Normal Set the top \"Zero\" Special Hero from your Deck; Disturb your Deck."] },
  { name: "Jackal Air Scout", subType: "Recon", allegiance: "Dictate", level: 1, hp: 70, dmg: 40, acc: 70, armorBars: 0, armor: 0, unique: false, commander: false, abilities: ["Jackal Sight: While this Hero is on your field, all \"Jackal\" Heroes you control gain +20 ACC. Only 1 \"Jackal Sight\" Ability can be active on your field at once."] },
  { name: "Ridgewatch Sniper", subType: "Recon", allegiance: "Coalition", level: 1, hp: 50, dmg: 70, acc: 80, armorBars: 0, armor: 0, unique: false, commander: false, abilities: [] },
  { name: "Forward Spotter", subType: "Recon", allegiance: "Coalition", level: 1, hp: 60, dmg: 40, acc: 60, armorBars: 0, armor: 0, unique: false, commander: false, abilities: ["Range Finder: While this Hero is on your field, all Coalition Recon Heroes you control gain +10 ACC. Only 1 \"Range Finder\" Ability can be active on your field at once."] },
  { name: "Duneside Scout", subType: "Recon", allegiance: "Coalition", level: 1, hp: 80, dmg: 50, acc: 60, armorBars: 0, armor: 0, unique: false, commander: false, abilities: [] },
  { name: "Midnight Marksman", subType: "Recon", allegiance: "Dictate", level: 1, hp: 60, dmg: 50, acc: 70, armorBars: 0, armor: 0, unique: false, commander: false, abilities: ["Moonrise Ambush: While you control \"Daybreak Marksman\", each time \"Daybreak Marksman\" attacks, this Hero can make 1 additional attack against the same target."] },
  { name: "Daybreak Marksman", subType: "Recon", allegiance: "Dictate", level: 1, hp: 60, dmg: 50, acc: 70, armorBars: 0, armor: 0, unique: false, commander: false, abilities: ["Sunrise Ambush: While you control \"Midnight Marksman\", once per turn, you can discard up to 2 cards from your Hand: this Hero can make 1 additional attack this turn for each card discarded."] },
  { name: "Squad Gunner", subType: "Heavy", allegiance: "Dictate", level: 1, hp: 80, dmg: 40, acc: 60, armorBars: 0, armor: 10, unique: false, commander: false, abilities: [] },
  { name: "Siege Gunner", subType: "Heavy", allegiance: "Coalition", level: 1, hp: 80, dmg: 30, acc: 60, armorBars: 0, armor: 10, unique: false, commander: false, abilities: ["Recoil Specialist: While this Hero is equipped with a Suppressive Weapon, this Hero gains +20 DMG."] },
  { name: "Field Hacker", subType: "Engineer", allegiance: "Dictate", level: 1, hp: 80, dmg: 80, acc: 80, armorBars: 0, armor: 10, unique: false, commander: false, abilities: ["Supply Disruption: When this Hero is Normal Set, randomly select 1 card from your opponent's Hand and send that card to Replen."] },
  { name: "Arctic Paratrooper", subType: "Infantry", allegiance: "Coalition", level: 2, hp: 120, dmg: 80, acc: 80, armorBars: 0, armor: 0, unique: false, commander: false, abilities: [] },
  { name: "Rustfield Medic", subType: "Medic", allegiance: "Dictate", level: 1, hp: 60, dmg: 30, acc: 60, armorBars: 0, armor: 10, unique: false, commander: false, abilities: [] },
  { name: "Devil Dog Rifleman", subType: "Infantry", allegiance: "Coalition", level: 2, hp: 100, dmg: 70, acc: 70, armorBars: 0, armor: 20, unique: false, commander: false, abilities: ["Devil Dog Reinforcement: At the end of your turn, place 1 counter on this Hero. When this Hero reaches 3 counters, you can send this Hero to Replen: Normal Set the top \"Devil Dog\" Special Hero from your Deck, then Disturb your Deck."] },
  { name: "Dictate Frontliner", subType: "Infantry", allegiance: "Dictate", level: 2, hp: 90, dmg: 70, acc: 60, armorBars: 0, armor: 20, unique: false, commander: false, abilities: ["Dictate Squaddie: While you control another \"Dictate\" Infantry Hero, this Hero gains +20 ACC."] },
  { name: "Sprint Shooter", subType: "Infantry", allegiance: "Dictate", level: 2, hp: 80, dmg: 70, acc: 100, armorBars: 0, armor: 10, unique: false, commander: false, abilities: [] },
  { name: "Subzero Marksman", subType: "Recon", allegiance: "Coalition", level: 2, hp: 60, dmg: 90, acc: 100, armorBars: 0, armor: 0, unique: false, commander: false, abilities: ["Target Acquired: While you control another Coalition Hero, this Hero gains +20 ACC; while that Hero is also \"Echo\", this Hero gains an additional +20 ACC."] },
  { name: "Hooded Rifleman", subType: "Infantry", allegiance: "Dictate", level: 2, hp: 90, dmg: 70, acc: 90, armorBars: 0, armor: 0, unique: false, commander: false, abilities: [] },
  { name: "Sandhill Scout", subType: "Recon", allegiance: "Coalition", level: 2, hp: 60, dmg: 50, acc: 90, armorBars: 0, armor: 0, unique: false, commander: false, abilities: ["Devil Dog Focus Fire: While this Hero is on your field, all \"Devil Dog\" Heroes you control gain +10 Armor. Only 1 \"Devil Dog Focus Fire\" Ability can be active on your field at once."] },
  { name: "Roadblock Gunner", subType: "Heavy", allegiance: "Coalition", level: 2, hp: 100, dmg: 40, acc: 80, armorBars: 0, armor: 20, unique: false, commander: false, abilities: [] },
  { name: "Echo Demolitions", subType: "Heavy", allegiance: "Coalition", level: 2, hp: 120, dmg: 50, acc: 80, armorBars: 0, armor: 10, unique: false, commander: false, abilities: [] },
  { name: "Blackbook Sniper", subType: "Recon", allegiance: "Dictate", level: 2, hp: 70, dmg: 80, acc: 80, armorBars: 0, armor: 10, unique: false, commander: false, abilities: [] },
  { name: "Suppressive Gunner", subType: "Heavy", allegiance: "Coalition", level: 2, hp: 100, dmg: 70, acc: 70, armorBars: 1, armor: 0, unique: false, commander: false, abilities: [] },
  { name: "Glacial Engineer", subType: "Engineer", allegiance: "Coalition", level: 2, hp: 90, dmg: 70, acc: 80, armorBars: 0, armor: 10, unique: false, commander: false, abilities: ["Forward Intel: When this Hero is Normal Set, look at the top 3 cards of your Deck, then return them to the top of your Deck in any order."] },
  { name: "Siege Technician", subType: "Engineer", allegiance: "Coalition", level: 2, hp: 90, dmg: 80, acc: 90, armorBars: 0, armor: 10, unique: false, commander: false, abilities: [] },
  { name: "Drone Scout", subType: "Recon", allegiance: "Dictate", level: 2, hp: 80, dmg: 60, acc: 80, armorBars: 0, armor: 10, unique: false, commander: false, abilities: [] },
  { name: "Shield of Zero", subType: "Heavy", allegiance: "Dictate", level: 2, hp: 110, dmg: 40, acc: 70, armorBars: 1, armor: 20, unique: false, commander: false, abilities: ["Ballistic Soak: While this Hero is on your field, other \"Zero\" Heroes you control cannot be targeted for attacks."] },
  { name: "Plated Paratrooper", subType: "Heavy", allegiance: "Dictate", level: 2, hp: 90, dmg: 60, acc: 80, armorBars: 0, armor: 20, unique: false, commander: false, abilities: [] },
  { name: "Jackal Infiltrator", subType: "Engineer", allegiance: "Dictate", level: 2, hp: 80, dmg: 70, acc: 70, armorBars: 0, armor: 20, unique: false, commander: false, abilities: ["Shadow Hack: When this Hero is used as material to Replen Set a \"Jackal\" Hero, you can send this Hero to the GY, then send the top card of your opponent's Deck to Replen."] },
  { name: "Drone Engineer", subType: "Engineer", allegiance: "Dictate", level: 2, hp: 60, dmg: 90, acc: 70, armorBars: 0, armor: 10, unique: false, commander: false, abilities: ["Drone Ops: While this Hero is equipped with a \"Drone\" Loadout, this Hero gains +20 ACC; while you control \"Drone Scout\", this Hero gains an additional +20 ACC."] },
  { name: "Logistics Tech", subType: "Engineer", allegiance: "Dictate", level: 2, hp: 90, dmg: 70, acc: 70, armorBars: 0, armor: 10, unique: false, commander: false, abilities: [] },
  { name: "Masked Nurse", subType: "Medic", allegiance: "Dictate", level: 2, hp: 80, dmg: 40, acc: 80, armorBars: 0, armor: 10, unique: false, commander: false, abilities: ["Urgent Treatment: Once per turn, you can send 1 card from your Replen to the GY: select 1 Hero you control; that Hero recovers 30 HP."] },
  { name: "Recovery Medic", subType: "Medic", allegiance: "Coalition", level: 2, hp: 80, dmg: 60, acc: 60, armorBars: 0, armor: 10, unique: false, commander: false, abilities: ["First Aid Patch: Once per turn, select 1 Hero you control; that Hero recovers 10 HP."] },
  { name: "Frostline Medic", subType: "Medic", allegiance: "Coalition", level: 2, hp: 70, dmg: 50, acc: 70, armorBars: 0, armor: 10, unique: false, commander: false, abilities: ["First Aid Kit: Once per turn, you can discard 1 card: select 1 Hero you control; that Hero recovers 30 HP."] },
  { name: "Echo 1: Hill", subType: "Recon", allegiance: "Coalition", level: 3, hp: 140, dmg: 90, acc: 110, armorBars: 0, armor: 10, unique: true, commander: false, abilities: ["Echo Lead: While you control another \"Echo\" Hero, this Hero can attack twice per turn; while this Hero is not equipped with a Weapon, the second attack has -20 ACC."] },
  { name: "Echo 2: Kodiak", subType: "Heavy", allegiance: "Coalition", level: 3, hp: 170, dmg: 80, acc: 70, armorBars: 1, armor: 20, unique: true, commander: false, abilities: ["Polar Presence: While you control another \"Echo\" Hero, enemy Heroes can only target this Hero for attacks, if able.", "Oppressive Fire: While this Hero is equipped with a Suppressive or Assault Weapon, this Hero gains +10 DMG."] },
  { name: "Echo 3: Parka", subType: "Recon", allegiance: "Coalition", level: 3, hp: 120, dmg: 100, acc: 120, armorBars: 0, armor: 0, unique: true, commander: false, abilities: ["Whiteout: While this Hero is equipped with a Precision Weapon, when this Hero inflicts damage, this Hero cannot be targeted for attacks during your opponent's next turn.", "Disruptive Precision: Once per turn, you can have this Hero target an equipped enemy Weapon instead of a Hero; when the attack is a Successful Hit, destroy that Weapon."] },
  { name: "Echo 4: Riko", subType: "Infantry", allegiance: "Coalition", level: 3, hp: 140, dmg: 80, acc: 100, armorBars: 0, armor: 10, unique: true, commander: false, abilities: ["Rapid Deployment: This Hero can be Normal Set.", "Quick Reload: Once per turn, you can send 1 card from your Hand to Replen: select another Infantry Hero you control; that Hero gains +20 ACC."] },
  { name: "Zero-Soldier", subType: "Infantry", allegiance: "Dictate", level: 3, hp: 140, dmg: 90, acc: 80, armorBars: 0, armor: 20, unique: true, commander: false, abilities: ["Unnerving Survival: Once per turn, when this Hero is sent from your Hand or Replen to the GY, you can Normal Set this Hero.", "Zero Assault: While this Hero is on your field, all \"Zero\" Heroes you control gain +20 DMG."] },
  { name: "Zero-Head", subType: "Recon", allegiance: "Dictate", level: 3, hp: 110, dmg: 90, acc: 110, armorBars: 0, armor: 0, unique: true, commander: false, abilities: ["Make An Example: Once per turn, when this Hero inflicts damage on an enemy Hero, that Hero cannot attack during your opponent's next turn.", "Proto-Sights: While you control a Dictate Engineer Hero, this Hero gains +20 ACC."] },
  { name: "Zero-Comm", subType: "Engineer", allegiance: "Dictate", level: 3, hp: 120, dmg: 80, acc: 110, armorBars: 0, armor: 20, unique: true, commander: false, abilities: ["Field Disruption: When this Hero is Normal Set or Replen Set, you can select 1 Equipment on your opponent's field and send that Equipment to Replen.", "Disconnected Comms: While this Hero is on your field, your opponent can only play 1 Ability Card per turn."] },
  { name: "Zero-Loss", subType: "Engineer", allegiance: "Dictate", level: 3, hp: 110, dmg: 80, acc: 90, armorBars: 0, armor: 10, unique: true, commander: false, abilities: ["Continuation: Once per turn, you can destroy this Hero: Normal Set the top \"Zero\" Special Hero from your Deck, then Disturb your Deck."] },
  { name: "King, Jackal Lead", subType: "Infantry", allegiance: "Dictate", level: 3, hp: 140, dmg: 100, acc: 100, armorBars: 0, armor: 20, unique: true, commander: false, abilities: ["By Any Means: Once per turn, you can send 1 other \"Dictate\" Hero you control to Replen: this Hero can make 1 additional attack this turn.", "Weapon Required: This Hero cannot attack unless this Hero is equipped with a Weapon."] },
  { name: "Roma, Jackal Sharpshooter", subType: "Recon", allegiance: "Dictate", level: 3, hp: 110, dmg: 100, acc: 100, armorBars: 0, armor: 10, unique: true, commander: false, abilities: ["Wasteland Deadeye: Once per turn, you can discard 1 card from your Hand: this Hero gains +30 ACC until the end of your turn.", "Weapon Required: This Hero cannot attack unless this Hero is equipped with a Weapon."] },
  { name: "Bison, The Jackal Wall", subType: "Heavy", allegiance: "Dictate", level: 3, hp: 180, dmg: 50, acc: 90, armorBars: 2, armor: 30, unique: true, commander: false, abilities: ["Armored Aggro: Once per turn, you can destroy 1 other Hero you control: enemy Heroes can only target this Hero for attacks, if able, during your opponent's next turn."] },
  { name: "Byrd, Jackal Support", subType: "Engineer", allegiance: "Dictate", level: 3, hp: 100, dmg: 90, acc: 100, armorBars: 0, armor: 20, unique: true, commander: false, abilities: ["Extra Baggage: When this Hero is Replen Set, draw 1 card.", "Jackal Reinforcement: Once per turn, you can discard 1 card from your Hand: select 1 Hero in your GY and send that Hero to Replen."] },
  { name: "Devil Dog 1: Sandman", subType: "Infantry", allegiance: "Coalition", level: 3, hp: 130, dmg: 80, acc: 100, armorBars: 0, armor: 20, unique: true, commander: false, abilities: ["Troop Lead: This Hero can be Replen Set with 1 Infantry Hero.", "Stay Armed: When this Hero is Replen Set, if this Hero is unequipped, equip this Hero with the top Weapon card from your Deck, then Disturb your Deck."] },
  { name: "Devil Dog 2: Mammoth", subType: "Heavy", allegiance: "Coalition", level: 3, hp: 170, dmg: 50, acc: 50, armorBars: 1, armor: 20, unique: true, commander: false, abilities: ["Shell Up: Once per turn, you can discard 1 card from your Hand: this Hero's Armor Bars cannot be reduced during your opponent's next turn."] },
  { name: "Devil Dog 3: Ogre", subType: "Engineer", allegiance: "Coalition", level: 3, hp: 130, dmg: 80, acc: 90, armorBars: 0, armor: 10, unique: true, commander: false, abilities: ["Scavenge The Dead: At the end of your turn, draw cards equal to the number of enemy Heroes eliminated or destroyed this turn, up to 2."] },
  { name: "Devil Dog 4: Brick", subType: "Recon", allegiance: "Coalition", level: 3, hp: 110, dmg: 80, acc: 120, armorBars: 0, armor: 10, unique: true, commander: false, abilities: ["Unconfirmed Kill: The first time this Hero is sent from your Hand to the GY, Normal Set this Hero.", "Holo-Target: Once per turn, select 1 enemy Hero; Heroes you control gain +10 ACC when attacking that Hero."] },
  { name: "Gladiator", subType: "Infantry", allegiance: "Dictate", level: 4, hp: 190, dmg: 100, acc: 110, armorBars: 1, armor: 20, unique: true, commander: true, abilities: ["Domination: When this Hero is Commit Set, destroy all Human Normal Heroes on your opponent's field.", "Overpower: While this Hero is on your field, each time you activate an Ability Card, this Hero gains +30 ACC until the end of your turn."] },
  { name: "Snow Viper", subType: "Recon", allegiance: "Coalition", level: 4, hp: 180, dmg: 90, acc: 140, armorBars: 0, armor: 20, unique: true, commander: true, abilities: ["Bunker Busting Round: Once per turn, when this Hero lands a Successful Hit, you can break all Armor Bars on the target Hero; if you do, no damage is inflicted.", "Pink Mist: Once per turn, when this Hero inflicts damage with a Critical Hit, this Hero can make 1 additional attack this turn.", "Hidden Finisher: When this Hero lands a Successful Hit against a Normal Hero with less than half HP, eliminate that Hero."] },
  { name: "Killswitch", subType: "Engineer", allegiance: "Dictate", level: 4, hp: 180, dmg: 80, acc: 110, armorBars: 1, armor: 40, unique: true, commander: true, abilities: ["Reclaim Ops: When this Hero is Set, you can select 1 Ability Card in your GY and add that card to your Hand.", "Dictate Call-In: Once per turn, you can reveal the top 3 cards of your Deck, Normal Set 1 \"Dictate\" Normal Hero among them, then send the remaining cards to Replen.", "Comm Jam: While this Hero is on your field, your opponent cannot activate Continuous Ability Cards."] },
  { name: "Goliath", subType: "Heavy", allegiance: "Coalition", level: 4, hp: 240, dmg: 60, acc: 80, armorBars: 2, armor: 30, unique: true, commander: true, abilities: ["Heavy Suppression: Once per turn, select up to 2 enemy Heroes; those Heroes have -20 ACC during your opponent's next turn.", "Shock Deployment: If only Coalition Heavy Heroes were used to Commit Set this Hero, this Hero can attack during the turn this Hero is Commit Set.", "Iron Wall: Once per turn, you can discard the top card of your Deck: enemy Heroes can only target this Hero for attacks, if able, during your opponent's next turn."] },
];

export const EQUIPMENT_LIBRARY: readonly EquipmentData[] = [
  { name: "CCR", subType: "Weapon", weaponClass: "Assault", unique: false, abilities: [] },
  { name: "Kevlar Vest", subType: "Armor", weaponClass: "", unique: false, abilities: [] },
  { name: "AX15", subType: "Weapon", weaponClass: "Assault", unique: false, abilities: [] },
  { name: "Tactical Plate Carrier", subType: "Armor", weaponClass: "", unique: false, abilities: [] },
  { name: "Wingman", subType: "Weapon", weaponClass: "Assault", unique: false, abilities: ["The first time this Weapon is sent to the GY, return it to your Hand instead."] },
  { name: "Assault Suit", subType: "Armor", weaponClass: "", unique: false, abilities: [] },
  { name: "Tankwalker", subType: "Armor", weaponClass: "", unique: false, abilities: ["Incoming damage from Heroes not equipped with a Weapon is reduced by 20."] },
  { name: "Ballistic Armor Plate", subType: "Loadout", weaponClass: "", unique: false, abilities: ["Can only be equipped to Human Heroes. This Hero gains an additional Armor Bar. When that Armor Bar is destroyed, destroy this card."] },
  { name: "PSR", subType: "Weapon", weaponClass: "Precision", unique: false, abilities: [] },
  { name: "Deployable Cover", subType: "Loadout", weaponClass: "", unique: false, abilities: ["When this Hero would take incoming damage, you can destroy this card, then reduce that incoming damage by 40."] },
  { name: "Headhunter", subType: "Weapon", weaponClass: "Precision", unique: false, abilities: ["When this Hero rolls a Critical Hit against a target with no Armor Bars, eliminate that Hero."] },
  { name: "Thermal Recon Drone", subType: "Loadout", weaponClass: "", unique: false, abilities: ["All Heroes on your field gain +10 ACC for each Hero on your opponent's field."] },
  { name: "SAR", subType: "Weapon", weaponClass: "Suppressive", unique: false, abilities: [] },
  { name: "BFR40", subType: "Weapon", weaponClass: "Suppressive", unique: false, abilities: [] },
  { name: "High-Ground Deployment", subType: "Loadout", weaponClass: "", unique: false, abilities: ["Can only be equipped to Human Recon Heroes. This Hero cannot be targeted for attacks by Heroes that are not equipped with a Weapon."] },
  { name: "Anvil", subType: "Weapon", weaponClass: "Suppressive", unique: true, abilities: ["This Hero's Normal Hits ignore Armor Bars.", "When this Hero eliminates an enemy Hero, your opponent discards 1 random card."] },
  { name: "Whisper", subType: "Weapon", weaponClass: "Breach", unique: false, abilities: ["When this Hero lands a Successful Hit, this Hero cannot be targeted for attacks during your opponent's next turn."] },
  { name: "Mobile Ammo Carrier", subType: "Loadout", weaponClass: "", unique: false, abilities: ["During your Battle Phase, after a Hero you control rolls a Successful Hit and deals damage, you can destroy this card, then that Hero can make 1 additional attack this turn."] },
  { name: "AX12", subType: "Weapon", weaponClass: "Breach", unique: false, abilities: [] },
  { name: "Medi-Gel Vest", subType: "Armor", weaponClass: "", unique: false, abilities: ["While equipped to a Medic Hero, this Hero gains an additional 40 HP."] },
];

export const ABILITY_LIBRARY: readonly AbilityCardData[] = [
  { name: "Snowmobile Transport", timing: "Main", text: "Reveal the top 5 cards of your Deck. Add 1 \"Echo\" Hero from among them to your Hand. Send the remaining cards to Replen." },
  { name: "10x Scope", timing: "Battle", text: "Select 1 Hero you control equipped with a Precision Weapon. That Hero gains +20 ACC until the end of your turn. Only 1 \"10x Scope\" Ability can be used on a Hero at once." },
  { name: "Wind Adjustments", timing: "Battle", text: "Recon Heroes you control gain +20 ACC until the end of your turn. Only 1 \"Wind Adjustments\" Ability can be used per turn." },
  { name: "Ruined Patrol", timing: "Battle", text: "Reveal the top 3 Heroes from your Deck. Send 2 to the GY and 1 to Replen. Then, draw the top \"Jackal\" Hero from your Deck. Disturb your Deck." },
  { name: "Team Contingency", timing: "Main", text: "Send 1 Hero from your Hand or field to the GY, then draw the top Hero from your Deck that is part of the same Allegiance. Disturb your Deck." },
  { name: "Man Down!", timing: "Main", text: "If a Coalition Hero on your field was destroyed or eliminated last turn, draw the top Coalition Medic Hero from your Deck. Disturb your Deck." },
  { name: "Dictate Reinforcement", timing: "Main", text: "Send 1 card from your Hand to the GY, then draw the top Dictate Hero from your Deck. Disturb your Deck." },
  { name: "Convoy Incoming", timing: "Main", text: "Send 1 card from your Hand to the GY. Draw the top \"Devil Dog\" Hero from your Deck. Disturb your Deck." },
  { name: "Big Weapon Drop", timing: "Main", text: "Select 1 Heavy Hero you control. Equip the top Suppressive Weapon from your Deck to that Hero. Disturb your Deck." },
  { name: "Heavy Loadout Swap", timing: "Main", text: "Send 1 Hero card from your Hand to Replen. Draw the top Heavy Hero from your Deck. Disturb your Deck." },
  { name: "Alliance of Zero", timing: "Main", text: "If a Dictate Hero was sent to your GY last turn, you can add it to your Hand, then send a \"Zero\" Hero from your Hand to the GY." },
  { name: "Target Designation", timing: "Cont.", text: "Once per turn, when you eliminate an enemy Hero, send the top card of your opponent's Deck to the GY. Only 1 \"Target Designation\" Ability can be active on your field at once." },
  { name: "Reinforcement Chopper", timing: "Cont.", text: "Once per turn, place 1 counter on this card. When this card reaches 3 counters, draw the top Coalition Special Hero from your Deck, Disturb your Deck, then destroy this card." },
  { name: "Unfortunate Standoff", timing: "Battle", text: "Select 1 Hero you control and 1 enemy Hero of equal or lower Level. Destroy both Heroes." },
  { name: "Armor Piercing Rounds", timing: "Battle", text: "Select 1 Hero you control. That Hero's attacks ignore Armor Bars and Armor Value until the end of your turn. Only 1 \"Armor Piercing Rounds\" Ability can be used on a Hero at once." },
  { name: "Black Duffle Bag", timing: "Main", text: "Draw the top 2 Weapon cards from your Deck. Disturb your Deck." },
  { name: "Disarm", timing: "Battle", text: "Destroy 1 Weapon your opponent controls." },
  { name: "Battlefield Scavenge", timing: "Cont.", text: "Once per turn, you can add the top card from your Replen pile to your Hand. If you do, place 1 counter on this card. When this card reaches 2 counters, destroy it." },
  { name: "Radio The Troops", timing: "Main", text: "Draw the top Normal Hero from your Deck. Disturb your Deck." },
  { name: "The Armory", timing: "Main", text: "Draw 2 cards from your Deck." },
];

/** COALITION — "Arctic Vanguard" (Echo + Devil Dog): 27 Heroes + 6 Equipment + 7 Ability = 40. */
export const COALITION_DECK: readonly DeckEntry[] = [
  { name: "Tundra Rifleman", count: 3 },
  { name: "Echo Reserve", count: 3 },
  { name: "Devil Dog Rear Guard", count: 2 },
  { name: "Siege Gunner", count: 2 },
  { name: "Ridgewatch Sniper", count: 1 },
  { name: "Arctic Paratrooper", count: 2 },
  { name: "Devil Dog Rifleman", count: 2 },
  { name: "Subzero Marksman", count: 1 },
  { name: "Echo Demolitions", count: 1 },
  { name: "Frostline Medic", count: 1 },
  { name: "Echo 1: Hill", count: 1 },
  { name: "Echo 2: Kodiak", count: 1 },
  { name: "Echo 3: Parka", count: 1 },
  { name: "Echo 4: Riko", count: 1 },
  { name: "Devil Dog 1: Sandman", count: 1 },
  { name: "Devil Dog 2: Mammoth", count: 1 },
  { name: "Devil Dog 3: Ogre", count: 1 },
  { name: "Snow Viper", count: 1 },
  { name: "Goliath", count: 1 },
  { name: "Headhunter", count: 1 },
  { name: "PSR", count: 1 },
  { name: "Anvil", count: 1 },
  { name: "SAR", count: 1 },
  { name: "Tankwalker", count: 1 },
  { name: "Wingman", count: 1 },
  { name: "Snowmobile Transport", count: 1 },
  { name: "Convoy Incoming", count: 2 },
  { name: "Man Down!", count: 1 },
  { name: "Big Weapon Drop", count: 1 },
  { name: "Radio The Troops", count: 1 },
  { name: "The Armory", count: 1 },
];

/** DICTATE — "Iron Dictate" (Zero + Jackal): 27 Heroes + 6 Equipment + 7 Ability = 40. */
export const DICTATE_DECK: readonly DeckEntry[] = [
  { name: "Wasteland Soldier", count: 2 },
  { name: "Zero Path Escort", count: 2 },
  { name: "Jackal Air Scout", count: 2 },
  { name: "Back Alley Patrolman", count: 1 },
  { name: "Midnight Marksman", count: 1 },
  { name: "Daybreak Marksman", count: 1 },
  { name: "Field Hacker", count: 1 },
  { name: "Rustfield Medic", count: 1 },
  { name: "Dictate Frontliner", count: 2 },
  { name: "Sprint Shooter", count: 1 },
  { name: "Shield of Zero", count: 1 },
  { name: "Jackal Infiltrator", count: 1 },
  { name: "Blackbook Sniper", count: 1 },
  { name: "Logistics Tech", count: 1 },
  { name: "Zero-Soldier", count: 1 },
  { name: "Zero-Head", count: 1 },
  { name: "Zero-Comm", count: 1 },
  { name: "Zero-Loss", count: 1 },
  { name: "King, Jackal Lead", count: 1 },
  { name: "Roma, Jackal Sharpshooter", count: 1 },
  { name: "Bison, The Jackal Wall", count: 1 },
  { name: "Gladiator", count: 1 },
  { name: "Killswitch", count: 1 },
  { name: "Whisper", count: 1 },
  { name: "AX12", count: 1 },
  { name: "Headhunter", count: 1 },
  { name: "PSR", count: 1 },
  { name: "SAR", count: 1 },
  { name: "Tankwalker", count: 1 },
  { name: "Dictate Reinforcement", count: 1 },
  { name: "Ruined Patrol", count: 1 },
  { name: "Alliance of Zero", count: 1 },
  { name: "Team Contingency", count: 1 },
  { name: "Black Duffle Bag", count: 1 },
  { name: "Unfortunate Standoff", count: 1 },
  { name: "Disarm", count: 1 },
];

/** Rarity accent chosen by Hero level so higher-level Heroes read as rarer. */
const RARITY_BY_LEVEL: Record<number, Rarity> = { 1: 'Common', 2: 'Rare', 3: 'Epic', 4: 'Legendary' };

/** Lowercase-kebab id slug for a card name (used for the B-card ability key). */
function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Expand a {@link HeroData} row into the full A-card profile the game consumes. */
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
    flavor: `${h.allegiance} \u00b7 ${h.subType}`,
  };
}

/** Expand an {@link EquipmentData} row into a full C-card profile. */
export function equipmentProfile(e: EquipmentData): Omit<Card, 'id' | 'type'> {
  return {
    name: e.name,
    cost: 1,
    subType: e.subType,
    ...(e.weaponClass ? { weaponClass: e.weaponClass } : {}),
    ...(e.unique ? { unique: true } : {}),
    ...(e.abilities.length ? { abilities: e.abilities } : {}),
    rarity: e.unique ? 'Epic' : 'Rare',
    effect: e.abilities.length ? e.abilities.join('\n\n') : 'No special effect.',
    flavor: e.weaponClass ? `${e.weaponClass} ${e.subType}` : `Equipment \u00b7 ${e.subType}`,
  };
}

/** Expand an {@link AbilityCardData} row into a full B-card profile. */
export function abilityProfile(a: AbilityCardData): Omit<Card, 'id' | 'type'> {
  return {
    name: a.name,
    cost: 1,
    timing: a.timing,
    ability: slug(a.name),
    ...(a.timing === 'Cont.' ? { continuous: true } : {}),
    rarity: 'Rare',
    effect: a.text,
    flavor: `Ability \u00b7 ${a.timing}`,
  };
}

/** The two support families (kept for compatibility with older iteration code). */
export const SUPPORT_TYPES: readonly CardType[] = ['B', 'C'];

/** Slots per type family. */
export const SLOTS_PER_TYPE = 4;

/** All 12 slot ids, grouped by family (A1..A4, B1..B4, C1..C4). */
export const SLOT_IDS: readonly SlotId[] = CARD_TYPES.flatMap((t) =>
  Array.from({ length: SLOTS_PER_TYPE }, (_, i) => `${t}${i + 1}` as SlotId),
);

/** Cards drawn automatically on start. */
export const OPENING_HAND_SIZE = 5;

/** Constructed-deck size for both "Fractured Front" decks. */
export const DECK_SIZE = 40;

/**
 * Build the full 99-card catalog under an id namespace. Every Hero / Ability /
 * Equipment gets a canonical id (`<word>-<n>`, 1-based per family). Callers keep
 * the whole catalog in their card lookup so any card can be referenced, and draw
 * a curated {@link DeckEntry} subset for actual play.
 */
export function buildCatalog(makeId: (word: string, n: number) => CardId): Record<CardId, Card> {
  const cards: Record<CardId, Card> = {};
  HERO_LIBRARY.forEach((h, i) => {
    const id = makeId('hero', i + 1);
    cards[id] = { id, type: 'A', ...heroProfile(h) };
  });
  ABILITY_LIBRARY.forEach((a, i) => {
    const id = makeId('ability', i + 1);
    cards[id] = { id, type: 'B', ...abilityProfile(a) };
  });
  EQUIPMENT_LIBRARY.forEach((e, i) => {
    const id = makeId('equipment', i + 1);
    cards[id] = { id, type: 'C', ...equipmentProfile(e) };
  });
  return cards;
}

/**
 * Expand a decklist into concrete card instances against a catalog. The first
 * copy of a card reuses its canonical catalog id; extra copies get suffixed
 * instance ids (`<baseId>-c2`, `-c3`, ...) cloned from the catalog entry.
 */
function buildDeckFromList(
  list: readonly DeckEntry[],
  catalog: Record<CardId, Card>,
): { cards: Record<CardId, Card>; deck: CardId[] } {
  const idByName = new Map<string, CardId>();
  for (const card of Object.values(catalog)) idByName.set(card.name, card.id);
  const cards: Record<CardId, Card> = {};
  const deck: CardId[] = [];
  for (const { name, count } of list) {
    const baseId = idByName.get(name);
    if (!baseId) throw new Error(`Deck references unknown card: ${name}`);
    for (let k = 0; k < count; k++) {
      const id: CardId = k === 0 ? baseId : (`${baseId}-c${k + 1}` as CardId);
      if (k > 0) cards[id] = { ...catalog[baseId], id };
      deck.push(id);
    }
  }
  return { cards, deck };
}

/**
 * Build the player deck: the full catalog registered under `card-*` ids, with the
 * COALITION "Arctic Vanguard" 40-card decklist selected as the draw pile and
 * SHUFFLED on startup. `rand` is injectable so tests can seed a deterministic
 * order; production uses `Math.random`.
 */
export function createInitialCards(rand: () => number = Math.random): {
  cardsById: Record<CardId, Card>;
  deck: CardId[];
} {
  const catalog = buildCatalog((word, n) => `card-${word}-${n}` as CardId);
  const { cards: dup, deck } = buildDeckFromList(COALITION_DECK, catalog);
  const cardsById = { ...catalog, ...dup };
  return { cardsById, deck: shuffleArray(deck, rand) };
}

/** A fresh empty board: all 12 typed slots unoccupied. */
export function createEmptyBoard(): GameState['board'] {
  return Object.fromEntries(SLOT_IDS.map((id) => [id, null])) as GameState['board'];
}

/** The opponent starts with an EMPTY Vanguard row and summons from its own hand. */
export function createInitialOpponents(): {
  opponentBoard: GameState['opponentBoard'];
} {
  return { opponentBoard: { O1: null, O2: null, O3: null, O4: null } };
}

/** Card id for a card in the opponent's own deck. */
export function opponentDeckCardId(suffix: string): CardId {
  return `opp-deck-${suffix}`;
}

/**
 * Build the opponent's deck: the full catalog under the `opp-deck-*` namespace,
 * with the DICTATE "Iron Dictate" 40-card decklist selected and shuffled.
 */
export function createOpponentDeck(rand: () => number = Math.random): {
  cards: Record<CardId, Card>;
  deck: CardId[];
} {
  const catalog = buildCatalog((word, n) => opponentDeckCardId(`${word}-${n}`));
  const { cards: dup, deck } = buildDeckFromList(DICTATE_DECK, catalog);
  return { cards: { ...catalog, ...dup }, deck: shuffleArray(deck, rand) };
}

/** A fresh empty opponent Ability (B) row: all four OB slots unoccupied. */
export function createEmptyOppBBoard(): GameState['opponentBBoard'] {
  return { OB1: null, OB2: null, OB3: null, OB4: null };
}

/** A fresh empty opponent Equipment (C) row: all four OC slots unoccupied. */
export function createEmptyOppCBoard(): GameState['opponentCBoard'] {
  return { OC1: null, OC2: null, OC3: null, OC4: null };
}

/** A fresh game state: full catalog, shuffled Coalition draw pile, empty board,
 *  no drag. `rand` is injectable so tests can seed a deterministic shuffle. */
export function createInitialState(rand: () => number = Math.random): GameState {
  const { cardsById, deck } = createInitialCards(rand);
  const { opponentBoard } = createInitialOpponents();
  const oppDeck = createOpponentDeck(rand);
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
    abilityShowcase: null,
    abilityTargeting: null,
    onSetChoice: null,
    spellCost: null,
    abilityPrompt: null,
    combatPrompt: null,
    pendingCombatQueue: null,
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
    activatedStatBuffs: {},
    turnStatBuffs: {},
    usedActivatedAbilities: {},
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
