import { useEffect } from 'react';
import { useGameStore } from '../state/useGameStore';
import { PileSearchModal } from './PileSearchModal';

/**
 * Always-mounted host for the pile-search pop-up. Previously the modal was only
 * rendered inside DevControls; when the dev overlay was hidden (Phase 7) the
 * graveyard/replen pop-ups stopped appearing. This host renders the modal
 * whenever a pile is open — driven by clicking a pile on the board — and wires
 * Escape-to-close, independent of the (now hidden) dev controls.
 */
export function PileSearchHost() {
  const openPile = useGameStore((s) => s.pileSearch);
  const closePileSearch = useGameStore((s) => s.closePileSearch);

  useEffect(() => {
    if (!openPile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePileSearch();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPile, closePileSearch]);

  if (!openPile) return null;
  return <PileSearchModal source={openPile} onClose={() => closePileSearch()} />;
}
