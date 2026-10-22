import { createStore, type StoreApi } from 'zustand/vanilla';
import type { CardId, CardType, DiceState, GameState, OppBSlotId, OppCSlotId, OppSlotId, PileSource, Phase, RollResult, SlotId, Vec3 } from './types';
import { ABILITY_REGISTRY, runEffect } from './abilities';
import { createInitialState } from './cardData';
import { canDropCard, requiresTribute, canAffordTribute, validTargetSlots } from '../board/slotRules';
import { shuffleArray } from './shuffle';
import {
  rollCBuff,
  effectiveStats,
  opponentEffectiveStats,
  playerAuraDelta,
  opponentAuraDelta,
  linkedCSlot,
} from './combatStats';
import { resolveRoll } from './diceRules';
import { applyArmorToHit } from './armorCombat';
import { parseAbility } from '../abilities/parseAbility';
import {
  abilityNeedsTarget,
  abilityTargetOptions,
  abilityZones,
  activationFeasible,
  costPickZone,
  playerBoardHeroes,
} from '../abilities/activated';
import type { AbilityIR } from '../abilities/abilityIR';
import { onSentAbilities, pileActivatedAbilityFor } from '../abilities/pile';
import { combatHitAbilities, finisherEliminates } from '../abilities/combat';
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

/** How long (ms) the opponent's Main phase lasts before Battle. Sized to fit its
 * maximum three paced plays (A, C, B) — the last starts at 2×OPP_PLAY_STEP_MS
 * and clears one showcase later — with margin, so the whole row settles before
 * attacks are declared. */
export const OPP_MAIN_DURATION_MS = 3 * OPP_PLAY_STEP_MS;

/** How long (ms) the End phase dwells before auto-handing the turn to the other
 * player. Lets the End banner + B-discard/replen-shuffle cleanup play before the
 * turn flips. Applies to the player's End; the opponent's End is paced by
 * OPP_PHASE_STEP_MS inside its auto-turn (Phase 7). */
