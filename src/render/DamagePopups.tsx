import { Billboard, Text } from '@react-three/drei';
import { a, useSpring } from '@react-spring/three';
import { useGameStore } from '../state/useGameStore';
import { OPP_SLOT_POSITIONS } from '../board/boardConfig';
import type { OppSlotId, Vec3 } from '../state/types';

/**
 * Incoming-damage pop-up over each opponent card that took a hit this Resolution.
 * A red `-{n}` (summed across every attacker aiming at that target) springs in
 * above the opponent's stat plate the instant the dice vanish, lingers with the
 * HP-bar drain, then self-clears with the dice (driven by `damagePopups`).
 */

const DAMAGE_COLOR = '#e8503a';
/** Above the opponent's stat plate (plate floats +0.9, ~0.34 half-height). */
const Y_OFFSET = 1.38;
const Z_OFFSET = 0.14;

export function DamagePopups() {
  const damagePopups = useGameStore((s) => s.damagePopups);
  const slots = Object.keys(damagePopups) as OppSlotId[];
  if (slots.length === 0) return null;

  return (
    <>
      {slots.map((slot) => {
        const [x, y, z] = OPP_SLOT_POSITIONS[slot];
        const position: Vec3 = [x, y + Y_OFFSET, z + Z_OFFSET];
        return <DamagePopup key={slot} position={position} amount={damagePopups[slot] ?? 0} />;
      })}
    </>
  );
}

function DamagePopup({ position, amount }: { position: Vec3; amount: number }) {
  const spring = useSpring({
    from: { scale: 0, rise: 0 },
    to: { scale: 1, rise: 0.14 },
    config: { tension: 340, friction: 15 },
  });

  return (
    <Billboard position={position}>
      <a.group
        position-y={spring.rise}
        scale={spring.scale.to((s) => [s, s, s]) as unknown as [number, number, number]}
      >
        <Text
          fontSize={0.2}
          color={DAMAGE_COLOR}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#05080b"
        >
          {`-${amount}`}
        </Text>
      </a.group>
    </Billboard>
  );
}
