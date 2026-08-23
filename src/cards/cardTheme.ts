import type { CardType, Rarity } from '../state/types';

/**
 * Shared card visual theme — used by both the 3D card face (CardView) and the
 * DOM inspection panel so a card looks the same up close and on the board.
 * Hex strings work as CSS colors and as three.js material/Text colors.
 */

export const TYPE_ACCENT: Record<CardType, string> = {
  A: '#c0392b', // Vanguard — crimson
  B: '#2e6fb0', // Arcane — azure
  C: '#2f8f6b', // Bulwark — emerald
};

export const TYPE_LABEL: Record<CardType, string> = {
  A: 'Vanguard',
  B: 'Arcane',
  C: 'Bulwark',
};

export const RARITY_COLOR: Record<Rarity, string> = {
  Common: '#9aa4b0',
  Rare: '#3d9be0',
  Epic: '#a35bd6',
  Legendary: '#e0a92e',
};
