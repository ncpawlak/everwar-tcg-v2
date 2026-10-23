import { useEffect } from 'react';
import { OPENING_HAND_SIZE } from '../state/cardData';
import { OPENING_DEAL_STAGGER_MS } from '../animation/motionConfig';
import { gameStore, useGameStore } from '../state/useGameStore';

/**
 * Deals the opening hand of 5 once a difficulty is picked, staggered so each
 * card pops off the deck in sequence (FR2), then opens the Keep/Mulligan
 * prompt. Guarded so React StrictMode double-invocation or remounts can never
 * deal more than the opening hand.
 */
export function OpeningDeal() {
  const ready = useGameStore((s) => s.difficulty !== null);
  useEffect(() => {
    if (!ready) return;
    const timers: number[] = [];
    for (let i = 0; i < OPENING_HAND_SIZE; i++) {
      timers.push(
        window.setTimeout(() => {
          const s = gameStore.getState();
          if (s.hand.length < OPENING_HAND_SIZE && s.deck.length > 0) s.drawCard();
        }, 450 + i * OPENING_DEAL_STAGGER_MS),
      );
    }
    // After the opening 5 land, offer the mulligan; resolving it starts turn
    // 1's Draw phase. The store guards it to once per game.
    timers.push(
      window.setTimeout(() => gameStore.getState().offerMulligan(), 450 + OPENING_HAND_SIZE * OPENING_DEAL_STAGGER_MS + 300),
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, [ready]);

  return null;
}
