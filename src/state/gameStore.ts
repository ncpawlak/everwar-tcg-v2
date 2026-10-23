import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Card, CardId, CardType, DiceState, Difficulty, GameState, OppBSlotId, OppCSlotId, OppSlotId, PileSource, Phase, RollResult, SlotId, Vec3 } from './types';
import { ABILITY_REGISTRY, runEffect } from './abilities';
import { createInitialState, OPENING_HAND_SIZE } from './cardData';
import { cardValue, cheapestHandCard, equipValue, heroValue, pickFreeHero, planAttacks, planEquip, planTribute, shouldMulligan, type TributePlan } from '../ai/opponentAI';
import { canDropCard, requiresTribute, canAffordTribute, validTargetSlots, tributeSetKind } from '../board/slotRules';
import { shuffleArray } from './shuffle';
import {
  effectiveStats,
  opponentEffectiveStats,
  linkedCSlot,
  heroCanAttack,
  heroArmor,
  heroBars,
  heroMaxBars,
  unarmedReduction,
  linkedEquipment,
  slotEquipBonus,
} from './combatStats';
import { resolveRoll, isSpecialHero } from './diceRules';
import { applyArmorToHit } from './armorCombat';
import { parseAbilities, parseAbility } from '../abilities/parseAbility';
import {
  abilityNeedsTarget,
  abilityTargetOptions,
  abilityZones,
  activationFeasible,
  costPickZone,
  playerBoardHeroes,
  abilityMaxTargets,
} from '../abilities/activated';
import { counterAbility, topSpecialOfFamily } from '../abilities/counters';
import type { AbilityIR } from '../abilities/abilityIR';
import { onSentAbilities, pileActivatedAbilityFor } from '../abilities/pile';
import { combatHitAbilities, finisherEliminates, ignoresArmorBars } from '../abilities/combat';
import { matchesDeckSelector, parseSpell, spellCostOptions, tutorPicks, type DeckCardSelector, type SpellIR, type SpellStep } from '../abilities/spells';
import { onSetAbilities, onSetNeedsChoice, onSetChoiceOptions, dominationVictims } from '../abilities/onSet';
import type { SetKind } from '../abilities/abilityIR';
import { OPP_SLOT_IDS } from '../board/boardConfig';
import { MULTI_DRAW_STAGGER_MS } from '../animation/motionConfig';

/** How long (ms) the deck stays split into two piles before collapsing back. */
export const SHUFFLE_SPREAD_MS = 300;

/** How long (ms) a freshly set card is showcased over the field before it flies
 * down into its slot. */
export const SUMMON_SHOWCASE_MS = 800;

/** How long (ms) an activated ability is showcased (card pops to center with the
 *  amber ripple) before it springs back to its slot. */
export const ABILITY_SHOWCASE_MS = 950;

/** Beat (ms) to let a cost card's Hand→Replen glide read before the source
 *  Hero's activation showcase pops, so both animations are legible in sequence. */
export const ABILITY_COST_SEND_MS = 300;

/** Beat (ms) to let a Hero's send-to-pile travel land before its on-sent ability
 *  prompt pops, so the card is visibly in the pile when we ask about it. */
export const ON_SENT_PROMPT_MS = 550;

/** Target hand size the Draw phase fills up to (draws until this, else +1). */
export const HAND_TARGET = 6;

/** Base dwell (ms) the Draw phase lingers before auto-advancing to Main, on top
 * of the time its staggered draws take. Lets the Draw banner + draw animation
 * play before the phase changes. */
export const DRAW_PHASE_DWELL_MS = 900;

/** Faces on the battle die. */
export const DICE_SIDES = 20;
/** How long (ms) the D20 tumbles before it settles on its value. */
export const DICE_ROLL_MS = 800;
/** How long (ms) the settled die stays on screen before it clears. */
export const DICE_HOLD_MS = 600;
/**
 * Delay (ms) before the Resolution dice begin tumbling, so they wait for the
 * "Resolution Phase" banner to slide off screen first. Matches PhaseBanner's
 * ANIM_MS (1700) — keep in sync if that banner timing changes.
 */
export const RESOLUTION_ROLL_DELAY_MS = 1700;
/** How long (ms) the outcome-announcement pop-up (HIT / MISS / GLANCING /
 * CRITICAL) stays above each attacker's stat plate after the dice vanish. */
export const OUTCOME_POPUP_MS = 1600;
/** How long (ms) to hold in Resolution after doomed cards leave for the
 * graveyard, so their travel animation lands before the End banner starts.
 * Only applied when at least one card was destroyed this Resolution. */
export const GRAVEYARD_TRAVEL_MS = 650;

/** How long (ms) each of the opponent's auto-played phases dwells before the
 * next, during its turn. Kept ≥ the phase banner's animation length so each
 * phase announcement plays fully before the next one (Phase 7). Used for the
 * Draw and Battle phases; the Main phase gets its own longer window
 * (OPP_MAIN_DURATION_MS) to fit its paced, one-at-a-time card plays. */
export const OPP_PHASE_STEP_MS = 1800;

/** How long (ms) each opponent card reveal is showcased center-screen during its
 * Main phase before springing to its slot. Matches the player's summon showcase
 * so the opponent's plays read the same way (Phase 7 Slice 4b). */
export const OPP_PLAY_SHOWCASE_MS = 800;

/** Pause (ms) after a card has sprung to its slot before the opponent begins its
 * next play, so each summon/ability reads as a distinct, deliberate action
 * rather than cards dropping back-to-back (Phase 7 Slice 4b). */
export const OPP_PLAY_GAP_MS = 650;

/** Cadence (ms) between successive opponent plays: one full showcase plus the
 * pause after it. */
export const OPP_PLAY_STEP_MS = OPP_PLAY_SHOWCASE_MS + OPP_PLAY_GAP_MS;

/** Dwell (ms) after each visible step of a CPU Ability's effect (a draw, a
 *  search, a disturb, a destroy) so its animation finishes before the next
 *  step — or the CPU's next play — begins. */
export const OPP_EFFECT_STEP_MS = 1000;

/** Upper bound (ms) of the Easy CPU's Main phase: its maximum three paced plays
 * (A, C, B). Normal/Hard run longer; Battle always starts once plays finish — the last starts at 2×OPP_PLAY_STEP_MS
 * and clears one showcase later — with margin, so the whole row settles before
 * attacks are declared. */
export const OPP_MAIN_DURATION_MS = 3 * OPP_PLAY_STEP_MS;

/** Safety cap on CPU Main-phase plays per turn (Normal/Hard keep playing). */
export const OPP_MAX_PLAYS = 12;

/** How long (ms) the End phase dwells before auto-handing the turn to the other
 * player. Lets the End banner + B-discard/replen-shuffle cleanup play before the
 * turn flips. Applies to the player's End; the opponent's End is paced by
 * OPP_PHASE_STEP_MS inside its auto-turn (Phase 7). */
export const END_PHASE_DWELL_MS = 1400;

/** First side to this many points wins the match. */
let noticeSeq = 0;
/** A fresh toast payload (unique key so repeats re-show). */
export function makeNotice(text: string) {
  return { key: ++noticeSeq, text };
}

export const WIN_POINTS = 15;
/** Points the other side scores when a side ends its turn with no Heroes. */
export const EMPTY_FIELD_POINTS = 3;

/**
 * Authoritative Phase 1 game store. State transitions are immediate and
 * deterministic; the animation layer only visualizes the results.
 *
 * A factory (`createGameStore`) is exported so tests get isolated instances and
 * the React app shares one via the hook in `useGameStore.ts`.
 */

export interface GameActions {
  /** Move the top deck card into the hand. No-op when the deck is empty. */
  drawCard: () => void;
  /** Begin dragging a card that is currently in the hand. */
  beginDrag: (cardId: CardId) => void;
  /** Record the projected pointer position for the active drag. */
  updateDrag: (projectedPoint: Vec3) => void;
  /** Record the currently hovered slot during a drag. */
  hoverSlot: (slotId: SlotId | null) => void;
  /**
   * Resolve a drop. On a valid empty slot the card moves hand -> board;
   * otherwise it returns to its place in the hand.
   */
  dropCard: (cardId: CardId, slotId: SlotId | null) => void;
  /**
   * Main-phase quick-set: place a hand card into the next available legal slot
   * for its type (first slot in board order). No-op if the card can't be set
   * anywhere or it isn't the Main phase. Used by the double-click shortcut.
   */
  autoPlaceCard: (cardId: CardId) => void;
  /**
   * Confirm a pending level-3 tribute summon with the chosen material A-slots:
   * send those A-cards (and their linked C-cards) to the replen pile (or the
   * graveyard for Commanders). This frees up board slots, then hands off to a
   * slot-selection step (`pendingSummon`) where the player picks where to place
   * the card. No-op unless a tribute is pending and the selected materials'
   * levels sum exactly to the card's level.
   */
  confirmTributeSummon: (materialSlots: SlotId[]) => void;
  /** Cancel a pending tribute summon; the card stays in hand. */
  cancelTributeSummon: () => void;
  /** Place a pending level-3+ summon (materials already consumed) into a chosen
   * open A slot. No-op unless a summon is pending and the slot is an empty A slot. */
  placePendingSummon: (slotId: SlotId) => void;
  /** Cancel the drag, leaving the card in its existing hand order. */
  returnToHand: (cardId: CardId) => void;
  /** Raise a hand card under the pointer (selection hint), or clear with null. */
  hoverCard: (cardId: CardId | null) => void;
  /** Open the expanded detail view for any existing card (hand, board, or a
   * pile-search window: deck/graveyard/replen), or close with null. */
  selectCard: (cardId: CardId | null) => void;
  /** Trigger an activated ability of a player board Hero by its ability index.
   * No-op unless it's the player's Main phase, the card is on the player's
   * board, the ability is an activated one, and (if once-per-turn) it hasn't
   * been used this turn. */
  activateAbility: (cardId: CardId, abilityIndex: number) => void;
  /** During an ability's `cost` step, stage a Hand card to send to Replen and
   *  advance to the `target` step. No-op unless a cost selection is pending and
   *  the card is in the player's Hand. */
  chooseAbilityCost: (cardId: CardId) => void;
  /** During an ability's `target` step, choose the target Hero and resolve the
   *  ability: pay the staged cost, apply the buff, mark it used, and fire the
   *  showcase. No-op unless a target selection is pending and the card is legal. */
  chooseAbilityTarget: (cardId: CardId) => void;
  /** Abort an in-progress activated ability, reverting any staged cost. */
  cancelAbilityTargeting: () => void;
  /** Resolve a pending on-sent pile ability prompt: `true` uses the ability
   *  (applies its effect + fires the showcase), `false` declines. No-op unless a
   *  prompt is pending. */
  resolveAbilityPrompt: (accept: boolean) => void;
  /** Resolve an open On-Set choice: a card id applies the effect to it; null
   *  skips the (optional) ability. No-op unless a choice is open. */
  resolveOnSetChoice: (cardId: CardId | null) => void;
  /** Pay a B card's Hand cost with `cardId`, then resolve the rest of the spell. */
  resolveSpellCost: (cardId: CardId) => void;
  /** Resolve the open `spellChoice` with the picked card and resume the spell. */
  resolveSpellChoice: (cardId: CardId) => void;
  /** Multi-target pick for an activated ability (Heavy Suppression: up to 2). */
  chooseAbilityTargets: (cardIds: CardId[]) => void;
  /** Answer the open optional counter-threshold prompt (Devil Dog Reinforcement). */
  resolveCounterPrompt: (accept: boolean) => void;
  /** Trigger a Hero's in-pile activated ability from the pile it sits in (e.g.
   *  return it to the Hand). No-op unless it is the player's Main phase, the card
   *  is in a player pile, and it has a matching pile-activated ability. */
  activatePileAbility: (cardId: CardId) => void;
  /** Resolve a paused Bunker Busting prompt: `true` wipes all Armor Bars on the
   *  struck Hero and inflicts no damage, `false` applies normal armor math. Either
   *  way Resolution resumes with the remaining attackers. No-op unless a combat
   *  prompt is pending. */
  resolveCombatPrompt: (accept: boolean) => void;
  /**
   * Temp Phase 3 mechanic (no Player 2 yet): "destroy" a random occupied zone-A
   * slot — send its card to the graveyard, along with the linked zone-C card in
   * the same column pair (A1↔C1…A4↔C4) if that slot is occupied. No-op when no A
   * slot holds a card.
   */
  destroyZoneA: () => void;
  /**
   * Temp Phase 3 mechanic: "destroy" a random occupied zone-B slot — send its
   * card to the graveyard. Zone B has no links, so only the one card moves.
   * No-op when no B slot holds a card.
   */
  destroyZoneB: () => void;
  /**
   * Temp Phase 3 mechanic: send a random occupied zone-A slot's card to the
   * replenish pile, along with the linked zone-C card in the same column pair
   * (A1↔C1…A4↔C4) if occupied. No-op when no A slot holds a card.
   */
  replenZoneA: () => void;
  /**
   * Temp Phase 3 "disturb" mechanic: send the top card of the deck to the
   * replenish pile. No-op when the deck is empty.
   */
  disturbDeck: () => void;
  /**
   * Shuffle the deck with a riffle animation: the deck splits into two lifted
   * piles, then collapses back in a randomized order. No-op while a shuffle is
   * already running.
   */
  shuffleDeck: () => void;
  /** Move the whole replenish pile into the deck, then shuffle (animated). */
  replenIntoDeck: () => void;
  /** "Shuffle graveyard into deck" — routes the graveyard into the replen pile
   * (shuffled). Replen itself folds back into the deck at End. */
  graveyardIntoDeck: () => void;
  /** Return the whole hand to the deck, then shuffle (animated). */
  handIntoDeck: () => void;
  /** Open the pile-search pop-up for a pile (deck/graveyard/replen). Opened by
   * a dev button or by clicking the pile on the board. */
  openPileSearch: (source: PileSource) => void;
  /** Close the pile-search pop-up. */
  closePileSearch: () => void;
  /**
   * Enter the Draw phase of the current turn: announce it, draw up to the hand
   * target (else +1), then auto-advance to Main. Called once at game start (by
   * the opening deal) and again at the top of every later turn via advancePhase.
   */
  beginDrawPhase: () => void;
  /** Start screen: lock in the CPU difficulty (first pick wins). */
  chooseDifficulty: (d: Difficulty) => void;
  /** After the opening deal: open the Keep/Mulligan prompt (once per game). */
  offerMulligan: () => void;
  /**
   * Resolve the opening prompt. `take` shuffles the hand into the Deck and
   * redraws the opening hand; the CPU makes its own call by difficulty. Turn 1's
   * Draw phase begins once the hand is settled.
   */
  resolveMulligan: (take: boolean) => void;
  /**
   * Advance to the next phase when the player clicks the field's phase button.
   * Main→Battle→Resolution→End, and End→next turn's Draw (turn increments). Draw
   * and Resolution advance themselves automatically, so this is a no-op then.
   */
  advancePhase: () => void;
  /**
   * Battle phase: pick one of your occupied A-slot cards to attack with, entering
   * "aiming" mode (the source glows and the opponent row becomes selectable). If
   * the same source is already aiming, this cancels aiming. Beginning a new aim
   * clears that source's previous target. No-op outside Battle, on non-A slots,
   * or on empty A slots.
   */
  aimAttack: (slotId: SlotId) => void;
  /**
   * Battle phase: while a source A-slot is aiming, lock its attack onto the given
   * opponent slot (must hold a card). Records the target and exits aiming.
   * Multiple sources may target the same opponent. No-op if nothing is aiming or
   * the opponent slot is empty.
   */
  assignTarget: (oppSlot: OppSlotId) => void;
  /** Cancel the in-progress aim without assigning a target (Battle phase). */
  cancelTargeting: () => void;
  /** Update the live board-plane point the aiming arrow follows (Battle phase,
   * while aiming). Ignored when nothing is aiming. */
  setAimPoint: (point: Vec3) => void;
  /** Reset to a fresh initial state (used by tests and restart). */
  reset: () => void;
}

