import { Line } from '@react-three/drei';
import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';
import { useGameStore } from '../state/useGameStore';
import { SLOT_POSITIONS, OPP_SLOT_POSITIONS, BOARD_Y } from '../board/boardConfig';
import type { OppSlotId, SlotId, Vec3 } from '../state/types';

/**
 * Faint targeting arrows drawn on the mat from each of your attacking A-cards to
 * the opponent card it is aiming at. One per committed attack declaration
 * (`attackTargets`), so multiple arrows can converge on the same opponent. Shown
 * through Battle and Resolution; cleared when the declaration is consumed at End.
 */

/** Float the arrow just above the mat so it reads over the slots, under cards. */
const ARROW_Y = BOARD_Y + 0.12;
const COLOR = '#ffd76a';
const OPACITY = 0.5;
/** Pull the arrowhead back from the target center to sit at the card's edge. */
const HEAD_INSET = 0.3;

export function TargetingArrows() {
  const attackTargets = useGameStore((s) => s.attackTargets);
  const targeting = useGameStore((s) => s.targeting);
  const aimPoint = useGameStore((s) => s.aimPoint);
  const phase = useGameStore((s) => s.phase);
  if (phase !== 'battle' && phase !== 'resolution') return null;
  const entries = Object.entries(attackTargets) as [SlotId, OppSlotId][];

  return (
    <>
      {entries.map(([src, tgt]) => {
        const [sx, , sz] = SLOT_POSITIONS[src];
        const [tx, , tz] = OPP_SLOT_POSITIONS[tgt];
        return <Arrow key={src} from={[sx, ARROW_Y, sz]} to={[tx, ARROW_Y, tz]} />;
      })}
      {/* Live rubber-band arrow from the aiming source to the cursor. */}
      {targeting && aimPoint && (
        <Arrow
          key="__aiming"
          from={[SLOT_POSITIONS[targeting][0], ARROW_Y, SLOT_POSITIONS[targeting][2]]}
          to={[aimPoint[0], ARROW_Y, aimPoint[2]]}
        />
      )}
    </>
  );
}

function Arrow({ from, to }: { from: Vec3; to: Vec3 }) {
  const geom = useMemo(() => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const delta = new Vector3().subVectors(b, a);
    const len = delta.length();
    if (len < 0.05) return null; // degenerate — source and tip coincide
    const dir = delta.multiplyScalar(1 / len);
    const tip = new Vector3().copy(b).addScaledVector(dir, -HEAD_INSET);
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
    return {
      points: [from, [tip.x, tip.y, tip.z]] as Vec3[],
      headPos: [tip.x, tip.y, tip.z] as Vec3,
      headQuat: [q.x, q.y, q.z, q.w] as [number, number, number, number],
    };
  }, [from, to]);

  if (!geom) return null;
  return (
    <group>
      <Line points={geom.points} color={COLOR} lineWidth={2} transparent opacity={OPACITY} />
      <mesh position={geom.headPos} quaternion={geom.headQuat}>
        <coneGeometry args={[0.08, 0.22, 12]} />
        <meshBasicMaterial color={COLOR} transparent opacity={OPACITY} />
      </mesh>
    </group>
  );
}
