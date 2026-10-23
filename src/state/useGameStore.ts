import { useStore } from 'zustand';
import { createGameStore, type GameStore } from './gameStore';

/**
 * Single shared game store instance for the React app, plus a typed hook.
 * Tests use `createGameStore()` directly for isolation; the app uses this one.
 */
export const gameStore = createGameStore();

export function useGameStore<T>(selector: (state: GameStore) => T): T {
  return useStore(gameStore, selector);
}

/**
 * The whole state, but NOT re-rendering for the per-pointer-move fields (drag
 * point, aim point, hovered hand card). For components that read broadly from
 * state yet don't care where the mouse is — otherwise they'd re-render every
 * mouse move while dragging / aiming / hovering.
 */
export function useColdGameState(): GameStore {
  return useStore(gameStore, coldSnapshot);
}

let lastCold: GameStore | null = null;
function coldSnapshot(s: GameStore): GameStore {
  if (lastCold && !coldChanged(lastCold, s)) return lastCold;
  lastCold = s;
  return s;
}

function coldChanged(a: GameStore, b: GameStore): boolean {
  if (a === b) return false;
  for (const k in b) {
    const key = k as keyof GameStore;
    if (a[key] === b[key] || key === 'aimPoint' || key === 'hoveredCardId') continue;
    if (key === 'dragging' && a.dragging && b.dragging) {
      const { projectedPoint: _p, ...ra } = a.dragging;
      const { projectedPoint: _q, ...rb } = b.dragging;
      if ((Object.keys(rb) as (keyof typeof rb)[]).every((f) => ra[f] === rb[f])) continue;
    }
    return true;
  }
  return false;
}

/** Memoize a derived value per store snapshot, so N per-card selectors running
 *  on the same update compute it once. */
export function perSnapshot<T>(fn: (s: GameStore) => T): (s: GameStore) => T {
  let lastState: GameStore | null = null;
  let lastValue: T;
  return (s) => {
    if (s !== lastState) {
      lastState = s;
      lastValue = fn(s);
    }
    return lastValue;
  };
}
