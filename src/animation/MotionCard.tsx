import type { ReactNode } from 'react';
import { a, useSpring } from '@react-spring/three';
import type { SpringConfig } from '@react-spring/three';
import type { Pose } from '../state/types';

/**
 * Interruptible spring wrapper around a target pose. Components hand it a target
 * position/rotation derived from state; it interpolates the visual transform
 * toward that target. Changing the target mid-flight retargets smoothly — this
 * is what makes grabbing a card during a reflow feel natural.
 */
export function MotionCard({
  pose,
  config,
  scale = 1,
  from,
  children,
}: {
  pose: Pose;
  config: SpringConfig;
  scale?: number;
  from?: Pose;
  children: ReactNode;
}) {
  const spring = useSpring({
    position: pose.position,
    rotation: pose.rotation,
    scale: [scale, scale, scale] as [number, number, number],
    config,
    // `from` seeds the spring's starting transform on first mount only, so a
    // freshly-mounted card (e.g. an opponent summon reveal) flies in from there
    // instead of popping into place. Ignored on subsequent target changes.
    ...(from
      ? { from: { position: from.position, rotation: from.rotation, scale: [scale, scale, scale] as [number, number, number] } }
      : {}),
  });

  return (
    <a.group
      position={spring.position as unknown as [number, number, number]}
      rotation={spring.rotation as unknown as [number, number, number]}
      scale={spring.scale as unknown as [number, number, number]}
    >
      {children}
    </a.group>
  );
}
