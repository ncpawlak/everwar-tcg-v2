import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useGameStore } from '../state/useGameStore';
import { boardMaterials, setPermissions, tributeSetKind } from '../board/slotRules';
import { RARITY_COLOR, TYPE_ACCENT } from '../cards/cardTheme';
import type { SlotId } from '../state/types';

/**
 * Level-3+ set-material picker (Replen Set / Commit Set). Opens when
 * `pendingTribute` is set (the player dropped a level-3+ Hero onto a legal
 * column). Lists the Heroes currently on the player's board as selectable tiles
 * — reusing the pile-search modal's look — with a running "sum / needed" level
 * counter. Confirm is enabled only when the selected materials' levels sum
 * EXACTLY to the pending Hero's level. Confirming sends the materials (and their
 * linked C-cards) to the replen pile (Replen Set) or the graveyard (Commit Set,
 * for Commander Heroes) and sets the card. Up to 1 of the selected materials'
 * Equipment may be kept; it moves onto the new Hero once its slot is picked. Cancel / backdrop / Escape aborts and
 * leaves the card in hand.
 *
 * Marked `data-ui-overlay` so PointerControls ignores clicks on it.
 */
export function TributeModal() {
  const pending = useGameStore((s) => s.pendingTribute);
  const board = useGameStore((s) => s.board);
  const cardsById = useGameStore((s) => s.cardsById);
  const confirmTributeSummon = useGameStore((s) => s.confirmTributeSummon);
  const cancelTributeSummon = useGameStore((s) => s.cancelTributeSummon);

  const [selected, setSelected] = useState<SlotId[]>([]);
  // C slot of the one material Equipment to keep on the new Hero (optional).
  const [keepSlot, setKeepSlot] = useState<SlotId | null>(null);

  // Reset the selection whenever a new tribute prompt opens.
  const pendingCardId = pending?.cardId ?? null;
  useEffect(() => {
    setSelected([]);
    setKeepSlot(null);
  }, [pendingCardId]);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelTributeSummon();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, cancelTributeSummon]);

  const materials = useMemo(
    () => (pending ? boardMaterials(board, cardsById) : []),
    [pending, board, cardsById],
  );

  if (!pending) return null;
  const card = cardsById[pending.cardId];
  if (!card) return null;
  const need = card.level ?? 0;
  // Commander Heroes Commit Set (materials → graveyard); other level-3+ Heroes
  // Replen Set (materials → replen pile).
  const setMethod = card.commander ? 'Commit Set' : 'Replen Set';
  const destination = card.commander ? 'graveyard' : 'replen pile';

  const sum = selected.reduce((acc, slot) => {
    const id = board[slot];
    return acc + (id ? (cardsById[id]?.level ?? 1) : 0);
  }, 0);
  const selectedCards = selected.flatMap((slot) => {
    const id = board[slot];
    const c = id ? cardsById[id] : undefined;
    return c ? [c] : [];
  });
  const ready = tributeSetKind(card, selectedCards) !== null;
  const altRules = setPermissions(card)
    .filter((p) => p.materials && p.setKind !== 'normal')
    .map((p) => `${p.materials!.count} ${p.materials!.subType ?? ''} Hero${p.materials!.count > 1 ? 'es' : ''}`.replace(/\s+/g, ' '));

  const toggle = (slot: SlotId) => {
    if (selected.includes(slot) && keepSlot === `C${slot[1]}`) setKeepSlot(null);
    setSelected((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot],
    );
  };
  // Equipment linked to the selected materials: up to 1 may be kept.
  const keepable = selected.flatMap((a) => {
    const c = `C${a[1]}` as SlotId;
    const id = board[c];
    const eq = id ? cardsById[id] : undefined;
    return eq ? [{ slot: c, card: eq }] : [];
  });

  return (
    <div data-ui-overlay style={BACKDROP_STYLE} onClick={() => cancelTributeSummon()}>
      <div style={PANEL_STYLE} onClick={(e) => e.stopPropagation()}>
        <div style={HEADER_STYLE}>
          <span style={{ fontWeight: 700, letterSpacing: 0.4 }}>
            {setMethod} <span style={{ color: '#8b95a3', fontWeight: 500 }}>—</span>{' '}
            <span style={{ color: TYPE_ACCENT.A }}>{card.name}</span>
            <span style={{ color: '#8b95a3', fontWeight: 500 }}> · Lv {need}</span>
          </span>
          <span style={{ ...COUNTER_STYLE, color: ready ? '#ffd75e' : '#c9d2dc' }}>
            {sum}/{need}
          </span>
        </div>

        <div style={SUBTITLE_STYLE}>
          Select Hero materials whose levels sum to exactly {need}
          {altRules.length > 0 ? `, or exactly ${altRules.join(' / ')}` : ''}. They are sent to
          the {destination}.
        </div>

        {materials.length === 0 ? (
          <div style={EMPTY_STYLE}>No Heroes on the board to use as materials.</div>
        ) : (
          <div style={GRID_SCROLL_STYLE}>
            <div style={GRID_STYLE}>
              {materials.map((m) => {
                const mc = cardsById[m.cardId];
                if (!mc) return null;
                const on = selected.includes(m.slotId);
                return (
                  <button
                    key={m.slotId}
                    type="button"
                    onClick={() => toggle(m.slotId)}
                    style={{
                      ...TILE_STYLE,
                      border: `2px solid ${on ? '#ffcf3f' : RARITY_COLOR[mc.rarity]}`,
                      boxShadow: on ? '0 0 12px rgba(255,207,63,0.55)' : 'none',
                    }}
                    title={`${mc.name} — Level ${m.level}`}
                  >
                    <div
                      style={{
                        ...TILE_HEADER_STYLE,
                        background: `linear-gradient(180deg, ${TYPE_ACCENT.A}cc, ${TYPE_ACCENT.A}77)`,
                      }}
                    >
                      <span style={{ fontWeight: 800 }}>A</span>
                      <span style={TILE_LEVEL_STYLE}>Lv {m.level}</span>
                    </div>
                    <div style={TILE_NAME_STYLE}>{mc.name}</div>
                    <div style={TILE_FOOT_STYLE}>
                      <span style={{ color: '#e07a5f' }}>{mc.dmg}</span>
                      <span style={{ color: '#6aa9e0' }}>{mc.acc}</span>
                    </div>
                    {on && <div style={CHECK_STYLE}>✓</div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {keepable.length > 0 && (
          <div style={KEEP_STYLE}>
            <div style={{ fontSize: 12.5, color: '#8b95a3', marginBottom: 8 }}>
              Keep 1 Equipment from the materials (optional) — it moves to {card.name}.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {keepable.map(({ slot, card: eq }) => {
                const on = keepSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setKeepSlot(on ? null : slot)}
                    style={{
                      ...KEEP_CHIP_STYLE,
                      border: `2px solid ${on ? '#ffcf3f' : TYPE_ACCENT.C}`,
                      boxShadow: on ? '0 0 10px rgba(255,207,63,0.5)' : 'none',
                    }}
                    title={eq.name}
                  >
                    <span style={{ color: TYPE_ACCENT.C, fontWeight: 800 }}>C</span> {eq.name}
                    {eq.subType ? <span style={{ color: '#8b95a3' }}> · {eq.subType}</span> : null}
                    {on && <span style={{ color: '#ffcf3f', fontWeight: 900 }}> ✓ Keep</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={FOOTER_STYLE}>
          <button type="button" onClick={() => cancelTributeSummon()} style={CANCEL_STYLE}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => ready && confirmTributeSummon(selected, keepSlot)}
            style={{
              ...CONFIRM_STYLE,
              opacity: ready ? 1 : 0.4,
              cursor: ready ? 'pointer' : 'not-allowed',
            }}
          >
            {setMethod}
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

const COUNTER_STYLE: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 800,
  fontSize: 18,
  letterSpacing: 0.5,
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

const KEEP_STYLE: CSSProperties = {
  padding: '0 16px 12px',
};

const KEEP_CHIP_STYLE: CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  background: '#0e1218',
  color: '#dfe4ea',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  padding: '12px 16px',
  borderTop: '1px solid #2a333f',
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
