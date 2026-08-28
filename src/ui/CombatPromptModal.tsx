import { useEffect, type CSSProperties } from 'react';
import { useGameStore } from '../state/useGameStore';

/**
 * Mid-Resolution yes/no prompt for Snow Viper's Bunker Busting Round (Phase 8).
 * Opens when `combatPrompt` is set — the attacker landed a Successful Hit on a
 * Hero that still has ≥1 Armor Bar and the ability is unused this turn. Resolution
 * is PAUSED while this shows: "Break Armor Bars" wipes every bar and inflicts no
 * damage; "Deal Damage" applies normal armor math. Either choice resumes combat.
 * Declining via backdrop/Escape is treated as "Deal Damage". Marked
 * `data-ui-overlay` so PointerControls ignores clicks on it.
 */
export function CombatPromptModal() {
  const prompt = useGameStore((s) => s.combatPrompt);
  const opponentCards = useGameStore((s) => s.opponentCards);
  const currentArmorBars = useGameStore((s) => s.currentArmorBars);
  const resolve = useGameStore((s) => s.resolveCombatPrompt);

  useEffect(() => {
    if (!prompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolve(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prompt, resolve]);

  if (!prompt) return null;
  const target = opponentCards[prompt.targetCardId];
  const bars = currentArmorBars[prompt.targetCardId] ?? target?.armorBars ?? 0;

  return (
    <div data-ui-overlay style={BACKDROP_STYLE} onClick={() => resolve(false)}>
      <div style={PANEL_STYLE} onClick={(e) => e.stopPropagation()}>
        <div style={HEADER_STYLE}>
          <span style={{ fontWeight: 700, letterSpacing: 0.4 }}>
            <span style={{ color: '#ffb020' }}>{prompt.abilityName}</span>
            <span style={{ color: '#8b95a3', fontWeight: 500 }}> · Combat Trigger</span>
          </span>
        </div>

        <div style={BODY_STYLE}>
          <div style={{ marginBottom: 8, color: '#c9d2dc' }}>
            Successful hit on <span style={{ fontWeight: 800 }}>{target?.name ?? 'the target'}</span>
            <span style={{ fontSize: 11, color: '#8b95a3' }}> · {bars} Armor Bar{bars === 1 ? '' : 's'}</span>
          </div>
          <div style={ABILITY_STYLE}>
            Break all Armor Bars on the target Hero? If you do, no damage is inflicted this hit.
          </div>
        </div>

        <div style={FOOTER_STYLE}>
          <button type="button" onClick={() => resolve(false)} style={DECLINE_STYLE}>
            Deal Damage
          </button>
          <button type="button" onClick={() => resolve(true)} style={USE_STYLE}>
            Break Armor Bars
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
  width: 440,
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
