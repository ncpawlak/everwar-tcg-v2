import { useFrame, useThree } from '@react-three/fiber';
import { Billboard, Edges, Text } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import { Mesh, Quaternion, Vector3 } from 'three';
import { useGameStore } from '../state/useGameStore';
import { SLOT_POSITIONS } from '../board/boardConfig';
import type { DiceState, SlotId, Vec3 } from '../state/types';

/**
 * Phase 4 Resolution dice (in-scene). During Resolution, every declared attacker
 * rolls a D20 simultaneously, each die tumbling over its own card's A/C link
 * area (on top of the cards). While rolling the number cycles; once settled the
 * die eases the face nearest the camera flat-on and the value locks in.
 *
 * Rendered in the 3D scene (not a DOM overlay) so each die sits at its board
 * position. Driven entirely by `resolutionRolls`.
 */

/** Radius of the icosahedron (D20 shape). */
const DIE_RADIUS = 0.2;
/**
 * How far above the row the die floats, and its nudge toward the camera. Kept
 * low enough that the die (radius 0.2) sits fully UNDERNEATH the stat plate,
 * whose bottom edge is ~0.56 above the row (plate at +0.9, half-height 0.34).
 */
const Y_OFFSET = 0.2;
const Z_OFFSET = 0.15;

export function ResolutionDice() {
  const rolls = useGameStore((s) => s.resolutionRolls);
  const slots = Object.keys(rolls) as SlotId[];
  if (slots.length === 0) return null;

  return (
    <>
      {slots.map((slot) => {
        const idx = slot[1];
        const [ax, ay, az] = SLOT_POSITIONS[slot];
        const [cx] = SLOT_POSITIONS[`C${idx}` as SlotId];
        const position: Vec3 = [(ax + cx) / 2, ay + Y_OFFSET, az + Z_OFFSET];
        return <ResolutionDie key={slot} position={position} state={rolls[slot]} />;
      })}
    </>
  );
}

function ResolutionDie({
  position,
  state,
}: {
  position: Vec3;
  state: DiceState;
}) {
  const ref = useRef<Mesh>(null);
  const vel = useRef({ x: 8.5, y: 12.5, z: 6.5 });
  const target = useRef<Quaternion | null>(null);
  const { camera } = useThree();
  const rolling = state.rolling;
  const [display, setDisplay] = useState(state.value);

  // Cycle the shown number while tumbling; lock to the real value once settled.
  useEffect(() => {
    if (rolling) {
      const id = window.setInterval(
        () => setDisplay(1 + Math.floor(Math.random() * 20)),
        70,
      );
      return () => window.clearInterval(id);
    }
    setDisplay(state.value);
  }, [rolling, state.value]);

  // On settle, pick the face whose normal points most toward the camera and snap
  // it flat-on (the die's group is translation-only, so mesh quaternion is world).
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    if (rolling) {
      target.current = null;
      return;
    }
    const camDir = new Vector3(position[0], position[1], position[2]);
    camDir.subVectors(camera.position, camDir).normalize();
    const pos = m.geometry.attributes.position;
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const ab = new Vector3();
    const ac = new Vector3();
    const n = new Vector3();
    const q = m.quaternion;
    let best = -Infinity;
    const bestNormal = new Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, i + 1);
      c.fromBufferAttribute(pos, i + 2);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      n.crossVectors(ab, ac).normalize().applyQuaternion(q);
      const d = n.dot(camDir);
      if (d > best) {
        best = d;
        bestNormal.copy(n);
      }
    }
    const delta = new Quaternion().setFromUnitVectors(bestNormal, camDir);
    target.current = delta.multiply(q.clone());
  }, [rolling, camera, position]);

  useFrame((_, delta) => {
    const m = ref.current;
    if (!m) return;
    if (rolling || !target.current) {
      m.rotation.x += vel.current.x * delta;
      m.rotation.y += vel.current.y * delta;
      m.rotation.z += vel.current.z * delta;
    } else {
      m.quaternion.slerp(target.current, 1 - Math.pow(0.0002, delta));
    }
  });

  return (
    <group position={position}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[DIE_RADIUS, 0]} />
        <meshStandardMaterial color="#7a2230" flatShading metalness={0.35} roughness={0.45} />
        <Edges threshold={12} color="#e7c874" />
      </mesh>
      <Billboard>
        <Text
          position={[0, 0, DIE_RADIUS + 0.06]}
          fontSize={DIE_RADIUS * 0.9}
          color={rolling ? '#f5e6c8' : '#ffffff'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#05080b"
        >
          {String(display)}
        </Text>
      </Billboard>
    </group>
  );
}
