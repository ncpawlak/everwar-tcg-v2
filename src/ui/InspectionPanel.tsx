import { useEffect, useState } from 'react';
import { useGameStore } from '../state/useGameStore';
import type { Card } from '../state/types';
import { RARITY_COLOR, TYPE_ACCENT, TYPE_LABEL } from '../cards/cardTheme';

/**
 * Left-side card inspection panel (Slice 1). A DOM overlay — not rendered in the
 * 3D canvas — so the effect text stays crisp and readable. It shows the card
 * referenced by `selectedCardId`; selection is driven entirely by click input in
 * PointerControls. The panel slides/fades in from the left and retains the last
 * card while sliding out so the exit stays smooth.
 */

export function InspectionPanel() {
  const selectedId = useGameStore((s) => s.selectedCardId);
  const card = useGameStore((s) => (s.selectedCardId ? s.cardsById[s.selectedCardId] : null));

  // Keep showing the last card during the slide-out.
  const [shown, setShown] = useState<Card | null>(null);
  useEffect(() => {
    if (card) setShown(card);
  }, [card]);

  const open = selectedId !== null;
  const accent = shown ? TYPE_ACCENT[shown.type] : '#888';
  const rarityColor = shown ? RARITY_COLOR[shown.rarity] : '#888';

  return (
    <div
      data-ui-overlay
      data-testid="inspection-panel"
      style={{
        position: 'absolute',
        top: '50%',
        left: 24,
        transform: `translateY(-50%) translateX(${open ? '0' : '-120%'})`,
        opacity: open ? 1 : 0,
        transition: 'transform 220ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease',
        pointerEvents: open ? 'auto' : 'none',
        width: 300,
        borderRadius: 14,
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #1a2029 0%, #12161d 100%)',
        border: `1px solid ${accent}`,
        boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03)',
        color: '#e8eaed',
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        userSelect: 'none',
      }}
    >
      {shown && (
        <>
          {/* Card face */}
          <div
            style={{
              position: 'relative',
              height: 230,
              background: `radial-gradient(120% 90% at 50% 0%, ${accent}33 0%, #0e1218 70%)`,
              borderBottom: `2px solid ${accent}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontSize: 128,
                fontWeight: 800,
                color: accent,
                textShadow: '0 4px 18px rgba(0,0,0,0.6)',
                lineHeight: 1,
              }}
            >
              {shown.type}
            </span>
            {/* Cost pip */}
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#0e1218',
                border: `2px solid ${accent}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              {shown.cost}
            </div>
            {/* Rarity badge */}
            <div
              style={{
                position: 'absolute',
                top: 16,
                right: 14,
                fontSize: 11,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                fontWeight: 700,
                color: rarityColor,
              }}
            >
              {shown.rarity}
            </div>
          </div>

          {/* Detail block */}
          <div style={{ padding: '14px 16px 16px' }}>
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 2 }}>{shown.name}</div>
            <div style={{ fontSize: 12, color: accent, fontWeight: 600, marginBottom: 12 }}>
              {TYPE_LABEL[shown.type]} · Type {shown.type}
            </div>

            {/* ATK / DEF */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <Stat label="ATK" value={shown.atk} color="#e0663d" />
              <Stat label="DEF" value={shown.def} color="#3d9be0" />
            </div>

            {/* Effect */}
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 10,
              }}
            >
              {shown.effect}
            </div>

            {/* Flavor */}
            <div style={{ fontSize: 12, fontStyle: 'italic', color: '#97a0ab' }}>
              &ldquo;{shown.flavor}&rdquo;
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 8,
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ fontSize: 11, letterSpacing: 1, color: '#8a929c', fontWeight: 700 }}>
        {label}
      </span>
      <span style={{ fontSize: 20, fontWeight: 800, color }}>{value}</span>
    </div>
  );
}
