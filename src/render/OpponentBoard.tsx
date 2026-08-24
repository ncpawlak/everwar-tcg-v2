import { useGameStore } from '../state/useGameStore';
import {
  OPP_SLOT_IDS,
  OPP_SLOT_POSITIONS,
  BOARD_CARD_WIDTH,
  BOARD_CARD_HEIGHT,
} from '../board/boardConfig';
import { Edges } from '@react-three/drei';
import { MotionCard } from '../animation/MotionCard';
import { selectOpponentCardVisual } from '../animation/poseSelectors';
import { CardView } from '../cards/CardView';
import { opponentSummonFromPose } from '../board/layout';
import { opponentEffectiveStats } from '../state/combatStats';
import { projectingAuraCardIds } from '../abilities/auras';
import {
  HpOverlay,
  DmgAccOverlay,
  HP_Y_OFFSET,
  HP_Z_OFFSET,
  DA_Y_OFFSET,
  DA_Z_OFFSET,
} from './StatOverlay';
import type { OppSlotId, Vec3 } from '../state/types';

/**
 * The opponent's Vanguard row across the far side of the field. Each seeded
 * opponent A-card is rendered by a MotionCard driven purely by state via
 * `selectOpponentCardVisual`, so it lies upside-down in its slot while alive and
 * springs into the mirrored opponent graveyard when destroyed (instead of
 * vanishing). Its HP number/bar sits just above the card and its DMG/ACC line
 * just below — the same screen-space split as the player, kept upright by the
 * billboard. While you're aiming an attack (`targeting` set) every occupied
 * opponent card lights up with a gold outline. Picking is via PointerControls.
 */

/** Overlay position for an opponent A card: offset from the card in screen space
 * (up-screen is -z for both boards) so HP sits above the card and DMG/ACC below,
 * exactly like the player's. */
function oppOverlayPos(oppSlot: OppSlotId, yOff: number, zOff: number): Vec3 {
  const [x, y, z] = OPP_SLOT_POSITIONS[oppSlot];
  return [x, y + yOff, z + zOff];
}

export function OpponentBoard() {
  const state = useGameStore((s) => s);
  const { opponentBoard, opponentCards, targeting } = state;
  const selectable = targeting !== null;

  // Opponent Heroes projecting an active passive aura glow, same as the player.
  const oppBoardHeroes = Object.values(opponentBoard)
    .map((id) => (id ? opponentCards[id] : undefined))
    .filter((c): c is NonNullable<typeof c> => !!c && c.type === 'A');
  const oppAuraIds = projectingAuraCardIds(oppBoardHeroes);

  return (
    <>
      {/* Every opponent card (on-board or traveling to the grave) is a MotionCard
          so zone changes animate. Keyed by card id, not slot, so a card removed
          from its slot keeps its identity and springs to the graveyard. */}
      {Object.keys(opponentCards).map((id) => {
        const visual = selectOpponentCardVisual(state, id);
        if (!visual) return null;
        const card = opponentCards[id];
        return (
          <MotionCard
            key={id}
            pose={visual.pose}
            config={visual.config}
            scale={visual.scale}
            from={visual.zone === 'summon' ? opponentSummonFromPose() : undefined}
          >
            <CardView card={card} pickable={false} auraActive={oppAuraIds.has(id)} />
          </MotionCard>
        );
      })}

      {/* Targeting outline + HP plate for each still-on-board slot (upright). */}
      {OPP_SLOT_IDS.map((slot) => {
        const id = opponentBoard[slot as OppSlotId];
        if (!id) return null;
        const card = opponentCards[id];
        if (!card) return null;
        const [x, y, z] = OPP_SLOT_POSITIONS[slot as OppSlotId];
        return (
          <group key={slot}>
            {selectable && (
              <mesh position={[x, y + 0.004, z]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[BOARD_CARD_WIDTH * 1.16, BOARD_CARD_HEIGHT * 1.16]} />
                <meshStandardMaterial color="#5a4a12" transparent opacity={0.5} />
                <Edges scale={1} threshold={15} color="#ffcf3f" />
              </mesh>
            )}
            <HpOverlay
              stats={opponentEffectiveStats(state, slot as OppSlotId)}
              position={oppOverlayPos(slot as OppSlotId, HP_Y_OFFSET, HP_Z_OFFSET)}
              currentHp={state.currentHp[id]}
            />
            <DmgAccOverlay
              stats={opponentEffectiveStats(state, slot as OppSlotId)}
              position={oppOverlayPos(slot as OppSlotId, DA_Y_OFFSET, DA_Z_OFFSET)}
            />
          </group>
        );
      })}
    </>
  );
}
