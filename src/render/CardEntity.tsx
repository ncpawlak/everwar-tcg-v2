import type { CardId } from '../state/types';
import { useGameStore } from '../state/useGameStore';
import { selectCardVisual } from '../animation/poseSelectors';
import { MotionCard } from '../animation/MotionCard';
import { CardView } from '../cards/CardView';

/**
 * Renders one card. Its target pose/face/feel come entirely from state via
 * `selectCardVisual`, so moving between deck/hand/board animates automatically.
 * Pointer picking is handled at the DOM level (PointerControls), so this
 * component is purely presentational.
 */
export function CardEntity({ cardId }: { cardId: CardId }) {
  const state = useGameStore((s) => s);
  const visual = selectCardVisual(state, cardId, state.hoveredCardId);
  const type = state.cardsById[cardId].type;

  return (
    <MotionCard pose={visual.pose} config={visual.config} scale={visual.scale}>
      <CardView type={type} />
    </MotionCard>
  );
}
