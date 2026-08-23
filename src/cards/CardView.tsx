import { RoundedBox, Text } from '@react-three/drei';
import { CARD_HEIGHT, CARD_THICKNESS, CARD_WIDTH } from '../board/boardConfig';
import type { CardType } from '../state/types';

/**
 * Phase 2 procedural placeholder card: a thin beveled cream body with the card's
 * type letter (A / B / C) on the front face and a distinct gold back. No
 * authored art — the feel is the point. Local card faces: front = +Z, back = -Z.
 */
export function CardView({ type, pickable = true }: { type: CardType; pickable?: boolean }) {
  return (
    <group>
      <RoundedBox
        args={[CARD_WIDTH, CARD_HEIGHT, CARD_THICKNESS]}
        radius={0.025}
        smoothness={4}
        castShadow
        receiveShadow
        raycast={pickable ? undefined : () => null}
      >
        <meshStandardMaterial color="#f5f1e4" roughness={0.55} metalness={0.05} />
      </RoundedBox>

      {/* Front face type letter */}
      <Text
        position={[0, 0, CARD_THICKNESS / 2 + 0.002]}
        fontSize={0.42}
        color="#1c2b3a"
        anchorX="center"
        anchorY="middle"
      >
        {type}
      </Text>

      {/* Back face accent */}
      <mesh position={[0, 0, -CARD_THICKNESS / 2 - 0.002]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[CARD_WIDTH * 0.82, CARD_HEIGHT * 0.82]} />
        <meshStandardMaterial color="#b9922f" roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
}
