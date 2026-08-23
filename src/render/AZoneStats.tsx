import { useGameStore } from '../state/useGameStore';
import { SLOT_POSITIONS } from '../board/boardConfig';
import { effectiveStats } from '../state/combatStats';
import type { SlotId, SlotIndex, Vec3 } from '../state/types';
import { StatOverlay } from './StatOverlay';

/**
 * Renders the floating combat-stat plate above every occupied A-zone slot. The
 * plate appears (pops in) the moment a card is set in an A slot and disappears
 * when the slot empties, driven purely by board state. Its numbers are the A
 * card's EFFECTIVE stats (base + linked C-card boost), so setting/removing a C
 * card recolors and updates the plate.
 *
 * A-zone only for now (Vanguard front line); other zones can opt in later. The
 * plate is centered horizontally over the linked A/C column pair (A_i ↔ C_i) and
 * floated well above the row so it never covers either card.
 */

const PAIR_INDICES: SlotIndex[] = [1, 2, 3, 4];

/** How far above the card (world units) the stat plate floats. */
const Y_OFFSET = 0.9;
/** Nudge toward the camera so the plate reads as hovering in front, not on the mat. */
const Z_OFFSET = 0.1;

export function AZoneStats() {
  const state = useGameStore((s) => s);
  const { board } = state;

  return (
    <>
      {PAIR_INDICES.map((i) => {
        const aSlot = `A${i}` as SlotId;
        if (!board[aSlot]) return null;
        // Suppress the plate while this A card is still showcasing over the field
        // — it appears once the card lands in its slot.
        if (state.summon && state.summon.cardId === board[aSlot]) return null;
        // Center the plate on the midpoint between the A slot and its linked C
        // slot so it reads as belonging to the whole column pair.
        const [ax, ay, az] = SLOT_POSITIONS[aSlot];
        const [cx] = SLOT_POSITIONS[`C${i}` as SlotId];
        const position: Vec3 = [(ax + cx) / 2, ay + Y_OFFSET, az + Z_OFFSET];
        return <StatOverlay key={aSlot} stats={effectiveStats(state, aSlot)} position={position} />;
      })}
    </>
  );
}
