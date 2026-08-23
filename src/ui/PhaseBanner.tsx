import { useEffect, useState, type CSSProperties } from 'react';
import { useGameStore } from '../state/useGameStore';
import { PHASE_LABEL } from '../state/types';

/**
 * Phase 4 phase-transition banner (DOM overlay). Whenever the phase changes
 * (tracked by `phaseAnnounce`), the phase name slides in from the right, holds
 * briefly over the battlefield, then slides out to the left. Purely cosmetic.
 *
 * The banner element is keyed by `phaseAnnounce` so React remounts it on every
 * phase entry, restarting the CSS animation, then it unmounts once done.
 */

const ANIM_MS = 1700;

export function PhaseBanner() {
  const phase = useGameStore((s) => s.phase);
  const phaseAnnounce = useGameStore((s) => s.phaseAnnounce);
  const [shownKey, setShownKey] = useState(0);

  useEffect(() => {
    if (phaseAnnounce === 0) return;
    setShownKey(phaseAnnounce);
    const t = window.setTimeout(() => setShownKey(0), ANIM_MS);
    return () => window.clearTimeout(t);
  }, [phaseAnnounce]);

  if (shownKey === 0) return null;

  return (
    <div data-ui-overlay style={WRAP_STYLE}>
      <style>{KEYFRAMES}</style>
      <div key={shownKey} style={BANNER_STYLE}>
        <span style={LABEL_STYLE}>{PHASE_LABEL[phase]}</span>
        <span style={SUB_STYLE}>Phase</span>
      </div>
    </div>
  );
}

const KEYFRAMES = `
@keyframes everwar-phase-banner {
  0%   { transform: translateX(70vw); opacity: 0; }
  18%  { transform: translateX(0);    opacity: 1; }
  70%  { transform: translateX(0);    opacity: 1; }
  100% { transform: translateX(-70vw); opacity: 0; }
}`;

const WRAP_STYLE: CSSProperties = {
  position: 'absolute',
  top: '42%',
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'none',
  zIndex: 9,
  overflow: 'hidden',
};

const BANNER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 14,
  padding: '10px 42px',
  background:
    'linear-gradient(90deg, rgba(13,16,21,0) 0%, rgba(13,16,21,0.82) 18%, rgba(13,16,21,0.82) 82%, rgba(13,16,21,0) 100%)',
  borderTop: '1px solid rgba(201, 162, 75, 0.55)',
  borderBottom: '1px solid rgba(201, 162, 75, 0.55)',
  animation: `everwar-phase-banner ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
  whiteSpace: 'nowrap',
};

const LABEL_STYLE: CSSProperties = {
  color: '#ffffff',
  fontSize: 46,
  fontWeight: 800,
  letterSpacing: 3,
  textTransform: 'uppercase',
  textShadow: '0 0 18px rgba(201,162,75,0.6)',
};

const SUB_STYLE: CSSProperties = {
  color: '#c9a24b',
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: 6,
  textTransform: 'uppercase',
};
