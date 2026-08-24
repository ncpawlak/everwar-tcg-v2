import { RoundedBox, Text } from '@react-three/drei';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, MeshStandardMaterial } from 'three';
import { CARD_HEIGHT, CARD_THICKNESS, CARD_WIDTH } from '../board/boardConfig';
import type { Card } from '../state/types';
import { abilityLabel } from '../state/abilities';
import { RARITY_COLOR, TYPE_ACCENT, TYPE_LABEL } from './cardTheme';

/**
 * Procedural card face (Slice 1). Renders the same information as the inspection
 * panel — name, cost, rarity, type, effect, DMG/ACC — directly on the 3D card so
 * hand and board cards read like real cards. Local faces: front = +Z, back = -Z.
 * The layout is authored in the hand-scale local space; board cards inherit it
 * via the group scale in MotionCard.
 */

const HALF_W = CARD_WIDTH / 2;
const HALF_H = CARD_HEIGHT / 2;
/** Just proud of the front face, with tiny per-layer offsets to avoid z-fighting. */
const ZF = CARD_THICKNESS / 2 + 0.002;

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

/** Teal energy that circles a board Hero's border while it projects an active
 *  passive aura. A faint static track shows the loop; a bright "comet" head with
 *  a fading tail chases clockwise around the perimeter (the "snake"). Teal so it
 *  can't be confused with the gold placement outlines, and it sits just proud of
 *  the front face so it never occludes the card art. */
const GLOW_BX = CARD_WIDTH / 2 + 0.01; // half-width of the travel rectangle
const GLOW_BY = CARD_HEIGHT / 2 + 0.01; // half-height
const GLOW_W = GLOW_BX * 2;
const GLOW_H = GLOW_BY * 2;
const GLOW_PERIM = 2 * (GLOW_W + GLOW_H);
const GLOW_Z = CARD_THICKNESS / 2 + 0.006; // above the face + text
const SNAKE_SEGMENTS = 16; // head + tail dots
const SNAKE_SPACING = 0.012; // perimeter fraction between segments
const SNAKE_SPEED = 0.42; // loops per second

/** Point on the border rectangle at perimeter fraction `t` (clockwise from the
 *  top-left corner). */
function borderPoint(t: number): [number, number] {
  let d = ((t % 1) + 1) % 1 * GLOW_PERIM;
  if (d < GLOW_W) return [-GLOW_BX + d, GLOW_BY]; // top edge, L→R
  d -= GLOW_W;
  if (d < GLOW_H) return [GLOW_BX, GLOW_BY - d]; // right edge, T→B
  d -= GLOW_H;
  if (d < GLOW_W) return [GLOW_BX - d, -GLOW_BY]; // bottom edge, R→L
  d -= GLOW_W;
  return [-GLOW_BX, -GLOW_BY + d]; // left edge, B→T
}