export const END_PHASE_DWELL_MS = 1400;

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
  return createStore<GameStore>((set, get) => {
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
        // A C card rolls a random stat boost for its linked A card when set.
        const cardsById =
          cardType === 'C'
            ? { ...s.cardsById, [cardId]: { ...s.cardsById[cardId], buff: rollCBuff() } }
            : s.cardsById;
        // A B card's on-play ability resolves once its showcase finishes.
        const ability = cardType === 'B' ? s.cardsById[cardId]?.ability : undefined;
        set({
          cardsById,
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
          if (ability) enactOnSetAbility(ability);
          if (cardType === 'A') runOnSetTriggers(cardId, slotId, setInfo);
        }, SUMMON_SHOWCASE_MS);
      };

      /**
       * End-phase resolution (fires on ENTERING End): shuffle the replen pile
       * back into the deck ONLY when it holds cards (an empty replen leaves the
       * deck untouched — no needless shuffle), then send every non-continuous B
       * card on the field to the graveyard. Continuous B cards stay put.
       */
      const runEndPhase = () => {
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
          const maxHp = defCard?.hp ?? 0;
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
          const bars = currentArmorBars[oppId] ?? defCard?.armorBars ?? 0;
          if (finisherEliminates(combat, defCard, { outcome: result.outcome, currentHp: cur, bars })) {
            currentHp[oppId] = 0;
            damagePopups[targetSlot] = (damagePopups[targetSlot] ?? 0) + cur;
            destroying.add(targetSlot);
            return { currentHp, damagePopups, destroying: [...destroying] };
          }

          // Normal armor math (armor auras from both sides fold into flat armor).
          const armor =
            (defCard?.armor ?? 0) + (defCard ? opponentAuraDelta(s, defCard, 'armor') : 0);
          const baseDmg = effectiveStats(s, src).dmg.value;
          // "Hits ignore Armor Bars" (Anvil): resolve as if bar-less; bars stay intact.
          const hitBars = combat.ignoreArmorBars ? 0 : bars;
          const hit = applyArmorToHit({ bars: hitBars, armor }, result.outcome, result.damage, baseDmg);
          if (!combat.ignoreArmorBars) currentArmorBars[oppId] = hit.bars;
          if (hit.hpDamage > 0) {
            const next = Math.max(0, cur - hit.hpDamage);
            currentHp[oppId] = next;
            damagePopups[targetSlot] = (damagePopups[targetSlot] ?? 0) + hit.hpDamage;
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
          const cur = s.currentHp[oppId] ?? defCard?.hp ?? 0;
          const bars = s.currentArmorBars[oppId] ?? defCard?.armorBars ?? 0;
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
                // DMG/ACC + any linked C-card boost) into an outcome + damage.
                const eff = effectiveStats(s, k as SlotId);
                results[k] = resolveRoll(value, eff.dmg.value, eff.acc.value);
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
            if (get().phase === 'end' && get().activePlayer === 'player') runOpponentTurn();
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
      const declareOpponentAttacks = () =>
        set((s) => {
          const occupied = (['A1', 'A2', 'A3', 'A4'] as SlotId[]).filter((a) => s.board[a]);
          if (occupied.length === 0) return { oppAttackTargets: {} };
          const targets: Partial<Record<OppSlotId, SlotId>> = {};
          for (const o of OPP_SLOT_IDS) {
            if (!s.opponentBoard[o]) continue;
            const sameCol = `A${o[1]}` as SlotId;
            targets[o] = s.board[sameCol]
              ? sameCol
              : occupied[Math.floor(Math.random() * occupied.length)];
          }
          return { oppAttackTargets: targets };
        });

      /** True while the opponent's auto-turn is the active turn. */
      const oppActive = () => get().activePlayer === 'opponent';

      /** Show the opponent's End banner, then hand the turn back to the player. */
      const finishOpponentTurn = () => {
        if (!oppActive()) return;
        set((s) => ({ phase: 'end', phaseAnnounce: s.phaseAnnounce + 1, oppAttackTargets: {} }));
        setTimeout(() => {
          if (!oppActive()) return;
          set((s) => ({ turn: s.turn + 1, activePlayer: 'player', usedActivatedAbilities: {} }));
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
                results[k] = resolveRoll(value, eff.dmg.value, eff.acc.value);
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
              // Resolve each opponent attacker's hit IN ORDER so Armor Bars deplete
              // per hit (a bar absorbs one hit then breaks).
              for (const src of Object.keys(s.oppAttackTargets) as OppSlotId[]) {
                const result = s.oppResolutionResults[src];
                if (!result || result.outcome === 'miss') continue;
                const target = s.oppAttackTargets[src] as SlotId | null;
                if (!target) continue;
                const pid = s.board[target];
                if (!pid) continue;
                const defCard = s.cardsById[pid];
                const maxHp = effectiveStats(s, target).hp.value;
                const armor =
                  (defCard?.armor ?? 0) +
                  (defCard ? playerAuraDelta(s, defCard, 'armor') : 0);
                const bars = currentArmorBars[pid] ?? defCard?.armorBars ?? 0;
                const baseDmg = opponentEffectiveStats(s, src).dmg.value;
                const hit = applyArmorToHit(
                  { bars, armor },
                  result.outcome,
                  result.damage,
                  baseDmg,
                );
                currentArmorBars[pid] = hit.bars;
                if (hit.hpDamage > 0) {
                  const cur = currentHp[pid] ?? maxHp;
                  const next = Math.max(0, cur - hit.hpDamage);
                  currentHp[pid] = next;
                  oppDamagePopups[target] = (oppDamagePopups[target] ?? 0) + hit.hpDamage;
                  if (next <= 0) destroyingSet.add(target);
                }
              }
              return {
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
              set((s) => {
                const board = { ...s.board };
                const graveyard = [...s.graveyard];
                const currentHp = { ...s.currentHp };
                const currentArmorBars = { ...s.currentArmorBars };
                const activatedStatBuffs = { ...s.activatedStatBuffs };
                const usedActivatedAbilities = { ...s.usedActivatedAbilities };
                for (const slot of ['A1', 'A2', 'A3', 'A4'] as SlotId[]) {
                  const pid = board[slot];
                  if (!pid || (currentHp[pid] ?? Infinity) > 0) continue;
                  destroyedAny = true;
                  board[slot] = null;
                  graveyard.push(pid);
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
                };
              });
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
       * center-screen (its reveal) then springs to its slot. Kept short so a
       * few plays can chain inside the Main window.
       */
      const revealOppCard = (cardId: CardId) =>
        setTimeout(() => {
          set((st) => (st.oppSummon && st.oppSummon.cardId === cardId ? { ...st, oppSummon: null } : st));
        }, OPP_PLAY_SHOWCASE_MS);

      /**
       * Opponent play step (Phase 7 Slice 4b): a simple heuristic AI plays ONE
       * card of a not-yet-played row type this turn, re-reading the live board so
       * a Bulwark can attach to a Vanguard summoned earlier the same turn. Order
       * of preference: summon a free Vanguard (A, level ≤ 2) into an open O-slot;
       * else set a Bulwark (C) onto an OC-slot whose linked O-column is occupied
       * (rolling its stat boost, like the player); else set an Arcane (B) into an
       * open OB-slot. Returns the type it played, or null if nothing was playable.
       * Each play is showcased as a reveal, mirroring the player's summon.
       */
      const opponentPlayStep = (playedTypes: Set<CardType>): CardType | null => {
        if (!oppActive()) return null;
        const s = get();
        const hand = s.opponentHand;

        // A — summon a free Vanguard into the first open O-slot.
        if (!playedTypes.has('A')) {
          const slot = OPP_SLOT_IDS.find((o) => !s.opponentBoard[o]);
          const cardId = hand.find((id) => {
            const c = s.opponentCards[id];
            return !!c && c.type === 'A' && !requiresTribute(c);
          });
          if (slot && cardId) {
            set((st) => ({
              opponentHand: st.opponentHand.filter((id) => id !== cardId),
              opponentBoard: { ...st.opponentBoard, [slot]: cardId },
              oppSummon: { cardId, slotId: slot },
            }));
            revealOppCard(cardId);
            return 'A';
          }
        }

        // C — set a Bulwark onto a linked, occupied, still-open OC-slot; roll its
        // stat boost for the linked Vanguard (mirror of the player's C set).
        if (!playedTypes.has('C')) {
          const cardId = hand.find((id) => s.opponentCards[id]?.type === 'C');
          const ocSlot = (['OC1', 'OC2', 'OC3', 'OC4'] as OppCSlotId[]).find((oc) => {
            const col = oc.slice(2);
            return !s.opponentCBoard[oc] && !!s.opponentBoard[`O${col}` as OppSlotId];
          });
          if (cardId && ocSlot) {
            set((st) => ({
              opponentHand: st.opponentHand.filter((id) => id !== cardId),
              opponentCBoard: { ...st.opponentCBoard, [ocSlot]: cardId },
              opponentCards: {
                ...st.opponentCards,
                [cardId]: { ...st.opponentCards[cardId], buff: rollCBuff() },
              },
              oppSummon: { cardId, slotId: ocSlot },
            }));
            revealOppCard(cardId);
            return 'C';
          }
        }

        // B — set an Arcane into the first open OB-slot. (Opponent on-play B
        // abilities don't resolve yet — deferred to a later slice.)
        if (!playedTypes.has('B')) {
          const cardId = hand.find((id) => s.opponentCards[id]?.type === 'B');
          const obSlot = (['OB1', 'OB2', 'OB3', 'OB4'] as OppBSlotId[]).find((ob) => !s.opponentBBoard[ob]);
          if (cardId && obSlot) {
            set((st) => ({
              opponentHand: st.opponentHand.filter((id) => id !== cardId),
              opponentBBoard: { ...st.opponentBBoard, [obSlot]: cardId },
              oppSummon: { cardId, slotId: obSlot },
            }));
            revealOppCard(cardId);
            return 'B';
          }
        }
        return null;
      };

      /**
       * Opponent Main phase (Phase 7 Slice 4b): play up to one card of each row
       * type, ONE AT A TIME — each card's reveal is showcased for a full
       * OPP_PLAY_SHOWCASE_MS and springs to its slot before the next play begins,
       * mirroring the deliberate feel of the player's summon (rather than a quick
       * flash). Each attempt re-reads the board via opponentPlayStep, so a Bulwark
       * can attach to a Vanguard summoned earlier this same turn. Stops as soon as
       * an attempt finds nothing left to play.
       */
      const opponentMainPhase = () => {
        const playedTypes = new Set<CardType>();
        const playNext = () => {
          if (!oppActive()) return;
          const played = opponentPlayStep(playedTypes);
          if (!played) return;
          playedTypes.add(played);
          // Pace the next play a full showcase + gap later, so the current card
          // finishes its reveal and settles before the next one begins.
          setTimeout(playNext, OPP_PLAY_STEP_MS);
        };
        playNext();
      };

      /**
       * Run the opponent's full auto-turn (Phase 7). Control passes here after
       * the player ends their turn. The opponent takes its own turn number and
       * steps draw -> main -> battle on a timer (shared HUD + banner announce
       * each, field highlight flips to its side), plays its cards during Main,
       * declares its attacks at Battle, then runs its Resolution (real
       * bidirectional combat, Slice 3). The Resolution engine shows the End
       * banner and hands control back when done.
       */
      const runOpponentTurn = () => {
        if (get().activePlayer !== 'player') return; // already running / idempotent
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
          opponentMainPhase();
        }, OPP_PHASE_STEP_MS);
        setTimeout(() => {
          if (!oppActive()) return;
          set((s) => ({ phase: 'battle', phaseAnnounce: s.phaseAnnounce + 1 }));
          declareOpponentAttacks();
        }, OPP_PHASE_STEP_MS + OPP_MAIN_DURATION_MS);
        setTimeout(() => {
          if (!oppActive()) return;
          set((s) => ({ phase: 'resolution', phaseAnnounce: s.phaseAnnounce + 1 }));
          beginOpponentResolution();
        }, OPP_PHASE_STEP_MS * 2 + OPP_MAIN_DURATION_MS);
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
      targetId: CardId | null,
    ) => {
      const s = get();
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

      let { activatedStatBuffs, turnStatBuffs, currentHp } = s;
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
          if (idx < 0) continue;
          const eqId = s.deck[idx];
          set({
            deck: s.deck.filter((_, i) => i !== idx),
            board: { ...s.board, [cSlot]: eqId },
            cardsById: { ...s.cardsById, [eqId]: { ...s.cardsById[eqId], buff: rollCBuff() } },
          });
          if (e.disturb) get().disturbDeck();
          showOnSet(cardId, ir.name);
        } else if (e.kind === 'destroyEnemyNormalHeroes') {
          const enemies = OPP_SLOT_IDS.flatMap((slot) => {
            const id = s.opponentBoard[slot];
            const card = id ? s.opponentCards[id] : undefined;
            return id && card ? [{ slot, card, hp: s.currentHp[id] ?? card.hp ?? 0 }] : [];
          });
          const victims = dominationVictims(enemies, info.materials);
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
      const need = card.level ?? 0;
      // Validate the selection: every slot is an occupied A slot and the levels
      // sum EXACTLY to the pending card's level.
      let sum = 0;
      for (const aSlot of materialSlots) {
        if (aSlot[0] !== 'A') return;
        const mid = s.board[aSlot];
        if (!mid) return;
        sum += s.cardsById[mid]?.level ?? 1;
      }
      if (sum !== need || materialSlots.length === 0) return;
      // Send each material A-card (and its linked C-card) away. Commanders send
      // their materials to the GRAVEYARD; ordinary level-3 summons to the replen.
      const toGraveyard = card.commander === true;
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
      set({ board, replen, graveyard, pendingTribute: null,
        pendingSummon: {
          cardId: pending.cardId,
          setKind: toGraveyard ? 'commit' : 'replen',
          materials: materialSlots.length,
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
      finishActivation(cardId, ir, null, null);
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
      finishActivation(at.sourceCardId, ir, cardId, null);
    },

    chooseAbilityTarget: (targetId) => {
      const s = get();
      const at = s.abilityTargeting;
      if (!at || at.step !== 'target') return;
      const source = s.cardsById[at.sourceCardId];
      if (!source || !source.abilities) return;
      const ir = parseAbility(source.abilities[at.abilityIndex]);
      const legal = abilityTargetOptions(ir, abilityZones(s), at.sourceCardId).some(
        (c) => c.id === targetId,
      );
      if (!legal) return;
      finishActivation(at.sourceCardId, ir, at.costCardId, targetId);
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
      set({ board, graveyard: [...s.graveyard, ...sent] });
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

    advancePhase: () => {
      if (get().activePlayer !== 'player') return; // opponent auto-plays its turn
      const phase = get().phase;
      if (phase === 'main') goToPhase('battle');
      else if (phase === 'battle') goToPhase('resolution');
      else if (phase === 'end') runOpponentTurn();
      // Draw and Resolution advance themselves; ignore manual clicks then.
    },

    aimAttack: (slotId) =>
      set((s) => {
        if (s.activePlayer !== 'player') return s;
        if (s.phase !== 'battle') return s;
        if (slotId[0] !== 'A' || !s.board[slotId]) return s;
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
}
