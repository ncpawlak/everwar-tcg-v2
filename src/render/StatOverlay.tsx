import { Billboard, Text } from '@react-three/drei';
import { a, useSpring } from '@react-spring/three';
import type { Vec3 } from '../state/types';
import type { EffectiveStats } from '../state/combatStats';

/**
 * Combat-stat overlays for an A-zone card's A/C link (Master-Duel style), split
 * into two compact billboards so nothing spills across neighboring columns:
 *
 *   - HpOverlay     : "RemainingHP/TotalHP" + a draining health bar, sitting at
 *                     the TOP of the A/C link.
 *   - DmgAccOverlay : "DMG/ACC" (the two values), sitting UNDERNEATH the link.
 *
 * Values are the A card's EFFECTIVE stats (base + auras and buffs), so they
 * update the moment a C card is set or removed. Both are billboarded, so they
 * stay upright and readable for the player and the (mirrored) opponent alike.
 *
 * Text coloring conveys modification: a stat at its base value is grey; a stat
 * raised by a boost is green; a stat lowered is red. The HP bar drains + recolors
 * (green → yellow → red) as damage lands.
 */

/** HP overlay geometry (top of the link). */
const HP_PLATE_W = 0.78;
const HP_PLATE_H = 0.34;
const HP_BAR_W = 0.66;
const HP_BAR_H = 0.13;
const HP_TEXT_Y = 0.09;
const HP_BAR_Y = -0.08;

/** DMG/ACC overlay geometry (underneath the link). */
const DA_PLATE_W = 0.6;
const DA_PLATE_H = 0.26;

/** How each overlay is offset from its A card. HP sits just above the card's
 * TOP edge; DMG/ACC sits just below the BOTTOM edge — split to opposite edges so
 * they never stack on each other. "Up-screen" is -z for both boards, so the
 * opponent uses the SAME offsets relative to its own (mirrored) card, keeping HP
 * visually above each card and DMG/ACC below it. */
export const HP_Y_OFFSET = 0.06;
export const HP_Z_OFFSET = -0.52;
export const DA_Y_OFFSET = 0.04;
export const DA_Z_OFFSET = 0.5;

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

/** Small pop-in used by both overlays when a card is first set in its slot. */
function usePopIn() {
  return useSpring({
    from: { scale: 0 },
    to: { scale: 1 },
    config: { tension: 320, friction: 18 },
  });
}

/** Remaining/Total HP number stacked over a draining health bar (top of link). */
export function HpOverlay({
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

  const pop = usePopIn();
  // Animate the HP fill (width + color) whenever current HP changes, so a hit
  // drains the bar smoothly and it recolors as it crosses the 50% / 25% marks.
  const hpSpring = useSpring({ frac: fraction, config: { tension: 170, friction: 26 } });

  return (
    <Billboard position={position}>
      <a.group scale={pop.scale.to((s) => [s, s, s]) as unknown as [number, number, number]}>
        <mesh position={[0, 0, -0.002]}>
          <planeGeometry args={[HP_PLATE_W, HP_PLATE_H]} />
          <meshBasicMaterial color="#0c1116" transparent opacity={0.85} />
        </mesh>

        <Text
          position={[0, HP_TEXT_Y, 0.003]}
          fontSize={0.12}
          color={statColor(stats.hp.delta)}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.006}
          outlineColor="#05080b"
        >
          {`${hp}/${maxHp}`}
        </Text>

        {/* HP bar track */}
        <mesh position={[0, HP_BAR_Y, 0]}>
          <planeGeometry args={[HP_BAR_W, HP_BAR_H]} />
          <meshBasicMaterial color="#23303a" />
        </mesh>
        {/* HP bar fill: left-anchored group scaled by the animated fraction. */}
        <a.group
          position={[-HP_BAR_W / 2, HP_BAR_Y, 0.001]}
          scale-x={hpSpring.frac.to((f) => Math.max(f, 0.0001))}
        >
          <mesh position={[HP_BAR_W / 2, 0, 0]}>
            <planeGeometry args={[HP_BAR_W, HP_BAR_H]} />
            <a.meshBasicMaterial color={hpSpring.frac.to((f) => hpBarColor(f))} />
          </mesh>
        </a.group>
      </a.group>
    </Billboard>
  );
}

/** DMG / ACC values on one short line (underneath the link). DMG and ACC are
 * colored independently so a buff shows on the affected stat. */
export function DmgAccOverlay({ stats, position }: { stats: EffectiveStats; position: Vec3 }) {
  const pop = usePopIn();

  return (
    <Billboard position={position}>
      <a.group scale={pop.scale.to((s) => [s, s, s]) as unknown as [number, number, number]}>
        <mesh position={[0, 0, -0.002]}>
          <planeGeometry args={[DA_PLATE_W, DA_PLATE_H]} />
          <meshBasicMaterial color="#0c1116" transparent opacity={0.85} />
        </mesh>

        <Text
          position={[-0.03, 0, 0.003]}
          fontSize={0.13}
          color={statColor(stats.dmg.delta)}
          anchorX="right"
          anchorY="middle"
          outlineWidth={0.006}
          outlineColor="#05080b"
        >
          {`${stats.dmg.value}`}
        </Text>
        <Text
          position={[0, 0, 0.003]}
          fontSize={0.13}
          color={GREY}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.006}
          outlineColor="#05080b"
        >
          /
        </Text>
        <Text
          position={[0.03, 0, 0.003]}
          fontSize={0.13}
          color={statColor(stats.acc.delta)}
          anchorX="left"
          anchorY="middle"
          outlineWidth={0.006}
          outlineColor="#05080b"
        >
          {`${stats.acc.value}`}
        </Text>
      </a.group>
    </Billboard>
  );
}
