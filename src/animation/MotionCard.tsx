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
  children,
}: {
  pose: Pose;
  config: SpringConfig;
  children: ReactNode;
}) {
  const spring = useSpring({
    position: pose.position,
    rotation: pose.rotation,
    config,
  });

  return (
    <a.group position={spring.position as unknown as [number, number, number]} rotation={spring.rotation as unknown as [number, number, number]}>
      {children}
    </a.group>
  );
}