function AuraGlow() {
  const segs = useRef<(Mesh | null)[]>([]);
  useFrame((frameState) => {
    const head = frameState.clock.elapsedTime * SNAKE_SPEED;
    for (let i = 0; i < SNAKE_SEGMENTS; i++) {
      const m = segs.current[i];
      if (!m) continue;
      const [x, y] = borderPoint(head - i * SNAKE_SPACING);
      m.position.set(x, y, GLOW_Z);
    }
  });
  return (
    <group>
      {/* Faint static track so the loop reads even behind the comet's tail. */}
      <RoundedBox
        args={[GLOW_W, GLOW_H, CARD_THICKNESS * 0.5]}
        radius={0.03}
        smoothness={4}
        raycast={() => null}
      >
        <meshStandardMaterial color="#05201d" emissive="#2fe6c8" emissiveIntensity={0.3} toneMapped={false} />
      </RoundedBox>
      {/* The comet: segment 0 is the bright head, later segments shrink + fade. */}
      {Array.from({ length: SNAKE_SEGMENTS }).map((_, i) => {
        const f = i / SNAKE_SEGMENTS;
        const radius = 0.05 * (1 - 0.7 * f);
        const opacity = 1 - 0.9 * f;
        return (
          <mesh
            key={i}
            ref={(m) => {
              segs.current[i] = m;
            }}
            position={[GLOW_BX, GLOW_BY, GLOW_Z]}
            raycast={() => null}
          >
            <circleGeometry args={[radius, 16]} />
            <meshBasicMaterial
              color={i === 0 ? '#8effee' : '#2fe6c8'}
              transparent
              opacity={opacity}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/** Amber border ring that pulses while a board Hero has an activated ability the
 *  player can trigger right now. Rendered as a rounded frame slightly larger than
 *  the card and centered on it, so the opaque card face occludes the middle and
 *  only the amber rim shows around the border. Amber so it can't be confused with
 *  the teal aura or the gold placement outlines, and so both can glow at once. */
const RING_MARGIN = 0.05; // how far the ring extends past each edge
function ActivatableGlow() {
  const mat = useRef<MeshStandardMaterial | null>(null);
  useFrame((frameState) => {
    if (!mat.current) return;
    // Gentle breathing pulse, ~0.6 Hz.
    const pulse = 0.5 + 0.5 * Math.sin(frameState.clock.elapsedTime * 4);
    mat.current.emissiveIntensity = 0.5 + 1.1 * pulse;
  });
  return (
    <RoundedBox
      args={[CARD_WIDTH + RING_MARGIN, CARD_HEIGHT + RING_MARGIN, CARD_THICKNESS * 0.9]}
      radius={0.04}
      smoothness={4}
      raycast={() => null}
    >
      <meshStandardMaterial ref={mat} color="#3a2400" emissive="#ffb020" emissiveIntensity={0.7} toneMapped={false} />
    </RoundedBox>
  );
}

/** Expanding amber ripple that plays once when an activated ability fires. Three
 *  concentric rings, phase-offset, each grows outward from the card and fades —
 *  a distinct "pulse out" look versus the summon reveal and the steady amber ring.
 *  Rendered flat in the card's face plane, just proud of the front, facing +Z. */
const RIPPLE_Z = CARD_THICKNESS / 2 + 0.02;
const RIPPLE_BASE = Math.max(CARD_WIDTH, CARD_HEIGHT) * 0.55;
const RIPPLE_PERIOD = 0.62; // seconds per ring cycle
function AbilityRipple() {
  const rings = useRef<(Mesh | null)[]>([]);
  useFrame((frameState) => {
    const t = frameState.clock.elapsedTime;
    for (let i = 0; i < 3; i++) {
      const m = rings.current[i];
      if (!m) continue;
      // Each ring runs the same cycle, offset by a third of the period.
      const phase = ((t + (i * RIPPLE_PERIOD) / 3) % RIPPLE_PERIOD) / RIPPLE_PERIOD;
      const scale = 1 + phase * 1.7;
      m.scale.set(scale, scale, 1);
      const mat = m.material as { opacity: number };
      mat.opacity = 0.85 * (1 - phase);
    }
  });
  return (
    <group position={[0, 0, RIPPLE_Z]} raycast={() => null}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)} raycast={() => null}>
          <ringGeometry args={[RIPPLE_BASE, RIPPLE_BASE + 0.04, 48]} />
          <meshBasicMaterial color="#ffb020" transparent opacity={0.85} toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export function CardView({
  card,
  pickable = true,
  auraActive = false,
  activatable = false,
  showcasing = false,
  armorBars,
}: {
  card: Card;
  pickable?: boolean;
  auraActive?: boolean;
  /** True when this board Hero has an activated ability the player can trigger
   * now — shows the pulsing amber ring. */
  activatable?: boolean;
  /** True while this card is playing its activated-ability showcase — forces the
   * amber ring on and plays the expanding ripple. */
  showcasing?: boolean;
  /** Live Armor Bars remaining (from combat state). Falls back to the card's
   * base `armorBars` stat when omitted (e.g. in hand). */
  armorBars?: number;
}) {
  const accent = TYPE_ACCENT[card.type];
  const rarityColor = RARITY_COLOR[card.rarity];
  const shownBars = armorBars ?? card.armorBars ?? 0;

  return (
    <group>
      {auraActive && <AuraGlow />}
      {(activatable || showcasing) && <ActivatableGlow />}
      {showcasing && <AbilityRipple />}
      <RoundedBox
        args={[CARD_WIDTH, CARD_HEIGHT, CARD_THICKNESS]}
        radius={0.025}
        smoothness={4}
        castShadow
        receiveShadow
        raycast={pickable ? undefined : () => null}
      >
        <meshStandardMaterial color="#f5f1e4" roughness={0.55} metalness={0.05} />
      </RoundedBox>

      {/* Name header band */}
      <mesh position={[0, HALF_H - 0.1, ZF]}>
        <planeGeometry args={[CARD_WIDTH * 0.92, 0.15]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      <Text
        position={[0, HALF_H - 0.1, ZF + 0.002]}
        fontSize={0.048}
        maxWidth={CARD_WIDTH * 0.86}
        lineHeight={1}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        textAlign="center"
      >
        {card.name}
      </Text>

      {/* Cost pip (ringed) */}
      <mesh position={[-HALF_W + 0.12, HALF_H - 0.26, ZF]}>
        <circleGeometry args={[0.085, 28]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      <mesh position={[-HALF_W + 0.12, HALF_H - 0.26, ZF + 0.001]}>
        <circleGeometry args={[0.068, 28]} />
        <meshBasicMaterial color="#0e1218" />
      </mesh>
      <Text
        position={[-HALF_W + 0.12, HALF_H - 0.26, ZF + 0.003]}
        fontSize={0.075}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {String(card.cost)}
      </Text>

      {/* Rarity gem (diamond) */}
      <mesh position={[HALF_W - 0.11, HALF_H - 0.26, ZF]} rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[0.07, 0.07]} />
        <meshBasicMaterial color={rarityColor} />
      </mesh>

      {/* Level pill + Commander tag (A cards only), centered under the name band
          between the cost pip and rarity gem so it reads on small board cards. */}
      {card.type === 'A' && card.level != null && (
        <Text
          position={[0, HALF_H - 0.27, ZF + 0.003]}
          fontSize={0.072}
          color="#d8b24a"
          outlineWidth={0.004}
          outlineColor="#2a1e06"
          anchorX="center"
          anchorY="middle"
        >
          {`Lv ${card.level}`}
        </Text>
      )}
      {card.type === 'A' && card.commander && (
        <Text
          position={[0, HALF_H - 0.37, ZF + 0.003]}
          fontSize={0.038}
          letterSpacing={0.06}
          color="#e6b23a"
          outlineWidth={0.003}
          outlineColor="#2a1e06"
          anchorX="center"
          anchorY="middle"
        >
          ★ COMMANDER ★
        </Text>
      )}

      {/* Big type letter */}
      <Text
        position={[0, 0.0, ZF + 0.001]}
        fontSize={0.24}
        color={accent}
        anchorX="center"
        anchorY="middle"
      >
        {card.type}
      </Text>

      {/* Type label — Hero subtype (Infantry/Recon/…) for A cards, family label otherwise */}
      <Text
        position={[0, -0.14, ZF + 0.001]}
        fontSize={0.04}
        color={accent}
        anchorX="center"
        anchorY="middle"
      >
        {card.type === 'A' && card.subType ? card.subType : TYPE_LABEL[card.type]}
      </Text>

      {/* Compact effect text */}
      <Text
        position={[0, -0.2, ZF + 0.001]}
        fontSize={0.028}
        maxWidth={CARD_WIDTH * 0.86}
        lineHeight={1.08}
        color="#3a4652"
        anchorX="center"
        anchorY="top"
        textAlign="center"
      >
        {truncate(card.effect, 74)}
      </Text>

      {/* Bottom stat bar */}
      <mesh position={[0, -HALF_H + 0.14, ZF]}>
        <planeGeometry args={[CARD_WIDTH * 0.9, 0.006]} />
        <meshBasicMaterial color={accent} />
      </mesh>

      {card.type === 'C' ? (
        /* C cards are supports: instead of their own stat line they show the
           random boost they grant a linked A card. The concrete roll appears
           once the card is set; in hand it reads as a generic promise. */
        card.buff ? (
          <Text
            position={[0, -HALF_H + 0.09, ZF + 0.001]}
            fontSize={0.058}
            color={card.buff.amount >= 0 ? '#2f9e46' : '#b23a1f'}
            anchorX="center"
            anchorY="middle"
          >
            {`${card.buff.amount >= 0 ? '▲' : '▼'} ${card.buff.stat.toUpperCase()} ${
              card.buff.amount >= 0 ? '+' : ''
            }${card.buff.amount}`}
          </Text>
        ) : (
          <Text
            position={[0, -HALF_H + 0.09, ZF + 0.001]}
            fontSize={0.036}
            maxWidth={CARD_WIDTH * 0.82}
            lineHeight={1.1}
            color="#5c6b64"
            anchorX="center"
            anchorY="middle"
            textAlign="center"
          >
            Boosts a random stat of its linked A card
          </Text>
        )
      ) : card.type === 'B' ? (
        /* B cards are spells: instead of combat stats they show the on-play
           ability they enact when set. Continuous B cards get a badge since they
           survive the End phase. */
        <>
          {card.continuous && (
            <Text
              position={[0, -HALF_H + 0.155, ZF + 0.001]}
              fontSize={0.036}
              letterSpacing={0.08}
              color="#c9a24b"
              anchorX="center"
              anchorY="middle"
            >
              ◆ CONTINUOUS ◆
            </Text>
          )}
          <Text
            position={[0, -HALF_H + 0.09, ZF + 0.001]}
            fontSize={0.044}
            maxWidth={CARD_WIDTH * 0.84}
            lineHeight={1.12}
            color="#7a5cc6"
            anchorX="center"
            anchorY="middle"
            textAlign="center"
          >
            {card.ability ? abilityLabel(card.ability) : ''}
          </Text>
        </>
      ) : (
        <>
          {/* HP (centered, just above the DMG/ACC row) */}
          <Text
            position={[0, -HALF_H + 0.075, ZF + 0.001]}
            fontSize={0.045}
            color="#2f9e46"
            anchorX="center"
            anchorY="middle"
          >
            {`HP ${card.hp}`}
          </Text>
          <Text
            position={[-HALF_W + 0.08, -HALF_H + 0.075, ZF + 0.001]}
            fontSize={0.05}
            color="#b23a1f"
            anchorX="left"
            anchorY="middle"
          >
            {`DMG ${card.dmg}`}
          </Text>
          <Text
            position={[HALF_W - 0.08, -HALF_H + 0.075, ZF + 0.001]}
            fontSize={0.05}
            color="#1f5fa0"
            anchorX="right"
            anchorY="middle"
          >
            {`ACC ${card.acc}`}
          </Text>
          {/* Armor line (Phase 8) — flat Armor and/or Armor Bars when present. */}
          {((card.armor ?? 0) > 0 || shownBars > 0) && (
            <Text
              position={[0, -HALF_H + 0.145, ZF + 0.001]}
              fontSize={0.036}
              color="#8a7bd8"
              anchorX="center"
              anchorY="middle"
            >
              {[
                (card.armor ?? 0) > 0 ? `ARM ${card.armor}` : null,
                shownBars > 0 ? `▮×${shownBars}` : null,
              ]
                .filter(Boolean)
                .join('   ')}
            </Text>
          )}
        </>
      )}

      {/* Back face accent (shown when face-down, e.g. in the deck) */}
      <mesh position={[0, 0, -CARD_THICKNESS / 2 - 0.002]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[CARD_WIDTH * 0.82, CARD_HEIGHT * 0.82]} />
        <meshStandardMaterial color="#b9922f" roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
}
