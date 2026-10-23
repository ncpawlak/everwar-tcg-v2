import { useEffect, useRef, useState } from 'react';
import { Billboard, Text } from '@react-three/drei';
import { a, useSpring } from '@react-spring/three';
import { useGameStore } from '../state/useGameStore';
import {
  BOARD_CARD_HEIGHT,
  BOARD_CARD_WIDTH,
  OPP_FULL_SLOT_POSITIONS,
  SLOT_POSITIONS,
} from '../board/boardConfig';
import type { CardId, SlotId, Vec3 } from '../state/types';

/**
 * Gold counter badge on the corner of every field card holding counters
 * (Devil Dog Rifleman, Zero Path Escort, …). Whenever the count changes the
 * badge pulses and a "+1" / "-1" floats up and fades from it.
 */

const GOLD = '#ffcf3f';
const BADGE_Y = 0.32;

export function CounterBadges() {
  const counters = useGameStore((s) => s.counters);
  const board = useGameStore((s) => s.board);
  const opponentBoard = useGameStore((s) => s.opponentBoard);
  const opponentBBoard = useGameStore((s) => s.opponentBBoard);

  const entries: { id: CardId; pos: Vec3; opp: boolean }[] = [];
  for (const [slot, id] of Object.entries(board)) {
    if (id && (counters[id] ?? 0) > 0) entries.push({ id, pos: SLOT_POSITIONS[slot as SlotId], opp: false });
  }
  for (const [slot, id] of Object.entries({ ...opponentBoard, ...opponentBBoard })) {
    if (!id || (counters[id] ?? 0) <= 0) continue;
    // O1..O4 mirror A1..A4; OB1..OB4 mirror B1..B4.
    const mirror = (slot.startsWith('OB') ? `B${slot[2]}` : `A${slot[1]}`) as SlotId;
    entries.push({ id, pos: OPP_FULL_SLOT_POSITIONS[mirror], opp: true });
  }

  return (
    <>
      {entries.map(({ id, pos, opp }) => {
        const [x, y, z] = pos;
        // Top-right corner from the owner's point of view.
        const dx = (opp ? -1 : 1) * (BOARD_CARD_WIDTH / 2 - 0.04);
        const dz = (opp ? 1 : -1) * (BOARD_CARD_HEIGHT / 2 - 0.04);
        return <CounterBadge key={id} position={[x + dx, y + BADGE_Y, z + dz]} count={counters[id] ?? 0} />;
      })}
    </>
  );
}

function CounterBadge({ position, count }: { position: Vec3; count: number }) {
  const prev = useRef(count);
  const [floats, setFloats] = useState<{ key: number; delta: number }[]>([]);
  const [{ scale }, api] = useSpring(() => ({
    from: { scale: 0 },
    to: { scale: 1 },
    config: { tension: 380, friction: 14 },
  }));

  useEffect(() => {
    const delta = count - prev.current;
    prev.current = count;
    if (delta === 0) return;
    api.start({ from: { scale: 1.7 }, to: { scale: 1 } });
    const key = performance.now() + Math.random();
    setFloats((f) => [...f, { key, delta }]);
    const t = setTimeout(() => setFloats((f) => f.filter((x) => x.key !== key)), 1100);
    return () => clearTimeout(t);
  }, [count, api]);

  return (
    <Billboard position={position}>
      <a.group scale={scale.to((s) => [s, s, s]) as unknown as [number, number, number]}>
        <mesh renderOrder={20}>
          <circleGeometry args={[0.11, 32]} />
          <meshBasicMaterial color="#1a1206" depthTest={false} transparent />
        </mesh>
        <mesh renderOrder={21} position-z={0.001}>
          <ringGeometry args={[0.085, 0.11, 32]} />
          <meshBasicMaterial color={GOLD} depthTest={false} transparent />
        </mesh>
        <Text
          renderOrder={22}
          position-z={0.002}
          fontSize={0.13}
          color={GOLD}
          anchorX="center"
          anchorY="middle"
          fontWeight={800}
          material-depthTest={false}
        >
          {String(count)}
        </Text>
      </a.group>
      {floats.map((f) => (
        <DeltaFloat key={f.key} delta={f.delta} />
      ))}
    </Billboard>
  );
}

function DeltaFloat({ delta }: { delta: number }) {
  const spring = useSpring({
    from: { rise: 0.1, opacity: 1 },
    to: { rise: 0.45, opacity: 0 },
    config: { duration: 1000 },
  });
  return (
    <a.group position-y={spring.rise} position-x={0.16}>
      <AText opacity={spring.opacity} color={delta > 0 ? '#7dff9a' : '#ff6b5a'}>
        {delta > 0 ? `+${delta}` : `${delta}`}
      </AText>
    </a.group>
  );
}

const AnimatedText = a(Text);

function AText({ opacity, color, children }: { opacity: unknown; color: string; children: string }) {
  return (
    <AnimatedText
      renderOrder={23}
      fontSize={0.14}
      color={color}
      anchorX="left"
      anchorY="middle"
      outlineWidth={0.012}
      outlineColor="#05080b"
      fillOpacity={opacity as number}
      outlineOpacity={opacity as number}
      material-depthTest={false}
    >
      {children}
    </AnimatedText>
  );
}
