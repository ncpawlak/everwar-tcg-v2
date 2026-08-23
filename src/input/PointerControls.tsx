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
import { handCardPoses, deckCardPose } from '../board/layout';
import { boardCardAt, slotAtPoint } from './hitTest';
import type { CardId } from '../state/types';

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

type PressKind = 'hand' | 'board' | 'deck' | 'empty';
interface Press {
  kind: PressKind;
  cardId: CardId | null;
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
      const base = { downX: e.clientX, downY: e.clientY, startedDrag: false };

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

      // 3) A placed board card — click to inspect (placed cards don't move yet).
      const point = projectToBoard(ndc, camera);
      const boardCard = point ? boardCardAt(point, s.board) : null;
      if (boardCard) {
        press = { kind: 'board', cardId: boardCard, ...base };
        return;
      }

      // 4) Empty space — click to close the inspection panel.
      press = { kind: 'empty', cardId: null, ...base };
    };

    const onMove = (e: PointerEvent) => {
      const { camera, canvas } = threeAccess;
      if (!camera || !canvas) return;
      const s = gameStore.getState();
      const ndc = clientToNdc(e.clientX, e.clientY, canvas);

      // Active drag: follow the pointer and track the hovered slot.
      if (s.dragging) {
        const point = projectToBoard(ndc, camera);
        if (!point) return;
        s.updateDrag(point);
        s.hoverSlot(slotAtPoint(point));
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
          switch (press.kind) {
            case 'hand':
            case 'board':
              s.selectCard(press.cardId);
              break;
            case 'deck':
              s.drawCard();
              break;
            case 'empty':
              s.selectCard(null);
              break;
          }
        }
      }
      press = null;
    };

    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  return null;
}
