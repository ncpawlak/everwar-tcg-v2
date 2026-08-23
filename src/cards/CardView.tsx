import { RoundedBox, Text } from '@react-three/drei';
import { CARD_HEIGHT, CARD_THICKNESS, CARD_WIDTH } from '../board/boardConfig';
import type { Card } from '../state/types';
import { RARITY_COLOR, TYPE_ACCENT, TYPE_LABEL } from './cardTheme';

/**
 * Procedural card face (Slice 1). Renders the same information as the inspection
 * panel — name, cost, rarity, type, effect, ATK/DEF — directly on the 3D card so
 * hand and board cards read like real cards. Local faces: front = +Z, back = -Z.
 * The layout is authored in the hand-scale local space; board cards inherit it
 * via the group scale in MotionCard.
 */

const HALF_W = CARD_WIDTH / 2;
const HALF_H = CARD_HEIGHT / 2;
/** Just proud of the front face, with tiny per-layer offsets to avoid z-fighting. */
const ZF = CARD_THICKNESS / 2 + 0.002;

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

export function CardView({ card, pickable = true }: { card: Card; pickable?: boolean }) {
  const accent = TYPE_ACCENT[card.type];
  const rarityColor = RARITY_COLOR[card.rarity];

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

      {/* Name header band */}
      <mesh position={[0, HALF_H - 0.1, ZF]}>
        <planeGeometry args={[CARD_WIDTH * 0.92, 0.15]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      <Text
        position={[0, HALF_H - 0.1, ZF + 0.002]}
        fontSize={0.048}
        maxWidth={CARD_WIDTH * 0.86}
        lineHeight={1}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        textAlign="center"
      >
        {card.name}
      </Text>

      {/* Cost pip (ringed) */}
      <mesh position={[-HALF_W + 0.12, HALF_H - 0.26, ZF]}>
        <circleGeometry args={[0.085, 28]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      <mesh position={[-HALF_W + 0.12, HALF_H - 0.26, ZF + 0.001]}>
        <circleGeometry args={[0.068, 28]} />
        <meshBasicMaterial color="#0e1218" />
      </mesh>
      <Text
        position={[-HALF_W + 0.12, HALF_H - 0.26, ZF + 0.003]}
        fontSize={0.075}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {String(card.cost)}
      </Text>

      {/* Rarity gem (diamond) */}
      <mesh position={[HALF_W - 0.11, HALF_H - 0.26, ZF]} rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[0.07, 0.07]} />
        <meshBasicMaterial color={rarityColor} />
      </mesh>

      {/* Big type letter */}
      <Text
        position={[0, 0.0, ZF + 0.001]}
        fontSize={0.24}
        color={accent}
        anchorX="center"
        anchorY="middle"
      >
        {card.type}
      </Text>

      {/* Type label */}
      <Text
        position={[0, -0.14, ZF + 0.001]}
        fontSize={0.04}
        color={accent}
        anchorX="center"
        anchorY="middle"
      >
        {TYPE_LABEL[card.type]}
      </Text>

      {/* Compact effect text */}
      <Text
        position={[0, -0.2, ZF + 0.001]}
        fontSize={0.028}
        maxWidth={CARD_WIDTH * 0.86}
        lineHeight={1.08}
        color="#3a4652"
        anchorX="center"
        anchorY="top"
        textAlign="center"
      >
        {truncate(card.effect, 74)}
      </Text>

      {/* Bottom stat bar */}
      <mesh position={[0, -HALF_H + 0.14, ZF]}>
        <planeGeometry args={[CARD_WIDTH * 0.9, 0.006]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      <Text
        position={[-HALF_W + 0.08, -HALF_H + 0.08, ZF + 0.001]}
        fontSize={0.05}
        color="#b23a1f"
        anchorX="left"
        anchorY="middle"
      >
        {`ATK ${card.atk}`}
      </Text>
      <Text
        position={[HALF_W - 0.08, -HALF_H + 0.08, ZF + 0.001]}
        fontSize={0.05}
        color="#1f5fa0"
        anchorX="right"
        anchorY="middle"
      >
        {`DEF ${card.def}`}
      </Text>

      {/* Back face accent (shown when face-down, e.g. in the deck) */}
      <mesh position={[0, 0, -CARD_THICKNESS / 2 - 0.002]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[CARD_WIDTH * 0.82, CARD_HEIGHT * 0.82]} />
        <meshStandardMaterial color="#b9922f" roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
}
