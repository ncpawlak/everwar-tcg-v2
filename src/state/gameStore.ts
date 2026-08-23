import { createStore, type StoreApi } from 'zustand/vanilla';
import type { BAbility, CardId, GameState, PileSource, SlotId, Vec3 } from './types';
import { createInitialState } from './cardData';
import { canDrop } from '../board/slotRules';
import { shuffleArray } from './shuffle';
import { rollCBuff } from './combatStats';
import { MULTI_DRAW_STAGGER_MS } from '../animation/motionConfig';

/** How long (ms) the deck stays split into two piles before collapsing back. */
export const SHUFFLE_SPREAD_MS = 300;

/** How long (ms) a freshly set card is showcased over the field before it flies
 * down into its slot. */
export const SUMMON_SHOWCASE_MS = 800;

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
  /** Move the whole graveyard into the deck, then shuffle (animated). */
  graveyardIntoDeck: () => void;
  /** Return the whole hand to the deck, then shuffle (animated). */
  handIntoDeck: () => void;
  /** Open the pile-search pop-up for a pile (deck/graveyard/replen). Opened by
   * a dev button or by clicking the pile on the board. */
  openPileSearch: (source: PileSource) => void;
  /** Close the pile-search pop-up. */
  closePileSearch: () => void;
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
      const cardType = s.cardsById[cardId]?.type;
      if (cardType && canDrop(s.board, slotId, cardType) && slotId !== null) {
        // A C card rolls a random stat boost for its linked A card when set.
        const cardsById =
          cardType === 'C'
            ? {
                ...s.cardsById,
                [cardId]: { ...s.cardsById[cardId], buff: rollCBuff() },
              }
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
        return;
      }
      // Invalid drop: keep card in hand (order preserved), end the drag.
      set({ dragging: null });
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
        if (!s.cardsById[cardId]) return s;
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

    graveyardIntoDeck: () =>
      beginShuffle((s) => ({ deck: [...s.deck, ...s.graveyard], graveyard: [] })),

    handIntoDeck: () =>
      beginShuffle((s) => ({
        deck: [...s.deck, ...s.hand],
        hand: [],
        hoveredCardId: null,
      })),

    openPileSearch: (source) => set(() => ({ pileSearch: source })),

    closePileSearch: () => set(() => ({ pileSearch: null })),

    reset: () => set(() => ({ ...get(), ...createInitialState() })),
    };
  });
}
