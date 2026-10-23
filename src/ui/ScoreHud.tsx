import type { CSSProperties } from 'react';
import { useGameStore } from '../state/useGameStore';
import { WIN_POINTS } from '../state/gameStore';

/**
 * Match score (top-center) plus the Victory / Defeat overlay. Each side's
 * number re-pops when it changes (keyed by value). First to WIN_POINTS wins.
 */
export function ScoreHud() {
  const player = useGameStore((s) => s.points.player);
  const opponent = useGameStore((s) => s.points.opponent);
  const winner = useGameStore((s) => s.winner);
  const started = useGameStore((s) => s.phaseAnnounce > 0);
  if (!started) return null;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div data-ui-overlay style={WRAP_STYLE}>
        <span style={LABEL_STYLE}>You</span>
        <span key={`p${player}`} style={{ ...SCORE_STYLE, color: '#7fd18f' }}>
          {player}
        </span>
        <span style={GOAL_STYLE}>/ {WIN_POINTS}</span>
        <span key={`o${opponent}`} style={{ ...SCORE_STYLE, color: '#e0776a' }}>
          {opponent}
        </span>
        <span style={LABEL_STYLE}>Opp</span>
      </div>
      {winner && (
        <div data-ui-overlay style={OVERLAY_STYLE}>
          <div style={{ ...RESULT_STYLE, color: winner === 'player' ? '#f0d27a' : '#e0776a' }}>
            {winner === 'player' ? 'Victory' : 'Defeat'}
          </div>
          <div style={FINAL_STYLE}>
            {player} – {opponent}
          </div>
          <button type="button" style={AGAIN_STYLE} onClick={() => window.location.reload()}>
            Play Again
          </button>
        </div>
      )}
    </>
  );
}

const KEYFRAMES = `
@keyframes everwar-score-pop {
  0% { transform: scale(1.8); text-shadow: 0 0 18px currentColor; }
  100% { transform: scale(1); text-shadow: none; }
}
@keyframes everwar-result-in {
  0% { opacity: 0; transform: scale(0.6); }
  100% { opacity: 1; transform: scale(1); }
}`;

const WRAP_STYLE: CSSProperties = {
  position: 'absolute',
  top: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 18px',
  borderRadius: 999,
  background: 'rgba(10, 13, 18, 0.72)',
  border: '1px solid rgba(201, 162, 75, 0.4)',
  boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
  zIndex: 10,
  pointerEvents: 'none',
};

const LABEL_STYLE: CSSProperties = {
  color: '#c9a24b',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: 'uppercase',
};

const SCORE_STYLE: CSSProperties = {
  display: 'inline-block',
  minWidth: 22,
  textAlign: 'center',
  fontSize: 22,
  fontWeight: 800,
  animation: 'everwar-score-pop 500ms ease-out',
};

const GOAL_STYLE: CSSProperties = {
  color: 'rgba(180, 186, 196, 0.5)',
  fontSize: 12,
};

const OVERLAY_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  background: 'rgba(5, 8, 12, 0.72)',
  zIndex: 50,
  animation: 'everwar-result-in 600ms cubic-bezier(0.22, 1, 0.36, 1) both',
};

const RESULT_STYLE: CSSProperties = {
  fontSize: 72,
  fontWeight: 900,
  letterSpacing: 6,
  textTransform: 'uppercase',
  textShadow: '0 0 30px currentColor',
};

const FINAL_STYLE: CSSProperties = {
  color: '#d6dbe2',
  fontSize: 22,
  fontWeight: 700,
};

const AGAIN_STYLE: CSSProperties = {
  marginTop: 8,
  padding: '10px 22px',
  fontSize: 14,
  fontWeight: 700,
  color: '#0d1015',
  background: 'linear-gradient(180deg, #e7c874 0%, #c9a24b 100%)',
  border: '1px solid #f0dca0',
  borderRadius: 999,
  cursor: 'pointer',
};
