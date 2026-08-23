import { Edges, Text } from '@react-three/drei';
import {
  BOARD_CARD_WIDTH,
  BOARD_CARD_HEIGHT,
  BOARD_Y,
  OPP_FULL_SLOT_POSITIONS,
  OPP_PLACEHOLDER_ZONES,
  slotTypeLabel,
} from '../board/boardConfig';
import { opponentDeckPose } from '../board/layout';
import { CardBack } from './CardBack';
import type { SlotId } from '../state/types';

/**
 * The opponent's field furniture — a purely visual 180° mirror of the player's
 * board (Phase 6). Renders the mirrored zone outlines for all 12 slots, the
 * grave/replen placeholders, and a face-down deck stack (top-left of the
 * screen). The opponent's hand is rendered/animated separately by OpponentHand,
 * and the live A-row cards + targeting live in OpponentBoard. Zone labels are
 * kept upright so they stay readable even though the field is mirrored.
 */

/** How many card backs to stack for the opponent's deck (visual only). */
export const OPP_DECK_COUNT = 12;

export function OpponentField() {
  return (
    <group>
      {/* Mirrored zone outlines for all 12 slots. */}
      {(Object.keys(OPP_FULL_SLOT_POSITIONS) as SlotId[]).map((slotId) => {
        const [x, y, z] = OPP_FULL_SLOT_POSITIONS[slotId];
        return (
          <group key={slotId} position={[x, y - 0.009, z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[BOARD_CARD_WIDTH * 1.12, BOARD_CARD_HEIGHT * 1.12]} />
              <meshStandardMaterial color="#211018" transparent opacity={0.28} />
              <Edges scale={1} threshold={15} color="#5a3a48" />
            </mesh>
            <Text
              position={[0, 0.002, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.16}
              color="#7a5f6b"
              anchorX="center"
              anchorY="middle"
            >
              {slotTypeLabel(slotId)}
            </Text>
          </group>
        );
      })}

      {/* Mirrored grave / replen placeholders. */}
      {OPP_PLACEHOLDER_ZONES.map(({ label, anchor }) => {
        const [x, , z] = anchor;
        return (
          <group key={label} position={[x, BOARD_Y - 0.009, z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[BOARD_CARD_WIDTH * 1.12, BOARD_CARD_HEIGHT * 1.12]} />
              <meshStandardMaterial color="#1a1016" transparent opacity={0.3} />
              <Edges scale={1} threshold={15} color="#5a3a48" />
            </mesh>
            <Text
              position={[0, 0.002, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.12}
              color="#7a5f6b"
              anchorX="center"
              anchorY="middle"
            >
              {label}
            </Text>
          </group>
        );
      })}

      {/* Face-down deck stack (mirrors the player's, so it sits top-left). */}
      {Array.from({ length: OPP_DECK_COUNT }, (_, i) => {
        const pose = opponentDeckPose(i);
        return (
          <CardBack
            key={`deck-${i}`}
            position={pose.position}
            rotation={pose.rotation}
            scale={0.72}
          />
        );
      })}
    </group>
  );
}
