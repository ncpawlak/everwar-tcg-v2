import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { CardId, Pose } from '../state/types';
import { perSnapshot, useGameStore } from '../state/useGameStore';
import { playerField } from '../state/combatStats';
import { selectCardVisual } from '../animation/poseSelectors';
import { MotionCard } from '../animation/MotionCard';
import { CardView } from '../cards/CardView';
import { projectingAuraCardIds } from '../abilities/auras';
import { abilityZones, hasAvailableActivated } from '../abilities/activated';

// Shared across every CardEntity: computed once per store update, not per card.
const auraIdsOf = perSnapshot((s) => projectingAuraCardIds(playerField(s)));
const zonesOf = perSnapshot((s) => abilityZones(s));
const boardIdsOf = perSnapshot((s) => new Set(Object.values(s.board)));

/** Below the top two of a face-up pile stack: covered, so skip its face. (Two,
 *  so the card under one that's still flying in doesn't blank early.) */
export function buriedInPile(pile: readonly CardId[], cardId: CardId): boolean {
  const i = pile.indexOf(cardId);
  return i >= 0 && i < pile.length - 2;
}

/**
 * Renders one card. Its target pose/face/feel come entirely from state via
 * `selectCardVisual`, so moving between deck/hand/board animates automatically.
 * Pointer picking is handled at the DOM level (PointerControls), so this
 * component is purely presentational.
 *
 * The selector flattens everything this card needs into primitives so the card
 * only re-renders when ITS pose or flags change (not on every pointer move).
 */
export function CardEntity({ cardId }: { cardId: CardId }) {
  const v = useGameStore(
    useShallow((state) => {
      const visual = selectCardVisual(state, cardId, state.hoveredCardId);
      const card = state.cardsById[cardId];
      const [px, py, pz] = visual.pose.position;
      const [rx, ry, rz] = visual.pose.rotation;
      // The Hero glows amber while it holds an activated ability the player can
      // trigger this moment (its own Main phase, on the player's board, unused).
      // Suppressed while this card is mid-summon-showcase so the ring only
      // appears once the card has settled onto the field.
      const onPlayerBoard = boardIdsOf(state).has(cardId);
      const activatable =
        card?.type === 'A' &&
        onPlayerBoard &&
        state.summon?.cardId !== cardId &&
        hasAvailableActivated(card, {
          isPlayerMain: state.activePlayer === 'player' && state.phase === 'main',
          onPlayerBoard,
          usedNames: state.usedActivatedAbilities[cardId] ?? [],
          ...zonesOf(state),
        });
      return {
        px, py, pz, rx, ry, rz,
        config: visual.config,
        scale: visual.scale,
        card,
        // A board Hero glows while it is projecting an active passive aura.
        auraActive: auraIdsOf(state).has(cardId),
        activatable,
        showcasing: state.abilityShowcase?.cardId === cardId,
        armorBars: state.currentArmorBars[cardId],
        faceHidden: !visual.faceUp || buriedInPile(state.graveyard, cardId) || buriedInPile(state.replen, cardId),
      };
    }),
  );

  const pose = useMemo<Pose>(
    () => ({ position: [v.px, v.py, v.pz], rotation: [v.rx, v.ry, v.rz] }),
    [v.px, v.py, v.pz, v.rx, v.ry, v.rz],
  );

  return (
    <MotionCard pose={pose} config={v.config} scale={v.scale}>
      <CardView
        card={v.card}
        auraActive={v.auraActive}
        activatable={v.activatable}
        showcasing={v.showcasing}
        armorBars={v.armorBars}
        faceHidden={v.faceHidden}
      />
    </MotionCard>
  );
}