export type GameStore = GameState & GameActions;

export function createGameStore(
  initial: GameState = createInitialState(),
): StoreApi<GameStore> {
  const store = createStore<GameStore>((set, get) => {
    /**
     * Start an animated shuffle. `gather` optionally folds other cards (a pile
     * or the hand) into the deck first; the deck then spreads into two piles and
     * collapses back randomized after SHUFFLE_SPREAD_MS. No-op if already
     * shuffling.
     */
    const beginShuffle = (gather?: (s: GameStore) => Partial<GameState>) => {
      if (get().deckSpread) return;
      set((s) => ({ ...s, ...(gather ? gather(s) : {}), deckSpread: true }));
      setTimeout(() => {
        set((s) => ({ ...s, deck: shuffleArray(s.deck), deckSpread: false }));
      }, SHUFFLE_SPREAD_MS);
    };

      /**
       * Draw `n` cards with a stagger so they pop off the deck one at a time: the
       * next card is drawn once the previous is past the midpoint of its flight to
       * the hand (see MULTI_DRAW_STAGGER_MS), rather than all at once.
       */
      const drawStaggered = (n: number) => {
        get().drawCard();
        for (let i = 1; i < n; i++) {
          setTimeout(() => get().drawCard(), i * MULTI_DRAW_STAGGER_MS);
        }
      };

      /**
       * Resolve a B-card's on-play ability by delegating to the matching deck/hand
       * action. Called after the summon showcase so the effect reads as the card
       * "activating" once it lands.
       */
      /**
       * Resolve a card's `on-set` ability through the Phase 8 ability engine.
       * Looks the ability up in the registry, ignores anything whose timing is
       * not `on-set`, and runs its effect via the pure dispatcher — the store
       * supplies the side-effecting callbacks. Called after the summon showcase
       * so the effect reads as the card "activating" once it lands.
       */
      const enactOnSetAbility = (abilityId: string) => {
        const ability = ABILITY_REGISTRY[abilityId];
        if (!ability || ability.timing !== 'on-set') return;
        const actions = get();
        runEffect(ability.effect, {
          draw: (count) => drawStaggered(count),
          shuffleZoneIntoDeck: (zone) =>
            zone === 'graveyard' ? actions.graveyardIntoDeck() : actions.replenIntoDeck(),
        });
      };

      /**
       * Commit a validated placement: move the card hand -> board, roll a C
       * card's boost, kick off the summon showcase, and resolve a B card's
       * ability once the showcase clears. Assumes `slotId` is already known-legal
       * for the card. Shared by the drag-drop and double-click quick-set paths.
       */
      const commitPlacement = (
        cardId: CardId,
        cardType: CardType,
        slotId: SlotId,
        setInfo: { kind: SetKind; materials: number } = { kind: 'normal', materials: 0 },
      ) => {
        const s = get();
        // A B card's on-play ability resolves once its showcase finishes.
        const ability = cardType === 'B' ? s.cardsById[cardId]?.ability : undefined;
        set({
          hand: s.hand.filter((id) => id !== cardId),
          board: { ...s.board, [slotId]: cardId },
          dragging: null,
          // Kick off the summon reveal: the card is already placed, but its pose
          // is redirected to the big centered showcase until this clears.
          summon: { cardId, slotId },
        });
        setTimeout(() => {
          set((st) =>
            st.summon && st.summon.cardId === cardId ? { ...st, summon: null } : st,
          );
          const spell = cardType === 'B' ? parseSpell(get().cardsById[cardId]?.effect) : null;
          if (spell) castSpell(cardId, spell);
          else if (ability) enactOnSetAbility(ability);
          if (cardType === 'A') runOnSetTriggers(cardId, slotId, setInfo);
        }, SUMMON_SHOWCASE_MS);
      };

      /**
       * End-phase resolution (fires on ENTERING End): shuffle the replen pile
       * back into the deck ONLY when it holds cards (an empty replen leaves the
       * deck untouched — no needless shuffle), then send every non-continuous B
       * card on the field to the graveyard. Continuous B cards stay put.
       */
      const awardPoints = (side: 'player' | 'opponent', amount: number) => {
        if (amount <= 0 || get().winner) return;
        set((s) => {
          const points = { ...s.points, [side]: s.points[side] + amount };
          return { points, winner: points[side] >= WIN_POINTS ? side : null };
        });
      };

      /** Ending a turn (after turn 1) with no Heroes gives the other side points. */
      const scoreEmptyField = (side: 'player' | 'opponent') => {
        const s = get();
        if (s.turn <= 1) return;
        const board: Record<string, CardId | null> = side === 'player' ? s.board : s.opponentBoard;
        const hasHero = Object.entries(board).some(([k, id]) => id && (side === 'opponent' || k[0] === 'A'));
        if (!hasHero) awardPoints(side === 'player' ? 'opponent' : 'player', EMPTY_FIELD_POINTS);
      };

      const runEndPhase = () => {
        scoreEmptyField('player');
        if (get().replen.length > 0) get().replenIntoDeck();
        set((s) => {
          const board = { ...s.board };
          const sent: CardId[] = [];
          for (const slot of ['B1', 'B2', 'B3', 'B4'] as SlotId[]) {
            const id = board[slot];
            if (id && !s.cardsById[id]?.continuous) {
              sent.push(id);
              board[slot] = null;
            }
          }
          return sent.length ? { ...s, board, graveyard: [...s.graveyard, ...sent] } : s;
        });
        // "At the end of your turn, place 1 counter on this Hero."
        const reached: CardId[] = [];
        set((s) => {
          const counters = { ...s.counters };
          let any = false;
          for (const slot of ['A1', 'A2', 'A3', 'A4'] as SlotId[]) {
            const id = s.board[slot];
            const ca = id ? counterAbility(s.cardsById[id]) : null;
            if (!id || !ca || ca.effect.gain !== 'endOfTurn') continue;
            counters[id] = (counters[id] ?? 0) + 1;
            any = true;
            if (counters[id] === ca.effect.threshold) reached.push(id);
          }
          return any ? { counters } : {};
        });
        counterQueue.push(...reached);
        nextCounterThreshold();
      };

      /** Player Heroes whose counters just reached their threshold, resolved one
       *  at a time (optional ones ask via `counterPrompt`). */
      const counterQueue: CardId[] = [];
      const nextCounterThreshold = () => {
        while (counterQueue.length) {
          const id = counterQueue.shift()!;
          const s = get();
          const ca = counterAbility(s.cardsById[id]);
          if (!ca || !Object.values(s.board).includes(id)) continue;
          if (ca.ir.optional) {
            if (topSpecialOfFamily(s.deck, s.cardsById, ca.effect.setFamily) < 0) {
              set({ notice: makeNotice(`${ca.ir.name}: no "${ca.effect.setFamily}" Special Hero left in your Deck`) });
              continue;
            }
            set({ counterPrompt: { cardId: id, abilityName: ca.ir.name } });
            return;
          }
          counterTransform('player', id);
        }
      };

      /**
       * Counter threshold payoff: send the Hero (and its linked Equipment) to
       * its pile, Normal Set the top matching Special Hero from the Deck into the
       * vacated slot, then Disturb the Deck.
       */
      const counterTransform = (side: 'player' | 'opponent', cardId: CardId) => {
        const s = get();
        if (side === 'player') {
          const slot = (['A1', 'A2', 'A3', 'A4'] as SlotId[]).find((a) => s.board[a] === cardId);
          const ca = counterAbility(s.cardsById[cardId]);
          if (!slot || !ca) return;
          const board = { ...s.board, [slot]: null };
          const sent: CardId[] = [cardId];
          const cSlot = linkedCSlot(slot);
          if (board[cSlot]) {
            sent.push(board[cSlot]!);
            board[cSlot] = null;
          }
          const pile = ca.effect.sendTo;
          set(pile === 'graveyard' ? { board, graveyard: [...s.graveyard, ...sent] } : { board, replen: [...s.replen, ...sent] });
          scheduleOnSentPrompt(sent, pile);
          const st = get();
          const idx = topSpecialOfFamily(st.deck, st.cardsById, ca.effect.setFamily);
          if (idx >= 0) {
            const heroId = st.deck[idx];
            set({ deck: st.deck.filter((_, i) => i !== idx) });
            commitPlacement(heroId, 'A', slot);
          } else {
            set({ notice: makeNotice(`No "${ca.effect.setFamily}" Special Hero left in your Deck`) });
          }
          get().disturbDeck();
          return;
        }
        const slot = OPP_SLOT_IDS.find((o) => s.opponentBoard[o] === cardId);
        const ca = counterAbility(s.opponentCards[cardId]);
        if (!slot || !ca) return;
        const opponentBoard = { ...s.opponentBoard, [slot]: null };
        const opponentCBoard = { ...s.opponentCBoard };
        const sent: CardId[] = [cardId];
        const ocSlot = `OC${slot[1]}` as OppCSlotId;
        if (opponentCBoard[ocSlot]) {
          sent.push(opponentCBoard[ocSlot]!);
          opponentCBoard[ocSlot] = null;
        }
        let opponentDeck = [...s.opponentDeck];
        const idx = topSpecialOfFamily(opponentDeck, s.opponentCards, ca.effect.setFamily);
        const heroId = idx >= 0 ? opponentDeck[idx] : null;
        if (heroId) {
          opponentDeck = opponentDeck.filter((_, i) => i !== idx);
          opponentBoard[slot] = heroId;
        }
        const disturbed = opponentDeck.length ? [opponentDeck.pop()!] : [];
        set({
          opponentBoard,
          opponentCBoard,
          opponentDeck,
          ...(ca.effect.sendTo === 'graveyard'
            ? { opponentGraveyard: [...s.opponentGraveyard, ...sent], opponentReplen: [...s.opponentReplen, ...disturbed] }
            : { opponentReplen: [...s.opponentReplen, ...sent, ...disturbed] }),
          ...(heroId ? { oppSummon: { cardId: heroId, slotId: slot } } : {}),
        });
        if (heroId) revealOppCard(heroId);
      };

      /**
       * Apply ONE attacker's already-rolled hit to the opponent. Reads the live
       * store, mutates copies, and commits. `bunkerBust=true` means the player
       * accepted Snow Viper's Bunker Busting Round on this hit: wipe every Armor
       * Bar on the target, deal no HP damage, and mark the ability used this turn.
       * Otherwise Hidden Finisher is checked first (a low-HP Normal Hero is sent
       * straight to the Graveyard, ignoring armor); failing that, normal armor
       * math applies. A miss (or a vacated target) is a no-op.
       */
      const applyCombatHit = (src: SlotId, bunkerBust: boolean) => {
        set((s) => {
          const result = s.resolutionResults[src];
          const targetSlot = s.attackTargets[src] as OppSlotId | null | undefined;
          if (!result || result.outcome === 'miss' || !targetSlot) return {};
          const oppId = s.opponentBoard[targetSlot];
          if (!oppId) return {};
          const defCard = s.opponentCards[oppId];
          const maxHp = opponentEffectiveStats(s, targetSlot).hp.value;
          const currentHp = { ...s.currentHp };
          const currentArmorBars = { ...s.currentArmorBars };
          const damagePopups = { ...s.damagePopups };
          const destroying = new Set<OppSlotId>(s.destroying);
          const srcId = s.board[src] ?? undefined;
          const srcCard = srcId ? s.cardsById[srcId] : undefined;
          const eqId = s.board[linkedCSlot(src)];
          const combat = combatHitAbilities(srcCard, eqId ? s.cardsById[eqId] : undefined);

          // Bunker Busting Round (accepted): all bars break, no HP damage.
          if (bunkerBust && combat.breakAllArmorBars) {
            currentArmorBars[oppId] = 0;
            const usedActivatedAbilities = { ...s.usedActivatedAbilities };
            if (srcId) {
              const used = usedActivatedAbilities[srcId] ?? [];
              if (!used.includes(combat.breakAllArmorBars.name)) {
                usedActivatedAbilities[srcId] = [...used, combat.breakAllArmorBars.name];
              }
            }
            return { currentArmorBars, usedActivatedAbilities };
          }

          // Instant eliminations (Hidden Finisher, Headhunter; mandatory): send the
          // target straight to the graveyard, ignoring armor + Armor Bars.
          const cur = currentHp[oppId] ?? maxHp;
          const bars = currentArmorBars[oppId] ?? heroMaxBars(s, 'opponent', targetSlot);
          if (finisherEliminates(combat, defCard, { outcome: result.outcome, currentHp: cur, bars })) {
            currentHp[oppId] = 0;
            damagePopups[targetSlot] = (damagePopups[targetSlot] ?? 0) + cur;
            destroying.add(targetSlot);
            return { currentHp, damagePopups, destroying: [...destroying] };
          }

          // Normal armor math (armor auras + Equipment fold into flat armor).
          const armor = heroArmor(s, 'opponent', targetSlot);
          const baseDmg = effectiveStats(s, src).dmg.value;
          // "Normal Hits ignore Armor Bars" (Anvil): resolve as if bar-less; bars stay intact.
          const skipBars = ignoresArmorBars(combat, result.outcome);
          const hitBars = skipBars ? 0 : bars;
          const hit = applyArmorToHit({ bars: hitBars, armor }, result.outcome, result.damage, baseDmg);
          if (!skipBars) currentArmorBars[oppId] = hit.bars;
          const hpDamage = Math.max(0, hit.hpDamage - unarmedReduction(s, 'opponent', targetSlot, src));
          if (hpDamage > 0) {
            const next = Math.max(0, cur - hpDamage);
            currentHp[oppId] = next;
            damagePopups[targetSlot] = (damagePopups[targetSlot] ?? 0) + hpDamage;
            if (next <= 0) destroying.add(targetSlot);
          }
          return { currentHp, currentArmorBars, damagePopups, destroying: [...destroying] };
        });
      };

      /**
       * After every attacker's hit has landed, dwell on the pop-ups, then clear
       * the dice/pop-ups and remove any opponent at 0 HP (springing it to the
       * opponent graveyard with its linked C-card), and finally advance to End.
       * Mirrors the original tail of the Resolution step.
       */
      const settleResolution = () => {
        setTimeout(() => {
          if (get().phase !== 'resolution') return;
          let destroyedAny = false;
          let gained = 0;
          set((s) => {
            const opponentBoard = { ...s.opponentBoard };
            const opponentCBoard = { ...s.opponentCBoard };
            const opponentGraveyard = [...s.opponentGraveyard];
            const currentHp = { ...s.currentHp };
            const currentArmorBars = { ...s.currentArmorBars };
            for (const slot of OPP_SLOT_IDS) {
              const oppId = opponentBoard[slot];
              if (!oppId || (currentHp[oppId] ?? Infinity) > 0) continue;
              destroyedAny = true;
              gained += s.opponentCards[oppId]?.level ?? 0;
              opponentBoard[slot] = null;
              opponentGraveyard.push(oppId);
              delete currentHp[oppId];
              delete currentArmorBars[oppId];
              const ocSlot = `OC${slot[1]}` as OppCSlotId;
              const ocId = opponentCBoard[ocSlot];
              if (ocId) {
                opponentCBoard[ocSlot] = null;
                opponentGraveyard.push(ocId);
              }
            }
            return {
              outcomePopups: {},
              damagePopups: {},
              resolutionRolls: {},
              resolutionResults: {},
              destroying: [],
              opponentBoard,
              opponentCBoard,
              opponentGraveyard,
              currentHp,
              currentArmorBars,
            };
          });
          awardPoints('player', gained);
          if (destroyedAny) {
            setTimeout(() => {
              if (get().phase === 'resolution') goToPhase('end');
            }, GRAVEYARD_TRAVEL_MS);
          } else {
            goToPhase('end');
          }
        }, OUTCOME_POPUP_MS);
      };

      /**
       * Resolve the queued attackers IN ORDER. For each landing hit, if the
       * attacker is a Snow Viper-type Hero whose Bunker Busting Round is available
       * (unused this turn, target still has ≥1 Armor Bar) AND Hidden Finisher
       * would NOT already eliminate the target, PAUSE: commit progress so far,
       * stash the remaining attackers in `pendingCombatQueue`, and raise
       * `combatPrompt` for a yes/no. `resolveCombatPrompt` resumes by re-entering
       * with the stashed queue. When the queue empties, settle Resolution.
       */
      const advanceCombatQueue = (queue: SlotId[]) => {
        if (get().phase !== 'resolution') return;
        for (let i = 0; i < queue.length; i++) {
          const src = queue[i];
          const s = get();
          const result = s.resolutionResults[src];
          if (!result || result.outcome === 'miss') continue;
          const targetSlot = s.attackTargets[src] as OppSlotId | null | undefined;
          if (!targetSlot) continue;
          const oppId = s.opponentBoard[targetSlot];
          if (!oppId) continue;
          const srcId = s.board[src] ?? undefined;
          const srcCard = srcId ? s.cardsById[srcId] : undefined;
          const eqId = s.board[linkedCSlot(src)];
          const combat = combatHitAbilities(srcCard, eqId ? s.cardsById[eqId] : undefined);
          const defCard = s.opponentCards[oppId];
          const cur = s.currentHp[oppId] ?? opponentEffectiveStats(s, targetSlot).hp.value;
          const bars = heroBars(s, 'opponent', targetSlot);
          // An instant elimination takes precedence: if it fires, no bunker prompt.
          const finisher = finisherEliminates(combat, defCard, { outcome: result.outcome, currentHp: cur, bars });
          if (!finisher && combat.breakAllArmorBars && srcId) {
            const used = s.usedActivatedAbilities[srcId] ?? [];
            const already = used.includes(combat.breakAllArmorBars.name);
            if (bars >= 1 && !already) {
              set({
                combatPrompt: {
                  sourceSlot: src,
                  targetSlot,
                  sourceCardId: srcId,
                  targetCardId: oppId,
                  abilityName: combat.breakAllArmorBars.name,
                },
                pendingCombatQueue: queue.slice(i + 1),
              });
              return;
            }
          }
          applyCombatHit(src, false);
        }
        settleResolution();
      };

      /**
       * Resolution-phase roll (fires on ENTERING Resolution): for every declared
       * attacker A-slot, roll a D20 simultaneously. The dice wait for the
       * "Resolution Phase" banner to slide off screen (RESOLUTION_ROLL_DELAY_MS)
       * before they start tumbling. Values are picked when the roll begins and
       * absorbed into `lastRolls`; the dice tumble over each card's A/C area,
       * settle, then the phase auto-advances to End. With no attackers it just
       * moves on after the banner clears.
       */
      const beginResolution = () => {
        set({ outcomePopups: {}, resolutionRolls: {}, resolutionResults: {}, damagePopups: {} });
        const sources = Object.keys(get().attackTargets) as SlotId[];
        if (sources.length === 0) {
          setTimeout(() => {
            if (get().phase === 'resolution') goToPhase('end');
          }, RESOLUTION_ROLL_DELAY_MS + 300);
          return;
        }
        setTimeout(() => {
          if (get().phase !== 'resolution') return;
          const rolls: Record<string, DiceState> = {};
          const values: Record<string, number> = {};
          for (const slot of sources) {
            const value = 1 + Math.floor(Math.random() * DICE_SIDES);
            rolls[slot] = { value, rolling: true };
            values[slot] = value;
          }
          set((s) => ({ resolutionRolls: rolls, lastRolls: { ...s.lastRolls, ...values } }));
          setTimeout(() => {
            set((s) => {
              const settled: Record<string, DiceState> = {};
              const results: Record<string, RollResult> = {};
              for (const k of Object.keys(s.resolutionRolls)) {
                const value = s.resolutionRolls[k].value;
                settled[k] = { value, rolling: false };
                // Resolve the roll against the attacker's EFFECTIVE stats (base
                // DMG/ACC + auras and buffs) into an outcome + damage.
                const eff = effectiveStats(s, k as SlotId);
                const attackerId = s.board[k as SlotId];
                const special = isSpecialHero(attackerId ? s.cardsById[attackerId] : undefined);
                results[k] = resolveRoll(value, eff.dmg.value, eff.acc.value, special);
              }
              return { resolutionRolls: settled, resolutionResults: results };
            });
          }, DICE_ROLL_MS);
          setTimeout(() => {
            if (get().phase !== 'resolution') return;
            // Reveal every attacker's HIT/MISS word (over YOUR cards) at once, then
            // land the damage on the OPPONENT one attacker at a time. Sequencing the
            // hits lets Armor Bars deplete per hit AND lets Snow Viper's Bunker
            // Busting PAUSE the loop for a yes/no prompt (see advanceCombatQueue).
            set((s) => ({ outcomePopups: { ...s.resolutionResults } }));
            advanceCombatQueue(Object.keys(get().attackTargets) as SlotId[]);
          }, DICE_ROLL_MS + DICE_HOLD_MS);
        }, RESOLUTION_ROLL_DELAY_MS);
      };

      /**
       * Enter `next` phase: bump the announce counter (re-plays the banner), set
       * the phase (optionally incrementing the turn), and run that phase's entry
       * effects. Draw draws then auto-advances to Main; Resolution rolls the
       * declared attackers' dice then auto-advances to End; End runs its cleanup
       * and clears the attacker selection / spent dice.
       */
      const goToPhase = (next: Phase, incTurn = false) => {
        if (get().winner) return;
        set((s) => ({
          phase: next,
          turn: incTurn ? s.turn + 1 : s.turn,
          phaseAnnounce: s.phaseAnnounce + 1,
          // Any mid-resolution ability selection is abandoned on a phase change.
          abilityTargeting: null,
          abilityPrompt: null,
          combatPrompt: null,
          pendingCombatQueue: null,
          // Leaving Resolution for End consumes the attack declaration. The dice
          // + results linger with the outcome pop-up and clear together after it.
          ...(next === 'end' ? { attackTargets: {}, targeting: null, aimPoint: null } : {}),
        }));
        if (next === 'draw') {
          const handSize = get().hand.length;
          const count = handSize < HAND_TARGET ? HAND_TARGET - handSize : 1;
          drawStaggered(count);
          setTimeout(() => {
            if (get().phase === 'draw') goToPhase('main');
          }, DRAW_PHASE_DWELL_MS + count * MULTI_DRAW_STAGGER_MS);
        } else if (next === 'resolution') {
          beginResolution();
        } else if (next === 'end') {
          runEndPhase();
          // End auto-advances (Phase 7): after a dwell, hand the turn to the
          // other player. Only the player's End routes through here; the
          // opponent's End is handled inside runOpponentTurn.
          setTimeout(() => {
            if (get().phase === 'end' && get().activePlayer === 'player' && !get().counterPrompt) runOpponentTurn();
          }, END_PHASE_DWELL_MS);
        }
      };

      /**
       * Opponent target selection (Phase 7 Slice 3). Each occupied opponent
       * Vanguard picks a player A-card to strike: the card in its own column if
       * present, otherwise a random occupied player A-slot. With no player
       * A-cards on the field the opponent makes no attacks. Stored in
       * `oppAttackTargets` (mirror of the player's `attackTargets`).
       */
      /** CPU strength; tests that never pick one get the classic Easy AI. */
      const cpuDifficulty = (): Difficulty => get().difficulty ?? 'easy';

      const declareOpponentAttacks = () =>
        set((s) => {
          const targets = (['A1', 'A2', 'A3', 'A4'] as SlotId[]).flatMap((a) => {
            const id = s.board[a];
            if (!id) return [];
            const hp = s.currentHp[id] ?? effectiveStats(s, a).hp.value;
            const bars = s.currentArmorBars[id] ?? heroMaxBars(s, 'player', a);
            return [{ slot: a, hp, bars, level: s.cardsById[id]?.level ?? 1 }];
          });
          const attackers = OPP_SLOT_IDS.flatMap((o) =>
            s.opponentBoard[o] && heroCanAttack(s, 'opponent', o)
              ? [{ slot: o, dmg: opponentEffectiveStats(s, o).dmg.value }]
              : [],
          );
          // Iron Wall: enemy attacks must target the forced Hero while it stands.
          const forced = targets.find((t) => s.board[t.slot] === s.forcedTarget)?.slot ?? null;
          return { oppAttackTargets: planAttacks({ attackers, targets, forced, difficulty: cpuDifficulty() }) };
        });

      /** True while the opponent's auto-turn is the active turn. */
      const oppActive = () => get().activePlayer === 'opponent';

      /** Show the opponent's End banner, then hand the turn back to the player. */
      const finishOpponentTurn = () => {
        if (!oppActive() || get().winner) return;
        // Opponent Heroes whose damage counters hit the threshold transform now.
        const st = get();
        for (const o of OPP_SLOT_IDS) {
          const id = st.opponentBoard[o];
          const ca = id ? counterAbility(st.opponentCards[id]) : null;
          if (id && ca && (st.counters[id] ?? 0) >= ca.effect.threshold) counterTransform('opponent', id);
        }
        set((s) => {
          // Mirror of the player's End cleanup: non-continuous Ability cards go to the GY.
          const opponentBBoard = { ...s.opponentBBoard };
          const sent: CardId[] = [];
          for (const ob of Object.keys(opponentBBoard) as OppBSlotId[]) {
            const id = opponentBBoard[ob];
            if (id && !s.opponentCards[id]?.continuous) {
              sent.push(id);
              opponentBBoard[ob] = null;
            }
          }
          return {
            phase: 'end',
            phaseAnnounce: s.phaseAnnounce + 1,
            oppAttackTargets: {},
            ...(sent.length ? { opponentBBoard, opponentGraveyard: [...s.opponentGraveyard, ...sent] } : {}),
            // Mirror of the player's End: the Replen pile shuffles back into the Deck.
            ...(s.opponentReplen.length
              ? { opponentDeck: shuffleArray([...s.opponentDeck, ...s.opponentReplen]), opponentReplen: [] }
              : {}),
          };
        });
        scoreEmptyField('opponent');
        setTimeout(() => {
          if (!oppActive() || get().winner) return;
          // "During your opponent's next turn" effects (Heavy Suppression, Iron
          // Wall) expire as that turn ends.
          set((s) => ({
            turn: s.turn + 1,
            activePlayer: 'player',
            usedActivatedAbilities: {},
            enemyStatDebuffs: {},
            forcedTarget: null,
          }));
          goToPhase('draw');
        }, END_PHASE_DWELL_MS);
      };

      /**
       * The opponent's Resolution (Phase 7 Slice 3): a mirror of the player's
       * `beginResolution`. Every declared opponent attacker rolls a D20 over its
       * own card, the roll resolves against the opponent's effective DMG/ACC, and
       * the damage lands on the targeted player A-cards — draining their HP bars
       * and sending any that hit 0 to the PLAYER's graveyard. When the dice and
       * pop-ups clear, control returns to the player.
       */
      const beginOpponentResolution = () => {
        set({ oppOutcomePopups: {}, oppResolutionRolls: {}, oppResolutionResults: {}, oppDamagePopups: {} });
        const sources = Object.keys(get().oppAttackTargets) as OppSlotId[];
        if (sources.length === 0) {
          setTimeout(() => finishOpponentTurn(), RESOLUTION_ROLL_DELAY_MS + 300);
          return;
        }
        setTimeout(() => {
          if (!oppActive()) return;
          const rolls: Record<string, DiceState> = {};
          const values: Record<string, number> = {};
          for (const slot of sources) {
            const value = 1 + Math.floor(Math.random() * DICE_SIDES);
            rolls[slot] = { value, rolling: true };
            values[slot] = value;
          }
          set((s) => ({ oppResolutionRolls: rolls, lastRolls: { ...s.lastRolls, ...values } }));
          setTimeout(() => {
            set((s) => {
              const settled: Record<string, DiceState> = {};
              const results: Record<string, RollResult> = {};
              for (const k of Object.keys(s.oppResolutionRolls)) {
                const value = s.oppResolutionRolls[k].value;
                settled[k] = { value, rolling: false };
                const eff = opponentEffectiveStats(s, k as OppSlotId);
                const attackerId = s.opponentBoard[k as OppSlotId];
                const special = isSpecialHero(attackerId ? s.opponentCards[attackerId] : undefined);
                results[k] = resolveRoll(value, eff.dmg.value, eff.acc.value, special);
              }
              return { oppResolutionRolls: settled, oppResolutionResults: results };
            });
          }, DICE_ROLL_MS);
          setTimeout(() => {
            if (!oppActive()) return;
            // Land the damage on the player: aggregate each opponent attacker's
            // damage onto its player target, drain that card's HP, flag any that
            // hit 0 for the slash FX.
            set((s) => {
              const popups: Record<string, RollResult> = { ...s.oppResolutionResults };
              const currentHp = { ...s.currentHp };
              const currentArmorBars = { ...s.currentArmorBars };
              const oppDamagePopups: Partial<Record<SlotId, number>> = {};
              const destroyingSet = new Set<SlotId>();
              const counters = { ...s.counters };
              // Resolve each opponent attacker's hit IN ORDER so Armor Bars deplete
              // per hit (a bar absorbs one hit then breaks).
              for (const src of Object.keys(s.oppAttackTargets) as OppSlotId[]) {
                const result = s.oppResolutionResults[src];
                if (!result || result.outcome === 'miss') continue;
                const target = s.oppAttackTargets[src] as SlotId | null;
                if (!target) continue;
                const pid = s.board[target];
                if (!pid) continue;
                const maxHp = effectiveStats(s, target).hp.value;
                const armor = heroArmor(s, 'player', target);
                const bars = currentArmorBars[pid] ?? heroMaxBars(s, 'player', target);
                const baseDmg = opponentEffectiveStats(s, src).dmg.value;
                const hit = applyArmorToHit(
                  { bars, armor },
                  result.outcome,
                  result.damage,
                  baseDmg,
                );
                currentArmorBars[pid] = hit.bars;
                const hpDamage = Math.max(0, hit.hpDamage - unarmedReduction(s, 'player', target, src));
                if (hpDamage > 0) {
                  const cur = currentHp[pid] ?? maxHp;
                  const next = Math.max(0, cur - hpDamage);
                  currentHp[pid] = next;
                  oppDamagePopups[target] = (oppDamagePopups[target] ?? 0) + hpDamage;
                  if (next <= 0) destroyingSet.add(target);
                  // "Each time this Hero inflicts damage on an enemy Hero" counters.
                  const attackerId = s.opponentBoard[src];
                  const ca = attackerId ? counterAbility(s.opponentCards[attackerId]) : null;
                  if (attackerId && ca?.effect.gain === 'inflictDamage') counters[attackerId] = (counters[attackerId] ?? 0) + 1;
                }
              }
              return {
                counters,
                oppOutcomePopups: popups,
                oppDamagePopups,
                currentHp,
                currentArmorBars,
                oppDestroying: [...destroyingSet],
              };
            });
            // After the dwell, clear the dice + pop-ups and send any player card
            // that hit 0 to the player's graveyard, THEN hand back to the player.
            setTimeout(() => {
              if (!oppActive()) return;
              let destroyedAny = false;
              let gained = 0;
              set((s) => {
                const board = { ...s.board };
                const graveyard = [...s.graveyard];
                const currentHp = { ...s.currentHp };
                const currentArmorBars = { ...s.currentArmorBars };
                const activatedStatBuffs = { ...s.activatedStatBuffs };
                const usedActivatedAbilities = { ...s.usedActivatedAbilities };
                const playerHeroLosses = [...s.playerHeroLosses];
                for (const slot of ['A1', 'A2', 'A3', 'A4'] as SlotId[]) {
                  const pid = board[slot];
                  if (!pid || (currentHp[pid] ?? Infinity) > 0) continue;
                  destroyedAny = true;
                  gained += s.cardsById[pid]?.level ?? 0;
                  board[slot] = null;
                  graveyard.push(pid);
                  playerHeroLosses.push({ cardId: pid, turn: s.turn });
                  delete currentHp[pid];
                  delete currentArmorBars[pid];
                  delete activatedStatBuffs[pid];
                  delete usedActivatedAbilities[pid];
                  // The linked C-card (same column support) falls with its A-card.
                  const cSlot = `C${slot[1]}` as SlotId;
                  const cid = board[cSlot];
                  if (cid) {
                    board[cSlot] = null;
                    graveyard.push(cid);
                  }
                }
                return {
                  oppOutcomePopups: {},
                  oppDamagePopups: {},
                  oppResolutionRolls: {},
                  oppResolutionResults: {},
                  oppDestroying: [],
                  board,
                  graveyard,
                  currentHp,
                  currentArmorBars,
                  activatedStatBuffs,
                  usedActivatedAbilities,
                  playerHeroLosses,
                };
              });
              awardPoints('opponent', gained);
              if (destroyedAny) {
                setTimeout(() => finishOpponentTurn(), GRAVEYARD_TRAVEL_MS);
              } else {
                finishOpponentTurn();
              }
            }, OUTCOME_POPUP_MS);
          }, DICE_ROLL_MS + DICE_HOLD_MS);
        }, RESOLUTION_ROLL_DELAY_MS);
      };

      /**
       * Opponent draw step (Phase 7 Slice 4): move the top card of the
       * opponent's own deck into its hand. No-op on an empty deck. The hidden
       * hand is rendered as face-down backs, so this just grows the fan.
       */
      const drawOpponentCard = () =>
        set((s) => {
          if (s.opponentDeck.length === 0) return {} as Partial<GameState>;
          const deck = [...s.opponentDeck];
          const top = deck.pop()!;
          return { opponentDeck: deck, opponentHand: [...s.opponentHand, top] };
        });

      /**
       * Opponent draw phase: draw under the same rule as the player — refill the
       * hand up to HAND_TARGET, or a single card if already at/above it — with the
       * same stagger so the backs pop off the deck one at a time (Slice 4b).
       */
      const drawOpponentCards = () => {
        const handSize = get().opponentHand.length;
        const count = handSize < HAND_TARGET ? HAND_TARGET - handSize : 1;
        drawOpponentCard();
        for (let i = 1; i < count; i++) {
          setTimeout(() => {
            if (oppActive()) drawOpponentCard();
          }, i * MULTI_DRAW_STAGGER_MS);
        }
      };

      /**
       * Reveal-and-clear a just-played opponent card: it's showcased face-up
       * center-screen (its reveal) then springs to its slot.
       */
      const revealOppCard = (cardId: CardId) =>
        setTimeout(() => {
          set((st) => (st.oppSummon && st.oppSummon.cardId === cardId ? { ...st, oppSummon: null } : st));
        }, OPP_PLAY_SHOWCASE_MS);

      // ---- CPU deck/hand/field primitives (mirrors of the player's) ----------

      const oppDisturb = () =>
        set((s) =>
          s.opponentDeck.length
            ? {
                opponentDeck: s.opponentDeck.slice(0, -1),
                opponentReplen: [...s.opponentReplen, s.opponentDeck[s.opponentDeck.length - 1]],
              }
            : {},
        );

      const oppTutor = (sel: DeckCardSelector, count: number) => {
        const s = get();
        const picks = tutorPicks(s.opponentDeck, s.opponentCards, sel, count);
        if (picks.length) {
          set({
            opponentDeck: s.opponentDeck.filter((id) => !picks.includes(id)),
            opponentHand: [...s.opponentHand, ...picks],
          });
        }
        return picks.length;
      };

      const oppSendFromHand = (id: CardId, to: 'graveyard' | 'replen') =>
        set((s) => ({
          opponentHand: s.opponentHand.filter((x) => x !== id),
          ...(to === 'graveyard'
            ? { opponentGraveyard: [...s.opponentGraveyard, id] }
            : { opponentReplen: [...s.opponentReplen, id] }),
        }));

      /** Destroy a CPU Hero (and its linked Equipment) to the CPU's GY. */
      const destroyOppHero = (o: OppSlotId) =>
        set((s) => {
          const id = s.opponentBoard[o];
          if (!id) return {};
          const oc = `OC${o[1]}` as OppCSlotId;
          const cid = s.opponentCBoard[oc];
          const currentHp = { ...s.currentHp };
          const currentArmorBars = { ...s.currentArmorBars };
          delete currentHp[id];
          delete currentArmorBars[id];
          return {
            opponentBoard: { ...s.opponentBoard, [o]: null },
            opponentCBoard: cid ? { ...s.opponentCBoard, [oc]: null } : s.opponentCBoard,
            opponentGraveyard: [...s.opponentGraveyard, id, ...(cid ? [cid] : [])],
            currentHp,
            currentArmorBars,
          };
        });

      /** Destroy a player Hero (and its linked Equipment) to the player's GY. */
      const destroyPlayerHero = (a: SlotId) =>
        set((s) => {
          const id = s.board[a];
          if (!id) return {};
          const c = linkedCSlot(a);
          const cid = s.board[c];
          const currentHp = { ...s.currentHp };
          const currentArmorBars = { ...s.currentArmorBars };
          const activatedStatBuffs = { ...s.activatedStatBuffs };
          delete currentHp[id];
          delete currentArmorBars[id];
          delete activatedStatBuffs[id];
          return {
            board: { ...s.board, [a]: null, ...(cid ? { [c]: null } : {}) },
            graveyard: [...s.graveyard, id, ...(cid ? [cid] : [])],
            playerHeroLosses: [...s.playerHeroLosses, { cardId: id, turn: s.turn }],
            currentHp,
            currentArmorBars,
            activatedStatBuffs,
          };
        });

      /** Did a CPU card matching `sel` reach its GY last turn? */
      const oppLostLastTurn = (s: GameState, sel: DeckCardSelector) =>
        s.opponentGraveyard.some(
          (id) => (s.oppGySentTurn ?? {})[id] === s.turn - 1 && matchesDeckSelector(s.opponentCards[id], sel),
        );

      /** Best unequipped CPU ally + top matching Deck Equipment for "equip ally". */
      const oppEquipAllyTarget = (s: GameState, step: Extract<SpellStep, { kind: 'equipAlly' }>) => {
        const eqId = step.equip ? tutorPicks(s.opponentDeck, s.opponentCards, step.equip, 1)[0] : undefined;
        if (!eqId) return null;
        const allies = OPP_SLOT_IDS.filter((o) => {
          const id = s.opponentBoard[o];
          return !!id && !s.opponentCBoard[`OC${o[1]}` as OppCSlotId] && matchesDeckSelector(s.opponentCards[id], step.ally);
        });
        if (!allies.length) return null;
        const o = allies.reduce((a, b) =>
          heroValue(s.opponentCards[s.opponentBoard[b]!]) > heroValue(s.opponentCards[s.opponentBoard[a]!]) ? b : a,
        );
        return { o, eqId };
      };

      /** One visible step of a CPU spell; returning false fizzles the rest. */
      type OppFx = () => boolean | void;

      /** A parsed B-card spell for the CPU as sequenced steps, with the CPU
       *  making every pick: the most valuable revealed card, its best ally. */
      const oppSpellFx = (ir: SpellIR): OppFx[] =>
        ir.steps.map((step): OppFx => () => {
          if (step.kind === 'draw') {
            for (let i = 0; i < step.count; i++) drawOpponentCard();
          } else if (step.kind === 'disturb') oppDisturb();
          else if (step.kind === 'tutor') oppTutor(step.select, step.count);
          else if (step.kind === 'requireAllyLostLastTurn') {
            return oppLostLastTurn(get(), step.select);
          } else if (step.kind === 'reveal') {
            const s = get();
            const n = Math.min(step.count, s.opponentDeck.length);
            if (n === 0) return;
            const revealed = s.opponentDeck.slice(s.opponentDeck.length - n);
            const matches = step.pick ? revealed.filter((id) => matchesDeckSelector(s.opponentCards[id], step.pick!)) : [];
            const keep = matches.length
              ? matches.reduce((a, b) => (cardValue(s.opponentCards[b]) > cardValue(s.opponentCards[a]) ? b : a))
              : null;
            const rest = revealed.filter((id) => id !== keep);
            set({
              opponentDeck: s.opponentDeck.slice(0, s.opponentDeck.length - n),
              opponentHand: keep ? [...s.opponentHand, keep] : s.opponentHand,
              ...(step.restTo === 'graveyard'
                ? { opponentGraveyard: [...s.opponentGraveyard, ...rest] }
                : { opponentReplen: [...s.opponentReplen, ...rest] }),
            });
          } else if (step.kind === 'equipAlly') {
            const s = get();
            const t = oppEquipAllyTarget(s, step);
            if (!t) return false;
            set({
              opponentDeck: s.opponentDeck.filter((id) => id !== t.eqId),
              opponentCBoard: { ...s.opponentCBoard, [`OC${t.o[1]}`]: t.eqId },
            });
          }
        });

      /** Would this spell actually gain the CPU something right now? */
      const oppSpellUseful = (ir: SpellIR, s: GameState) => {
        let gain = false;
        for (const step of ir.steps) {
          if (step.kind === 'requireAllyLostLastTurn' && !oppLostLastTurn(s, step.select)) return false;
          if (step.kind === 'draw' && s.opponentDeck.length) gain = true;
          if (step.kind === 'reveal' && s.opponentDeck.length) gain = true;
          if (step.kind === 'tutor' && tutorPicks(s.opponentDeck, s.opponentCards, step.select, 1).length) gain = true;
          if (step.kind === 'equipAlly' && oppEquipAllyTarget(s, step)) gain = true;
        }
        return gain;
      };

      /**
       * Decide whether the CPU can (and on Normal/Hard, should) cast B-card
       * `cardId` in this window. Returns the effect to run once the card's reveal
       * lands, or null. Main-timed (and Cont.) cards cast in Main, Battle-timed
       * ones in Battle before attacks are declared. Spells the generic parser
       * understands resolve through it; the Dictate-only Battle/field spells have
       * their own handlers.
       */
      const planOppSpell = (cardId: CardId, window: 'main' | 'battle'): OppFx[] | null => {
        const s = get();
        const card = s.opponentCards[cardId];
        if (!card || card.type !== 'B') return null;
        if (((card.timing ?? '').toLowerCase() === 'battle') !== (window === 'battle')) return null;
        const d = cpuDifficulty();
        const pick = <T,>(xs: T[], value: (x: T) => number): T =>
          d === 'easy'
            ? xs[Math.floor(Math.random() * xs.length)]
            : xs.reduce((a, b) => (value(b) > value(a) ? b : a));
        const heroAt = (a: SlotId) => {
          const id = s.board[a];
          return id ? s.cardsById[id] : undefined;
        };

        if (card.name === 'Disarm') {
          const weapons = (['A1', 'A2', 'A3', 'A4'] as SlotId[]).flatMap((a) => {
            const c = linkedCSlot(a);
            const id = s.board[c];
            return id && s.cardsById[id]?.subType === 'Weapon' ? [{ a, c, id }] : [];
          });
          if (!weapons.length) return null;
          const w = pick(weapons, (x) => heroValue(heroAt(x.a)) + equipValue(s.cardsById[x.id]));
          return [() => {
            const st = get();
            if (st.board[w.c] !== w.id) return;
            set({
              board: { ...st.board, [w.c]: null },
              graveyard: [...st.graveyard, w.id],
              notice: makeNotice(`Disarm destroyed your ${st.cardsById[w.id]?.name ?? 'Weapon'}`),
            });
          }];
        }

        if (card.name === 'Unfortunate Standoff') {
          const pairs: { o: OppSlotId; a: SlotId; gain: number }[] = [];
          for (const o of OPP_SLOT_IDS) {
            const own = s.opponentBoard[o] ? s.opponentCards[s.opponentBoard[o]!] : undefined;
            if (!own) continue;
            for (const a of ['A1', 'A2', 'A3', 'A4'] as SlotId[]) {
              const enemy = heroAt(a);
              if (!enemy || (enemy.level ?? 1) > (own.level ?? 1)) continue;
              pairs.push({ o, a, gain: heroValue(enemy) - heroValue(own) });
            }
          }
          if (!pairs.length) return null;
          const best = pick(pairs, (x) => x.gain);
          if (d === 'hard' ? best.gain <= 0 : d === 'normal' ? best.gain < -5 : false) return null;
          return [() => {
            const st = get();
            const ownId = st.opponentBoard[best.o];
            const enemyId = st.board[best.a];
            if (!ownId || !enemyId) return;
            destroyPlayerHero(best.a);
            destroyOppHero(best.o);
            set({
              notice: makeNotice(
                `Unfortunate Standoff destroyed ${st.cardsById[enemyId]?.name} and ${st.opponentCards[ownId]?.name}`,
              ),
            });
          }];
        }

        if (card.name === 'Ruined Patrol') {
          const jackal: DeckCardSelector = { cardType: 'A', family: 'Jackal' };
          if (d !== 'easy' && !tutorPicks(s.opponentDeck, s.opponentCards, jackal, 1).length) return null;
          return [() => {
            const st = get();
            const heroes: CardId[] = [];
            for (let i = st.opponentDeck.length - 1; i >= 0 && heroes.length < 3; i--) {
              if (st.opponentCards[st.opponentDeck[i]]?.type === 'A') heroes.push(st.opponentDeck[i]);
            }
            // Reveal the top 3 Heroes: the best goes to Replen (back into the Deck
            // at End), the other two to the GY.
            const keep = heroes.length
              ? heroes.reduce((a, b) => (heroValue(st.opponentCards[b]) > heroValue(st.opponentCards[a]) ? b : a))
              : null;
            set({
              opponentDeck: st.opponentDeck.filter((id) => !heroes.includes(id)),
              opponentGraveyard: [...st.opponentGraveyard, ...heroes.filter((id) => id !== keep)],
              opponentReplen: keep ? [...st.opponentReplen, keep] : st.opponentReplen,
            });
          }, () => {
            oppTutor(jackal, 1);
          }, oppDisturb];
        }

        if (card.name === 'Team Contingency') {
          const fodder = cheapestHandCard(s, cardId, (c) => c.type === 'A');
          if (!fodder) return null;
          const sel: DeckCardSelector = { cardType: 'A', allegiance: s.opponentCards[fodder]?.allegiance };
          if (!tutorPicks(s.opponentDeck, s.opponentCards, sel, 1).length) return null;
          return [() => {
            if (!get().opponentHand.includes(fodder)) return false;
            oppSendFromHand(fodder, 'graveyard');
          }, () => {
            oppTutor(sel, 1);
          }, oppDisturb];
        }

        if (card.name === 'Alliance of Zero') {
          const lastTurn = s.opponentGraveyard.filter((id) => {
            const c = s.opponentCards[id];
            return c?.type === 'A' && c.allegiance === 'Dictate' && (s.oppGySentTurn ?? {})[id] === s.turn - 1;
          });
          const zero = s.opponentHand.filter(
            (id) => id !== cardId && s.opponentCards[id]?.type === 'A' && s.opponentCards[id].name.includes('Zero'),
          );
          if (!lastTurn.length || !zero.length) return null;
          const back = pick(lastTurn, (id) => heroValue(s.opponentCards[id]));
          const send = zero.reduce((a, b) => (heroValue(s.opponentCards[b]) < heroValue(s.opponentCards[a]) ? b : a));
          if (d !== 'easy' && heroValue(s.opponentCards[back]) <= heroValue(s.opponentCards[send])) return null;
          return [() => {
            const st = get();
            if (!st.opponentGraveyard.includes(back) || !st.opponentHand.includes(send)) return false;
            set({
              opponentGraveyard: [...st.opponentGraveyard.filter((id) => id !== back), send],
              opponentHand: [...st.opponentHand.filter((id) => id !== send), back],
            });
          }];
        }

        const ir = parseSpell(card.effect);
        if (!ir) return null;
        let costPick: CardId | null = null;
        if (ir.cost) {
          costPick = cheapestHandCard(s, cardId, (c) => !ir.cost!.heroOnly || c.type === 'A');
          if (!costPick) return null;
        }
        if (d !== 'easy' && !oppSpellUseful(ir, s)) return null;
        const pay: OppFx[] = costPick
          ? [() => {
              if (!get().opponentHand.includes(costPick!)) return false;
              oppSendFromHand(costPick!, ir.cost!.to);
            }]
          : [];
        return [...pay, ...oppSpellFx(ir)];
      };

      /** Cast the first B-card the CPU wants this window into an open OB slot:
       *  reveal it, then resolve its effect one step at a time as the reveal
       *  lands, each step getting OPP_EFFECT_STEP_MS to animate. `done` fires
       *  once the last step has settled, so the next play never overlaps it. */
      const castOppSpell = (window: 'main' | 'battle', done: () => void): boolean => {
        const s = get();
        const obSlot = (['OB1', 'OB2', 'OB3', 'OB4'] as OppBSlotId[]).find((ob) => !s.opponentBBoard[ob]);
        if (!obSlot) return false;
        for (const cardId of s.opponentHand) {
          const fx = planOppSpell(cardId, window);
          if (!fx) continue;
          set((st) => ({
            opponentHand: st.opponentHand.filter((id) => id !== cardId),
            opponentBBoard: { ...st.opponentBBoard, [obSlot]: cardId },
            oppSummon: { cardId, slotId: obSlot },
          }));
          revealOppCard(cardId);
          const runStep = (i: number) => {
            if (!oppActive() || get().winner) return;
            if (i >= fx.length || fx[i]() === false) {
              setTimeout(done, OPP_PLAY_GAP_MS);
              return;
            }
            setTimeout(() => runStep(i + 1), OPP_EFFECT_STEP_MS);
          };
          setTimeout(() => runStep(0), OPP_PLAY_SHOWCASE_MS);
          return true;
        }
        return false;
      };

      /** Tribute Set for the CPU: materials (and their Equipment) go to Replen,
       *  or the GY for a Commit Set; the Hero takes the first freed column. */
      const oppTributeSet = (plan: TributePlan) => {
        set((st) => {
          const opponentBoard = { ...st.opponentBoard };
          const opponentCBoard = { ...st.opponentCBoard };
          const currentHp = { ...st.currentHp };
          const currentArmorBars = { ...st.currentArmorBars };
          const sent: CardId[] = [];
          for (const o of plan.materials) {
            const id = opponentBoard[o];
            if (!id) continue;
            sent.push(id);
            opponentBoard[o] = null;
            delete currentHp[id];
            delete currentArmorBars[id];
            const oc = `OC${o[1]}` as OppCSlotId;
            const cid = opponentCBoard[oc];
            if (cid) {
              sent.push(cid);
              opponentCBoard[oc] = null;
            }
          }
          const slot = plan.materials[0];
          opponentBoard[slot] = plan.cardId;
          return {
            opponentHand: st.opponentHand.filter((id) => id !== plan.cardId),
            opponentBoard,
            opponentCBoard,
            currentHp,
            currentArmorBars,
            ...(plan.kind === 'commit'
              ? { opponentGraveyard: [...st.opponentGraveyard, ...sent] }
              : { opponentReplen: [...st.opponentReplen, ...sent] }),
            oppSummon: { cardId: plan.cardId, slotId: slot },
          };
        });
        revealOppCard(plan.cardId);
      };

      /**
       * One CPU Main-phase play, re-reading the live board each time. Easy plays
       * at most one card of each type (Hero, Equipment, Ability) per turn, never
       * tribute Sets, and casts last. Normal/Hard first cast searching spells (so
       * the new cards can be Set this turn), then tribute Set, fill every open
       * column with their strongest Heroes, and equip until nothing is left.
       */
      const opponentPlayStep = (played: Record<CardType, number>, done: () => void): CardType | null => {
        if (!oppActive() || get().winner) return null;
        const s = get();
        const d = cpuDifficulty();
        const easy = d === 'easy';
        const can = (t: CardType) => !easy || played[t] === 0;

        const settle = () => setTimeout(done, OPP_PLAY_STEP_MS);
        if (!easy && castOppSpell('main', done)) return 'B';

        if (can('A')) {
          const plan = planTribute(s, d);
          if (plan) {
            oppTributeSet(plan);
            settle();
            return 'A';
          }
          const slot = OPP_SLOT_IDS.find((o) => !s.opponentBoard[o]);
          const cardId = slot ? pickFreeHero(s, d) : null;
          if (slot && cardId) {
            set((st) => ({
              opponentHand: st.opponentHand.filter((id) => id !== cardId),
              opponentBoard: { ...st.opponentBoard, [slot]: cardId },
              oppSummon: { cardId, slotId: slot },
            }));
            revealOppCard(cardId);
            settle();
            return 'A';
          }
        }

        if (can('C')) {
          const eq = planEquip(s, d);
          if (eq) {
            set((st) => ({
              opponentHand: st.opponentHand.filter((id) => id !== eq.cardId),
              opponentCBoard: { ...st.opponentCBoard, [eq.slot]: eq.cardId },
              oppSummon: { cardId: eq.cardId, slotId: eq.slot },
            }));
            revealOppCard(eq.cardId);
            settle();
            return 'C';
          }
        }

        if (easy && can('B') && castOppSpell('main', done)) return 'B';
        return null;
      };

      /**
       * CPU Main phase: chain plays one at a time, each showcased for a full
       * OPP_PLAY_SHOWCASE_MS and settled before the next. When nothing is left
       * to play, `onDone` receives the elapsed time so Battle can wait out the
       * Main banner when the CPU had nothing to do.
       */
      const opponentMainPhase = (played: Record<CardType, number>, onDone: (elapsedMs: number) => void) => {
        let count = 0;
        const start = Date.now();
        const playNext = () => {
          if (!oppActive()) return;
          const t = count < OPP_MAX_PLAYS ? opponentPlayStep(played, playNext) : null;
          if (!t) {
            onDone(Date.now() - start);
            return;
          }
          played[t]++;
          count++;
        };
        playNext();
      };

      /** CPU Battle phase: cast Battle-timed spells (Disarm, Standoff…) one at a
       *  time, then declare attacks and run Resolution. */
      const opponentBattlePhase = (played: Record<CardType, number>) => {
        if (!oppActive() || get().winner) return;
        set((s) => ({ phase: 'battle', phaseAnnounce: s.phaseAnnounce + 1 }));
        const easy = cpuDifficulty() === 'easy';
        const next = () => {
          if (!oppActive() || get().winner) return;
          if ((!easy || played.B === 0) && castOppSpell('battle', next)) {
            played.B++;
            return;
          }
          declareOpponentAttacks();
          setTimeout(() => {
            if (!oppActive()) return;
            set((s) => ({ phase: 'resolution', phaseAnnounce: s.phaseAnnounce + 1 }));
            beginOpponentResolution();
          }, OPP_PHASE_STEP_MS);
        };
        next();
      };

      /**
       * Run the opponent's full auto-turn (Phase 7). Control passes here after
       * the player ends their turn. Draw -> Main (paced plays, as many as the
       * difficulty allows) -> Battle (spells, then attacks) -> Resolution, whose
       * engine shows the End banner and hands control back when done.
       */
      const runOpponentTurn = () => {
        if (get().activePlayer !== 'player') return; // already running / idempotent
        if (get().winner) return;
        set((s) => ({
          turn: s.turn + 1,
          activePlayer: 'opponent',
          // "Until the end of your turn" buffs expire as the player's turn ends.
          turnStatBuffs: {},
          phase: 'draw',
          phaseAnnounce: s.phaseAnnounce + 1,
        }));
        drawOpponentCards();
        setTimeout(() => {
          if (!oppActive()) return;
          set((s) => ({ phase: 'main', phaseAnnounce: s.phaseAnnounce + 1 }));
          const played: Record<CardType, number> = { A: 0, B: 0, C: 0 };
          opponentMainPhase(played, (elapsed) =>
            setTimeout(() => opponentBattlePhase(played), Math.max(0, OPP_MAIN_DURATION_MS - elapsed)),
          );
        }, OPP_PHASE_STEP_MS);
      };

    /** Fire the centered amber-ripple showcase for a card, clearing it after its
     *  window unless a newer showcase replaced it. */
    const scheduleShowcaseClear = (cardId: CardId) => {
      setTimeout(() => {
        set((st) =>
          st.abilityShowcase && st.abilityShowcase.cardId === cardId
            ? { ...st, abilityShowcase: null }
            : st,
        );
      }, ABILITY_SHOWCASE_MS);
    };

    /**
     * Pay an activated ability's cost and apply its effect (Phase 8). Shared by
     * the immediate path (no picks) and the selection modal. A moved card glides
     * to its pile first; the source Hero's showcase follows.
     */
    const finishActivation = (
      sourceId: CardId,
      ir: AbilityIR,
      costCardId: CardId | null,
      targetIds: CardId[],
    ) => {
      const s = get();
      const targetId = targetIds[0] ?? null;
      let { hand, replen, graveyard, deck } = s;
      let movedCard = false;
      const cost = ir.cost;
      if (cost) {
        switch (cost.kind) {
          case 'sendHandToReplen':
          case 'discardHand':
            if (!costCardId || !hand.includes(costCardId)) return;
            hand = hand.filter((id) => id !== costCardId);
            if (cost.kind === 'sendHandToReplen') replen = [...replen, costCardId];
            else graveyard = [...graveyard, costCardId];
            movedCard = true;
            break;
          case 'sendReplenToGraveyard':
            if (!costCardId || !replen.includes(costCardId)) return;
            replen = replen.filter((id) => id !== costCardId);
            graveyard = [...graveyard, costCardId];
            movedCard = true;
            break;
          case 'discardDeckTop': {
            if (deck.length === 0) return;
            const topId = deck[deck.length - 1];
            deck = deck.slice(0, -1);
            graveyard = [...graveyard, topId];
            movedCard = true;
            break;
          }
          default:
            return;
        }
      }

      let { activatedStatBuffs, turnStatBuffs, currentHp, enemyStatDebuffs, forcedTarget } = s;
      const addBuff = (
        map: GameState['activatedStatBuffs'],
        id: CardId,
        stat: 'hp' | 'dmg' | 'acc',
        amount: number,
      ) => {
        const prev = map[id] ?? {};
        return { ...map, [id]: { ...prev, [stat]: (prev[stat] ?? 0) + amount } };
      };
      const e = ir.effect;
      switch (e.kind) {
        case 'selfStatBuff':
          if (e.stat === 'armor') break;
          if (ir.duration === 'endOfTurn') turnStatBuffs = addBuff(turnStatBuffs, sourceId, e.stat, e.amount);
          else activatedStatBuffs = addBuff(activatedStatBuffs, sourceId, e.stat, e.amount);
          break;
        case 'targetStatBuff':
          if (!targetId || e.stat === 'armor') break;
          activatedStatBuffs = addBuff(activatedStatBuffs, targetId, e.stat, e.amount);
          break;
        case 'healTarget': {
          if (!targetId) break;
          const slot = (Object.keys(s.board) as SlotId[]).find((k) => s.board[k] === targetId);
          if (!slot) break;
          const maxHp = effectiveStats(s, slot).hp.value;
          const cur = currentHp[targetId] ?? maxHp;
          currentHp = { ...currentHp, [targetId]: Math.min(maxHp, cur + e.amount) };
          break;
        }
        case 'recoverFromGraveyard':
          if (!targetId || !graveyard.includes(targetId)) break;
          graveyard = graveyard.filter((id) => id !== targetId);
          replen = [...replen, targetId];
          movedCard = true;
          break;
        case 'enemyStatDebuff':
          if (e.stat === 'armor') break;
          for (const id of targetIds) enemyStatDebuffs = addBuff(enemyStatDebuffs, id, e.stat, e.amount);
          break;
        case 'forceTarget':
          forcedTarget = sourceId;
          break;
        default:
          break;
      }

      const usedNames = s.usedActivatedAbilities[sourceId] ?? [];
      set({
        hand,
        replen,
        graveyard,
        deck,
        activatedStatBuffs,
        turnStatBuffs,
        currentHp,
        enemyStatDebuffs,
        forcedTarget,
        usedActivatedAbilities: { ...s.usedActivatedAbilities, [sourceId]: [...usedNames, ir.name] },
        abilityTargeting: null,
      });
      const showcase = () => {
        set((st) => ({ ...st, abilityShowcase: { cardId: sourceId, abilityName: ir.name } }));
        scheduleShowcaseClear(sourceId);
      };
      // Let a moved card's glide read before the source Hero's showcase pops.
      if (movedCard) setTimeout(showcase, ABILITY_COST_SEND_MS);
      else showcase();
    };

    /** Fire a showcase for an On-Set ability that just resolved. */
    const showOnSet = (cardId: CardId, abilityName: string) => {
      set({ abilityShowcase: { cardId, abilityName } });
      scheduleShowcaseClear(cardId);
    };

    /**
     * Resolve a just-Set Hero's On-Set abilities for how it was Set (Normal /
     * Replen / Commit). Automatic effects apply immediately; the first effect
     * that needs a pick opens `onSetChoice` (optional — the player may skip).
     * Player turn only. Forward Intel (deck reorder) is parsed but inert.
     */
    const runOnSetTriggers = (cardId: CardId, slotId: SlotId, info: { kind: SetKind; materials: number }) => {
      if (get().activePlayer !== 'player') return;
      for (const { abilityIndex, ir } of onSetAbilities(get().cardsById[cardId], info.kind)) {
        const s = get();
        if (s.board[slotId] !== cardId) return;
        const e = ir.effect;
        if (onSetNeedsChoice(ir)) {
          if (s.onSetChoice) continue;
          const options = onSetChoiceOptions(ir, {
            cardsById: s.cardsById,
            graveyard: s.graveyard,
            opponentCards: s.opponentCards,
            opponentEquipment: Object.values(s.opponentCBoard).filter((id): id is CardId => Boolean(id)),
          });
          if (options.length) {
            set({ onSetChoice: { sourceCardId: cardId, abilityIndex, abilityName: ir.name, options } });
          }
          continue;
        }
        if (e.kind === 'draw') {
          if (s.deck.length === 0) continue;
          drawStaggered(e.count);
          showOnSet(cardId, ir.name);
        } else if (e.kind === 'opponentHandToReplen') {
          const hand = [...s.opponentHand];
          const sent: CardId[] = [];
          for (let i = 0; i < e.count && hand.length; i++) {
            sent.push(hand.splice(Math.floor(Math.random() * hand.length), 1)[0]);
          }
          if (!sent.length) continue;
          set({ opponentHand: hand, opponentReplen: [...s.opponentReplen, ...sent] });
          showOnSet(cardId, ir.name);
        } else if (e.kind === 'equipFromDeck') {
          const cSlot = linkedCSlot(slotId);
          if (s.board[cSlot]) continue;
          let idx = -1;
          for (let i = s.deck.length - 1; i >= 0; i--) {
            const c = s.cardsById[s.deck[i]];
            if (c?.type === 'C' && c.subType === e.subType) {
              idx = i;
              break;
            }
          }
          if (idx < 0) {
            set({ notice: makeNotice('No applicable cards available') });
            continue;
          }
          const eqId = s.deck[idx];
          set({
            deck: s.deck.filter((_, i) => i !== idx),
            board: { ...s.board, [cSlot]: eqId },
          });
          if (e.disturb) get().disturbDeck();
          showOnSet(cardId, ir.name);
        } else if (e.kind === 'destroyEnemyNormalHeroes') {
          const enemies = OPP_SLOT_IDS.flatMap((slot) => {
            const id = s.opponentBoard[slot];
            const card = id ? s.opponentCards[id] : undefined;
            return id && card ? [{ slot, card, hp: s.currentHp[id] ?? card.hp ?? 0 }] : [];
          });
          const victims = dominationVictims(enemies, e.upToMaterials ? info.materials : Infinity);
          if (!victims.length) continue;
          const opponentBoard = { ...s.opponentBoard };
          const opponentCBoard = { ...s.opponentCBoard };
          const opponentGraveyard = [...s.opponentGraveyard];
          const currentHp = { ...s.currentHp };
          const currentArmorBars = { ...s.currentArmorBars };
          for (const slot of victims) {
            const id = opponentBoard[slot]!;
            opponentBoard[slot] = null;
            opponentGraveyard.push(id);
            delete currentHp[id];
            delete currentArmorBars[id];
            const ocSlot = `OC${slot[1]}` as OppCSlotId;
            const ocId = opponentCBoard[ocSlot];
            if (ocId) {
              opponentCBoard[ocSlot] = null;
              opponentGraveyard.push(ocId);
            }
          }
          set({ opponentBoard, opponentCBoard, opponentGraveyard, currentHp, currentArmorBars });
          showOnSet(cardId, ir.name);
        }
      }
    };

    /** After a send-to-pile lands, open the on-sent yes/no prompt for the first
     *  just-sent Hero whose ability triggers for that pile. Only prompts on the
     *  player's turn (a player choice) and never stacks over an open prompt or a
     *  card that has since left the pile. */
    /** Resolve a parsed B-card spell's steps in order from `from` (cost already
     *  paid). A step needing a pick pauses on `spellChoice`; `resolveSpellChoice`
     *  resumes at the next step. A failed condition / no legal target fizzles. */
    const runSpellSteps = (ir: SpellIR, cardId: CardId, from = 0) => {
      for (let i = from; i < ir.steps.length; i++) {
        const step = ir.steps[i];
        if (step.kind === 'draw') drawStaggered(step.count);
        else if (step.kind === 'disturb') get().disturbDeck();
        else if (step.kind === 'requireAllyLostLastTurn') {
          const s = get();
          const lost = s.playerHeroLosses.some(
            (l) => l.turn === s.turn - 1 && matchesDeckSelector(s.cardsById[l.cardId], step.select),
          );
          if (!lost) return;
        } else if (step.kind === 'reveal') {
          const s = get();
          const n = Math.min(step.count, s.deck.length);
          if (n === 0) continue;
          // The deck end is the top; list the revealed cards top-first.
          const revealed = s.deck.slice(s.deck.length - n).reverse();
          const deck = s.deck.slice(0, s.deck.length - n);
          const options = revealed.filter((id) => matchesDeckSelector(s.cardsById[id], step.pick!));
          if (options.length === 0) {
            set({ notice: makeNotice('No applicable cards revealed') });
            set(step.restTo === 'graveyard'
              ? { deck, graveyard: [...s.graveyard, ...revealed] }
              : { deck, replen: [...s.replen, ...revealed] });
            continue;
          }
          set({
            deck,
            spellChoice: { sourceCardId: cardId, stepIndex: i, kind: 'reveal', prompt: 'Add 1 revealed card to your Hand', options, revealed },
          });
          return;
        } else if (step.kind === 'equipAlly') {
          const s = get();
          const hasEquip = s.deck.some((id) => matchesDeckSelector(s.cardsById[id], step.equip!));
          const options = (['A1', 'A2', 'A3', 'A4'] as SlotId[]).flatMap((slot) => {
            const id = s.board[slot];
            return id && !s.board[linkedCSlot(slot)] && matchesDeckSelector(s.cardsById[id], step.ally) ? [id] : [];
          });
          if (!hasEquip || options.length === 0) {
            set({ notice: makeNotice('No applicable cards available') });
            return;
          }
          set({ spellChoice: { sourceCardId: cardId, stepIndex: i, kind: 'equipAlly', prompt: 'Select 1 Hero to equip', options } });
          return;
        } else {
          const s = get();
          const picks = tutorPicks(s.deck, s.cardsById, step.select, step.count);
          if (picks.length === 0) {
            set({ notice: makeNotice('No applicable cards available') });
            continue;
          }
          set({ deck: s.deck.filter((id) => !picks.includes(id)), hand: [...s.hand, ...picks] });
        }
      }
    };

    /** Cast a B-card spell: open the Hand-cost pick if it has one, else resolve.
     *  A cost that can't be paid (no eligible Hand card) fizzles the spell. */
    const castSpell = (cardId: CardId, ir: SpellIR) => {
      if (!ir.cost) {
        runSpellSteps(ir, cardId);
        return;
      }
      const s = get();
      const options = spellCostOptions(ir, s.hand, s.cardsById);
      if (options.length === 0) return;
      set({ spellCost: { sourceCardId: cardId, to: ir.cost.to, options } });
    };

    const scheduleOnSentPrompt = (sentIds: readonly CardId[], pile: 'graveyard' | 'replen') => {
      const hits = onSentAbilities(sentIds, pile, get().cardsById);
      if (hits.length === 0) return;
      setTimeout(() => {
        const st = get();
        if (st.activePlayer !== 'player') return;
        if (st.abilityPrompt) return;
        const pileIds = pile === 'graveyard' ? st.graveyard : st.replen;
        const live = hits.find((h) => pileIds.includes(h.cardId));
        if (!live) return;
        set({
          abilityPrompt: {
            cardId: live.cardId,
            abilityIndex: live.abilityIndex,
            abilityName: live.ir.name,
          },
        });
      }, ON_SENT_PROMPT_MS);
    };

    return {
    ...initial,

    drawCard: () =>
      set((s) => {
        if (s.deck.length === 0) return s;
        const deck = s.deck.slice(0, -1);
        const topId = s.deck[s.deck.length - 1];
        return { ...s, deck, hand: [...s.hand, topId] };
      }),

    beginDrag: (cardId) =>
      set((s) => {
        if (s.activePlayer !== 'player') return s; // no input on the opponent's turn
        if (s.dragging !== null) return s;
        if (!s.hand.includes(cardId)) return s;
        return {
          ...s,
          hoveredCardId: null,
          dragging: {
            cardId,
            origin: 'hand',
            projectedPoint: [0, 0, 0],
            hoveredSlotId: null,
          },
        };
      }),

    updateDrag: (projectedPoint) =>
      set((s) => {
        if (s.dragging === null) return s;
        return { ...s, dragging: { ...s.dragging, projectedPoint } };
      }),

    hoverSlot: (slotId) =>
      set((s) => {
        if (s.dragging === null) return s;
        return { ...s, dragging: { ...s.dragging, hoveredSlotId: slotId } };
      }),

    dropCard: (cardId, slotId) => {
      const s = get();
      if (s.dragging === null || s.dragging.cardId !== cardId) return;
      const card = s.cardsById[cardId];
      // If a level-3+ summon is awaiting its slot, dragging the held card onto an
      // open A slot places it there (materials are already spent — don't re-open
      // the tribute picker).
      if (s.pendingSummon && s.pendingSummon.cardId === cardId) {
        set({ dragging: null });
        if (slotId) get().placePendingSummon(slotId);
        return;
      }
      // Cards may only be set during the Main phase.
      if (
        s.phase === 'main' &&
        card &&
        slotId !== null &&
        canDropCard(s.board, s.cardsById, slotId, card)
      ) {
        if (requiresTribute(card)) {
          // Hold the card in hand and open material selection instead of placing.
          // The target slot is chosen AFTER materials are consumed (they free up
          // slots), so the drop slot itself is irrelevant here.
          set({ dragging: null, pendingTribute: { cardId } });
        } else {
          commitPlacement(cardId, card.type, slotId);
        }
        return;
      }
      // Invalid drop: keep card in hand (order preserved), end the drag.
      set({ dragging: null });
    },

    autoPlaceCard: (cardId) => {
      const s = get();
      // Quick-set is Main-phase only and never interrupts an active drag or a
      // tribute already in progress (material picker open, or awaiting a slot).
      if (s.activePlayer !== 'player') return;
      if (s.phase !== 'main' || s.dragging !== null) return;
      if (s.pendingTribute !== null || s.pendingSummon !== null) return;
      if (!s.hand.includes(cardId)) return;
      const card = s.cardsById[cardId];
      if (!card) return;
      // A tribute-summon card can't just drop into a slot — open material
      // selection (if affordable). The target slot is picked afterward, so no
      // board slot needs to be free right now.
      if (requiresTribute(card)) {
        if (!canAffordTribute(s.board, s.cardsById, card)) return;
        set({ pendingTribute: { cardId } });
        return;
      }
      // Next available legal slot in board order; do nothing if there is none.
      const target = validTargetSlots(s.board, card.type)[0];
      if (!target) return;
      commitPlacement(cardId, card.type, target);
    },

    confirmTributeSummon: (materialSlots) => {
      const s = get();
      const pending = s.pendingTribute;
      if (!pending) return;
      const card = s.cardsById[pending.cardId];
      if (!card) return;
      // Validate the selection: every slot is an occupied A slot and the
      // materials satisfy the level sum or one of the card's set permissions.
      const mats: Card[] = [];
      for (const aSlot of materialSlots) {
        if (aSlot[0] !== 'A') return;
        const mid = s.board[aSlot];
        const mc = mid ? s.cardsById[mid] : undefined;
        if (!mc) return;
        mats.push(mc);
      }
      const kind = tributeSetKind(card, mats);
      if (!kind) return;
      // Send each material A-card (and its linked C-card) away: Commit Set →
      // GRAVEYARD, Replen Set → replen pile.
      const toGraveyard = kind === 'commit';
      const board = { ...s.board };
      const replen = [...s.replen];
      const graveyard = [...s.graveyard];
      const sink = toGraveyard ? graveyard : replen;
      const sent: CardId[] = [];
      for (const aSlot of materialSlots) {
        sink.push(board[aSlot]!);
        sent.push(board[aSlot]!);
        board[aSlot] = null;
        const cSlot = `C${aSlot[1]}` as SlotId;
        if (board[cSlot]) {
          sink.push(board[cSlot]!);
          sent.push(board[cSlot]!);
          board[cSlot] = null;
        }
      }
      const setTurnAttack = parseAbilities(card.abilities).some(
        (ir) =>
          ir.effect.kind === 'attackOnSetTurn' &&
          ir.effect.setKind === kind &&
          mats.every((m) => {
            const req = (ir.effect as Extract<AbilityIR['effect'], { kind: 'attackOnSetTurn' }>).materials;
            return (!req.subType || m.subType === req.subType) && (!req.allegiance || m.allegiance === req.allegiance);
          }),
      );
      set({ board, replen, graveyard, pendingTribute: null,
        pendingSummon: {
          cardId: pending.cardId,
          setKind: toGraveyard ? 'commit' : 'replen',
          materials: materialSlots.length,
          ...(setTurnAttack ? { setTurnAttack: true } : {}),
        },
      });
      scheduleOnSentPrompt(sent, toGraveyard ? 'graveyard' : 'replen');
    },

    cancelTributeSummon: () => set(() => ({ pendingTribute: null })),

    placePendingSummon: (slotId) => {
      const s = get();
      const pending = s.pendingSummon;
      if (!pending) return;
      // Only an empty A slot is a valid summon target.
      if (slotId[0] !== 'A' || s.board[slotId] !== null) return;
      set({ pendingSummon: null });
      // Run the normal placement + summon showcase for the held card.
      commitPlacement(pending.cardId, 'A', slotId, {
        kind: pending.setKind ?? 'replen',
        materials: pending.materials ?? 0,
      });
      if (pending.setTurnAttack) set((st) => ({ setTurnAttack: { ...st.setTurnAttack, [pending.cardId]: true } }));
    },

    returnToHand: (cardId) =>
      set((s) => {
        if (s.dragging === null || s.dragging.cardId !== cardId) return s;
        return { ...s, dragging: null };
      }),

    hoverCard: (cardId) =>
      set((s) => {
        // Only hand cards can be hovered; ignore while dragging.
        const next = cardId !== null && s.dragging === null && s.hand.includes(cardId) ? cardId : null;
        if (next === s.hoveredCardId) return s;
        return { ...s, hoveredCardId: next };
      }),

    selectCard: (cardId) =>
      set((s) => {
        // null closes the panel. Any existing card can be inspected — from the
        // hand, the board, or a pile-search window (deck/graveyard/replen).
        if (cardId === null) {
          return s.selectedCardId === null ? s : { ...s, selectedCardId: null };
        }
        if (!s.cardsById[cardId] && !s.opponentCards[cardId]) return s;
        if (s.selectedCardId === cardId) return s;
        return { ...s, selectedCardId: cardId };
      }),

    activateAbility: (cardId, abilityIndex) => {
      const s = get();
      // Gate: player's Main phase, card on the player's own A-board.
      if (s.activePlayer !== 'player' || s.phase !== 'main') return;
      if (!playerBoardHeroes(s).some((c) => c.id === cardId)) return;
      const card = s.cardsById[cardId];
      if (!card || !card.abilities || abilityIndex < 0 || abilityIndex >= card.abilities.length) {
        return;
      }
      const ir = parseAbility(card.abilities[abilityIndex]);
      if (ir.trigger !== 'activated') return;
      // Once-per-turn gate.
      const usedNames = s.usedActivatedAbilities[cardId] ?? [];
      if (ir.oncePerTurn && usedNames.includes(ir.name)) return;
      // Never open a flow the player can't finish (or one the runtime can't apply).
      if (!activationFeasible(ir, abilityZones(s), cardId)) return;

      // Abilities with a card-pick cost or a target open the selection modal;
      // they resolve in chooseAbilityCost / chooseAbilityTarget.
      const pickCost = costPickZone(ir) !== null;
      if (pickCost || abilityNeedsTarget(ir)) {
        set({
          abilityTargeting: {
            sourceCardId: cardId,
            abilityIndex,
            abilityName: ir.name,
            step: pickCost ? 'cost' : 'target',
            costCardId: null,
          },
        });
        return;
      }
      finishActivation(cardId, ir, null, []);
    },

    chooseAbilityCost: (cardId) => {
      const s = get();
      const at = s.abilityTargeting;
      if (!at || at.step !== 'cost') return;
      const source = s.cardsById[at.sourceCardId];
      if (!source || !source.abilities) return;
      const ir = parseAbility(source.abilities[at.abilityIndex]);
      const zone = costPickZone(ir);
      const pool = zone === 'hand' ? s.hand : zone === 'replen' ? s.replen : [];
      if (!pool.includes(cardId)) return;
      if (abilityNeedsTarget(ir)) {
        set({ abilityTargeting: { ...at, step: 'target', costCardId: cardId } });
        return;
      }
      finishActivation(at.sourceCardId, ir, cardId, []);
    },

    chooseAbilityTarget: (targetId) => get().chooseAbilityTargets([targetId]),

    chooseAbilityTargets: (targetIds) => {
      const s = get();
      const at = s.abilityTargeting;
      if (!at || at.step !== 'target') return;
      const source = s.cardsById[at.sourceCardId];
      if (!source || !source.abilities) return;
      const ir = parseAbility(source.abilities[at.abilityIndex]);
      const ids = [...new Set(targetIds)];
      if (ids.length === 0 || ids.length > abilityMaxTargets(ir)) return;
      const legal = abilityTargetOptions(ir, abilityZones(s), at.sourceCardId).map((c) => c.id);
      if (!ids.every((id) => legal.includes(id))) return;
      finishActivation(at.sourceCardId, ir, at.costCardId, ids);
    },

    resolveCounterPrompt: (accept) => {
      const p = get().counterPrompt;
      if (!p) return;
      set({ counterPrompt: null });
      if (accept) counterTransform('player', p.cardId);
      nextCounterThreshold();
      // The End-phase hand-off waits on this prompt; resume it once answered.
      if (!get().counterPrompt) {
        setTimeout(() => {
          const s = get();
          if (s.phase === 'end' && s.activePlayer === 'player' && !s.counterPrompt) runOpponentTurn();
        }, END_PHASE_DWELL_MS);
      }
    },

    cancelAbilityTargeting: () => set(() => ({ abilityTargeting: null })),

    resolveOnSetChoice: (pick) => {
      const s = get();
      const ch = s.onSetChoice;
      if (!ch) return;
      if (pick === null || !ch.options.includes(pick)) {
        if (pick === null) set({ onSetChoice: null });
        return;
      }
      const ir = parseAbility(s.cardsById[ch.sourceCardId]?.abilities?.[ch.abilityIndex] ?? '');
      if (ir.effect.kind === 'opponentEquipmentToReplen') {
        const opponentCBoard = { ...s.opponentCBoard };
        for (const k of Object.keys(opponentCBoard) as OppCSlotId[]) {
          if (opponentCBoard[k] === pick) opponentCBoard[k] = null;
        }
        set({ opponentCBoard, opponentReplen: [...s.opponentReplen, pick], onSetChoice: null });
      } else if (ir.effect.kind === 'recoverFromGraveyard') {
        set({ graveyard: s.graveyard.filter((id) => id !== pick), hand: [...s.hand, pick], onSetChoice: null });
      } else {
        set({ onSetChoice: null });
        return;
      }
      showOnSet(ch.sourceCardId, ch.abilityName);
    },

    resolveSpellCost: (pick) => {
      const s = get();
      const sc = s.spellCost;
      if (!sc || !sc.options.includes(pick)) return;
      const ir = parseSpell(s.cardsById[sc.sourceCardId]?.effect);
      const hand = s.hand.filter((id) => id !== pick);
      if (sc.to === 'graveyard') set({ hand, graveyard: [...s.graveyard, pick], spellCost: null });
      else set({ hand, replen: [...s.replen, pick], spellCost: null });
      scheduleOnSentPrompt([pick], sc.to);
      if (ir) runSpellSteps(ir, sc.sourceCardId);
    },

    resolveSpellChoice: (pick) => {
      const s = get();
      const sc = s.spellChoice;
      if (!sc || !sc.options.includes(pick)) return;
      const ir = parseSpell(s.cardsById[sc.sourceCardId]?.effect);
      const step = ir?.steps[sc.stepIndex];
      if (!ir || !step) {
        set({ spellChoice: null });
        return;
      }
      if (step.kind === 'reveal') {
        const rest = (sc.revealed ?? []).filter((id) => id !== pick);
        set(step.restTo === 'graveyard'
          ? { spellChoice: null, hand: [...s.hand, pick], graveyard: [...s.graveyard, ...rest] }
          : { spellChoice: null, hand: [...s.hand, pick], replen: [...s.replen, ...rest] });
      } else if (step.kind === 'equipAlly') {
        const slot = (['A1', 'A2', 'A3', 'A4'] as SlotId[]).find((a) => s.board[a] === pick);
        const cSlot = slot && linkedCSlot(slot);
        let idx = -1;
        for (let i = s.deck.length - 1; i >= 0; i--) {
          if (matchesDeckSelector(s.cardsById[s.deck[i]], step.equip!)) {
            idx = i;
            break;
          }
        }
        if (!cSlot || s.board[cSlot] || idx < 0) {
          set({ spellChoice: null, ...(idx < 0 ? { notice: makeNotice('No applicable cards available') } : {}) });
          return;
        }
        const eqId = s.deck[idx];
        set({ spellChoice: null, deck: s.deck.filter((_, i) => i !== idx), board: { ...s.board, [cSlot]: eqId } });
      } else {
        set({ spellChoice: null });
      }
      runSpellSteps(ir, sc.sourceCardId, sc.stepIndex + 1);
    },

    resolveAbilityPrompt: (accept) => {
      const s = get();
      const p = s.abilityPrompt;
      if (!p) return;
      set({ abilityPrompt: null });
      if (!accept) return;
      const card = s.cardsById[p.cardId];
      if (!card || !card.abilities || p.abilityIndex < 0 || p.abilityIndex >= card.abilities.length) {
        return;
      }
      const ir = parseAbility(card.abilities[p.abilityIndex]);
      if (ir.trigger !== 'onSentToPile') return;
      if (ir.effect.kind === 'draw') {
        drawStaggered(ir.effect.count);
      }
      // Flash the card's activation showcase (it briefly pops from its pile).
      set((st) => ({ ...st, abilityShowcase: { cardId: p.cardId, abilityName: ir.name } }));
      scheduleShowcaseClear(p.cardId);
    },

    activatePileAbility: (cardId) => {
      const s = get();
      if (s.activePlayer !== 'player' || s.phase !== 'main') return;
      const card = s.cardsById[cardId];
      if (!card) return;
      const pile: 'graveyard' | 'replen' | null = s.replen.includes(cardId)
        ? 'replen'
        : s.graveyard.includes(cardId)
          ? 'graveyard'
          : null;
      if (!pile) return;
      const hit = pileActivatedAbilityFor(card, pile);
      if (!hit) return;
      if (hit.ir.effect.kind === 'returnSelfToHand') {
        if (pile === 'replen') {
          set({
            replen: s.replen.filter((id) => id !== cardId),
            hand: [...s.hand, cardId],
            pileSearch: null,
          });
        } else {
          set({
            graveyard: s.graveyard.filter((id) => id !== cardId),
            hand: [...s.hand, cardId],
            pileSearch: null,
          });
        }
      }
      // Flash the activation showcase as the card travels back to the Hand.
      set((st) => ({ ...st, abilityShowcase: { cardId, abilityName: hit.ir.name } }));
      scheduleShowcaseClear(cardId);
    },

    resolveCombatPrompt: (accept) => {
      const s = get();
      const cp = s.combatPrompt;
      if (!cp) return;
      const rest = s.pendingCombatQueue ?? [];
      set({ combatPrompt: null, pendingCombatQueue: null });
      // Apply the paused attacker's hit (bunker-bust on accept, normal on decline),
      // then resume Resolution with the remaining attackers.
      applyCombatHit(cp.sourceSlot, accept);
      advanceCombatQueue(rest);
    },

    destroyZoneA: () => {
      const s = get();
      const occupiedA = (['A1', 'A2', 'A3', 'A4'] as SlotId[]).filter(
        (slot) => s.board[slot] !== null,
      );
      if (occupiedA.length === 0) return;
      const aSlot = occupiedA[Math.floor(Math.random() * occupiedA.length)];
      const aCard = s.board[aSlot] as CardId;
      const cSlot = `C${aSlot[1]}` as SlotId;
      const cCard = s.board[cSlot];
      const board = { ...s.board, [aSlot]: null };
      const sent: CardId[] = [aCard];
      if (cCard !== null) {
        board[cSlot] = null;
        sent.push(cCard);
      }
      set({
        board,
        graveyard: [...s.graveyard, ...sent],
        playerHeroLosses: [...s.playerHeroLosses, { cardId: aCard, turn: s.turn }],
      });
      scheduleOnSentPrompt(sent, 'graveyard');
    },

    destroyZoneB: () =>
      set((s) => {
        const occupiedB = (['B1', 'B2', 'B3', 'B4'] as SlotId[]).filter(
          (slot) => s.board[slot] !== null,
        );
        if (occupiedB.length === 0) return s;
        const bSlot = occupiedB[Math.floor(Math.random() * occupiedB.length)];
        const bCard = s.board[bSlot] as CardId;
        return {
          ...s,
          board: { ...s.board, [bSlot]: null },
          graveyard: [...s.graveyard, bCard],
        };
      }),

    replenZoneA: () =>
      set((s) => {
        const occupiedA = (['A1', 'A2', 'A3', 'A4'] as SlotId[]).filter(
          (slot) => s.board[slot] !== null,
        );
        if (occupiedA.length === 0) return s;
        const aSlot = occupiedA[Math.floor(Math.random() * occupiedA.length)];
        const aCard = s.board[aSlot] as CardId;
        const cSlot = `C${aSlot[1]}` as SlotId;
        const cCard = s.board[cSlot];
        const board = { ...s.board, [aSlot]: null };
        const sent: CardId[] = [aCard];
        if (cCard !== null) {
          board[cSlot] = null;
          sent.push(cCard);
        }
        return { ...s, board, replen: [...s.replen, ...sent] };
      }),

    disturbDeck: () =>
      set((s) => {
        if (s.deck.length === 0) return s;
        const topId = s.deck[s.deck.length - 1];
        return {
          ...s,
          deck: s.deck.slice(0, -1),
          replen: [...s.replen, topId],
        };
      }),

    shuffleDeck: () => beginShuffle(),

    replenIntoDeck: () =>
      beginShuffle((s) => ({ deck: [...s.deck, ...s.replen], replen: [] })),

    // "Shuffle graveyard into deck" routes through the replen pile: the cards
    // land (shuffled) in replen, which itself folds back into the deck at End.
    graveyardIntoDeck: () =>
      set((s) => ({
        replen: shuffleArray([...s.replen, ...s.graveyard]),
        graveyard: [],
      })),

    handIntoDeck: () =>
      beginShuffle((s) => ({
        deck: [...s.deck, ...s.hand],
        hand: [],
        hoveredCardId: null,
      })),

    openPileSearch: (source) => set(() => ({ pileSearch: source })),

    closePileSearch: () => set(() => ({ pileSearch: null })),

    beginDrawPhase: () => goToPhase('draw'),

    chooseDifficulty: (d) => set((s) => (s.difficulty ? s : { difficulty: d })),

    offerMulligan: () => set((s) => (s.mulligan === null && s.phaseAnnounce === 0 ? { mulligan: 'offer' } : s)),

    resolveMulligan: (take) => {
      const s = get();
      if (s.mulligan !== 'offer') return;
      set({ mulligan: 'done' });
      if (shouldMulligan(s.opponentHand, s.opponentCards, s.difficulty ?? 'easy')) {
        set((st) => {
          const deck = shuffleArray([...st.opponentDeck, ...st.opponentHand]);
          const hand = deck.splice(Math.max(0, deck.length - OPENING_HAND_SIZE)).reverse();
          return { opponentDeck: deck, opponentHand: hand, notice: makeNotice('Opponent took a mulligan') };
        });
      }
      if (!take) {
        goToPhase('draw');
        return;
      }
      beginShuffle((st) => ({ deck: [...st.deck, ...st.hand], hand: [], hoveredCardId: null }));
      const redrawAt = SHUFFLE_SPREAD_MS + 250;
      setTimeout(() => drawStaggered(OPENING_HAND_SIZE), redrawAt);
      setTimeout(() => {
        if (get().phaseAnnounce === 0) goToPhase('draw');
      }, redrawAt + OPENING_HAND_SIZE * MULTI_DRAW_STAGGER_MS + 700);
    },

    advancePhase: () => {
      if (get().activePlayer !== 'player') return; // opponent auto-plays its turn
      const phase = get().phase;
      // No attacks on the first turn of the game: Main goes straight to End.
      if (phase === 'main') goToPhase(get().turn === 1 ? 'end' : 'battle');
      else if (phase === 'battle') goToPhase('resolution');
      else if (phase === 'end') runOpponentTurn();
      // Draw and Resolution advance themselves; ignore manual clicks then.
    },

    aimAttack: (slotId) =>
      set((s) => {
        if (s.activePlayer !== 'player') return s;
        if (s.phase !== 'battle') return s;
        if (slotId[0] !== 'A' || !s.board[slotId]) return s;
        // A Hero Set this turn can't attack unless a Weapon was equipped to it.
        if (!heroCanAttack(s, 'player', slotId)) return s;
        // Clicking the source that's already aiming cancels the aim.
        if (s.targeting === slotId) return { targeting: null, aimPoint: null };
        // Begin aiming this source; drop its previous target so the old arrow
        // clears until a new one is picked. The live arrow tip starts at the
        // source until the pointer moves.
        const attackTargets = { ...s.attackTargets };
        delete attackTargets[slotId];
        return { targeting: slotId, attackTargets, aimPoint: null };
      }),

    assignTarget: (oppSlot) =>
      set((s) => {
        if (s.phase !== 'battle' || !s.targeting) return s;
        if (!s.opponentBoard[oppSlot]) return s;
        return {
          attackTargets: { ...s.attackTargets, [s.targeting]: oppSlot },
          targeting: null,
          aimPoint: null,
        };
      }),

    cancelTargeting: () => set(() => ({ targeting: null, aimPoint: null })),

    setAimPoint: (point) =>
      set((s) => (s.targeting ? { aimPoint: point } : s)),

    reset: () => set(() => ({ ...get(), ...createInitialState() })),
    };
  });
  trackFieldEntries(store);
  trackOppGraveyard(store);
  trackEquipment(store);
  return store;
}

