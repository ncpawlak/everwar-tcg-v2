import type { CSSProperties } from 'react';
import { useGameStore } from '../state/useGameStore';
import { TYPE_ACCENT } from '../cards/cardTheme';

/**
 * Slot-selection prompt for the second half of a level-3+ tribute summon. After
 * the materials are consumed in {@link TributeModal}, `pendingSummon` is set and
 * the open A slots light gold on the board; this thin banner tells the player to
 * click one. Non-interactive (it never blocks board clicks) so the player can
 * pick a slot underneath it — hence NOT marked `data-ui-overlay`.
 */
export function SummonSlotPrompt() {
  const pending = useGameStore((s) => s.pendingSummon);
  const cardsById = useGameStore((s) => s.cardsById);
  if (!pending) return null;
  const card = cardsById[pending.cardId];
  if (!card) return null;

  return (
    <div style={WRAP_STYLE}>
      <div style={BANNER_STYLE}>
        <span style={{ color: '#ffd75e', fontWeight: 800 }}>Select an open slot</span>
        <span style={{ color: '#8b95a3' }}> to summon </span>
        <span style={{ color: TYPE_ACCENT.A, fontWeight: 700 }}>{card.name}</span>
      </div>
    </div>
  );
}

const WRAP_STYLE: CSSProperties = {
  position: 'absolute',
  top: 74,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'none',
  zIndex: 24,
};

const BANNER_STYLE: CSSProperties = {
  padding: '8px 18px',
  background: 'linear-gradient(180deg, rgba(26,32,41,0.95), rgba(18,22,29,0.95))',
  border: '1px solid #4a3d18',
  borderRadius: 10,
  boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
  color: '#e8eaed',
  fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
  fontSize: 14,
  letterSpacing: 0.3,
  userSelect: 'none',
};
