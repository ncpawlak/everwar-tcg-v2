import { BOARD_Y } from '../board/boardConfig';

/** The playmat surface. Sits at the board plane and catches card shadows. */
export function BoardView() {
  return (
    <mesh
      position={[0, BOARD_Y - 0.011, 0.4]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[9, 7]} />
      <meshStandardMaterial color="#16302a" roughness={0.9} metalness={0.0} />
    </mesh>
  );
}
