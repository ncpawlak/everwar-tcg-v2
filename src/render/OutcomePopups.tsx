import { Billboard, Text } from '@react-three/drei';
import { a, useSpring } from '@react-spring/three';
import { useGameStore } from '../state/useGameStore';
import { SLOT_POSITIONS, OPP_SLOT_POSITIONS, OPP_FULL_SLOT_POSITIONS } from '../board/boardConfig';
import type { OppSlotId, RollOutcome, RollResult, SlotId, Vec3 } from '../state/types';

/**
 * Outcome-announcement pop-up shown above each attacker's stat plate the instant
 * the Resolution dice vanish. A big word — MISS (grey) / HIT (white) /
 * GLANCING (cyan) / CRITICAL (gold) — pops in with a spring and floats up a
 * touch. Shown over YOUR attacking cards; the incoming damage is shown over the
 * opponent target instead (see DamagePopups). Self-clears with the dice.
 *
 * Positioned on the linked A/C column midpoint, higher than the stat plate so it
 * reads as rising off the top of the combat readout.
 */

/** Word shown per outcome (CRITICAL, not the die's terse "CRIT"). */
const POPUP_LABEL: Record<RollOutcome, string> = {
  miss: 'MISS',
  normal: 'HIT',
  glancing: 'GLANCING',
  crit: 'CRITICAL',
};

/** Color per outcome: miss grey, hit white, glancing cyan, crit gold. */
const POPUP_COLOR: Record<RollOutcome, string> = {
  miss: '#9aa6ad',
  normal: '#ffffff',
  glancing: '#38c7d0',
  crit: '#ffcf3f',
};

/** How far above the card row the pop-up sits (just above the stat plate top,
 * which is ~1.24 above the row). */
const Y_OFFSET = 1.38;
const Z_OFFSET = 0.14;
/** Keep the word within the width of the HP/DMG/ACC plate (PLATE_W = 1.02). */
const MAX_WIDTH = 1.0;

export function OutcomePopups() {
  const popups = useGameStore((s) => s.outcomePopups);
  const oppPopups = useGameStore((s) => s.oppOutcomePopups);
  const slots = Object.keys(popups) as SlotId[];
  const oppSlots = Object.keys(oppPopups) as OppSlotId[];
  if (slots.length === 0 && oppSlots.length === 0) return null;

  return (
    <>
      {slots.map((slot) => {
        const idx = slot[1];
        const [ax, ay, az] = SLOT_POSITIONS[slot];
        const [cx] = SLOT_POSITIONS[`C${idx}` as SlotId];
        const position: Vec3 = [(ax + cx) / 2, ay + Y_OFFSET, az + Z_OFFSET];
        return <OutcomePopup key={slot} position={position} result={popups[slot]} />;
      })}
      {oppSlots.map((slot) => {
        const idx = slot[1];
        const [ax, ay, az] = OPP_SLOT_POSITIONS[slot];
        const [cx] = OPP_FULL_SLOT_POSITIONS[`C${idx}` as SlotId];
        const position: Vec3 = [(ax + cx) / 2, ay + Y_OFFSET, az + Z_OFFSET];
        return <OutcomePopup key={`opp-${slot}`} position={position} result={oppPopups[slot]} />;
      })}
    </>
  );
}

function OutcomePopup({ position, result }: { position: Vec3; result: RollResult }) {
  // Pop in with an overshoot, drifting up a little as it appears.
  const spring = useSpring({
    from: { scale: 0, rise: 0 },
    to: { scale: 1, rise: 0.14 },
    config: { tension: 340, friction: 15 },
  });

  const { outcome } = result;
  const crit = outcome === 'crit';

  return (
    <Billboard position={position}>
      <a.group
        position-y={spring.rise}
        scale={spring.scale.to((s) => [s, s, s]) as unknown as [number, number, number]}
      >
        <Text
          fontSize={crit ? 0.2 : 0.18}
          maxWidth={MAX_WIDTH}
          color={POPUP_COLOR[outcome]}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#05080b"
        >
          {POPUP_LABEL[outcome]}
        </Text>
      </a.group>
    </Billboard>
  );
}
