import { useColdGameState } from '../state/useGameStore';
import { SLOT_POSITIONS } from '../board/boardConfig';
import { effectiveStats, heroBars, heroMaxBars, heroArmor } from '../state/combatStats';
import type { SlotId, SlotIndex, Vec3 } from '../state/types';
import {
  HpOverlay,
  DmgAccOverlay,
  HP_Y_OFFSET,
  HP_Z_OFFSET,
  DA_Y_OFFSET,
  DA_Z_OFFSET,
} from './StatOverlay';

/**
 * Renders the combat-stat overlays for every occupied A-zone slot: a HP number +
 * health bar at the TOP of the A/C link, and a DMG/ACC line UNDERNEATH it. Both
 * appear (pop in) the moment a card is set and disappear when the slot empties,
 * driven purely by board state. Numbers are the A card's EFFECTIVE stats (base +
 * auras and buffs), so setting/removing a C card recolors and updates them.
 *
 * A-zone only for now (Vanguard front line); other zones can opt in later. Both
 * overlays are centered horizontally over the linked A/C column pair (A_i ↔ C_i).
 */

const PAIR_INDICES: SlotIndex[] = [1, 2, 3, 4];

export function AZoneStats() {
  const state = useColdGameState();
  const { board } = state;

  return (
    <>
      {PAIR_INDICES.map((i) => {
        const aSlot = `A${i}` as SlotId;
        if (!board[aSlot]) return null;
        // Suppress the overlays while this A card is still showcasing over the
        // field — they appear once the card lands in its slot.
        if (state.summon && state.summon.cardId === board[aSlot]) return null;
        // Center under the A card itself (it owns the combat stats), just off
        // its outer edge — the C card sits beside it in the same pair.
        const [ax, ay, az] = SLOT_POSITIONS[aSlot];
        const stats = effectiveStats(state, aSlot);
        const currentHp = state.currentHp[board[aSlot]!];
        const hpPos: Vec3 = [ax, ay + HP_Y_OFFSET, az + HP_Z_OFFSET];
        const daPos: Vec3 = [ax, ay + DA_Y_OFFSET, az + DA_Z_OFFSET];
        return (
          <group key={aSlot}>
            <HpOverlay
              stats={stats}
              position={hpPos}
              currentHp={currentHp}
              bars={heroBars(state, 'player', aSlot)}
              maxBars={heroMaxBars(state, 'player', aSlot)}
              armor={heroArmor(state, 'player', aSlot)}
            />
            <DmgAccOverlay stats={stats} position={daPos} />
          </group>
        );
      })}
    </>
  );
}
