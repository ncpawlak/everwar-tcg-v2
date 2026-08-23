import { Edges } from '@react-three/drei';
import { CARD_HEIGHT, CARD_WIDTH, SLOT_POSITIONS } from '../board/boardConfig';
import { SLOT_IDS } from '../state/cardData';
import { useGameStore } from '../state/useGameStore';
import { isSlotEmpty } from '../board/slotRules';

/**
 * Placement-slot markers. A gold outline appears on EMPTY slots while a card is
 * being dragged (FR7). Highlighting is state/layout driven — no animation
 * decisions here.
 */
export function SlotView() {
  const isDragging = useGameStore((s) => s.dragging !== null);
  const board = useGameStore((s) => s.board);

  return (
    <group>
      {SLOT_IDS.map((slotId) => {
        const [x, y, z] = SLOT_POSITIONS[slotId];
        const highlight = isDragging && isSlotEmpty(board, slotId);
        return (
          <mesh key={slotId} position={[x, y - 0.009, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[CARD_WIDTH * 1.12, CARD_HEIGHT * 1.12]} />
            <meshStandardMaterial
              color={highlight ? '#5a4a12' : '#0e211d'}
              transparent
              opacity={highlight ? 0.55 : 0.28}
            />
            <Edges
              scale={1}
              threshold={15}
              color={highlight ? '#ffcf3f' : '#3a5148'}
            />
          </mesh>
        );
      })}
    </group>
  );
}
