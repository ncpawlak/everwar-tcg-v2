import { useEffect } from 'react';
import { gameStore } from '../state/useGameStore';
import { threeAccess } from './threeAccess';
import {
  clientToNdc,
  exceededDragThreshold,
  pickDeck,
  pickHandIndex,
  projectToBoard,
} from './pickMath';
import { handCardPoses, deckCardPose, graveyardCardPose, replenCardPose, opponentGraveyardCardPose, opponentReplenCardPose } from '../board/layout';
import { boardCardAt, slotAtPoint, oppSlotAtPoint, oppCardAtPoint } from './hitTest';
import { resolveLinkedTarget, resolveAttackerSlot } from '../board/slotRules';
import type { CardId, OppSlotId, PileSource, SlotId } from '../state/types';

/**
 * DOM-driven pointer input. Attaches window pointer listeners and drives the
 * authoritative store by manually raycasting against the live camera. This
 * replaces R3F's onPointer* handlers, which don't fire reliably in some
 * embedded runtimes. Renders nothing.
 *
 * Gesture model: on press we record what's under the pointer without acting. A
 * release that never moved past the drag threshold is a CLICK (inspect a card /
 * draw the deck / deselect); a press on a hand card that moves past the
 * threshold becomes a DRAG (the Phase 1/2 place-a-card flow). This lets a plain
 * click open the inspection panel without disturbing drag-to-place.
 */

type PressKind = 'hand' | 'board' | 'deck' | 'pile' | 'opp' | 'empty';
interface Press {
  kind: PressKind;
  cardId: CardId | null;
  /** For a 'pile' press: which pile was pressed (graveyard/replen). */
  pile: PileSource | null;
  /** The board slot under the pointer at press time ('board'/'empty' presses). */
  slotId: SlotId | null;
  /** The opponent slot under the pointer at press time ('opp' presses). */
  oppSlot: OppSlotId | null;
  /** The specific opponent card under the pointer at press time (any zone), for
   * inspection — A, B or C. May be set even when oppSlot is null (a B card). */
  oppCardId: CardId | null;
  downX: number;
  downY: number;
  startedDrag: boolean;
}

