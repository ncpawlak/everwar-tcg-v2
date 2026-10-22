import { useEffect } from 'react';
import { OPENING_HAND_SIZE } from '../state/cardData';
import { OPENING_DEAL_STAGGER_MS } from '../animation/motionConfig';
import { gameStore } from '../state/useGameStore';

/**
 * Deals the opening hand of 5 on mount, staggered so each card pops off the
 * deck in sequence (FR2). Guarded so React StrictMode double-invocation or
 * remounts can never deal more than the opening hand.
 */
export function OpeningDeal() {
  useEffect(() => {
    const timers: number[] = [];
    for (let i = 0; i < OPENING_HAND_SIZE; i++) {
      timers.push(
        window.setTimeout(() => {
          const s = gameStore.getState();
          if (s.hand.length < OPENING_HAND_SIZE && s.deck.length > 0) s.drawCard();
        }, 450 + i * OPENING_DEAL_STAGGER_MS),
      );
    }
    // After the opening 5 land, start turn 1's Draw phase (draws the 6th, then
    // auto-advances to Main). Guarded on the initial announce so StrictMode's
    // double-mount can't kick off the turn engine twice.
    timers.push(
      window.setTimeout(() => {
        const s = gameStore.getState();
        if (s.phaseAnnounce === 0) s.beginDrawPhase();
      }, 450 + OPENING_HAND_SIZE * OPENING_DEAL_STAGGER_MS + 300),
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return null;
}
