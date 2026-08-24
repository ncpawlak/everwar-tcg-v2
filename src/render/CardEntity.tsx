import type { Card, CardId } from '../state/types';
import { useGameStore } from '../state/useGameStore';
import { selectCardVisual } from '../animation/poseSelectors';
import { MotionCard } from '../animation/MotionCard';
import { CardView } from '../cards/CardView';
import { projectingAuraCardIds } from '../abilities/auras';

/**
 * Renders one card. Its target pose/face/feel come entirely from state via
 * `selectCardVisual`, so moving between deck/hand/board animates automatically.
 * Pointer picking is handled at the DOM level (PointerControls), so this
 * component is purely presentational.
 */
export function CardEntity({ cardId }: { cardId: CardId }) {
  const state = useGameStore((s) => s);
  const visual = selectCardVisual(state, cardId, state.hoveredCardId);
  const card = state.cardsById[cardId];

  // A board Hero glows while it is projecting an active passive aura.
  const boardHeroes: Card[] = [];
  for (const id of Object.values(state.board)) {
    const c = id ? state.cardsById[id] : undefined;
    if (c && c.type === 'A') boardHeroes.push(c);
  }
  const auraActive = projectingAuraCardIds(boardHeroes).has(cardId);

  return (
    <MotionCard pose={visual.pose} config={visual.config} scale={visual.scale}>
      <CardView card={card} auraActive={auraActive} armorBars={state.currentArmorBars[cardId]} />
    </MotionCard>
  );
}
