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
import { slotType } from '../state/types';
import type { SlotId } from '../state/types';
import { slotHighlightedForCard } from '../board/slotRules';

/**
 * The 12 typed placement slots plus the labeled graveyard/replen placeholders.
 *
 * During a drag, the placeable target lights up gold. For A/C cards the whole
 * linked column (both the A and C zone) highlights, since either can be dropped
 * on; for B cards only the placeable slot itself. Highlighting is state/layout
 * driven — no animation decisions here.
 */
export function SlotView() {
  const board = useGameStore((s) => s.board);
  const cardsById = useGameStore((s) => s.cardsById);
  const dragCard = useGameStore((s) =>
    s.dragging ? (s.cardsById[s.dragging.cardId] ?? null) : null,
  );
  const attackTargets = useGameStore((s) => s.attackTargets);
  const targeting = useGameStore((s) => s.targeting);
  const phase = useGameStore((s) => s.phase);

  return (
    <group>
      {SLOT_IDS.map((slotId) => {
        const [x, y, z] = SLOT_POSITIONS[slotId];
        const dragHighlight =
          dragCard !== null &&
          slotHighlightedForCard(board, cardsById, slotId, dragCard);
        // A declared attacker (or the column currently being aimed) lights up its
        // whole linked column (A + C zone) through Battle/Resolution.
        const col = `A${slotId[1]}` as SlotId;
        const isAC = slotType(slotId) === 'A' || slotType(slotId) === 'C';
        const attackHighlight =
          (phase === 'battle' || phase === 'resolution') &&
          isAC &&
          (col in attackTargets || targeting === col);
        const highlight = dragHighlight || attackHighlight;
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
