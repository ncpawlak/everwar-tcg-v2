import { useEffect, useState, type CSSProperties } from 'react';
import { useGameStore } from '../state/useGameStore';

const SHOW_MS = 2400;

/** Brief center-screen toast for `notice` (e.g. a deck search found nothing). */
export function NoticeToast() {
  const notice = useGameStore((s) => s.notice);
  const [visible, setVisible] = useState<typeof notice>(null);

  useEffect(() => {
    if (!notice) return;
    setVisible(notice);
    const t = window.setTimeout(() => setVisible((v) => (v?.key === notice.key ? null : v)), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [notice]);

  if (!visible) return null;
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div key={visible.key} data-ui-overlay style={TOAST_STYLE}>
        {visible.text}
      </div>
    </>
  );
}

const KEYFRAMES = `@keyframes ew-notice { 0% { opacity: 0; transform: translate(-50%, -40%) scale(0.92); }
 12% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
 85% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
 100% { opacity: 0; transform: translate(-50%, -58%) scale(1); } }`;

const TOAST_STYLE: CSSProperties = {
  position: 'absolute',
  top: '42%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  padding: '12px 22px',
  background: 'rgba(12, 17, 22, 0.92)',
  border: '1px solid #c9a24b',
  borderRadius: 10,
  color: '#f3e2b0',
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: 0.3,
  boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
  pointerEvents: 'none',
  zIndex: 40,
  animation: `ew-notice ${SHOW_MS}ms ease-out forwards`,
};
