import { useEffect, type CSSProperties } from 'react';
import { useGameStore } from '../state/useGameStore';
import { counterAbility } from '../abilities/counters';

/**
 * Yes/no prompt shown when a Hero's counters reach an optional threshold
 * (Devil Dog Reinforcement: "When this Hero has 3 counters, you can…"). Opens
 * while `counterPrompt` is set; the End-phase hand-off waits on the answer.
 * Declining keeps the Hero and its counters.
 */
export function CounterPromptModal() {
  const prompt = useGameStore((s) => s.counterPrompt);
  const cardsById = useGameStore((s) => s.cardsById);
  const counters = useGameStore((s) => s.counters);
  const resolve = useGameStore((s) => s.resolveCounterPrompt);

  useEffect(() => {
    if (!prompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolve(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prompt, resolve]);

  if (!prompt) return null;
  const card = cardsById[prompt.cardId];
  const ca = counterAbility(card);
  if (!card || !ca) return null;
  const colon = ca.ir.raw.indexOf(':');
  const body = colon > 0 ? ca.ir.raw.slice(colon + 1).trim() : ca.ir.raw;

  return (
    <div data-ui-overlay style={BACKDROP_STYLE}>
      <div style={PANEL_STYLE} onClick={(e) => e.stopPropagation()}>
        <div style={HEADER_STYLE}>
          <span style={{ fontWeight: 700, letterSpacing: 0.4 }}>
            <span style={{ color: '#ffb020' }}>{prompt.abilityName}</span>
            <span style={{ color: '#8b95a3', fontWeight: 500 }}> · {counters[prompt.cardId] ?? 0} Counters</span>
          </span>
        </div>
        <div style={BODY_STYLE}>
          <div style={{ marginBottom: 6, color: '#c9d2dc', fontWeight: 800 }}>{card.name}</div>
          <div style={ABILITY_STYLE}>{body}</div>
        </div>
        <div style={FOOTER_STYLE}>
          <button type="button" onClick={() => resolve(false)} style={DECLINE_STYLE}>
            Decline
          </button>
          <button type="button" onClick={() => resolve(true)} style={USE_STYLE}>
            Use Ability
          </button>
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
  background: 'rgba(4,6,10,0.55)',
  zIndex: 25,
};

const PANEL_STYLE: CSSProperties = {
  width: 420,
  maxWidth: '92vw',
  background: 'linear-gradient(180deg, #1a2029 0%, #12161d 100%)',
  border: '1px solid #4a3d18',
  borderRadius: 14,
  boxShadow: '0 18px 60px rgba(0,0,0,0.6)',
  color: '#e8eaed',
  fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
  userSelect: 'none',
  overflow: 'hidden',
};

const HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid #2a333f',
  fontSize: 15,
};

const BODY_STYLE: CSSProperties = {
  padding: '14px 16px',
  fontSize: 13,
};

const ABILITY_STYLE: CSSProperties = {
  padding: '10px 12px',
  background: 'rgba(255,176,32,0.06)',
  border: '1px solid #4a3d18',
  borderRadius: 8,
  color: '#c9d2dc',
  lineHeight: 1.4,
};

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  padding: '12px 16px',
  borderTop: '1px solid #2a333f',
};

const DECLINE_STYLE: CSSProperties = {
  padding: '8px 16px',
  color: '#c9d2dc',
  background: 'transparent',
  border: '1px solid #3a4552',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
};

const USE_STYLE: CSSProperties = {
  padding: '8px 18px',
  color: '#1a1206',
  background: 'linear-gradient(180deg, #ffe08a, #e6b53f)',
  border: '1px solid #b98f2a',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 800,
};
