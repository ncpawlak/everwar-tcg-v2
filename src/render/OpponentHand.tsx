import { useEffect, useState } from 'react';
import { MotionCard } from '../animation/MotionCard';
import { SPRING, OPENING_DEAL_STAGGER_MS } from '../animation/motionConfig';
import { opponentDeckPose, opponentHandPoses } from '../board/layout';
import { useGameStore } from '../state/useGameStore';
import type { Pose } from '../state/types';
import { CardBackMesh } from './CardBack';
import { OPP_DECK_COUNT } from './OpponentField';

/**
 * The opponent's hand (Phase 7 Slice 4). Now driven by real `opponentHand`
 * state: one face-down back per card the opponent holds, fanned across the top
 * of the screen. Each card, when it first enters the hand (opening deal or a
 * later draw), pops off the top of the opponent deck and springs up into its
 * fan slot — a mirror of the player's OpeningDeal. When the opponent summons a
 * card, that id leaves `opponentHand`, its back unmounts, and the fan re-lays
 * out; the summoned card is revealed face-up on the board by OpponentBoard.
 * Cards are held FACE DOWN — the opponent's hand is hidden from the player.
 */

/** The back deck card sits on top of the visible deck stack. */
const DECK_SCALE = 0.72;

/**
 * A single face-down hand back. On mount it starts stacked on the deck and,
 * after a short (index-staggered) beat, springs up to its fan pose — giving the
 * "draw" fly-in for both the opening deal and later single draws. Its own timer
 * is cleared on unmount (summon), so it's StrictMode-safe.
 */
function OppHandBack({ pose, deckTop, delay }: { pose: Pose; deckTop: Pose; delay: number }) {
  const [inHand, setInHand] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setInHand(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <MotionCard
      pose={inHand ? pose : deckTop}
      config={inHand ? SPRING.draw : SPRING.snap}
      scale={inHand ? 1 : DECK_SCALE}
    >
      <CardBackMesh />
    </MotionCard>
  );
}

export function OpponentHand() {
  const opponentHand = useGameStore((s) => s.opponentHand);
  const handPoses = opponentHandPoses(opponentHand.length);
  const deckTop = opponentDeckPose(OPP_DECK_COUNT - 1);

  return (
    <>
      {opponentHand.map((id, i) => (
        <OppHandBack
          key={id}
          pose={handPoses[i]}
          deckTop={deckTop}
          delay={450 + i * OPENING_DEAL_STAGGER_MS}
        />
      ))}
    </>
  );
}
