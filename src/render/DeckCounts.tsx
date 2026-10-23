import { Billboard, Text } from '@react-three/drei';
import { useGameStore } from '../state/useGameStore';
import {
  BOARD_CARD_HEIGHT,
  BOARD_CARD_SCALE,
  CARD_THICKNESS,
  DECK_ANCHOR,
  OPP_DECK_ANCHOR,
} from '../board/boardConfig';
import type { Vec3 } from '../state/types';

/** Cards-remaining badge floating over each Deck stack. */
function DeckCount({ anchor, count, towardCamera }: { anchor: Vec3; count: number; towardCamera: number }) {
  const [x, y, z] = anchor;
  const top = y + count * CARD_THICKNESS * BOARD_CARD_SCALE;
  return (
    <Billboard position={[x, top + 0.12, z + towardCamera * BOARD_CARD_HEIGHT * 0.32]}>
      <mesh position={[0, 0, -0.002]}>
        <circleGeometry args={[0.13, 32]} />
        <meshBasicMaterial color="#0c1116" transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0, -0.003]}>
        <circleGeometry args={[0.145, 32]} />
        <meshBasicMaterial color={count === 0 ? '#d64b3a' : '#c9a24b'} />
      </mesh>
      <Text
        fontSize={0.13}
        color={count === 0 ? '#ff8a7a' : '#f3e2b0'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.005}
        outlineColor="#05080b"
      >
        {`${count}`}
      </Text>
    </Billboard>
  );
}

export function DeckCounts() {
  const deck = useGameStore((s) => s.deck.length);
  const oppDeck = useGameStore((s) => s.opponentDeck.length);
  return (
    <>
      <DeckCount anchor={DECK_ANCHOR} count={deck} towardCamera={1} />
      <DeckCount anchor={OPP_DECK_ANCHOR} count={oppDeck} towardCamera={-1} />
    </>
  );
}
