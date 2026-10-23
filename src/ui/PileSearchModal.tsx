import type { CSSProperties } from 'react';
import { useGameStore } from '../state/useGameStore';
import type { Card, PileSource } from '../state/types';
import { abilityLabel, equipmentLabel } from '../state/abilities';
import { pileActivatedAbilityFor } from '../abilities/pile';
import { RARITY_COLOR, TYPE_ACCENT, TYPE_LABEL } from '../cards/cardTheme';

/**
 * Reusable pile-search pop-up (Phase 3). A DOM overlay modal that lists every
 * card in a pile (deck / graveyard / replen) as a compact grid — 6 tiles wide,
 * ~2 rows tall, scrolling for the rest. View-only for now. Marked
 * `data-ui-overlay` so PointerControls ignores clicks and they never reach the
 * game board. Closes on the backdrop, the ✕, or Escape (handled by the caller).
 */

export type { PileSource };

const PILE_TITLE: Record<PileSource, string> = {
  deck: 'Deck',
  graveyard: 'Graveyard',
  replen: 'Replenish',
  opponentGraveyard: "Opponent's Graveyard",
  opponentReplen: "Opponent's Replenish",
};

interface Props {
  source: PileSource;
  onClose: () => void;
}

export function PileSearchModal({ source, onClose }: Props) {
  const pile = useGameStore((s) => s[source]);
  const cardsById = useGameStore((s) => s.cardsById);
  const opponentCards = useGameStore((s) => s.opponentCards);
  const selectCard = useGameStore((s) => s.selectCard);
  const activatePileAbility = useGameStore((s) => s.activatePileAbility);
  const activePlayer = useGameStore((s) => s.activePlayer);
  const phase = useGameStore((s) => s.phase);

  // Only the player's own Graveyard / Replen support in-pile activation, and only
  // during the player's Main phase.
  const pileKind = source === 'graveyard' ? 'graveyard' : source === 'replen' ? 'replen' : null;
  const canActivate = pileKind !== null && activePlayer === 'player' && phase === 'main';

  return (
    <div
      data-ui-overlay
      onClick={onClose}
      style={BACKDROP_STYLE}
    >
      <div style={PANEL_STYLE} onClick={(e) => e.stopPropagation()}>
        <div style={HEADER_STYLE}>
          <span style={{ fontWeight: 700, letterSpacing: 0.4 }}>
            {PILE_TITLE[source]}
            <span style={{ color: '#8b95a3', fontWeight: 500 }}> · {pile.length}</span>
          </span>
          <button type="button" onClick={onClose} style={CLOSE_STYLE} aria-label="Close">
            ✕
          </button>
        </div>

        {pile.length === 0 ? (
          <div style={EMPTY_STYLE}>This pile is empty.</div>
        ) : (
          <div style={GRID_SCROLL_STYLE}>
            <div style={GRID_STYLE}>
              {pile.map((id) => {
                const card = cardsById[id] ?? opponentCards[id];
                const activatable =
                  canActivate && pileKind !== null && Boolean(card && pileActivatedAbilityFor(card, pileKind));
                return (
                  <CardTile
                    key={id}
                    card={card}
                    activatable={activatable}
                    onSelect={() => selectCard(id)}
                    onActivate={() => activatePileAbility(id)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CardTile({
  card,
  activatable,
  onSelect,
  onActivate,
}: {
  card: Card | undefined;
  activatable: boolean;
  onSelect: () => void;
  onActivate: () => void;
}) {
  if (!card) return null;
  const accent = TYPE_ACCENT[card.type];
  const rarity = RARITY_COLOR[card.rarity];
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onSelect}
        style={{
          ...TILE_STYLE,
          border: `1px solid ${activatable ? '#ffb020' : rarity}`,
          boxShadow: activatable ? '0 0 12px rgba(255,176,32,0.6)' : 'none',
        }}
        title={`${card.name} — ${TYPE_LABEL[card.type]}`}
      >
        <div style={{ ...TILE_HEADER_STYLE, background: `linear-gradient(180deg, ${accent}cc, ${accent}77)` }}>
          <span style={{ fontWeight: 800 }}>{card.type}</span>
          <span style={TILE_COST_STYLE}>{card.cost}</span>
        </div>
        <div style={TILE_NAME_STYLE}>{card.name}</div>
        <div style={TILE_FOOT_STYLE}>{tileFoot(card)}</div>
      </button>
      {activatable && (
        <button
          type="button"
          onClick={onActivate}
          style={ACTIVATE_STYLE}
          title="Activate this card's in-pile ability"
        >
          ⚡ Activate
        </button>
      )}
    </div>
  );
}

/** Compact per-type footer for a pile tile: A = DMG/ACC, B = ability, C = boost. */
function tileFoot(card: Card) {
  if (card.type === 'A') {
    return (
      <>
        <span style={{ color: '#e07a5f' }}>{card.dmg}</span>
        <span style={{ color: '#6aa9e0' }}>{card.acc}</span>
      </>
    );
  }
  if (card.type === 'B') {
    return (
      <span style={{ color: '#b6a0e8', fontSize: 10, fontWeight: 700 }}>
        {card.ability ? abilityLabel(card.ability) : 'Ability'}
      </span>
    );
  }
  return (
    <span style={{ color: '#8fa39a', fontSize: 10, fontWeight: 700 }}>{equipmentLabel(card)}</span>
  );
}

const BACKDROP_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(4,6,10,0.45)',
  zIndex: 20,
};

const PANEL_STYLE: CSSProperties = {
  width: 588,
  maxWidth: '92vw',
  background: 'linear-gradient(180deg, #1a2029 0%, #12161d 100%)',
  border: '1px solid #35404e',
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

const CLOSE_STYLE: CSSProperties = {
  width: 26,
  height: 26,
  lineHeight: '24px',
  textAlign: 'center',
  padding: 0,
  color: '#c9d2dc',
  background: 'transparent',
  border: '1px solid #3a4552',
  borderRadius: 6,
  cursor: 'pointer',
};

const EMPTY_STYLE: CSSProperties = {
  padding: '48px 16px',
  textAlign: 'center',
  color: '#7c8594',
  fontSize: 14,
};

const GRID_SCROLL_STYLE: CSSProperties = {
  maxHeight: 288,
  overflowY: 'auto',
  padding: 14,
};

const GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 1fr)',
  gap: 10,
};

const TILE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 8,
  overflow: 'hidden',
  background: '#0e1218',
  aspectRatio: '5 / 7',
  padding: 0,
  margin: 0,
  cursor: 'pointer',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
};

const TILE_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '3px 6px',
  fontSize: 13,
  color: '#f5e6c8',
};

const TILE_COST_STYLE: CSSProperties = {
  minWidth: 16,
  height: 16,
  lineHeight: '16px',
  textAlign: 'center',
  fontSize: 11,
  fontWeight: 700,
  borderRadius: 8,
  background: 'rgba(0,0,0,0.35)',
};

const TILE_NAME_STYLE: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '4px 4px',
  fontSize: 10.5,
  lineHeight: 1.15,
  color: '#dfe4ea',
};

const TILE_FOOT_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '3px 6px',
  fontSize: 11,
  fontWeight: 700,
  borderTop: '1px solid #1e2530',
};

const ACTIVATE_STYLE: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: -10,
  transform: 'translateX(-50%)',
  padding: '3px 8px',
  fontSize: 10,
  fontWeight: 800,
  whiteSpace: 'nowrap',
  color: '#1a1206',
  background: 'linear-gradient(180deg, #ffe08a, #e6b53f)',
  border: '1px solid #b98f2a',
  borderRadius: 7,
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
  zIndex: 1,
};
