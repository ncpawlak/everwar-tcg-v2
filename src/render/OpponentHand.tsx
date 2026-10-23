import { useEffect, useRef, useState } from 'react';
import { MotionCard } from '../animation/MotionCard';
import { SPRING, OPENING_DEAL_STAGGER_MS, MULTI_DRAW_STAGGER_MS } from '../animation/motionConfig';
import { opponentDeckPose, opponentHandPoses } from '../board/layout';
import { useGameStore } from '../state/useGameStore';
import type { Pose } from '../state/types';
import { CardBackMesh } from './CardBack';

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
  const deckCount = useGameStore((s) => s.opponentDeck.length);
  const handPoses = opponentHandPoses(opponentHand.length);
  // Draw fly-in starts from the current top of the (shrinking) opponent deck.
  const deckTop = opponentDeckPose(Math.max(0, deckCount - 1));

  // Each back's fly-in delay is fixed the first time its id is seen. The
  // opening deal staggers by hand position; later arrivals (draws, searches)
  // stagger only among the cards that arrived together, so a card added to a
  // full hand still leaves the deck right away instead of after a long wait.
  const delays = useRef(new Map<string, number>());
  const known = delays.current;
  const opening = known.size === 0;
  let fresh = 0;
  for (const [i, id] of opponentHand.entries()) {
    if (known.has(id)) continue;
    known.set(id, opening ? 450 + i * OPENING_DEAL_STAGGER_MS : 60 + fresh++ * MULTI_DRAW_STAGGER_MS);
  }
  for (const id of [...known.keys()]) if (!opponentHand.includes(id)) known.delete(id);

  return (
    <>
      {opponentHand.map((id, i) => (
        <OppHandBack
          key={id}
          pose={handPoses[i]}
          deckTop={deckTop}
          delay={known.get(id) ?? 0}
        />
      ))}
    </>
  );
}
