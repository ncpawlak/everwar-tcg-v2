import { useEffect, useState } from 'react';
import { MotionCard } from '../animation/MotionCard';
import { SPRING, OPENING_DEAL_STAGGER_MS } from '../animation/motionConfig';
import { opponentDeckPose, opponentHandPoses } from '../board/layout';
import { CardBackMesh } from './CardBack';
import { OPP_DECK_COUNT } from './OpponentField';

/**
 * The opponent's opening draw (Phase 6). Mirrors the player's OpeningDeal: on
 * mount, five face-down backs pop off the top of the opponent deck one at a time
 * and fly up into a fanned hand across the top of the screen. Purely visual —
 * the opponent has no real deck/hand state — so this is a self-contained
 * staggered animation. Each back starts stacked on the deck (board scale,
 * face-down) and, once "dealt", springs to its hand slot (full scale, showing
 * its back to the camera). Guarded so a StrictMode double-mount can't deal past
 * the opening five.
 */

/** How many backs the opponent draws for its opening hand. */
const OPP_HAND_COUNT = 5;
/** The back deck card sits on top of the visible deck stack. */
const DECK_SCALE = 0.72;

export function OpponentHand() {
  const [dealt, setDealt] = useState(0);

  useEffect(() => {
    const timers: number[] = [];
    for (let i = 1; i <= OPP_HAND_COUNT; i++) {
      timers.push(
        window.setTimeout(
          () => setDealt((d) => Math.max(d, i)),
          450 + i * OPENING_DEAL_STAGGER_MS,
        ),
      );
    }
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const handPoses = opponentHandPoses(OPP_HAND_COUNT);
  const deckTop = opponentDeckPose(OPP_DECK_COUNT - 1);

  return (
    <>
      {Array.from({ length: OPP_HAND_COUNT }, (_, i) => {
        const inHand = i < dealt;
        const pose = inHand ? handPoses[i] : deckTop;
        return (
          <MotionCard
            key={`opp-hand-${i}`}
            pose={pose}
            config={inHand ? SPRING.draw : SPRING.snap}
            scale={inHand ? 1 : DECK_SCALE}
          >
            <CardBackMesh />
          </MotionCard>
        );
      })}
    </>
  );
}
