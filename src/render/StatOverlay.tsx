import { Billboard, Text } from '@react-three/drei';
import { a, useSpring } from '@react-spring/three';
import type { Vec3 } from '../state/types';
import type { EffectiveStats } from '../state/combatStats';

/**
 * Floating combat-stat plate that hovers above an A-zone card's column
 * (Master-Duel style): an HP bar plus ATK / DEF readouts stacked in three rows.
 * Values are the A card's EFFECTIVE stats (base + linked C-card boost), so the
 * plate updates the moment a C card is set or removed.
 *
 * Text coloring conveys modification: a stat at its base value is grey; a stat
 * raised by a boost is green; a stat lowered is red. HP is shown current/max —
 * combat doesn't exist yet so `currentHp` defaults to max (a full bar).
 */

const PLATE_W = 1.02;
const PLATE_H = 0.68;
const HP_BAR_W = 0.88;
const HP_BAR_H = 0.13;

const HP_ROW_Y = 0.19;
const ATK_ROW_Y = -0.05;
const DEF_ROW_Y = -0.24;

/** Neutral / boosted / reduced text colors. */
const GREY = '#9aa6ad';
const GREEN = '#43c65a';
const RED = '#d64b3a';

/** Color a stat readout by how a boost shifted it. */
function statColor(delta: number): string {
  if (delta > 0) return GREEN;
  if (delta < 0) return RED;
  return GREY;
}

/** HP bar fill color by remaining fraction (health, not modification). */
function hpBarColor(fraction: number): string {
  if (fraction > 0.5) return '#43c65a';
  if (fraction > 0.25) return '#e0a53a';
  return '#d64b3a';
}

export function StatOverlay({
  stats,
  position,
  currentHp,
}: {
  stats: EffectiveStats;
  position: Vec3;
  currentHp?: number;
}) {
  const maxHp = stats.hp.value;
  const hp = currentHp ?? maxHp;
  const fraction = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const fillW = HP_BAR_W * fraction;

  // Pop-in when the plate first mounts (card set in an A slot).
  const spring = useSpring({
    from: { scale: 0 },
    to: { scale: 1 },
    config: { tension: 320, friction: 18 },
  });

  return (
    <Billboard position={position}>
      <a.group scale={spring.scale.to((s) => [s, s, s]) as unknown as [number, number, number]}>
        {/* Backing plate */}
        <mesh position={[0, 0, -0.002]}>
          <planeGeometry args={[PLATE_W, PLATE_H]} />
          <meshBasicMaterial color="#0c1116" transparent opacity={0.85} />
        </mesh>

        {/* HP bar track */}
        <mesh position={[0, HP_ROW_Y, 0]}>
          <planeGeometry args={[HP_BAR_W, HP_BAR_H]} />
          <meshBasicMaterial color="#23303a" />
        </mesh>
        {/* HP bar fill (left-anchored) */}
        <mesh position={[-HP_BAR_W / 2 + fillW / 2, HP_ROW_Y, 0.001]}>
          <planeGeometry args={[Math.max(fillW, 0.0001), HP_BAR_H]} />
          <meshBasicMaterial color={hpBarColor(fraction)} />
        </mesh>
        <Text
          position={[0, HP_ROW_Y, 0.003]}
          fontSize={0.08}
          color={statColor(stats.hp.delta)}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.006}
          outlineColor="#05080b"
        >
          {`HP ${hp} / ${maxHp}`}
        </Text>

        {/* ATK row */}
        <Text
          position={[0, ATK_ROW_Y, 0.003]}
          fontSize={0.1}
          color={statColor(stats.atk.delta)}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.006}
          outlineColor="#05080b"
        >
          {`ATK  ${stats.atk.value}`}
        </Text>

        {/* DEF row */}
        <Text
          position={[0, DEF_ROW_Y, 0.003]}
          fontSize={0.1}
          color={statColor(stats.def.delta)}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.006}
          outlineColor="#05080b"
        >
          {`DEF  ${stats.def.value}`}
        </Text>
      </a.group>
    </Billboard>
  );
}
