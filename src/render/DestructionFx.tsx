import { Billboard } from '@react-three/drei';
import { a, useSpring } from '@react-spring/three';
import { useGameStore } from '../state/useGameStore';
import { OPP_SLOT_POSITIONS, BOARD_CARD_HEIGHT } from '../board/boardConfig';
import type { Vec3 } from '../state/types';

/**
 * Destruction FX: a red X-slash gash drawn over each opponent card that hit 0 HP
 * during Resolution. Two crossing red streaks quickly "cut" across the doomed
 * card, hold, then fade — timed inside the damage dwell so the player sees the
 * card get slashed before it vanishes from the field. Driven by `destroying`;
 * the slots self-clear when the cards are removed.
 */

const SLASH_COLOR = '#ff2733';
/** Lift the slash just above the flat card face so it never z-fights. */
const Y_OFFSET = 0.07;
/** Slash length (a touch longer than the card) + thickness. */
const LEN = BOARD_CARD_HEIGHT * 1.25;
const THICK = 0.055;

export function DestructionFx() {
  const destroying = useGameStore((s) => s.destroying);
  if (destroying.length === 0) return null;

  return (
    <>
      {destroying.map((slot) => {
        const [x, y, z] = OPP_SLOT_POSITIONS[slot];
        const position: Vec3 = [x, y + Y_OFFSET, z];
        return <Gash key={slot} position={position} />;
      })}
    </>
  );
}

function Gash({ position }: { position: Vec3 }) {
  return (
    <Billboard position={position}>
      <Slash angle={-0.62} delay={0} />
      <Slash angle={0.62} delay={90} />
    </Billboard>
  );
}

function Slash({ angle, delay }: { angle: number; delay: number }) {
  // Draw fast (scale out from the center), hold bright, then fade away.
  const spring = useSpring({
    from: { len: 0, opacity: 0 },
    to: async (next) => {
      await next({ len: 1, opacity: 1, config: { tension: 700, friction: 20 } });
      await next({ opacity: 1, config: { duration: 700 } });
      await next({ opacity: 0, config: { duration: 400 } });
    },
    delay,
  });

  return (
    <a.mesh rotation={[0, 0, angle]} scale-x={spring.len}>
      <planeGeometry args={[LEN, THICK]} />
      <a.meshBasicMaterial
        color={SLASH_COLOR}
        transparent
        opacity={spring.opacity}
        depthTest={false}
        toneMapped={false}
      />
    </a.mesh>
  );
}