/**
 * Field bookkeeping shared by every placement / removal path: stamp the turn a
 * Hero arrives on either A-board (the Set-turn attack rule), and drop counters,
 * Set-turn flags and per-card debuffs for cards that left the field.
 */
function trackFieldEntries(store: StoreApi<GameStore>) {
  store.subscribe((s, prev) => {
    if (
      s.board === prev.board &&
      s.opponentBoard === prev.opponentBoard &&
      s.opponentCBoard === prev.opponentCBoard &&
      s.opponentBBoard === prev.opponentBBoard
    )
      return;
    const aIds = (b: Record<string, CardId | null>, prefix: string) =>
      Object.entries(b).flatMap(([k, id]) => (id && k.startsWith(prefix) && /\d$/.test(k) ? [id] : []));
    const heroes = [...aIds(s.board, 'A'), ...aIds(s.opponentBoard, 'O')];
    const prevHeroes = new Set([...aIds(prev.board, 'A'), ...aIds(prev.opponentBoard, 'O')]);
    const onField = new Set<CardId>(
      [s.board, s.opponentBoard, s.opponentCBoard, s.opponentBBoard].flatMap((b) =>
        Object.values(b).filter((id): id is CardId => Boolean(id)),
      ),
    );
    let changed = false;
    const heroSetTurn = { ...s.heroSetTurn };
    for (const id of heroes) {
      if (!prevHeroes.has(id)) {
        heroSetTurn[id] = s.turn;
        changed = true;
      }
    }
    const prune = <T,>(m: Record<CardId, T>): Record<CardId, T> => {
      const out = { ...m };
      for (const k of Object.keys(out)) {
        if (!onField.has(k)) {
          delete out[k];
          changed = true;
        }
      }
      return out;
    };
    const next = {
      heroSetTurn: prune(heroSetTurn),
      setTurnAttack: prune(s.setTurnAttack),
      counters: prune(s.counters),
      enemyStatDebuffs: prune(s.enemyStatDebuffs),
      forcedTarget: s.forcedTarget && onField.has(s.forcedTarget) ? s.forcedTarget : null,
    };
    if (next.forcedTarget !== s.forcedTarget) changed = true;
    if (changed) store.setState(next);
  });
}