export function PointerControls() {
  useEffect(() => {
    let press: Press | null = null;

    // True when the event originated inside a DOM UI overlay (e.g. the
    // inspection panel), which should not be treated as game-board input.
    const overUi = (e: PointerEvent) =>
      e.target instanceof Element && e.target.closest('[data-ui-overlay]') !== null;

    const onDown = (e: PointerEvent) => {
      const { camera, canvas } = threeAccess;
      if (!camera || !canvas) return;
      if (overUi(e)) return;
      const s = gameStore.getState();
      if (s.dragging) return;

      const ndc = clientToNdc(e.clientX, e.clientY, canvas);
      const base = { downX: e.clientX, downY: e.clientY, startedDrag: false, pile: null, slotId: null, oppSlot: null, oppCardId: null };

      // 1) Hand card — candidate for either inspect (click) or drag.
      const handPoses = handCardPoses(s.hand.length);
      const idx = pickHandIndex(ndc, camera, handPoses);
      if (idx >= 0) {
        press = { kind: 'hand', cardId: s.hand[idx], ...base };
        return;
      }

      // 2) Deck top — click to draw.
      if (s.deck.length > 0) {
        const deckTop = deckCardPose(s.deck.length - 1);
        if (pickDeck(ndc, camera, deckTop)) {
          press = { kind: 'deck', cardId: null, ...base };
          return;
        }
      }

      // 3) Graveyard / replen pile — click to open its search pop-up. Target the
      // top card's pose (or the empty placeholder slot when the pile is empty).
      const gravePose = graveyardCardPose(Math.max(0, s.graveyard.length - 1));
      if (pickDeck(ndc, camera, gravePose)) {
        press = { kind: 'pile', cardId: null, ...base, pile: 'graveyard' };
        return;
      }
      const replenPose = replenCardPose(Math.max(0, s.replen.length - 1));
      if (pickDeck(ndc, camera, replenPose)) {
        press = { kind: 'pile', cardId: null, ...base, pile: 'replen' };
        return;
      }

      // 3b) Opponent graveyard / replen pile — click to browse it (view-only).
      const oppGravePose = opponentGraveyardCardPose(Math.max(0, s.opponentGraveyard.length - 1));
      if (pickDeck(ndc, camera, oppGravePose)) {
        press = { kind: 'pile', cardId: null, ...base, pile: 'opponentGraveyard' };
        return;
      }
      const oppReplenPose = opponentReplenCardPose(Math.max(0, s.opponentReplen.length - 1));
      if (pickDeck(ndc, camera, oppReplenPose)) {
        press = { kind: 'pile', cardId: null, ...base, pile: 'opponentReplen' };
        return;
      }

      // 4) A placed board card — click to inspect (placed cards don't move yet).
      // We also record the slot under the pointer so a Battle-phase click on a
      // linked A/C zone can declare an attacker even when the zone is empty.
      const point = projectToBoard(ndc, camera);
      const slot = point ? slotAtPoint(point) : null;
      const boardCard = slot ? s.board[slot] : null;
      if (boardCard) {
        press = { kind: 'board', cardId: boardCard, ...base, slotId: slot };
        return;
      }

      // 4b) An opponent card — a Battle-phase attack target (any A/C zone in a
      // column resolves to that column's Vanguard via oppSlot) and/or an
      // inspectable card (the specific A/B/C card under the pointer via oppCardId).
      const oppSlot = point ? oppSlotAtPoint(point) : null;
      const oppCardId = point ? oppCardAtPoint(point, s) : null;
      if (oppSlot || oppCardId) {
        press = { kind: 'opp', cardId: null, ...base, oppSlot, oppCardId };
        return;
      }

      // 5) Empty space — click to close the inspection panel (or, in Battle,
      // start/cancel an attack aim via its linked zone).
      press = { kind: 'empty', cardId: null, ...base, slotId: slot };
    };

    const onMove = (e: PointerEvent) => {
      const { camera, canvas } = threeAccess;
      if (!camera || !canvas) return;
      const s = gameStore.getState();
      const ndc = clientToNdc(e.clientX, e.clientY, canvas);

      // Active drag: follow the pointer and track the hovered slot. For A/C
      // cards, hovering either zone of a linked column resolves to the card's
      // own-type slot in that column.
      if (s.dragging) {
        const point = projectToBoard(ndc, camera);
        if (!point) return;
        s.updateDrag(point);
        const cardType = s.cardsById[s.dragging.cardId]?.type;
        const raw = slotAtPoint(point);
        s.hoverSlot(cardType ? resolveLinkedTarget(s.board, raw, cardType) : raw);
        return;
      }

      // Aiming an attack: the arrow tip rubber-bands to the pointer over the mat.
      if (s.targeting) {
        const point = projectToBoard(ndc, camera);
        if (point) s.setAimPoint(point);
        document.body.style.cursor = 'crosshair';
        return;
      }

      // Pressing a hand card: promote to a drag once past the threshold.
      if (press && press.kind === 'hand' && !press.startedDrag && press.cardId) {
        if (exceededDragThreshold(press.downX, press.downY, e.clientX, e.clientY)) {
          press.startedDrag = true;
          s.beginDrag(press.cardId);
          const start = projectToBoard(ndc, camera);
          if (start) s.updateDrag(start);
          document.body.style.cursor = 'grabbing';
          return;
        }
      }

      // Idle: raise the hand card under the pointer, or hint over an inspectable
      // board card.
      const idx = pickHandIndex(ndc, camera, handCardPoses(s.hand.length));
      s.hoverCard(idx >= 0 ? s.hand[idx] : null);
      if (idx >= 0) {
        document.body.style.cursor = 'grab';
        return;
      }
      const point = projectToBoard(ndc, camera);
      const overBoardCard = point ? boardCardAt(point, s.board) : null;
      document.body.style.cursor = overBoardCard ? 'pointer' : 'auto';
    };

    const onUp = (e: PointerEvent) => {
      const s = gameStore.getState();

      // Finish an in-progress drag (resolve the drop).
      if (s.dragging) {
        s.dropCard(s.dragging.cardId, s.dragging.hoveredSlotId);
        document.body.style.cursor = 'auto';
        press = null;
        return;
      }

      // A click = a press that never crossed the drag threshold.
      if (press && !press.startedDrag) {
        const isDrag = exceededDragThreshold(press.downX, press.downY, e.clientX, e.clientY);
        if (!isDrag) {
          // Battle-phase attack declaration by targeting:
          //  - click one of your occupied A columns to start aiming it,
          //  - then click an opponent card to lock the target (draws an arrow),
          //  - clicking elsewhere while aiming cancels.
          if (s.phase === 'battle') {
            if (press.kind === 'opp' && press.oppSlot) {
              if (s.targeting) {
                s.assignTarget(press.oppSlot);
                press = null;
                return;
              }
            } else if (press.kind === 'board' || press.kind === 'empty') {
              const attacker = resolveAttackerSlot(s.board, press.slotId);
              if (attacker) {
                s.aimAttack(attacker);
                press = null;
                return;
              }
              if (s.targeting) {
                s.cancelTargeting();
                press = null;
                return;
              }
            }
          }
          switch (press.kind) {
            case 'hand':
              s.selectCard(press.cardId);
              break;
            case 'board':
              // Outside Battle a board click inspects the card.
              s.selectCard(press.cardId);
              break;
            case 'opp':
              // Click an opponent card to inspect it (when not declaring an
              // attack) — any of its A/B/C cards. Falls back to the column's
              // Vanguard when the click landed on an empty linked zone.
              s.selectCard(press.oppCardId ?? (press.oppSlot ? s.opponentBoard[press.oppSlot] : null));
              break;
            case 'pile':
              if (press.pile) s.openPileSearch(press.pile);
              break;
            case 'empty':
              s.selectCard(null);
              break;
            // 'deck': manual draw is disabled — cards are only drawn by the
            // Draw phase / opening deal, never by clicking the deck.
          }
        }
      }
      press = null;
    };

    const onDblClick = (e: PointerEvent | MouseEvent) => {
      const { camera, canvas } = threeAccess;
      if (!camera || !canvas) return;
      if (overUi(e as PointerEvent)) return;
      const s = gameStore.getState();
      if (s.dragging) return;
      // Double-clicking a hand card in Main quick-sets it into the next legal
      // slot for its type; a no-op if it can't be placed anywhere.
      const ndc = clientToNdc(e.clientX, e.clientY, canvas);
      const idx = pickHandIndex(ndc, camera, handCardPoses(s.hand.length));
      if (idx >= 0) s.autoPlaceCard(s.hand[idx]);
    };

    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('dblclick', onDblClick);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('dblclick', onDblClick);
    };
  }, []);

  return null;
}
