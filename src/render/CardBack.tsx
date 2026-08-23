import { RoundedBox } from '@react-three/drei';
import { CARD_WIDTH, CARD_HEIGHT, CARD_THICKNESS } from '../board/boardConfig';
import type { Vec3 } from '../state/types';

/**
 * The card-back mesh at the local origin: cream body with a gold back accent on
 * BOTH broad faces, so it reads as a "back" whether we see its -Z (lying
 * face-down in the deck) or its +Z (held in the opponent's hand facing the
 * camera). No transform of its own — callers place it via a parent group (static
 * CardBack) or a MotionCard (animated hand). Non-pickable, purely decorative.
 */
export function CardBackMesh() {
  return (
    <>
      <RoundedBox
        args={[CARD_WIDTH, CARD_HEIGHT, CARD_THICKNESS]}
        radius={0.025}
        smoothness={4}
        castShadow
        raycast={() => null}
      >
        <meshStandardMaterial color="#f5f1e4" roughness={0.55} metalness={0.05} />
      </RoundedBox>
      <mesh position={[0, 0, -CARD_THICKNESS / 2 - 0.002]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[CARD_WIDTH * 0.82, CARD_HEIGHT * 0.82]} />
        <meshStandardMaterial color="#b9922f" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0, CARD_THICKNESS / 2 + 0.002]}>
        <planeGeometry args={[CARD_WIDTH * 0.82, CARD_HEIGHT * 0.82]} />
        <meshStandardMaterial color="#b9922f" roughness={0.4} metalness={0.3} />
      </mesh>
    </>
  );
}

/** A statically-placed face-down card (used for the opponent deck stack). */
export function CardBack({
  position,
  rotation,
  scale = 1,
}: {
  position: Vec3;
  rotation: Vec3;
  scale?: number;
}) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <CardBackMesh />
    </group>
  );
}
