import type { CSSProperties } from 'react';
import { useGameStore } from '../state/useGameStore';

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

export function DevControls() {
  const destroyZoneA = useGameStore((s) => s.destroyZoneA);
  const destroyZoneB = useGameStore((s) => s.destroyZoneB);

  return (
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
    </div>
  );
}
