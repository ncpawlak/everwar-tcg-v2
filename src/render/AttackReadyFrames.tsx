import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../state/useGameStore';
import { BOARD_Y, BOARD_CARD_WIDTH, BOARD_CARD_HEIGHT, SLOT_POSITIONS } from '../board/boardConfig';
import { heroCanAttack } from '../state/combatStats';
import type { SlotId } from '../state/types';
import { makeFrameGeometry } from './FieldTurnHighlight';

/**
 * During the player's Battle phase, a pulsing gold frame hugs each A–C column
 * whose Hero can still attack this turn (it passes the Set-turn rule and hasn't
 * declared a target yet). Declared columns switch to the slot attack highlight.
 */

const COLUMNS: SlotId[] = ['A1', 'A2', 'A3', 'A4'];
const PAD = 0.1;
const FRAME_Y = BOARD_Y + 0.012;

export function AttackReadyFrames() {
  // A stable string key so the frames only re-render when the ready set changes.
  const readyKey = useGameStore((s) =>
    s.activePlayer === 'player' && s.phase === 'battle' && !s.winner
      ? COLUMNS.filter((a) => heroCanAttack(s, 'player', a) && !(a in s.attackTargets) && s.targeting !== a).join(',')
      : '',
  );
  const ready = readyKey ? (readyKey.split(',') as SlotId[]) : [];

  const rect = useMemo(() => {
    const [ax, , az] = SLOT_POSITIONS.A1;
    const [cx, , cz] = SLOT_POSITIONS.C1;
    const w = Math.abs(ax - cx) + BOARD_CARD_WIDTH + 2 * PAD;
    const h = Math.abs(az - cz) + BOARD_CARD_HEIGHT + 2 * PAD;
    return { w, h };
  }, []);
  const geom = useMemo(() => makeFrameGeometry(rect.w, rect.h, 0.16, 0.045), [rect.w, rect.h]);

  // One shared material so every ready column pulses in sync.
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffcf3f',
        transparent: true,
        opacity: 0.8,
        toneMapped: false,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    material.opacity = 0.35 + 0.6 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 4.2));
  });

  if (!ready.length) return null;
  return (
    <group>
      {ready.map((a) => {
        const [ax, , az] = SLOT_POSITIONS[a];
        const [cx, , cz] = SLOT_POSITIONS[`C${a[1]}` as SlotId];
        return (
          <mesh
            key={a}
            geometry={geom}
            material={material}
            position={[(ax + cx) / 2, FRAME_Y, (az + cz) / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        );
      })}
    </group>
  );
}
