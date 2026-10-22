import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../state/useGameStore';
import {
  BOARD_Y,
  BOARD_CARD_WIDTH,
  BOARD_CARD_HEIGHT,
  SLOT_POSITIONS,
  DECK_ANCHOR,
  GRAVEYARD_ANCHOR,
  REPLEN_ANCHOR,
  mirrorPoint,
} from '../board/boardConfig';
import type { Vec3 } from '../state/types';

/**
 * Phase 7 turn-ownership highlight (in-scene). A glowing rounded frame lying
 * flat on the mat around whichever player's field is active — warm gold on the
 * player's field during your turn, crimson on the opponent's field while it
 * auto-plays. Because it's drawn in 3D on the board plane, it hugs each field
 * in perspective (like a spotlight ring) rather than a flat screen border.
 *
 * Hidden until the first turn begins so it doesn't show during the opening deal.
 */

/** Padding (world units) between the field's outermost cards and the frame. */
const PAD = 0.42;
/** Frame band thickness (world units). */
const BAND = 0.05;
/** Corner radius of the frame (world units). */
const RADIUS = 0.34;
/** Sits just above the mat, below the cards' faces. */
const FRAME_Y = BOARD_Y + 0.015;

/** Bounding rectangle (center + half extents on the XZ plane) of a point set. */
function fieldRect(points: Vec3[]): { cx: number; cz: number; w: number; h: number } {
  const halfW = BOARD_CARD_WIDTH / 2 + PAD;
  const halfH = BOARD_CARD_HEIGHT / 2 + PAD;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, , z] of points) {
    minX = Math.min(minX, x - halfW);
    maxX = Math.max(maxX, x + halfW);
    minZ = Math.min(minZ, z - halfH);
    maxZ = Math.max(maxZ, z + halfH);
  }
  return {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    w: maxX - minX,
    h: maxZ - minZ,
  };
}

/** Trace a rounded rectangle (width w, height h, corner r) into a path. */
function traceRoundedRect(path: THREE.Shape | THREE.Path, w: number, h: number, r: number) {
  const x = -w / 2;
  const y = -h / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
}

/** A flat frame-band geometry (outer rounded rect minus an inner hole). */
function makeFrameGeometry(w: number, h: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  traceRoundedRect(shape, w, h, RADIUS);
  const hole = new THREE.Path();
  traceRoundedRect(hole, w - 2 * BAND, h - 2 * BAND, Math.max(0.02, RADIUS - BAND));
  shape.holes.push(hole);
  return new THREE.ShapeGeometry(shape);
}

export function FieldTurnHighlight() {
  const activePlayer = useGameStore((s) => s.activePlayer);
  const phaseAnnounce = useGameStore((s) => s.phaseAnnounce);

  // Player field: every player slot + the deck/grave/replen piles.
  const playerRect = useMemo(() => {
    const pts: Vec3[] = [
      ...Object.values(SLOT_POSITIONS),
      DECK_ANCHOR,
      GRAVEYARD_ANCHOR,
      REPLEN_ANCHOR,
    ];
    return fieldRect(pts);
  }, []);
  // Opponent field is the point-reflection of the player's field.
  const opponentRect = useMemo(() => {
    const pts: Vec3[] = [
      ...Object.values(SLOT_POSITIONS),
      DECK_ANCHOR,
      GRAVEYARD_ANCHOR,
      REPLEN_ANCHOR,
    ].map(mirrorPoint);
    return fieldRect(pts);
  }, []);

  const geom = useMemo(() => makeFrameGeometry(playerRect.w, playerRect.h), [playerRect.w, playerRect.h]);

  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.opacity = 0.66 + 0.24 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.4));
    }
  });

  if (phaseAnnounce === 0) return null;

  const opponent = activePlayer === 'opponent';
  const rect = opponent ? opponentRect : playerRect;
  const color = opponent ? '#d0463b' : '#c9a24b';

  return (
    <mesh
      geometry={geom}
      position={[rect.cx, FRAME_Y, rect.cz]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <meshBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={0.85}
        toneMapped={false}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
