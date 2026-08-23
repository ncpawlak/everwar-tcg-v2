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
