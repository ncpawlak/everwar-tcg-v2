import type { GameState, CardId, OppSlotId, Pose } from '../state/types';
import type { SpringConfig } from '@react-spring/three';
import { SLOT_IDS } from '../state/cardData';
import { deckCardPose, deckSpreadPose, handCardPoses, slotCardPose, graveyardCardPose, replenCardPose, summonShowcasePose, SUMMON_SHOWCASE_SCALE, FAN_UP, opponentSlotCardPose, opponentBSlotCardPose, opponentCSlotCardPose, opponentGraveyardCardPose } from '../board/layout';
import { BOARD_CARD_SCALE, CARD_HEIGHT, OPP_SLOT_IDS } from '../board/boardConfig';
import { DRAG_LIFT, SPRING } from './motionConfig';

/** Hovered hand card rises this far straight up on screen (50% of card height). */
const HOVER_LIFT = CARD_HEIGHT * 0.5;

/** A card's zone right now, used to pick face orientation + spring feel. */
export type CardVisualZone = 'deck' | 'hand' | 'dragging' | 'board' | 'graveyard' | 'replen' | 'summon';

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
  // Summon reveal: a just-set card is showcased big & centered over the field
  // before it flies to its slot. Takes priority over its board pose so the card
  // pops up first, then (once the transient summon clears) springs to the slot.
  if (state.summon && state.summon.cardId === cardId) {
    return {
      pose: summonShowcasePose(),
      faceUp: true,
      zone: 'summon',
      config: SPRING.summon,
      scale: SUMMON_SHOWCASE_SCALE,
    };
  }

  // Activated-ability showcase: the owning Hero pops big & centered with the
  // amber ripple, then springs back to its slot once the showcase clears.
  if (state.abilityShowcase && state.abilityShowcase.cardId === cardId) {
    return {
      pose: summonShowcasePose(),
      faceUp: true,
      zone: 'summon',
      config: SPRING.summon,
      scale: SUMMON_SHOWCASE_SCALE,
    };
  }

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

/** Visual target for an opponent A-card: on its far-row slot (upside-down flat)
 * while alive, or springing into the mirrored opponent graveyard once destroyed.
 * Returns null if the card is neither on the board nor in the grave (shouldn't
 * happen for the seeded A-cards). */
export function selectOpponentCardVisual(
  state: GameState,
  cardId: CardId,
): { pose: Pose; zone: 'board' | 'graveyard' | 'summon'; config: SpringConfig; scale: number } | null {
  // Summon reveal: a just-summoned opponent card is showcased big & centered
  // facing the camera (its face-down hand back "flips up") before it springs to
  // its slot — mirror of the player's summon showcase.
  if (state.oppSummon && state.oppSummon.cardId === cardId) {
    return {
      pose: summonShowcasePose(),
      zone: 'summon',
      config: SPRING.summon,
      scale: SUMMON_SHOWCASE_SCALE,
    };
  }
  for (const slot of OPP_SLOT_IDS) {
    if (state.opponentBoard[slot] === cardId) {
      return {
        pose: opponentSlotCardPose(slot as OppSlotId),
        zone: 'board',
        config: SPRING.snap,
        scale: BOARD_CARD_SCALE,
      };
    }
  }
  const graveIndex = state.opponentGraveyard.indexOf(cardId);
  if (graveIndex >= 0) {
    return {
      pose: opponentGraveyardCardPose(graveIndex),
      zone: 'graveyard',
      config: SPRING.snap,
      scale: BOARD_CARD_SCALE,
    };
  }
  // Opponent Arcane (B) row — mirror of the player's B slots.
  for (const ob of ['OB1', 'OB2', 'OB3', 'OB4'] as const) {
    if (state.opponentBBoard[ob] === cardId) {
      return {
        pose: opponentBSlotCardPose(Number(ob.slice(2))),
        zone: 'board',
        config: SPRING.snap,
        scale: BOARD_CARD_SCALE,
      };
    }
  }
  // Opponent Bulwark (C) row — mirror of the player's C slots.
  for (const oc of ['OC1', 'OC2', 'OC3', 'OC4'] as const) {
    if (state.opponentCBoard[oc] === cardId) {
      return {
        pose: opponentCSlotCardPose(Number(oc.slice(2))),
        zone: 'board',
        config: SPRING.snap,
        scale: BOARD_CARD_SCALE,
      };
    }
  }
  return null;
}
