import type { GameState, CardId, Pose } from '../state/types';
import type { SpringConfig } from '@react-spring/three';
import { SLOT_IDS } from '../state/cardData';
import { deckCardPose, deckSpreadPose, handCardPoses, slotCardPose, graveyardCardPose, replenCardPose, FAN_UP } from '../board/layout';
import { BOARD_CARD_SCALE, CARD_HEIGHT } from '../board/boardConfig';
import { DRAG_LIFT, SPRING } from './motionConfig';

/** Hovered hand card rises this far straight up on screen (50% of card height). */
const HOVER_LIFT = CARD_HEIGHT * 0.5;

/** A card's zone right now, used to pick face orientation + spring feel. */
export type CardVisualZone = 'deck' | 'hand' | 'dragging' | 'board' | 'graveyard' | 'replen';

export interface CardVisual {
  pose: Pose;
  faceUp: boolean;
  zone: CardVisualZone;
  config: SpringConfig;
  /** Uniform scale of the card mesh (hand = 1, board/deck shrink). */
  scale: number;
}

/**
 * Pure mapping from authoritative state to a card's visual target. This is the
 * single place that decides "where should this card be drawn and how should it
 * move to get there" — keeping the scene dumb and the animation state-driven.
 */
export function selectCardVisual(
  state: GameState,
  cardId: CardId,
  hoveredCardId: CardId | null = null,
): CardVisual {
  // Board (occupies a slot)
  for (const slotId of SLOT_IDS) {
    if (state.board[slotId] === cardId) {
      return {
        pose: slotCardPose(slotId),
        faceUp: true,
        zone: 'board',
        config: SPRING.snap,
        scale: BOARD_CARD_SCALE,
      };
    }
  }

  // Actively dragging this card — follow the projected pointer (full size).
  if (state.dragging && state.dragging.cardId === cardId) {
    const [x, , z] = state.dragging.projectedPoint;
    return {
      pose: { position: [x, DRAG_LIFT, z], rotation: [-0.25, 0, 0] },
      faceUp: true,
      zone: 'dragging',
      config: SPRING.drag,
      scale: 1,
    };
  }

  // In hand — fan layout, with an optional hover lift straight up on screen.
  const handIndex = state.hand.indexOf(cardId);
  if (handIndex >= 0) {
    const pose = handCardPoses(state.hand.length)[handIndex];
    const lifted =
      hoveredCardId === cardId
        ? {
            position: [
              pose.position[0] + FAN_UP[0] * HOVER_LIFT,
              pose.position[1] + FAN_UP[1] * HOVER_LIFT,
              pose.position[2] + FAN_UP[2] * HOVER_LIFT,
            ] as Pose['position'],
            rotation: pose.rotation,
          }
        : pose;
    return { pose: lifted, faceUp: true, zone: 'hand', config: SPRING.hand, scale: 1 };
  }

  // In the graveyard — face-up, stacked at the grave anchor.
  const graveIndex = state.graveyard.indexOf(cardId);
  if (graveIndex >= 0) {
    return {
      pose: graveyardCardPose(graveIndex),
      faceUp: true,
      zone: 'graveyard',
      config: SPRING.snap,
      scale: BOARD_CARD_SCALE,
    };
  }

  // In the replenish pile — face-up, stacked at the replen anchor.
  const replenIndex = state.replen.indexOf(cardId);
  if (replenIndex >= 0) {
    return {
      pose: replenCardPose(replenIndex),
      faceUp: true,
      zone: 'replen',
      config: SPRING.snap,
      scale: BOARD_CARD_SCALE,
    };
  }

  // Otherwise in the deck (face down, board scale). During a shuffle the deck
  // splits into two lifted piles (spread pose) before collapsing back.
  const deckIndex = state.deck.indexOf(cardId);
  return {
    pose: state.deckSpread ? deckSpreadPose(deckIndex) : deckCardPose(deckIndex),
    faceUp: false,
    zone: 'deck',
    config: state.deckSpread ? SPRING.snap : SPRING.draw,
    scale: BOARD_CARD_SCALE,
  };
}
