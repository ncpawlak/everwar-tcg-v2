import { useEffect, useState, type CSSProperties } from 'react';
import { useGameStore } from '../state/useGameStore';
import { parseAbility } from '../abilities/parseAbility';
import { abilityValidTargets } from '../abilities/activated';
import { RARITY_COLOR, TYPE_ACCENT, TYPE_LABEL } from '../cards/cardTheme';
import type { Card, CardId } from '../state/types';

/**
 * Two-step resolver for activated abilities that need player selection (e.g.
 * Quick Reload, Fire Support). Opens when `abilityTargeting` is set.
 *
 *  - `cost` step: pick a Hand card to send to Replen (the ability's cost).
 *  - `target` step: pick an ally Hero to receive the buff.
 *
 * Each step is select-then-confirm: click a card to inspect it (name, stats and
 * full ability text) so the player can read effects that trigger on the move,
 * then Confirm. The cost is only spent when the target is confirmed, so Cancel /
 * backdrop / Escape at either step aborts cleanly. Marked `data-ui-overlay` so
 * PointerControls ignores clicks on it.
 */
export function AbilityTargetModal() {
  const at = useGameStore((s) => s.abilityTargeting);
  const cardsById = useGameStore((s) => s.cardsById);
  const board = useGameStore((s) => s.board);
  const hand = useGameStore((s) => s.hand);
  const chooseAbilityCost = useGameStore((s) => s.chooseAbilityCost);
  const chooseAbilityTarget = useGameStore((s) => s.chooseAbilityTarget);
  const cancel = useGameStore((s) => s.cancelAbilityTargeting);

  const [selected, setSelected] = useState<CardId | null>(null);

  // Reset the pick whenever the step (or the whole flow) changes.
  const step = at?.step ?? null;
  useEffect(() => {
    setSelected(null);
  }, [step, at?.sourceCardId]);

  useEffect(() => {
    if (!at) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [at, cancel]);

  if (!at) return null;
  const source = cardsById[at.sourceCardId];
  if (!source || !source.abilities) return null;
  const ir = parseAbility(source.abilities[at.abilityIndex]);

  const allyBoard: Card[] = Object.values(board)
    .filter((id): id is CardId => id !== null)
    .map((id) => cardsById[id])
    .filter((c): c is Card => Boolean(c));

  const isCost = at.step === 'cost';
  const title = at.abilityName;
  const subtitle = isCost
    ? 'Click a Hand card to inspect it, then Confirm to send it to the Replen pile.'
    : 'Click a Hero you control to inspect it, then Confirm to apply the buff.';

  const tiles: Card[] = isCost
    ? hand.map((id) => cardsById[id]).filter((c): c is Card => Boolean(c))
    : abilityValidTargets(ir, allyBoard, at.sourceCardId);

  const selectedCard = selected ? cardsById[selected] ?? null : null;
  const confirm = () => {
    if (!selected) return;
    if (isCost) chooseAbilityCost(selected);
    else chooseAbilityTarget(selected);
  };

  return (
    <div data-ui-overlay style={BACKDROP_STYLE} onClick={() => cancel()}>
      <div style={PANEL_STYLE} onClick={(e) => e.stopPropagation()}>
        <div style={HEADER_STYLE}>
          <span style={{ fontWeight: 700, letterSpacing: 0.4 }}>
            <span style={{ color: '#ffb020' }}>{title}</span>
            <span style={{ color: '#8b95a3', fontWeight: 500 }}> · {isCost ? 'Cost' : 'Target'}</span>
          </span>
          <span style={STEP_STYLE}>{isCost ? 'Step 1 / 2' : 'Step 2 / 2'}</span>
        </div>

        <div style={SUBTITLE_STYLE}>{subtitle}</div>

        {tiles.length === 0 ? (
          <div style={EMPTY_STYLE}>
            {isCost ? 'No cards in Hand.' : 'No legal targets on your board.'}
          </div>
        ) : (
          <div style={GRID_SCROLL_STYLE}>
            <div style={GRID_STYLE}>
              {tiles.map((c) => {
                const accent = TYPE_ACCENT[c.type];
                const on = selected === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelected(c.id)}
                    style={{
                      ...TILE_STYLE,
                      border: `2px solid ${on ? '#ffcf3f' : RARITY_COLOR[c.rarity]}`,
                      boxShadow: on ? '0 0 12px rgba(255,207,63,0.55)' : 'none',
                    }}
                    title={c.name}
                  >
                    <div
                      style={{
                        ...TILE_HEADER_STYLE,
                        background: `linear-gradient(180deg, ${accent}cc, ${accent}77)`,
                      }}
                    >
                      <span style={{ fontWeight: 800 }}>{c.type}</span>
                      {c.level != null && <span style={TILE_LEVEL_STYLE}>Lv {c.level}</span>}
                    </div>
                    <div style={TILE_NAME_STYLE}>{c.name}</div>
                    {c.type === 'A' && (
                      <div style={TILE_FOOT_STYLE}>
                        <span style={{ color: '#e07a5f' }}>{c.dmg}</span>
                        <span style={{ color: '#6aa9e0' }}>{c.acc}</span>
                      </div>
                    )}
                    {on && <div style={CHECK_STYLE}>✓</div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedCard && <CardDetail card={selectedCard} />}

        <div style={FOOTER_STYLE}>
          <button type="button" onClick={() => cancel()} style={CANCEL_STYLE}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={confirm}
            style={{
              ...CONFIRM_STYLE,
              opacity: selected ? 1 : 0.4,
              cursor: selected ? 'pointer' : 'not-allowed',
            }}
          >
            {isCost ? 'Send to Replen' : 'Apply Buff'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Inline detail of the currently-selected card so the player can read its stats
 *  and full ability text before committing. */
function CardDetail({ card }: { card: Card }) {
  const accent = TYPE_ACCENT[card.type];
  return (
    <div style={DETAIL_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 800, color: accent }}>{card.name}</span>
        <span style={{ fontSize: 11, color: '#8b95a3' }}>
          {TYPE_LABEL[card.type]}
          {card.subType ? ` · ${card.subType}` : ''}
          {card.level != null ? ` · Lv ${card.level}` : ''}
        </span>
      </div>
      {card.type === 'A' && card.abilities && card.abilities.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {card.abilities.map((text, i) => {
            const colon = text.indexOf(':');
            const name = colon > 0 ? text.slice(0, colon) : `Ability ${i + 1}`;
            const body = colon > 0 ? text.slice(colon + 1).trim() : text;
            return (
              <div key={i} style={DETAIL_ABILITY_STYLE}>
                <span style={{ fontWeight: 700, color: '#c9d2dc' }}>{name}: </span>
                <span style={{ color: '#9aa0a8' }}>{body}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#9aa0a8' }}>
          {card.effect ? card.effect : 'No ability text.'}
        </div>
      )}
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
  width: 560,
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

const STEP_STYLE: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: 0.5,
  color: '#c9d2dc',
};

const SUBTITLE_STYLE: CSSProperties = {
  padding: '8px 16px 0',
  fontSize: 12.5,
  color: '#8b95a3',
};

const EMPTY_STYLE: CSSProperties = {
  padding: '40px 16px',
  textAlign: 'center',
  color: '#7c8594',
  fontSize: 14,
};

const GRID_SCROLL_STYLE: CSSProperties = {
  maxHeight: 300,
  overflowY: 'auto',
  padding: 14,
};

const GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 12,
};

const TILE_STYLE: CSSProperties = {
  position: 'relative',
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

const TILE_LEVEL_STYLE: CSSProperties = {
  padding: '1px 6px',
  fontSize: 11,
  fontWeight: 800,
  borderRadius: 8,
  background: 'rgba(0,0,0,0.4)',
  color: '#ffdf87',
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

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  padding: '12px 16px',
  borderTop: '1px solid #2a333f',
};

const CHECK_STYLE: CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 4,
  width: 20,
  height: 20,
  lineHeight: '20px',
  textAlign: 'center',
  borderRadius: '50%',
  background: '#ffcf3f',
  color: '#1a1206',
  fontWeight: 900,
  fontSize: 13,
};

const DETAIL_STYLE: CSSProperties = {
  margin: '0 16px 4px',
  padding: '10px 12px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid #2a333f',
  borderRadius: 8,
  fontSize: 12.5,
};

const DETAIL_ABILITY_STYLE: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.4,
};

const CANCEL_STYLE: CSSProperties = {
  padding: '8px 16px',
  color: '#c9d2dc',
  background: 'transparent',
  border: '1px solid #3a4552',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
};

const CONFIRM_STYLE: CSSProperties = {
  padding: '8px 18px',
  color: '#1a1206',
  background: 'linear-gradient(180deg, #ffe08a, #e6b53f)',
  border: '1px solid #b98f2a',
  borderRadius: 8,
  fontWeight: 800,
};
