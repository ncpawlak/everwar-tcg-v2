import { Canvas } from '@react-three/fiber';
import { GameScene } from '../render/GameScene';
import { PointerControls } from '../input/PointerControls';
import { InspectionPanel } from '../ui/InspectionPanel';
import { PileSearchHost } from '../ui/PileSearchHost';
import { TributeModal } from '../ui/TributeModal';
import { AbilityTargetModal, OnSetChoiceModal, SpellChoiceModal, SpellCostModal } from '../ui/AbilityTargetModal';
import { AbilityPromptModal } from '../ui/AbilityPromptModal';
import { CounterPromptModal } from '../ui/CounterPromptModal';
import { CombatPromptModal } from '../ui/CombatPromptModal';
import { SummonSlotPrompt } from '../ui/SummonSlotPrompt';
import { TurnHud } from '../ui/TurnHud';
import { PhaseBanner } from '../ui/PhaseBanner';
import { ScoreHud } from '../ui/ScoreHud';
import { NoticeToast } from '../ui/NoticeToast';
import { CAMERA_FOV, CAMERA_POSITION, CAMERA_TARGET } from '../board/boardConfig';

/**
 * Phase 1 app shell. Mounts the R3F canvas with a fixed angled camera looking
 * down at the playmat (Master-Duel-style depth) and renders the game scene.
 * Pointer input is driven at the DOM level by PointerControls (R3F's own event
 * system is unreliable in some embedded runtimes); it raycasts against the live
 * camera published by ThreeBridge.
 */
export function App() {
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <Canvas
        shadows
        camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV, near: 1, far: 60 }}
        style={{ width: '100%', height: '100%' }}
        onCreated={({ camera }) => camera.lookAt(...CAMERA_TARGET)}
      >
        <color attach="background" args={['#0d1015']} />
        <fog attach="fog" args={['#0d1015', 12, 22]} />
        <GameScene />
      </Canvas>
      <PointerControls />
      <InspectionPanel />
      <PileSearchHost />
      <TurnHud />
      <PhaseBanner />
      <ScoreHud />
      <NoticeToast />
      <TributeModal />
      <AbilityTargetModal />
      <OnSetChoiceModal />
      <SpellCostModal />
      <SpellChoiceModal />
      <AbilityPromptModal />
      <CounterPromptModal />
      <CombatPromptModal />
      <SummonSlotPrompt />
    </div>
  );
}
