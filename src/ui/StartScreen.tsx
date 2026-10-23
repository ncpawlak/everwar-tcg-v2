import type { CSSProperties } from 'react';
import { useGameStore } from '../state/useGameStore';
import type { Difficulty } from '../state/types';

const OPTIONS: { id: Difficulty; label: string; blurb: string }[] = [
  { id: 'easy', label: 'Easy', blurb: 'One card of each type per turn. Random attacks. Never mulligans.' },
  {
    id: 'normal',
    label: 'Normal',
    blurb: 'Fills its field, tribute Sets, equips its best Heroes, casts its Ability cards, and goes for kills.',
  },
  {
    id: 'hard',
    label: 'Hard',
    blurb: 'Normal, plus focus fire on high-level Heroes, Weapons that let fresh Heroes attack, sharper trades and mulligans.',
  },
];

/** Start screen: pick the CPU difficulty. The opening deal waits on it. */
export function StartScreen() {
  const difficulty = useGameStore((s) => s.difficulty);
  const choose = useGameStore((s) => s.chooseDifficulty);
  if (difficulty) return null;
  return (
    <div data-ui-overlay style={BACKDROP_STYLE}>
      <div style={PANEL_STYLE}>
        <div style={TITLE_STYLE}>EVERWAR</div>
        <div style={SUB_STYLE}>Choose opponent difficulty</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OPTIONS.map((o) => (
            <button key={o.id} type="button" onClick={() => choose(o.id)} style={OPTION_STYLE}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#ffd66b' }}>{o.label}</span>
              <span style={{ fontSize: 12, color: '#aab4c0', marginTop: 3 }}>{o.blurb}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const BACKDROP_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(4,6,10,0.78)',
  zIndex: 40,
};

const PANEL_STYLE: CSSProperties = {
  width: 440,
  maxWidth: '92vw',
  padding: '26px 24px',
  background: 'linear-gradient(180deg, #1a2029 0%, #12161d 100%)',
  border: '1px solid #4a3d18',
  borderRadius: 16,
  boxShadow: '0 18px 60px rgba(0,0,0,0.6)',
  color: '#e8eaed',
  fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
  userSelect: 'none',
};

const TITLE_STYLE: CSSProperties = {
  textAlign: 'center',
  fontSize: 30,
  fontWeight: 900,
  letterSpacing: 6,
  color: '#ffd66b',
  textShadow: '0 0 18px rgba(255,190,60,0.35)',
};

const SUB_STYLE: CSSProperties = {
  textAlign: 'center',
  fontSize: 13,
  color: '#8b95a3',
  margin: '6px 0 18px',
};

const OPTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  textAlign: 'left',
  padding: '12px 14px',
  background: 'rgba(255,176,32,0.05)',
  border: '1px solid #4a3d18',
  borderRadius: 10,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
