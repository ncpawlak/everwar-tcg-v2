import { useGameStore } from '../state/useGameStore';
import {
  OPP_SLOT_IDS,
  OPP_SLOT_POSITIONS,
  BOARD_CARD_SCALE,
  BOARD_CARD_WIDTH,
  BOARD_CARD_HEIGHT,
  CARD_THICKNESS,
} from '../board/boardConfig';
import { Edges } from '@react-three/drei';
import { CardView } from '../cards/CardView';
import { StatOverlay } from './StatOverlay';
import type { EffectiveStats } from '../state/combatStats';
import type { Card, Vec3 } from '../state/types';

/**
 * The opponent's Vanguard row across the far side of the field. Renders each
 * seeded opponent A-card face-up in its slot with a floating HP/DMG/ACC plate
 * above it (so its health bar drains as your attacks land). While you're aiming
 * an attack (`targeting` set), every occupied opponent card lights up with a
 * gold outline to show it's a valid target. Cards vanish when removed from
 * `opponentBoard` (destroyed at 0 HP). Purely presentational — picking/targeting
 * is handled by PointerControls.
 */

/** Card lying flat on the mat, face up toward the camera (matches player board). */
const FLAT_ROTATION: Vec3 = [-Math.PI / 2, 0, 0];
/** Plate float above the card (mirrors the player A-zone plate offsets). */
const PLATE_Y_OFFSET = 0.9;
const PLATE_Z_OFFSET = 0.1;

/** Opponent cards carry no C-buffs, so every stat is at base (delta 0). */
function opponentStats(card: Card): EffectiveStats {
  return {
    hp: { value: card.hp ?? 0, delta: 0 },
    dmg: { value: card.dmg ?? 0, delta: 0 },
    acc: { value: card.acc ?? 0, delta: 0 },
  };
}

export function OpponentBoard() {
  const state = useGameStore((s) => s);
  const { opponentBoard, opponentCards, targeting } = state;
  const selectable = targeting !== null;

  return (
    <>
      {OPP_SLOT_IDS.map((slot) => {
        const id = opponentBoard[slot];
        if (!id) return null;
        const card = opponentCards[id];
        if (!card) return null;
        const [x, y, z] = OPP_SLOT_POSITIONS[slot];
        const cardY = y + CARD_THICKNESS * BOARD_CARD_SCALE;
        return (
          <group key={slot}>
            <group position={[x, cardY, z]} rotation={FLAT_ROTATION} scale={BOARD_CARD_SCALE}>
              <CardView card={card} pickable={false} />
            </group>
            {selectable && (
              <mesh position={[x, y + 0.004, z]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[BOARD_CARD_WIDTH * 1.16, BOARD_CARD_HEIGHT * 1.16]} />
                <meshStandardMaterial color="#5a4a12" transparent opacity={0.5} />
                <Edges scale={1} threshold={15} color="#ffcf3f" />
              </mesh>
            )}
            <StatOverlay
              stats={opponentStats(card)}
              position={[x, y + PLATE_Y_OFFSET, z + PLATE_Z_OFFSET]}
              currentHp={state.currentHp[id]}
            />
          </group>
        );
      })}
    </>
  );
}
