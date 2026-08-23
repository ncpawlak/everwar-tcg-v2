import { useGameStore } from '../state/useGameStore';
import { BoardView } from './BoardView';
import { SlotView } from './SlotView';
import { CardEntity } from './CardEntity';
import { AZoneStats } from './AZoneStats';
import { SummonRipple } from './SummonRipple';
import { ResolutionDice } from './ResolutionDice';
import { OutcomePopups } from './OutcomePopups';
import { DamagePopups } from './DamagePopups';
import { DestructionFx } from './DestructionFx';
import { OpponentBoard } from './OpponentBoard';
import { OpponentField } from './OpponentField';
import { OpponentHand } from './OpponentHand';
import { TargetingArrows } from './TargetingArrows';
import { OpeningDeal } from './OpeningDeal';
import { ThreeBridge } from './ThreeBridge';

/**
 * Phase 1 scene composition. Lights + playmat + slots + one CardEntity per card
 * + the opening-deal controller. Pointer input is handled at the DOM level by
 * PointerControls (see App), not by in-scene R3F handlers.
 * The scene only subscribes to state and renders; it never mutates state except
 * through the input/action layer.
 */
export function GameScene() {
  const cardsById = useGameStore((s) => s.cardsById);
  const cardIds = Object.keys(cardsById);

  return (
    <>
      <ThreeBridge />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[3.5, 8, 5]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <BoardView />
      <SlotView />
      <OpponentField />
      <OpponentHand />
      <OpponentBoard />
      {cardIds.map((id) => (
        <CardEntity key={id} cardId={id} />
      ))}
      <AZoneStats />
      <SummonRipple />
      <TargetingArrows />
      <ResolutionDice />
      <OutcomePopups />
      <DamagePopups />
      <DestructionFx />
      <OpeningDeal />
    </>
  );
}
