import { createStore, type StoreApi } from 'zustand/vanilla';
import type { BAbility, CardId, CardType, DiceState, GameState, OppSlotId, PileSource, Phase, RollResult, SlotId, Vec3 } from './types';
import { createInitialState } from './cardData';
import { canDropCard, requiresTribute, canAffordTribute, validTargetSlots } from '../board/slotRules';
import { shuffleArray } from './shuffle';
import { rollCBuff, effectiveStats, opponentEffectiveStats } from './combatStats';
import { resolveRoll } from './diceRules';
import { OPP_SLOT_IDS } from '../board/boardConfig';
import { MULTI_DRAW_STAGGER_MS } from '../animation/motionConfig';

/** How long (ms) the deck stays split into two piles before collapsing back. */
export const SHUFFLE_SPREAD_MS = 300;

/** How long (ms) a freshly set card is showcased over the field before it flies
 * down into its slot. */
export const SUMMON_SHOWCASE_MS = 800;

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
 * phase announcement plays fully before the next one (Phase 7). */
export const OPP_PHASE_STEP_MS = 1800;

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
   * send those A-cards (and their linked C-cards) to the replen pile, then place
   * the pending card into its target slot. No-op unless a tribute is pending and
   * the selected materials' levels sum exactly to the card's level.
   */
  confirmTributeSummon: (materialSlots: SlotId[]) => void;
  /** Cancel a pending tribute summon; the card stays in hand. */
  cancelTributeSummon: () => void;
  /** Cancel the drag, leaving the card in its existing hand order. */
  returnToHand: (cardId: CardId) => void;
  /** Raise a hand card under the pointer (selection hint), or clear with null. */
  hoverCard: (cardId: CardId | null) => void;
  /** Open the expanded detail view for any existing card (hand, board, or a
   * pile-search window: deck/graveyard/replen), or close with null. */
  selectCard: (cardId: CardId | null) => void;
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
      const enactBAbility = (ability: BAbility) => {
        const actions = get();
        switch (ability) {
          case 'draw1':
            drawStaggered(1);
            break;
          case 'draw2':
            drawStaggered(2);
            break;
          case 'graveyardIntoDeck':
            actions.graveyardIntoDeck();
            break;
          case 'replenIntoDeck':
            actions.replenIntoDeck();
            break;
        }
      };

      /**
       * Commit a validated placement: move the card hand -> board, roll a C
       * card's boost, kick off the summon showcase, and resolve a B card's
       * ability once the showcase clears. Assumes `slotId` is already known-legal
       * for the card. Shared by the drag-drop and double-click quick-set paths.
       */
      const commitPlacement = (cardId: CardId, cardType: CardType, slotId: SlotId) => {
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
          if (ability) enactBAbility(ability);
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
            // Snapshot each attacker's result for the HIT/MISS word (over YOUR
            // cards), then land the damage on the OPPONENT: aggregate every
            // attacker's damage onto its target, drain that opponent's HP, and
            // flag any opponent that hit 0 for the slash FX. Dice + pop-ups linger
            // together while we STAY in Resolution so the End banner can't collide.
            set((s) => {
              const popups: Record<string, RollResult> = { ...s.resolutionResults };
              const damageByTarget: Record<string, number> = {};
              for (const src of Object.keys(s.attackTargets) as SlotId[]) {
                const dmg = s.resolutionResults[src]?.damage ?? 0;
                if (dmg <= 0) continue;
                const target = s.attackTargets[src];
                if (!target) continue;
                damageByTarget[target] = (damageByTarget[target] ?? 0) + dmg;
              }
              const currentHp = { ...s.currentHp };
              const destroying: OppSlotId[] = [];
              const damagePopups: Record<string, number> = {};
              for (const target of Object.keys(damageByTarget) as OppSlotId[]) {
                const oppId = s.opponentBoard[target];
                if (!oppId) continue;
                const maxHp = s.opponentCards[oppId]?.hp ?? 0;
                const cur = currentHp[oppId] ?? maxHp;
                const dmg = damageByTarget[target];
                const next = Math.max(0, cur - dmg);
                currentHp[oppId] = next;
                damagePopups[target] = dmg;
                if (next <= 0) destroying.push(target);
              }
              return { outcomePopups: popups, damagePopups, currentHp, destroying };
            });
            // After the dwell, clear the dice + pop-ups and remove any opponent
            // whose HP hit 0 (it slashed, now it vanishes), THEN advance to End.
            setTimeout(() => {
              if (get().phase !== 'resolution') return;
              let destroyedAny = false;
              set((s) => {
                const opponentBoard = { ...s.opponentBoard };
                const opponentGraveyard = [...s.opponentGraveyard];
                const currentHp = { ...s.currentHp };
                for (const slot of OPP_SLOT_IDS) {
                  const oppId = opponentBoard[slot];
                  if (!oppId || (currentHp[oppId] ?? Infinity) > 0) continue;
                  destroyedAny = true;
                  // Free the slot but keep the card alive in state so it springs
                  // from the slot into the opponent graveyard pile (mirror of the
                  // player's death → graveyard travel) instead of vanishing.
                  opponentBoard[slot] = null;
                  opponentGraveyard.push(oppId);
                  delete currentHp[oppId];
                }
                return {
                  outcomePopups: {},
                  damagePopups: {},
                  resolutionRolls: {},
                  resolutionResults: {},
                  destroying: [],
                  opponentBoard,
                  opponentGraveyard,
                  currentHp,
                };
              });
              // If an opponent was destroyed, hold in Resolution briefly so the
              // slash finishes and the card visibly clears before the End banner.
              if (destroyedAny) {
                setTimeout(() => {
                  if (get().phase === 'resolution') goToPhase('end');
                }, GRAVEYARD_TRAVEL_MS);
              } else {
                goToPhase('end');
              }
            }, OUTCOME_POPUP_MS);
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
          set((s) => ({ turn: s.turn + 1, activePlayer: 'player' }));
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
              const damageByTarget: Record<string, number> = {};
              for (const src of Object.keys(s.oppAttackTargets) as OppSlotId[]) {
                const dmg = s.oppResolutionResults[src]?.damage ?? 0;
                if (dmg <= 0) continue;
                const target = s.oppAttackTargets[src];
                if (!target) continue;
                damageByTarget[target] = (damageByTarget[target] ?? 0) + dmg;
              }
              const currentHp = { ...s.currentHp };
              const oppDestroying: SlotId[] = [];
              const oppDamagePopups: Partial<Record<SlotId, number>> = {};
              for (const target of Object.keys(damageByTarget) as SlotId[]) {
                const pid = s.board[target];
                if (!pid) continue;
                const maxHp = effectiveStats(s, target).hp.value;
                const cur = currentHp[pid] ?? maxHp;
                const dmg = damageByTarget[target];
                const next = Math.max(0, cur - dmg);
                currentHp[pid] = next;
                oppDamagePopups[target] = dmg;
                if (next <= 0) oppDestroying.push(target);
              }
              return { oppOutcomePopups: popups, oppDamagePopups, currentHp, oppDestroying };
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
                for (const slot of ['A1', 'A2', 'A3', 'A4'] as SlotId[]) {
                  const pid = board[slot];
                  if (!pid || (currentHp[pid] ?? Infinity) > 0) continue;
                  destroyedAny = true;
                  board[slot] = null;
                  graveyard.push(pid);
                  delete currentHp[pid];
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
       * Run the opponent's full auto-turn (Phase 7). Control passes here after
       * the player ends their turn. The opponent takes its own turn number and
       * steps draw -> main -> battle on a timer (shared HUD + banner announce
       * each, field highlight flips to its side), declares its attacks at Battle,
       * then runs its Resolution (real bidirectional combat, Slice 3). The
       * Resolution engine shows the End banner and hands control back when done.
       */
      const runOpponentTurn = () => {
        if (get().activePlayer !== 'player') return; // already running / idempotent
        set((s) => ({
          turn: s.turn + 1,
          activePlayer: 'opponent',
          phase: 'draw',
          phaseAnnounce: s.phaseAnnounce + 1,
        }));
        setTimeout(() => {
          if (!oppActive()) return;
          set((s) => ({ phase: 'main', phaseAnnounce: s.phaseAnnounce + 1 }));
        }, OPP_PHASE_STEP_MS);
        setTimeout(() => {
          if (!oppActive()) return;
          set((s) => ({ phase: 'battle', phaseAnnounce: s.phaseAnnounce + 1 }));
          declareOpponentAttacks();
        }, OPP_PHASE_STEP_MS * 2);
        setTimeout(() => {
          if (!oppActive()) return;
          set((s) => ({ phase: 'resolution', phaseAnnounce: s.phaseAnnounce + 1 }));
          beginOpponentResolution();
        }, OPP_PHASE_STEP_MS * 3);
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
      // Cards may only be set during the Main phase.
      if (
        s.phase === 'main' &&
        card &&
        slotId !== null &&
        canDropCard(s.board, s.cardsById, slotId, card)
      ) {
        if (requiresTribute(card)) {
          // Hold the card in hand and open material selection instead of placing.
          set({ dragging: null, pendingTribute: { cardId, slotId } });
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
      // Quick-set is Main-phase only and never interrupts an active drag.
      if (s.activePlayer !== 'player') return;
      if (s.phase !== 'main' || s.dragging !== null) return;
      if (!s.hand.includes(cardId)) return;
      const card = s.cardsById[cardId];
      if (!card) return;
      // A tribute-summon card can't just drop into a slot — open material
      // selection (if affordable), targeting the first open A slot.
      if (requiresTribute(card)) {
        if (!canAffordTribute(s.board, s.cardsById, card)) return;
        const target = validTargetSlots(s.board, 'A')[0];
        if (!target) return;
        set({ pendingTribute: { cardId, slotId: target } });
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
      for (const aSlot of materialSlots) {
        sink.push(board[aSlot]!);
        board[aSlot] = null;
        const cSlot = `C${aSlot[1]}` as SlotId;
        if (board[cSlot]) {
          sink.push(board[cSlot]!);
          board[cSlot] = null;
        }
      }
      set({ board, replen, graveyard, pendingTribute: null });
      // The target A slot is now guaranteed empty; run the normal placement +
      // summon showcase for the card (still in hand until this fires).
      commitPlacement(pending.cardId, 'A', pending.slotId);
    },

    cancelTributeSummon: () => set(() => ({ pendingTribute: null })),

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

    destroyZoneA: () =>
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
        return { ...s, board, graveyard: [...s.graveyard, ...sent] };
      }),

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
