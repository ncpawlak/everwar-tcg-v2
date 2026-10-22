import { Billboard } from '@react-three/drei';
import { a, useSpring } from '@react-spring/three';
import { useGameStore } from '../state/useGameStore';
import { SUMMON_SHOWCASE_POSITION } from '../board/layout';

/**
 * The gold ripple that pulses around a card during its summon showcase. Rendered
 * only while a summon is active and keyed by the card id so the animation
 * restarts for every deploy. Purely decorative — reads transient `summon` state.
 *
 * Ties into the gold placement-outline theme: concentric rings emanate outward
 * from the showcased card and fade, reading as an energy ripple as the card is
 * presented before it flies to its slot.
 */

/** Gold, matching the valid-slot placement outline. */
const RIPPLE_COLOR = '#ffd868';

export function SummonRipple() {
  const summon = useGameStore((s) => s.summon);
  if (!summon) return null;
  return (
    <Billboard position={SUMMON_SHOWCASE_POSITION}>
      <Ring key={`${summon.cardId}-0`} delay={0} />
      <Ring key={`${summon.cardId}-1`} delay={180} />
    </Billboard>
  );
}

function Ring({ delay }: { delay: number }) {
  const { t } = useSpring({
    from: { t: 0 },
    to: { t: 1 },
    delay,
    config: { duration: 600 },
  });
  return (
    <a.mesh scale={t.to((v) => 1 + v * 2.4) as unknown as number}>
      <ringGeometry args={[0.78, 0.9, 64]} />
      <a.meshBasicMaterial
        color={RIPPLE_COLOR}
        transparent
        depthWrite={false}
        opacity={t.to((v) => 0.85 * (1 - v)) as unknown as number}
      />
    </a.mesh>
  );
}
