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
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return null;
}
