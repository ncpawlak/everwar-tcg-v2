import type { CSSProperties } from 'react';
import { useGameStore } from '../state/useGameStore';
import { PHASE_ORDER, PHASE_LABEL } from '../state/types';

/**
 * Phase 4 turn HUD (DOM overlay). Sits under the hand at the bottom of the
 * screen: a progressive phase indicator (current phase white, others greyed)
 * with the turn number, plus a "Next Phase" button on the field to advance.
 * Marked `data-ui-overlay` so PointerControls ignores clicks here.
 *
 * The Draw phase auto-advances to Main, so the button is disabled during Draw.
 */
export function TurnHud() {
  const turn = useGameStore((s) => s.turn);
  const phase = useGameStore((s) => s.phase);
  const phaseAnnounce = useGameStore((s) => s.phaseAnnounce);
  const activePlayer = useGameStore((s) => s.activePlayer);
  const advancePhase = useGameStore((s) => s.advancePhase);

  // Hide until the first turn has actually begun (opening deal still running).
  if (phaseAnnounce === 0) return null;

  const opponentTurn = activePlayer === 'opponent';
  // The button is inert during auto-advancing phases (Draw, Resolution, End)
  // and the whole opponent turn — only Main and Battle need a manual click.
  const autoAdvance =
    opponentTurn || phase === 'draw' || phase === 'resolution' || phase === 'end';

  return (
    <div data-ui-overlay style={WRAP_STYLE}>
      <div style={INDICATOR_STYLE}>
        <span style={TURN_STYLE}>Turn {turn}</span>
        <span style={DIVIDER_STYLE} />
        {PHASE_ORDER.map((p, i) => {
          const active = p === phase;
          // No attacks on turn 1: Battle and Resolution are skipped.
          const skipped = turn === 1 && (p === 'battle' || p === 'resolution');
          return (
            <span key={p} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <span style={ARROW_STYLE}>›</span>}
              <span
                style={active ? PHASE_ACTIVE_STYLE : skipped ? PHASE_SKIPPED_STYLE : PHASE_DIM_STYLE}
                title={skipped ? 'No attacks on the first turn' : undefined}
              >
                {PHASE_LABEL[p]}
              </span>
            </span>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => advancePhase()}
        disabled={autoAdvance}
        style={{ ...NEXT_BUTTON_STYLE, ...(autoAdvance ? NEXT_DISABLED_STYLE : null) }}
      >
        {opponentTurn ? 'Opponent…' : phase === 'end' ? 'Ending…' : 'Next Phase ▸'}
      </button>
    </div>
  );
}

const WRAP_STYLE: CSSProperties = {
  position: 'absolute',
  bottom: 14,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  zIndex: 10,
  pointerEvents: 'none',
};

const INDICATOR_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  borderRadius: 999,
  background: 'rgba(10, 13, 18, 0.72)',
  border: '1px solid rgba(201, 162, 75, 0.4)',
  boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
  fontSize: 14,
  letterSpacing: 0.4,
};

const TURN_STYLE: CSSProperties = {
  color: '#c9a24b',
  fontWeight: 700,
  textTransform: 'uppercase',
  fontSize: 12,
};

const DIVIDER_STYLE: CSSProperties = {
  width: 1,
  height: 16,
  background: 'rgba(201, 162, 75, 0.4)',
};

const PHASE_ACTIVE_STYLE: CSSProperties = {
  color: '#ffffff',
  fontWeight: 700,
  textShadow: '0 0 8px rgba(255,255,255,0.5)',
};

const PHASE_DIM_STYLE: CSSProperties = {
  color: 'rgba(180, 186, 196, 0.4)',
  fontWeight: 500,
};

const PHASE_SKIPPED_STYLE: CSSProperties = {
  color: 'rgba(180, 186, 196, 0.2)',
  fontWeight: 500,
  textDecoration: 'line-through',
};

const ARROW_STYLE: CSSProperties = {
  color: 'rgba(180, 186, 196, 0.35)',
  margin: '0 6px',
};

const NEXT_BUTTON_STYLE: CSSProperties = {
  pointerEvents: 'auto',
  padding: '9px 18px',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.4,
  color: '#0d1015',
  background: 'linear-gradient(180deg, #e7c874 0%, #c9a24b 100%)',
  border: '1px solid #f0dca0',
  borderRadius: 999,
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
};

const NEXT_DISABLED_STYLE: CSSProperties = {
  opacity: 0.4,
  cursor: 'default',
  filter: 'grayscale(0.6)',
};
