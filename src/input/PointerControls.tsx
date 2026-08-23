import { useEffect } from 'react';
import { gameStore } from '../state/useGameStore';
import { threeAccess } from './threeAccess';
import { clientToNdc, pickDeck, pickHandIndex, projectToBoard } from './pickMath';
import { handCardPoses, deckCardPose } from '../board/layout';
import { slotAtPoint } from './hitTest';

/**
 * DOM-driven pointer input. Attaches window pointer listeners and drives the
 * authoritative store by manually raycasting against the live camera. This
 * replaces R3F's onPointer* handlers, which don't fire reliably in some
 * embedded runtimes. Renders nothing.
 *
 * Flow: pointerdown picks a hand card (begin drag) or the deck (draw);
 * pointermove projects onto the board and updates the drag + hovered slot;
 * pointerup resolves the drop via the store (which decides snap vs. return).
 */
export function PointerControls() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const { camera, canvas } = threeAccess;
      if (!camera || !canvas) return;
      const s = gameStore.getState();
      if (s.dragging) return;

      const ndc = clientToNdc(e.clientX, e.clientY, canvas);

      const handPoses = handCardPoses(s.hand.length);
      const idx = pickHandIndex(ndc, camera, handPoses);
      if (idx >= 0) {
        s.beginDrag(s.hand[idx]);
        const start = projectToBoard(ndc, camera);
        if (start) s.updateDrag(start);
        document.body.style.cursor = 'grabbing';
        return;
      }

      if (s.deck.length > 0) {
        const deckTop = deckCardPose(s.deck.length - 1);
        if (pickDeck(ndc, camera, deckTop)) {
          s.drawCard();
        }
      }
    };

    const onMove = (e: PointerEvent) => {
      const { camera, canvas } = threeAccess;
      if (!camera || !canvas) return;
      const s = gameStore.getState();
      const ndc = clientToNdc(e.clientX, e.clientY, canvas);

      // Not dragging: highlight the hand card under the pointer (raise it).
      if (!s.dragging) {
        const handPoses = handCardPoses(s.hand.length);
        const idx = pickHandIndex(ndc, camera, handPoses);
        s.hoverCard(idx >= 0 ? s.hand[idx] : null);
        document.body.style.cursor = idx >= 0 ? 'grab' : 'auto';
        return;
      }

      const point = projectToBoard(ndc, camera);
      if (!point) return;
      s.updateDrag(point);
      s.hoverSlot(slotAtPoint(point));
    };

    const onUp = () => {
      const s = gameStore.getState();
      if (!s.dragging) return;
      s.dropCard(s.dragging.cardId, s.dragging.hoveredSlotId);
      document.body.style.cursor = 'auto';
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
