import { Edges, Text } from '@react-three/drei';
import {
  BOARD_CARD_HEIGHT,
  BOARD_CARD_WIDTH,
  BOARD_Y,
  PLACEHOLDER_ZONES,
  SLOT_POSITIONS,
  slotTypeLabel,
} from '../board/boardConfig';
import { SLOT_IDS } from '../state/cardData';
import { useGameStore } from '../state/useGameStore';
import { isSlotEmpty, slotAcceptsType } from '../board/slotRules';

/**
 * The 12 typed placement slots plus the labeled graveyard/replen placeholders.
 *
 * During a drag, only EMPTY slots whose type matches the dragged card show the
 * gold outline (type-gated highlight). Highlighting is state/layout driven —
 * no animation decisions here.
 */
export function SlotView() {
  const board = useGameStore((s) => s.board);
  const dragCardId = useGameStore((s) => s.dragging?.cardId ?? null);
  const dragType = useGameStore((s) =>
    s.dragging ? (s.cardsById[s.dragging.cardId]?.type ?? null) : null,
  );

  return (
    <group>
      {SLOT_IDS.map((slotId) => {
        const [x, y, z] = SLOT_POSITIONS[slotId];
        const highlight =
          dragCardId !== null &&
          dragType !== null &&
          isSlotEmpty(board, slotId) &&
          slotAcceptsType(slotId, dragType);
        return (
          <group key={slotId} position={[x, y - 0.009, z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[BOARD_CARD_WIDTH * 1.12, BOARD_CARD_HEIGHT * 1.12]} />
              <meshStandardMaterial
                color={highlight ? '#5a4a12' : '#0e211d'}
                transparent
                opacity={highlight ? 0.55 : 0.28}
              />
              <Edges scale={1} threshold={15} color={highlight ? '#ffcf3f' : '#3a5148'} />
            </mesh>
            <Text
              position={[0, 0.002, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.16}
              color={highlight ? '#ffe38a' : '#5f7a70'}
              anchorX="center"
              anchorY="middle"
            >
              {slotTypeLabel(slotId)}
            </Text>
          </group>
        );
      })}

      {PLACEHOLDER_ZONES.map(({ label, anchor }) => {
        const [x, , z] = anchor;
        return (
          <group key={label} position={[x, BOARD_Y - 0.009, z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[BOARD_CARD_WIDTH * 1.12, BOARD_CARD_HEIGHT * 1.12]} />
              <meshStandardMaterial color="#101a20" transparent opacity={0.3} />
              <Edges scale={1} threshold={15} color="#3a5148" />
            </mesh>
            <Text
              position={[0, 0.002, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.12}
              color="#5f7a70"
              anchorX="center"
              anchorY="middle"
            >
              {label}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
