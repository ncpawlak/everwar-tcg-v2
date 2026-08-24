import type { Card, CardId } from '../state/types';
import { useGameStore } from '../state/useGameStore';
import { selectCardVisual } from '../animation/poseSelectors';
import { MotionCard } from '../animation/MotionCard';
import { CardView } from '../cards/CardView';
import { projectingAuraCardIds } from '../abilities/auras';
import { hasAvailableActivated } from '../abilities/activated';

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

  // The Hero glows amber while it holds an activated ability the player can
  // trigger this moment (its own Main phase, on the player's board, unused).
  // Suppressed while this card is mid-summon-showcase so the ring only appears
  // once the card has settled onto the field.
  const onPlayerBoard = Object.values(state.board).includes(cardId);
  const inShowcase = state.summon?.cardId === cardId;
  const showcasing = state.abilityShowcase?.cardId === cardId;
  const activatable =
    card?.type === 'A' &&
    onPlayerBoard &&
    !inShowcase &&
    hasAvailableActivated(card, {
      isPlayerMain: state.activePlayer === 'player' && state.phase === 'main',
      onPlayerBoard,
      usedNames: state.usedActivatedAbilities[cardId] ?? [],
    });

  return (
    <MotionCard pose={visual.pose} config={visual.config} scale={visual.scale}>
      <CardView
        card={card}
        auraActive={auraActive}
        activatable={activatable}
        showcasing={showcasing}
        armorBars={state.currentArmorBars[cardId]}
      />
    </MotionCard>
  );
}
