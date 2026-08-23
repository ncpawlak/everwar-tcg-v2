import { useEffect, type CSSProperties } from 'react';
import { useGameStore } from '../state/useGameStore';
import { PileSearchModal } from './PileSearchModal';

/**
 * Temporary Phase 3 developer controls (no Player 2 yet). A DOM overlay marked
 * `data-ui-overlay` so PointerControls ignores clicks here and they never reach
 * the game input layer. These buttons drive mechanics manually until real turn
 * flow exists.
 */
const BUTTON_STYLE: CSSProperties = {
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 0.3,
  color: '#f5e6c8',
  background: 'linear-gradient(180deg, #7a2230 0%, #521622 100%)',
  border: '1px solid #c9a24b',
  borderRadius: 8,
  cursor: 'pointer',
  boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
};

const SEARCH_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  background: 'linear-gradient(180deg, #24405e 0%, #16283b 100%)',
  border: '1px solid #5b86ad',
};

const REPLEN_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  background: 'linear-gradient(180deg, #4a2e6b 0%, #2c1a41 100%)',
  border: '1px solid #9b6fd0',
};

const SHUFFLE_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  background: 'linear-gradient(180deg, #1f5a44 0%, #123a2c 100%)',
  border: '1px solid #4fb08a',
};

export function DevControls() {
  const destroyZoneA = useGameStore((s) => s.destroyZoneA);
  const destroyZoneB = useGameStore((s) => s.destroyZoneB);
  const replenZoneA = useGameStore((s) => s.replenZoneA);
  const disturbDeck = useGameStore((s) => s.disturbDeck);
  const shuffleDeck = useGameStore((s) => s.shuffleDeck);
  const replenIntoDeck = useGameStore((s) => s.replenIntoDeck);
  const graveyardIntoDeck = useGameStore((s) => s.graveyardIntoDeck);
  const handIntoDeck = useGameStore((s) => s.handIntoDeck);
  const openPile = useGameStore((s) => s.pileSearch);
  const openPileSearch = useGameStore((s) => s.openPileSearch);
  const closePileSearch = useGameStore((s) => s.closePileSearch);

  useEffect(() => {
    if (!openPile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePileSearch();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPile, closePileSearch]);

  return (
    <>
      <div
        data-ui-overlay
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 10,
        }}
      >
        <button type="button" onClick={() => destroyZoneA()} style={BUTTON_STYLE}>
          Destroy — Zone A → Grave
        </button>
        <button type="button" onClick={() => destroyZoneB()} style={BUTTON_STYLE}>
          Destroy — Zone B → Grave
        </button>
        <button type="button" onClick={() => replenZoneA()} style={REPLEN_BUTTON_STYLE}>
          Replen — Zone A → Replen
        </button>
        <button type="button" onClick={() => disturbDeck()} style={REPLEN_BUTTON_STYLE}>
          Disturb — Deck top → Replen
        </button>
        <button type="button" onClick={() => shuffleDeck()} style={SHUFFLE_BUTTON_STYLE}>
          Shuffle Deck
        </button>
        <button type="button" onClick={() => replenIntoDeck()} style={SHUFFLE_BUTTON_STYLE}>
          Replen → Deck + Shuffle
        </button>
        <button type="button" onClick={() => graveyardIntoDeck()} style={SHUFFLE_BUTTON_STYLE}>
          Grave → Deck + Shuffle
        </button>
        <button type="button" onClick={() => handIntoDeck()} style={SHUFFLE_BUTTON_STYLE}>
          Hand → Deck + Shuffle
        </button>
        <button type="button" onClick={() => openPileSearch('deck')} style={SEARCH_BUTTON_STYLE}>
          Search — Deck
        </button>
        <button type="button" onClick={() => openPileSearch('graveyard')} style={SEARCH_BUTTON_STYLE}>
          Search — Graveyard
        </button>
        <button type="button" onClick={() => openPileSearch('replen')} style={SEARCH_BUTTON_STYLE}>
          Search — Replen
        </button>
      </div>

      {openPile && <PileSearchModal source={openPile} onClose={() => closePileSearch()} />}
    </>
  );
}
