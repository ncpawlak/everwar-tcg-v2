import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MeshBasicMaterial } from 'three';
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
import { pileHasActivatable } from '../abilities/pile';

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
  const pendingSummon = useGameStore((s) => s.pendingSummon);
  const graveyard = useGameStore((s) => s.graveyard);
  const replen = useGameStore((s) => s.replen);
  const activePlayer = useGameStore((s) => s.activePlayer);

  // A pile glows amber when it holds a card with an in-pile activated ability the
  // player could trigger right now (their Main phase).
  const canActivatePile = activePlayer === 'player' && phase === 'main';
  const graveActivatable = canActivatePile && pileHasActivatable(graveyard, 'graveyard', cardsById);
  const replenActivatable = canActivatePile && pileHasActivatable(replen, 'replen', cardsById);

  return (
    <group>
      {SLOT_IDS.map((slotId) => {
        const [x, y, z] = SLOT_POSITIONS[slotId];
        // During the summon slot-pick step only the open A slots (summonHighlight)
        // should glow, so the drag highlight is suppressed then.
        const dragHighlight =
          pendingSummon === null &&
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
        // Awaiting a level-3+ summon slot: open A slots light up to be picked.
        const summonHighlight =
          pendingSummon !== null && slotType(slotId) === 'A' && board[slotId] === null;
        const highlight = dragHighlight || attackHighlight || summonHighlight;
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
        const active = label === 'GRAVE' ? graveActivatable : label === 'REPLEN' ? replenActivatable : false;
        return (
          <group key={label} position={[x, BOARD_Y - 0.009, z]}>
            {active && <AmberPileFrame />}
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

/**
 * Pulsing amber halo + outline drawn under a pile placeholder when that pile
 * holds a card with an in-pile activated ability. The larger amber plane sits
 * just below the (translucent) placeholder plane so only its rim shows as a
 * glowing border; its opacity breathes via useFrame. Reuses the `#ffb020`
 * amber that marks activatable abilities elsewhere.
 */
function AmberPileFrame() {
  const matRef = useRef<MeshBasicMaterial>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    if (matRef.current) {
      matRef.current.opacity = 0.28 + 0.22 * (0.5 + 0.5 * Math.sin(t.current * 4));
    }
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <planeGeometry args={[BOARD_CARD_WIDTH * 1.34, BOARD_CARD_HEIGHT * 1.34]} />
        <meshBasicMaterial ref={matRef} color="#ffb020" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <planeGeometry args={[BOARD_CARD_WIDTH * 1.2, BOARD_CARD_HEIGHT * 1.2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        <Edges scale={1} threshold={15} color="#ffcf5c" />
      </mesh>
    </group>
  );
}