/**
 * Keep live HP / Armor Bars in step with Equipment. Gaining a bonus raises a
 * damaged Hero's current value by the same amount; losing one clamps it to the
 * new maximum. Ballistic Armor Plate is destroyed once its Hero loses a bar.
 */
function trackEquipment(store: StoreApi<GameStore>) {
  const applied = new Map<CardId, { hp: number; bars: number }>();
  // Bar count when a bar-loss Equipment attached; it breaks below this.
  const attachBars = new Map<CardId, number>();
  const sides = [
    { side: 'player' as const, slots: ['A1', 'A2', 'A3', 'A4'] as SlotId[] },
    { side: 'opponent' as const, slots: OPP_SLOT_IDS as readonly OppSlotId[] },
  ];
  store.subscribe((s, prev) => {
    if (
      s.board === prev.board &&
      s.opponentBoard === prev.opponentBoard &&
      s.opponentCBoard === prev.opponentCBoard &&
      s.currentArmorBars === prev.currentArmorBars
    )
      return;
    let currentHp = s.currentHp;
    let currentArmorBars = s.currentArmorBars;
    let board = s.board;
    let opponentCBoard = s.opponentCBoard;
    let graveyard = s.graveyard;
    let opponentGraveyard = s.opponentGraveyard;
    let changed = false;
    const seen = new Set<CardId>();
    for (const { side, slots } of sides) {
      for (const slot of slots) {
        const id = side === 'player' ? s.board[slot as SlotId] : s.opponentBoard[slot as OppSlotId];
        if (!id) continue;
        seen.add(id);
        const bonus = slotEquipBonus(s, side, slot);
        const old = applied.get(id) ?? { hp: 0, bars: 0 };
        if (bonus.hp !== old.hp && currentHp[id] !== undefined) {
          const max = (side === 'player' ? effectiveStats(s, slot as SlotId) : opponentEffectiveStats(s, slot as OppSlotId)).hp.value;
          const cur = currentHp[id];
          const next = bonus.hp > old.hp ? cur + (bonus.hp - old.hp) : Math.min(cur, max);
          if (next !== cur) {
            currentHp = { ...currentHp, [id]: next };
            changed = true;
          }
        }
        if (bonus.armorBars !== old.bars && currentArmorBars[id] !== undefined) {
          const cur = currentArmorBars[id];
          const next =
            bonus.armorBars > old.bars ? cur + (bonus.armorBars - old.bars) : Math.min(cur, heroMaxBars(s, side, slot));
          if (next !== cur) {
            currentArmorBars = { ...currentArmorBars, [id]: next };
            changed = true;
          }
        }
        applied.set(id, { hp: bonus.hp, bars: bonus.armorBars });
        const equip = linkedEquipment(s, side, slot);
        if (!equip?.equipStats?.destroyOnBarLoss) continue;
        const bars = currentArmorBars[id] ?? heroMaxBars(s, side, slot);
        if (!attachBars.has(equip.id)) attachBars.set(equip.id, bars);
        if (bars < attachBars.get(equip.id)!) {
          attachBars.delete(equip.id);
          const col = slot[slot.length - 1];
          if (side === 'player') {
            board = { ...board, [`C${col}`]: null };
            graveyard = [...graveyard, equip.id];
          } else {
            opponentCBoard = { ...opponentCBoard, [`OC${col}`]: null };
            opponentGraveyard = [...opponentGraveyard, equip.id];
          }
          changed = true;
        }
      }
    }
    for (const id of [...applied.keys()]) if (!seen.has(id)) applied.delete(id);
    const linked = new Set([...Object.values(board), ...Object.values(opponentCBoard)]);
    for (const id of [...attachBars.keys()]) if (!linked.has(id)) attachBars.delete(id);
    if (changed) store.setState({ currentHp, currentArmorBars, board, opponentCBoard, graveyard, opponentGraveyard });
  });
}

/** Stamp the turn each card enters the CPU's GY (Alliance of Zero reads "last
 *  turn"); forget cards that leave it. */
function trackOppGraveyard(store: StoreApi<GameStore>) {
  store.subscribe((s, prev) => {
    if (s.opponentGraveyard === prev.opponentGraveyard) return;
    const before = new Set(prev.opponentGraveyard);
    const inGy = new Set(s.opponentGraveyard);
    const next: Record<CardId, number> = {};
    let changed = false;
    for (const [id, turn] of Object.entries(s.oppGySentTurn ?? {})) {
      if (inGy.has(id)) next[id] = turn;
      else changed = true;
    }
    for (const id of s.opponentGraveyard) {
      if (!before.has(id)) {
        next[id] = s.turn;
        changed = true;
      }
    }
    if (changed) store.setState({ oppGySentTurn: next });
  });
}
