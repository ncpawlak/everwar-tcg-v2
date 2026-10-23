import type { CSSProperties } from 'react';
import { useGameStore } from '../state/useGameStore';

/** Opening-hand prompt: keep the 5, or shuffle them back and redraw (once). */
export function MulliganModal() {
  const mulligan = useGameStore((s) => s.mulligan);
  const resolve = useGameStore((s) => s.resolveMulligan);
  if (mulligan !== 'offer') return null;
  return (
    <div data-ui-overlay style={BAR_STYLE}>
      <div style={{ fontWeight: 800, color: '#ffd66b', fontSize: 15 }}>Opening Hand</div>
      <div style={{ fontSize: 12, color: '#aab4c0', margin: '4px 0 10px' }}>
        Keep this hand, or shuffle it into your Deck and draw 5 new cards. You can only mulligan once.
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button type="button" onClick={() => resolve(true)} style={SECONDARY_STYLE}>
          Mulligan
        </button>
        <button type="button" onClick={() => resolve(false)} style={PRIMARY_STYLE}>
          Keep Hand
        </button>
      </div>
    </div>
  );
}

// A bar above the hand rather than a full backdrop, so the hand stays visible.
const BAR_STYLE: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: '34%',
  transform: 'translateX(-50%)',
  width: 380,
  maxWidth: '92vw',
  padding: '14px 18px',
  textAlign: 'center',
  background: 'linear-gradient(180deg, rgba(26,32,41,0.96) 0%, rgba(18,22,29,0.96) 100%)',
  border: '1px solid #4a3d18',
  borderRadius: 14,
  boxShadow: '0 18px 60px rgba(0,0,0,0.6)',
  color: '#e8eaed',
  fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
  userSelect: 'none',
  zIndex: 30,
};

const SECONDARY_STYLE: CSSProperties = {
  padding: '8px 16px',
  color: '#c9d2dc',
  background: 'transparent',
  border: '1px solid #3a4552',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
};

const PRIMARY_STYLE: CSSProperties = {
  padding: '8px 18px',
  color: '#1a1206',
  background: 'linear-gradient(180deg, #ffe08a, #e6b53f)',
  border: '1px solid #b98f2a',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 800,
};
